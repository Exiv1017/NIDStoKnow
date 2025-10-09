## **_Connection to the Previous Lesson_**

In the last module you met IDS at a high level. Now we’ll compare the two core ways IDS make decisions: **signature-based** and **anomaly-based**. This lesson keeps the same format you saw in Module 1 (FlipCards, Expandables, Carousel, Icons) for quick scanning and review.

---

## **_Signature vs Anomaly — At a Glance_**

[[Highlight: tone=indigo title=Two Engines, One Goal]]
Signature-based matching detects what we already know. <br>
Anomaly-based analysis detects what we don’t. <br><br>
In practice, mature programs use both.

---

## **_Core Definitions_**

[[FlipCards]]
Signature-Based | Matches traffic or logs against a database of known patterns (signatures). Fast and precise for known threats.
Anomaly-Based | Learns a baseline of “normal” behavior and flags deviations. Finds unknowns but needs tuning.
Hybrid | Runs both approaches together to balance coverage, precision, and noise.

---

## **_Strengths & Limitations_**

### **Signature-Based — Strengths**

- High accuracy on known threats
- Easy to explain and audit
- Efficient pattern-matching engines

### **Signature-Based — Limitations**

- Blind to novel variants (zero‑day) until rules exist
- Requires constant updates to stay current
- Vulnerable to evasion without proper normalization

### **Anomaly-Based — Strengths**

- Detects unknown/novel behavior
- Adapts to environment changes
- Helps spot insider threats

### **Anomaly-Based — Limitations**

- Higher false positives early on
- Needs training data and tuning
- Typically heavier on compute

---

## **_When to Use Which?_**

1. Use signature-based for fast, deterministic detection of known exploits and malware.
2. Use anomaly-based to surface new tactics, data exfiltration,
  and unusual timing/volume patterns.
3. Use a hybrid: signatures for precision, anomalies for discovery;
  then write new signatures from findings.
4. Iterate continuously: tune anomalies → mint signatures → reduce noise → repeat.

---

## **Media**

Image: [Module 2 Lesson 1 Placeholder](https://placehold.co/960x540?text=Module+2+Lesson+1) | Replace with the final diagram/screenshot for this lesson. | [Source](https://placehold.co)



## **_Quick Comparison_**

| Feature | Signature-Based | Anomaly-Based |
| --- | --- | --- |
| Method | Pattern match vs known rules | Deviations from learned baseline |
| Best For | Known threats, compliance rules | Unknown/emerging threats |
| False Positives | Low (with good rules) | Higher until tuned |
| Maintenance | Frequent rule updates | Ongoing training/tuning |

---

## **Summary**

[[Icons]]
 | Use both for defense‑in‑depth |
 | Signatures = precision and speed |
 | Anomalies = discovery of the unknown |
 | Hybrid = practical, scalable coverage |

Next we dive into how a signature engine actually works end‑to‑end.