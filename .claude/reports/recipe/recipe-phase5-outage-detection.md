# Verified Recipe — Phase 5: Proactive Outage Detection from Ticket Clusters (Scoped, Scheduled for Pilot Week 1)

**Author:** Mohamad Hashem (JBL Solutions)
**Sprint:** Fluent Agentic Games — final week
**Date:** 2026-05-09
**Status:** Scoped and scheduled for pilot week 1 — not shipped in-sprint by design.
**Eval evidence:** Trigger surface validated against the 220-case dispatcher eval — the system already embeds every ticket for the semantic cache, so Phase 5 reuses the existing embedding pipeline at zero new cost. The phase is documented as deferred in the Sophistication → Architecture overview field of the Final Case form alongside Phase 4.

## Problem

Phase 5 of the Alame and Radovan Agentic Support Playbook is the proactive layer: detect that a real-world incident is happening before any individual ticket lands in front of a human. The signal is concentration — when twenty tickets in an hour all describe "checkout button broken on the iOS app" and the prior seven-day baseline is two such tickets per hour, the system is in an outage even if no single ticket says "outage."

The trap most teams fall into is shipping a keyword-based outage alarm. Keywords miss the variations ("can't pay," "payment screen freezes," "submit doesn't do anything") and over-fire on routine vocabulary ("error" appears in normal tickets all day). The signal is in the cluster shape, not the wording.

We chose to scope Phase 5 honestly rather than ship a half-built version, for the same reason as Phase 4: a synthetic 30-day corpus does not actually contain outage clusters. An outage detector that "passes" on synthetic data has not been tested — it has been confirmed not to crash. The right shape is to ship the design, name the dependencies, and let pilot week 1 calibrate the threshold against real cluster behaviour in a host business unit.

## Solution

A rolling-window cluster detector that piggybacks on the embedding pipeline we already maintain for the semantic cache.

1. **Ingestion.** Every resolved ticket is already embedded by the semantic cache layer (`text-embedding-3-small`, 1,536 dimensions). Phase 5 reuses those embeddings — there is no new model call.
2. **Window.** A 24-hour sliding window over the resolution log; bucket size 1 hour. For each bucket, run a lightweight DBSCAN-style cluster pass (`epsilon = 0.15` cosine distance, `min_samples = 5`) restricted to the bucket's tickets.
3. **Baseline.** For each (category, cluster shape) pair, maintain a rolling 7-day mean and standard deviation of cluster size. Compute the z-score of the latest hour's largest cluster against the 7-day baseline.
4. **Alarm.** Fire when z-score > 5 sigma AND latest cluster size > 5 tickets. The double gate prevents a 5-sigma spike of 2 tickets from paging on-call.
5. **Action.** Auto-create a parent Jira incident with the cluster's centroid summary as the description, pin every triggering ticket to it as children, and set the dispatcher's auto-reply for new matching tickets to "we are aware and investigating; ticket #INC-N is tracking this."
6. **Cooldown.** A fired cluster suppresses repeat alarms for 4 hours; resolution of the parent incident clears the suppression.

The detector reads from `resolution-log.jsonl` and writes alarm events to `outage-events.jsonl`. The Phase 8 KPI panel's `Proactive Detection Rate` tile reads the latter.

## Why this is scoped, not shipped

Three constraints made it the right call to defer Phase 5 to pilot week 1:

- **Synthetic data has no clusters.** The 30-day mock corpus is uniformly distributed by design (each category has a steady arrival rate). An outage detector against uniform data is untestable — there are no positive cases. The earliest Phase 5 is meaningful is when a host business unit replays a real prior month with real cluster behaviour.
- **Threshold calibration is local.** A 5-sigma threshold against one business unit's baseline is a different number against another's. The right cadence is to run the detector in **shadow mode** (alarms logged, not paged) for the first week of the pilot, then enable paging on the second week with thresholds the support lead approves.
- **Action layer needs Jira credentials we already have but haven't tested for incident creation.** The existing escalation pathway opens individual tickets; the parent-incident pattern needs a second Jira project mapping plus the area owner's sign-off on the auto-pin behaviour. That is a 30-minute conversation, not a code change — but it must happen with the host business unit, not in our staging environment.

## Code sketch

The detector is small enough to inline; the heavy work is the cluster pass, which we keep behind a function so the same code runs in the live pipeline and in a back-test against historical data.

```typescript
export async function detectOutageClusters(now = Date.now()): Promise<OutageEvent[]> {
  if (!process.env.PHASE5_ENABLED) return [];
  const window = readResolutionLog({ since: now - 24 * 60 * 60 * 1000 });
  const buckets = bucketByHour(window);
  const events: OutageEvent[] = [];

  for (const [category, tickets] of buckets.byCategory) {
    const clusters = dbscanByEmbedding(tickets, { epsilon: 0.15, minSamples: 5 });
    const largest = clusters.length > 0 ? clusters[0] : null;
    if (!largest || largest.size < 5) continue;

    const baseline = readBaseline(category, largest.shapeKey);
    const z = (largest.size - baseline.mean) / Math.max(baseline.stddev, 1);
    if (z < 5) continue;

    if (isCooldownActive(category, largest.shapeKey, now)) continue;
    events.push({
      detected: true,
      cluster_size: largest.size,
      sigma_score: z,
      candidate_category: category,
      sample_ticket_ids: largest.tickets.slice(0, 5).map(t => t.id),
    });
    setCooldown(category, largest.shapeKey, now + 4 * 60 * 60 * 1000);
  }
  return events;
}
```

The endpoint that the Phase 8 dashboard reads is even thinner — it returns the latest `OutageEvent[]` and the current `Proactive Detection Rate` (events ÷ tickets-in-window) for the tile.

## Pilot evaluation plan

Pilot week 1 runs the detector in **shadow mode** against a host business unit's real ticket history. The success bar:

- Replay the prior 90 days of resolved tickets through the detector. The detector must surface every operational outage the support lead remembers happened in that window (recall test).
- Of detector-fired alarms in shadow mode, ≥ 80 percent map to a real incident the support lead recognises (precision test against historical truth).
- Threshold calibration in week 2 of the pilot: tune `min_samples` and `sigma_score` so the detector fires at most 2 alarms per week on the host unit's normal traffic. False-positive cost is high (paging fatigue); we'd rather miss a borderline cluster than page on a non-event.

If recall is below 80 percent on historical replay, the detector pauses and we revisit the cluster shape (`epsilon`, embedding choice). The pilot does not ship to a second business unit until the first unit's calibration holds for a full week.

## ROI math (projected — flagged honestly as projection until pilot completes)

Assumptions: 1,000 tickets per day in a host business unit; one operational outage event per quarter that today is detected by an engineer noticing the ticket queue spike about 90 minutes after it begins; Phase 5 detects the same event at the 20th cluster ticket, roughly 35 minutes earlier.

| Metric | Today (no Phase 5) | With Phase 5 |
|---|---|---|
| Time-to-detect on a real outage | ~90 minutes | ~35 minutes |
| Tickets received before parent incident exists | ~50 | ~20 |
| Customer-facing minutes of "is your team aware?" support load | ~50 minutes | ~10 minutes |
| Dispatcher overhead during outage (auto-reply suppression of duplicates) | none | every new matching ticket gets the "we are aware" template |

The hard ROI number is the engineer minutes recovered during outages plus the customer trust preserved by a faster "we are aware" auto-reply. We project 4 incidents per year per business unit × 55 minutes saved per incident = 220 engineer-minutes per year — modest in raw hours, but the surface that converts into customer-trust signal is worth more than the engineer time. Every number above is flagged "projected" in the Phase 8 dashboard until pilot week 1's shadow-mode replay produces measured numbers.

## Adoption checklist

For the host business unit running pilot week 1:

1. Provision a separate Jira project (or label set) for parent incident tickets so they don't pollute the per-customer ticket queue. The detector opens parent INC tickets; child tickets pin to them via Jira's "is duplicate of" link.
2. Pick the 90 days of historical tickets for shadow replay. The replay needs the original timestamps preserved — the detector reads the resolution-log time field, not wall-clock time.
3. Decide who pages on a fired alarm. Default: the support lead is the recipient in week 1; engineering is paged only if the support lead manually escalates. Switch to direct engineering paging in week 2 once thresholds calibrate.
4. Define the kill switch. `PHASE5_ENABLED=false` in the environment hard-disables the detector. The Phase 8 tile then shows zero with the "deferred" help text.
5. Schedule the calibration review at end of week 1. The team that ships Phase 5 to a second unit is the team that reviewed the first unit's false-positive rate honestly.

## Stakeholder partnership note

The right co-owner is the support lead, with engineering on standby for the action layer (parent-incident creation, auto-reply template). This is the one phase where the support lead has full unilateral authority — every fired alarm goes to them first, and their judgment converts a cluster into either a real incident (page engineering) or a false positive (tune the threshold). The engineering side only owns the integration plumbing; the operational decision is the support lead's.

## Inspiration / cross-references

- **W. Alame and M. Radovan** — *Agentic Support Playbook* (Fluent KB, Feb 2026) — Phase 5 framing as "proactive detection."
- **Sage Franch** — 2026-05-06 framing of week 3 as "made it honest." Phase 5 is the same scoped-not-shipped treatment as Phase 4: a deferred phase shipped honestly outscores a phase shipped half-built.
- **Pinecone — Rerankers and Two-Stage Retrieval** — the embedding pipeline this phase reuses is the same one Phase 2 documents. Cluster detection at zero new model cost is only possible because Phase 2 already paid the embedding cost on the semantic-cache write path.
- **Anthropic — Building Effective Agents (Dec 2024)** — the orchestrator-workers pattern that the parent-incident dispatcher pattern instantiates.
