// Shared message types and constants for Simulation WebSocket protocol
// This file is frontend-only (TypeScript). Keep in sync with backend enums.

export type Role = 'Attacker' | 'Defender' | 'Observer' | 'Instructor';

export type SessionStatus = 'running' | 'paused' | 'ended';

export const MessageTypes = {
  // session
  JOIN: 'join',
  JOIN_ACK: 'join_ack',
  SESSION_CONFIG: 'session_config',
  SESSION_STATE: 'session_state',
  SESSION_SNAPSHOT: 'session_snapshot',
  SESSION_END: 'session_end', // not currently used by backend; backend uses SIMULATION_END below
  SIMULATION_PAUSED: 'simulation_paused',
  SIMULATION_RESUMED: 'simulation_resumed',
  SIMULATION_ENDED: 'simulation_ended',

  // events/metrics
  SIMULATION_EVENT: 'simulation_event',
  METRICS_UPDATE: 'metrics_update',
  PARTICIPANT_UPDATE: 'participant_update',
  SCORES_UPDATE: 'scores_update',
  SIMULATION_METRICS: 'simulation_metrics', // instructor stream
  PARTICIPANT_SCORE_UPDATE: 'participant_score_update', // instructor stream
  PARTICIPANT_DISCONNECTED: 'participant_disconnected',
  PARTICIPANT_RECONNECTED: 'participant_reconnected',

  // attacker
  EXECUTE_COMMAND: 'execute_command', // current backend name
  ATTACK_COMMAND: 'attack_command',
  TERMINAL_OUTPUT: 'terminal_output',
  OBJECTIVES: 'objectives',
  OBJECTIVES_UPDATE: 'objectives_update',
  HINTS: 'hints',
  REQUEST_HINTS: 'request_hints',
  REQUEST_OBJECTIVES: 'request_objectives', // current backend name
  COMMAND_RESULT: 'command_result', // backend echo/result
  DETECTION_ALERT: 'detection_alert',

  // defender
  ATTACK_EVENT: 'attack_event',
  OFF_OBJECTIVE_THREAT: 'off_objective_threat',
  DETECTION_RESULT: 'detection_result', // backend wrapper for defender
  DETECTION_EVENT: 'detection_event',
  DEFENSE_CLASSIFY: 'defense_classify', // planned name
  DEFENDER_CLASSIFY: 'defender_classify', // current backend name
  DEFENSE_TRIAGE: 'defense_triage', // beginner-friendly TP/FP message
  DEFENSE_RESULT: 'defense_result', // planned name
  CLASSIFICATION_RESULT: 'classification_result', // current backend name
  DEFENSE_CONFIG: 'defense_config',
  UPDATE_DETECTION_CONFIG: 'update_detection_config', // current backend name
  DEFENSE_ACTION: 'defense_action',
  DEFENDER_ACTION: 'defender_action',

  // comms
  BROADCAST: 'broadcast',
  CHAT_MESSAGE: 'chat_message',

  // instructor controls
  INSTRUCTOR_CONTROL: 'instructor_control',
  INSTRUCTOR_ACTION: 'instructor_action',

  // misc
  SERVER_MESSAGE: 'server_message',
  ERROR: 'error',
  SCORE_UPDATE: 'score_update',
  PARTICIPANT_JOINED: 'participant_joined',
  REQUEST_SCOREBOARD: 'request_scoreboard',
  SIMULATION_END: 'simulation_end',
} as const;

export type MessageType = typeof MessageTypes[keyof typeof MessageTypes];

export interface BaseMessage {
  type: MessageType;
  ts?: number; // epoch ms
  lobbyCode?: string;
  senderId?: string;
}

// Session-related
export interface JoinMessage extends BaseMessage {
  type: typeof MessageTypes.JOIN;
  name: string;
  role: Role;
  token?: string;
}

export interface SessionConfigMessage extends BaseMessage {
  type: typeof MessageTypes.SESSION_CONFIG;
  difficulty: 'Beginner' | 'Intermediate' | 'Hard';
  passScore: number;
  hintsEnabled: boolean;
}

export interface SessionStateMessage extends BaseMessage {
  type: typeof MessageTypes.SESSION_STATE;
  status: SessionStatus;
}

export interface SessionSnapshotMessage extends BaseMessage {
  type: typeof MessageTypes.SESSION_SNAPSHOT;
  status: SessionStatus;
  time: number;
  metrics: Metrics;
  participants: Participant[];
  scores: Record<string, number>;
  difficulty: 'Beginner' | 'Intermediate' | 'Hard';
  passScore: number;
  hintsEnabled: boolean;
  objectives?: Objective[];
}

export interface SessionEndMessage extends BaseMessage {
  type: typeof MessageTypes.SESSION_END;
  leaderboard: Array<{ id: string; name: string; role: Role; score: number }>;
  summary: Metrics & { duration: number };
}

// Entities
export interface Participant {
  id: string;
  name: string;
  role: Role;
  connected: boolean;
}

export interface Metrics {
  totalEvents: number;
  attacksLaunched: number;
  detectionsTriggered: number;
  successfulBlocks?: number;
}

export interface Objective {
  id: string;
  description: string;
  points: number; // 10 or 20
  completed: boolean;
}

// Events & domain messages
export interface SimulationEventMessage extends BaseMessage {
  type: typeof MessageTypes.SIMULATION_EVENT;
  eventType: 'attack' | 'detection' | 'block' | 'warning' | 'info';
  description: string;
  participantName?: string;
}

export interface AttackCommandMessage extends BaseMessage {
  type: typeof MessageTypes.ATTACK_COMMAND;
  command: string;
}

export interface TerminalOutputMessage extends BaseMessage {
  type: typeof MessageTypes.TERMINAL_OUTPUT;
  lines: string;
}

export interface ObjectivesMessage extends BaseMessage {
  type: typeof MessageTypes.OBJECTIVES;
  items: Objective[];
}

export interface ObjectivesUpdateMessage extends BaseMessage {
  type: typeof MessageTypes.OBJECTIVES_UPDATE;
  items: Objective[];
  score: number;
  serverMessage?: string;
}

export interface HintsMessage extends BaseMessage {
  type: typeof MessageTypes.HINTS;
  items: Array<{ id: string; hint: string }>;
  remaining?: number;
}

export interface RequestHintsMessage extends BaseMessage {
  type: typeof MessageTypes.REQUEST_HINTS;
}

export interface DetectionEventMessage extends BaseMessage {
  type: typeof MessageTypes.DETECTION_EVENT;
  id?: string;
  detected: boolean;
  confidence: number; // 0..1
  threats?: string[];
}

export interface DefenseClassifyMessage extends BaseMessage {
  type: typeof MessageTypes.DEFENSE_CLASSIFY;
  attackId?: string;
  category?: string;
  objective?: string;
  command?: string;
  confidence?: number; // 0..1
}

export interface DefenseTriageMessage extends BaseMessage {
  type: typeof MessageTypes.DEFENSE_TRIAGE;
  label: 'tp' | 'fp';
  confidence?: number; // 0..1
}

export interface DefenseResultMessage extends BaseMessage {
  type: typeof MessageTypes.DEFENSE_RESULT;
  correct: boolean;
  award: number;
  total: number;
  cooldown?: boolean;
  message?: string;
}

export interface DefenseConfigMessage extends BaseMessage {
  type: typeof MessageTypes.DEFENSE_CONFIG;
  config: {
    sensitivityLevel: 'low' | 'medium' | 'high';
    enabledDetectors: Array<'aho_corasick' | 'isolation_forest'>;
    alertThreshold: number; // 0.1..1
  };
}

export interface DefenseActionMessage extends BaseMessage {
  type: typeof MessageTypes.DEFENSE_ACTION;
  action: 'block_ip' | 'unblock_ip';
  target: string;
  duration?: number;
}

export interface BroadcastMessage extends BaseMessage {
  type: typeof MessageTypes.BROADCAST;
  message: string;
}

export interface ChatMessage extends BaseMessage {
  type: typeof MessageTypes.CHAT_MESSAGE;
  sender: string;
  message: string;
}

export interface InstructorControlMessage extends BaseMessage {
  type: typeof MessageTypes.INSTRUCTOR_CONTROL;
  action: 'pause' | 'resume' | 'end';
}

export interface InstructorActionMessage extends BaseMessage {
  type: typeof MessageTypes.INSTRUCTOR_ACTION;
  action: 'kick' | 'assign_role';
  participantId: string;
  role?: Role;
}

export interface ServerMessage extends BaseMessage {
  type: typeof MessageTypes.SERVER_MESSAGE;
  level?: 'info' | 'warning' | 'error';
  text: string;
}

export interface ErrorMessage extends BaseMessage {
  type: typeof MessageTypes.ERROR;
  code: number;
  text: string;
}

export type AnyInboundMessage =
  | SessionConfigMessage
  | SessionStateMessage
  | SessionSnapshotMessage
  | SessionEndMessage
  | SimulationEventMessage
  | ObjectivesMessage
  | ObjectivesUpdateMessage
  | HintsMessage
  | DetectionEventMessage
  | DefenseResultMessage
  | BroadcastMessage
  | ChatMessage
  | ServerMessage
  | ErrorMessage;

export type AnyOutboundMessage =
  | JoinMessage
  | AttackCommandMessage
  | RequestHintsMessage
  | DefenseClassifyMessage
  | DefenseTriageMessage
  | DefenseConfigMessage
  | DefenseActionMessage
  | InstructorControlMessage
  | InstructorActionMessage
  | BroadcastMessage
  | ChatMessage;
