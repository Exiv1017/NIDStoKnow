# Signature Hunt — Report

Student: _____

Module: Signature-Based Detection — Practical

Date: _____

## Rules Summary

Provide 3–5 rules. Keep lines short; wrap the Match pattern if long.

| ID | Name | Field | Type | Severity |
|----|------|-------|------|----------|
| R-1001 | SQLi probe in query | query | regex | high |
| R-1002 | Path traversal | path | regex | high |
| R-1003 | Recon tooling UA | ua | any | medium |
| R-1004 | WP brute-force POSTs | path | exact | medium |

Rationale (short notes):

- R-1001: Classic SQLi probes from theory (OR 1=1 / UNION SELECT).
- R-1002: Traversal indicators (/etc/passwd, ../, encoded).
- R-1003: Known scanner/tool UAs (sqlmap, Nikto, curl, python-requests).
- R-1004: Login abuse pattern; use threshold to reduce noise.

## Findings By Rule

### R-1001 — SQLi probe in query

- Before tuning: ____
- After tuning: ____
- Sample lines:
  - (paste 1–2 matching lines)
- Tuning notes: (anchors / exclusions added)

### R-1002 — Path traversal / sensitive file

- Before tuning: ____
- After tuning: ____
- Sample lines:
  - (paste 1–2 matching lines)
- Tuning notes: (encodings handled, exactness)

### R-1003 — Recon tooling UA

- Before tuning: ____
- After tuning: ____
- Sample lines:
  - (paste 1–2 matching lines)
- Tuning notes: (case sensitivity / substrings tightened)

### R-1004 — WP brute-force POSTs (with threshold)

- Raw matches: ____
- Aggregated alerting: ____ (IPs that breached threshold)
- Sample burst:
  - (IP) had (N) POSTs to /wp-login.php within ~1m around (time)
- Threshold rationale: (why N and why this window)

## Threshold Scenario

Describe a case where threshold suppressed noise but still flagged a burst.

## Optional Tools / One-liners

List any helper commands or a tiny script you used.
