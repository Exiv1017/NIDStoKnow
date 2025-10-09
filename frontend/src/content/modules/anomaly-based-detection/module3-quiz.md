# Module 3 — Short Quiz: Drift & Evaluation

```activity
{
  "type": "mcq",
  "questions": [
    { "q": "Lowering thresholds usually:", "options": ["Increases recall", "Increases precision", "Does nothing"], "ans": 0 }
  ]
}
```

```activity
{
  "type": "truefalse",
  "questions": [
    { "q": "Concept drift can happen naturally.", "ans": true }
  ]
}
```

```activity
{
  "type": "fillblanks",
  "prompt": "Complete: precision and ______.",
  "blanks": ["recall"]
}
```

```activity
{
  "type": "interactive",
  "mode": "drag",
  "prompt": "Match term to description.",
  "match": {
    "terms": ["Recall", "Precision", "Calibration"],
    "descriptions": [
      "Mapping scores to probabilities",
      "TP / (TP + FN)",
      "TP / (TP + FP)"
    ],
    "answer": {
      "Recall": "TP / (TP + FN)",
      "Precision": "TP / (TP + FP)",
      "Calibration": "Mapping scores to probabilities"
    }
  }
}
```

```activity
{
  "type": "scenario",
  "intro": "Short responses:",
  "prompts": [
    "Name a metric besides AUC that you track.",
    "How would you detect drift in production?"
  ]
}
```
