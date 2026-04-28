# Verified Recipe — Building a PII-safe, Model-Agnostic Support Dispatcher in Next.js

**Author:** Mohamad Hashem
**Status:** Draft outline (Week 2)
**Target length:** 2,500–3,500 words final

## Problem statement

Customer-support teams drown in inbound email. A rules-based chatbot routes poorly; a naïve LLM-only classifier leaks PII, makes up categories, and falls over on prompt-injection attempts. The failure modes are well-documented: Air Canada's refund-policy hallucination, Chevy Watsonville's $1 Tahoe via prompt injection, Cursor's "Sam" invented policy. Any team deploying an agentic support classifier needs a pattern that is auditable, provider-swappable, PII-safe, and defensible under adversarial inputs.

This recipe documents the exact pattern that moved our POC from a monolithic OpenAI call inside business logic to a dedicated, evaluated, shadow-deployed dispatcher — the first agent in a multi-agent support pipeline.

## Architecture

```
inbound email
    │
    ▼
parseEmail ────────── (structured ParsedEmail type)
    │
    ▼
redact ──────────────── (mandatory: EMAIL, PHONE, CARD, SSN, ACCOUNT, URL, IP)
    │                    returns { cleansed, entries[], piiDetected }
    ▼
dispatch (Agent #1) ── system prompt: identity only
    │                   first user turn: XML-tagged categories + rules + examples + <message>
    │                   output: pinned JSON {category, confidence, reasoning, requires_human_review}
    ▼
route to specialist (Week 3+)
```

Three hard rules baked in:

1. **Model-agnostic adapter.** Every LLM call goes through `callModel(task, system, user, opts)`. The task → provider/model mapping lives in one function. Swapping OpenAI for Anthropic is an env var flip plus a branch addition, not a rewrite.
2. **Redaction is mandatory, not optional.** No raw message text reaches any LLM. The dispatcher operates on the redacted string; the reversible map stays server-side. PHI mentions trigger `requires_human_review=true` regardless of category.
3. **Shadow before live.** The dispatcher is wired into the pipeline as Step 1.5, runs on every inbound ticket, logs its decision — but does not yet override the legacy decision engine. This gives us comparison data before cutting over.

## Key decisions and why

### Decision 1 — Anthropic-style prompt layout (identity-only system + XML first-user)

The system prompt is 50 words and contains only the agent's identity and the output format contract. It does not contain the taxonomy, the rules, or the examples. Those live in the first user turn inside XML tags:

```
<categories>…</categories>
<rules>…</rules>
<output_schema>…</output_schema>
<examples>…</examples>
<message>…</message>
```

**Why:** Per Anthropic's customer-support prompting guide, identity-only system prompts survive model upgrades and cross-provider moves better than system prompts stuffed with domain knowledge. XML tags give the model unambiguous handles for each section and make prompt updates diff-reviewable.

### Decision 2 — Pinned JSON output with a fallback regex dispatcher

`response_format: { type: 'json_object' }` on OpenAI, tool-use or JSON mode on Anthropic. The output schema is enumerated. A regex-based fallback dispatcher runs when no API key is configured — not as the primary path, but as a graceful-degradation safety net for local dev and key-outage scenarios.

**Why:** A JSON-pinned output keeps parsing trivial and prevents "The category is billing." prose drift. The fallback means the pipeline never hard-fails on a missing key — it logs and keeps moving.

### Decision 3 — Evaluation-driven development

Before wiring the dispatcher into the live pipeline, we built a 120-fixture evaluation set spanning seven categories plus PII and hostile variants. The eval harness (`scripts/eval-dispatcher.ts`) prints a confusion matrix, per-category precision/recall/F1, and macro-F1 against a hard target of **0.80**. A dispatcher below target does not ship to live routing.

**Why:** The whole pipeline's accuracy is capped by classification quality. Without a number, you cannot justify the downstream work, and you cannot defend the POC when a judge asks "how do you know it works?" The fixture set also seeds hostile cases (prompt injection, fabricated policy references, multi-topic) that would otherwise only surface in production.

### Decision 4 — Seven categories plus a deliberate `escalate` bucket

Rather than force every message into a specialist bucket, the taxonomy includes `escalate` as a first-class category for hostile, ambiguous, multi-topic, or low-confidence messages. Confidence below 0.70 auto-demotes to `escalate` regardless of the model's initial pick.

**Why:** In the Air Canada and Chevy failures, the model confidently picked a category and acted on it. A first-class escape hatch that demands human review is the simplest way to avoid the same class of failure.

### Decision 5 — PHI detection is orthogonal to category

The dispatcher flags `requires_human_review=true` whenever the message mentions medical conditions, prescriptions, patient data, or PHI — even if the category looks innocuous. A password-reset request from a clinician that mentions a patient's diagnosis still routes to human review.

**Why:** HIPAA exposure is a compliance and safety issue, not a routing issue. Tying review flags to a specific category would let PHI slip through whenever the message's primary topic is something else.

## Code structure

| File | Responsibility |
|---|---|
| `src/lib/ai/client.ts` | Model adapter: task → provider/model routing, unified response shape |
| `src/lib/ai/redact.ts` | PII/PHI redaction with reversible entry map |
| `src/lib/agents/dispatcher.ts` | Dispatcher agent: system prompt, user-turn builder, fallback rules |
| `src/lib/services/pipeline.ts` | Shadow integration at Step 1.5 |
| `fixtures/eval/dispatcher.jsonl` | 120-case eval set, seven categories plus hostile variants |
| `scripts/eval-dispatcher.ts` | Eval harness: confusion matrix, per-category P/R/F1, macro-F1 |

## ROI measured

- Before: 50 tickets/week × 5–10 min manual triage = 4–8 hours/week
- After (existing POC, pre-dispatcher): ~3 sec per ticket, 4–8 hours/week saved
- Week 2 addition (dispatcher in shadow): no additional hours-saved yet; unlocks precision routing and per-category specialists from Week 3 onward

## Limits and next steps

- Shadow-mode data is logged but not yet fed into decision logic. Week 3 will use the dispatcher's `category` + `requires_human_review` signals to pick specialists.
- The current eval uses mock fixtures only. A real-traffic eval (with cleansed production samples) is gated on the compliance review planned for Week 4.
- The fallback rules are a safety net, not a primary path. Any production deployment requires an active API key; the fallback exists so a local dev environment never hard-fails.
- Cost accounting per ticket lands in Week 4 (per-request token tracking on both providers).

## Reuse notes for other teams

1. Start with the taxonomy, not the prompt. Argue about the seven (or N) categories until they are mutually exclusive and collectively exhaustive. Prompt quality cannot rescue a bad taxonomy.
2. Write the fixture set before writing the prompt. Every time you want to change a prompt, you also want a fixture that proves the change helps.
3. Ship the dispatcher in shadow mode first. The delta between legacy routing and new routing is the Week-N metric you report.
4. Do not let the dispatcher call tools or write to the database. Classification only. Specialists handle actions.
5. PII redaction runs on the raw text once, before any model call. Every specialist downstream inherits the redacted string.

## Appendix — horror-story defenses

| Risk | Our defense |
|---|---|
| Air Canada-style policy invention | Dispatcher only classifies; it does not answer. Answers come from RAG-backed specialists with grounded context. |
| Chevy $1 Tahoe via prompt injection | Prompt-injection patterns route to `escalate` with `requires_human_review=true`. Dispatcher has no tool access. |
| Cursor "Sam" hallucinated policy | `source` field on every dispatch result distinguishes `model` vs `fallback`. Downstream agents see the provenance and can back off. |
| PHI mishandling | Mandatory redaction before any LLM call; PHI mention forces human review regardless of category. |
