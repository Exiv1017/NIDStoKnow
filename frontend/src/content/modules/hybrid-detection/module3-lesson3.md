<card class="mb-8">

<div style="padding:5px; border-radius:12px; max-width:800px; margin:auto; text-align:justify;">

Measuring hybrid NIDS effectiveness.

</div>

</card>

<card class="mb-8">

<div style="padding:5px; border-radius:12px; max-width:800px; margin:auto; text-align:justify;">

**Metrics**

- Precision/Recall.
- Alert volume and de-duplication rates.
- Mean time to detect/respond.

</div>

</card>

<card style="background:#F0FDFA;">

**Improvements**

<accordion title="Threshold tuning" open="false">
Adjust fusion thresholds and logic.
</accordion>

<accordion title="Feedback" open="false">
Feed labels back to both systems and fusion layer.
</accordion>

## **_Combined Threshold Governance_**

Alert decisions in hybrid detection depend on multiple signals. Governance gives
you a safe, transparent way to combine thresholds across engines, so you reduce
noise without missing real attacks.

### Why combine thresholds?

- Single thresholds drift or get gamed by attackers.
- Signature and anomaly engines see different facets of risk.
- A governed combo produces fewer false positives and clearer triage.

### Core signals to combine

- Signature confidence score (rule strength, hit context).
- Anomaly score (statistical deviation, rarity, peer distance).
- Context risk (asset criticality, user sensitivity, exposure).
- Correlation weight (supporting events within a window).

### Decision policies

- Conservative: alert if signature is high OR anomaly is very high.
- Balanced: alert if (signature medium AND anomaly medium) OR any very high.
- Aggressive: require multi‑source agreement for most alerts; escalate on
  correlated bursts.

### Dynamic adjustment loop

1) Start with baseline thresholds per policy.
2) Measure precision/recall, volume, MTTR weekly.
3) Shift thresholds up/down by small deltas based on outcomes.
4) Log changes with reason codes and approver.

### Example

- Signature S1 = 0.6, Anomaly A1 = 0.55, Asset risk R = 0.8
- Policy: alert if (S1 ≥ 0.6 AND A1 ≥ 0.5) boosted by R ≥ 0.7
- Result: Alert fires with priority raised one level due to asset risk.

### Governance controls

- Versioned policies, change approvals, and rollbacks.
- Observability: show which thresholds triggered and why (decision trace).
- Guardrails: min/max caps to avoid runaway tuning.

### Summary

Treat thresholds as a product: combine multiple signals, adapt safely, and keep
auditable decisions.
    {
