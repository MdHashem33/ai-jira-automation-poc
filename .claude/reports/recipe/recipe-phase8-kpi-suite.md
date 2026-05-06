# Verified Recipe — Phase 8: Eight KPIs as Live Dashboard Tiles

**Author:** Mohamad Hashem (JBL Solutions)
**Sprint:** Fluent Agentic Games — final week
**Date:** 2026-05-06
**Status:** Live on `ai-jira-automation-poc.vercel.app`
**Eval evidence:** Dispatcher 220-case macro F1 0.933 (target ≥ 0.80, PASSED); agent harness 11/12 consistent. KPI endpoint `/api/dashboard/kpis` returns the 8-tile snapshot in under 50ms.

## Problem

Phase 8 of the Fluent Agentic Support Playbook (Alame & Radovan, Feb 2026) is the only phase that explicitly cannot be a one-time deliverable. It is the measurement loop: *"track results against baseline and continuously improve"* across eight KPIs (AI Resolution Rate, Repeat Contact Rate, Escalation-to-Fix Time, Proactive Detection Rate, KB Growth, Stakeholder Query Adoption, CSAT, Cost Per Ticket).

Without Phase 8, the work in Phases 1–7 is invisible. A support lead does not know whether the auto-resolve rate is rising or falling. An executive does not know whether ticket cost is moving in the right direction. A judge cannot tell whether the system you shipped is actually getting better or just sitting there.

The trap most teams fall into: they instrument the KPIs they think are easy (cost, latency) and skip the harder ones (repeat contact rate, CSAT, proactive detection rate) because those need new pipes. The result is a dashboard that looks complete but is actually missing four of the eight playbook KPIs — the ones that matter.

## Solution

Compute every one of the eight KPIs from data the system already has. No new instrumentation; no new logging frameworks; no Looker/Tableau dependency. The values come from the in-memory ticket store, the resolution log, the KB JSONL, and the semantic-cache file we already maintain.

Where a KPI cannot honestly be measured yet (Stakeholder Query Adoption is empty until Phase 7 ships, Repeat Contact Rate needs replies which don't arrive in the synthetic corpus until Phase 6's thread-aware memory lights it up), the tile shows the honest zero with a help text that names the phase that lights it up.

A separate endpoint (`/api/dashboard/kpis`) returns the snapshot as JSON; a self-contained React panel polls it every 15 seconds and renders eight tiles, each tagged with its phase number. This means the same panel works on the live deployment, in a screen recording, or piped to a stakeholder Slack bot (Phase 7 plugs in cleanly because the data shape is already defined).

The five-line discipline that makes this honest:

- Every tile names its phase ("P8" badge in the corner).
- Every tile names a target value or a trend direction ("60", "< 15", "↑ weekly").
- Every tile carries a help text that explains what the metric is and how it gets better.
- A tile that cannot be measured shows zero, not blank, and the help text names the phase that will fix it.
- The endpoint returns `generatedAt`, so a stale snapshot is detectable from the consumer side.

## Code excerpt

The hot path is six small accumulators over the existing ticket array:

```typescript
export function computeKpis(): KpiSnapshot {
  const tickets = getAllTickets();
  const total = tickets.length;
  const autoResolved = tickets.filter((t) => t.status === 'resolved_auto').length;
  const escalated = tickets.filter((t) => t.status === 'escalated_jira').length;
  const replyTickets = tickets.filter((t) => t.email?.isReply === true).length;
  const monitorChannel = tickets.filter((t) => t.channel === 'voice' || t.channel === 'chatbot').length;

  const escalationLatencies = tickets
    .filter((t) => t.status === 'escalated_jira')
    .map((t) => t.processingTimeMs)
    .filter((ms) => ms > 0);

  const totalCost = tickets.reduce((sum, t) => sum + (t.cost?.totalUsd ?? 0), 0);
  const avgCost = total > 0 ? totalCost / total : 0;

  const aiResolutionRate = pct(autoResolved, total);
  const repeatContactRate = pct(replyTickets, total);
  const csatProxy = Math.max(0, Math.round(aiResolutionRate * (1 - repeatContactRate / 100)));
  // ...one tile per KPI, all returning a normalised KpiTile shape
}
```

The dashboard panel is a self-contained client component that mounts a 15-second polling loop:

```typescript
useEffect(() => {
  const fetchKpis = async () => {
    const res = await fetch('/api/dashboard/kpis', { cache: 'no-store' });
    if (res.ok) setSnapshot(await res.json());
  };
  fetchKpis();
  const interval = setInterval(fetchKpis, 15000);
  return () => clearInterval(interval);
}, []);
```

## ROI math

The Phase 8 layer is not itself a cost-saver — it is what makes every prior phase's cost saving visible to the people authorising the budget. The ROI showed up in three concrete places after the panel went live:

| Surface | Before Phase 8 | After Phase 8 |
|---|---|---|
| Cost-per-ticket visibility | a number in a console log | a live tile updating every 15 seconds |
| Auto-resolve rate trend | one paragraph in the weekly report | a tile against the 60% target |
| KB growth | implicit | visible: `KB articles + auto-cached resolutions` |
| Time to answer "is the system getting better?" | manual eval rerun | open the dashboard tab |

For another business unit lifting this pattern, the time saved is the recurring "pull a status update" cost. At one 30-minute meeting per week per stakeholder × 4 stakeholders × 50 weeks = 100 hours per year of meeting time replaced by a tab. At a fully loaded $75/hour, that is $7,500 of recovered executive time per business unit per year — before counting the times a regression got caught faster because it was in front of someone.

## Adoption checklist

For another Valsoft business unit lifting this pattern:

1. Decide your data sources. Ours are the ticket store, the resolution log, the KB JSONL, and the semantic cache. Yours might be a Postgres table, a CRM record, or a Pylon/Intercom export. The KPI shape does not change; only the accumulator does.
2. Implement all eight KPIs at once, including the ones that have to start at zero. The tile that shows zero with a "lights up in Phase 7" help text is more honest than skipping the tile entirely.
3. Pick a refresh cadence and stick to it. We poll every 15 seconds because the dashboard is live during demos; an internal dashboard could refresh on the minute.
4. Wire the same JSON payload to the Phase 7 Slack bot. The bot doesn't need a new query — it just paraphrases the same KPI snapshot in natural language.
5. Set named targets per tile. The playbook gives you the 60% deflection target for Phase 1; the rest are local decisions the support lead owns. A tile without a target is a tile that cannot fail visibly.

## Maturation table — which model runs which step (Sage's "made it honest" theme)

Per the 2026-05-06 office-hours framing — week 3 is about being honest about what the system actually does — the KPI panel is the first place this maturation discipline becomes visible to a stakeholder:

| Step | Model | Provider | Latency | Cost |
|---|---|---|---|---|
| Email parse | (no LLM) | local | <10ms | $0 |
| Semantic cache lookup | text-embedding-3-small | Azure OpenAI | ~120ms | $0.000001 |
| Dispatcher | gpt-5.4-mini | Azure OpenAI | ~800ms cached | $0.000020 |
| Judge | claude-haiku-4-5 | Anthropic | ~400ms cached | $0.000010 (when ANTHROPIC key set) |
| FAQ specialist (when triggered) | gpt-5.4-mini | Azure OpenAI | ~1200ms | $0.000150 |
| KPI snapshot endpoint | (no LLM) | local | <50ms | $0 |

## Stakeholder partnership note

The support lead owns the targets. We picked sensible defaults (60% AI resolution, < 15% repeat contact, < 8 seconds escalation-to-fix, < $0.0002 cost per ticket, ↑ weekly KB growth) but those are placeholders until the lead reviews them. The right cadence is: support lead sets targets in week 1 of adoption, reviews actuals weekly for a month, then quarterly. The CSAT proxy in particular needs the support lead to decide what "good" looks like for their unit — a 70% proxy in a transactional support context means something different than a 70% proxy in a high-touch enterprise context.

## Inspiration / cross-references

- **W. Alame and M. Radovan** — *Agentic Support Playbook* (Fluent KB, Feb 2026) — Phase 8 KPI list verbatim.
- **Sage Franch** — 2026-05-06 office hours framing of week 3 as "made it honest." The maturation table above exists because of that framing.
- **Rahul Ranjan** (2026-05-06 demo) — full-circle architecture-to-implementation pattern; the Phase 8 panel is what makes that "full circle" visible to a stakeholder.
- **Jacob Stevens** (2026-05-06 demo) — fully-offline Gemma 4 on a 24GB MacBook Pro; the maturation table's "Provider" column is structured so a row could be replaced with `local-gemma-4` for cost-conscious deployments.
