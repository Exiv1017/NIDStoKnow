## **_Unified Alert Flow_**

Anomaly detections are most useful when they feed a single, understandable
alert pipeline. Unify signals into one incident stream analysts can trust.

### End‑to‑end flow

1) Ingest: anomalies and related alerts enter a common bus.
2) Normalize: shared schema (src, dst, user, asset, tactic).
3) De‑duplicate: collapse equivalent alerts with stable IDs.
4) Correlate: stitch events in windows and entity graphs.
5) Enrich: add asset criticality, user role, intel, geo, history.
6) Score & route: combined thresholds set priority and owner.
7) Notify & track: open/merge incidents with SLOs.

### Design patterns

- Idempotency keys to avoid alert storms on retries.
- Sliding windows to group bursts (e.g., 5m by src IP).
- Backpressure and buffering for spikes; shed low‑value telemetry
  first.
- Explicit lineage: store which detections and thresholds produced it.

### Example

Port‑scan anomalies spike while rare east‑west connections appear. Unified
flow correlates into one “Reconnaissance” incident and routes to the network
queue with higher priority on critical assets.

### Outputs and SLOs

- One incident object with evidence, entities, and decision trace.
- SLOs: alerting latency, de‑dup rate, merge accuracy, reopen rate.

### Summary

Unify first, then optimize. A clear alert flow turns anomaly signals into
action.
