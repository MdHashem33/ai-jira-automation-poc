# Verified Recipe: Building a PII-safe, Model-Agnostic, Multi-Agent Support System in Next.js

**Author:** Mohamad Hashem
**Sprint:** Agentifying Customer Support — Fluent Agentic Games (4-week sprint, April 2026)
**Status:** Ready for adoption by other Valsoft business units
**Repo language:** TypeScript (Next.js 14, React 18)
**Audience:** any team that needs an inbound-support automation pipeline with classification, grounded auto-resolution, hallucination defenses, and multi-channel intake.

## Problem statement

Customer-support teams lose hours every week on repetitive triage and ticket creation. A naive deployment of an LLM as a "support chatbot" makes the problem worse: it invents policies, leaks PII, falls over on prompt-injection attempts, and ties downstream behavior to one vendor's API. The well-known failure modes — Air Canada's invented refund policy, Chevy Watsonville's "$1 Tahoe" via prompt injection, Cursor's "Sam" persona inventing subscription terms — all share the same root cause: the LLM was given authority without grounding, verification, or a refusal path.

This recipe documents the pattern that took our POC from a single-call OpenAI inside business logic to a multi-agent, multi-channel, hallucination-defended support pipeline with a measured macro F1 of 0.967, end-to-end cost under $0.001 per resolution, and three live intake channels.

## What you get if you adopt this

- **A dispatcher agent** that classifies inbound support messages into 7 categories with per-category precision/recall/F1 measured on a 120-case mock evaluation.
- **A Dual-Model Judge** that verifies every dispatcher decision before any downstream action, using a different model deployment from the Generator to satisfy Sage Franch's reviewer-must-be-different rule.
- **Three specialist agents** (FAQ / how-to, account recovery, billing with scoped tool use) that auto-resolve their categories using KB-grounded responses and refuse outside their scope.
- **Three intake channels** sharing the same pipeline: email, voice transcript, screenshot.
- **A mandatory PII/PHI redaction layer** that masks before any LLM call and surfaces a `requires_human_review` flag on PHI mentions.
- **A model-agnostic adapter** that switches between OpenAI direct, Azure OpenAI, and (with one branch) Anthropic. No `openai.chat.completions.create` calls live in business logic.
- **Cost-per-ticket accounting** at the LLM-call level. Token usage rolls up to the dashboard.
- **An evaluation harness** that runs the 120-case eval and prints a confusion matrix plus per-category F1.
- **A multi-run agent test harness** (Talbench 2024 pattern) that runs each test case three times and gates on ≥70% consistency.
- **A self-learning flywheel** that appends every resolution to a JSONL log and re-surfaces prior patterns to the next dispatch.
- **A proactive-detection log-hook** endpoint that turns a monitoring alert into a synthetic ticket through the same pipeline.

Every piece is governed by a `.claude/skills/` document under the same repo, so the rationale travels with the code.

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                          Intake channels                             │
│                                                                      │
│   email          voice (transcript)         screenshot (vision/OCR)  │
│     │                  │                          │                  │
│     └────────┬─────────┴──────────────┬───────────┘                  │
│              ▼                        ▼                              │
│       ┌──────────────┐         ┌──────────────┐                      │
│       │  parseEmail  │         │ monitor hook │  proactive detection │
│       └──────┬───────┘         └──────┬───────┘                      │
│              └──────────────┬─────────┘                              │
│                             ▼                                        │
│                   ┌──────────────────┐                               │
│                   │ redact (PII/PHI) │  reversible map kept server   │
│                   └──────────────────┘                               │
│                             │                                        │
│                             ▼                                        │
│                   ┌──────────────────┐                               │
│                   │  dispatcher      │  Generator: gpt-5.4-mini      │
│                   │  7-category JSON │                               │
│                   └────────┬─────────┘                               │
│                            ▼                                         │
│                   ┌──────────────────┐                               │
│                   │  Judge (Reviewer)│  different deployment model   │
│                   │  faithfulness    │                               │
│                   └────────┬─────────┘                               │
│                            ▼                                         │
│              ┌─────────────┴──────────────┐                          │
│              │     specialist routing      │                         │
│              │  (category + review flag)   │                         │
│              └──┬─────────┬──────────┬─────┘                         │
│                 ▼         ▼          ▼                               │
│        ┌────────────┐ ┌────────────┐ ┌────────────┐                  │
│        │ FAQ spec.  │ │ Account    │ │ Billing    │                  │
│        │ how_to RAG │ │ specialist │ │ + scoped   │                  │
│        └─────┬──────┘ └─────┬──────┘ │ tool       │                  │
│              │              │        └─────┬──────┘                  │
│              └──────────────┴──────────────┘                         │
│                             │                                        │
│                             ▼                                        │
│                  ┌──────────────────┐                                │
│                  │ legacy fallback  │  for compliance, escalate, or  │
│                  │ + Jira escalate  │  any specialist refusal        │
│                  └────────┬─────────┘                                │
│                           ▼                                          │
│                  ┌──────────────────┐                                │
│                  │ flywheel: append │  resolution log → next-run     │
│                  │ resolution log   │  RAG retrieval                 │
│                  └──────────────────┘                                │
└──────────────────────────────────────────────────────────────────────┘
```

## Measured results

Macro F1 progression on the 120-case dispatcher eval (fixed mock set, balanced 7 categories, PII and hostile variants):

| Iteration | What changed | Macro F1 | Accuracy |
|---|---|---|---|
| Baseline (regex fallback only, no LLM key) | — | 0.471 | 45.0% |
| Azure OpenAI gpt-5.4-mini wired up | LLM path active | 0.940 | 94.2% |
| Targeted account-category examples added | Prompt iteration | **0.967** | **96.7%** |

Per-category F1 at end of sprint: feature_request 1.000, compliance 1.000, technical 0.971, account 0.971, how_to 0.970, escalate 0.941, billing 0.914.

Live pipeline cost per how-to resolution (3 LLM calls: dispatcher + judge + FAQ specialist): about US $0.000606. A typical month at 50 tickets per week × ~20% how_to share would cost roughly US $0.25 in LLM calls.

Multi-channel coverage at end of sprint: email, voice (transcript), screenshot — all sharing the same redact + dispatch + judge + specialist pipeline.

## Architectural decisions and why

### Decision 1 — Anthropic-style prompt layout (identity-only system + XML first user)

The dispatcher's system prompt is 50 words and contains only the agent's identity and the output-format contract. It does not contain the taxonomy, the rules, or the examples. Those live in the first user turn inside XML tags:

```
<categories>…</categories>
<rules>…</rules>
<output_schema>…</output_schema>
<examples>…</examples>
<message>…</message>
```

**Why:** identity-only system prompts survive model upgrades and cross-provider moves better than system prompts stuffed with domain knowledge. XML tags give the model unambiguous handles for each section, and prompt updates are diff-reviewable. This is the pattern from Anthropic's customer-support guide.

### Decision 2 — Pinned JSON output with deterministic regex fallback

`response_format: { type: 'json_object' }` on OpenAI, with `max_completion_tokens` for GPT-5 series compatibility. Schema is enumerated in the prompt. A regex-based fallback dispatcher runs when no API key is configured — not as the primary path, but as a graceful-degradation safety net for local dev and key-outage scenarios.

**Why:** JSON output keeps parsing trivial and prevents prose drift. The fallback means the pipeline never hard-fails on a missing key.

### Decision 3 — Evaluation-driven development with a 120-case fixed set

Before wiring the dispatcher into live routing, we built `fixtures/eval/dispatcher.jsonl` — 120 mock support emails balanced across the 7 categories, with PII variants and hostile/prompt-injection cases in the `escalate` bucket. The eval harness (`scripts/eval-dispatcher.ts`) prints a confusion matrix, per-category precision/recall/F1, and macro F1 against a 0.80 hard target. A dispatcher below target does not ship.

**Why:** the whole pipeline's accuracy is capped by classification quality. Without a number, you cannot justify the downstream work, and you cannot defend the POC when a judge asks "how do you know it works?"

### Decision 4 — Dual-Model Judge with the reviewer-must-be-different rule

After the dispatcher returns a JSON verdict, a Judge agent verifies the decision against the message. The Judge runs on a deployment configured by `AZURE_OPENAI_JUDGE_DEPLOYMENT` separately from `AZURE_OPENAI_DEPLOYMENT`. When both point to the same deployment, the system logs a warning and a TODO. Sage Franch's RegTech precedent (April 24 office hours): models are measurably more honest about another model's work than their own. The judge returns a `faithfulness` score (0.0 to 1.0) and an `agrees` boolean. The downstream specialist only fires when `faithfulness >= 0.70` and `agrees === true`.

**Why:** Air Canada and Cursor both shipped LLM responses that were never independently verified. The Judge is the cheapest credible defense and is well within latency budget — a typical verification adds ~0.4 seconds.

### Decision 5 — Specialist-per-category, with refusal as a first-class outcome

The dispatcher's `category` selects one of three specialists (FAQ for how_to, account recovery for account, billing for billing). Each specialist:

- Retrieves the matching KB article (or a tool result, in billing's case).
- Drafts a reply grounded in that retrieved context.
- Returns `can_answer: false` if the retrieved context does not authorize the action.

When a specialist refuses, the pipeline falls through to the legacy decision engine, which either auto-replies via the legacy KB-match or escalates to Jira. The legacy path is the safety net during the rollout window, not the default route.

**Why:** every horror story the judges cited shipped a confident answer that should have been refused. A first-class refusal path turns "we'd rather escalate than guess" from a slogan into a code path.

### Decision 6 — Mandatory PII/PHI redaction before every LLM call

Every payload entering an LLM call passes through `src/lib/ai/redact.ts` first. Email addresses, phone numbers, credit card patterns, SSNs, account IDs, URLs, and IP addresses are masked. PHI mentions trigger `requires_human_review=true` on the dispatcher result regardless of category. The reversible map stays server-side for re-hydration on outbound replies.

**Why:** PHI exposure is a compliance and safety issue, not a routing issue. Tracy Harrison's office-hours observation (April 24): support data is incidental ("documenting on Mrs. Jones's fall") rather than structured, so a hybrid offline-NER + regex pattern is the right approach. We implement regex today and document the offline-NER upgrade path.

### Decision 7 — Tool use through a scoped service, not raw DB access

The billing specialist needs invoice data. Rather than connect to a database, it calls `lookupInvoice(invoiceNumber)` from `src/lib/services/billingTool.ts` — a tight, purpose-built function that returns a structured `InvoiceRecord`. In production the function would query the billing system through an MCP server with a read-only service account. The AI never sees raw SQL, never holds a token with broader scope than its task requires.

**Why:** Victor and Patrick's office-hours guidance (April 17): never give an AI direct database access; build tools, scope service accounts. This is also the pattern that survives security review.

### Decision 8 — Multi-run testing at ≥70% consistency

`scripts/test-agents.ts` runs each of the 12 agent test cases three times and gates each case at ≥70% pass-rate before declaring it consistent. Test cases include happy paths (FAQ, account, billing), refusals (illegitimate refund demand), and adversarial inputs (prompt injection, DAN mode, impersonation, fabricated policy). Each run checks deterministic conditions (predicted category, resolved flag, requires_human_review) and qualitative ones (forbidden phrases must not appear in the answer).

**Why:** Patrick Whelan's office-hours observation (April 24), tied to the Talbench 2024 paper: agents pass on the first run more often than they pass on three. Anything below 70% consistency is not production-ready.

### Decision 9 — Self-learning flywheel with append-only resolution log

After every auto-resolution, the pipeline appends `{ticketId, category, patternSummary, resolutionSteps, outcome}` to `fixtures/resolutions/log.jsonl`. The KB store exposes `searchResolutions(query)` for specialists to consult prior successful resolutions before drafting a fresh reply. The flywheel summary endpoint at `/api/kb/flywheel` exposes counts by category and outcome.

**Why:** Rahul Ranjan's exemplar (April 17 office hours, showcased by Sage): every resolution should make the system smarter, not just close a ticket. Phase 6 of the Fluent 8-phase playbook formalizes this as the documentation flywheel.

### Decision 10 — Proactive detection through the same pipeline

`/api/intake/monitor` accepts a structured event from a monitoring system (Datadog / Sentry / Signoz / CloudWatch). It synthesizes a ticket subject and body and feeds them through the same `processEmail` pipeline. The dispatcher routes the synthetic ticket exactly like an inbound customer email. The escalation path opens a Jira issue if the dispatcher decides escalation is needed.

**Why:** Phase 5 of the playbook. A real production deployment ties this endpoint to the team's monitoring webhooks; the demo proves the pipeline can absorb proactive events without a parallel code path.

## Code map

| Concern | File |
|---|---|
| Model adapter (provider-agnostic, cost accounting) | `src/lib/ai/client.ts` |
| Redaction layer | `src/lib/ai/redact.ts` |
| Dispatcher agent | `src/lib/agents/dispatcher.ts` |
| Judge agent | `src/lib/agents/judge.ts` |
| FAQ specialist | `src/lib/agents/faqSpecialist.ts` |
| Account specialist | `src/lib/agents/accountSpecialist.ts` |
| Billing specialist | `src/lib/agents/billingSpecialist.ts` |
| Billing tool (mock invoice lookup) | `src/lib/services/billingTool.ts` |
| KB store + flywheel | `src/lib/services/kbStore.ts`, `fixtures/kb/articles.jsonl` |
| Pipeline orchestrator | `src/lib/services/pipeline.ts` |
| Email intake | `src/app/api/email/simulate/route.ts` |
| Voice intake | `src/app/api/intake/voice/route.ts` |
| Screenshot intake | `src/app/api/intake/screenshot/route.ts` |
| Monitor / proactive intake | `src/app/api/intake/monitor/route.ts` |
| KB search endpoint | `src/app/api/kb/search/route.ts` |
| Flywheel summary endpoint | `src/app/api/kb/flywheel/route.ts` |
| 120-case dispatcher eval | `scripts/eval-dispatcher.ts`, `fixtures/eval/dispatcher.jsonl` |
| Multi-run agent test harness | `scripts/test-agents.ts`, `fixtures/eval/agent-tests.jsonl` |
| Confidence calibration | `scripts/eval-calibration.ts` |
| Demo recorder | `scripts/demo-record.mjs` |
| Submission converter | `scripts/convert-submission.mjs` |

## ROI math

Manual baseline: 50 tickets per week, average 5 to 10 minutes per ticket on triage and Jira creation = 250 to 500 minutes per week = 4 to 8 hours of agent time saved.

Automated baseline (existing POC, pre-dispatcher): about 3 seconds per ticket end to end.

Week 4 incremental: every how-to and account ticket auto-resolved (about 25 to 30 tickets per week of typical mix at the 75% deflection target) saves an additional 2 minutes per ticket of human reply-drafting time = about 1 hour per week.

Total: 5 to 9 hours saved per week per workflow, with a clear path to the 75% deflection target as more specialists come online. At an average loaded support-agent cost of US $35 per hour, that is roughly US $175 to US $315 per week per workflow, against an LLM cost of well under US $1 per week at the current ticket volume.

## Adoption checklist for another team

1. **Replace the KB.** Drop your team's articles into `fixtures/kb/articles.jsonl`, keeping the schema (`id`, `title`, `category`, `keywords`, `content`, `resolution`).
2. **Replace the eval set.** Take the existing `fixtures/eval/dispatcher.jsonl` schema and write 100 to 150 mock messages reflecting your real ticket distribution. Run `npm run eval:dispatcher` until macro F1 is at least 0.80.
3. **Set the env vars.** Configure `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_DEPLOYMENT` (Generator), `AZURE_OPENAI_JUDGE_DEPLOYMENT` (a different model deployment for the Judge — required), and `AZURE_OPENAI_API_VERSION`.
4. **Wire your specialists.** Each category that you want auto-resolved gets a specialist agent. Use `faqSpecialist.ts` as the template; substitute your tool calls for the billing pattern when an external system needs to be consulted.
5. **Run the agent test harness.** Adapt `fixtures/eval/agent-tests.jsonl` to your domain. Run `npm run test:agents` and gate at ≥70% per case before flipping live routing on.
6. **Plug in your monitoring webhooks.** Route Datadog / Sentry / Signoz alerts to `/api/intake/monitor` to activate Phase 5.
7. **Update the redaction layer.** Add or remove patterns in `src/lib/ai/redact.ts` based on your data sensitivities. PHI workflows should layer an offline NER model in front of the regex.

## Limits and known gaps

- Vision intake on the screenshot endpoint depends on the deployed model accepting image input. The endpoint falls back cleanly to the `extractedText` path.
- The flywheel re-indexes only via keyword overlap today; an embedding-based retrieval upgrade is a one-day delta.
- Confidence calibration is implemented but its threshold is currently the prompt-defined 0.70. The reliability diagram in `.claude/reports/eval/YYYY-MM-DD-calibration.md` should be re-run after each prompt iteration.
- The Judge currently runs on the same deployment as the dispatcher in our environment because only one Azure OpenAI model is provisioned. The architectural support for a separate deployment is in place; activate by deploying a different model and setting `AZURE_OPENAI_JUDGE_DEPLOYMENT`.

## Horror-story defenses, mapped

| Risk | Defense in this recipe |
|---|---|
| Air Canada-style policy invention | Specialists answer only from retrieved KB content; Judge verifies before action; refusal trigger on miss. |
| Chevy Watsonville $1 Tahoe via prompt injection | Injection patterns (`eval-103`, `eval-110`, `eval-113`, `eval-120` in the eval set, plus `test-injection-01` through `-03` in the test harness) all route to `escalate` with `requires_human_review=true`. Dispatcher has no tool authority. |
| Cursor "Sam" hallucinated subscription policy | `source` field on every result distinguishes `model` from `fallback`. Specialists that refuse return reasoning. The legacy decision engine is the canonical fallback for refusals. |
| PHI leakage to an external LLM | Mandatory regex redaction before every LLM call. PHI mention forces human review regardless of category. Office-hours-recommended offline-NER hybrid is the next-level upgrade. |
| Re-identification of de-labeled medical data | Out of scope for the current POC's risk tolerance; documented as a constraint for medical-domain adopters per the April 24 office-hours discussion. |

## Reusability beyond customer support

The dispatcher + Judge + specialist pattern, the 120-case eval harness, the multi-run test harness, the resolution-log flywheel, the model adapter, and the redaction layer are all **domain-agnostic**. The only domain-specific code is the KB content, the prompt examples, and the specialist prompts. A team in services, product, or any other agentic-lead workstream can fork this repo, replace the KB and the eval set, and have a working multi-agent system in a sprint.

## Acknowledgements

Patterns, language, and rules absorbed from:
- Sage Franch — *A Project Owner's Guide to AI Hallucinations in 2026* (Fluent KB, April 2026)
- Sage Franch — Agentic Games office hours, April 17 and April 24, 2026 (reviewer-different-model rule, multi-run testing, PHI offline-NER, FAQ-first specialist strategy, model sizing)
- W. Alame and M. Radovan — *The Agentic Transformation* (Valsoft, February 2026), Support-Lead KPIs and the 75/25 deflection rule
- Anthropic — Customer Support Agent guide (identity-only system prompt, XML first-user turn)
- Patrick Whelan (Cybertill) — voice agent + automated test harness exemplar
- Rahul Ranjan (M&I) — three-tier context retrieval and self-learning flywheel exemplar
- Tracy Harrison (American Data) — PHI redaction in unstructured support text
- Adam Schultheis — custom MCP server pattern
- Ilyas Ibrahim — *How I made Claude Code agents coordinate 100% and solved context amnesia* (multi-agent orchestration ground rules)
