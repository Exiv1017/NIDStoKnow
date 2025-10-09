<!-- Module 2 - Lesson 1: How It Works -->

[[Objectives]]
- Identify high-signal network features
- Distinguish raw vs engineered metrics
- Map model choice to data shape
- Apply robust statistics early

---

## **Why Features Matter**
Better features shrink the search space: they encode structure (ratios, dispersion, categorical frequencies) so models focus on real deviation not raw volume swings.

---

## **Feature Categories**

[[FlipCards]]
Volume Metrics | Bytes, packets, flow duration
Composition | Protocol / service frequency distribution
Ratios & Derivatives | Bytes/packet, inbound/outbound skew
Temporal Patterns | Inter-arrival variance, burstiness index
Entity Relationships | Peer count, unique ports per host

[[Highlight: tone=indigo title=Robust Stats]]
Median + MAD (median absolute deviation) tolerate heavy tails better than mean + std for network data.

---

## **Model Options**

[[Expandables]]
Histogram / Quantile :: Non-parametric, interpretable boundary estimation.
Robust Z / MAD Scores :: Scale-invariant anomaly scoring.
Isolation Forest :: Fast isolation through random partitioning.
Clustering (DBSCAN) :: Density-based; flags sparse points.
Autoencoder :: Learns compressed representation; high recon error → anomaly.

[[Highlight: tone=indigo title=When to Add Complexity]]
Escalate from robust statistics to tree / clustering when precision plateaus and remaining false positives share feature patterns a richer model could separate.

[[Icons]]
🧪 | Iterate Simply | Start statistical; justify ML complexity later.
🧮 | Dimensionality | Avoid flooding early models with noisy fields.
🔍 | Interpretability | Eases analyst adoption & threshold tuning.
⚙️ | Maintainability | Favor methods needing fewer retune knobs.

[[Pitfalls]]
- Overloading with redundant correlated metrics
- Skipping scaling/normalization where required
- Chasing deep models before baseline stability

Mitigation: baseline with robust stats, measure precision, then graduate complexity.

---

## **Activity**

[[Poll: Which is a robust dispersion measure?]]
- Standard Deviation
- Median Absolute Deviation
- Range

Answer: Median Absolute Deviation.

[[Match]]
Need :: Example Feature
Detect burstiness :: Inter-arrival variance
Detect lateral spread :: Unique peers per host
Detect data exfil ratio spike :: Outbound/inbound byte skew

[[Scenario: Sudden Lateral Movement Pattern]]
Within 15 minutes a host shows a 8× spike in unique peer connections and elevated outbound/inbound byte ratio but stable packet size distribution. How would feature attribution help decide if this is a scan or legitimate service discovery?

[[Reflection: Which existing feature in your environment is most fragile to drift and why?]]

[[Glossary]]
Median :: Middle value of sorted distribution (robust center).
MAD :: Median absolute deviation; robust spread estimator.
Heavy Tail :: Distribution with higher probability of extreme values than Gaussian.
Robust Z :: (Value - Median) / (1.4826 * MAD) scaling for heavy-tailed data.
Feature Drift :: Change in the statistical properties of a feature over time.
Inter-arrival Variance :: Variability in time gaps between consecutive events/packets.

---

## **Mini Check**

[[FlipCards]]
Median+MAD over mean+std for heavy tails | True
More features always increase signal | False

---

## **Key Points**
- Feature quality > model sophistication early.
- Robust statistics tame heavy-tailed distributions.
- Interpretability accelerates tuning cycles.
- Gradual complexity scaling preserves trust.

---

## **Next Lesson**
We focus on scoring strategies and threshold design.

## 2.1 How It Works

Think of anomaly detection as a system that learns the usual rhythm of data
and notices when something feels “off.”

### Basic flow

- Learning the normal behavior: observe historical data to understand
	patterns, averages, and variations.
- Monitoring new data: compare incoming observations to the learned
	baseline.
- Measuring deviations: quantify distance from normal (statistical distances,
	probability scores, or density measures).
- Flagging anomalies: mark values far outside normal bounds.
- Refining the model: adjust to feedback; incorporate new patterns; keep
	“normal” up to date.

Through this cycle, anomaly detection adapts, separating harmless
fluctuations from meaningful deviations.

---

## Media

Image: [Module 2 Lesson 1 Placeholder](https://placehold.co/960x540?text=How+It+Works)
| Replace with a simple loop diagram. | [Source](https://placehold.co)
