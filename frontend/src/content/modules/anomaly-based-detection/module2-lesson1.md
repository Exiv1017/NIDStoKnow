## **_Correlation Layers_**

Anomaly detection shines when it connects signals across entities, time, and
systems—not when it examines each alert in isolation. Correlation layers link
anomalous events to reveal attack patterns.

### What is correlation?

Correlation connects related events to expose meaningful relationships that may
indicate malicious activity. For example:

- A suspicious login attempt
- A new process starting on the same host
- Unusual outbound traffic immediately after

Individually these may look harmless; correlated, they can reveal a sequence of
compromise.

### Why correlation matters in anomaly detection

An anomaly engine detects deviations; correlation layers stitch them with other
signals (auth logs, endpoint events, network flows). When an anomaly aligns in
time and entity with corroborating signals, confidence rises and noise drops.

### Structure of correlation layers

- Data aggregation: collect alerts/logs from IDS, EDR, firewalls, and anomaly
	models.
- Normalization: map formats into a shared schema for comparison.
- Event linking: match by IP, host, user, or time window.
- Correlation rules/analytics: logical or statistical patterns.
	- Example: if a host triggers both a port scan and unauthorized login within
		10 minutes, raise priority.
- Prioritization: rank by severity for analyst focus.

### Common correlation layers

- Network layer: connect traffic/flow records to detect scans or lateral move
	(e.g., spike in DNS followed by unusual HTTP).
- Host layer: link processes, access logs, system events (e.g., new user then
	privilege escalation).
- Temporal layer: detect periodic or bursty sequences (e.g., every 30
	seconds).
- Behavioral layer: combine activity patterns across departments to catch
	stealthy or distributed attacks.

### Benefits

- Reduce alert fatigue by merging related events.
- Improve accuracy through multi‑source validation.
- Speed response by connecting dots across systems and timelines.

### Challenges

- Data overload and processing cost.
- False relationships from weak rules.
- Format inconsistency demanding heavy normalization.
- Rule maintenance as environments and threats evolve.

With tuning and ML‑assisted correlation, anomaly detection moves from reactive
signals to proactive narratives analysts can act on.
