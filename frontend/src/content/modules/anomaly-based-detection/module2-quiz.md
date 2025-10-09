# Module 2 — Short Quiz: Modeling & Scoring

```activity
{
  "type": "mcq",
  "questions": [
    { "q": "Which is a good robust statistic for heavy-tailed data?", "options": ["Mean", "Median", "Mode"], "ans": 1 }
  ]
}
```

```activity
{
  "type": "truefalse",
  "questions": [
    { "q": "Normalization can stabilize model behavior.", "ans": true }
  ]
}
```

```activity
{
  "type": "fillblanks",
  "prompt": "Complete: reconstruction ______ and decision ______.",
  "blanks": ["error", "function"]
}
```

```activity
{
  "type": "interactive",
  "mode": "drag",
  "prompt": "Match scoring concepts.",
  "match": {
    "terms": ["Quantile", "Z-score", "Threshold"],
    "descriptions": [
      "Cutoff applied to scores",
      "Position relative to mean/std",
      "Value below which a given fraction falls"
    ],
    "answer": {
      "Quantile": "Value below which a given fraction falls",
      "Z-score": "Position relative to mean/std",
      "Threshold": "Cutoff applied to scores"
    }
  }
}
```

```activity
{
  "type": "scenario",
  "intro": "Short responses:",
  "prompts": [
    "Name one risk of setting thresholds too low.",
    "Name one benefit of interpretable scoring."
  ]
}
```
