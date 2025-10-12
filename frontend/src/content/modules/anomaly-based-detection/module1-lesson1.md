## 1.1 Introduction to Anomaly Detection

Imagine you’re monitoring a system, perhaps server logs, financial transactions, or health metrics. Most of the time, everything behaves as expected: values fall in familiar ranges, patterns repeat, and processes remain steady. But every so often, something shifts, a value jumps, a pattern breaks, or an outlier emerges. That “something odd” is what we call an anomaly.

Anomaly detection is the process of uncovering these unexpected deviations in data. It helps us draw attention to rare events that diverge from what we consider normal behavior. These deviations might be benign or they might hint at significant changes — such as errors, failures, malicious activity, or novel opportunities.

---

## **_Key ideas to remember_**
- To spot abnormalities, we first need a baseline: a model or understanding of what “normal” looks like.
- Once that baseline is defined, new observations are compared against it. Deviations beyond acceptable limits get flagged as anomalies.
- Because data and systems evolve, definitions of “normal” need to adjust over time.
- Various real-world applications rely on anomaly detection: fraud detection in finance, fault detection in equipment, intrusion detection in networks, patient monitoring in healthcare, and more.

[[Highlight: tone=indigo title=Why this matters]]
In short, anomaly detection equips systems to notice the “unusual” in a sea of “usual.”

[[FlipCards]]
Baseline | A definition of expected behavior used for comparison
Deviation | A measurable difference from the baseline
Anomaly | A significant deviation worth investigating
