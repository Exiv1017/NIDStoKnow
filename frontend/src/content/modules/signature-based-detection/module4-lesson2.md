## **_Connection to the Previous Lesson_**

You saw real deployments. Now capture the practical limits of signature‑based NIDS — in the same compact format.

---

## **_Limitations_**

[[Expandables]]
Known‑Only Coverage | Detects cataloged threats; zero‑days and fresh variants slip by until rules exist.
Constant Upkeep | Rules need continuous updates, testing, and pruning to stay accurate and fast.
Encrypted Traffic | Payloads inside TLS/VPN are opaque unless decrypted — with privacy and performance trade‑offs.
Evasions | Obfuscation, encoding, fragmentation beat naïve matching without good normalization.
Alert Quality | Loose rules cause false positives; overly narrow rules miss variants.
Behavior Blind Spots | Lateral movement and staged campaigns lack a single “signature.”
Performance | Huge rule sets increase CPU/RAM; high‑speed links amplify costs.

---

## **_What To Do About It_**

[[Icons]]
 | Pair signatures with anomaly/behavior analytics |
 | Maintain rule hygiene (profile, dedupe, retire) |
 | Use normalization/reassembly to defeat evasions |
 | Segment rule packs by zone/criticality |

Summary: Signatures are essential but partial — plan for hybrid coverage.

---

## **Media**

Image: [Module 4 Lesson 2 Placeholder](https://placehold.co/960x540?text=Limitations)
| Replace with a pros/cons visual or coverage diagram. | [Source](https://placehold.co)

