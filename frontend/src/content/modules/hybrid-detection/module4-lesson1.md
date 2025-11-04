<card class="mb-8">

<div style="padding:5px; border-radius:12px; max-width:800px; margin:auto; text-align:justify;">

Deploying hybrid NIDS at scale.

</div>

</card>

<card class="mb-8">

<div style="padding:5px; border-radius:12px; max-width:800px; margin:auto; text-align:justify;">

**Scale**

- Distributed sensors and collectors.
- Multi-queue NICs and CPU pinning.
- Horizontal scaling of fusion layer.

</div>

</card>

<card style="background:#F0FDFA;">

**Reliability**

## **_Unified Alert Flow_**

Hybrid detection becomes useful when its outputs flow through a single,
understandable alert pipeline. This lesson shows how to unify signals into one
incident stream that analysts can trust.

### End‑to‑end flow

1) Ingest: events from signature engine and anomaly engine enter a common bus.
2) Normalize: map fields to a shared schema (src, dst, user, asset, tactic).
3) De‑duplicate: collapse equivalent alerts with stable event IDs.
4) Correlate: stitch related events within time windows and entity graphs.
5) Enrich: add asset criticality, user role, threat intel, geo, and history.
6) Score & route: apply combined thresholds to set priority and owner queue.
7) Notify & track: open/merge incidents in the case system with status SLOs.

### Design patterns

- Idempotency keys to avoid alert storms on retries.
- Sliding windows per entity to group bursts (e.g., 5m by src IP).
- Backpressure and buffering for spikes; shed low‑value telemetry
	first.
- Explicit lineage: store which detections and thresholds produced the alert.

### Example

Port‑scan signature hits 50 times in 2 minutes while anomaly detects rare
east‑west connections. Unified flow correlates them as one “Reconnaissance”
incident, not 51 separate alerts, and routes to the network queue with high
priority due to asset risk.

### Outputs and SLOs

- One incident object with evidence, entities, and decision trace.
- SLOs: alerting latency, de‑duplication rate, merge accuracy, reopen rate.

### Summary

Unify first, then optimize. A clear, consistent alert flow turns hybrid signals
into action.

