## **_Hybrid Detection — Lesson Summary_**

Hybrid detection combines signature, anomaly, and behavior analytics so you can
catch both known and unknown threats with more context and lower noise.

### Module 1: Foundations

- Why hybrid: signatures are precise for known threats; anomalies surface novel
	activity; behavior analytics adds sequence and context.
- Defense-in-depth mapping: preventive + detective + corrective, with
	cross-signal correlation.

### Module 2: Design Principles

- Multi-stage pipeline: ingest → normalize → signature pass → anomaly scoring →
	behavior/correlation → risk scoring → alert.
- Policy: route high-confidence signature hits immediately; gate noisy anomaly
	alerts through correlation and thresholds.

### Module 3: Tools & Data Handling

- Engines: Snort/Suricata for signature; SIEM/NSM for correlation; ML services
	for anomaly.
- Artifacts: EVE JSON, PCAP, NetFlow; enrich with threat intel and asset
	context.

### Module 4: Application & Evolution

- Use cases: phishing → C2 beaconing → lateral movement; exfiltration spikes
	after privilege escalation.
- AI assistance: LLMs can help generate or tune rules and triage alerts; still
	requires human review.
- KPIs: precision/recall, MTTD/MTTR, alerts per analyst, coverage of critical
	assets.

---

## **_References_**

- Faddom (2025, July 20). AI Anomaly Detection: How it works, use cases and
	best practices.
	[Link](https://faddom.com/ai-anomaly-detection-how-it-works-use-cases-and-best-practices/)
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
	challenges.
	[Link](https://onix-systems.com/blog/anomaly-detection-in-machine-learning)
- ResearchGate. Advantages and disadvantages of common anomaly detection
	methods.
	[Link](https://www.researchgate.net/figure/Advantages-and-disadvantages-of-common-anomaly-detection-methods_tbl1_366890364)
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
