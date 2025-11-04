## **_Composite Playbooks_**

Playbooks turn anomaly detections into consistent action. Composite playbooks
use anomaly confidence and context to choose the right response—fast when
confidence is high, cautious when it’s not.

### Trigger matrix (example)

- Low confidence: create case, add enrichment tasks, watch for correlation.
- Medium confidence: prep containment on repeat, notify owner.
- High confidence: block IOC, isolate host/user, open P1, page on‑call.

### Common actions

- Contain: quarantine endpoint, revoke tokens, disable account, block IP/domain.
- Collect: acquire logs, memory, PCAP; snapshot cloud workload; preserve chain
  of custody.
- Coordinate: open ticket, assign responder, set SLOs, notify stakeholders.
- Verify: run detection in validation mode on similar assets to catch spread.

### Guardrails

- Human‑in‑the‑loop approvals for destructive steps.
- Rate limits and blast‑radius controls.
- Audit everything, including decision traces.

### Example

Anomaly flags data exfil volume; correlation ties a new country VPN login; intel
marks the domain suspicious. The playbook:

1) Blocks the domain and cuts the session.
2) Disables the account and opens a P1 with evidence attached.
3) Launches host triage and notifies incident command.

### Summary

Design playbooks around anomaly confidence and context, with safety rails for
automated steps.
