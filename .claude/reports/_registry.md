# Agent-Coordination Registry

Master index of artifacts produced by the orchestrator and specialist agents for this project. See `.claude/skills/multi-agent-orchestration/SKILL.md` for rules.

**Format:** one line per entry. Newest at the top.

```
- [YYYY-MM-DD] [<artifact-title>](path/to/file.md) — <one-line hook: what + key metric>
```

## Entries

<!-- example:
- [2026-04-18] [Ticket TCK-001 classification](classification/2026-04-18-tck-001.md) — intent=billing conf=0.91
- [2026-04-18] [Dispatcher eval baseline](eval/2026-04-18-dispatcher-baseline.md) — F1=0.78 (below 0.80 target)
-->

- [2026-04-25] [Week 4 weekly report](weekly/2026-04-25-week-4.md) — three specialists live, monitor hook, ECE 0.017, agent test 10/12 consistent, full Verified Recipe draft
- [2026-04-27] [Agent test harness baseline](eval/2026-04-27-agent-test-harness.md) — 12 × 3 multi-run consistency, 10/12 PASS, two legitimate refusals for KB scope
- [2026-04-27] [Confidence calibration](eval/2026-04-27-calibration.md) — 120-case ECE 0.017, recommended threshold 0.95 (current 0.70 conservative)
- [2026-04-25] [Verified Recipe (full draft)](recipe/recipe.md) — complete recipe with code map, decisions, ROI math, adoption checklist for other Valsoft units
- [2026-04-24] [Weeks 2+3 combined report](weekly/2026-04-24-week-2-and-3.md) — live routing, FAQ specialist, Judge, multimodal intake, cost tracking; F1 0.967, cost ~$0.0006/ticket
- [2026-04-20] [Dispatcher iterated eval](eval/2026-04-20-dispatcher-baseline.md) — 120 fixtures, accuracy 96.7% / macro F1 0.967 / human-review 99.2%; account F1 0.971 after prompt iteration
- [2026-04-20] [Week 2 weekly report](weekly/2026-04-20-week-2.md) — eval set + harness + shadow-mode shipped; macro F1 0.940 on 120-case eval via Azure gpt-5.4-mini; Azure adapter added to client.ts
- [2026-04-20] [Verified Recipe outline](recipe/outline.md) — architecture + decisions + reuse notes for the PII-safe model-agnostic dispatcher pattern
- [2026-04-18] [Week 1 weekly report](weekly/2026-04-18-week-1.md) — infra week: adapter + redact + dispatcher shipped; no new hours saved yet; F1 target 0.80 for Week 2
- [2026-04-18] [Password-reset journey map](journey/password-reset.md) — first end-to-end scenario; defines Week-2 eval seed (≥20 cases)

## Conventions

- Subdirectories: `classification/`, `resolution/`, `escalation/`, `eval/`, `journey/`, `arch/`.
- Filenames: `YYYY-MM-DD-<slug>.md`.
- Only the orchestrator writes here. Specialists return artifacts via their tool output; the orchestrator adds the registry line.
- Registry lines stay ≤ 150 chars so this file stays scannable.
