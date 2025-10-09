from typing import Dict, Any, List, Optional
from datetime import datetime
import re

class CowrieLogParser:
    def __init__(self):
        self.ssh_patterns = {
            'brute_force': re.compile(r'Failed password for .* from .* port \d+'),
            'successful_login': re.compile(r'Accepted password for .* from .* port \d+'),
            'port_scan': re.compile(r'Connection from .* port \d+'),
            'command_execution': re.compile(r'Command found: .*'),
        }
        
        self.telnet_patterns = {
            'login_attempt': re.compile(r'login attempt .*'),
            'command_execution': re.compile(r'Command found: .*'),
        }

    def parse_event(self, event: Dict[str, Any]) -> Dict[str, Any]:
        """Parse a Cowrie log event and extract relevant information."""
        try:
            event_type = event.get('eventid', '')
            parsed_event = {
                'timestamp': event.get('timestamp', datetime.now().isoformat()),
                'source_ip': event.get('src_ip', ''),
                'source_port': event.get('src_port', ''),
                'session': event.get('session', ''),
                'event_type': event_type,
                'details': {},
                'severity': 'low'
            }

            if event_type == 'cowrie.login.success':
                parsed_event.update({
                    'details': {
                        'username': event.get('username', ''),
                        'password': event.get('password', ''),
                    },
                    'severity': 'high'
                })
            elif event_type == 'cowrie.login.failed':
                parsed_event.update({
                    'details': {
                        'username': event.get('username', ''),
                        'password': event.get('password', ''),
                    },
                    'severity': 'medium'
                })
            elif event_type == 'cowrie.command.input':
                parsed_event.update({
                    'details': {
                        'command': event.get('input', ''),
                    },
                    'severity': self._determine_command_severity(event.get('input', ''))
                })
            elif event_type == 'cowrie.session.connect':
                parsed_event.update({
                    'details': {
                        'protocol': event.get('protocol', ''),
                    },
                    'severity': 'low'
                })
            elif event_type == 'cowrie.session.file_download':
                parsed_event.update({
                    'details': {
                        'url': event.get('url', ''),
                        'filename': event.get('filename', ''),
                        'shasum': event.get('shasum', ''),
                    },
                    'severity': 'high'
                })
            elif event_type == 'cowrie.client.version':
                # Remote client SSH version fingerprint
                parsed_event.update({
                    'details': {
                        'version': event.get('version', ''),
                        'message': event.get('message', ''),
                    },
                    'severity': 'low'
                })

            return parsed_event
        except Exception as e:
            return {
                'timestamp': datetime.now().isoformat(),
                'error': str(e),
                'severity': 'low'
            }

    def _determine_command_severity(self, command: str) -> str:
        """Determine the severity of a command based on its content."""
        high_severity_commands = [
            'wget', 'curl', 'nc', 'netcat', 'nmap', 'ssh', 'scp',
            'rm', 'chmod', 'chown', 'iptables', 'sudo', 'su'
        ]
        
        if any(cmd in command.lower() for cmd in high_severity_commands):
            return 'high'
        elif 'cat' in command.lower() or 'ls' in command.lower():
            return 'medium'
        else:
            return 'low'

    def get_recent_attacks(self, events: List[Dict[str, Any]], limit: int = 10) -> List[Dict[str, Any]]:
        """Get the most recent medium/high severity events.
        Accepts raw Cowrie events or already parsed events (with 'event_type').
        """
        parsed_events: List[Dict[str, Any]] = []
        for ev in events:
            if isinstance(ev, dict) and 'event_type' in ev and 'severity' in ev:
                parsed_events.append(ev)
            else:
                parsed_events.append(self.parse_event(ev))
        return sorted(
            [e for e in parsed_events if e.get('severity') in ['medium', 'high']],
            key=lambda x: x.get('timestamp', ''),
            reverse=True
        )[:limit]

    def get_attack_statistics(self, events: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Generate statistics from a list of events."""
        parsed_events = [self.parse_event(event) for event in events]
        
        stats = {
            'total_events': len(parsed_events),
            'by_severity': {
                'high': 0,
                'medium': 0,
                'low': 0
            },
            'by_type': {},
            'by_source_ip': {},
            # Pass parsed events; get_recent_attacks handles pre-parsed gracefully
            'recent_attacks': self.get_recent_attacks(parsed_events)
        }
        
        for event in parsed_events:
            # Count by severity
            stats['by_severity'][event['severity']] += 1
            
            # Count by event type
            event_type = event['event_type']
            stats['by_type'][event_type] = stats['by_type'].get(event_type, 0) + 1
            
            # Count by source IP
            if event['source_ip']:
                stats['by_source_ip'][event['source_ip']] = stats['by_source_ip'].get(event['source_ip'], 0) + 1
        
        return stats 