# Loom Script — Final Submission Demo

**Target length:** 5–7 minutes. **Hard cap:** 7 minutes.
**Setup:** Loom desktop app, "Cam + screen" or "Screen only." Single Chrome window, full-screen, address bar visible. Close all other tabs and notifications.

Open these tabs in this order before you hit record:

1. `https://ai-jira-automation-poc.vercel.app/` — Simulator tab
2. `https://ai-jira-automation-poc.vercel.app/` — Dashboard tab (Phase 8 KPI panel visible)
3. `https://ai-jira-automation-poc.vercel.app/api/dashboard/kpis` — raw JSON for the closing shot
4. `https://ai-jira-automation-poc.vercel.app/api/dev/smoke` — fallback if anything breaks live

Read the lines below aloud. Slow down on numbers. Don't apologise on stumbles — keep going, the judges are watching one take per team, not your edit pass.

---

## Beat 1 — Cold open (0:00 – 0:25)

> Hi, I'm Mohamad Hashem from JBL Solutions. This is the customer support automation system for the Fluent Agentic Games sprint. It's live, it's wired to the eight KPIs the portal asked us to compete on, and every claim I make in this video resolves on a public URL.
>
> I'll show four things in five minutes: the pipeline on a real ticket, the eight KPI tiles updating live, the semantic-cache short-circuit, and how the architecture maps to the Alame and Radovan eight-phase playbook.

## Beat 2 — Pipeline trace on a real ticket (0:25 – 1:50)

*Switch to the Simulator tab. Paste a billing-style ticket, e.g. "I was charged twice for my March subscription, can you refund the duplicate?" Click Submit.*

> Here's the simulator. I'm sending an inbound email — a typical billing duplicate-charge complaint. Watch the pipeline trace.
>
> First the email is parsed and redacted. Then the semantic cache runs — there's no near-duplicate yet, so it misses cleanly. Then the dispatcher classifies. Two seconds, billing category, confidence 0.93. The judge — that's Anthropic Claude Haiku, a different vendor and a different model family from the dispatcher — verifies the classification. Then the billing specialist drafts a response grounded in the knowledge base. Auto-reply sent. End-to-end under five seconds, total cost under two-tenths of a cent.
>
> Two patterns to call out. First, the judge is a separate vendor on purpose — that's Sage Franch's reviewer-must-be-different-model rule from the April twenty-fourth office hours. Second, every step here is logged and citation-backed; an auditor can trace the auto-reply back to the KB article it grounded on.

## Beat 3 — Phase 8 KPI panel (1:50 – 3:10)

*Switch to the Dashboard tab. Hover the Cost Per Ticket tile. Then the AI Resolution Rate tile.*

> This is the Phase 8 KPI panel. Eight tiles — every one of the KPIs the portal called out for the sprint. AI Resolution Rate. Repeat Contact Rate. Escalation-to-Fix Time. Proactive Detection Rate. KB Growth. Stakeholder Query Adoption. CSAT Proxy. Cost Per Ticket. Each tile is tagged with its phase number — "P-eight" badge in the corner — so you can read this dashboard against the playbook.
>
> Cost Per Ticket is at zero point zero zero zero zero one dollars on cache hits, zero point zero zero zero one eight on cache misses. AI Resolution Rate is the ratio of `resolved_auto` over total inbound. Both update on a fifteen-second poll — no Looker, no Tableau, computed in-process from the ticket store.
>
> The honest part: tiles that can't be measured yet show zero with a help text naming the phase that lights them up. Stakeholder Query Adoption is zero until Phase 7's Slack bot serves its first query. Proactive Detection Rate is zero until Phase 5 fires. We chose to show the zero rather than skip the tile — per Sage's "made it honest" framing from the May sixth office hours.

## Beat 4 — Semantic cache HIT (3:10 – 4:10)

*Switch back to the Simulator tab. Paste a near-duplicate of the first ticket — same intent, different phrasing: "My March bill was double. Need refund of the extra charge." Click Submit.*

> Now I send a near-duplicate. Same intent, different words. Watch the trace.
>
> Semantic cache HIT. Cosine similarity above zero point nine three. Every downstream step is short-circuited. Cost: a single embedding call, about one-millionth of a dollar. Latency: under two hundred milliseconds, down from five seconds on the cold path. The cache hit is citation-backed — the auto-reply names the original ticket ID it copied from, so an auditor can reconstruct provenance.
>
> On a thousand-ticket day with thirty percent semantic-cache hit rate, this saves about thirty percent of LLM cost end-to-end. The recipe in the catalog walks through the threshold tuning and the false-positive math.

## Beat 5 — Architecture and recipe catalog (4:10 – 5:40)

*Open a new tab to the GitHub recipe catalog OR show a single recipe PDF on screen. Or stay on the dashboard and narrate.*

> Six Verified Recipes are published for this sprint, each phase-tagged so another Valsoft business unit can lift the pattern directly. Phase 1 prompt-caching. Phase 2 two-stage retrieval. Phase 3 semantic cache, the one I just demonstrated. Phase 5 proactive outage detection. Phase 8 the KPI panel you're looking at. And a separate PHI-safety recipe that runs cross-cutting across every phase.
>
> Phase 4 — auto dev escalation — is scoped and scheduled for pilot week one. The recipe explains why: a coding-agent loop is meaningless against the synthetic mock corpus, and it needs a real engineering counterpart to onboard against. We chose to ship that one honestly rather than gesturally.
>
> Underneath all of this is a model-agnostic stack — Azure OpenAI gpt-five-point-four-mini for the dispatcher and specialists, Anthropic Claude Haiku for the judge, Cohere Rerank optional for the cross-encoder, all swappable by an environment variable. A Valsoft unit lifting this can flip to Bedrock or Vertex or local Gemma without touching code.

## Beat 6 — Numbers and close (5:40 – 6:30)

*Switch to the Phase 8 dashboard for the closing shot — Cost Per Ticket and CSAT Proxy tiles centred.*

> Numbers honestly. Dispatcher macro F-one zero point nine three seven on a two-hundred-twenty-case stratified eval. Agent harness eleven of twelve consistent across multi-run — that's the Talbench pattern from the office hours. PII detection accuracy eighty-six point eight percent. Cost down ninety-six percent on cache hits, seventy percent on cache misses against the Day-zero baseline.
>
> Every link in our submission resolves to a public URL or an attached PDF. Every phase is tagged. Every recipe is structured to be lifted by another team. That's the deliverable. Thanks for watching.

*Stop recording. Trim only the head and tail if needed; do not edit the body.*

---

## Post-record checklist

- [ ] Total length 5:00 to 7:00 — over 7:30 means re-record the cold open shorter.
- [ ] Audio is audible without headphones at 50% system volume.
- [ ] Address bar visible in Beats 2, 3, 4 (so the judge can see the URL is real).
- [ ] Loom URL: paste into Final Case form → Executive summary → Optional video walkthrough.
- [ ] Save the Loom URL into `.claude/reports/eval/loom-url.txt` for the audit trail.

## Fallback if a beat breaks live

| Symptom | Fix |
|---|---|
| Dispatcher returns 500 | Refresh once. If still failing, narrate over the `/api/dev/smoke` tab — same six-step trace, just static. |
| Phase 8 panel won't load | Open `/api/dashboard/kpis` raw JSON in another tab; narrate the tile names from JSON keys. |
| Semantic cache shows MISS on the duplicate | Adjust the duplicate to be more obviously near-identical (copy the first ticket and change one word). |
| Loom audio cut out | Re-record from Beat 1. Don't try to splice; one clean take beats two stitched. |

---

## Numbers reference card (have this on screen-2 so you don't have to recall)

- Dispatcher macro F1: **0.937**
- Agent harness consistency: **11 of 12** (91.7%)
- PII detection accuracy: **86.8%**
- Cost per ticket — cache hit: **$0.000001**
- Cost per ticket — cache miss: **$0.000180**
- Recipes published: **6**
- KPI tiles: **8** (one per playbook KPI)
- Semantic cache cosine threshold: **0.93**
- Eval corpus size: **220 cases**, 7 categories
