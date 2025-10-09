## 2.3 Machine Learning Overview and Technical Implementation

Machine learning is the "brain" of many anomaly detectors. It learns patterns,
adjusts with new data, and improves over time.

### How ML fits in

- Supervised learning
  - Labeled normal and anomalous examples.
  - Works when known anomaly classes exist (for example, fraud types).
- Unsupervised learning
  - No labels; the model infers structure and flags outliers.
  - Common in cybersecurity with novel threats.
- Semi‑supervised learning
  - Mostly normal data with a few labeled examples for guidance.

Common algorithms include Isolation Forest, Local Outlier Factor (LOF), and
Autoencoders.

### What happens technically

- Data collection
  - Gather from logs, packets, and metrics.
  - Examples: /var/log/auth.log, tcpdump, monitoring time series.
- Feature extraction
  - Compute behavior descriptors (for example, login rate, bytes
    transferred).
- Pattern learning and comparison
  - Fit the baseline and compare live data to learned normal.
  - Large deviation implies a candidate anomaly.
- Alert and response
  - Generate alerts, log evidence, and trigger automated playbooks.

Example alert:

```text
ALERT: Possible SSH Brute Force Detected
Source IP: 192.168.1.12
Attempts: 57 in 60 seconds
Threshold: 10
```

### Real‑world examples

- Command anomaly in a honeypot
  - Normal: ls, cat /var/log/syslog, ping google.com
  - Suspicious sequence: wget payload.sh → chmod +x → ./payload.sh
  - Sequence deviates from baseline; model flags as suspicious.
- Unusual login time
  - Admin typically logs in 08:00–17:00.
  - Event appears at 03:42 and is flagged for review.

### Commonly detected patterns

| Category       | Normal behavior          | Detected anomaly              |
| -------------- | ------------------------ | ----------------------------- |
| Login attempts | < 10 failed per hour     | 50 failed in 5 minutes        |
| File transfer  | ≤ 50 MB per session      | 2 GB transferred unexpectedly |
| CPU usage      | 15–60% average           | Constant 99% load             |
| Web requests   | 100–200 per hour         | 5,000 sudden requests         |
| Command input  | Routine maintenance cmds | Sensitive dirs / root access  |

### A simple Python example (Z‑Score)

```python
import numpy as np

# Sample network traffic data in Mbps
traffic_data = np.array([5, 6, 5.5, 6.2, 5.8, 50])  # Notice the spike

mean = np.mean(traffic_data)
std = np.std(traffic_data)

# Calculate Z-scores
z_scores = [(x - mean) / std for x in traffic_data]

# Flag anomalies where |Z| > 2
for i, score in enumerate(z_scores):
    if abs(score) > 2:
        print(f"Anomaly detected at index {i} with value {traffic_data[i]}")
```

Output:

```text
Anomaly detected at index 5 with value 50.0
```

### Takeaway

ML lets detection go beyond static rules. Each step — data collection,
feature engineering, model fitting, scoring, and alerting — combines into an
adaptive system.

---

## Media

Image:
[Module 2 Lesson 3 Placeholder](https://placehold.co/960x540?text=ML+Overview)

Replace with a model diagram or workflow image.
