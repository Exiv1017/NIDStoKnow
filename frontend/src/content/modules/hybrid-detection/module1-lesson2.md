<card class="mb-8">

<div style="padding:5px; border-radius:12px; max-width:800px; margin:auto; text-align:justify;">

Architectures for hybrid NIDS.

</div>

</card>

<card class="mb-8">

<div style="padding:5px; border-radius:12px; max-width:800px; margin:auto; text-align:justify;">

**Patterns**

- Serial pipeline (S→A): filter with signatures, score with anomaly.
- Parallel pipeline: run both, fuse alerts.
- Feedback loop: anomaly outputs drive new signatures.

</div>

</card>

<card style="background:#F0FDFA;">

**Fusion**

<accordion title="Rule-based" open="false">
Combine scores/alerts via thresholds and logic.
</accordion>

<accordion title="Learning-based" open="false">
Train a meta-model on outputs of both systems.
</accordion>

</card>

<key-points>
- Fusion design controls FP/FN trade-offs.
- Feedback can reduce unknowns over time.
</key-points>

<accordion title="Activity — true/false" open="true" class="mb-8">
```activity
{
  "type": "truefalse",
  "questions": [
    { "q": "Parallel fusion can create duplicate alerts to de-duplicate.", "ans": true }
  ]
}
```
</accordion>

**Objectives:**

- Understand the key ideas in this lesson
- See one practical example
- Check your understanding

**Tabs:**

- Overview: Placeholder overview for this topic.
- Examples: Placeholder examples relevant to this lesson.
- Pitfalls: Common pitfalls and how to avoid them.

**Steps:**

1. Learn - Read the overview and key ideas.
2. Apply - Try a simple exercise or scenario.
3. Verify - Check your understanding.

**Image:** [Placeholder](https://via.placeholder.com/960x400)
| Visual placeholder
| [Source](https://via.placeholder.com)

**Note:** Emphasize orchestration and data flow.

**Actions:**

- [View docs](https://example.com/docs)
- [Try a demo](https://example.com/demo)

```activity
{
  "type": "mcq",
  "questions": [
    {
      "q": "Placeholder knowledge check?",
      "options": ["A", "B"],
      "ans": 1
    }
  ]
}
```

**Timeline:**

- T-0 | Learn | Read the lesson highlights
- T+10m | Apply | Do a small practice
- T+15m | Review | Take the check

**Checklist:**

- I understand the definitions
- I can cite a real example
- I can avoid common pitfalls

**Glossary:**

- Term: Short definition here.

**Resources:**

- [Primary reference](https://example.com/reference)
- [Related reading](https://example.com/related)

**Video:** [Watch](https://www.youtube.com/embed/VIDEO_ID)
