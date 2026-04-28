# Dispatcher evaluation — 2026-04-20

Fixtures: **120** (billing=17, technical=17, account=17, compliance=17, feature_request=17, how_to=17, escalate=18)
Elapsed: 104.4s — 120 LLM calls, 0 fallback

Overall accuracy: **96.7%**
Macro F1: **0.967** — target ≥ 0.80
PII-detection accuracy: 85.0%
Human-review flag accuracy: 99.2%

## Per-category

| Category | Support | Precision | Recall | F1 |
|---|---|---|---|---|
| billing | 17 | 0.889 | 0.941 | 0.914 |
| technical | 17 | 0.944 | 1.000 | 0.971 |
| account | 17 | 0.944 | 1.000 | 0.971 |
| compliance | 17 | 1.000 | 1.000 | 1.000 |
| feature_request | 17 | 1.000 | 1.000 | 1.000 |
| how_to | 17 | 1.000 | 0.941 | 0.970 |
| escalate | 18 | 1.000 | 0.889 | 0.941 |

## Confusion matrix

| actual \ predicted | billing | technical | account | compliance | feature_request | how_to | escalate |
|---|---|---|---|---|---|---|---|
| **billing** | 16 | 1 | 0 | 0 | 0 | 0 | 0 |
| **technical** | 0 | 17 | 0 | 0 | 0 | 0 | 0 |
| **account** | 0 | 0 | 17 | 0 | 0 | 0 | 0 |
| **compliance** | 0 | 0 | 0 | 17 | 0 | 0 | 0 |
| **feature_request** | 0 | 0 | 0 | 0 | 17 | 0 | 0 |
| **how_to** | 1 | 0 | 0 | 0 | 0 | 16 | 0 |
| **escalate** | 1 | 0 | 1 | 0 | 0 | 0 | 16 |

## Misclassifications

- `eval-013`: expected **billing** → predicted **technical** (conf 0.88, model) — invoice download — sounds technical but core issue is billing-artifact
- `eval-097`: expected **how_to** → predicted **billing** (conf 0.98, model) — batch invoice export
- `eval-109`: expected **escalate** → predicted **billing** (conf 0.86, model) — impersonation attempt
- `eval-111`: expected **escalate** → predicted **account** (conf 0.86, model) — PHI (medication + diagnosis) — human review required, ambiguous category between account/compliance

## Human-review misses (required review but not flagged)

- `eval-109` — impersonation attempt