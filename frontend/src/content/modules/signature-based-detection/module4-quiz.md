# Module 4 — Short Quiz: Hybrid/Practical NIDS

```activity
{
  "type": "mcq",
  "questions": [
    { "q": "A hybrid NIDS aims to combine:", "options": ["Only signature methods", "Signature and anomaly techniques", "Only flow collectors"], "ans": 1 }
  ]
}
```

```activity
{
  "type": "truefalse",
  "questions": [
    { "q": "Hybrid systems can reduce false negatives by leveraging multiple methods.", "ans": true }
  ]
}
```

```activity
{
  "type": "fillblanks",
  "prompt": "Complete: incident ______ and alert ______.",
  "blanks": ["response", "triage"]
}
```

```activity
{
  "type": "interactive",
  "mode": "drag",
  "prompt": "Drag & Drop Matching — Match the tool to its typical role.",
  "match": {
    "terms": ["Snort", "Suricata", "Zeek"],
    "descriptions": [
      "Deep packet inspection with signatures",
      "Rule-based IDS/IPS engine",
      "Network visibility and metadata scripting"
    ],
    "answer": {
      "Snort": "Rule-based IDS/IPS engine",
      "Suricata": "Deep packet inspection with signatures",
      "Zeek": "Network visibility and metadata scripting"
    }
  }
}
```

```activity
{
  "type": "scenario",
  "intro": "Briefly answer:",
  "prompts": [
    "One advantage of combining signature and anomaly detection?",
    "One operational consideration when deploying at scale?"
  ]
}
```
