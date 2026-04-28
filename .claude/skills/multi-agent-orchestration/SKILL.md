---
name: multi-agent-orchestration
description: Use when designing or coordinating multiple AI agents/sub-agents in this project. Enforces flat hierarchy + registry + context-in-prompt handoff to prevent context amnesia.
---

# Multi-Agent Orchestration

Source: Medium article "How I made Claude Code agents coordinate 100% and solved context amnesia" (Ilyas Ibrahim) + the team's dispatcher strategy.

## Core Rules

1. **Flat hierarchy.** One orchestrator (the "dispatcher") invokes N specialists directly. No coordinator layer.
2. **Specialists are ≤ ~25 lines of prompt each.** If a specialist grows, split it — don't nest.
3. **Context travels IN the invocation prompt, not via shared memory.** Specialists NEVER read the registry or global state on their own.
4. **Orchestrator owns the registry.** After each specialist returns, orchestrator updates `.claude/reports/_registry.md`.
5. **Verify deliverables with bash** (`ls`, `wc -l`) before trusting a specialist's "done" claim.

## Directory Layout

```
.claude/
├── skills/          # these SKILL.md files
├── agents/          # (future) specialist prompt files, one per role
└── reports/
    ├── _registry.md         # master index — one line per entry
    ├── classification/      # dispatcher outputs
    ├── resolution/          # resolver outputs
    ├── escalation/          # Jira-ticket outputs
    └── eval/                # evaluation runs
```

## Handoff Protocol

When the orchestrator delegates:

1. Read only the relevant prior entries in `_registry.md` (by category/date, not full reload).
2. Build a self-contained prompt for the specialist: include ticket text, prior classification, any KB snippets, and expected output schema.
3. Specialist returns a single artifact (file or JSON). No side effects.
4. Orchestrator appends to `_registry.md`: `- [TICKET-123 classification](classification/2026-04-18-ticket-123.md) — intent=billing conf=0.91`.
5. Orchestrator synthesizes final response to user.

## Anti-Patterns (the article's failure modes)

- **Nested coordinators** → context bloat, 15-min amnesia. Flatten.
- **Specialists auto-loading shared protocols** → redundant loads. Only the orchestrator loads coordination logic.
- **Letting specialists talk to each other** → race conditions, duplicate work. Always route through orchestrator.
- **Skipping verification** → "done" without deliverable. Always `ls` the artifact.

## The Reviewer-Layer (Doers + Reviewers) pattern

From Sage Franch's RegTech precedent, shared in the April 17 office hours (24:33): wherever a specialist's output will drive a real-world action with real risk, route it through a **Reviewer** agent trained for a different objective than the **Doer**. Doers are creative and far-reaching; Reviewers are risk-averse and detail-oriented.

For our POC:
- Dispatcher output (category + confidence) feeding a specialist → pass through a Judge that verifies the classification against retrieved KB snippets before the specialist acts.
- Specialist draft reply (how-to, account recovery, billing) → pass through a Reviewer that checks for grounding, tone, absence of invented policy, and PII leakage.
- Compliance-category or legal-threat items → always Reviewer, never auto-send.

This is the Dual-Model Judge pattern under a different name. See `hallucination-defense` for metrics (Faithfulness ≥ 0.95, 90% guardrail catch rate) and production-checklist steps.

## When to use this skill

- Designing any workflow with ≥2 AI calls where outputs chain.
- Splitting a monolithic pipeline into dispatcher + specialists.
- Debugging "the agent forgot what we did earlier".
- Deciding whether to add a Reviewer layer on a specialist output.
