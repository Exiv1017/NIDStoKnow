## Signature-Based Detection — Lesson Summary

This module explains how signature-based network intrusion detection works, how it compares to anomaly-based methods, and how modern tools implement, optimize, and evolve it. Use this as a quick study sheet before exams or labs.

### Module 1: Foundations
- 1.1 Basics of Cybersecurity: Security protects confidentiality, integrity, and availability (CIA). Controls are layered (defense in depth) and grouped as preventive, detective, and corrective.
- 1.2 Introduction to IDS: IDS monitors and alerts; IPS blocks. Network IDS (NIDS) observes traffic; Host IDS (HIDS) inspects a single host. IDS is the detective layer in a multi-layer defense.

### Module 2: Detection Principles
- 2.1 Signature vs Anomaly: Signature = pattern match to known threats (high precision on knowns, needs updates). Anomaly = deviations from “normal” (finds unknowns, higher false positives). Hybrid uses both.
- 2.2 Signature Workflow: capture → preprocess/normalize (reassembly, decoding) → pattern matching (exact/regex/Aho–Corasick) → alert/log → update signatures.
- 2.3 Extended Techniques: rule chaining/flowbits, correlation, thresholding/suppression, enrichment (metadata, TI), and automation/SOAR to reduce noise and add context.

### Module 3: IDS Tools & Data Handling
- 3.1 Snort and Suricata: Snort is mature and lightweight; Suricata is multi-threaded with rich protocol awareness and EVE JSON output. Both share rule syntax.
- 3.2 Traffic & Rules: SPAN/TAP capture, decode + reassemble packets, normalize inputs, then apply rule databases (vendor, community, custom). Logs feed SIEM/NSM for visibility.

### Module 4: Application & Evolution
- 4.1 Real-World: Cloud/mobile deployments, custom SQLi rules, SIEM integrations, and AI-assisted rule generation show practical value and ongoing innovation.
- 4.2 Limitations: Reliance on known threats, constant updates, encrypted traffic blind spots, evasion, false positives/negatives, and performance overhead.
- 4.3 Future & Hybrid: Combine signature, anomaly, behavioral analytics, and AI/ML. Use TI and automation to shorten time-to-detect and improve precision.

---

## References

- IBM. What is cybersecurity? IBM Think. https://www.ibm.com/think/topics/cybersecurity
- TechTarget. CIA triad explained. https://www.techtarget.com/whatis/video/An-explanation-of-CIA-triad
- TechTarget. Cybersecurity control types and placement. https://www.techtarget.com/searchsecurity/feature/Types-of-cybersecurity-controls-and-how-to-place-them
- IBM. What is an intrusion detection system (IDS)? https://www.ibm.com/think/topics/intrusion-detection-system
- TechImpact. IPS vs. IDS: why it matters (2023). https://techimpact.org/news/ips-vs-ids-whats-difference-and-why-it-matters
- Cisco Networking Academy. Introduction to cybersecurity. https://www.netacad.com/courses/introduction-to-cybersecurity
- Fidelis Security. Signature-based vs anomaly-based IDS. https://fidelissecurity.com/cybersecurity-101/learn/signature-based-vs-anomaly-based-ids/
- Center for Internet Security (CIS). Signature- vs anomaly-based detection. https://www.cisecurity.org/insights/spotlight/cybersecurity-spotlight-signature-based-vs-anomaly-based-detection
- Corelight. Signature-based detection overview. https://corelight.com/resources/glossary/signature-based-detection
- Fortinet. Signature-based detection (FortiGate 7.4.2 NGFW & ATP Concept Guide). https://docs.fortinet.com/document/fortigate/7.4.2/ngfw-atp-concept-guide/756476/signature-based-detection
- SmallBizEPP. How to use signature-based detection (2024). https://smallbizepp.com/use-signature-based-detection
- DigitalOcean. Understanding Suricata signatures. https://www.digitalocean.com/community/tutorials/understanding-suricata-signatures
- Suricata Documentation. Rules introduction. https://docs.suricata.io/en/latest/rules/intro.html
- OISF. Suricata YAML configuration. https://docs.suricata.io/en/latest/configuration/suricata-yaml.html
- OISF. Suricata User Guide (v3.2.3 PDF). https://media.readthedocs.org/pdf/suricata/suricata-3.2.3/suricata.pdf
- Snort. Snort 3 Rule Writing Guide. https://www.snort.org/documents/snort-3-rule-writing-guide
- Software Engineering Institute (CMU). Suricata Tutorial (2016). https://insights.sei.cmu.edu/documents/3986/2016_017_001_449890.pdf
- Huntress. Real-world Suricata use case. https://www.huntress.com/
- Infosec Institute. Suricata use case: baselining and SIEM. https://www.infosecinstitute.com/
- Stamus Networks. Combining IDS alerts, NSM events and PCAP. https://www.stamus-networks.com/
- ANY.RUN Blog. Detection with Suricata IDS – use case. https://any.run/
- Shah, S. A. R., & Issac, B. (2017). Performance comparison of IDS; ML with Snort. arXiv:1710.04843. https://arxiv.org/pdf/1710.04843
- Erturk, E., & Kumar, M. (2018). New use cases for Snort: Cloud and mobile. https://www.researchgate.net/publication/323003929_New_Use_Cases_for_Snort_Cloud_and_Mobile_Environments
- Prabha, D., & Rao, K. S. (2017). Detecting SQL injection using Snort rules. https://www.researchgate.net/publication/317003621_A_Novel_Approach_for_Detecting_SQL_Injection_Attacks_using_Snort
- Mitra, S., et al. (2025). FALCON: LLMs for IDS rule generation. https://arxiv.org/pdf/2508.18684
- Alooba. Signature-based detection concept. https://www.alooba.com/skills/concepts/intrusion-detection-and-prevention-205/signature-based-detection/
- CTED (CYBBH). Benefits and limitations of signatures. https://cted.cybbh.io/tech-college/cttsb/Computer_Network_Analysis/04_Network_Based_Signature/02_LSA_2%3A_Describe_Benefits_and_Limitations_of_Signatures.html
- Kothamali, P. R., & Banik, S. (2022). Limitations of signature-based detection. https://www.researchgate.net/publication/388494583_Limitations_of_Signature-Based_Threat_Detection
- Medium (2023). Limits of signature-based detection in threat hunting. https://medium.com/%40bappesarker2010/the-limits-of-signature-based-detection-in-threat-hunting-and-how-to-overcome-them-d58d06efa55e
- Pure Storage. What is signature-based intrusion detection? https://www.purestorage.com/knowledge/signature-based-intrusion-detection.html

