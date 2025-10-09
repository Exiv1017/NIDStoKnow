## **_Connection to the Previous Lesson_**

You learned the signature pipeline and extended techniques. Now meet the two engines most deployments use: **Snort** and **Suricata** — same compact layout as Module 1.

---

## **_Snort vs Suricata (Quick Take)_**

[[FlipCards]]
Snort | Mature, widely used IDS/IPS from Cisco Talos. Text rules; strong community; ideal for small–mid networks.
Suricata | Modern multi‑threaded IDS/IPS/NSM from OISF. Protocol‑aware parsing; EVE JSON outputs; great at scale.

---

## **_Key Features_**

[[Expandables]]
Snort Highlights | Modes: sniffer, packet logger, IDS/IPS.<br>Rule language with headers + options.<br>Talos updates and large community.
Suricata Highlights | Multi‑threading across cores.<br>Automatic protocol detection on any port.<br>Rich outputs (EVE JSON, Syslog) and SIEM integrations.

---

## **_When to Choose Which?_**

[[Carousel]]
- Prefer Snort for lightweight installs and familiar rule workflows
- Prefer Suricata for high‑throughput, multi‑core sensors and rich telemetry
- Mix both in platforms like Security Onion to combine strengths

---

## **_Example Uses_**

[[Icons]]
 | Snort: alert on SQLi in inbound HTTP |
 | Suricata: export EVE JSON to ELK/Splunk |
 | Security Onion: dashboards from both engines |

Summary: Both rely on signatures; Suricata adds scale and telemetry. Pick per environment — or run both.

---

## **Media**

Image: [Module 3 Lesson 1 Placeholder](https://placehold.co/960x540?text=Snort+vs+Suricata) | Replace with logos/architecture diagram or Security Onion dashboard. | [Source](https://placehold.co)

