## **_Correlation Layers_**

Hybrid detection relies on combining multiple engines and data sources to
uncover both known and unknown threats. Detection alone isn’t enough—analysts
must understand how events connect to form an attack pattern. Correlation
layers link individual alerts, logs, and network events to reveal the complete
story behind a potential incident.

### What is correlation?

Correlation connects events across systems to identify meaningful
relationships that may indicate malicious activity. Instead of analyzing each
signal in isolation, the system relates them by host, user, IP, or time.

Example chain:
- Suspicious login attempt
- A new process starting on the same host
- Unusual outbound traffic immediately after

Individually they may look benign; together they signal a coordinated attack.

### Why it matters in hybrid detection

Hybrid detection combines signature- and anomaly-based outputs. Correlation
layers ensure both engines reinforce each other. If a signature flags a known
attack while anomaly detection reports unusual behavior nearby in time, the
correlation layer links them into a single, higher-confidence event.

### Structure of correlation layers

- Data aggregation: collect alerts/logs from IDS, EDR, firewalls, anomaly
  systems.
- Normalization: convert formats into a common schema for comparison.
- Event linking: match by shared attributes (IP, hostname, user, time).
- Correlation rules/analytics: logical patterns or stats to detect sequences.
  - Example: if an internal host triggers a port scan and unauthorized login
    within 10 minutes, raise a high-priority alert.
- Prioritization: rank by severity so analysts focus on the most critical
  threats first.

### Common correlation layers in practice

- Network: connect traffic logs, packet data, and flows to spot scans or
  lateral movement (e.g., spike in DNS queries then unusual HTTP requests).
- Host: link process behavior, access logs, and system events (e.g., new user
  plus registry edits or privilege escalation).
- Temporal: track when events occur to reveal repeated patterns.
- Behavioral: combine activity patterns to detect stealthy or distributed
  attacks.

### Benefits

- Reduces alert fatigue by merging related events into one case.
- Improves accuracy via multi-source validation.
- Speeds response by connecting signals across systems and timelines.
- Expands visibility across network, endpoint, and user layers.

### Challenges

- Data overload without careful scoping.
- False relationships from poorly tuned rules.
- Format inconsistency requiring strong normalization.
- Ongoing rule maintenance to follow new techniques and topology changes.

### Summary

Correlation layers unify data, identify meaningful patterns, and turn raw
alerts into actionable insights. Strong correlation logic deepens awareness of
attack paths, reduces noise, and improves overall accuracy.

Next: 2.2 Context Enrichment — augment correlated data with metadata and
threat intelligence to add clarity and drive faster triage.<card class="mb-8">

<div style="padding:5px; border-radius:12px; max-width:800px; margin:auto; text-align:justify;">

Fusion architectures: serial vs parallel.

</div>

</card>

<card class="mb-8">

<div style="padding:5px; border-radius:12px; max-width:800px; margin:auto; text-align:justify;">

**Serial**

- Signatures first, anomaly next.
- Filters known-good/known-bad, then score the rest.

</div>

</card>

<card style="background:#F0FDFA;">

**Parallel**

<accordion title="Independent scoring" open="false">
Run both and merge alerts downstream.
</accordion>

<accordion title="Fusion layer" open="false">
Combine scores/labels via logic or learning.
</accordion>

</card>

<key-points>
- Serial reduces volume to anomaly stage.
- Parallel provides redundancy.
</key-points>

<accordion title="Activity — multiple choice" open="true" class="mb-8">
```activity
{
  "type": "mcq",
  "questions": [
    { "q": "Which pipeline runs both at once?", "options": ["Serial", "Parallel", "Neither"], "ans": 1 }
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

**Tip:** Keep evaluation metrics clear.

**Actions:**

- [View docs](https://example.com/docs)
- [Try a demo](https://example.com/demo)

```activity
{
  "type": "mcq",
  "questions": [
    {
      "q": "Placeholder knowledge check?",
      "options": ["A", "B", "C"],
      "ans": 2
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
