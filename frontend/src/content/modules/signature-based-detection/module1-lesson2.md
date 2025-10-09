## **_Connection to the Previous Lesson_**

In the previous lesson, you learned that **cybersecurity** is all about protecting systems, networks, and data from malicious attacks.

But even with strong defenses like firewalls and encryption, threats can still slip through.

So how can organizations detect these intrusions early — before they cause damage?

That’s where **Intrusion Detection Systems (IDS)** come in.

---

## **_What is an Intrusion Detection System (IDS)?_**

An **Intrusion Detection System (IDS)** is a **security solution that monitors network traffic or system activities** to detect suspicious behavior or policy violations.
It acts like a **security camera** for your digital environment — it doesn’t block the threat directly but **alerts administrators** when something unusual happens.

According to **IBM**, IDS plays a crucial role in a layered defense strategy, offering visibility into potential attacks that other tools might miss.

[[Highlight: tone=indigo title=IDS in One Line]]
**IDS = Monitor + Detect + Alert** — monitor activity, detect suspicious patterns, and alert administrators.

---

## **_IDS vs. IPS (Intrusion Prevention System)_**

While **IDS** and **IPS** are closely related, they serve different purposes.

| **Feature**      | **IDS (Intrusion Detection System)**          | **IPS (Intrusion Prevention System)**          |
| ---------------- | --------------------------------------------- | ---------------------------------------------- |
| **Primary Role** | Detects and alerts about suspicious activity  | Detects and actively blocks malicious activity |
| **Action**       | Passive (notifies administrators)             | Active (takes preventive action)               |
| **Placement**    | Out-of-band (monitors network traffic copies) | Inline (sits directly in the data flow)        |
| **Use Case**     | Ideal for analysis and monitoring             | Ideal for automated threat prevention          |

As explained by **TechImpact**, organizations often use both IDS and IPS together for complete visibility and protection — IDS detects the intrusion, and IPS stops it.

[[FlipCards]]
Use IDS | When you need deep visibility and historical analysis without disrupting traffic flow (passive monitoring).
Use IPS | When you must automatically block known threats inline to reduce risk exposure in real time.
Use Both | Pair IDS for visibility and investigation with IPS for prevention — a strong defense-in-depth combo.

---

## **_Types of Intrusion Detection Systems_**

There are two primary types of IDS, depending on where they operate and what they monitor.

[[Expandables]]
Network-based IDS (NIDS) | Monitors network traffic across devices and subnets.<br><br>Detects suspicious packets or unusual data flow.<br><br>Often placed near routers or switches.<br><br>Example: Detecting abnormal port scanning or repeated failed login attempts.
Host-based IDS (HIDS) | Monitors a specific device or host (like a computer or server).<br><br>Analyzes system logs, file integrity, and running processes.<br><br>Example: Detecting unauthorized file changes or malicious scripts running on a host.

Together, **NIDS** provides a broad network view, while **HIDS** offers deep visibility within each endpoint.

---

## **_How IDS Works_**

The operation of an IDS can be summarized into three main steps:

[[Carousel]]
- **Monitoring** — Collects data from network traffic and/or host activity.
- **Analysis** — Uses rules, signatures, heuristics, or ML to identify suspicious behavior.
- **Alerting** — Sends notifications to administrators or downstream systems.

Some IDS solutions integrate **AI or machine learning** to enhance accuracy by identifying anomalies that traditional methods might miss.

---

## **_Importance of IDS in Cybersecurity_**

An IDS is essential because it:

[[Icons]]
 | Early detection of threats |
 | Network visibility into unusual patterns |
 | Compliance support for standards and regulations |
 | Forensic evidence for investigations |

In short, IDS acts as a **watchdog** — always alert, always observing, and always ready to warn when danger appears.

---

## **Summary**

| **Concept** | **Key Idea**                                                |
| ----------- | ----------------------------------------------------------- |
| **IDS**     | Detects and alerts on suspicious activity                   |
| **IPS**     | Detects and blocks malicious activity                       |
| **NIDS**    | Monitors network traffic                                    |
| **HIDS**    | Monitors host activity                                      |
| **Purpose** | Strengthen cybersecurity by providing visibility and alerts |
