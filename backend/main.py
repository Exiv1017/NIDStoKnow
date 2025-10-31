from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from typing import Optional
from fastapi.middleware.cors import CORSMiddleware
import json
import os
import time
from typing import List, Dict
import asyncio
from datetime import datetime
from cowrie_integration.api import router as cowrie_router
from student_api import router as student_router
# Import internal helpers to ensure schema safety on startup
try:
    from student_api import _ensure_student_progress_unit_columns, _ensure_student_progress_unique_index, get_db_connection as _sp_get_db
except Exception:
    _ensure_student_progress_unit_columns = None
    _ensure_student_progress_unique_index = None
    _sp_get_db = None
from admin_api import router as admin_router
from instructor_api import router as instructor_router
from lobby_ws import router as lobby_ws_router
import subprocess
import threading
import logging
from websocket_terminal_pty import websocket_terminal_with_pty
from cowrie_terminal import websocket_cowrie_terminal
from signature_matcher import SignatureMatcher
import mysql.connector

# Import Isolation Forest database class
from isolation_forest_api import IsolationForestDB
from isolation_forest_runtime import ensure_model_loaded
from fastapi.openapi.utils import get_openapi
from fastapi.staticfiles import StaticFiles
from fastapi import Body
import sys

# --- Logging configuration (ensure our warnings/errors show in container logs) ---
try:
    import logging
    logging.captureWarnings(True)
    _lvl_name = os.getenv("LOG_LEVEL", "INFO").upper()
    _lvl = getattr(logging, _lvl_name, logging.INFO)
    logging.basicConfig(
        level=_lvl,
        stream=sys.stdout,
        format="%(asctime)s [%(levelname)s] %(message)s",
    )
    # Make sure uvicorn and paramiko don't drown/lose our messages
    logging.getLogger("uvicorn").setLevel(logging.INFO)
    logging.getLogger("uvicorn.error").setLevel(logging.INFO)
    logging.getLogger("uvicorn.access").setLevel(logging.INFO)
    # Paramiko debug can be enabled by setting LOG_LEVEL=DEBUG
    if _lvl <= logging.DEBUG:
        logging.getLogger("paramiko").setLevel(logging.DEBUG)
except Exception:
    pass

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Make Swagger UI show an "Authorize" button for Bearer JWT without changing runtime auth.
def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    openapi_schema = get_openapi(
        title="FastAPI",
        version="0.1.0",
        routes=app.routes,
    )
    comps = openapi_schema.get("components", {})
    security_schemes = comps.get("securitySchemes", {})
    security_schemes["BearerAuth"] = {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT",
    }
    comps["securitySchemes"] = security_schemes
    openapi_schema["components"] = comps
    # Set a default security requirement for docs; runtime auth still enforced by code.
    openapi_schema["security"] = [{"BearerAuth": []}]
    app.openapi_schema = openapi_schema
    return app.openapi_schema

app.openapi = custom_openapi

# Include Cowrie API routes
app.include_router(cowrie_router, prefix="/api")
app.include_router(student_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(instructor_router, prefix="/api")
# Expose lobby WS under both /api/ws/... and /ws/... so Nginx rewrites and clients work
app.include_router(lobby_ws_router, prefix="/api")
try:
    # Also mount without /api prefix to accept paths like /ws/lobby/* directly
    app.include_router(lobby_ws_router)
except Exception:
    pass

# Serve uploaded files (avatars, etc.)
try:
    BASE_DIR = os.path.dirname(__file__)
    UPLOADS_DIR = os.path.join(BASE_DIR, "uploads")
    os.makedirs(UPLOADS_DIR, exist_ok=True)
    # Mount at /uploads so returned URLs like /uploads/avatars/students/... work
    app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")
except Exception as e:
    print(f"[WARN] Failed to configure uploads static directory: {e}")

# Initialize Isolation Forest database
isolation_forest_db = IsolationForestDB()

# Dev simulator flag
DEV_SIMULATOR_ENABLED = os.getenv("DEV_SIMULATOR_ENABLED", "false").lower() in ("1", "true", "yes")

# Configuration
# Default to /dev/null to avoid noisy warnings if Cowrie logs aren't present
COWRIE_LOG_PATH = os.getenv("COWRIE_LOG_PATH", "/dev/null")
ATTACK_TYPES = {
    "ssh": "SSH Brute Force",
    "telnet": "Telnet Brute Force",
    "command": "Command Injection",
    "download": "Malware Download",
    "input": "Input Validation Attack"
}

from config import MYSQL_CONFIG, get_db_connection

# --- Startup schema guard: make sure new unit columns exist so summary endpoint won't 500 ---
@app.on_event("startup")
def _startup_schema_guard():
    if not (_ensure_student_progress_unit_columns and _sp_get_db):
        return
    try:
        conn = _sp_get_db(); cur = conn.cursor(buffered=True)
        _ensure_student_progress_unit_columns(cur)
        if _ensure_student_progress_unique_index:
            try:
                _ensure_student_progress_unique_index(cur)
            except Exception as ie:
                print(f"[WARN] unique index ensure failed at startup: {ie}")
        conn.commit()
    except Exception as e:
        print(f"[WARN] startup schema guard failed: {e}")
    finally:
        try:
            cur.close(); conn.close()
        except Exception:
            pass

def _ensure_signatures_schema(cursor):
    """Ensure the signatures table exists with columns expected by the API.
    Also migrate older schema variants (rule_name/category/severity) to add missing columns.
    """
    cursor.execute(
        '''
        CREATE TABLE IF NOT EXISTS signatures (
            id INT AUTO_INCREMENT PRIMARY KEY,
            pattern TEXT NOT NULL,
            description VARCHAR(255) NULL,
            type VARCHAR(64) NULL,
            regex TINYINT(1) DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        '''
    )
    # Add missing columns if table exists with older layout
    try:
        cursor.execute("SHOW COLUMNS FROM signatures")
        cols = {row[0]: str(row[1]).lower() for row in cursor.fetchall()}
        # Ensure columns exist
        if 'description' not in cols:
            cursor.execute("ALTER TABLE signatures ADD COLUMN description VARCHAR(255) NULL")
        if 'type' not in cols:
            cursor.execute("ALTER TABLE signatures ADD COLUMN type VARCHAR(64) NULL")
        if 'regex' not in cols:
            cursor.execute("ALTER TABLE signatures ADD COLUMN regex TINYINT(1) DEFAULT 0")
        # Ensure pattern can store long strings
        if 'pattern' in cols and 'text' not in cols['pattern']:
            try:
                cursor.execute("ALTER TABLE signatures MODIFY COLUMN pattern TEXT NOT NULL")
            except Exception:
                pass
        # If legacy columns exist, backfill description/type
        legacy_desc = 'rule_name' in cols
        legacy_type = 'category' in cols
        if legacy_desc:
            try:
                cursor.execute("UPDATE signatures SET description=COALESCE(description, rule_name)")
            except Exception:
                pass
        if legacy_type:
            try:
                cursor.execute("UPDATE signatures SET type=COALESCE(type, category)")
            except Exception:
                pass
    except Exception as e:
        print(f"[WARN] signatures schema ensure/migrate skipped: {e}")

def _seed_default_signatures(cursor):
    """Insert a small default set of signatures if table is empty.

    This helps first-time deployments get an immediate Live Detections demo
    without manual DB seeding. Safe to call repeatedly; it inserts only when
    COUNT(*) == 0.
    """
    try:
        cursor.execute("SELECT COUNT(*) FROM signatures")
        rowcount = cursor.fetchone()[0]
        if int(rowcount or 0) > 0:
            return
        # Insert defaults (mirror backend/sql/signatures.sql examples)
        defaults = [
                # --- Reconnaissance ---
                ("nmap", "Nmap scan detected", "Recon", 0),
                ("masscan", "Masscan port scan detected", "Recon", 0),
                ("curl", "Curl usage detected", "Recon", 0),
                ("wget", "Wget usage detected", "Recon", 0),
                ("whois", "WHOIS lookup detected", "Recon", 0),
                ("dig", "DNS reconnaissance detected", "Recon", 0),
                ("ping", "ICMP echo request detected", "Recon", 0),

                # --- Exploitation / Command Execution ---
                ("bash -i", "Interactive bash shell spawned", "Execution", 0),
                ("nc -e", "Netcat reverse shell attempt", "Execution", 0),
                ("/bin/sh", "Shell execution detected", "Execution", 0),
                ("python -c", "Python command execution", "Execution", 0),
                ("perl -e", "Perl command execution", "Execution", 0),
                ("php -r", "PHP command execution", "Execution", 0),

                # --- Privilege Escalation ---
                ("sudo", "Potential privilege escalation via sudo", "Privilege Escalation", 0),
                ("chmod +x", "File permission modification (chmod +x)", "Privilege Escalation", 0),
                ("/etc/sudoers", "Access to sudoers file", "Privilege Escalation", 0),
                ("su root", "Root user switch attempt", "Privilege Escalation", 0),

                # --- Sensitive File Access ---
                ("/etc/passwd", "Sensitive file reference", "File Access", 0),
                ("/etc/shadow", "Shadow file reference", "File Access", 0),
                ("/var/log/auth.log", "Authentication log access", "File Access", 0),
                ("/root/.ssh/id_rsa", "Private SSH key access", "File Access", 0),

                # --- Destructive Behavior ---
                ("rm -rf", "Dangerous recursive file deletion", "Destruction", 0),
                ("mkfs", "Filesystem format command detected", "Destruction", 0),
                ("dd if=", "Disk overwrite command detected", "Destruction", 0),

                # --- Network / Exfiltration ---
                ("scp", "Secure copy usage detected", "Exfiltration", 0),
                ("ftp", "FTP data transfer detected", "Exfiltration", 0),
                ("curl -T", "Curl file upload attempt", "Exfiltration", 0),
                ("wget --post-file", "Wget data exfiltration attempt", "Exfiltration", 0),

                # --- Malware / Persistence Indicators ---
                ("crontab -e", "Cronjob modification attempt", "Persistence", 0),
                ("/etc/rc.local", "Persistence via rc.local", "Persistence", 0),
                ("systemctl enable", "Service persistence attempt", "Persistence", 0),

                # --- Regex patterns for flexible matching ---
                (r"cat\s+.*\/etc\/passwd", "Sensitive file access", "File Access", 1),
                (r"cat\s+.*\/etc\/shadow", "Shadow file access", "File Access", 1),
                (r"wget\s+.*", "Wget download activity", "Download", 1),
                (r"curl\s+.*", "Curl download activity", "Download", 1),
                (r"chmod\s+\+x\s+.*", "File permission change", "Privilege Escalation", 1),
                (r"rm\s+-rf\s+.*", "Recursive file deletion", "Destruction", 1),
                (r"scp\s+.*@.*:.*", "SCP data transfer", "Exfiltration", 1),
                (r"python3?\s+-c\s+['\"].*['\"]", "Inline Python code execution", "Execution", 1),
                (r"bash\s+-i\s+>&", "Reverse shell attempt via bash", "Execution", 1),
                (r"nc\s+-e\s+/bin/sh", "Netcat reverse shell attempt", "Execution", 1),
            ]

        cursor.executemany(
            "INSERT INTO signatures (pattern, description, type, regex) VALUES (%s, %s, %s, %s)",
            defaults,
        )
    except Exception as e:  # pragma: no cover
        print(f"[WARN] default signature seed skipped: {e}")

def load_signatures_from_db():
    """Load signatures from DB while supporting both legacy and current schemas.

    Some deployments may have legacy columns (rule_name, category) while others
    only have the new columns (description, type, regex). Referencing a
    non-existent column in SELECT causes MySQL to error, so we first introspect
    available columns and build a compatible SELECT list.
    """
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        _ensure_signatures_schema(cursor)
        _seed_default_signatures(cursor)
        conn.commit()

        # Discover available columns
        try:
            cursor.execute("SHOW COLUMNS FROM signatures")
            cols_raw = cursor.fetchall() or []
            if cols_raw and isinstance(cols_raw[0], dict):
                cols = {row.get('Field') for row in cols_raw if isinstance(row, dict)}
            else:
                cols = {row[0] for row in cols_raw}
        except Exception:
            cols = set()

        has_desc = 'description' in cols
        has_rule_name = 'rule_name' in cols
        has_type = 'type' in cols
        has_category = 'category' in cols
        has_regex = 'regex' in cols

        # Build compatible expressions with aliases (so dict keys are stable)
        if has_desc and has_rule_name:
            description_expr = "COALESCE(description, rule_name, '') AS description"
        elif has_desc:
            description_expr = "COALESCE(description, '') AS description"
        elif has_rule_name:
            description_expr = "COALESCE(rule_name, '') AS description"
        else:
            description_expr = "'' AS description"

        if has_type and has_category:
            type_expr = "COALESCE(type, category, 'generic') AS type"
        elif has_type:
            type_expr = "COALESCE(type, 'generic') AS type"
        elif has_category:
            type_expr = "COALESCE(category, 'generic') AS type"
        else:
            type_expr = "'generic' AS type"

        if has_regex:
            regex_expr = "COALESCE(regex, 0) AS regex"
        else:
            regex_expr = "0 AS regex"

        query = f"SELECT id, pattern, {description_expr}, {type_expr}, {regex_expr} FROM signatures"
        cursor.execute(query)
        sigs = cursor.fetchall()
    finally:
        cursor.close()
        conn.close()

    # Normalize regex to Python bool
    for s in sigs:
        try:
            s['regex'] = bool(s.get('regex', 0))
        except Exception:
            s['regex'] = False

    # Merge in a small set of built-in signatures if they're missing in DB.
    # This guarantees out-of-the-box detections for common commands used in demos.
    try:
        existing_patterns = {str(s.get('pattern')) for s in sigs}
        # Provide both literal (AC) and regex variants so AC detections appear for common commands.
        builtin = [
            # Aho-Corasick (literal) patterns
            {"pattern": "nmap", "description": "Nmap scan detected", "type": "Recon", "regex": False},
            {"pattern": "curl", "description": "Curl usage detected", "type": "Download", "regex": False},
            {"pattern": "wget", "description": "Wget usage detected", "type": "Download", "regex": False},
            {"pattern": "ssh", "description": "SSH usage detected", "type": "SSH", "regex": False},
            {"pattern": "/etc/passwd", "description": "Sensitive file reference", "type": "File Access", "regex": False},
            {"pattern": "/etc/shadow", "description": "Shadow file reference", "type": "File Access", "regex": False},
            {"pattern": "chmod +x", "description": "Chmod +x execution", "type": "Execution", "regex": False},
            {"pattern": "rm -rf", "description": "Dangerous file removal", "type": "Destruction", "regex": False},
            # Additional patterns to append (paste into your builtin list)
            {"pattern": "masscan", "description": "Masscan port scan detected", "type": "Recon", "regex": False},
            {"pattern": "whois", "description": "WHOIS lookup detected", "type": "Recon", "regex": False},
            {"pattern": "dig", "description": "DNS lookup detected", "type": "Recon", "regex": False},
            {"pattern": "ncat", "description": "Ncat/netcat detected", "type": "Recon", "regex": False},
            {"pattern": "nc -e", "description": "Netcat reverse shell attempt", "type": "Execution", "regex": False},
            {"pattern": "socat", "description": "Socat detected (potential tunneling)", "type": "Execution", "regex": False},
            {"pattern": "python -m http.server", "description": "Python simple HTTP server", "type": "Exfiltration", "regex": False},
            {"pattern": "python3 -m http.server", "description": "Python simple HTTP server", "type": "Exfiltration", "regex": False},
            {"pattern": "php -S", "description": "PHP built-in web server", "type": "Exfiltration", "regex": False},
            {"pattern": "git clone", "description": "Repository clone detected", "type": "Recon", "regex": False},
            {"pattern": "curl -X POST", "description": "HTTP POST detected (possible exfiltration/C2)", "type": "Exfiltration", "regex": False},
            {"pattern": "wget -O -", "description": "Wget streaming to stdout (possible downloader)", "type": "Download", "regex": False},
            {"pattern": "base64 -d", "description": "Base64 decode (possible payload decoding)", "type": "Obfuscation", "regex": False},
            {"pattern": "openssl s_client", "description": "OpenSSL client usage (TLS connections)", "type": "Network", "regex": False},
            {"pattern": "certutil -urlcache -f", "description": "Certutil used to download files (Windows)", "type": "Download", "regex": False},
            {"pattern": "powershell -enc", "description": "Encoded PowerShell command", "type": "Execution", "regex": False},
            {"pattern": "powershell -nop -w hidden", "description": "Suspicious PowerShell flags", "type": "Execution", "regex": False},
            {"pattern": "mshta", "description": "mshta usage (HTML application execution)", "type": "Execution", "regex": False},
            {"pattern": "rundll32", "description": "rundll32 usage (DLL execution)", "type": "Execution", "regex": False},
            {"pattern": "reg add", "description": "Registry modification attempt", "type": "Persistence", "regex": False},
            {"pattern": "schtasks /create", "description": "Scheduled task creation (Windows persistence)", "type": "Persistence", "regex": False},
            {"pattern": "crontab -e", "description": "Crontab edit (Unix persistence)", "type": "Persistence", "regex": False},
            {"pattern": "systemctl enable", "description": "Service enable (persistence)", "type": "Persistence", "regex": False},
            {"pattern": "systemctl disable", "description": "Service disable (suspicious)", "type": "Persistence", "regex": False},
            {"pattern": "useradd", "description": "User creation detected", "type": "Privilege Escalation", "regex": False},
            {"pattern": "passwd ", "description": "Password change operation", "type": "Privilege Escalation", "regex": False},
            {"pattern": "chown ", "description": "Ownership change detected", "type": "Privilege Escalation", "regex": False},
            {"pattern": "dd if=", "description": "Disk overwrite/read with dd", "type": "Destruction", "regex": False},
            {"pattern": "tar czf", "description": "Archive creation (potential data staging)", "type": "Exfiltration", "regex": False},

            # Regex-based flexible patterns
            {"pattern": r"curl\s+.*-u\s+[^ ]+", "description": "Curl with basic auth (possible credential use)", "type": "Network", "regex": True},
            {"pattern": r"wget\s+https?://\S+", "description": "Wget fetching URL", "type": "Download", "regex": True},
            {"pattern": r"scp\s+.*@.*:.*", "description": "SCP data transfer", "type": "Exfiltration", "regex": True},
            {"pattern": r"ssh\s+.*@.*", "description": "SSH to remote host (interactive sessions)", "type": "SSH", "regex": True},
            {"pattern": r"curl\s+.*--data|-d\s+.*", "description": "Curl sending data (POST/PUT) - possible exfil/C2", "type": "Exfiltration", "regex": True},
            {"pattern": r"powershell\s+.*-EncodedCommand\s+\S+", "description": "Encoded PowerShell command (regex)", "type": "Execution", "regex": True},
            {"pattern": r"base64\s+.*-d", "description": "Base64 decode command", "type": "Obfuscation", "regex": True},
            {"pattern": r"python\d?\s+.*-c\s+['\"].*['\"]", "description": "Inline Python execution", "type": "Execution", "regex": True},
            {"pattern": r"nc\s+.*\d+\s+-e\s+\/bin\/sh", "description": "Netcat reverse shell pattern", "type": "Execution", "regex": True},
            {"pattern": r"openssl\s+req|openssl\s+smime|openssl\s+enc", "description": "OpenSSL suspicious usage", "type": "Network", "regex": True},

            # Regex variants for flexible matching
            {"pattern": r"cat\s+.*\/etc\/passwd", "description": "Sensitive file access", "type": "File Access", "regex": True},
            {"pattern": r"cat\s+.*\/etc\/shadow", "description": "Shadow file access", "type": "File Access", "regex": True},
            {"pattern": r"wget\s+.*", "description": "Wget download", "type": "Download", "regex": True},
            {"pattern": r"curl\s+.*", "description": "Curl download", "type": "Download", "regex": True},
            {"pattern": r"chmod\s+\+x\s+.*", "description": "Chmod +x execution", "type": "Execution", "regex": True},
            {"pattern": r"rm\s+-rf\s+.*", "description": "Dangerous file removal", "type": "Destruction", "regex": True},
        ]
        added = 0
        for b in builtin:
            if b["pattern"] not in existing_patterns:
                sigs.append({
                    "id": None,
                    "pattern": b["pattern"],
                    "description": b["description"],
                    "type": b["type"],
                    "regex": bool(b["regex"]) 
                })
                added += 1
        if added:
            try:
                logging.info(f"[signature.load] augmented with {added} builtin signatures (in-memory only)")
            except Exception:
                pass
    except Exception as _e:
        try:
            logging.warning(f"[signature.load] builtin merge skipped: {_e}")
        except Exception:
            pass
    return sigs

# Load signatures from DB at startup (defensive: don't crash app if DB unreachable)
try:
    SIGNATURES = load_signatures_from_db()
except Exception as e:
    print(f"[WARN] Failed to load signatures from DB at startup: {e}\n         Falling back to empty signature set.")
    SIGNATURES = []

try:
    matcher = SignatureMatcher(SIGNATURES)
except Exception as e:
    # Absolute fallback – should never really happen
    print(f"[WARN] Failed to initialize SignatureMatcher: {e}")
    class _NoopMatcher:
        def match(self, content):
            return []
    matcher = _NoopMatcher()

# ===================== ANOMALY MODEL META =====================

@app.get("/api/anomaly/model-meta")
def anomaly_model_meta():
    """Expose Isolation Forest model metadata (version, trained_at, config, feature names).

    Frontend uses this for transparency panel in Anomaly Simulation.
    """
    try:
        _, meta = ensure_model_loaded()
        if not meta:
            raise HTTPException(status_code=503, detail="Model metadata unavailable")
        # Limit exposure to safe keys only
        safe = {
            "version": meta.get("version"),
            "trained_at": meta.get("trained_at"),
            "feature_names": meta.get("feature_names", []),
            "config": meta.get("config", {}),
            "min_df": meta.get("min_df"),
            "max_df": meta.get("max_df"),
        }
        return {"success": True, "meta": safe}
    except HTTPException:
        raise
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=f"Failed to load model meta: {e}")

@app.get("/api/anomaly/patterns")
def anomaly_patterns():
    """Return active anomaly feature boosting patterns (name, regex, type, boost, severity, description)."""
    try:
        # Fetch all patterns (active + inactive) for administrative visibility
        patterns = isolation_forest_db.get_feature_patterns(active_only=False) or []
        cleaned = [
            {
                "id": p.get("id"),
                "name": p.get("pattern_name"),
                "regex": p.get("pattern_regex"),
                "type": p.get("feature_type"),
                "boost": float(p.get("boost_value") or 0),
                "severity": p.get("severity"),
                "active": bool(p.get("is_active", True)),
                "description": p.get("description"),
            }
            for p in patterns
        ]
        # active ones first
        cleaned.sort(key=lambda x: (not x['active'], -x['boost'], x['name']))
        return {"success": True, "patterns": cleaned, "count": len(cleaned)}
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=f"Failed to fetch patterns: {e}")

@app.post("/api/anomaly/patterns")
def anomaly_add_pattern(payload: dict):
    """Add a new anomaly feature pattern.

    JSON body must include: pattern_name, pattern_regex, feature_type, boost_value.
    Optional: description, severity (Low/Medium/High), is_active (default true)
    """
    required = ["pattern_name", "pattern_regex", "feature_type", "boost_value"]
    if not all(k in payload for k in required):
        raise HTTPException(status_code=400, detail=f"Missing required fields: {', '.join(required)}")
    new_id = isolation_forest_db.add_feature_pattern(
        payload["pattern_name"],
        payload["pattern_regex"],
        payload["feature_type"],
        payload["boost_value"],
        payload.get("description"),
        payload.get("severity", "Medium"),
        payload.get("is_active", True),
    )
    if new_id is None:
        raise HTTPException(status_code=500, detail="Failed to insert pattern")
    return {"success": True, "id": new_id}

@app.post("/api/anomaly/patterns/bulk")
def anomaly_bulk_add(payload: dict):
    """Bulk add anomaly feature patterns.

    JSON body: {"patterns": [ {pattern_name, pattern_regex, feature_type, boost_value, ...}, ... ] }
    Skips duplicates by (pattern_name, pattern_regex).
    """
    items = payload.get("patterns")
    if not isinstance(items, list):
        raise HTTPException(status_code=400, detail="'patterns' must be a list")
    # Basic validation of required keys
    required = {"pattern_name", "pattern_regex", "feature_type", "boost_value"}
    for i, p in enumerate(items):
        missing = required - set(p.keys())
        if missing:
            raise HTTPException(status_code=400, detail=f"Item {i} missing fields: {', '.join(missing)}")
    result = isolation_forest_db.bulk_add_feature_patterns(items)
    return {"success": True, **result}

@app.patch("/api/anomaly/patterns/{pattern_id}/active")
def anomaly_toggle_pattern(pattern_id: int, payload: dict):
    """Activate or deactivate a pattern. JSON body: {"active": true/false}"""
    if "active" not in payload:
        raise HTTPException(status_code=400, detail="Field 'active' required")
    ok = isolation_forest_db.set_feature_pattern_active(pattern_id, bool(payload["active"]))
    if not ok:
        raise HTTPException(status_code=404, detail="Pattern not found or not updated")
    return {"success": True, "id": pattern_id, "active": bool(payload['active'])}

# ===================== HYBRID DETECT (KEEP FRONTEND COMPATIBLE) =====================

@app.post("/api/hybrid/detect")
async def hybrid_detect(payload: dict):
    """Compatibility endpoint used by DefendSimulation. Combines signature + simple anomaly heuristic."""
    content = payload.get("data", "")
    timestamp = payload.get("timestamp")
    try:
        # Signature matches
        sig_matches = matcher.match(content)
        detected_threats = [m.get("description", m.get("pattern")) for m in sig_matches]

        # Simple heuristic confidence: base + 0.15 per match, capped
        base_conf = 0.25
        confidence = min(1.0, base_conf + 0.15 * len(sig_matches))
        return {
            "threats_detected": len(sig_matches),
            "detected_threats": detected_threats,
            "confidence": confidence,
            "detection_method": "hybrid",
            "timestamp": timestamp,
        }
    except Exception as e:
        print(f"Hybrid detect error: {e}")
        return {
            "threats_detected": 0,
            "detected_threats": [],
            "confidence": 0.0,
            "detection_method": "hybrid",
            "timestamp": timestamp,
        }

# ===================== STUDENT SIMULATION WEBSOCKET =====================

# In-memory simulation rooms (demo purposes)
simulation_rooms: Dict[str, Dict] = {}

# Difficulty rules and thresholds
DIFFICULTY_SETTINGS = {
    "Beginner": {
        "key": "Beginner",
        "objective_count": 6,
        "hints_enabled": True,
        "hints_quota": 12,  # total hints per attacker session (listed command keywords only)
        "hard_objectives": 1,  # number of 20-point objectives
        "pass_score": 40,
        "penalize_irrelevant": False,
    },
    "Intermediate": {
        "key": "Intermediate",
        "objective_count": 8,
        "hints_enabled": False,
        "hints_quota": 0,
        "hard_objectives": 1,  # assumption: still one 20-point objective unless changed later
        "pass_score": 60,
        "penalize_irrelevant": False,
    },
    "Hard": {
        "key": "Hard",
        "objective_count": 10,
        "hints_enabled": False,
        "hints_quota": 0,
        "hard_objectives": 2,  # two 20-point objectives
        "pass_score": 80,
        "penalize_irrelevant": True,  # -3 points for unrelated/typo commands
    },
}

ATTACKER_OBJECTIVE_POOL = [
    {"id": "recon_scan", "description": "Perform reconnaissance scan", "triggers": ["nmap", "ping", "nc"], "base": 10},
    {"id": "bruteforce_login", "description": "Attempt brute force login", "triggers": ["hydra", "ssh", "ftp"], "base": 10},
    {"id": "priv_esc", "description": "Execute privilege escalation", "triggers": ["sudo", "su", "chmod"], "base": 10},
    {"id": "persistence", "description": "Install persistence mechanism", "triggers": ["crontab", "systemctl", ".bashrc"], "base": 10},
    {"id": "web_enum", "description": "Enumerate web services", "triggers": ["nikto", "gobuster", "dirb"], "base": 10},
    {"id": "password_harvest", "description": "Harvest credentials or hashes", "triggers": ["shadow", "password", "hashcat"], "base": 10},
    {"id": "backdoor_setup", "description": "Deploy a backdoor listener", "triggers": ["nc", "socat", "bash"], "base": 10},
    {"id": "data_exfil", "description": "Exfiltrate data from target", "triggers": ["scp", "curl", "wget"], "base": 10},
    {"id": "lateral_move", "description": "Attempt lateral movement", "triggers": ["ssh", "proxychains", "pssh"], "base": 10},
    {"id": "log_clean", "description": "Attempt to clean logs or cover tracks", "triggers": ["history", "rm", "shred"], "base": 10},
]

def init_room(lobby_code: str):
    if lobby_code not in simulation_rooms:
        simulation_rooms[lobby_code] = {
            "difficulty": "Beginner",
            "participants": {},  # name -> {role, ws}
            "scores": {},        # name -> int
            "attacker_objectives": {},  # name -> [{id, description, points, completed}]
            "event_log": [],
            # Tweaks: keep last attack info and defender cooldowns for fair play
            "recent_attack": None,    # {by, categories, threats, command, ts}
            "defender_cooldowns": {}, # name -> last_ts
            "classified_events": {},   # event_id -> set(defender_names) to prevent double scoring
            # Queue of objective completions awaiting defense resolution
            "pending_defenses": [],    # [{attacker, objective_id, category, points, defended_by: None, ts}]
            # Hints tracking per attacker
            "hint_usage": {},          # name -> total count of hints returned
            "hint_progress": {},       # name -> {objective_id -> hint_index}
            "metrics": {               # simple counters for instructor dashboard
                "totalEvents": 0,
                "attacksLaunched": 0,
                "detectionsTriggered": 0,
            },
        }

def assign_objectives_for_attacker(lobby_code: str, name: str):
    import random
    room = simulation_rooms.get(lobby_code)
    diff = room.get("difficulty", "Beginner") if room else "Beginner"
    rules = DIFFICULTY_SETTINGS.get(diff, DIFFICULTY_SETTINGS["Beginner"])
    pool = ATTACKER_OBJECTIVE_POOL[:]
    random.shuffle(pool)
    # Choose the requested number of objectives
    count = min(rules["objective_count"], len(pool))
    chosen = pool[:count]
    # Default all to 10 pts, then mark some as 20 according to rules
    selected = [
        {"id": o["id"], "description": o["description"], "points": 10, "completed": False}
        for o in chosen
    ]
    # Select hard objectives to set to 20 (ensure uniqueness and <= count)
    hard_n = min(rules.get("hard_objectives", 1), len(selected))
    hard_idxs = list(range(len(selected)))
    random.shuffle(hard_idxs)
    for idx in hard_idxs[:hard_n]:
        selected[idx]["points"] = 20
    simulation_rooms[lobby_code]["attacker_objectives"][name] = selected
    return selected

def room_broadcast(lobby_code: str, message: dict, roles: List[str] = None):
    """Broadcast to all connections in room, optionally filter by role(s)."""
    room = simulation_rooms.get(lobby_code)
    if not room:
        return []
    to_remove = []
    for pname, p in room["participants"].items():
        if roles and p["role"] not in roles:
            continue
        ws: WebSocket = p.get("ws")
        if not ws:
            continue
        try:
            asyncio.create_task(ws.send_json(message))
        except Exception:
            to_remove.append(pname)
    for pname in to_remove:
        room["participants"].pop(pname, None)
    return to_remove

def log_and_notify_instructors(lobby_code: str, event_type: str, description: str, participant_name: str = None):
    # Log locally
    room = simulation_rooms.get(lobby_code)
    if room is not None:
        room["event_log"].append({
            "timestamp": datetime.now().isoformat(),
            "type": event_type,
            "description": description,
            "participant": participant_name,
        })
    # Notify instructor listeners using existing function
    return asyncio.create_task(log_simulation_event(lobby_code, event_type, description, participant_name))

# --- Instructor push helpers ---
async def push_metrics_to_instructors(lobby_code: str):
    room = simulation_rooms.get(lobby_code) or {}
    metrics = room.get("metrics") or {"totalEvents": 0, "attacksLaunched": 0, "detectionsTriggered": 0}
    # include participantsCount for convenience (exclude instructors)
    try:
        parts = room.get("participants") or {}
        participants_count = sum(1 for _n, p in parts.items() if (p.get("role") or "") != "Instructor")
        metrics = {**metrics, "participantsCount": participants_count}
    except Exception:
        pass
    if lobby_code in instructor_simulation_connections:
        for ws in list(instructor_simulation_connections[lobby_code]):
            try:
                await ws.send_json({"type": "simulation_metrics", "metrics": metrics})
                await ws.send_json({"type": "metrics_update", "metrics": metrics})
            except Exception:
                try:
                    instructor_simulation_connections[lobby_code] = [w for w in instructor_simulation_connections[lobby_code] if w != ws]
                except Exception:
                    pass

async def push_score_to_instructors(lobby_code: str, participant_name: str, score: int):
    """Send a typed score update to connected instructor dashboards."""
    if lobby_code in instructor_simulation_connections:
        for ws in list(instructor_simulation_connections[lobby_code]):
            try:
                await ws.send_json({
                    "type": "participant_score_update",
                    "participantId": participant_name,
                    "name": participant_name,
                    "score": int(score)
                })
            except Exception:
                try:
                    instructor_simulation_connections[lobby_code] = [w for w in instructor_simulation_connections[lobby_code] if w != ws]
                except Exception:
                    pass

async def push_participants_to_instructors(lobby_code: str):
    room = simulation_rooms.get(lobby_code) or {}
    parts = []
    for n, p in (room.get("participants") or {}).items():
        parts.append({"id": n, "name": n, "role": p.get("role"), "connected": bool(p.get("ws"))})
    if lobby_code in instructor_simulation_connections:
        for ws in list(instructor_simulation_connections[lobby_code]):
            try:
                await ws.send_json({"type": "participant_update", "participants": parts})
            except Exception:
                try:
                    instructor_simulation_connections[lobby_code] = [w for w in instructor_simulation_connections[lobby_code] if w != ws]
                except Exception:
                    pass

def categorize_command(command: str) -> List[str]:
    """Rudimentary mapping of command text to high-level categories."""
    c = command.lower()
    cats = set()
    if any(k in c for k in ["nmap", "ping ", " nc ", " nc-", " netcat "]):
        cats.add("recon")
    if any(k in c for k in ["hydra", " hydra:", "ssh ", " ftp "]):
        cats.add("brute")
    if any(k in c for k in ["sudo", " su ", "chmod", " setuid "]):
        cats.add("priv")
    if any(k in c for k in ["crontab", " systemctl", ".bashrc", " rc.local "]):
        cats.add("persistence")
    return list(cats)

def objective_hints(lobby_code: str, name: str) -> List[Dict]:
    """Return a hint per incomplete objective, respecting difficulty and quotas.

    - Beginner: enabled, up to 12 total per attacker. Each hint reveals only a trigger keyword (not full command).
    - Intermediate/Hard: disabled (returns empty list).
    """
    room = simulation_rooms.get(lobby_code)
    if not room:
        return []
    diff = room.get("difficulty", "Beginner")
    rules = DIFFICULTY_SETTINGS.get(diff, DIFFICULTY_SETTINGS["Beginner"])
    if not rules.get("hints_enabled", False):
        return []

    # Quota tracking
    used = room.setdefault("hint_usage", {}).get(name, 0)
    quota = rules.get("hints_quota", 0)
    remaining = max(0, quota - used)
    if remaining <= 0:
        return []

    items = [o for o in room.get("attacker_objectives", {}).get(name, []) if not o.get("completed")]
    hints: List[Dict] = []
    # Per-objective progressive hints using triggers list
    prog = room.setdefault("hint_progress", {}).setdefault(name, {})
    for it in items:
        if remaining <= 0:
            break
        pool_entry = next((o for o in ATTACKER_OBJECTIVE_POOL if o["id"] == it["id"]), None)
        if not pool_entry:
            continue
        triggers = pool_entry.get("triggers", [])
        idx = prog.get(it["id"], 0)
        if idx >= len(triggers):
            # Already revealed all trigger keywords for this objective
            continue
        hint_txt = triggers[idx]
        hints.append({"id": it["id"], "hint": f"Try using: {hint_txt}"})
        prog[it["id"]] = idx + 1
        remaining -= 1

    # Update usage count
    room.setdefault("hint_usage", {})[name] = used + len(hints)
    return hints

def check_objective_completion(lobby_code: str, attacker_name: str, command: str, event_id: int = None):
    room = simulation_rooms.get(lobby_code)
    if not room:
        return []
    objs = room["attacker_objectives"].get(attacker_name, [])
    completed_ids: List[str] = []
    for obj in objs:
        if obj.get("completed"):
            continue
        # Match triggers
        trigger_list = next((o["triggers"] for o in ATTACKER_OBJECTIVE_POOL if o["id"] == obj["id"]), [])
        if any(t in command for t in trigger_list):
            obj["completed"] = True
            room["scores"][attacker_name] = room["scores"].get(attacker_name, 0) + int(obj["points"])
            completed_ids.append(obj["id"])
            # Enqueue a defense opportunity tied to this objective
            try:
                cat = objective_id_to_category(obj["id"]) or ""
                room.setdefault("pending_defenses", []).append({
                    "attacker": attacker_name,
                    "objective_id": obj["id"],
                    "category": cat,
                    "points": int(obj["points"]),
                    "defended_by": None,
                    "ts": time.time(),
                    "event_id": event_id
                })
            except Exception:
                pass
    return completed_ids

def objective_id_to_category(obj_id: str) -> str:
    mapping = {
        "recon_scan": "recon",
        "web_enum": "recon",
        "bruteforce_login": "brute",
        "priv_esc": "priv",
        "password_harvest": "priv",
        "persistence": "persistence",
        "backdoor_setup": "persistence",
        "data_exfil": "persistence",
        "lateral_move": "priv",
        "log_clean": "persistence",
    }
    return mapping.get(obj_id, "")

def normalize_category_text(txt: str) -> List[str]:
    """Normalize free-text classification/objective strings into canonical category tokens.

    Returns a list of candidate category keys like ['recon','brute','priv','persistence'] if present.
    """
    if not txt:
        return []
    t = (txt or "").strip().lower()
    tokens = set()
    # Reconnaissance synonyms
    if any(k in t for k in ["recon", "reconnaissance", "scan", "scanning", "enumeration", "enum", "nmap", "nikto", "gobuster", "dirb"]):
        tokens.add("recon")
    # Brute force / credentials
    if any(k in t for k in ["brute", "bruteforce", "password", "credential", "login", "hydra", "ssh brute", "telnet brute"]):
        tokens.add("brute")
    # Privilege escalation
    if any(k in t for k in ["priv", "privilege", "escalation", "privesc", "sudo", "root", "suid", "setuid"]):
        tokens.add("priv")
    # Persistence / backdoor
    if any(k in t for k in ["persist", "persistence", "backdoor", "cron", "crontab", "service", "systemctl", "autorun", "rc.local", ".bashrc"]):
        tokens.add("persistence")
    return list(tokens)

from auth import decode_token

@app.websocket("/simulation/{lobby_code}")
async def simulation_websocket(websocket: WebSocket, lobby_code: str):
    # Enforce JWT similar to lobby_ws
    try:
        logging.info(f"[simulation_ws] WS connect attempt: lobby={lobby_code} headers={{}} query={{}}".format(dict(websocket.headers), dict(websocket.query_params)))
    except Exception:
        pass
    try:
        auth = websocket.headers.get('authorization') or websocket.headers.get('Authorization')
        token = None
        if auth and auth.lower().startswith('bearer '):
            token = auth.split(' ', 1)[1]
        if not token:
            token = websocket.query_params.get('token')
        if not token:
            try:
                logging.warning(f"[simulation_ws] denied connection: missing token for lobby={lobby_code}")
            except Exception:
                pass
            await websocket.close(code=4401)
            return
    # Validate token and enforce room-level access: only the room's instructor or joined students may connect
        payload = decode_token(token)
        role = (payload.get('role') or '').lower() if payload else ''
        user_id = None
        try:
            user_id = int(payload.get('sub')) if payload and payload.get('sub') else None
        except Exception:
            user_id = None
        # Ensure simulation room tables exist (defensive: create if missing)
        try:
            conn = get_db_connection(); cur = conn.cursor()
            cur.execute(
                '''
                CREATE TABLE IF NOT EXISTS simulation_rooms (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    instructor_id INT NOT NULL,
                    name VARCHAR(255) NOT NULL,
                    code VARCHAR(32) NOT NULL UNIQUE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                '''
            )
            cur.execute(
                '''
                CREATE TABLE IF NOT EXISTS simulation_room_members (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    room_id INT NOT NULL,
                    student_id INT NOT NULL,
                    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE KEY uniq_room_member (room_id, student_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                '''
            )
            # Lookup room by code
            cur.execute('SELECT id, instructor_id FROM simulation_rooms WHERE code=%s LIMIT 1', (lobby_code,))
            row = cur.fetchone()
            if not row:
                # Defensive fallback: try to find a persisted lobby definition in `lobbies` table
                try:
                    logging.warning(f"[simulation_ws] simulation_rooms row not found for code={lobby_code}, attempting fallback to lobbies table")
                except Exception:
                    pass
                try:
                    cur.execute('SELECT created_by FROM lobbies WHERE code=%s LIMIT 1', (lobby_code,))
                    lobby_row = cur.fetchone()
                    if lobby_row:
                        # Create a minimal simulation_rooms row using created_by as instructor_id (or 0)
                        try:
                            instr = int(lobby_row[0]) if isinstance(lobby_row, tuple) and lobby_row[0] is not None else (lobby_row.get('created_by') if isinstance(lobby_row, dict) else None)
                        except Exception:
                            instr = None
                        instr_id = int(instr) if instr is not None else 0
                        try:
                            cur.execute("INSERT IGNORE INTO simulation_rooms (instructor_id, name, code) VALUES (%s,%s,%s)", (instr_id, f"Lobby {lobby_code}", lobby_code))
                            conn.commit()
                        except Exception:
                            pass
                        # Re-query after attempted insert
                        cur.execute('SELECT id, instructor_id FROM simulation_rooms WHERE code=%s LIMIT 1', (lobby_code,))
                        row = cur.fetchone()
                except Exception:
                    # If fallback attempt fails, proceed to close
                    row = None
                if not row:
                    try:
                        logging.warning(f"[simulation_ws] lobby not found: {lobby_code}")
                    except Exception:
                        pass
                    try:
                        cur.close(); conn.close()
                    except Exception:
                        pass
                    await websocket.close(code=4404)
                    return
            room_id = int(row[0] if isinstance(row, tuple) else row[0])
            instr_id = int(row[1] if isinstance(row, tuple) else row[1])
            # Enforce role rules
            if role == 'instructor':
                if user_id is None or user_id != instr_id:
                    try:
                        logging.warning(f"[simulation_ws] instructor token mismatch: token_sub={user_id} instr_id={instr_id} lobby={lobby_code}")
                    except Exception:
                        pass
                    try:
                        cur.close(); conn.close()
                    except Exception:
                        pass
                    await websocket.close(code=4403)
                    return
            elif role == 'student':
                if user_id is None:
                    try:
                        cur.close(); conn.close()
                    except Exception:
                        pass
                    await websocket.close(code=4403)
                    return
                cur.execute('SELECT id FROM simulation_room_members WHERE room_id=%s AND student_id=%s LIMIT 1', (room_id, user_id))
                mem = cur.fetchone()
                if not mem:
                    # Attempt to create membership atomically if the lobby join just persisted it
                    try:
                        if user_id:
                            try:
                                cur.execute('INSERT IGNORE INTO simulation_room_members (room_id, student_id) VALUES (%s, %s)', (room_id, user_id))
                                conn.commit()
                            except Exception:
                                try:
                                    conn.rollback()
                                except Exception:
                                    pass
                            # Re-query after attempted insert
                            cur.execute('SELECT id FROM simulation_room_members WHERE room_id=%s AND student_id=%s LIMIT 1', (room_id, user_id))
                            mem = cur.fetchone()
                    except Exception:
                        mem = None
                if not mem:
                    try:
                        logging.warning(f"[simulation_ws] student not a member of room: student_id={user_id} lobby={lobby_code}")
                    except Exception:
                        pass
                    try:
                        cur.close(); conn.close()
                    except Exception:
                        pass
                    await websocket.close(code=4403)
                    return
            else:
                # admins and other roles may connect for observation
                pass
        except Exception:
            try:
                cur.close(); conn.close()
            except Exception:
                pass
            await websocket.close(code=4403)
            return
        finally:
            try:
                cur.close(); conn.close()
            except Exception:
                pass
    except Exception:
        await websocket.close(code=4403)
        return
    await websocket.accept()
    init_room(lobby_code)
    name = None
    role = None
    try:
        while True:
            data = await websocket.receive_json()
            msg_type = (data.get("type") or data.get("action") or "").lower()

            # Normalize payloads
            if msg_type == "join":
                name = data.get("name") or data.get("payload", {}).get("name")
                role = data.get("role") or data.get("payload", {}).get("role")
                if not name or not role:
                    await websocket.send_json({"type": "error", "message": "Missing name or role"})
                    continue
                # Register participant
                simulation_rooms[lobby_code]["participants"][name] = {"role": role, "ws": websocket}
                simulation_rooms[lobby_code]["scores"].setdefault(name, 0)
                # Initialize metrics if missing
                simulation_rooms[lobby_code].setdefault("metrics", {"totalEvents": 0, "attacksLaunched": 0, "detectionsTriggered": 0})
                if role.lower() == "attacker":
                    objs = assign_objectives_for_attacker(lobby_code, name)
                    try:
                        logging.info(f"[simulation_ws] assigned {len(objs or [])} objectives to attacker={name} lobby={lobby_code}")
                    except Exception:
                        pass
                    await websocket.send_json({"type": "objectives", "objectives": objs})
                # notify observers of participant join
                room_broadcast(lobby_code, {"type": "participant_joined", "name": name, "role": role}, roles=["Observer"])
                # notify instructors of participant list update
                try:
                    await push_participants_to_instructors(lobby_code)
                except Exception:
                    pass
                try:
                    await push_metrics_to_instructors(lobby_code)
                except Exception:
                    pass
                # Include pass threshold in join ack for clarity
                diff = simulation_rooms[lobby_code]["difficulty"]
                rules = DIFFICULTY_SETTINGS.get(diff, DIFFICULTY_SETTINGS["Beginner"])
                await websocket.send_json({
                    "type": "join_ack",
                    "difficulty": diff,
                    "pass_score": rules.get("pass_score", 0),
                    "hints_enabled": rules.get("hints_enabled", False)
                })
                continue

            if msg_type == "execute_command" or msg_type == "attack_command":
                command = data.get("command", "")
                cmd_role = (data.get("role") or role or "").lower()
                actor = data.get("name") or name or "Attacker"
                # Built-in helper commands for attackers
                cmd_lower = command.strip().lower()
                if cmd_lower in ("help", "objectives", "status", "score", "hint", "hints"):
                    room = simulation_rooms.get(lobby_code)
                    if cmd_lower in ("help",):
                        help_text = (
                            "Commands: objectives/status, hint(s), score.\n"
                            "- objectives/status: show your tasks and progress\n"
                            "- hint(s): get a nudge for remaining tasks\n"
                            "- score: show your current score"
                        )
                        await websocket.send_json({"type": "command_result", "command": command, "output": help_text})
                        continue
                    if cmd_lower in ("objectives", "status"):
                        objs = room.get("attacker_objectives", {}).get(actor, []) if room else []
                        if not objs:
                            out = "No objectives assigned yet. Use: Request Objectives button."
                        else:
                            done = sum(1 for o in objs if o.get("completed"))
                            total = len(objs)
                            lines = [f"[{ '✓' if o.get('completed') else ' '}] {o['description']} (+{o['points']})" for o in objs]
                            out = f"Objectives ({done}/{total}):\n" + "\n".join(lines)
                        await websocket.send_json({"type": "command_result", "command": command, "output": out})
                        continue
                    if cmd_lower in ("hint", "hints"):
                        hs = objective_hints(lobby_code, actor)
                        if not hs:
                            # Give a friendly note if disabled or exhausted
                            diff = simulation_rooms.get(lobby_code, {}).get("difficulty", "Beginner")
                            rules = DIFFICULTY_SETTINGS.get(diff, DIFFICULTY_SETTINGS["Beginner"])
                            if not rules.get("hints_enabled", False):
                                out = "Hints are disabled for this difficulty."
                            else:
                                out = "No hints available (quota reached or no pending objectives)."
                        else:
                            out = "\n".join([f"- {h['id']}: {h['hint']}" for h in hs])
                        await websocket.send_json({"type": "command_result", "command": command, "output": out})
                        continue
                    if cmd_lower == "score":
                        sc = simulation_rooms[lobby_code]["scores"].get(actor, 0) if room else 0
                        await websocket.send_json({"type": "command_result", "command": command, "output": f"Your score: {sc}"})
                        continue
                # Broadcast attack event to defenders/observers
                event_id = int(time.time()*1000)
                event = {
                    "type": "attack_event",
                    "event": {
                        "id": event_id,
                        "command": command,
                        "sourceIP": "192.168.1.100",
                    }
                }
                room_broadcast(lobby_code, event, roles=["Defender", "Observer"])
                log_and_notify_instructors(lobby_code, "attack", f"{actor} executed: {command}", actor)
                # metrics: attack launched
                try:
                    room = simulation_rooms.get(lobby_code)
                    if room is not None:
                        m = room.setdefault("metrics", {"totalEvents": 0, "attacksLaunched": 0, "detectionsTriggered": 0})
                        m["attacksLaunched"] = int(m.get("attacksLaunched", 0)) + 1
                        m["totalEvents"] = int(m.get("totalEvents", 0)) + 1
                        await push_metrics_to_instructors(lobby_code)
                except Exception:
                    pass

                # Objective completion
                completed = []
                if cmd_role == "attacker":
                    completed = check_objective_completion(lobby_code, actor, command, event_id)
                    if completed:
                        # Send to attacker and broadcast scoreboard update
                        total_score = simulation_rooms[lobby_code]["scores"].get(actor, 0)
                        await websocket.send_json({
                            "type": "objectives_update",
                            "completed": completed,
                            "score": total_score,
                            "remaining": sum(1 for o in simulation_rooms[lobby_code]["attacker_objectives"].get(actor, []) if not o.get("completed"))
                        })
                        room_broadcast(lobby_code, {"type": "score_update", "name": actor, "score": total_score})
                        try:
                            asyncio.create_task(push_score_to_instructors(lobby_code, actor, total_score))
                        except Exception:
                            pass
                        # Notify defenders/observers about a defendable event for each completed objective
                        for obj_id in completed:
                            room_broadcast(lobby_code, {
                                "type": "objective_completed",
                                "attacker": actor,
                                "objective_id": obj_id,
                                "category": objective_id_to_category(obj_id)
                            }, roles=["Defender", "Observer"])

                # Simple command echo + signature detection
                matches = matcher.match(command)
                output = ".\n".join([f"Matched: {m.get('description', m.get('pattern'))}" for m in matches]) or "Command executed."
                await websocket.send_json({"type": "command_result", "command": command, "output": output})

                # Store recent attack context for defenders
                try:
                    threats = [m.get('description', m.get('pattern')) for m in matches]
                    cats = categorize_command(command)
                    room = simulation_rooms.get(lobby_code)
                    if room is not None:
                        room["recent_attack"] = {
                            "by": actor,
                            "categories": cats,
                            "threats": threats,
                            "command": command,
                            "ts": time.time(),
                            "event_id": event_id
                        }
                except Exception:
                    pass

                # Detection event sent to observers/defenders and optional alert to attacker
                detection = {
                    "type": "detection_event",
                    "method": "signature",
                    "detected": len(matches) > 0,
                    "threats": [m.get('description', m.get('pattern')) for m in matches],
                }
                room_broadcast(lobby_code, detection, roles=["Observer"])
                # Defender legacy envelope
                room_broadcast(lobby_code, {"type": "detection_result", "result": {
                    "eventId": int(time.time()*1000),
                    "detected": detection["detected"],
                    "confidence": 0.7 if detection["detected"] else 0.2,
                    "threats": detection["threats"],
                    "method": "signature"
                }}, roles=["Defender"])
                # Defender typed variant
                room_broadcast(lobby_code, {
                    "type": "detection_event",
                    "detected": detection["detected"],
                    "confidence": 0.7 if detection["detected"] else 0.2,
                    "threats": detection["threats"],
                }, roles=["Defender"])
                # metrics: detection event (whether detected or not, we count detection processing)
                try:
                    room = simulation_rooms.get(lobby_code)
                    if room is not None:
                        m = room.setdefault("metrics", {"totalEvents": 0, "attacksLaunched": 0, "detectionsTriggered": 0})
                        m["detectionsTriggered"] = int(m.get("detectionsTriggered", 0)) + 1
                        m["totalEvents"] = int(m.get("totalEvents", 0)) + 1
                        await push_metrics_to_instructors(lobby_code)
                except Exception:
                    pass
                if detection["detected"]:
                    await websocket.send_json({"type": "detection_alert", "message": "Threat signature detected!", "severity": "medium"})

                # Hard mode: show off-objective threats to defenders and penalize irrelevant/typo commands
                try:
                    room = simulation_rooms.get(lobby_code)
                    diff = room.get("difficulty", "Beginner") if room else "Beginner"
                    rules = DIFFICULTY_SETTINGS.get(diff, DIFFICULTY_SETTINGS["Beginner"])
                    if cmd_role == "attacker":
                        # If no objective completed and detections exist -> off-objective threat
                        if not completed and matches and diff == "Hard":
                            room_broadcast(lobby_code, {
                                "type": "off_objective_threat",
                                "attacker": actor,
                                "command": command,
                                "threats": [m.get('description', m.get('pattern')) for m in matches]
                            }, roles=["Defender", "Observer"])
                        # Penalize irrelevant/typo if enabled: no objective completion and no detection
                        if not completed and not matches and rules.get("penalize_irrelevant", False):
                            # Ignore empty/noise commands
                            if command.strip():
                                # Deduct 3 points (floor at 0)
                                cur = room["scores"].get(actor, 0)
                                new_score = max(0, cur - 3)
                                room["scores"][actor] = new_score
                                await websocket.send_json({"type": "command_result", "command": command, "output": f"Irrelevant/typo detected: -3 points. Current score: {new_score}"})
                                room_broadcast(lobby_code, {"type": "score_update", "name": actor, "score": new_score})
                                try:
                                    asyncio.create_task(push_score_to_instructors(lobby_code, actor, new_score))
                                except Exception:
                                    pass
                except Exception:
                    pass

                # Check pass threshold and notify attacker
                try:
                    room = simulation_rooms.get(lobby_code)
                    if room and cmd_role == "attacker":
                        diff = room.get("difficulty", "Beginner")
                        rules = DIFFICULTY_SETTINGS.get(diff, DIFFICULTY_SETTINGS["Beginner"])
                        sc = room["scores"].get(actor, 0)
                        if sc >= rules.get("pass_score", 0):
                            await websocket.send_json({"type": "command_result", "command": command, "output": f"Goal reached! You have {sc} points (pass threshold: {rules.get('pass_score')})."})
                except Exception:
                    pass
                continue

            if msg_type == "request_objectives":
                # Attacker asks to (re)send objectives in case the initial join message was missed
                who = data.get("name") or name
                if not who:
                    await websocket.send_json({"type": "error", "message": "Missing name for objectives request"})
                    continue
                # Ensure room exists and objectives are assigned
                init_room(lobby_code)
                room = simulation_rooms.get(lobby_code)
                if room is None:
                    await websocket.send_json({"type": "error", "message": "Room not found"})
                    continue
                if who not in room.get("attacker_objectives", {}):
                    objs = assign_objectives_for_attacker(lobby_code, who)
                else:
                    objs = room["attacker_objectives"][who]
                await websocket.send_json({"type": "objectives", "objectives": objs})
                continue

            if msg_type == "defender_classify" or msg_type == "defense_classify":
                actor = data.get("name") or name or "Defender"
                classification = (data.get("classification") or data.get("category") or "").lower()
                objective_guess = (data.get("objective") or "").lower()
                confidence = float(data.get("confidence", 0.7))
                confidence = max(0.0, min(1.0, confidence))
                detection_profile = (data.get("detection_profile") or "").lower() or "hybrid"

                room = simulation_rooms.get(lobby_code)
                if room is None:
                    await websocket.send_json({"type": "classification_result", "awarded": 0, "total": 0, "error": "Room not found"})
                    continue

                # Cooldown per defender to prevent spamming
                last_ts = room.setdefault("defender_cooldowns", {}).get(actor, 0)
                now_ts = time.time()
                cooldown_s = 2
                if now_ts - last_ts < cooldown_s:
                    remaining = int(max(1, round(cooldown_s - (now_ts - last_ts))))
                    await websocket.send_json({
                        "type": "classification_result",
                        "awarded": 0,
                        "total": room["scores"].get(actor, 0),
                        "cooldown": remaining,
                        "message": f"Please wait {remaining}s before classifying again"
                    })
                    # Typed variant for migration
                    try:
                        await websocket.send_json({
                            "type": "defense_result",
                            "correct": False,
                            "award": 0,
                            "total": room["scores"].get(actor, 0),
                            "cooldown": True,
                            "message": f"Please wait {remaining}s before classifying again"
                        })
                    except Exception:
                        pass
                    continue

                # Validate against the oldest pending defended objective (FIFO)
                queue = room.get("pending_defenses", [])
                # Remove any already defended items from the head
                while queue and queue[0].get("defended_by"):
                    queue.pop(0)
                if not queue:
                    await websocket.send_json({
                        "type": "classification_result",
                        "awarded": 0,
                        "total": room["scores"].get(actor, 0),
                        "message": "No pending attacks to defend"
                    })
                    # Typed variant for migration
                    try:
                        await websocket.send_json({
                            "type": "defense_result",
                            "correct": False,
                            "award": 0,
                            "total": room["scores"].get(actor, 0),
                            "message": "No pending attacks to defend"
                        })
                    except Exception:
                        pass
                    continue

                # Beginner assistance: try to match any pending item by normalized categories
                diff = room.get("difficulty", "Beginner")
                # If client specifies a target event, pick that pending item
                target_event_id = data.get("attackId") or data.get("event_id")
                pend = None
                if target_event_id is not None:
                    try:
                        tgt = int(target_event_id)
                    except Exception:
                        tgt = target_event_id
                    for item in queue:
                        if item.get("defended_by"):
                            continue
                        if item.get("event_id") == tgt:
                            pend = item
                            break
                if pend is None:
                    pend = queue[0] if queue else None
                expected_cat = (pend.get("category") or "").lower() if pend else ""
                norm_cats = set(normalize_category_text(classification) + normalize_category_text(objective_guess))
                if diff == "Beginner" and queue and norm_cats:
                    best = None
                    for item in queue:
                        cat = (item.get("category") or "").lower()
                        if cat and cat in norm_cats:
                            best = item
                            break
                    if best is not None:
                        pend = best
                        expected_cat = (pend.get("category") or "").lower()
                # Determine correctness by matching the (possibly assisted) pend's category
                correct = bool(expected_cat) and (
                    expected_cat in classification or expected_cat in objective_guess or expected_cat in norm_cats
                )
                base = pend.get("points", 0) if correct else 0

                # Small educational bonus when profile choice aligns with the attack style
                bonus = 0
                if correct:
                    # Map objective categories to likely detection style
                    style_map = {
                        "recon": "signature",
                        "brute": "signature",
                        "priv": "anomaly",
                        "persistence": "anomaly",
                    }
                    expected_style = style_map.get(expected_cat)
                    if detection_profile == "hybrid":
                        bonus = 1  # small consistent bonus for hybrid
                    elif expected_style and detection_profile == expected_style:
                        bonus = 2  # slightly higher when matching style

                # Award exactly the objective's points on correct defense (no extra scaling)
                awarded = int(base)

                # Update cooldown and score
                room["defender_cooldowns"][actor] = now_ts
                # Mark this objective as defended and remove from queue on success to prevent double credit
                if awarded > 0 and pend:
                    pend["defended_by"] = actor
                    # Remove the defended item from queue (not necessarily head in Beginner)
                    try:
                        room["pending_defenses"].remove(pend)
                    except ValueError:
                        # fallback: pop head if still present
                        if room.get("pending_defenses") and room["pending_defenses"][0] is pend:
                            room["pending_defenses"].pop(0)
                    # Notify participants
                    room_broadcast(lobby_code, {
                        "type": "objective_defended",
                        "defender": actor,
                        "attacker": pend.get("attacker"),
                        "objective_id": pend.get("objective_id"),
                        "category": expected_cat
                    }, roles=["Defender", "Observer"])
                simulation_rooms[lobby_code]["scores"][actor] = simulation_rooms[lobby_code]["scores"].get(actor, 0) + awarded + bonus
                # Notify
                total = simulation_rooms[lobby_code]["scores"][actor]
                # Prepare a learner-friendly message
                msg = None
                if awarded > 0:
                    if bonus > 0:
                        # Brief profile alignment hint
                        profile_hint = {
                            "signature": "Your Signature-focused profile fit this kind of attack.",
                            "anomaly": "Your Anomaly-focused profile fit this kind of attack.",
                            "hybrid": "Hybrid profile gives a small, consistent bonus.",
                        }.get(detection_profile, "")
                        msg = f"You earned {awarded} points +{bonus} bonus for correctly classifying a real attack. {profile_hint}".strip()
                    else:
                        msg = f"You earned {awarded} points for correctly classifying a real attack."
                else:
                    msg = "No pending attacks to defend" if not expected_cat else f"Close! Incorrect category — expected: {expected_cat}."
                await websocket.send_json({
                    "type": "classification_result",
                    "awarded": awarded,
                    "bonus": bonus,
                    "total": total,
                    "correct": correct,
                    "confidence_used": confidence,
                    "objective_id": pend.get("objective_id"),
                    "message": msg
                })
                # Typed variant for migration
                try:
                    await websocket.send_json({
                        "type": "defense_result",
                        "correct": bool(correct),
                        "award": int(awarded + bonus),
                        "total": int(total),
                        "message": msg if msg else None
                    })
                except Exception:
                    pass
                room_broadcast(lobby_code, {"type": "defender_action", "action": f"Classified: {classification}", "success": awarded > 0}, roles=["Observer"])
                room_broadcast(lobby_code, {"type": "score_update", "name": actor, "score": total})
                try:
                    asyncio.create_task(push_score_to_instructors(lobby_code, actor, total))
                except Exception:
                    pass
                log_and_notify_instructors(lobby_code, "detection", f"{actor} classified attack ({classification})", actor)
                continue

            if msg_type == "defense_triage":
                # Beginner-friendly flow: simple TP/FP triage without category guessing
                actor = data.get("name") or name or "Defender"
                label = (data.get("label") or "").lower()  # 'tp' or 'fp'
                confidence = float(data.get("confidence", 0.7))
                confidence = max(0.0, min(1.0, confidence))

                room = simulation_rooms.get(lobby_code)
                if room is None:
                    await websocket.send_json({
                        "type": "defense_result",
                        "correct": False,
                        "award": 0,
                        "total": 0,
                        "message": "Room not found"
                    })
                    continue

                # Only award in Beginner difficulty; in others, nudge to use full classification
                diff = room.get("difficulty", "Beginner")

                # Cooldown per defender to prevent spamming
                last_ts = room.setdefault("defender_cooldowns", {}).get(actor, 0)
                now_ts = time.time()
                cooldown_s = 2
                if now_ts - last_ts < cooldown_s:
                    remaining = int(max(1, round(cooldown_s - (now_ts - last_ts))))
                    await websocket.send_json({
                        "type": "defense_result",
                        "correct": False,
                        "award": 0,
                        "total": room["scores"].get(actor, 0),
                        "cooldown": True,
                        "message": f"Please wait {remaining}s before triaging again"
                    })
                    continue

                # Normalize queue: remove defended heads
                queue = room.get("pending_defenses", [])
                while queue and queue[0].get("defended_by"):
                    queue.pop(0)

                # Determine correctness and award
                award = 0
                correct = False
                msg = None
                had_pending = bool(queue)
                if diff == "Beginner":
                    if label == "tp":
                        if had_pending:
                            # Small fixed award for recognizing an attack in Beginner mode
                            pend = queue[0]
                            award = 5
                            correct = True
                            # Mark as defended and pop
                            pend["defended_by"] = actor
                            if room.get("pending_defenses") and room["pending_defenses"][0] is pend:
                                room["pending_defenses"].pop(0)
                            # Notify others about successful defense (no category requirement)
                            room_broadcast(lobby_code, {
                                "type": "objective_defended",
                                "defender": actor,
                                "attacker": pend.get("attacker"),
                                "objective_id": pend.get("objective_id"),
                                "category": pend.get("category")
                            }, roles=["Defender", "Observer"])
                        else:
                            correct = False
                            msg = "No pending attacks to mark as malicious"
                    elif label == "fp":
                        # Consider it correct if nothing is pending; no score change
                        correct = not had_pending
                        if had_pending:
                            msg = "An attack is pending; this is unlikely a false positive"
                    else:
                        msg = "Invalid triage label (use 'tp' or 'fp')"
                else:
                    # Non-Beginner: encourage using full classification
                    msg = "Use full classification in this difficulty"

                # Update cooldown and score
                room["defender_cooldowns"][actor] = now_ts
                if award:
                    room["scores"][actor] = room["scores"].get(actor, 0) + int(award)

                total = room["scores"].get(actor, 0)

                # Friendly learner message if not set yet
                if not msg:
                    if award > 0:
                        msg = "You earned points for recognizing a real attack (True Positive)."
                    elif label == "fp" and not had_pending:
                        msg = "Correct: This looked like a false alarm (False Positive)."
                    elif label == "tp" and not had_pending:
                        msg = "No attacks are pending right now. Try again when you see a new attack event."
                    elif label == "fp" and had_pending:
                        msg = "An attack is actually pending — this is likely not a false positive."

                # Respond with both variants for client compatibility
                await websocket.send_json({
                    "type": "defense_result",
                    "correct": bool(correct),
                    "award": int(award),
                    "total": int(total),
                    "message": msg if msg else None
                })
                try:
                    await websocket.send_json({
                        "type": "classification_result",
                        "awarded": int(award),
                        "total": int(total),
                        "correct": bool(correct),
                        "confidence_used": confidence,
                        "message": msg if msg else None
                    })
                except Exception:
                    pass

                # Broadcast score update and action log
                room_broadcast(lobby_code, {"type": "score_update", "name": actor, "score": total})
                room_broadcast(lobby_code, {"type": "defender_action", "action": f"Triage: {label}", "success": award > 0}, roles=["Observer"])
                try:
                    asyncio.create_task(push_score_to_instructors(lobby_code, actor, total))
                except Exception:
                    pass
                log_and_notify_instructors(lobby_code, "detection", f"{actor} triaged: {label}", actor)
                continue

            if msg_type == "chat_message":
                # Forward participant chat to all roles (Attacker/Defender/Observer)
                sender = data.get("sender") or name or "Participant"
                msg = data.get("message") or ""
                room_broadcast(lobby_code, {"type": "chat_message", "sender": sender, "message": msg})
                # Also forward directly to any connected instructor dashboards
                try:
                    if lobby_code in instructor_simulation_connections:
                        for ws in list(instructor_simulation_connections[lobby_code]):
                            try:
                                await ws.send_json({"type": "chat_message", "sender": sender, "message": msg})
                            except Exception:
                                try:
                                    instructor_simulation_connections[lobby_code] = [w for w in instructor_simulation_connections[lobby_code] if w != ws]
                                except Exception:
                                    pass
                except Exception:
                    pass
                try:
                    # Log for instructor timeline as an info event
                    log_and_notify_instructors(lobby_code, "chat", f"{sender}: {msg}", sender)
                except Exception:
                    pass
                continue

            if msg_type == "update_detection_config" or msg_type == "defense_config":
                actor = data.get("name") or name or "Defender"
                log_and_notify_instructors(lobby_code, "config", f"{actor} updated detection config", actor)
                continue

            if msg_type == "request_hints":
                who = data.get("name") or name
                hs = objective_hints(lobby_code, who) if who else []
                await websocket.send_json({"type": "hints", "hints": hs})
                continue

            if msg_type == "request_scoreboard":
                room = simulation_rooms.get(lobby_code)
                await websocket.send_json({"type": "scoreboard", "scores": (room.get("scores") if room else {})})
                continue

            if msg_type == "simulation_end":
                # Broadcast to all participants
                room_broadcast(lobby_code, {"type": "simulation_end"})
                log_and_notify_instructors(lobby_code, "end", "Simulation ended")
                break

    except WebSocketDisconnect:
        pass
    finally:
        # Cleanup participant
        room = simulation_rooms.get(lobby_code)
        if room and name:
            room["participants"].pop(name, None)
            try:
                await push_participants_to_instructors(lobby_code)
            except Exception:
                pass
            try:
                await push_metrics_to_instructors(lobby_code)
            except Exception:
                pass


class AttackDetector:
    def __init__(self):
        self.known_attackers = set()
        self.attack_history = []
        self.last_processed_position = 0

    def detect_attack(self, log_entry: Dict) -> Dict:
        attack_type = None
        details = {}

        if log_entry.get("eventid") == "cowrie.login.failed":
            attack_type = "ssh" if log_entry.get("protocol") == "ssh" else "telnet"
            details = {
                "username": log_entry.get("username", "unknown"),
                "password": log_entry.get("password", "unknown"),
                "source_ip": log_entry.get("src_ip", "unknown")
            }
        elif log_entry.get("eventid") == "cowrie.command.input":
            attack_type = "command"
            details = {
                "command": log_entry.get("input", ""),
                "source_ip": log_entry.get("src_ip", "unknown")
            }
        elif log_entry.get("eventid") == "cowrie.session.file_download":
            attack_type = "download"
            details = {
                "url": log_entry.get("url", ""),
                "filename": log_entry.get("outfile", ""),
                "source_ip": log_entry.get("src_ip", "unknown")
            }

        if attack_type:
            return {
                "type": ATTACK_TYPES[attack_type],
                "timestamp": log_entry.get("timestamp", ""),
                "details": details,
                "severity": "high" if attack_type in ["download", "command"] else "medium"
            }
        return None

    async def monitor_logs(self):
        while True:
            try:
                if not os.path.exists(COWRIE_LOG_PATH):
                    await asyncio.sleep(1)
                    continue

                with open(COWRIE_LOG_PATH, 'r') as f:
                    f.seek(self.last_processed_position)
                    new_lines = f.readlines()
                    self.last_processed_position = f.tell()

                    for line in new_lines:
                        try:
                            log_entry = json.loads(line.strip())
                            attack = self.detect_attack(log_entry)
                            if attack:
                                self.attack_history.append(attack)
                                if len(self.attack_history) > 100:  # Keep last 100 attacks
                                    self.attack_history.pop(0)
                        except json.JSONDecodeError:
                            continue

            except Exception as e:
                print(f"Error monitoring logs: {str(e)}")

            await asyncio.sleep(1)

detector = AttackDetector()

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(detector.monitor_logs())

@app.get("/")
async def root():
    return {"message": "NIDS To Know API"}

@app.get("/attacks")
async def get_attacks():
    return {
        "attacks": detector.attack_history,
        "total_attacks": len(detector.attack_history)
    }

@app.get("/stats")
async def get_stats():
    attack_types = {}
    for attack in detector.attack_history:
        attack_type = attack["type"]
        attack_types[attack_type] = attack_types.get(attack_type, 0) + 1

    return {
        "total_attacks": len(detector.attack_history),
        "attack_types": attack_types,
        "unique_attackers": len(set(attack["details"]["source_ip"] for attack in detector.attack_history))
    }

@app.post("/api/signature/detect")
async def detect_signature(payload: dict):
    command = payload.get("command", "")
    try:
        logging.info(f"[signature.detect] cmd='{command}'")
    except Exception:
        pass
    
    # Reload signatures and matcher to ensure we have the latest data
    try:
        current_signatures = load_signatures_from_db()
        try:
            logging.info(f"[signature.detect] signatures loaded: {len(current_signatures)}")
        except Exception:
            pass
        current_matcher = SignatureMatcher(current_signatures)
        matches = current_matcher.match(command)
        try:
            logging.info(f"[signature.detect] matches: {len(matches)}")
        except Exception:
            pass
        
        # Format matches for frontend clarity with offsets & origin
        formatted_matches = []
        for m in matches:
            formatted_matches.append({
                "id": m.get("id") or m.get("pattern"),
                "pattern": m.get("pattern"),
                "description": m.get("description"),
                "type": m.get("type"),
                "regex": bool(m.get("regex")),
                "origin": m.get("origin", 'aho' if not m.get('regex') else 'regex'),
                "start": m.get("start"),
                "end": m.get("end"),
                "command": command
            })
        return {"matches": formatted_matches}
    except Exception as e:
        # Log the error and return empty matches
        print(f"Error in signature detection: {e}")
        try:
            logging.error(f"[signature.detect] error: {e}")
        except Exception:
            pass
        return {"matches": [], "error": str(e)}

@app.websocket("/ws/terminal")
async def websocket_terminal(websocket: WebSocket):
    await websocket_terminal_with_pty(websocket)

@app.websocket("/ws/terminal/signature")
async def websocket_signature_terminal(websocket: WebSocket):
    await websocket_cowrie_terminal(websocket, "signature")

@app.websocket("/ws/terminal/anomaly")
async def websocket_anomaly_terminal(websocket: WebSocket):
    await websocket_cowrie_terminal(websocket, "anomaly")

@app.websocket("/ws/terminal/hybrid")
async def websocket_hybrid_terminal(websocket: WebSocket):
    await websocket_cowrie_terminal(websocket, "hybrid")

# Admin CRUD endpoints for signatures
from fastapi import APIRouter
from pydantic import BaseModel

class SignatureIn(BaseModel):
    pattern: str
    description: str
    type: str = None
    regex: bool = False

@app.get("/api/signatures")
def list_signatures():
    try:
        return load_signatures_from_db()
    except Exception as e:
        try:
            logging.error(f"[signatures.list] DB error: {e}")
        except Exception:
            pass
        # Fallback to builtin set to avoid 500 in UI
        return [
            {"id": None, "pattern": "nmap", "description": "Nmap scan detected", "type": "Recon", "regex": False},
            {"id": None, "pattern": r"cat\s+.*\/etc\/passwd", "description": "Sensitive file access", "type": "File Access", "regex": True},
            {"id": None, "pattern": r"cat\s+.*\/etc\/shadow", "description": "Shadow file access", "type": "File Access", "regex": True},
            {"id": None, "pattern": r"wget\s+.*", "description": "Wget download", "type": "Download", "regex": True},
            {"id": None, "pattern": r"curl\s+.*", "description": "Curl download", "type": "Download", "regex": True},
            {"id": None, "pattern": r"chmod\s+\+x\s+.*", "description": "Chmod +x execution", "type": "Execution", "regex": True},
            {"id": None, "pattern": r"rm\s+-rf\s+.*", "description": "Dangerous file removal", "type": "Destruction", "regex": True},
        ]

@app.post("/api/signatures")
def add_signature(sig: SignatureIn):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO signatures (pattern, description, type, regex) VALUES (%s, %s, %s, %s)",
        (sig.pattern, sig.description, sig.type, int(sig.regex))
    )
    conn.commit()
    cursor.close()
    conn.close()
    # Reload global matcher
    global matcher, SIGNATURES
    SIGNATURES = load_signatures_from_db()
    matcher = SignatureMatcher(SIGNATURES)
    return {"message": "Signature added"}

@app.put("/api/signatures/{sig_id}")
def update_signature(sig_id: int, sig: SignatureIn):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE signatures SET pattern=%s, description=%s, type=%s, regex=%s WHERE id=%s",
        (sig.pattern, sig.description, sig.type, int(sig.regex), sig_id)
    )
    conn.commit()
    cursor.close()
    conn.close()
    # Reload global matcher
    global matcher, SIGNATURES
    SIGNATURES = load_signatures_from_db()
    matcher = SignatureMatcher(SIGNATURES)
    return {"message": "Signature updated"}

@app.delete("/api/signatures/{sig_id}")
def delete_signature(sig_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM signatures WHERE id=%s", (sig_id,))
    conn.commit()
    cursor.close()
    conn.close()
    # Reload global matcher
    global matcher, SIGNATURES
    SIGNATURES = load_signatures_from_db()
    matcher = SignatureMatcher(SIGNATURES)
    return {"message": "Signature deleted"}

# ===================== HYBRID PATTERN AGGREGATION (UNIFIED LIST) =====================
class HybridPatternIn(BaseModel):
    source: str  # 'signature' or 'anomaly'
    name: str
    pattern: str
    type: Optional[str] = None
    description: Optional[str] = None
    regex: bool = False
    boost: Optional[float] = None  # required if anomaly
    severity: Optional[str] = 'Medium'
    active: Optional[bool] = True

@app.get("/api/hybrid/patterns")
def list_hybrid_patterns(include_inactive: bool = True):
    """Return a unified list of signature patterns and anomaly feature patterns.

    Normalized entry: {source,id,name,pattern,regex,type,boost?,severity,active?,description}
    """
    try:
        sig_rows = load_signatures_from_db()
        signatures = []
        for r in sig_rows:
            signatures.append({
                "source": "signature",
                "id": r.get("id"),
                "name": r.get("pattern"),
                "pattern": r.get("pattern"),
                "regex": bool(r.get("regex")),
                "type": r.get("type") or "generic",
                "severity": (r.get("severity") or "Medium"),
                "active": True,
                "description": r.get("description")
            })

        anomaly_rows = isolation_forest_db.get_feature_patterns(active_only=not include_inactive)
        anomaly_patterns = []
        for p in anomaly_rows:
            anomaly_patterns.append({
                "source": "anomaly",
                "id": p.get("id"),
                "name": p.get("pattern_name"),
                "pattern": p.get("pattern_regex"),
                "regex": True,
                "type": p.get("feature_type"),
                "boost": float(p.get("boost_value") or 0),
                "severity": p.get("severity") or "Medium",
                "active": bool(p.get("is_active", True)),
                "description": p.get("description")
            })

        combined = signatures + anomaly_patterns
        severity_rank = {"High": 0, "Medium": 1, "Low": 2}
        def sort_key(item):
            return (
                0 if item.get("active", True) else 1,
                0 if item["source"] == "signature" else 1,
                severity_rank.get(item.get("severity"), 3),
                item.get("name") or ""
            )
        combined.sort(key=sort_key)
        return {"success": True, "count": len(combined), "patterns": combined}
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=f"Failed to list hybrid patterns: {e}")

@app.post("/api/hybrid/patterns")
def add_hybrid_pattern(p: HybridPatternIn):
    if p.source not in ("signature", "anomaly"):
        raise HTTPException(status_code=400, detail="source must be 'signature' or 'anomaly'")
    if p.source == "signature":
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO signatures (pattern, description, type, regex) VALUES (%s,%s,%s,%s)",
            (p.pattern, p.description, p.type, int(bool(p.regex)))
        )
        conn.commit()
        new_id = cursor.lastrowid
        cursor.close()
        conn.close()
        global matcher, SIGNATURES
        SIGNATURES = load_signatures_from_db()
        matcher = SignatureMatcher(SIGNATURES)
        return {"success": True, "id": new_id, "source": "signature"}
    else:
        if p.boost is None:
            raise HTTPException(status_code=400, detail="boost required for anomaly pattern")
        new_id = isolation_forest_db.add_feature_pattern(
            p.name, p.pattern, p.type or 'generic', p.boost, p.description, p.severity or 'Medium', bool(p.active)
        )
        if new_id is None:
            raise HTTPException(status_code=500, detail="Failed to insert anomaly feature pattern")
        return {"success": True, "id": new_id, "source": "anomaly"}

# ===================== ISOLATION FOREST API ENDPOINTS =====================

@app.get("/api/isolation-forest/config/{model_name}")
async def get_isolation_forest_config(model_name: str):
    """Get Isolation Forest model configuration from database"""
    config = isolation_forest_db.get_model_config(model_name)
    if config:
        return {"success": True, "config": config}
    else:
        raise HTTPException(status_code=404, detail="Model configuration not found")

@app.get("/api/isolation-forest/patterns")
async def get_isolation_forest_patterns():
    """Get feature patterns for anomaly detection from database"""
    patterns = isolation_forest_db.get_feature_patterns()
    return {"success": True, "patterns": patterns}

@app.get("/api/isolation-forest/training-data")
async def get_isolation_forest_training_data(label: str = None):
    """Get training data for Isolation Forest from database"""
    data = isolation_forest_db.get_training_data(label)
    return {"success": True, "training_data": data}

@app.get("/api/isolation-forest/boost-config/{config_name}")
async def get_isolation_forest_boost_config(config_name: str):
    """Get educational boosting configuration from database"""
    config = isolation_forest_db.get_boost_config(config_name)
    if config:
        return {"success": True, "config": config}
    else:
        raise HTTPException(status_code=404, detail="Boost configuration not found")

@app.post("/api/isolation-forest/training-data")
async def add_isolation_forest_training_sample(payload: dict):
    """Add new training sample to database"""
    command_pattern = payload.get("command_pattern")
    label = payload.get("label")
    features = payload.get("features")
    description = payload.get("description")
    
    if not command_pattern or not label:
        raise HTTPException(status_code=400, detail="command_pattern and label are required")
    
    success = isolation_forest_db.add_training_sample(command_pattern, label, features, description)
    
    if success:
        return {"success": True, "message": "Training sample added successfully"}
    else:
        raise HTTPException(status_code=500, detail="Failed to add training sample")

@app.put("/api/isolation-forest/config/{model_name}")
async def update_isolation_forest_config(model_name: str, payload: dict):
    """Update Isolation Forest model configuration in database"""
    success = isolation_forest_db.update_model_config(model_name, **payload)
    
    if success:
        return {"success": True, "message": "Model configuration updated successfully"}
    else:
        raise HTTPException(status_code=500, detail="Failed to update model configuration")

@app.get("/api/isolation-forest/statistics")
async def get_isolation_forest_statistics():
    """Get Isolation Forest database statistics"""
    stats = isolation_forest_db.get_statistics()
    return {"success": True, "statistics": stats}

@app.post("/api/isolation-forest/detect")
async def detect_isolation_forest_anomaly(payload: dict):
    """Detect anomalies using database-stored patterns and configuration"""
    command = payload.get("command", "")
    
    if not command:
        raise HTTPException(status_code=400, detail="Command is required")
    
    try:
        # Get patterns and boost config from database
        patterns = isolation_forest_db.get_feature_patterns()
        boost_config = isolation_forest_db.get_boost_config("hybrid_conservative")
        
        # Simple pattern-based anomaly detection using database patterns
        anomaly_score = 0.3  # Base score
        detected_patterns = []
        
        for pattern in patterns:
            import re
            if re.search(pattern['pattern_regex'], command, re.IGNORECASE):
                anomaly_score += float(pattern['boost_value'])
                detected_patterns.append({
                    'name': pattern['pattern_name'],
                    'type': pattern['feature_type'],
                    'boost': pattern['boost_value'],
                    'severity': pattern['severity']
                })
        
        # Apply boost config limits
        if boost_config:
            max_cap = float(boost_config['max_score_cap'])
            anomaly_score = min(anomaly_score, max_cap)
        
        # Determine if it's an anomaly
        is_anomaly = anomaly_score > 0.6
        
        return {
            "success": True,
            "anomaly_detected": is_anomaly,
            "anomaly_score": round(anomaly_score, 3),
            "detected_patterns": detected_patterns,
            "command": command
        }
        
    except Exception as e:
        print(f"Error in anomaly detection: {e}")
        raise HTTPException(status_code=500, detail="Anomaly detection failed")

# ===================== END ISOLATION FOREST API =====================

# ===================== INSTRUCTOR SIMULATION WEBSOCKET =====================

# Store active instructor simulation connections
instructor_simulation_connections: Dict[str, List[WebSocket]] = {}
simulation_logs: Dict[str, List[Dict]] = {}

@app.websocket("/instructor/simulation/{lobby_code}")
async def instructor_simulation_websocket(websocket: WebSocket, lobby_code: str):
    # Enforce JWT similar to lobby_ws
    try:
        auth = websocket.headers.get('authorization') or websocket.headers.get('Authorization')
        token = None
        if auth and auth.lower().startswith('bearer '):
            token = auth.split(' ', 1)[1]
        if not token:
            token = websocket.query_params.get('token')
        if not token:
            await websocket.close(code=4401)
            return
        decode_token(token)
    except Exception:
        await websocket.close(code=4403)
        return
    await websocket.accept()
    
    # Add instructor to the simulation connections
    if lobby_code not in instructor_simulation_connections:
        instructor_simulation_connections[lobby_code] = []
        simulation_logs[lobby_code] = []
    
    instructor_simulation_connections[lobby_code].append(websocket)
    
    try:
        # Send initial simulation state
        await websocket.send_json({
            "type": "simulation_state",
            "data": {
                "status": "running",
                "events": simulation_logs.get(lobby_code, []),
                "participants": []  # Could be populated from lobby data
            }
        })
        
        while True:
            # Listen for instructor commands
            data = await websocket.receive_json()
            # Support both legacy {action: '...'} and typed {type: 'instructor_control', action: 'pause'|'resume'|'end'}
            msg_type = (data.get("type") or "").lower()
            action = data.get("action")
            
            if action == "pause_simulation" or (msg_type == "instructor_control" and action == "pause"):
                # Broadcast pause to all participants
                await broadcast_to_simulation_participants(lobby_code, {
                    "type": "simulation_paused",
                    "message": "Simulation paused by instructor"
                })
                
            elif action == "resume_simulation" or (msg_type == "instructor_control" and action == "resume"):
                # Broadcast resume to all participants
                await broadcast_to_simulation_participants(lobby_code, {
                    "type": "simulation_resumed", 
                    "message": "Simulation resumed by instructor"
                })
                
            elif action == "end_simulation" or (msg_type == "instructor_control" and action == "end"):
                # Broadcast end to all participants
                await broadcast_to_simulation_participants(lobby_code, {
                    "type": "simulation_ended",
                    "message": "Simulation ended by instructor"
                })
                break
                
            elif action == "broadcast" or msg_type == "broadcast":
                # Broadcast message to all participants
                message = data.get("payload", {}).get("message", "") if "payload" in data else data.get("message", "")
                await broadcast_to_simulation_participants(lobby_code, {
                    "type": "instructor_broadcast",
                    "message": message
                })
                
            elif action == "chat" or msg_type == "chat_message":
                # Handle instructor chat messages
                payload = data.get("payload", {})
                chat_message = {
                    "type": "chat_message",
                    "sender": payload.get("sender") or data.get("sender", "Instructor"),
                    "message": payload.get("message") or data.get("message", "")
                }
                await broadcast_to_simulation_participants(lobby_code, chat_message)
            elif action == "set_difficulty":
                # Update room difficulty and notify participants
                diff = data.get("payload", {}).get("difficulty", "Beginner")
                init_room(lobby_code)
                simulation_rooms[lobby_code]["difficulty"] = diff
                await broadcast_to_simulation_participants(lobby_code, {
                    "type": "difficulty_updated",
                    "difficulty": diff
                })
                
    except WebSocketDisconnect:
        pass
    finally:
        # Remove instructor from connections
        if lobby_code in instructor_simulation_connections:
            instructor_simulation_connections[lobby_code] = [
                ws for ws in instructor_simulation_connections[lobby_code] if ws != websocket
            ]
            if not instructor_simulation_connections[lobby_code]:
                del instructor_simulation_connections[lobby_code]

async def broadcast_to_simulation_participants(lobby_code: str, message: dict):
    """Broadcast a message to all participants in a simulation"""
    # Log event for instructor timeline (skip chat messages, they go to Communication panel only)
    if (message.get("type") or "").lower() != "chat_message":
        if lobby_code not in simulation_logs:
            simulation_logs[lobby_code] = []
        simulation_logs[lobby_code].append({
            "timestamp": datetime.now().isoformat(),
            "type": message.get("type"),
            "data": message
        })

    # Forward to student participants via room broadcast
    try:
        msg_type = (message.get("type") or "").lower()
        # Default: send to all roles unless filtered later
        target_roles = ["Attacker", "Defender", "Observer"]
        # Known instructor-originated types we forward
        if msg_type in {"simulation_paused", "simulation_resumed", "simulation_ended", "instructor_broadcast", "broadcast", "chat_message", "difficulty_updated"}:
            room_broadcast(lobby_code, message, roles=target_roles)
            # Also publish a session_state convenience event for clients
            try:
                if msg_type == "simulation_paused":
                    room_broadcast(lobby_code, {"type": "session_state", "status": "paused"}, roles=target_roles)
                elif msg_type == "simulation_resumed":
                    room_broadcast(lobby_code, {"type": "session_state", "status": "running"}, roles=target_roles)
                elif msg_type == "simulation_ended":
                    room_broadcast(lobby_code, {"type": "session_state", "status": "ended"}, roles=target_roles)
            except Exception:
                pass
            # Compatibility: also emit legacy variant when ending
            if msg_type == "simulation_ended":
                room_broadcast(lobby_code, {"type": "simulation_end"}, roles=target_roles)
        else:
            # Fallback: forward as-is
            room_broadcast(lobby_code, message, roles=None)

        # Metrics tracking for instructor dashboard (avoid double-counting; and don't count chat as events)
        try:
            room = simulation_rooms.get(lobby_code)
            if room is not None:
                metrics = room.setdefault("metrics", {"totalEvents": 0, "attacksLaunched": 0, "detectionsTriggered": 0})
                if msg_type in {"broadcast", "instructor_broadcast", "simulation_event"}:
                    metrics["totalEvents"] = int(metrics.get("totalEvents", 0)) + 1
        except Exception:
            pass
    except Exception as _e:
        # Non-fatal; still notify instructors below
        pass

    # Also send a summary event to any connected instructors (skip chat, only send metrics update)
    if lobby_code in instructor_simulation_connections:
        # Also push a metrics snapshot
        room = simulation_rooms.get(lobby_code, {})
        metrics = (room or {}).get("metrics") or {"totalEvents": 0, "attacksLaunched": 0, "detectionsTriggered": 0}
        for ws in list(instructor_simulation_connections[lobby_code]):
            try:
                # Only push simulation_event for non-chat messages
                if (message.get("type") or "").lower() != "chat_message":
                    await ws.send_json({
                        "type": "simulation_event",
                        "eventType": message.get("type", "info"),
                        "description": message.get("message", ""),
                        "participantName": message.get("sender")
                    })
                await ws.send_json({
                    "type": "simulation_metrics",
                    "metrics": metrics
                })
            except:
                # Remove disconnected websockets
                instructor_simulation_connections[lobby_code] = [
                    w for w in instructor_simulation_connections[lobby_code] if w != ws
                ]

# Function to log simulation events (can be called from other parts of the system)
async def log_simulation_event(lobby_code: str, event_type: str, description: str, participant_name: str = None):
    """Log a simulation event and notify instructors"""
    event = {
        "type": "simulation_event",
        "eventType": event_type,
        "description": description,
        "participantName": participant_name
    }
    
    if lobby_code not in simulation_logs:
        simulation_logs[lobby_code] = []
    
    simulation_logs[lobby_code].append({
        "timestamp": datetime.now().isoformat(),
        "type": event_type,
        "description": description,
        "participant": participant_name
    })
    
    # Notify instructors
    if lobby_code in instructor_simulation_connections:
        for ws in instructor_simulation_connections[lobby_code]:
            try:
                await ws.send_json(event)
            except:
                # Remove disconnected websockets
                instructor_simulation_connections[lobby_code] = [
                    w for w in instructor_simulation_connections[lobby_code] if w != ws
                ]

# ===================== END INSTRUCTOR SIMULATION =====================

# ===================== DEV SIMULATOR (GATED) =====================

@app.post("/api/dev/sim-event")
async def dev_sim_event(payload: dict = Body(...)):
    """Inject mock events into a lobby for rapid UI testing.

    Gated by env DEV_SIMULATOR_ENABLED=true. Not for production use.

    JSON body:
      { lobby: string, kind: 'attack'|'detection'|'defense_result'|'objectives'|'score'|'off_threat'|'chat'|'broadcast', ... }
    """
    if not DEV_SIMULATOR_ENABLED:
        raise HTTPException(status_code=403, detail="Dev simulator disabled")

    lobby = payload.get("lobby") or payload.get("lobby_code")
    if not lobby:
        raise HTTPException(status_code=400, detail="Missing 'lobby'")
    init_room(lobby)

    kind = payload.get("kind")
    if kind not in {"attack", "detection", "defense_result", "objectives", "score", "off_threat", "chat", "broadcast"}:
        raise HTTPException(status_code=400, detail="Invalid kind")

    # Build and dispatch according to kind
    if kind == "attack":
        cmd = payload.get("command", "nmap -A 10.0.0.5")
        evt = {"type": "attack_event", "event": {"id": int(time.time()*1000), "command": cmd, "sourceIP": "10.0.0.2"}}
        room_broadcast(lobby, evt, roles=["Defender", "Observer"])
        await log_simulation_event(lobby, "attack", f"(dev) executed: {cmd}")
        return {"success": True, "sent": evt}

    if kind == "detection":
        detected = bool(payload.get("detected", True))
        conf = float(payload.get("confidence", 0.8))
        threats = payload.get("threats", ["SSH Brute Force"]) or []
        # Observer
        room_broadcast(lobby, {"type": "detection_event", "method": "signature", "detected": detected, "threats": threats}, roles=["Observer"])
        # Defender legacy + typed
        room_broadcast(lobby, {"type": "detection_result", "result": {"eventId": int(time.time()*1000), "detected": detected, "confidence": conf, "threats": threats, "method": "signature"}}, roles=["Defender"])
        room_broadcast(lobby, {"type": "detection_event", "detected": detected, "confidence": conf, "threats": threats}, roles=["Defender"])
        await log_simulation_event(lobby, "detection", f"(dev) detection: {detected}")
        return {"success": True}

    if kind == "defense_result":
        correct = bool(payload.get("correct", True))
        award = int(payload.get("award", 10))
        total = int(payload.get("total", 20))
        msg = payload.get("message")
        # Simulate send to a specific defender if provided
        target = payload.get("defender")
        room = simulation_rooms.get(lobby)
        if room and target and target in room.get("participants", {}):
            try:
                ws = room["participants"][target]["ws"]
                await ws.send_json({"type": "defense_result", "correct": correct, "award": award, "total": total, "message": msg})
            except Exception:
                pass
        else:
            room_broadcast(lobby, {"type": "defense_result", "correct": correct, "award": award, "total": total, "message": msg}, roles=["Defender"])
        return {"success": True}

    if kind == "objectives":
        who = payload.get("attacker", "Attacker")
        objs = payload.get("objectives") or [
            {"id": "recon_scan", "description": "Perform reconnaissance scan", "points": 10, "completed": False}
        ]
        # Send to specific attacker if connected else broadcast to attackers
        room = simulation_rooms.get(lobby)
        sent = False
        if room and who in room.get("participants", {}):
            try:
                await room["participants"][who]["ws"].send_json({"type": "objectives", "objectives": objs})
                sent = True
            except Exception:
                pass
        if not sent:
            room_broadcast(lobby, {"type": "objectives", "objectives": objs}, roles=["Attacker"])
        return {"success": True}

    if kind == "score":
        name = payload.get("name", "Alice")
        score = int(payload.get("score", 10))
        simulation_rooms[lobby]["scores"][name] = score
        room_broadcast(lobby, {"type": "score_update", "name": name, "score": score})
        return {"success": True}

    if kind == "off_threat":
        att = payload.get("attacker", "Alice")
        cmd = payload.get("command", "curl http://malware")
        threats = payload.get("threats", ["Malware Download"]) or []
        room_broadcast(lobby, {"type": "off_objective_threat", "attacker": att, "command": cmd, "threats": threats}, roles=["Defender", "Observer"])
        return {"success": True}

    if kind == "chat":
        msg = payload.get("message", "Hello")
        sender = payload.get("sender", "Instructor")
        room_broadcast(lobby, {"type": "chat_message", "sender": sender, "message": msg})
        try:
            room = simulation_rooms.get(lobby)
            if room is not None:
                m = room.setdefault("metrics", {"totalEvents": 0, "attacksLaunched": 0, "detectionsTriggered": 0})
                m["totalEvents"] = int(m.get("totalEvents", 0)) + 1
                await push_metrics_to_instructors(lobby)
        except Exception:
            pass
        return {"success": True}

    if kind == "broadcast":
        msg = payload.get("message", "Remember to collaborate!")
        await broadcast_to_simulation_participants(lobby, {"type": "instructor_broadcast", "message": msg})
        try:
            room = simulation_rooms.get(lobby)
            if room is not None:
                m = room.setdefault("metrics", {"totalEvents": 0, "attacksLaunched": 0, "detectionsTriggered": 0})
                m["totalEvents"] = int(m.get("totalEvents", 0)) + 1
                await push_metrics_to_instructors(lobby)
        except Exception:
            pass
        return {"success": True}

    return {"success": False, "error": "Unhandled kind"}
