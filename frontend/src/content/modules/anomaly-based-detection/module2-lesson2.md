## 2.2 Detection Process Pipeline

Anomaly detection typically flows through a pipeline. Each stage transforms
raw inputs into insights that help identify irregularities.

### Stages

- Data ingestion
  - Collect raw streams from logs, sensors, or monitoring tools.
  - Often large and continuous.

- Preprocessing and cleaning
  - Remove duplicates, fix missing values, standardize formats.
  - Ensure consistent, usable inputs.

- Feature extraction
  - Derive indicators that capture behavior (rates, intervals, averages).
  - Highlight trends and patterns over raw values.

- Model or baseline building
  - Build a reference of expected behavior.
  - Simple (statistics) or complex (ML forecasts or clustering).

- Scoring and evaluation
  - Assign "how unusual" scores to new observations.
  - Flag high score outliers for review.

- Decision and thresholding
  - Compare scores to thresholds (static, dynamic, or seasonal).
  - Crossing the line marks a candidate anomaly.

- Alerting and feedback
  - Trigger alerts and capture analyst feedback.
  - Use outcomes to tune thresholds, features, and models.

### Why a pipeline?

- Modularity: improve one stage without breaking others.
- Adaptability: swap in a new scaler or model as data evolves.
- Governance: clearer audits and change control per stage.

---

## Media

Image:
[Module 2 Lesson 2 Placeholder](https://placehold.co/960x540?text=Detection+Pipeline)

Replace with a diagram showing the pipeline stages above.
