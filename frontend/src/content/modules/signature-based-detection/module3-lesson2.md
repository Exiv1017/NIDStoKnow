## **Module 3.2 — Traffic Capture & Rule Databases**

### **Introduction**

Intrusion Detection Systems (IDS) rely on their ability to **capture and analyze network traffic** in real time. The heart of this process lies in how data packets are collected, processed, and compared with predefined **signature rules** that describe known attack patterns.
Tools such as **Snort** and **Suricata** use these mechanisms to detect threats effectively and maintain network security.

---

### **1. Traffic Capture: The First Step**

Traffic capture is the initial stage where the IDS monitors packets traveling through the network.

* **Packet sniffing:** IDS sensors use packet-sniffing techniques to intercept traffic from network interfaces.
* **Data mirroring:** On switches or routers, **port mirroring (SPAN)** or **network taps** send a copy of network traffic to the IDS.
* **Live inspection:** The IDS examines headers and payloads from the packets in real time without affecting normal transmission.

**Example:**
Snort uses *libpcap* to capture live traffic, while Suricata supports *AF_PACKET* and *NFQUEUE* modes for high-performance packet capture.

---

### **2. Preprocessing and Normalization**

Once packets are captured, the IDS preprocesses the data to ensure accurate analysis:

* **Decoding:** Each packet is broken down into protocol layers (Ethernet, IP, TCP/UDP, etc.).
* **Reassembly:** IDS reassembles fragmented packets to detect attacks that span multiple packets.
* **Normalization:** Adjusts and cleans traffic to maintain consistency, preventing evasion techniques such as packet fragmentation or encoding manipulation.

This step ensures that the IDS views network traffic the same way an attacker intends, improving detection accuracy.

---

### **3. Rule Databases and Signature Matching**

After preprocessing, packets are compared against **rule databases**, which store known threat patterns or behaviors.

#### **Rule Structure**

Rules describe what to look for in network traffic and what action to take when a match occurs.
A typical rule includes:

* **Header:** Defines protocol, IP addresses, and ports.
* **Options:** Specify the payload content to match and the alert message.
* **Actions:** Determine what the IDS should do (e.g., alert, log, or drop the packet).

**Example (Snort rule):**

```
alert tcp any any -> 192.168.1.10 80 (msg:"Possible web attack"; content:"cmd.exe"; sid:1000001;)
```

This rule alerts the system if any TCP packet headed for port 80 contains the string “cmd.exe” — a common signature for command injection attempts.

#### **Rule Sources**

* **Community rules:** Free and maintained by open-source contributors.
* **Vendor rules:** Provided by organizations like Talos (Snort) or Emerging Threats (Suricata).
* **Custom rules:** Written by administrators for unique environments.

---

### **4. Detection and Logging**

When a packet matches a rule:

* The IDS **triggers an alert** and logs details such as source/destination IP, timestamp, and matched rule ID.
* The log data is stored locally or sent to a centralized database or SIEM (Security Information and Event Management) platform for visualization and analysis.
* Suricata, for example, exports structured **EVE JSON logs** compatible with tools like Elasticsearch and Kibana for real-time dashboards.

---

## **_Connection to the Previous Lesson_**

You compared engines; now focus on two pillars: traffic capture and rule databases — formatted like Module 1 for quick scan.

---

## **_Traffic Capture_**

[[FlipCards]]
SPAN/TAP | Mirror switch/router traffic to a sensor without disrupting flows.
Libpcap / AF_PACKET | Snort uses libpcap; Suricata supports AF_PACKET/NFQUEUE for performance.
Live Inspection | Inspect headers and payloads in near‑real‑time to feed the pipeline.

---

## **_Preprocessing_**

[[Expandables]]
Decode Layers | Ethernet → IP → TCP/UDP → App protocols
Reassemble | IP fragments and TCP streams combined before matching
Normalize | URL decode, trim whitespace/encodings to defeat obfuscation

---

## **_Rule Databases_**

[[Expandables]]
Structure | Header (proto, IPs, ports) + Options (content/PCRE, msg, metadata) + Action (alert/log/drop)
Sources | Community (ET/Open), Vendor (Talos/ET Pro), Custom rules for your environment
Example | `alert tcp any any -> 192.168.1.10 80 (msg:"Possible web attack"; content:"cmd.exe"; sid:1000001;)`

---

## **_Detection & Logging_**

[[Icons]]
 | Alert with SID, severity, src/dst |
 | Send EVE JSON to ELK/SIEM |
 | Retain evidence for forensics |

---

## **_Performance Tips_**

[[Expandables]]
Optimize Rules | Reduce duplicates; anchor patterns; profile hot rules
Scale Out | Use multi‑core sensors; shard by VLAN/zone
Tune Sets | Enable per‑zone packs to keep matching tight

---

## **Summary**

Capture feeds the sensor; preprocessing makes data matchable; rules define what to look for; logging closes the loop — and performance work keeps it all fast.

---

## **Media**

Image: [Module 3 Lesson 2 Placeholder](https://placehold.co/960x540?text=Capture+%26+Rules) | Swap for capture diagram or rule snippet screenshot. | [Source](https://placehold.co)
