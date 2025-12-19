## **_Model Routing Strategy_**

Hybrid systems process thousands of logs, alerts, and packet streams. Not
every event belongs in the same analysis path. Model routing distributes data
to the most suitable detection models to maximize accuracy and efficiency.

### Why model routing matters

Without routing, every event might pass through every model, wasting compute
and generating redundant alerts. Good routing ensures:
- Events go to the most appropriate model.
- Resources are used efficiently.
- The system maintains both speed and accuracy.

### How routing works

Three common layers:
- Pre‑processing & classification: normalize and tag events (web traffic,
  login, file transfer) to decide fit for signature, anomaly, or hybrid.
- Routing: assign to model(s).
  - Signature model for known attack patterns (Snort/Suricata).
  - Anomaly model for behavior that doesn’t match signatures.
  - Correlation model for partial matches across systems.
  Policies can adapt dynamically by load or recent results.
- Fusion & feedback: aggregate results, check overlap, reinforce detections,
  and feed learning back into routing policies.

### Example

Repeated access attempts to a finance server:
- Signature model flags known brute‑force IP.
- Anomaly model notes login frequency beyond baseline.
- Routing merges both as a high‑priority hybrid alert.

### Dynamic and policy‑based routing

- Peak hours: prioritize fast signature checks.
- Off hours: route more to anomaly for deeper learning.
- Policy examples: “External IP touching a critical asset → send to both
  engines.”

### Benefits

- Efficiency and scalability.
- Higher accuracy via specialization.
- Better collaboration: engines reinforce each other.

### Key takeaway

Routing is the decision‑making backbone of hybrid detection. It directs events
to the right models so the system stays fast, adaptive, and confident.<card class="mb-8">

<div style="padding:5px; border-radius:12px; max-width:800px; margin:auto; text-align:justify;">

Performance and scalability for hybrid pipelines.

</div>

</card>

<card class="mb-8">

<div style="padding:5px; border-radius:12px; max-width:800px; margin:auto; text-align:justify;">

**Performance**

- Optimize hot signature rules.
- Scale anomaly scoring horizontally.

</div>

</card>

<card style="background:#F0FDFA;">

**Scalability**

<accordion title="Data path" open="false">
Use parallelism and shard by flow/session.
</accordion>

<accordion title="Control path" open="false">
Rate-limit updates and batch reconfigurations.
</accordion>

</card>

<key-points>
- Profile both signature and anomaly stages.
- Avoid single-threaded bottlenecks.
</key-points>

<accordion title="Activity — true/false" open="true" class="mb-8">
```activity
{
  "type": "truefalse",
  "questions": [
    { "q": "Horizontal scaling helps anomaly scoring throughput.", "ans": true }
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
2. Apply - Try a simple exercise or scenario.
3. Verify - Check your understanding.

<!-- placeholder image removed -->

**Note:** Keep operations simple before scaling.

**Actions:**

- [View docs](https://example.com/docs)
- [Try a demo](https://example.com/demo)

```activity
{
  "type": "mcq",
  "questions": [
    {
      "q": "Placeholder knowledge check?",
      "options": ["True", "False"],
      "ans": 0
    }
  ]
}
```

**Timeline:**

- T-0 | Learn | Read the lesson highlights
- T+10m | Apply | Do a small practice
- T+15m | Review | Take the check

**Checklist:**

- I understand the definitions
- I can cite a real example
- I can avoid common pitfalls

**Glossary:**

- Term: Short definition here.

**Resources:**

- [Primary reference](https://example.com/reference)
- [Related reading](https://example.com/related)

**Video:** [Watch](https://www.youtube.com/embed/VIDEO_ID)
