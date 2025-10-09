## 3.3 Limitations and Risks

Anomaly detection is powerful, but it is not a silver bullet. Knowing its
limits helps you design safer systems and set realistic expectations.

### Common limitations

- False positives and alert fatigue
  - Sensitive thresholds can overwhelm analysts with benign anomalies.

- Data quality dependency
  - Missing or inconsistent fields degrade feature stability and scores.

- Drift sensitivity
  - Natural changes in behavior can look anomalous without context.

- Interpretability gaps
  - Complex models can be hard to explain during triage.

- Cold start and warm‑up time
  - Baselines need representative history to stabilize.

- Cost and latency
  - Feature pipelines and models add compute and operational overhead.

- Adversarial adaptation
  - Attackers can shape traffic to hug the baseline and evade detection.

### Risks to manage

- Feedback loops gone wrong
  - Poor or inconsistent labels can steer retrains in the wrong direction.

- Over‑automation
  - Suppression rules that are too broad can hide new attack variants.

- Overfitting to a short window
  - Models tuned on narrow periods fail under seasonality.

- Single‑model reliance
  - One method rarely covers all anomaly types or contexts.

- Privacy and compliance constraints
  - Some telemetry cannot be retained or combined without safeguards.

### Mitigations at a glance

| Risk                  | Mitigation                                  |
| --------------------- | ------------------------------------------- |
| Alert fatigue         | Tune for precision first, then expand       |
| Data quality issues   | Validation, schemas, feature hygiene        |
| Drift sensitivity     | Drift dashboards and staged retune/retrain  |
| Interpretability      | Simple features and top contributors        |
| Cold start            | Seed with history and run in shadow mode    |
| Over‑automation       | Expiring rules and regular audits           |
| Single‑model reliance | Hybrid or ensemble approaches               |

### Takeaway

Treat anomaly detection as one layer in a defense‑in‑depth strategy. Pair it
with signatures, heuristics, and human context to reduce blind spots and keep
noise under control.

---

## Media

Image:
[Module 3 Lesson 3 Placeholder](https://placehold.co/960x540?text=Limitations+%26+Risks)

Replace with a concise risks vs mitigations graphic.
