from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, List
import asyncio
import logging
from auth import decode_token

router = APIRouter()

# In-memory lobby state (for demo; use Redis/db for production)
lobbies: Dict[str, Dict] = {}
lobby_connections: Dict[str, List[WebSocket]] = {}

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
    # Only allow joining if lobby exists (created by instructor)
    if lobby_code not in lobbies:
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
                await broadcast_participant_update(lobby_code)
                
            elif action == "ready":
                for p in lobby["participants"]:
                    if p["name"] == payload["name"]:
                        p["ready"] = payload["ready"]
                await broadcast_participant_update(lobby_code)
                
            elif action == "role":
                for p in lobby["participants"]:
                    if p["name"] == payload["name"]:
                        p["role"] = payload["role"]
                await broadcast_participant_update(lobby_code)
                
            elif action == "chat":
                msg = {"sender": payload["sender"], "message": payload["message"]}
                lobby["chat"].append(msg)
                # Broadcast chat message to all participants
                await broadcast_chat_message(lobby_code, payload["sender"], payload["message"])
                
            elif action == "reset":
                lobby["participants"] = [p for p in lobby["participants"] if p["role"] == "Instructor"]
                lobby["chat"] = []
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

def create_lobby(lobby_code: str):
    if lobby_code not in lobbies:
        lobbies[lobby_code] = {"participants": [], "chat": [], "difficulty": "Beginner"}

@router.post("/create_lobby/{lobby_code}")
async def api_create_lobby(lobby_code: str):
    if lobby_code not in lobbies:
        lobbies[lobby_code] = {"participants": [], "chat": [], "difficulty": "Beginner"}
    return {"success": True}

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
