---
name: hallucination-defense
description: Use whenever adding or reviewing any Claude-powered or GPT-powered output that will be shown to a customer, used to make a business decision, or written back to a system of record. Enforces Sage Franch's hallucination-mitigation playbook — RAG, Refusal Trigger, Dual-Model Judge, faithfulness and semantic-entropy metrics, five-point production checklist.
---

# Hallucination Defense

Source: Fluent Knowledge Base, "A Project Owner's Guide to AI Hallucinations in 2026" by Sage Franch. Industry benchmarks (HELM, LMSYS) still put frontier-model hallucination at 15–20% on complex reasoning, 3–5% on simple factual recall. The job is not to eliminate them; it is to build systems that detect, contain, and recover from them.

## The three hallucination types

| Type | What it looks like | Why it's dangerous |
|---|---|---|
| Factual Fabrication | Invented policy, invented citation, wrong number | Most common; easiest to catch with RAG |
| Logical Drift | Correct premises, flawed chain, wrong conclusion | Hardest to catch; reads as well-reasoned |
| Source Misattribution | Real claim attributed to wrong source, or fake source | Legal-liability grade risk |

## Prevention pillars

### 1. RAG (Retrieval-Augmented Generation)

Fetch authoritative documents from a trusted knowledge base at inference, inject into the context window, constrain generation to those documents. Well-implemented RAG reduces factual fabrication by 60–80% in domain-specific applications.

Prerequisites: quality, recency, and completeness of the underlying KB are not optional. A stale KB makes RAG worse than no RAG because it gives false confidence.

### 2. The Refusal Trigger

Teach the model to say "I don't know" rather than guess. Three layers:

- System prompt that explicitly authorizes refusal when uncertain.
- Confidence scoring via token-level log-probabilities; below threshold → refusal path.
- Retrieval-gated generation: if retrieval returns nothing above a minimum relevance score, block generation and show the fallback.

A refusal is only useful if it has an escalation path. Never dead-end the user on a refusal.

## The Dual-Model architecture (the scoring differentiator)

Generator + Judge, two different models, independent verification. The Judge is typically 5–10× cheaper per token; verification adds 200–500 ms.

```
user query
    │
    ├─► Generator (Claude / GPT-5 / gpt-5.4-mini) ──► draft response
    │
    ├─► retrieval ───────────────────────────────► reference docs
    │
    └─► Judge (Haiku / gpt-4o-mini / nano) ◄──── claims from draft + references
                                             │
                                             ▼
                              confirm / correct / escalate
```

Three rules when implementing the Judge:

1. **Claim-level evaluation, not holistic.** Break the Generator's output into individual claims; verify each against the references. Holistic review misses what granular review catches.
2. **Different model than the Generator — non-negotiable.** Sage Franch's RegTech precedent (April 24 office hours): models are measurably more honest about *another* model's work than their own. Same model confirms its own errors. Use a different vendor or family for the Judge if at all possible. Gemini was the most honest reviewer in Sage's six-month-old testing; the principle is model diversity, not Gemini specifically. If only one deployment is available short-term, document the constraint and plan a second-model rollout.
3. **Fail loud, not silent.** On Judge disagreement the system must correct, regenerate, or escalate — never ship the unverified draft.

## Metrics to track

| Metric | What it measures | External target | Internal target |
|---|---|---|---|
| Faithfulness | supported claims / total claims | ≥ 0.95 | ≥ 0.90 |
| Semantic Entropy | answer variance across rephrasings | ≤ 0.15 | ≤ 0.25 |

Report both in every weekly update alongside macro F1. They are the difference between a pipeline that might be accurate and a pipeline we can defend as reliable.

## Risk ratings for our use case

| Context | Risk | Primary concern | Recommended stack |
|---|---|---|---|
| **Public customer-facing auto-reply** | HIGH | Fabricated policy, invented commitment → legal liability | RAG + Dual-Model + Human-in-the-loop for edge cases |
| **Dispatcher classification** | MEDIUM | Wrong category → wrong specialist → bad resolution | RAG-grounded examples + Judge + confidence thresholding |
| **Draft-assist for human agents** | LOW | Agent catches errors before they ship | Base model + editorial review |

Our POC is currently routing high-risk items (GDPR, legal threats) through `requires_human_review=true`. The next gap is adding a Judge on the dispatcher output so the `category` itself is verified before the downstream pipeline trusts it.

## The owner's five-point production checklist

Sign off on each before any model-driven feature goes to users:

1. **Knowledge Base Audit** — completeness, accuracy, recency. Documented refresh cadence. Coverage gaps identified and accepted or remediated.
2. **Hallucination Benchmark** — tested against a domain-specific benchmark with **at least 200 test cases**. Faithfulness meets the target for the use case's risk level. Results versioned.
3. **Guardrail Validation** — Dual-Model pipeline tested with adversarial prompts; Judge correctly flags at least **90%** of known fabrications in the test set.
4. **Escalation Path** — clear human escalation for refusals and Judge-flagged responses. SLAs defined (e.g. 2-hour first-touch). Fallback UX user-tested.
5. **Monitoring & Alerting** — real-time faithfulness and semantic entropy, alerts when metrics degrade, runbook to disable AI and fall back to static content within **15 minutes**.

## Horror-story defenses

| Case | What happened | Our defense |
|---|---|---|
| Air Canada | Chatbot invented a refund policy, airline held liable | Dispatcher never answers; RAG-grounded specialists only |
| Chevy Watsonville | Prompt injection → "legally binding $1 Tahoe" | Injection patterns → `escalate` + human review; dispatcher has no tool access |
| Cursor "Sam" | Bot hallucinated a subscription policy, invented a persona | `source: model\|fallback` on every result gives provenance; no persona role |

## When to invoke this skill

Always, for every one of these:
- Adding a new LLM call to the pipeline.
- Reviewing a prompt before it ships to production.
- Writing the Risks section of a weekly report.
- Drafting the Verified Recipe's "decisions and why" section.
- Setting up any metric dashboard that includes AI output.
