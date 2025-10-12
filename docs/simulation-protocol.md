<!-- markdownlint-disable MD013 MD010 MD007 MD031 MD022 MD032 -->

# Simulation WebSocket Protocol

This document defines the message types and data contracts used by all roles (Attacker, Defender, Observer, Instructor) over the WebSocket channel `/simulation/{lobbyCode}`. Instructor tooling uses `/instructor/simulation/{lobbyCode}`.

Source of truth for frontend types: `frontend/src/simulation/messages.ts`.

## Roles

- Attacker, Defender, Observer, Instructor

## Session lifecycle

- join
	- Client → Server
	- Example:

		```json
		{ "type": "join", "name": "Alice", "role": "Attacker" }
		```

- join_ack
	- Server → Client (ack + difficulty context)
	- Example:

		```json
		{ "type": "join_ack", "difficulty": "Beginner", "pass_score": 40, "hints_enabled": true }
		```

- session_config
	- Server → Client (optional broadcast when settings change)
	- Example:

		```json
		{ "type": "session_config", "difficulty": "Hard", "passScore": 80, "hintsEnabled": false }
		```

- session_state
	- Server → Client (high‑level state)
	- Example:

		```json
		{ "type": "session_state", "status": "running" }
		```

- simulation_paused | simulation_resumed | simulation_ended
	- Server → Client (instructor control effects)
	- Examples:

		```json
		{ "type": "simulation_paused", "message": "Simulation paused by instructor" }
		```

		```json
		{ "type": "simulation_resumed", "message": "Simulation resumed by instructor" }
		```

		```json
		{ "type": "simulation_ended", "message": "Simulation ended by instructor" }
		```

- session_snapshot (planned; not emitted by current backend)
	- Server → Client

	```json
	{
		"type": "session_snapshot",
		"status": "running",
		"time": 1730812345678,
		"metrics": { "totalEvents": 12, "attacksLaunched": 4, "detectionsTriggered": 6 },
		"participants": [ { "id": "p1", "name": "Alice", "role": "Attacker", "connected": true } ],
		"scores": { "Alice": 30, "Bob": 20 },
		"difficulty": "Beginner",
		"passScore": 40,
		"hintsEnabled": true,
		"objectives": [ { "id": "recon_scan", "description": "Perform reconnaissance scan", "points": 10, "completed": false } ]
	}
	```

## Events & metrics

- simulation_event
	- Server → Instructor stream
	- Example:

		```json
		{ "type": "simulation_event", "eventType": "attack", "description": "Alice executed: nmap -A", "participantName": "Alice" }
		```

- metrics_update (planned)
	- Server → Client

- participant_update (planned)
	- Server → Client

- scores_update (planned)
	- Server → Client

- score_update (current)
	- Server → Client
	- Example:

		```json
		{ "type": "score_update", "name": "Alice", "score": 20 }
		```

- participant_joined (current)
	- Server → Observer
	- Example:

		```json
		{ "type": "participant_joined", "name": "Alice", "role": "Attacker" }
		```

## Attacker

- attack_command | execute_command
	- Client → Server
	- Example:

		```json
		{ "type": "attack_command", "command": "nmap -A 10.0.0.5" }
		```

- command_result
	- Server → Attacker (echo/output + helper commands: objectives, hints, score)
	- Example:

		```json
		{ "type": "command_result", "command": "objectives", "output": "Objectives (1/6):..." }
		```

- objectives
	- Server → Attacker
	- Example:

		```json
		{
			"type": "objectives",
			"objectives": [
				{ "id": "recon_scan", "description": "Perform reconnaissance scan", "points": 10, "completed": false },
				{ "id": "bruteforce_login", "description": "Attempt brute force login", "points": 20, "completed": false }
			]
		}
		```

- objectives_update
	- Server → Attacker (after completion)
	- Example:

		```json
		{ "type": "objectives_update", "completed": ["recon_scan"], "score": 10, "remaining": 5 }
		```

- hints | request_hints
	- Client → Server: `{ "type": "request_hints" }`
	- Server → Attacker:

		```json
		{ "type": "hints", "hints": [ { "id": "recon_scan", "hint": "Try using: nmap" } ] }
		```

- attack_event (emitted on attacker commands)
	- Server → Defender/Observer
	- Example:

		```json
		{ "type": "attack_event", "event": { "id": 1730812523456, "command": "nmap -A 10.0.0.5", "sourceIP": "192.168.1.100" } }
		```

## Defender

- detection_result (legacy envelope)
	- Server → Defender
	- Example:

		```json
		{ "type": "detection_result", "result": { "eventId": 1730812523999, "detected": true, "confidence": 0.7, "threats": ["SSH Brute Force"], "method": "signature" } }
		```

- detection_event (typed variant)
	- Server → Defender/Observer
	- Example (Defender stream):

		```json
		{ "type": "detection_event", "detected": true, "confidence": 0.7, "threats": ["SSH Brute Force"] }
		```

	- Example (Observer stream):

		```json
		{ "type": "detection_event", "method": "signature", "detected": true, "threats": ["SSH Brute Force"] }
		```

- defense_classify | defender_classify
	- Client → Server
	- Example (typed):

		```json
		{ "type": "defense_classify", "category": "recon", "confidence": 0.8 }
		```

- classification_result (legacy) and defense_result (typed)
	- Server → Defender (both emitted during migration)
	- Examples:

		```json
		{ "type": "classification_result", "awarded": 10, "total": 20, "correct": true, "confidence_used": 0.8, "objective_id": "recon_scan" }
		```

		```json
		{ "type": "defense_result", "correct": true, "award": 10, "total": 20 }
		```

- defense_config | update_detection_config
	- Client → Server (config change events are logged to instructors)
	- Example (typed):

		```json
		{ "type": "defense_config", "config": { "sensitivityLevel": "high", "enabledDetectors": ["aho_corasick", "isolation_forest"], "alertThreshold": 0.7 } }
		```

- off_objective_threat (Hard mode)
	- Server → Defender/Observer
	- Example:

		```json
		{ "type": "off_objective_threat", "attacker": "Alice", "command": "curl http://mal", "threats": ["Malware Download"] }
		```

- objective_completed / objective_defended
	- Server → Defender/Observer (coordination cues)
	- Examples:

		```json
		{ "type": "objective_completed", "attacker": "Alice", "objective_id": "recon_scan", "category": "recon" }
		```

		```json
		{ "type": "objective_defended", "defender": "Bob", "attacker": "Alice", "objective_id": "recon_scan", "category": "recon" }
		```

## Communication

- broadcast (instructor → participants)
	- Instructor → Server (instructor WS): `{ "type": "broadcast", "message": "Remember: collaborate!" }`
	- Server → Participants: `{ "type": "instructor_broadcast", "message": "Remember: collaborate!" }`

- chat_message
	- Sender → Server: `{ "type": "chat_message", "sender": "Instructor", "message": "Good job" }`
	- Server → Participants: `{ "type": "chat_message", "sender": "Instructor", "message": "Good job" }`

## Instructor controls

- instructor_control
	- Instructor → Server: `{ "type": "instructor_control", "action": "pause" }` | `resume` | `end`
	- Server → Participants: `simulation_paused` | `simulation_resumed` | `simulation_ended`

- instructor_action (planned)
	- `{ "type": "instructor_action", "action": "kick", "participantId": "p1" }`

## Error & misc

- server_message: `{ "type": "server_message", "level": "info", "text": "..." }`
- error: `{ "type": "error", "code": 400, "text": "..." }`

## Entities

```text
Participant { id: string, name: string, role: Role, connected: boolean }
Objective { id: string, description: string, points: 10|20, completed: boolean }
Metrics { totalEvents: number, attacksLaunched: number, detectionsTriggered: number, successfulBlocks?: number }
```

## Notes

- All messages may include `ts` (epoch ms), `lobbyCode`, `senderId` for audit.
- Server provides idempotent handling for instructor controls; duplicate pause/resume are safe.
- Late joins should be handled by sending a snapshot (planned), plus current objectives and scores.

<!-- markdownlint-enable MD013 MD010 MD007 MD031 MD022 MD032 -->
