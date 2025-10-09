from fastapi import APIRouter, HTTPException, BackgroundTasks
from typing import List, Dict, Any
from .cowrie_monitor import CowrieMonitor
from .log_parser import CowrieLogParser
import logging
import json
import os
from pathlib import Path

router = APIRouter()
monitor = CowrieMonitor()
parser = CowrieLogParser()
events: List[Dict[str, Any]] = []

def event_callback(event: Dict[str, Any]):
    """Callback function to store new events."""
    events.append(event)

@router.on_event("startup")
async def startup_event():
    """Start the Cowrie monitor when the application starts."""
    monitor.add_callback(event_callback)
    # Start the monitor in a background thread
    import threading
    thread = threading.Thread(target=monitor.start)
    thread.daemon = True
    thread.start()

@router.get("/attacks/recent", response_model=List[Dict[str, Any]])
async def get_recent_attacks(limit: int = 10):
    """Get the most recent attacks detected by Cowrie."""
    try:
        return parser.get_recent_attacks(events, limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/attacks/statistics", response_model=Dict[str, Any])
async def get_attack_statistics():
    """Get statistics about attacks detected by Cowrie."""
    try:
        return parser.get_attack_statistics(events)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/cowrie/status")
async def get_cowrie_status():
    """Check if Cowrie is running and get its status."""
    try:
        return {
            "running": monitor.running,
            "events_processed": len(events),
            "last_event": events[-1] if events else None
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/cowrie/configure")
async def configure_cowrie(config: Dict[str, Any]):
    """Configure Cowrie honeypot settings."""
    try:
        # Get the Cowrie config file path
        config_file = Path("/cowrie/cowrie-git/etc/cowrie.cfg")
        
        # Basic validation
        if not isinstance(config.get('port'), int):
            raise ValueError("Port must be an integer")
        if not isinstance(config.get('honeypotType'), str):
            raise ValueError("Honeypot type must be a string")
        
        # Create configuration content
        cowrie_config = f"""[honeypot]
hostname = honeypot
log_path = /cowrie/cowrie-git/var/log
contents_path = /cowrie/cowrie-git/share/cowrie
download_path = ${{honeypot:log_path}}/downloads
share_path = /cowrie/cowrie-git/share/cowrie/fs.pickle
state_path = /cowrie/cowrie-git/var/lib/cowrie
etc_path = /cowrie/cowrie-git/etc
txtcmds_path = /cowrie/cowrie-git/share/cowrie/txtcmds
ttylog = true
ttylog_path = ${{honeypot:log_path}}/tty

[ssh]
enabled = {config['honeypotType'] == 'ssh'}
listen_port = {config['port'] if config['honeypotType'] == 'ssh' else 2222}
version = SSH-2.0-OpenSSH_6.0p1 Debian-4+deb7u2

[telnet]
enabled = {config['honeypotType'] == 'telnet'}
listen_port = {config['port'] if config['honeypotType'] == 'telnet' else 2223}

[output_jsonlog]
enabled = true
logfile = ${{honeypot:log_path}}/cowrie/cowrie.json
format = json

[output_textlog]
enabled = true
logfile = ${{honeypot:log_path}}/cowrie-textlog.log

[connection]
max_connections = {config.get('maxConnections', 10)}

[output_mysql]
enabled = false

[output_sqlite]
enabled = false
"""
        
        # Write the configuration
        with open(config_file, 'w') as f:
            f.write(cowrie_config)
            
        # Restart Cowrie to apply changes
        monitor.stop()
        monitor.start()
        
        return {"status": "success", "message": "Cowrie configuration updated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/simulation/start")
async def start_simulation(config: Dict[str, Any]):
    """Start a new simulation with the given configuration."""
    try:
        # Validate configuration
        required_fields = ['simulationName', 'detectionType', 'attackType', 'duration']
        for field in required_fields:
            if field not in config:
                raise ValueError(f"Missing required field: {field}")
        
        # Clear previous events
        events.clear()
        
        # Configure monitoring based on capture settings
        monitor.capture_commands = config.get('captureCommands', True)
        monitor.capture_passwords = config.get('capturePasswords', True)
        monitor.capture_downloads = config.get('captureDownloads', True)
        
        # Start the monitor if not running
        if not monitor.running:
            monitor.start()
            
        return {
            "status": "success",
            "message": "Simulation started successfully",
            "config": config
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/cowrie/restart")
async def restart_cowrie(background_tasks: BackgroundTasks):
    """Restart the Cowrie monitor."""
    try:
        monitor.stop()
        background_tasks.add_task(monitor.start)
        return {"status": "restarting"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) 