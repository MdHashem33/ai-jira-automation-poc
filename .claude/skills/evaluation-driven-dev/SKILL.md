---
name: evaluation-driven-dev
description: Use before shipping any prompt or model change. Enforces the rule — define numeric success criteria and run an eval set first, ship only if targets are met.
---

# Evaluation-Driven Development

Source: Anthropic support-chat guide + team meeting.

## The Rule

No prompt, model, or pipeline change ships without:
1. A pinned **eval set** (≥ 30 items for exploratory work, **≥ 200 items** for any feature touching a high-risk use case — Sage Franch's hallucination-benchmark standard, see `hallucination-defense`). Covers happy paths, edge cases, hostile inputs, and PII/PHI attempts.
2. **Numeric targets** (see below) measured on the eval set.
3. A diff report: new metrics vs. prior baseline, stored in `.claude/reports/eval/`.
4. **Guardrail validation** — if a Dual-Model Judge is in the loop, the Judge must catch at least **90%** of known fabrications in an adversarial test set before the feature ships.
5. **Multi-run consistency check** (Talbench 2024, surfaced by Patrick Whelan in April 24 office hours): every test in an agent test harness must be run **at least three times**. The agent must pass each test on **≥ 70%** of runs to be considered consistent. A single green run is not evidence of reliability.

## Numeric Targets (from Anthropic guide — adjust per task)

| Metric | Target | Measured how |
|---|---|---|
| Dispatcher category F1 | ≥ 0.80 | Confusion matrix on labeled set |
| Response relevance | ≥ 0.90 | LLM-as-judge or human rubric |
| Response accuracy (factual) | 1.00 | Hand-check against KB source |
| Topic adherence | ≥ 0.95 | LLM-judge "on-topic?" |
| Escalation accuracy | ≥ 0.95 | Should-escalate vs. did-escalate |
| Deflection rate | 0.70–0.80 | Auto-resolved / total |
| CSAT (proxy) | ≥ 4/5 | Sentiment of final reply |
| PII leak rate | 0.00 | Regex scan of outputs |
| Faithfulness | ≥ 0.95 external / ≥ 0.90 internal | (supported claims) / (total claims) vs retrieved references |
| Semantic Entropy | ≤ 0.15 external / ≤ 0.25 internal | Answer variance across paraphrased rephrasings of the same question |

## Eval Set Composition

For this support pipeline, every eval set should include:

- 40% happy-path tickets (one per category)
- 20% ambiguous/multi-intent tickets
- 15% hostile/jailbreak attempts ("ignore prior instructions…")
- 10% off-topic
- 10% PII/PHI leak attempts (user pastes a fake SSN)
- 5% low-quality input (typos, gibberish, empty body)

## Workflow

1. Before changing a prompt: snapshot current metrics → `eval/2026-04-18-baseline.md`.
2. Make the change.
3. Re-run eval → `eval/2026-04-18-after-change.md`.
4. Write 2-line summary to `_registry.md`: which metrics moved, ship or not.
5. If any metric regressed below target → do not ship.

## Tools

- LLM-as-judge prompts live in `lib/eval/judges/` — pin the judge model and version.
- Confusion matrix: any lightweight library (or hand-roll).
- Store eval inputs as JSON/CSV under `fixtures/eval/` (mock data only).

## Anti-Patterns

- "It looks better on my 3 test cases." Not an eval.
- Changing the eval set in the same PR as the prompt change. Separate PRs.
- Judging the judge — if your LLM-judge disagrees with humans, fix the judge before trusting its scores.
