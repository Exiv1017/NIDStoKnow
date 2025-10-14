import asyncio
import logging
from fastapi import WebSocket
import paramiko
import threading
import io
import time
import os

class CowrieTerminal:
    def __init__(self):
        self.ssh_client = None
        self.channel = None
        self.websocket = None
        self.read_thread = None
        self.connected = False
        
    async def connect_to_cowrie(self, websocket: WebSocket, simulation_type: str = "signature"):
        """Connect WebSocket to Cowrie honeypot via SSH"""
        logging.warning(f"[CowrieTerminal] Connecting to Cowrie for {simulation_type} simulation")
        await websocket.accept()
        self.websocket = websocket
        
        # Common honeypot credentials to try (extendable). We prepend explicit env overrides if present.
        env_user = os.getenv("COWRIE_USERNAME")
        env_pass = os.getenv("COWRIE_PASSWORD")
        credentials = []
        if env_user and env_pass:
            credentials.append((env_user, env_pass))
            logging.warning(f"[CowrieTerminal] Using explicit env credentials first: {env_user}/*****")
        else:
            logging.warning("[CowrieTerminal] No explicit env credentials set; falling back to built-ins.")
        credentials.extend([
            ("root", "123456"),
            ("root", "root"),
            ("root", "password"),
            ("root", "toor"),
            ("admin", "admin"),
            ("admin", "123456"),
            ("user", "password"),
            ("test", "test"),
        ])
        
        try:
            # Create SSH client
            self.ssh_client = paramiko.SSHClient()
            self.ssh_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            
            # Try different credentials
            connected = False
            # Allow overriding Cowrie host/port via env so containers can reach the service name
            host = os.getenv('COWRIE_HOST', 'cowrie')
            # Cowrie default SSH port is 2222; ensure fallback if env points elsewhere and fails.
            preferred_port = os.getenv('COWRIE_SSH_PORT', '2222')
            try:
                port = int(preferred_port)
            except Exception:
                port = 2222
            port_in_use = port
            logging.warning(f"[CowrieTerminal] Target honeypot at {host}:{port_in_use}")
            for username, password in credentials:
                try:
                    logging.warning(f"[CowrieTerminal] Attempting password auth for {username}/***** on {host}:{port_in_use}")
                    self.ssh_client.connect(
                        hostname=host,
                        port=port_in_use,
                        username=username,
                        password=password,
                        timeout=10,
                        allow_agent=False,
                        look_for_keys=False
                    )
                    connected = True
                    logging.warning(f"[CowrieTerminal] Connected (password) with {username}/***** on {host}:{port_in_use}")
                    break
                except paramiko.AuthenticationException:
                    # Fallback: try keyboard-interactive with same password (Cowrie commonly uses this)
                    logging.warning(f"[CowrieTerminal] Password auth failed for {username}; trying keyboard-interactive on {host}:{port_in_use}")
                    try:
                        transport = paramiko.Transport((host, port_in_use))
                        transport.start_client(timeout=10)

                        def _ki_handler(title, instructions, prompts):
                            # Respond with the same password for all prompts
                            try:
                                # Cowrie typically prompts like 'Password: '
                                return [password for _p, _show in prompts]
                            except Exception:
                                return [password] * len(prompts)

                        transport.auth_interactive(username, _ki_handler)
                        if not transport.is_authenticated():
                            raise paramiko.AuthenticationException("interactive not authenticated")

                        # Open an interactive shell via transport
                        session = transport.open_session()
                        session.get_pty(term='xterm-256color', width=80, height=24)
                        session.invoke_shell()
                        self.channel = session
                        # bind transport into a client wrapper so cleanup works similarly
                        self.ssh_client = None  # channel is primary now
                        connected = True
                        logging.warning(f"[CowrieTerminal] Connected (kbd-interactive) with {username}/***** on {host}:{port_in_use}")
                        break
                    except Exception as ie:
                        logging.error(f"[CowrieTerminal] Keyboard-interactive failed for {username} on {host}:{port_in_use}: {ie}")
                        # fall through to next credential (or fallback port)
                except Exception as e:
                    logging.error(f"[CowrieTerminal] Connection error with {username} on {host}:{port_in_use}: {e}")
                    # If first attempt and port != 2222, try fallback port 2222 once, then resume
                    if port_in_use != 2222:
                        try:
                            logging.warning(f"[CowrieTerminal] Fallback to default Cowrie port 2222")
                            self.ssh_client.connect(
                                hostname=host,
                                port=2222,
                                username=username,
                                password=password,
                                timeout=10,
                                allow_agent=False,
                                look_for_keys=False
                            )
                            port_in_use = 2222  # stick with fallback for subsequent attempts
                            connected = True
                            logging.warning(f"[CowrieTerminal] Connected with {username}/***** on fallback port 2222")
                            break
                        except Exception as e2:
                            logging.error(f"[CowrieTerminal] Fallback port connect failed: {e2}")
                    continue
            
            if not connected:
                raise Exception(f"All authentication attempts failed (host={host} port={port_in_use}). Check Cowrie credentials/userdb and network reachability.")
            
            # Open an interactive shell
            if not self.channel:
                self.channel = self.ssh_client.invoke_shell(
                    term='xterm-256color',
                    width=80,
                    height=24
                )
            
            self.connected = True
            logging.warning("[CowrieTerminal] Successfully connected to Cowrie honeypot")
            
            # Send initial simulation context
            await self.setup_simulation_environment(simulation_type)
            
            # Start reading from SSH channel
            loop = asyncio.get_event_loop()
            self.read_thread = threading.Thread(
                target=self._read_from_ssh,
                args=(loop,),
                daemon=True
            )
            self.read_thread.start()
            
            # Handle WebSocket messages
            while self.connected:
                try:
                    data = await websocket.receive_text()
                    if self.channel:
                        self.channel.send(data)
                except Exception as e:
                    logging.info(f"WebSocket disconnected: {e}")
                    break
                    
        except Exception as e:
            logging.error(f"[CowrieTerminal] Failed to connect to Cowrie: {e}")
            await websocket.send_text(f"Error: Failed to connect to honeypot: {e}\r\n")
            # Use the configured port in the hint, not a hardcoded one
            try:
                hint_port = int(os.getenv('COWRIE_SSH_PORT', '2222'))
            except Exception:
                hint_port = 2222
            await websocket.send_text(f"Please check if Cowrie honeypot is reachable (service: cowrie, port: {hint_port})\r\n")
        finally:
            await self.disconnect()
            
    def _read_from_ssh(self, loop):
        """Read data from SSH channel and send to WebSocket"""
        try:
            while self.connected and self.channel:
                if self.channel.recv_ready():
                    data = self.channel.recv(1024)
                    if data and self.websocket:
                        # Schedule sending data to WebSocket
                        asyncio.run_coroutine_threadsafe(
                            self.websocket.send_text(data.decode('utf-8', errors='ignore')),
                            loop
                        )
                else:
                    time.sleep(0.01)  # Small delay to prevent busy waiting
        except Exception as e:
            logging.error(f"SSH read error: {e}")
            self.connected = False
            
    async def setup_simulation_environment(self, simulation_type: str):
        """Set up the environment based on simulation type"""
        if not self.channel:
            return
            
        # Wait a moment for the shell to be ready
        await asyncio.sleep(1)
        
        if simulation_type == "signature":
            # Set up signature-based detection scenario
            welcome_msg = (
                "Welcome to the Signature-Based NIDS Training Environment!\n"
                "\n"
                "This is a simulated vulnerable system for educational purposes.\n"
                "Your goal: Perform attacks that can be detected by signature-based rules.\n"
                "\n"
                "Suggested attacks to try:\n"
                "  nmap -sS localhost                    (SYN scan)\n"
                "  curl -A \"Nikto\" http://localhost     (suspicious user agent)\n"
                "  echo \"../../../../etc/passwd\"        (directory traversal)\n"
                "  python -c \"exec(__import__('base64').b64decode('...'))\" \n"
                "                                        (encoded payload)\n"
                "\n"
                "Type 'help' for more suggestions or start exploring!\n"
            )
        elif simulation_type == "anomaly":
            # Set up anomaly-based detection scenario
            welcome_msg = (
                "Welcome to the Anomaly-Based NIDS Training Environment!\n"
                "\n"
                "This is a simulated system for educational purposes.\n"
                "Your goal: Perform unusual activities that deviate from normal behavior.\n"
                "\n"
                "Suggested activities to try:\n"
                "  - Rapid port scanning: for i in {1..100}; do nc -z localhost $i; done\n"
                "  - Unusual login patterns: multiple failed attempts\n"
                "  - Large data transfers: dd if=/dev/zero of=/tmp/largefile bs=1M count=100\n"
                "  - Process spawning: for i in {1..50}; do sleep 1000 & done\n"
                "\n"
                "Monitor system behavior and try unusual patterns!\n"
            )
        elif simulation_type == "hybrid":
            # Set up hybrid detection scenario
            welcome_msg = (
                "Welcome to the Hybrid NIDS Training Environment!\n"
                "\n"
                "This combines both signature and anomaly detection approaches.\n"
                "Your goal: Perform attacks that test both detection methods.\n"
                "\n"
                "Advanced scenarios to try:\n"
                "  - Polymorphic attacks (varying signatures)\n"
                "  - Low-and-slow attacks (avoiding thresholds)\n"
                "  - Legitimate tools used maliciously\n"
                "  - Encrypted/obfuscated payloads\n"
                "\n"
                "Think like an advanced persistent threat!\n"
            )
        else:
            welcome_msg = "Welcome to the NIDS Training Environment!\n"
            
        # Send welcome message
        if self.websocket:
            await self.websocket.send_text(welcome_msg)
            
    async def disconnect(self):
        """Clean up connections"""
        self.connected = False
        
        if self.channel:
            self.channel.close()
            
        if self.ssh_client:
            self.ssh_client.close()
            
        if self.websocket:
            try:
                await self.websocket.close()
            except:
                pass

# WebSocket endpoint functions
async def websocket_cowrie_terminal(websocket: WebSocket, simulation_type: str = "signature"):
    """WebSocket endpoint for Cowrie terminal connection"""
    terminal = CowrieTerminal()
    await terminal.connect_to_cowrie(websocket, simulation_type)
