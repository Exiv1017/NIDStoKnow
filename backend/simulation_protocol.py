# Shared enums and dataclasses for simulation protocol (backend-side)
from enum import Enum
from typing import List, Optional, Dict, Literal
from dataclasses import dataclass

class Role(str, Enum):
    ATTACKER = 'Attacker'
    DEFENDER = 'Defender'
    OBSERVER = 'Observer'
    INSTRUCTOR = 'Instructor'

class SessionStatus(str, Enum):
    RUNNING = 'running'
    PAUSED = 'paused'
    ENDED = 'ended'

class MessageType(str, Enum):
    JOIN = 'join'
    JOIN_ACK = 'join_ack'
    SESSION_CONFIG = 'session_config'
    SESSION_STATE = 'session_state'
    SESSION_SNAPSHOT = 'session_snapshot'
    SESSION_END = 'session_end'

    SIMULATION_EVENT = 'simulation_event'
    METRICS_UPDATE = 'metrics_update'
    PARTICIPANT_UPDATE = 'participant_update'
    SCORES_UPDATE = 'scores_update'

    ATTACK_COMMAND = 'attack_command'
    TERMINAL_OUTPUT = 'terminal_output'
    OBJECTIVES = 'objectives'
    OBJECTIVES_UPDATE = 'objectives_update'
    HINTS = 'hints'
    REQUEST_HINTS = 'request_hints'

    DETECTION_EVENT = 'detection_event'
    DEFENSE_CLASSIFY = 'defense_classify'
    DEFENSE_RESULT = 'defense_result'
    DEFENSE_CONFIG = 'defense_config'
    DEFENSE_ACTION = 'defense_action'

    BROADCAST = 'broadcast'
    CHAT_MESSAGE = 'chat_message'

    INSTRUCTOR_CONTROL = 'instructor_control'
    INSTRUCTOR_ACTION = 'instructor_action'

    SERVER_MESSAGE = 'server_message'
    ERROR = 'error'

@dataclass
class Participant:
    id: str
    name: str
    role: Role
    connected: bool = True

@dataclass
class Objective:
    id: str
    description: str
    points: int  # 10 or 20
    completed: bool = False

@dataclass
class Metrics:
    totalEvents: int = 0
    attacksLaunched: int = 0
    detectionsTriggered: int = 0
    successfulBlocks: int = 0

# Typed payload helpers (optional at runtime; useful for clarity)
@dataclass
class BaseMessage:
    type: MessageType
    ts: Optional[int] = None
    lobbyCode: Optional[str] = None
    senderId: Optional[str] = None
