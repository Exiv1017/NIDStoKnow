## **_Composite Playbooks_**

<card class="mb-8">

<div style="padding:5px; border-radius:12px; max-width:800px; margin:auto; text-align:justify;">

Operating hybrid fusion and governance.

</div>

</card>

<card class="mb-8">

<div style="padding:5px; border-radius:12px; max-width:800px; margin:auto; text-align:justify;">

**Fusion ops**

- Manage thresholds and rules safely.
- Track model and rule versions.

</div>

</card>

<card style="background:#F0FDFA;">

**Controls**

<accordion title="Approvals" open="false">
Change control for both systems and fusion layer.
</accordion>

<accordion title="Audit" open="false">
Audit trails and evidence for decisions.
</accordion>

</card>

<key-points>
- Treat fusion like a product.
- Keep strong controls and history.
</key-points>

<accordion title="Activity — true/false" open="true" class="mb-8">
```activity
{
  "type": "truefalse",
  "questions": [
    { "q": "Fusion changes don’t need approvals.", "ans": false }
  ]
}
```
</accordion>

**Objectives:**

- Understand the key ideas in this lesson
- See one practical example
- Check your understanding

**Tabs:**

- Overview: Placeholder overview for this topic.
- Examples: Placeholder examples relevant to this lesson.
- Pitfalls: Common pitfalls and how to avoid them.

**Steps:**

1. Learn - Read the overview and key ideas.
Playbooks turn hybrid detections into consistent action. Composite playbooks use
both signature context and anomaly strength to choose the right response—fast
when confidence is high, cautious when it’s not.

### Trigger matrix (example)

- Low confidence: create case, add enrichment tasks, watch for correlation.
- Medium confidence: add containment prep (isolate on repeat), notify owner.
- High confidence: block IOC, isolate host/user, open P1 incident, page on‑call.

### Common actions

- Contain: quarantine endpoint, revoke tokens, disable account, block IP/domain.
- Collect: acquire logs, memory, PCAP; snapshot cloud workload; preserve chain
  of custody.
- Coordinate: open ticket, assign responder, set SLOs, notify stakeholders.
- Verify: run detection in validation mode on similar assets to catch spread.

### Guardrails

- Rate limits and blast‑radius controls (per user, host, site).
- Audit everything: who/what/why, including the hybrid decision trace.

### Example

Anomaly flags data exfil volume, signature hits on known C2 domain, and
correlation links VPN login from a new country. The composite playbook:

1) Blocks the domain and cuts the session.
2) Disables the account and opens a P1 with evidence attached.
3) Launches host triage tasks and notifies the incident commander.

### Summary

Design playbooks around hybrid confidence, with safety rails. The best response
is the one you can execute reliably at 3 a.m.

