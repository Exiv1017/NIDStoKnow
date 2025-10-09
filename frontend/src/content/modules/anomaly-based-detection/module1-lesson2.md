<!-- Module 1 - Lesson 2: Baselining Concepts -->

[[Objectives]]
- Trace the end-to-end anomaly workflow
- Differentiate feature vs raw signal
- Map model choices to data maturity
- Apply feedback to reduce false positives

---

## **Overview**

An effective anomaly pipeline is iterative: ingest → enrich → model → score →
triage → adapt. Each stage compounds quality; weak inputs amplify noise later.

---

## **Core Workflow Stages**

[[DragOrder]]
- Collect & Normalize
- Feature Engineer
- Model / Fit Baseline
- Score & Rank
- Triage & Label
- Retrain / Adapt

[[Highlight: tone=indigo title=Why Feature Engineering?]]
Transforms raw packets/flows into behavior descriptors (ratios, dispersion,
seasonality indices) that separate normal variance from true outliers.

---

## **Model Families**

[[Expandables]]
Statistical Thresholds :: Z-score, EWMA, seasonal decompose – transparent, fast.
Tree / Isolation Methods :: Isolation Forest partitions faster for sparse anomalies.
Density / One-Class :: One-Class SVM, LOF for boundary estimation.
Representation Learning :: Autoencoders learn compressed normal; high
reconstruction error → anomaly.

[[Icons]]
🧹 | Data Hygiene | Drop corrupt / partial logs early.
🧪 | Feature Quality | Prefer stable, explainable metrics over opaque
embeddings at start.
⏱️ | Latency Budget | Real-time scoring constrains model complexity.
♻️ | Feedback Loop | Analyst labels tune thresholds & retraining cadence.

[[Pitfalls]]
- Skipping normalization → scale-dominated distance metrics
- Overfitting early with deep models on thin data
- Ignoring seasonality → cyclic false spikes
- No retrain schedule → drift creep

Mitigation: start statistically simple; promote complexity only when precision plateaus.

---

## **Hands-On Check**

[[Match]]
Stage :: Goal
Feature Engineer :: Derive discriminative metrics
Score & Rank :: Assign anomaly scores & order review
Triage & Label :: Confirm validity & feed back

[[Poll: Biggest early failure source?]]
- Poor feature set
- GPU shortage
- Lack of dashboards
- JSON formatting

[[Reflection: Which existing telemetry source could yield high-signal features
after aggregation?]]

---

## **Quick True/False**

[[FlipCards]]
Normalization reduces scale distortion | True
Adding dozens of weak features always helps | False

---

## **Mini MCQ**

[[Poll: Primary purpose of feedback loop?]]
- Improve feature robustness
- Provide governance docs
- Increase log storage

Answer: Improve feature robustness.

---

## **Key Points**

- Workflow quality compounds; upstream hygiene saves downstream triage time.
- Feature design often outweighs model selection early.
- Scheduled drift evaluation sustains precision.
- Feedback-integrated retraining shrinks false-positive rate.

---

## **Next Lesson**

We examine strengths and limitations and how to sustain model performance over
time.

[[Highlight: tone=indigo title=Glossary Additions]]
New terms in this workflow lesson for quick reference.

**Glossary (Workflow Terms)**
- Normalization: Scaling / transforming raw values so features are comparable in magnitude or distribution.
- Z-score: Standardized value (subtract mean, divide by standard deviation) highlighting distance from average.
- EWMA: Exponentially Weighted Moving Average; smoother giving more weight to recent observations.
- One-Class SVM: Boundary-based algorithm that learns a frontier enclosing normal data points.
- LOF (Local Outlier Factor): Density-based method detecting points in sparse neighborhoods relative to neighbors.
- Ranking: Ordering scored events so analysts review highest risk first.
- Retrain / Adapt: Updating the model or baseline using new labeled or recent period data to counter drift.

---

## **1.2 Baselining Concepts**

### What Is a Baseline
A baseline describes expected behavior: bounds, averages, trends, cycles, and patterns that reflect ordinary operation. New data is judged against this benchmark to see what stands out.

A solid baseline often considers:
- Typical ranges (upper and lower limits)
- Central tendencies (mean, median)
- Cyclical or seasonal patterns (daily, weekly, monthly)
- Context (time of day, category, location)

Baselines must evolve as systems change (usage, load, seasonality).

### Why Baselines Are Crucial
Without a reference for normal behavior, it’s hard to decide what truly qualifies as an anomaly. Baselines help by:
- Providing context for significance vs harmless variation
- Filtering noise within acceptable bounds
- Differentiating meaningful change from problematic deviation

### How Baselines Are Created
Approaches vary with data and domain:
- Statistical: use historical values to define normal ranges (percentiles, z‑scores)
- Predictive: regression, time series, clustering to anticipate expected behavior
- Adaptive: continuously learn and recalibrate the baseline over time

Sliding/rolling windows help capture seasonality and gradual shifts.

### Flagging Anomalies Against the Baseline
New observations are measured against the baseline. If a value falls outside acceptable boundaries, it becomes a candidate anomaly.

Evaluate flags with confusion outcomes:
- True positive: correctly flagged anomaly
- False positive: normal event flagged
- True negative: normal event passed
- False negative: anomaly missed

Aim to maximize correct flags while minimizing both error types.

### Summary
Baselining sits at the heart of anomaly detection. By defining, adapting, and refining “normal,” we detect when behavior strays from the ordinary.

---

## **Media**

Image: [Module 1 Lesson 2 Placeholder](https://placehold.co/960x540?text=Baselines) | Replace with a baseline/envelope diagram. | [Source](https://placehold.co)
