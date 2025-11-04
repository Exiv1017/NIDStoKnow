## **_Context Enrichment_**

Correlation connects the dots; enrichment explains why they matter. Context
enrichment augments raw anomalies with data like asset value, user identity,
geo, and threat reputation to make alerts actionable.

### What is context enrichment?

Adding supplemental data to events and alerts so analysts can interpret them
quickly. Instead of “failed login,” an enriched alert might include:

- User info: who attempted it and department.
- Device details: host criticality, OS, known vulnerabilities.
- Location: where the attempt originated from.
- Reputation: IP/domain reputation from threat intel.

### Why it’s essential

- Adds clarity: explains impact and urgency.
- Reduces noise: filters non‑critical or duplicate alerts automatically.
- Improves triage: prioritizes by risk and criticality.
- Enables automation: provides the context SOAR needs to act safely.

### How enrichment works

Often occurs after correlation and before incident response:

- Data normalization: standardize logs/telemetry into a shared format.
- Attribute mapping: attach owner, business unit, threat category.
- Threat intel integration: compare IPs/domains/hashes to feeds.
- Environmental context: asset criticality and baseline activity.
- Risk scoring and tags: assign severity/confidence to drive routing.

### Common enrichment sources

- Threat feeds (Anomali, AbuseIPDB, AlienVault OTX)
- Asset inventory/CMDB
- Identity directories (e.g., SSO/LDAP)
- Geolocation databases
- Cloud platform metadata (tags, owners, environment)

### Benefits

- Fewer false positives via risk context.
- Faster investigations: relevant details at a glance.
- Better automation: safe triggers with sufficient evidence.

### Challenges

- Data quality and staleness can mislead.
- Over‑enrichment can overwhelm analysts.
- Integration reliability and privacy compliance matter.

Maintain trusted sources, validate regularly, and use role‑based access to
protect sensitive attributes.
