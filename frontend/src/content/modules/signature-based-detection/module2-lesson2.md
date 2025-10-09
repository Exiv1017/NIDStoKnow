## **_Connection to the Previous Lesson_**

You compared signature vs anomaly approaches. Now let’s see how a signature engine actually works — from capture to alert — using the same concise block style as Module 1.

---

## **_Signature Pipeline Overview_**

[[Highlight: tone=indigo title=Five Stages]]
Capture → Preprocess → Match → Alert → Update
<br><br>
Everything an IDS does in signature mode fits into this loop.

---

## **_Stages_**

[[Carousel]]
- Capture: mirror/tap traffic (or host logs) so the IDS can see data in motion
- Preprocess: decode, normalize, and reassemble streams and fragments
- Match: run fast pattern engines (fixed strings, PCRE, anchored offsets)
- Alert & Log: emit rule id, severity, src/dst, context to SIEM
- Update: add/tune/remove rules from intel and operations feedback

---

## **_Deep Dive Notes_**

[[Expandables]]
Preprocessing | Fragment/IP reassembly; TCP stream reassembly; protocol parsing (HTTP, DNS, SMTP); normalization (URL decode, whitespace, encodings) to defeat obfuscation
Pattern Engines | Exact match, Aho‑Corasick DFAs, PCRE for flexible payloads; staged filters narrow candidates before heavy checks
Rule Context | Headers (proto, ports, IPs) + options (content, depth, distance), thresholds/suppressions, and correlation via flowbits
Performance | Profile hot rules; reduce overlap; shard rule sets; leverage multi‑threaded engines (e.g., Suricata)

---

## **_Example Walkthrough_**

1) HTTP request arrives via SPAN/TAP. <br>
2) IDS reassembles stream and URL‑decodes payload. <br>
3) Content matches a SQLi pattern (e.g., "UNION SELECT"). <br>
4) Alert logged with rule SID, src/dst, and evidence. <br>
5) Team tunes rule or adds variants after review.

---

## **Summary**

[[Icons]]
 | Preprocess to defeat evasions |
 | Use staged matching for speed |
 | Log rich context for response |
 | Keep rules updated & pruned |

Next: extended workflow techniques that chain rules, enrich alerts, and automate response.

---

## **Media**

Image: [Module 2 Lesson 2 Placeholder](https://placehold.co/960x540?text=Signature+Pipeline) | Swap for a pipeline diagram (capture → preprocess → match → alert → update). | [Source](https://placehold.co)

