from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, List
import asyncio
import logging
from auth import decode_token
from config import get_db_connection

router = APIRouter()

# In-memory lobby state (for demo; use Redis/db for production)
lobbies: Dict[str, Dict] = {}
lobby_connections: Dict[str, List[WebSocket]] = {}


def ensure_tables():
    """Create minimal persistence so lobbies work across devices/instances."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS lobbies (
              code VARCHAR(32) PRIMARY KEY,
              difficulty VARCHAR(32) DEFAULT 'Beginner',
              created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
              created_by INT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """
        )
        # Backfill column on existing deployments (ignore if already present)
        try:
            cur.execute("ALTER TABLE lobbies ADD COLUMN created_by INT NULL")
        except Exception:
            pass
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS lobby_participants (
              id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
              code VARCHAR(32) NOT NULL,
              name VARCHAR(255) NOT NULL,
              role VARCHAR(32) NOT NULL,
              ready TINYINT(1) DEFAULT 0,
              joined_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
              UNIQUE KEY uniq_code_name (code, name),
              KEY idx_code (code)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """
        )
        conn.commit()
        cur.close(); conn.close()
    except Exception as e:
        try:
            logging.error(f"[lobby_ws] ensure_tables error: {e}")
        except Exception:
            pass


def hydrate_lobby_from_db(lobby_code: str) -> bool:
    """Load a lobby definition and participants from DB into memory if present."""
    try:
        conn = get_db_connection(); cur = conn.cursor(dictionary=True)
        cur.execute("SELECT code, difficulty, created_by FROM lobbies WHERE code=%s", (lobby_code,))
        row = cur.fetchone()
        if not row:
            cur.close(); conn.close(); return False
        # Create in-memory lobby
        lobbies[lobby_code] = {"participants": [], "chat": [], "difficulty": row.get("difficulty") or "Beginner", "created_by": row.get("created_by")}
        cur.execute("SELECT name, role, ready FROM lobby_participants WHERE code=%s ORDER BY joined_at ASC", (lobby_code,))
        for p in cur.fetchall() or []:
            lobbies[lobby_code]["participants"].append({"name": p["name"], "role": p["role"], "ready": bool(p["ready"])})
        cur.close(); conn.close(); return True
    except Exception as e:
        try:
            logging.error(f"[lobby_ws] hydrate error for {lobby_code}: {e}")
        except Exception:
            pass
        return False

@router.websocket("/ws/lobby/{lobby_code}")
async def lobby_websocket(websocket: WebSocket, lobby_code: str):
    # Debug: log connection attempt
    try:
        logging.info(f"[lobby_ws] WS connect attempt: code={lobby_code} headers={dict(websocket.headers)} query={dict(websocket.query_params)}")
    except Exception:
        pass
    # Enforce token from headers or query params
    try:
        auth = websocket.headers.get('authorization') or websocket.headers.get('Authorization')
        token = None
        if auth and auth.lower().startswith('bearer '):
            token = auth.split(' ', 1)[1]
        if not token:
            # allow token via query param `token` as fallback
            token = websocket.query_params.get('token')
        if not token:
            try:
                logging.warning(f"[lobby_ws] WS denied: missing token for code={lobby_code}")
            except Exception:
                pass
            await websocket.close(code=4401)
            return
        payload = decode_token(token)
        # Optionally check role here depending on route usage
    except Exception as e:
        try:
            logging.error(f"[lobby_ws] WS denied: token decode error for code={lobby_code}: {e}")
        except Exception:
            pass
        await websocket.close(code=4403)
        return
    await websocket.accept()
    # Only allow joining if lobby exists (created by instructor). If not in memory, try DB.
    if lobby_code not in lobbies:
        ensure_tables()
        hydrated = hydrate_lobby_from_db(lobby_code)
        if not hydrated:
            try:
                logging.warning(f"[lobby_ws] WS denied: lobby code not found: {lobby_code}")
            except Exception:
                pass
            await websocket.send_json({"type": "error", "message": "Invalid lobby code. Please check with your instructor."})
            await websocket.close()
            return
    if lobby_code not in lobby_connections:
        lobby_connections[lobby_code] = []
    lobby_connections[lobby_code].append(websocket)
    lobby = lobbies[lobby_code]
    
    try:
        while True:
            data = await websocket.receive_json()
            action = data.get("action")
            payload = data.get("payload", {})
            
            if action == "join":
                participant = {"name": payload["name"], "role": payload["role"], "ready": False}
                # Prevent duplicate participants
                if not any(p["name"] == payload["name"] for p in lobby["participants"]):
                    lobby["participants"].append(participant)
                    # Persist participant join
                    try:
                        ensure_tables()
                        conn = get_db_connection(); cur = conn.cursor()
                        cur.execute("INSERT INTO lobby_participants (code, name, role, ready) VALUES (%s,%s,%s,%s) ON DUPLICATE KEY UPDATE role=VALUES(role), ready=VALUES(ready)", (lobby_code, payload["name"], payload["role"], 0))
                        conn.commit(); cur.close(); conn.close()
                    except Exception as e:
                        try: logging.error(f"[lobby_ws] persist join failed: {e}")
                        except Exception: pass
                
                # Send join success to the joining participant
                is_instructor = payload["role"] == "Instructor"
                await websocket.send_json({
                    "type": "join_success",
                    "participants": lobby["participants"],
                    "isInstructor": is_instructor,
                    "difficulty": lobby.get("difficulty", "Beginner")
                })
                
                # Broadcast participant update to all others
                await broadcast_participant_update(lobby_code, websocket)
                
            elif action == "leave":
                lobby["participants"] = [p for p in lobby["participants"] if p["name"] != payload["name"]]
                try:
                    conn = get_db_connection(); cur = conn.cursor()
                    cur.execute("DELETE FROM lobby_participants WHERE code=%s AND name=%s", (lobby_code, payload["name"]))
                    conn.commit(); cur.close(); conn.close()
                except Exception: pass
                await broadcast_participant_update(lobby_code)
                
            elif action == "ready":
                for p in lobby["participants"]:
                    if p["name"] == payload["name"]:
                        p["ready"] = payload["ready"]
                try:
                    conn = get_db_connection(); cur = conn.cursor()
                    cur.execute("UPDATE lobby_participants SET ready=%s WHERE code=%s AND name=%s", (1 if payload.get("ready") else 0, lobby_code, payload["name"]))
                    conn.commit(); cur.close(); conn.close()
                except Exception: pass
                await broadcast_participant_update(lobby_code)
                
            elif action == "role":
                for p in lobby["participants"]:
                    if p["name"] == payload["name"]:
                        p["role"] = payload["role"]
                try:
                    conn = get_db_connection(); cur = conn.cursor()
                    cur.execute("UPDATE lobby_participants SET role=%s WHERE code=%s AND name=%s", (payload.get("role"), lobby_code, payload["name"]))
                    conn.commit(); cur.close(); conn.close()
                except Exception: pass
                await broadcast_participant_update(lobby_code)
                
            elif action == "chat":
                msg = {"sender": payload["sender"], "message": payload["message"]}
                lobby["chat"].append(msg)
                # Broadcast chat message to all participants
                await broadcast_chat_message(lobby_code, payload["sender"], payload["message"])
                
            elif action == "reset":
                lobby["participants"] = [p for p in lobby["participants"] if p["role"] == "Instructor"]
                lobby["chat"] = []
                try:
                    conn = get_db_connection(); cur = conn.cursor()
                    cur.execute("DELETE FROM lobby_participants WHERE code=%s AND role<> 'Instructor'", (lobby_code,))
                    conn.commit(); cur.close(); conn.close()
                except Exception: pass
                await broadcast_participant_update(lobby_code)
                
            elif action == "remove":
                lobby["participants"] = [p for p in lobby["participants"] if p["name"] != payload["name"]]
                await broadcast_participant_update(lobby_code)
                
            elif action == "start_simulation":
                # Broadcast simulation start to all participants
                await broadcast_simulation_start(lobby_code)

            elif action == "set_difficulty":
                # Update lobby difficulty and broadcast to participants (pre-simulation)
                diff = payload.get("difficulty") or "Beginner"
                lobby["difficulty"] = diff
                await broadcast_difficulty(lobby_code, diff)
                
    except WebSocketDisconnect:
        if lobby_code in lobby_connections:
            lobby_connections[lobby_code] = [ws for ws in lobby_connections[lobby_code] if ws != websocket]
        # Optionally, remove participant by name if you track mapping
        # await broadcast_participant_update(lobby_code)
        pass

async def broadcast_participant_update(lobby_code: str, exclude_ws: WebSocket = None):
    """Broadcast participant list update to all connections except the excluded one"""
    lobby = lobbies.get(lobby_code, {"participants": [], "chat": []})
    data = {
        "type": "participant_update",
        "participants": lobby["participants"]
    }
    for ws in list(lobby_connections.get(lobby_code, [])):
        if ws != exclude_ws:
            try:
                await ws.send_json(data)
            except Exception:
                # Remove dead connections
                lobby_connections[lobby_code].remove(ws)

async def broadcast_chat_message(lobby_code: str, sender: str, message: str):
    """Broadcast chat message to all connections"""
    data = {
        "type": "chat_message",
        "sender": sender,
        "message": message
    }
    for ws in list(lobby_connections.get(lobby_code, [])):
        try:
            await ws.send_json(data)
        except Exception:
            # Remove dead connections
            lobby_connections[lobby_code].remove(ws)

async def broadcast_simulation_start(lobby_code: str):
    """Broadcast simulation start to all connections"""
    data = {
        "type": "simulation_started"
    }
    for ws in list(lobby_connections.get(lobby_code, [])):
        try:
            await ws.send_json(data)
        except Exception:
            # Remove dead connections
            lobby_connections[lobby_code].remove(ws)

async def broadcast_difficulty(lobby_code: str, difficulty: str):
    """Broadcast difficulty change to all lobby connections"""
    data = {"type": "difficulty_updated", "difficulty": difficulty}
    for ws in list(lobby_connections.get(lobby_code, [])):
        try:
            await ws.send_json(data)
        except Exception:
            try:
                lobby_connections[lobby_code].remove(ws)
            except Exception:
                pass

async def broadcast_lobby(lobby_code: str):
    """Legacy function - keeping for compatibility"""
    await broadcast_participant_update(lobby_code)

def create_lobby(lobby_code: str, created_by: int | None = None):
    if lobby_code not in lobbies:
        lobbies[lobby_code] = {"participants": [], "chat": [], "difficulty": "Beginner", "created_by": created_by}
        # Persist lobby row so other instances/devices recognize it
        try:
            ensure_tables()
            conn = get_db_connection(); cur = conn.cursor()
            if created_by is not None:
                cur.execute("INSERT INTO lobbies (code, difficulty, created_by) VALUES (%s,%s,%s) ON DUPLICATE KEY UPDATE difficulty=VALUES(difficulty), created_by=VALUES(created_by)", (lobby_code, "Beginner", int(created_by)))
            else:
                cur.execute("INSERT IGNORE INTO lobbies (code, difficulty) VALUES (%s,%s)", (lobby_code, "Beginner"))
            conn.commit(); cur.close(); conn.close()
        except Exception as e:
            try: logging.error(f"[lobby_ws] persist lobby failed: {e}")
            except Exception: pass
        # Also ensure a corresponding row exists in simulation_rooms so websocket /simulation/ can find it
        try:
            conn = get_db_connection(); cur = conn.cursor()
            # Create simulation_rooms table if missing (defensive)
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
            # Insert a minimal simulation_rooms row so the simulation websocket recognizes this lobby code
            instr = int(created_by) if created_by is not None else 0
            name = f"Lobby {lobby_code}"
            try:
                cur.execute("INSERT IGNORE INTO simulation_rooms (instructor_id, name, code) VALUES (%s,%s,%s)", (instr, name, lobby_code))
                conn.commit()
            except Exception:
                pass
            cur.close(); conn.close()
        except Exception:
            pass

from fastapi import Request, HTTPException
from auth import require_role
from admin_api import log_admin_action

@router.post("/create_lobby/{lobby_code}")
async def api_create_lobby(lobby_code: str, request: Request):
    # Require instructor token; extract id for created_by
    try:
        payload = require_role(request, 'instructor')
        instructor_id = int(payload.get('sub')) if payload and payload.get('sub') else None
    except Exception:
        raise HTTPException(status_code=401, detail="Unauthorized")
    if lobby_code not in lobbies:
        create_lobby(lobby_code, created_by=instructor_id)
    else:
        # Ensure persistence row has creator set
        try:
            ensure_tables()
            conn = get_db_connection(); cur = conn.cursor()
            cur.execute("UPDATE lobbies SET created_by=%s WHERE code=%s AND (created_by IS NULL OR created_by<>%s)", (instructor_id, lobby_code, instructor_id))
            conn.commit(); cur.close(); conn.close()
        except Exception:
            pass
    return {"success": True, "code": lobby_code, "created_by": instructor_id}

@router.post("/admin/lobbies/{lobby_code}/close")
async def admin_close_lobby(lobby_code: str, request: Request):
    # Only admin can force-close a lobby
    payload = require_role(request, 'admin')
    # Best-effort notify and close all connections
    if lobby_code in lobby_connections:
        for ws in list(lobby_connections[lobby_code]):
            try:
                await ws.send_json({"type": "lobby_closed", "message": "Lobby closed by admin"})
                await ws.close()
            except Exception:
                pass
        lobby_connections.pop(lobby_code, None)
    # Remove in-memory lobby
    lobbies.pop(lobby_code, None)
    # Cleanup DB persistence
    try:
        conn = get_db_connection(); cur = conn.cursor()
        cur.execute("DELETE FROM lobby_participants WHERE code=%s", (lobby_code,))
        cur.execute("DELETE FROM lobbies WHERE code=%s", (lobby_code,))
        conn.commit(); cur.close(); conn.close()
    except Exception:
        pass
    try:
        # Log admin action
        admin_id = int(payload.get('sub')) if payload and payload.get('sub') else 0
        log_admin_action(admin_id, f"admin_close_lobby code={lobby_code}")
    except Exception:
        pass
    return {"status": "success"}

@router.post("/admin/lobbies/{lobby_code}/participants/{name}/remove")
async def admin_remove_participant(lobby_code: str, name: str, request: Request):
    payload = require_role(request, 'admin')
    # Remove from in-memory
    lobby = lobbies.get(lobby_code)
    if lobby:
        lobby["participants"] = [p for p in lobby.get("participants", []) if p.get("name") != name]
    # Remove from DB
    try:
        conn = get_db_connection(); cur = conn.cursor()
        cur.execute("DELETE FROM lobby_participants WHERE code=%s AND name=%s", (lobby_code, name))
        conn.commit(); cur.close(); conn.close()
    except Exception:
        pass
    # Broadcast participant update
    try:
        await broadcast_participant_update(lobby_code)
    except Exception:
        pass
    try:
        admin_id = int(payload.get('sub')) if payload and payload.get('sub') else 0
        log_admin_action(admin_id, f"admin_remove_participant code={lobby_code} name={name}")
    except Exception:
        pass
    return {"status": "success"}

@router.post("/close_lobby/{lobby_code}")
async def api_close_lobby(lobby_code: str):
    if lobby_code in lobbies:
        del lobbies[lobby_code]
    if lobby_code in lobby_connections:
        for ws in lobby_connections[lobby_code]:
            try:
                await ws.send_json({"type": "lobby_closed", "message": "Lobby has been closed by instructor"})
                await ws.close()
            except Exception:
                pass
        del lobby_connections[lobby_code]
    return {"success": True}
    # Best-effort cleanup persistence
    try:
        conn = get_db_connection(); cur = conn.cursor()
        cur.execute("DELETE FROM lobby_participants WHERE code=%s", (lobby_code,))
        cur.execute("DELETE FROM lobbies WHERE code=%s", (lobby_code,))
        conn.commit(); cur.close(); conn.close()
    except Exception:
        pass
