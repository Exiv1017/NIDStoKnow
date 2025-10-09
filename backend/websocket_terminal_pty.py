import os
import pty
import asyncio
import threading
import logging
from fastapi import WebSocket
from auth import decode_token

async def websocket_terminal_with_pty(websocket: WebSocket):
    logging.info("WebSocket terminal connection attempt (pty)")
    # Enforce token
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
    logging.info("WebSocket terminal connection accepted (pty)")

    loop = asyncio.get_event_loop()
    master_fd, slave_fd = pty.openpty()
    pid = os.fork()
    if pid == 0:
        # Child process: replace with bash
        os.setsid()
        os.dup2(slave_fd, 0)
        os.dup2(slave_fd, 1)
        os.dup2(slave_fd, 2)
        os.execv("/bin/bash", ["/bin/bash", "-i"])
    else:
        # Parent process: handle IO
        def read_from_pty():
            try:
                while True:
                    data = os.read(master_fd, 1024)
                    if not data:
                        break
                    asyncio.run_coroutine_threadsafe(websocket.send_text(data.decode(errors='ignore')), loop)
            except Exception as e:
                logging.error(f"PTY read error: {e}")

        thread = threading.Thread(target=read_from_pty, daemon=True)
        thread.start()

        try:
            while True:
                data = await websocket.receive_text()
                os.write(master_fd, data.encode())
        except Exception as e:
            logging.info(f"WebSocket terminal disconnected (pty): {e}")
        finally:
            try:
                os.close(master_fd)
            except Exception:
                pass
            await websocket.close()
