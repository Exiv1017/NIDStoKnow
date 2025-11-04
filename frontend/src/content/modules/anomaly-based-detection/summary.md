## **_Anomaly-Based Detection — Lesson Summary_**

This module introduces anomaly-based intrusion detection: learn what “normal”
looks like and flag deviations that may indicate attacks, mistakes, or insider
misuse.

### Module 1: Foundations

- Role in layered defense: complements preventive controls and signature IDS by
	catching unknowns.
- Baselines: profile normal hosts, users, services, times, and volumes.

### Module 2: Detection Principles

- Approaches: statistical thresholds, time-series models, clustering,
	supervised/unsupervised ML.
- Features: volume (bytes/flows), failed-login ratios, novelty of destinations,
	entropy, periodicity.
- Tuning: windows, seasonality (work hours), per-entity models to lower false
	positives.

### Module 3: Tools & Data Handling

- Data sources: NetFlow/PCAP, DNS/HTTP logs, host logs, auth events.
- Pipelines: collect → normalize → feature engineering → train/update → score →
	alert.
- Outputs: confidence scores and context (who/what/where/when) to SIEM/NSM.

### Module 4: Application & Evolution

- Use cases: exfiltration spikes, unusual geolocation logins, lateral movement,
	beaconing.
- Limitations: cold-start, drift, and false positives; needs feedback loops and
	retraining.
- Best results: operate alongside signature IDS and behavior rules (hybrid).

---

## **_References_**

- Faddom (2025, July 20). AI Anomaly Detection: How it works, use cases and best
	practices. [Link](https://faddom.com/ai-anomaly-detection-how-it-works-use-cases-and-best-practices/)
- Al-Shammari, A., & Al-Wesabi, F. (2021). A survey on anomaly detection
	techniques in network traffic. Journal of Computer Networks and
	Communications.
- Boosty Labs. Anomaly detection with machine learning.
	[Link](https://boostylabs.com/ml/anomaly-detection)
- Deep learning advancements in anomaly detection (2025, March 17). arXiv.
	[Link](https://arxiv.org/html/2503.13195v1)
- Elastic. Anomaly detection in Elastic Stack.
	[Link](https://www.elastic.co/guide/en/machine-learning/current/ml-ad-overview.html)
- Foorthuis, R. (2021). A typology of data anomalies [Preprint]. arXiv.
	[Link](https://arxiv.org/abs/2107.01615)
- Foundation models for anomaly detection: Vision and challenges (2025, Feb 10).
	arXiv. [Link](https://arxiv.org/abs/2502.06911)
- Large language models for forecasting and anomaly detection: A systematic
	literature review (2024, Feb 15). arXiv.
	[Link](https://arxiv.org/abs/2402.10350)
- Onix Systems. Anomaly detection in machine learning: Benefits & key
	challenges. [Link](https://onix-systems.com/blog/anomaly-detection-in-machine-learning)
- ResearchGate. Advantages and disadvantages of common anomaly detection
	methods. [Link](https://www.researchgate.net/figure/Advantages-and-disadvantages-of-common-anomaly-detection-methods_tbl1_366890364)
- Revefi. 5 data anomalies detection practices for enterprises.
	[Link](https://www.revefi.com/blog/5-data-anomalies-anomaly-detection)
- RoboticsBiz. Six anomaly detection techniques – Pros and cons.
	[Link](https://roboticsbiz.com/six-anomaly-detection-techniques-pros-and-cons/)
- Scikit-learn. Anomaly detection algorithms.
	[Link](https://scikit-learn.org/stable/modules/outlier_detection.html)
- TechTarget. Anomaly detection (SearchEnterpriseAI).
	[Link](https://www.techtarget.com/searchenterpriseai/definition/anomaly-detection)
- Tomomi Research (2025, June 10). Time series anomaly detection: Evolution
	over the last decade.
	[Link](https://www.tomomi-research.com/en/archives/3877)
