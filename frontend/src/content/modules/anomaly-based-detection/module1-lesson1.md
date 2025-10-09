<!-- Anomaly Module 1 - Lesson 1: Foundations of Anomaly Detection -->

## 1.1 Introduction to Anomaly Detection

Most of the time, systems behave as expected: values fall in familiar ranges, patterns repeat, and processes remain steady. Sometimes a value jumps, a pattern breaks, or an outlier emerges. That “something odd” is an anomaly.

Anomaly detection uncovers these unexpected deviations. It draws attention to rare events that diverge from normal behavior. Deviations may be benign or signal errors, failures, malicious activity, or new opportunities.

### Key ideas to remember
- You need a baseline: a model of what “normal” looks like.
- New observations are compared to the baseline; large deviations get flagged.
- Because environments evolve, the definition of “normal” must adapt.
- Applications include fraud detection, equipment fault detection, network intrusion detection, and patient monitoring.

In short, anomaly detection helps systems notice the “unusual” in a sea of “usual.”

---

## Media

Image: [Module 1 Lesson 1 Placeholder](https://placehold.co/960x540?text=Anomaly+Detection) | Replace with a conceptual normal-vs-anomaly diagram. | [Source](https://placehold.co)

---

## **Why This Matters**

Anomaly-based detection flips the signature model: instead of enumerating known
bad, we define and continuously refine what "normal" looks like. Anything
sufficiently distant from that behavioral envelope becomes a candidate signal.

---

## **Defining Anomalies**

[[FlipCards]]
Point Anomaly | Single observation far from baseline distribution
Contextual Anomaly | Normal in general, abnormal in a specific context (time /
user / zone)
Collective Anomaly | Group / sequence whose combined pattern is abnormal even
if individual points look normal
Concept Drift | Shift in underlying data relationships over time
Data Quality Issue | Outliers / gaps caused by logging or pipeline faults—not
real behavior change

[[Highlight: tone=indigo title=Baseline Essentials]]
Your baseline captures seasonality, workload rhythm, protocol mix, and entity
relationships. A thin or biased baseline = inflated false positives or missed
subtle attacks.

---

## **Baseline Construction Workflow**

- Collect & Normalize Data
- Feature Engineering
- Train / Fit Baseline
- Score New Observations
- Triage & Feedback
- Adapt / Retrain

[[Icons]]
🧪 | Feature Richness | Granular protocol / flow stats raise discriminatory
power.
📊 | Seasonality Modeling | Captures weekday vs weekend or business hour
variance.
🧹 | Data Hygiene | Removes corrupt / truncated records before model ingest.
♻️ | Feedback Loop | Analyst dispositions feed threshold & model updates.

---

## **Model & Technique Examples**
[[Expandables]]
Statistical (Z-score / EWMA) :: Lightweight, transparent thresholds – first
iteration.
Clustering (k-means / DBSCAN) :: Groups behavioral cohorts; outliers flagged.
Isolation Forest :: Random partitioning isolates anomalies faster (high anomaly
score).
Autoencoder (Reconstruction Error) :: Neural net learns compression of normal;
high reconstruction error → anomaly.

- Feature explosion (too many low-value metrics)

Mitigation: institute a retrain + evaluation cadence (weekly / monthly) with

---

## **Quick Interaction**

[[Poll: Which factor most often inflates anomaly false positives?]]
- Poor baseline quality
- Lack of GPU resources
---

## **Knowledge Checks**

[[Match]]
Point Anomaly :: Single value far outside expected range
Contextual Anomaly :: Abnormal relative to time / peer group
Collective Anomaly :: Sequence pattern abnormal in aggregate
Concept Drift :: Gradual change in statistical properties

[[Scenario: Sudden Night Traffic Surge]]
At 02:00 a 15× spike in internal DB queries occurs from an app server cluster;
CPU & deploy logs show no release. What dimensions would you inspect before
escalation?

---

## **Key Points**
- Anomaly detection models normal rather than enumerating bad.
- Baseline fidelity (coverage + cleanliness) determines usefulness.
- Continuous feedback reduces noise & sharpens thresholds.
- Technique choice evolves (start simple → iterate to ML if needed).

[[Highlight: tone=indigo title=Baseline Quality Levers]]
Improve representativeness by expanding entity diversity, extending temporal coverage, and cleansing ingest gaps before model fit.

[[FlipCards]]
High False Positives | Often baseline gap or missing seasonality
Silent False Negatives | Over-generalized model or contaminated training
Spiky Score Volatility | Unstable features or insufficient smoothing
Plateaued Precision | Time to refine features, not necessarily add deep model

[[Scenario: Mixed Workload Shift]]
Daytime traffic mix shifts as a new microservice rolls out doubling API calls but reducing DB queries. Model flags reduced DB usage as anomaly. How do you decide if this is drift or expected change?

[[Match]]
Observation :: Interpretation Aid
Reduced DB Queries :: New caching layer? Release notes
Increased API Calls :: Rollout / deployment logs
Stable Error Rates :: Likely benign architectural shift
Concurrent Latency Spike :: Potential performance regression

[[Pitfalls]]
- Promoting a baseline fit during partial rollout window
- Ignoring release calendar when investigating shifts

Mitigation: align baseline retrain windows with stable post-release periods.

---

## **Mini Quiz**

[[Poll: Which is NOT a common anomaly type?]]
- Point
- Collective
- Deterministic

Answer: Deterministic.

[[Reflection: What metric would you add to strengthen this lesson's baseline validation process?]]

---

## **Next Lesson**

We dive deeper into the operational workflow: data preparation and feature engineering.

[[Highlight: tone=indigo title=Glossary Starter]]
Below are quick student-friendly definitions for new terms. A richer consolidated glossary will appear across the module as we proceed.

[[Highlight: tone=indigo title=How to Read Glossary Tags]]
Anywhere you see a bracketed term like [[Baseline]] or [[Drift]] it denotes a glossary-enabled concept—hover or focus to reveal its definition if the UI supports inline glossary.

**Glossary (Core Terms Introduced Here)**
- Baseline: Statistical snapshot of "normal" behavior used for comparison.
- Feature Engineering: Crafting measurable attributes from raw traffic/logs that expose behavioral differences.
- Concept Drift: Gradual change in underlying data distribution that can degrade model accuracy.
- Feedback Loop: Process where analyst validations update thresholds, features, or retraining cadence.
- Isolation Forest: Tree-based algorithm that isolates anomalies via random partitioning; fewer splits = more anomalous.
- Autoencoder: Neural network trained to reconstruct normal data; reconstruction error becomes an anomaly score.
- Seasonality: Repeating temporal patterns (hourly, daily, weekly) important for contextual anomalies.

