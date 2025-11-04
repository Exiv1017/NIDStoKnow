## **_Combined Threshold Governance_**

Alert decisions depend on multiple signals. Governance provides a safe,
transparent way to combine thresholds so you reduce noise without missing real
attacks.

### Why combine thresholds?

- Single thresholds drift or get gamed by attackers.
- Different detectors see different facets of risk.
- A governed combo yields fewer false positives and clearer triage.

### Signals to combine

- Anomaly score (deviation, rarity, peer distance).
- Context risk (asset criticality, user sensitivity, exposure).
- Correlation weight (supporting events within a window).
- Optional signature confidence when available.

### Decision policies

- Conservative: alert if anomaly is very high or multi‑source strong.
- Balanced: alert if anomaly medium + context risk medium, or any very high.
- Aggressive: require multi‑source agreement; escalate on correlated bursts.

### Dynamic adjustment loop

1) Baseline thresholds per policy.
2) Measure precision/recall, volume, MTTR weekly.
3) Adjust thresholds in small deltas based on outcomes.
4) Log changes with reason codes and approvers.

### Example

- Anomaly A1 = 0.55, asset risk R = 0.8, correlation C = 0.6
- Policy: alert if (A1 ≥ 0.5 AND C ≥ 0.5) boosted by R ≥ 0.7
- Result: alert fires with priority raised due to asset risk.

### Governance controls

- Versioned policies, approvals, and rollbacks.
- Observability: show which thresholds triggered (decision trace).
- Guardrails: min/max caps to avoid runaway tuning.

### Summary

Treat thresholds as a product: combine signals, adapt safely, and keep
auditable decisions.
