## **_Model Routing Strategy_**

“Where should this data go?” Not every event should hit every model. Routing
assigns data to the most suitable detector to keep anomaly systems efficient
and accurate.

### Why routing matters

Without routing, every event passes through every model, wasting compute and
producing redundant alerts. Smart routing:

- Sends events to the best‑fit model (signature, anomaly, correlation).
- Preserves speed at volume.
- Improves precision by avoiding noisy paths.

### How routing works

- Pre‑processing and classification: normalize and tag events (e.g., “login,”
  “web,” “file transfer”).
- Routing layer: assign to model(s):
  - Signature model for known patterns.
  - Anomaly model for unknown, behavior‑based patterns.
  - Correlation model when partial matches appear across sources.
- Fusion and feedback: aggregate results; reinforce agreements; adjust
  policies from outcomes.

### Dynamic/policy‑based routing

- Peak hours: prioritize faster checks (e.g., signatures first).
- Off‑hours: deeper anomaly passes for learning.
- Policies: “If external IP touches critical asset, send to both engines.”

### Example

Repeated access attempts target a finance server. Signatures flag known brute
force; anomaly flags login frequency well beyond baseline. Routing merges
signals into a high‑priority alert.

### Key takeaway

Routing is the conductor: it balances specialization and coordination so each
model does its best work.
