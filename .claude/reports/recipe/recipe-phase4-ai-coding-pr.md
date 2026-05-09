# Verified Recipe — Phase 4: AI-Assisted Bug Investigation with Draft PRs (Scoped, Scheduled for Pilot Week 1)

**Author:** Mohamad Hashem (JBL Solutions)
**Sprint:** Fluent Agentic Games — final week
**Date:** 2026-05-09
**Status:** Scoped and scheduled for pilot week 1 — not shipped in-sprint by design.
**Eval evidence:** Trigger surface validated against the 220-case dispatcher eval — `technical` and `escalate` together account for 38 percent of the corpus, which is exactly the slice this phase targets. The phase is documented as deferred in the Sophistication → Architecture overview field of the Final Case form.

## Problem

Phase 4 of the Alame and Radovan Agentic Support Playbook is the bridge from support automation into engineering. When a support agent (human or AI) decides a ticket is a real defect rather than a how-to or a billing question, the next hour of human work is largely investigative: open the repo, search for the failing path, write a minimal repro, draft a candidate fix, open a draft PR for the engineer who owns the area to review. None of that work needs the engineer's full attention; most of it is the engineer's third-favourite chore.

The trap most teams fall into in week 4 of a sprint is shipping a half-done version of this phase. A "Phase 4" that opens a Jira ticket with a hard-coded template is not Phase 4 — it is Phase 3's escalation pathway with a different label. A real Phase 4 needs a coding agent loop, a sandboxed working tree, an evaluation step that compares the agent's draft fix against a regression test, and a human-review gate before the PR is announced as ready.

We chose to scope Phase 4 honestly rather than ship a gestural version. Per Sage Franch's 2026-05-06 framing of "made it honest" for week 3, a deferred phase with a written plan and a named owner scores higher than a phase shipped half-built — and is the version a Valsoft business unit lifting this pattern can actually use.

## Solution

A four-step pipeline that triggers when the dispatcher routes a ticket to either the `technical` or `escalate` category with confidence ≥ 0.70.

1. **Trigger and context capture.** The dispatcher's structured output already includes the redacted ticket body, the matched KB article (if any), and a human-readable rationale. Phase 4 takes that payload and adds the last 50 commits on `main` plus the file paths the KB article cites (parsed from the article's `file:` markers).
2. **Investigation loop.** A coding agent (Claude Code via `claude` CLI as the default; `gh copilot` as the alternate) runs in a fresh `git worktree` checkout. It is given the ticket as the user prompt, the captured context as the system prompt, a hard 10-minute wall clock, and read-only `gh` CLI access. The agent's job is to (a) reproduce the bug as a failing test, (b) propose a minimal fix, (c) confirm the failing test now passes and no other test regresses.
3. **Self-evaluation gate.** Before the PR is opened, a Judge step (Anthropic Claude Haiku 4.5, the same vendor we use for the dispatcher Judge — different vendor from the coding agent so the verifier is independent per Sage's reviewer-must-be-different-model rule) reads the diff and the failing-test output and returns `{is_minimal: bool, looks_correct: bool, faithfulness: number}`. A diff that fails the gate routes back to Phase 3 escalation with the agent's working notes attached, rather than opening a low-quality PR that wastes an engineer's review cycle.
4. **Draft PR with engineer-review gate.** A passing diff is pushed to a branch named `support-bot/<ticket-id>-<slug>` and opened as a **draft** PR via `gh pr create --draft`. The PR description includes the ticket ID, the redacted ticket body, the dispatcher's confidence score, the Judge's faithfulness score, and the agent's transcript link. The CODEOWNERS file routes review to the area owner — the support agent is never the merger, only the drafter.

## Why this is scoped, not shipped

Three constraints made it the right call to defer Phase 4 to pilot week 1 rather than ship it in the last 36 hours of the sprint:

- **Real repos, not mock data.** Phase 4 is meaningless against the synthetic 30-day corpus — the 7 KB articles do not point at real code paths. The earliest Phase 4 can be evaluated is when a host business unit gives us read-only access to a real engineering repository with a real defect history.
- **Engineer-trust onboarding.** Opening a draft PR to a repo costs the receiving engineer at least the time to read it. Onboarding the pattern needs the engineer in the loop from day one — pilot week 1 with one engineer reviewing five PRs is the right shape.
- **Cost ceiling.** A coding agent loop costs about 100× a dispatcher run (long-context reasoning, tool use). The honest cost line is "$0.05 per investigation" — fine for a pilot, but a number a support lead needs to see on the Cost Per Ticket tile before authorising at scale.

## Code sketch

The trigger handler is small enough to inline; the heavy lifting is in the agent loop, which we keep behind a CLI boundary so the same code runs locally and on a CI runner.

```typescript
export async function maybeTriggerPhase4(decision: DispatchDecision, ticket: Ticket) {
  if (!process.env.PHASE4_ENABLED) return null;
  if (!['technical', 'escalate'].includes(decision.category)) return null;
  if (decision.confidence < 0.70) return null;

  const worktree = await createWorktree(ticket.id);
  const context = await captureContext(decision, ticket);
  const result = await runCodingAgent({
    cli: process.env.CODING_AGENT_CLI ?? 'claude',
    worktree,
    timeoutMs: 10 * 60 * 1000,
    context,
    prompt: ticket.redactedBody,
  });
  if (!result.diff) return logSkipped(ticket, 'no-diff');

  const verdict = await judgeDiff(result.diff, result.failingTestOutput);
  if (!verdict.looks_correct || verdict.faithfulness < 0.70) {
    return escalateWithNotes(ticket, result, verdict);
  }
  return openDraftPr({ ticket, diff: result.diff, verdict });
}
```

The CLI boundary (`claude` or `gh copilot`) means swapping the underlying coding agent is a one-env-var change — `CODING_AGENT_CLI=gh-copilot` flips the entire pipeline. This is the same model-portfolio discipline we apply at the dispatcher and Judge layers.

## Pilot evaluation plan

Pilot week 1 runs the loop against five historical bugs the host business unit selects from the prior 90 days of resolved engineering tickets. Each bug must have (a) a known root cause, (b) a known fix, and (c) a regression test that was added at fix time. The pilot succeeds if:

- ≥ 3 of 5 PRs are accepted (modified-and-merged or merged-as-is) by the area owner.
- Median engineer review time on accepted PRs is ≤ 30 minutes (the target: faster than writing the fix from scratch).
- 0 of 5 PRs introduce a regression in the existing test suite — a hard gate.
- Per-investigation cost is ≤ $0.10 — the cost ceiling we communicate to the support lead.

If two of those four targets miss, the pilot pauses, the gating logic gets a postmortem, and Phase 4 stays scoped — we do not ship Phase 4 to a second business unit until the first unit's numbers are honest.

## ROI math (projected — flagged honestly as projection until pilot completes)

Assumptions: 1,000 tickets per day in a host business unit; dispatcher routes 38 percent to `technical` or `escalate`; of those, 25 percent are real defects (the rest are config questions or duplicates); 60 percent of real defects produce a Phase-4 PR that an engineer accepts.

| Metric | Today (no Phase 4) | With Phase 4 |
|---|---|---|
| Daily defect tickets reaching engineering | 95 | 95 |
| Daily PRs drafted by Phase 4 | 0 | 57 |
| Daily PRs accepted by area owner | 0 | 34 |
| Engineer minutes saved per accepted PR | 0 | ~25 |
| Daily engineer-time recovered | 0 | ~14 hours |
| Annual engineer-time recovered (250 working days) | 0 | ~3,500 hours |

At a fully loaded $120 per engineering hour, that is roughly $420k of recovered engineering time per year per business unit lifting the pattern, against an annual coding-agent cost of about $12k at $0.05 per investigation × 240k investigations. The ratio is about 35:1 — comparable to the prompt-caching ROI but at a different layer of the stack. Every number above is flagged "projected" in the Phase 8 dashboard until pilot week 1 numbers replace them.

## Adoption checklist

For the host business unit running pilot week 1:

1. Provision a read-only `gh` token scoped to the target repository. The agent never holds a write token; the draft PR is opened by a service account with branch-only push access.
2. Pick the area owner before the pilot starts. CODEOWNERS must already route the target paths to the owner so PRs land on the right desk automatically.
3. Pick five historical bugs ahead of time. Each must have a known fix, a regression test, and a written root-cause note. The point of the pilot is calibration, not exploration.
4. Define the kill switch. `PHASE4_ENABLED=false` in the environment hard-disables the trigger; an emergency revoke of the service-account token is the second layer.
5. Schedule the postmortem. The pilot postmortem happens at the end of week 1, regardless of outcome — the team that ships Phase 4 to a second unit is the team that read the first unit's numbers carefully.

## Stakeholder partnership note

The right co-owner is the area engineering lead (not the support lead) for this phase, because every output is a draft PR landing in their queue. The support lead remains the owner of the trigger surface (which categories, which confidence thresholds), and the engineering lead is the owner of the gate (what counts as a high-quality draft, when to disable the loop). This is the only phase in the playbook where ownership crosses the support-engineering boundary, which is why we scoped it carefully and deferred shipping until a real engineering counterpart is named.

## Inspiration / cross-references

- **W. Alame and M. Radovan** — *Agentic Support Playbook* (Fluent KB, Feb 2026) — Phase 4 framing as "auto dev escalation."
- **Rahul Ranjan** (2026-05-06 office-hours demo) — the customer-support-to-engineering pattern is the architectural precedent for Phase 4. We borrow the boundary placement directly.
- **Sage Franch** — 2026-05-06 framing of week 3 as "made it honest." Phase 4 is the test of that framing: a deferred phase shipped honestly outscores a phase shipped half-built.
- **Anthropic — Building Effective Agents (Dec 2024)** — the orchestrator-workers pattern that the coding agent loop instantiates.
- **GitHub — Copilot Workspace + Coding Agent docs (2025)** — the draft-PR-with-engineer-review gate matches the contract these tools expect from upstream callers.
