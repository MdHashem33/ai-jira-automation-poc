# Dispatcher evaluation — 2026-05-06

Fixtures: **220** (billing=28, technical=35, account=31, compliance=32, feature_request=27, how_to=31, escalate=36)
Elapsed: 349.0s — 220 LLM calls, 0 fallback

Overall accuracy: **93.2%**
Macro F1: **0.933** — target ≥ 0.80
PII-detection accuracy: 86.8%
Human-review flag accuracy: 97.3%

## Per-category

| Category | Support | Precision | Recall | F1 |
|---|---|---|---|---|
| billing | 28 | 0.929 | 0.929 | 0.929 |
| technical | 35 | 0.914 | 0.914 | 0.914 |
| account | 31 | 0.967 | 0.935 | 0.951 |
| compliance | 32 | 0.970 | 1.000 | 0.985 |
| feature_request | 27 | 0.900 | 1.000 | 0.947 |
| how_to | 31 | 0.935 | 0.935 | 0.935 |
| escalate | 36 | 0.909 | 0.833 | 0.870 |

## Confusion matrix

| actual \ predicted | billing | technical | account | compliance | feature_request | how_to | escalate |
|---|---|---|---|---|---|---|---|
| **billing** | 26 | 1 | 0 | 0 | 0 | 1 | 0 |
| **technical** | 0 | 32 | 0 | 0 | 0 | 0 | 3 |
| **account** | 0 | 0 | 29 | 1 | 0 | 1 | 0 |
| **compliance** | 0 | 0 | 0 | 32 | 0 | 0 | 0 |
| **feature_request** | 0 | 0 | 0 | 0 | 27 | 0 | 0 |
| **how_to** | 0 | 0 | 1 | 0 | 1 | 29 | 0 |
| **escalate** | 2 | 2 | 0 | 0 | 2 | 0 | 30 |

## Misclassifications

- `eval-013`: expected **billing** → predicted **technical** (conf 0.91, model) — invoice download — sounds technical but core issue is billing-artifact
- `eval-028`: expected **account** → predicted **compliance** (conf 0.91, model) — PHI (diagnosis mentioned) - human review required per rule 3
- `eval-109`: expected **escalate** → predicted **billing** (conf 0.86, model) — impersonation attempt
- `eval-122`: expected **technical** → predicted **escalate** (conf 0.91, model) — PHI narrative without explicit identifiers but medical context
- `eval-125`: expected **technical** → predicted **escalate** (conf 0.98, model) — PHI + technical bug, requires human review
- `eval-129`: expected **technical** → predicted **escalate** (conf 0.86, model) — Legal context + technical bug, sensitive case mentioned
- `eval-153`: expected **escalate** → predicted **billing** (conf 0.91, model) — References nonexistent prior context — escalate
- `eval-155`: expected **escalate** → predicted **feature_request** (conf 0.88, model) — Out-of-scope inquiry (not support)
- `eval-158`: expected **account** → predicted **how_to** (conf 0.98, model) — Account: role/permission with mistaken assumption
- `eval-179`: expected **escalate** → predicted **technical** (conf 0.91, model) — Internal escalation, urgent + ambiguous
- `eval-183`: expected **escalate** → predicted **feature_request** (conf 0.86, model) — Sales/contract — escalate
- `eval-184`: expected **escalate** → predicted **technical** (conf 0.88, model) — Security incident report — escalate
- `eval-185`: expected **billing** → predicted **how_to** (conf 0.97, model) — Billing: invoice retrieval
- `eval-188`: expected **how_to** → predicted **feature_request** (conf 0.95, model) — How-to: integration
- `eval-207`: expected **how_to** → predicted **account** (conf 0.97, model) — How-to: bulk re-assign

## Human-review misses (required review but not flagged)

- `eval-153` — References nonexistent prior context — escalate
- `eval-155` — Out-of-scope inquiry (not support)
- `eval-179` — Internal escalation, urgent + ambiguous
- `eval-183` — Sales/contract — escalate
- `eval-184` — Security incident report — escalate
- `eval-214` — Account: owner identity recovery — escalate due to ownership