import json
import time
import logging
from pathlib import Path
import os
from typing import Callable, Dict, Any
from datetime import datetime
import subprocess

class CowrieMonitor:
    def __init__(self, log_path: str | None = None):
        # Determine log path (env override wins)
        preferred = log_path or os.getenv("COWRIE_LOG_PATH") or "/cowrie/cowrie-git/var/log/cowrie/cowrie.json"
        self.log_path = self._resolve_log_path(preferred)
        self.last_position = 0
        self.callbacks = []
        self.running = False
        self.logger = logging.getLogger(__name__)
        self._last_missing_warn = 0.0
        
        # Capture settings
        self.capture_commands = True
        self.capture_passwords = True
        self.capture_downloads = True

    def add_callback(self, callback: Callable[[Dict[str, Any]], None]):
        """Add a callback function to be called when new log entries are found."""
        self.callbacks.append(callback)

    def _resolve_log_path(self, preferred: str) -> Path:
        """Pick the first existing path among likely locations; fallback to preferred if none exist.
        Tries:
          - preferred
          - /cowrie_logs/cowrie/cowrie.json (docker volume from compose)
          - /cowrie_logs/cowrie.json (older layout)
          - <repo_root>/cowrie/cowrie-git/var/log/cowrie/cowrie.json (local dev)
        """
        candidates = []
        # 1) Preferred (env override or explicit)
        candidates.append(Path(preferred))
        # 2) Docker compose volume defaults
        # Depending on how the Cowrie var directory is mounted into the backend container,
        # the JSON log may be under any of these:
        #   - /cowrie_logs/log/cowrie/cowrie.json        (common when mapping cowrie-git/var -> /cowrie_logs)
        #   - /cowrie_logs/var/log/cowrie/cowrie.json    (alternate var-relative layout)
        #   - /cowrie_logs/cowrie/cowrie.json            (older layout)
        #   - /cowrie_logs/cowrie.json                   (very old flat layout)
        candidates.append(Path("/cowrie_logs/log/cowrie/cowrie.json"))
        candidates.append(Path("/cowrie_logs/var/log/cowrie/cowrie.json"))
        candidates.append(Path("/cowrie_logs/cowrie/cowrie.json"))
        candidates.append(Path("/cowrie_logs/cowrie.json"))
            # 3) Local dev: compute from repo root
        try:
            here = Path(__file__).resolve()
            repo_root = here.parents[2]  # backend/cowrie_integration -> backend -> repo root
            candidates.append(repo_root / "cowrie" / "cowrie-git" / "var" / "log" / "cowrie" / "cowrie.json")
        except Exception:
            pass
        for p in candidates:
            try:
                if p.exists():
                    return p
            except Exception:
                continue
        return Path(preferred)

    def start(self):
        """Start monitoring the Cowrie log file."""
        try:
            # Start Cowrie service
            try:
                subprocess.run(["service", "cowrie", "start"], check=True)
            except Exception as e:
                # Non-fatal in dev/local environments; just log and operate in passive mode
                self.logger.warning(f"Unable to start cowrie service (continuing without it): {e}")
            
            self.running = True
            self.logger.info("Starting Cowrie log monitor")
            
            while self.running:
                try:
                    if not self.log_path.exists():
                        # Try to resolve again in case the path was created after start
                        newp = self._resolve_log_path(str(self.log_path))
                        if newp != self.log_path:
                            self.log_path = newp
                        if not self.log_path.exists():
                            # Rate-limit warnings to avoid spamming logs
                            now = time.time()
                            if now - self._last_missing_warn > 15:
                                self.logger.warning(f"Log file {self.log_path} does not exist")
                                self._last_missing_warn = now
                            time.sleep(5)
                            continue

                    with open(self.log_path, 'r') as f:
                        # Move to the last read position
                        f.seek(self.last_position)
                        
                        # Read new lines
                        for line in f:
                            try:
                                event = json.loads(line)
                                if self._should_process_event(event):
                                    self._process_event(event)
                            except json.JSONDecodeError:
                                self.logger.error(f"Failed to parse log line: {line}")
                        
                        # Update the last position
                        self.last_position = f.tell()
                    
                    time.sleep(1)  # Prevent CPU overuse
                    
                except Exception as e:
                    self.logger.error(f"Error monitoring Cowrie logs: {e}")
                    time.sleep(5)  # Wait before retrying

        except Exception as e:
            # Non-fatal error: don't crash the app; just stop the monitor
            self.logger.error(f"Cowrie monitor encountered a fatal error and will stop: {e}")
            self.running = False
            return

    def stop(self):
        """Stop monitoring the Cowrie log file."""
        try:
            self.running = False
            self.logger.info("Stopping Cowrie log monitor")
            
            # Stop Cowrie service
            try:
                subprocess.run(["service", "cowrie", "stop"], check=True)
            except Exception as e:
                # Non-fatal in dev/local environments
                self.logger.warning(f"Unable to stop cowrie service (continuing): {e}")
            
        except Exception as e:
            self.logger.error(f"Failed to stop Cowrie service: {e}")
            # Non-fatal
            return

    def _should_process_event(self, event: Dict[str, Any]) -> bool:
        """Determine if an event should be processed based on capture settings."""
        event_id = event.get('eventid', '')
        
        if not self.capture_commands and event_id == 'cowrie.command.input':
            return False
            
        if not self.capture_passwords and event_id in ['cowrie.login.success', 'cowrie.login.failed']:
            return False
            
        if not self.capture_downloads and event_id == 'cowrie.session.file_download':
            return False
            
        return True

    def _process_event(self, event: Dict[str, Any]):
        """Process a single log event and notify callbacks."""
        try:
            # Add timestamp if not present
            if 'timestamp' not in event:
                event['timestamp'] = datetime.now().isoformat()
            
            # Add processing metadata
            event['processed_at'] = datetime.now().isoformat()
            event['monitor_status'] = 'running'
            
            # Notify all callbacks
            for callback in self.callbacks:
                try:
                    callback(event)
                except Exception as e:
                    self.logger.error(f"Error in callback: {e}")
                    
        except Exception as e:
            self.logger.error(f"Error processing event: {e}")

    def get_status(self) -> Dict[str, Any]:
        """Get the current status of the monitor."""
        return {
            "running": self.running,
            "log_path": str(self.log_path),
            "capture_settings": {
                "commands": self.capture_commands,
                "passwords": self.capture_passwords,
                "downloads": self.capture_downloads
            },
            "last_position": self.last_position,
            "callbacks_registered": len(self.callbacks)
        } 