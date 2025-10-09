<!-- Module 1 - Lesson 3: Data Quality & Preparation -->

[[Objectives]]
- Articulate strengths of anomaly detection
- Recognize inherent limitations
- Plan feedback + drift governance
- Weigh ROI vs tuning cost

---

## **Context**
Anomaly detection excels at surfacing unknowns but trades operational overhead in tuning, drift maintenance, and triage load.

---

## **Strengths vs Limitations**

[[FlipCards]]
Novel Pattern Discovery | Finds behaviors with no prior signature
Environment Adaptivity | Learns local baselines
Baseline Dependency | Weak coverage inflates false positives
Operational Overhead | Continuous tuning & feedback needed

[[Highlight: tone=indigo title=Risk of Alert Fatigue]]
High false-positive volume erodes analyst trust; structured feedback loops reduce noise over iterations.

---

## **Operational Considerations**

[[Expandables]]
Feedback Loop :: Analyst dispositions adjust thresholds & feature weights.
Concept Drift :: Monitor statistical shift; schedule evaluation windows.
Retrain Strategy :: Time-based (weekly) or trigger-based (drift score).
Explainability :: Simpler models early enable trust + faster tuning.

[[Icons]]
⚖️ | Balance | Avoid over-tuning to last incident.
📉 | Drift Metrics | Track population mean/variance shift.
🛠️ | Tooling | Provide quick label UI for analysts.
📚 | Knowledge Capture | Document resolved anomaly classes.

[[Pitfalls]]
- Reactively adjusting thresholds after every noisy burst
- Ignoring silent drift (gradual baseline shift) until precision collapses
- Deploying complex models with no interpretability path

Mitigation: instrument precision/recall, track drift indicators, maintain lightweight labeling workflow.

---

## **Reflection**

[[Reflection: Where would anomaly detection add the most value in your environment?]]

---

## **Quick Check**

[[Poll: Most common early failure mode?]]
- Poor baseline coverage
- Lack of GPUs
- Encrypted traffic presence

Answer: Poor baseline coverage.

[[Match]]
Challenge :: Stabilizer
High False Positives :: Feedback loop + feature pruning
Drift Accumulation :: Scheduled evaluation + retrain
Opaque Decisions :: Prefer interpretable scores early

---

## **Key Points**
- Strength = novel detection; cost = tuning + triage.
- Drift handling is not optional—plan measurement.
- Progressive complexity beats premature ML depth.
- Trust grows with explainable scoring + feedback cadence.

---

## **Next Module**
We transition into model selection depth and evaluation metrics.
