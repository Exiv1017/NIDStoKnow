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
app.include_router(lobby_ws_router, prefix="/api")

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

# Configuration
COWRIE_LOG_PATH = os.getenv("COWRIE_LOG_PATH", "/cowrie_logs/cowrie.json")
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

def load_signatures_from_db():
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT id, pattern, description, type, regex FROM signatures")
    sigs = cursor.fetchall()
    cursor.close()
    conn.close()
    # Convert regex from int/bool to Python bool
    for s in sigs:
        s['regex'] = bool(s['regex'])
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

def check_objective_completion(lobby_code: str, attacker_name: str, command: str):
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
                    "ts": time.time()
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

from auth import decode_token

@app.websocket("/simulation/{lobby_code}")
async def simulation_websocket(websocket: WebSocket, lobby_code: str):
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
    init_room(lobby_code)
    name = None
    role = None
    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type") or data.get("action")

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
                if role.lower() == "attacker":
                    objs = assign_objectives_for_attacker(lobby_code, name)
                    await websocket.send_json({"type": "objectives", "objectives": objs})
                # notify observers of participant join
                room_broadcast(lobby_code, {"type": "participant_joined", "name": name, "role": role}, roles=["Observer"])
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

            if msg_type == "execute_command":
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

                # Objective completion
                completed = []
                if cmd_role == "attacker":
                    completed = check_objective_completion(lobby_code, actor, command)
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
                room_broadcast(lobby_code, {"type": "detection_result", "result": {
                    "eventId": int(time.time()*1000),
                    "detected": detection["detected"],
                    "confidence": 0.7 if detection["detected"] else 0.2,
                    "threats": detection["threats"],
                    "method": "signature"
                }}, roles=["Defender"])
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

            if msg_type == "defender_classify":
                actor = data.get("name") or name or "Defender"
                classification = (data.get("classification") or "").lower()
                objective_guess = (data.get("objective") or "").lower()
                confidence = float(data.get("confidence", 0.7))
                confidence = max(0.0, min(1.0, confidence))

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
                    continue

                pend = queue[0]
                expected_cat = (pend.get("category") or "").lower()
                # Determine correctness strictly by matching the objective's category
                correct = (expected_cat and (expected_cat in classification or expected_cat in objective_guess))
                base = pend.get("points", 0) if correct else 0

                # Award exactly the objective's points on correct defense (no extra scaling)
                awarded = int(base)

                # Update cooldown and score
                room["defender_cooldowns"][actor] = now_ts
                # Mark this objective as defended and remove from queue on success to prevent double credit
                if awarded > 0:
                    pend["defended_by"] = actor
                    # Remove the head safely if it still matches
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
                simulation_rooms[lobby_code]["scores"][actor] = simulation_rooms[lobby_code]["scores"].get(actor, 0) + awarded
                # Notify
                total = simulation_rooms[lobby_code]["scores"][actor]
                # Prepare a helpful message when not awarded
                msg = None
                if awarded == 0:
                    msg = "No pending attacks to defend" if not expected_cat else f"Incorrect category, expected: {expected_cat}"
                await websocket.send_json({
                    "type": "classification_result",
                    "awarded": awarded,
                    "total": total,
                    "correct": correct,
                    "confidence_used": confidence,
                    "objective_id": pend.get("objective_id"),
                    "message": msg
                })
                room_broadcast(lobby_code, {"type": "defender_action", "action": f"Classified: {classification}", "success": awarded > 0}, roles=["Observer"])
                room_broadcast(lobby_code, {"type": "score_update", "name": actor, "score": total})
                log_and_notify_instructors(lobby_code, "detection", f"{actor} classified attack ({classification})", actor)
                continue

            if msg_type == "update_detection_config":
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
    
    # Reload signatures and matcher to ensure we have the latest data
    try:
        current_signatures = load_signatures_from_db()
        current_matcher = SignatureMatcher(current_signatures)
        matches = current_matcher.match(command)
        
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
    return load_signatures_from_db()

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
            action = data.get("action")
            
            if action == "pause_simulation":
                # Broadcast pause to all participants
                await broadcast_to_simulation_participants(lobby_code, {
                    "type": "simulation_paused",
                    "message": "Simulation paused by instructor"
                })
                
            elif action == "resume_simulation":
                # Broadcast resume to all participants
                await broadcast_to_simulation_participants(lobby_code, {
                    "type": "simulation_resumed", 
                    "message": "Simulation resumed by instructor"
                })
                
            elif action == "end_simulation":
                # Broadcast end to all participants
                await broadcast_to_simulation_participants(lobby_code, {
                    "type": "simulation_ended",
                    "message": "Simulation ended by instructor"
                })
                break
                
            elif action == "broadcast":
                # Broadcast message to all participants
                message = data.get("payload", {}).get("message", "")
                await broadcast_to_simulation_participants(lobby_code, {
                    "type": "instructor_broadcast",
                    "message": message
                })
                
            elif action == "chat":
                # Handle instructor chat messages
                payload = data.get("payload", {})
                chat_message = {
                    "type": "chat_message",
                    "sender": payload.get("sender", "Instructor"),
                    "message": payload.get("message", "")
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
    # This would connect to the student simulation connections
    # For now, we'll just log it
    if lobby_code not in simulation_logs:
        simulation_logs[lobby_code] = []
    
    simulation_logs[lobby_code].append({
        "timestamp": datetime.now().isoformat(),
        "type": message.get("type"),
        "data": message
    })
    
    # Also send to any connected instructors
    if lobby_code in instructor_simulation_connections:
        for ws in instructor_simulation_connections[lobby_code]:
            try:
                await ws.send_json({
                    "type": "simulation_event",
                    "eventType": message.get("type", "info"),
                    "description": message.get("message", ""),
                    "participantName": message.get("sender")
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
