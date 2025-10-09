# Module 1 — Short Quiz: Introduction to NIDS

```activity
{
  "type": "mcq",
  "questions": [
    { "q": "What does NIDS stand for?", "options": ["Network Inspection and Defense System", "Network Intrusion Detection System", "Node Integrated Detection Service", "Network Intelligence Detection Suite"], "ans": 1 }
  ]
}
```

```activity
{
  "type": "truefalse",
  "questions": [
    { "q": "A NIDS primarily runs on individual endpoints to monitor host logs.", "ans": false }
  ]
}
```

```activity
{
  "type": "fillblanks",
  "prompt": "Fill the two key terms used for mirroring traffic to a NIDS sensor:",
  "blanks": ["tap", "port"]
}
```

```activity
{
  "type": "interactive",
  "mode": "drag",
  "prompt": "Drag & Drop Matching — Match each term to its description.",
  "match": {
    "terms": [
      "Signature-based detection",
      "NIDS",
      "IPS"
    ],
    "descriptions": [
      "Inspects network traffic and alerts on suspicious patterns (no default blocking)",
      "Uses known patterns/rules to detect threats",
      "Designed to block or prevent traffic in real time"
    ],
    "answer": {
      "NIDS": "Inspects network traffic and alerts on suspicious patterns (no default blocking)",
      "Signature-based detection": "Uses known patterns/rules to detect threats",
      "IPS": "Designed to block or prevent traffic in real time"
    }
  }
}
```

```activity
{
  "type": "scenario",
  "intro": "Respond briefly to each item:",
  "prompts": [
    "Describe how you would detect lateral movement.",
    "Name one indicator of compromise.",
    "What immediate step would you take after detection?"
  ]
}
```
