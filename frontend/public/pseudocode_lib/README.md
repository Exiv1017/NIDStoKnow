# Pseudocode Library (NIDStoKnow)

This folder contains cleaned, publication-ready pseudocode blocks used in the manuscript / teaching material.

Included:
- `aho_corasick.txt` – Multi-pattern signature matching (Aho–Corasick build + search)
- `isolation_forest_hybrid.txt` – Feature extraction, model lifecycle, scoring, semantic boost, and hybrid severity fusion

Guidelines for Use in Figures:
- Keep lines <= 90 chars when capturing screenshots.
- Use a monospace font (JetBrains Mono, Fira Code, Inconsolata).
- Prefer light background + subtle border (avoid heavy shading in print).
- You can prepend “Algorithm X:” labels per journal style; numbering restarts in each file for independence.

If you need a unified single algorithm summarizing the hybrid decision, derive it from `Algorithm 6` in `isolation_forest_hybrid.txt` plus a brief call to the signature engine.

Legacy stub sources:
- `frontend/public/pseudocode` (moved content here)
- `frontend/public/pseudocode2.py` (moved content here)
