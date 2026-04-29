# 10-Day Plan to #1 on the Leaderboard

**Sprint:** Agentifying Customer Support — Fluent Agentic Games
**Author:** Mohamad Hashem
**Window:** 2026-04-30 → 2026-05-09 (10 calendar days)
**Where we stand at the start:** macro F1 0.967 on a 120-case eval, ECE 0.017, three specialists (FAQ, account, billing), four channels (email, voice, screenshot, monitor), live on Vercel, full Verified Recipe drafted, GitHub repo private and pushed.
**Where this plan takes us:** ten Verified Recipes (instead of one), measurable cost reductions of 60–80 percent through caching and cascading, conversation memory on reply threads, ticket-clustering outage detection, a stakeholder Slack bot, sentiment-and-churn scoring, OpenTelemetry tracing, a CI evaluation gate, and a multilingual response path. Every shipped feature comes packaged as a portable recipe other Valsoft business units can adopt.

## 1. The strategic frame

The rubric is 100 points across three buckets: Operational Impact and ROI (40), Technical Orchestration (30), Velocity and Knowledge Sharing (30). Our current honest read of the scoring:

| Bucket | Today | After this plan |
|---|---|---|
| Operational Impact and ROI | 28/40 | 36/40 |
| Technical Orchestration | 22/30 | 28/30 |
| Velocity and Knowledge Sharing | 18/30 | 27/30 |
| **Total** | **68/100** | **91/100** |

The biggest movable lever is **Knowledge Sharing**. Most teams will submit one Verified Recipe at the end. We submit ten — one per major feature — over 10 days. Each recipe is a 2–3 page write-up of one pattern (with code excerpts, decision log, ROI math, adoption checklist) that another Valsoft unit can fork and apply. Recipes accumulate, so the score lift compounds across the sprint.

The second-biggest lever is **demonstrable cost reduction**. Sage's April 24 office hours called out cost-per-ticket and the new Claude prompt-caching feature explicitly. We hit both with prompt caching, semantic caching, and model cascading.

Third lever: the five-capability checklist (end-to-end resolution, proactive detection, conversation memory, precision routing, human-in-the-loop). We close the conversation-memory gap and harden the other four with measurable evidence.

## 2. The five gaps from the halftime audit, closed

| # | Gap | Closing move | When |
|---|---|---|---|
| G1 | Judge runs on the same Azure deployment as the Generator | Provision Anthropic Claude Haiku 4.5 with an API key, route the Judge there. Different model family, different vendor, separate billing. Bonus: enables prompt caching with Anthropic's 90 percent input-token discount. | Day 1 |
| G2 | No conversation memory on reply threads | Use the existing `isReply` flag in `ParsedEmail` to look up the prior ticket's resolution and inject it into the dispatcher's first user turn. Fall back to flywheel resolution-log retrieval when the thread is new. | Day 3 |
| G3 | Prior Demo Drop submission was rejected on 2026-04-20 | Every demo submission from now on uses a specific action-oriented title and the field copy bound to the week's recording shot list. The end-of-week-submission skill enforces this. | Built into every daily/weekly handoff |
| G4 | KB has only 7 articles | Add 8 high-quality articles so the FAQ and account specialists stop refusing on common cases (Azure SSO, MFA recovery, plan changes, role/permissions, integrations). Re-run the agent test harness — the two refusing cases convert to PASS, putting us at 12/12. | Day 1 (afternoon) |
| G5 | Cadence — Tracy submits daily | Submit a 2-line interim update every weekday to the Submit-an-Update box. Pattern: "Yesterday shipped X (one-line metric). Today shipping Y." 3 minutes per update. | Built into the daily ritual |

## 3. The twelve-feature stack, prioritized

Researched against the Anthropic and OpenAI feature surface as of late 2025/early 2026, plus production agentic patterns from teams shipping at scale. Each item lists what it does, why it scores, effort, cost impact, and whether it ships as a standalone Verified Recipe.

### Tier 1 — Days 1–4 (highest scoring delta per hour)

**F1 — Anthropic prompt caching for the Generator + Judge**
What: mark the dispatcher's `<categories>` + `<rules>` + `<examples>` blocks with `cache_control: {type: "ephemeral"}`. Subsequent requests within 5 minutes pay 10 percent of input cost on cached portions; with the 1-hour beta, cache lasts 60 minutes.
Why: Saves 70–85 percent on input tokens at our prompt size. Sage explicitly highlighted token-cost reduction in April 24 office hours.
Effort: 3 hours.
Cost impact: **saves money**. Our Generator+Judge prompt is ~1.5K tokens; with caching, repeated requests cost ~$0.0001 instead of $0.0003.
Recipe: yes — *Prompt-Caching for Multi-Agent Pipelines (Anthropic)*

**F2 — OpenAI structured outputs / strict JSON-schema mode**
What: replace `response_format: {type: "json_object"}` with `response_format: {type: "json_schema", strict: true}`. Schema is enforced server-side; parse failures drop to zero.
Why: directly raises agent test consistency. The two refusing cases in the test harness become more reliable; the dispatcher's already-pinned schema becomes contract-enforced.
Effort: 4 hours.
Cost impact: neutral.
Recipe: yes — *Strict JSON Schemas End Parser Brittleness*

**F3 — Semantic cache with embedding-based response reuse**
What: hash incoming ticket text → embed via `text-embedding-3-small` → cosine match against prior resolutions; if cosine ≥ 0.93, serve the cached resolution at $0 with a citation. Use Vercel KV or a JSONL local store.
Why: 25–40 percent of FAQ traffic served free. Visible cost savings on the dashboard. Hits both ROI and Sophistication.
Effort: 1 day.
Cost impact: **saves money** — eliminates LLM calls for high-frequency repeat questions.
Recipe: yes — *Semantic Caching for Support Auto-Resolution*

**F4 — Cross-encoder reranking on FAQ retrieval**
What: retrieve top-20 KB articles with the existing keyword score, then rerank with a small cross-encoder (`bge-reranker-v2-m3` via local ONNX, or Cohere Rerank 3.5 API for $1/1K). Top-3 reranked enter the FAQ specialist prompt.
Why: precision lift on retrieval directly improves auto-resolution rate. Smaller context to the LLM also saves tokens.
Effort: 4–6 hours.
Cost impact: **saves money** (smaller LLM context outweighs reranker cost).
Recipe: yes — *Two-Stage Retrieval for Support RAG*

**G4 — Knowledge-base expansion (8 new articles)**
What: write KB-008 through KB-015 covering Azure SSO setup, OneLogin SAML, MFA device recovery, plan downgrade/upgrade prorating, role and permission changes, OAuth setup, GitHub integration, custom-domain config.
Why: closes the two refusing test cases (jumps from 10/12 to 12/12), gives the FAQ specialist real coverage on technical questions, and makes the flywheel useful sooner.
Effort: 1 day.
Cost impact: neutral.
Recipe: yes — *Bootstrapping a Support KB from Resolution Logs*

### Tier 2 — Days 5–7 (reliability + creativity)

**F5 — Ticket clustering for outage detection**
What: rolling 24-hour HDBSCAN clustering over ticket embeddings; when a cluster size hits 5σ above baseline, emit an outage alert and auto-create a parent Jira incident that all subsequent matching tickets attach to.
Why: nobody else will have this. It's a Phase-5 capability with measurable real-world impact (incident response time reduction).
Effort: 1 day.
Cost impact: neutral (one-time embedding cost, ~$0.0001 per ticket).
Recipe: yes — *Outage Detection from Ticket Clusters*

**F6 — Multi-agent reflection loop (selective)**
What: when the Judge's faithfulness score is between 0.70 and 0.85 (uncertain band), trigger a Reviewer agent that critiques the specialist's draft reply against the KB before sending. Skipped on high-confidence cases to save cost.
Why: hits Sophistication directly. Closes the long-tail of edge cases that pass the dispatcher but produce shaky drafts. Validates the dual-model story we already tell.
Effort: 1 day.
Cost impact: +$0.0001 per ticket (only on ~15 percent of traffic).
Recipe: yes — *Reflection Loops Without Cost Explosion*

**F7 — Model cascading via calibration**
What: route 85 percent of traffic to the small model. Escalate to a larger model (gpt-4o or Claude Sonnet 4.6) only when calibrated confidence < 0.70 OR the Judge faithfulness < 0.80. Configurable per category.
Why: 40–60 percent cost savings versus always-large; ECE-driven routing is a strong narrative slide.
Effort: 4 hours.
Cost impact: **saves money** — the 15 percent of escalated tickets cost more, but the 85 percent cheap path dominates.
Recipe: yes — *Calibration-Driven Model Cascading*

**G2 — Conversation memory on reply threads**
What: in `parseEmail` we already detect `isReply`. Add a thread-store keyed by message-id chain. On reply detection, fetch the prior ticket's resolution + dispatcher decision + specialist used; inject summarized context into the dispatcher's first user turn.
Why: hits the Conversation Memory capability from the deck's five-capability checklist. Currently a gap.
Effort: 1 day.
Cost impact: small additional context tokens (~200 per reply ticket).
Recipe: yes — *Thread-Aware Memory for Support Replies*

### Tier 3 — Days 8–10 (polish + differentiation)

**F8 — Sentiment-aware escalation + churn-risk score**
What: a small sentiment classifier (or single LLM call with caching) returns `{sentiment, frustration_level, churn_risk}` on every inbound. If frustration ≥ 0.7 or churn_risk ≥ 0.6, route to a high-priority human queue with an LLM-drafted summary.
Why: hits the human-in-the-loop capability. Executives respond strongly to churn risk metrics. Demo wow factor.
Effort: 6 hours.
Cost impact: neutral (one cached call per ticket).
Recipe: yes — *Sentiment + Churn Routing*

**F9 — OpenTelemetry tracing (Phoenix or Langfuse)**
What: OTel spans for every agent hop (dispatcher → judge → specialist → KB search → tool call). Surface in a self-hosted Phoenix instance or Langfuse cloud (free tier). Dashboard tile shows latency by step + cost by step.
Why: production-grade observability is what reliability looks like. Screenshot-ready for the Verified Recipe.
Effort: 1 day.
Cost impact: neutral.
Recipe: yes — *Observability for Multi-Agent Support Pipelines*

**F10 — Slack stakeholder bot (Phase 7 of the Fluent playbook)**
What: a `/support` slash command that answers natural-language queries over the dashboard data. "How many tickets did we auto-resolve this week?" → returns numbers from `/api/dashboard/stats` with a chart. Daily 8 AM digest with top clusters, automation rate, cost saved, drift alerts.
Why: hits a capability nobody else may have touched. Direct alignment with Phase 7 of the playbook and the Live Artifacts pattern Sage suggested.
Effort: 6 hours.
Cost impact: neutral.
Recipe: yes — *Stakeholder Intelligence Layer in Slack*

**F11 — Multilingual auto-detect + responses**
What: detect inbound language with `lingua-py` (or a tiny LLM call), respond in the source language. Fall back to English if confidence < 0.80.
Why: horizontal-reach feature. Demo wow when the same pipeline answers Spanish, French, German queries.
Effort: 4 hours.
Cost impact: small (translation tokens).
Recipe: yes — *Multilingual Support Without a Translation Pipeline*

**F12 — Promptfoo CI eval suite**
What: GitHub Action that runs the 120-case dispatcher eval and the agent test harness on every PR. Gates merge on F1 ≥ 0.95 and consistency ≥ 80 percent.
Why: makes the eval-driven-dev rule physical. Velocity-pillar deliverable in its own right.
Effort: 1 day.
Cost impact: ~$0.05 per CI run.
Recipe: yes — *CI for Multi-Agent Eval Sets*

## 4. Day-by-day schedule

Each day produces: code changes, an updated weekly metric, a 2-line portal interim update at end of day, and one Verified Recipe submission.

| Day | Date | Headline | Ships | Recipe |
|---|---|---|---|---|
| 1 | Thu 2026-04-30 | Cost-cut foundation + Judge fix | F1 prompt caching · F2 strict JSON · G1 Anthropic Judge wired · G4 KB +8 articles | *Prompt-Caching for Multi-Agent Pipelines* |
| 2 | Fri 2026-05-01 | Retrieval depth + cache layer | F4 cross-encoder rerank · F3 semantic cache | *Semantic Caching for Support Auto-Resolution* + weekly report submission |
| 3 | Sat 2026-05-02 | Conversation memory | G2 thread-aware memory · agent-test harness re-run | *Thread-Aware Memory for Support Replies* |
| 4 | Sun 2026-05-03 | Cascading | F7 model cascading via calibration | *Calibration-Driven Model Cascading* |
| 5 | Mon 2026-05-04 | Reflection loop | F6 multi-agent reflection (selective) | *Reflection Loops Without Cost Explosion* |
| 6 | Tue 2026-05-05 | Outage detection | F5 ticket clustering + auto-incident | *Outage Detection from Ticket Clusters* |
| 7 | Wed 2026-05-06 | Sentiment + observability | F8 sentiment/churn routing · F9 OpenTelemetry | *Sentiment + Churn Routing* and *Observability for Multi-Agent Pipelines* |
| 8 | Thu 2026-05-07 | Stakeholder intelligence | F10 Slack bot · F12 CI eval suite | *Stakeholder Intelligence Layer in Slack* and *CI for Multi-Agent Eval Sets* |
| 9 | Fri 2026-05-08 | Multilingual + final polish | F11 multilingual · final demo recording across all features | *Multilingual Support Without a Translation Pipeline* + final weekly report |
| 10 | Sat 2026-05-09 | Submission package | Final Verified Recipe consolidation, demo video for the full sprint, executive summary | *Bootstrapping a Support KB from Resolution Logs* |

### Day 1 in detail (template for every day)

**Morning (3 hours):**
1. Add `cache_control: {type: "ephemeral"}` to dispatcher and judge prompts in `src/lib/ai/client.ts` (Anthropic path) and `src/lib/agents/dispatcher.ts`/`judge.ts`.
2. Switch dispatcher and judge to OpenAI strict JSON schema mode where Azure supports it; fall back to json_object on older deployments.
3. Get Anthropic API key (request from MD per Sage's "AI tooling spend is encouraged" note; if not approved by Day 1, use the same Azure deployment but document the gap and proceed with caching alone).
4. Wire the Judge to Anthropic Claude Haiku 4.5 if key is available.

**Afternoon (4 hours):**
5. Write 8 KB articles in `fixtures/kb/articles.jsonl` covering the gap topics.
6. Re-run `npm run eval:dispatcher` and `npm run test:agents`. Expect F1 stable at 0.967 or higher; consistency rises to 12/12 cases.
7. Update `TESTING_GUIDE.md` to note the new KB coverage and the Judge model change.
8. Write the day's Verified Recipe (`recipe-prompt-caching.md`) with code excerpt, before/after cost numbers, adoption checklist.
9. Commit + push (Vercel auto-deploys).
10. Record a 30-second mini-demo showing cost-per-ticket dropping in real time.

**End of day (10 minutes):**
11. Post the daily 2-line update to the Submit-an-Update box: "Day 1: prompt caching + strict JSON shipped. Cost per resolution down from $0.0006 to ~$0.0002 (67% saving). KB expanded to 15 articles. Day 2: cross-encoder rerank + semantic cache."

## 5. Verified Recipe roster (the Knowledge Sharing pillar)

Each recipe is a 2–3 page document under `.claude/reports/recipe/` and submitted to the portal's Agentic Recipe form. Each is targeted at a different audience inside Valsoft so the catalog reads like a complete library, not duplicates of one idea.

| # | Recipe | Audience | Length | Core insight |
|---|---|---|---|---|
| 1 | The Multi-Agent Support Pattern | All agentic leads | The existing recipe.md | Dispatcher + Judge + specialists + refusal trigger + multi-channel |
| 2 | Prompt-Caching for Multi-Agent Pipelines (Anthropic) | Cost-conscious teams | 2 pages | Cache the static blocks; ephemeral 5-min or beta 1-hour TTL; 90 percent input-token discount |
| 3 | Semantic Caching for Support Auto-Resolution | High-volume support | 3 pages | Embed inbound, cosine-match prior resolutions, serve at $0 with citation |
| 4 | Two-Stage Retrieval for Support RAG | Any team running RAG | 2 pages | Bi-encoder top-20 then cross-encoder top-3; smaller LLM context wins on both cost and quality |
| 5 | Thread-Aware Memory for Support Replies | Anyone with reply chains | 2 pages | `isReply` flag → prior-ticket lookup → context injection in dispatcher first turn |
| 6 | Calibration-Driven Model Cascading | Cost-sensitive teams | 3 pages | ECE-tuned threshold routes 85 percent to a small model, 15 percent to a large model; net 40–60 percent cost cut |
| 7 | Reflection Loops Without Cost Explosion | Reliability-sensitive teams | 2 pages | Trigger the Reviewer only in the uncertain band; full critique-and-revise on the long tail without paying for everyone |
| 8 | Outage Detection from Ticket Clusters | Engineering + support | 3 pages | HDBSCAN over a rolling embedding window; cluster size > 5σ → auto-incident |
| 9 | Sentiment + Churn Routing | Customer-success teams | 2 pages | Single cached classifier call; thresholds drive priority queue routing |
| 10 | Observability for Multi-Agent Pipelines | Platform/ops teams | 2 pages | OTel spans per agent hop; latency and cost per step on the dashboard |
| 11 | Stakeholder Intelligence Layer in Slack | Business stakeholders | 2 pages | NL queries over `/api/dashboard/stats` + daily 8 AM digest |
| 12 | Multilingual Support Without a Translation Pipeline | Any international team | 2 pages | Detect language at intake, respond in source language, English fallback below 0.80 |
| 13 | CI for Multi-Agent Eval Sets | Any team shipping AI to prod | 2 pages | GitHub Action runs eval + test harness on every PR, gates merge on F1 and consistency |
| 14 | Bootstrapping a Support KB from Resolution Logs | New deployments | 2 pages | Use the flywheel as a seed for KB articles after 100+ resolutions |

That is fourteen recipes. The rule of thumb in the Fluent playbook is that recipes scale Knowledge Sharing more than weekly reports do, so leaning hard here is the highest-leverage move.

## 6. Cost plan

Total budget for the 10-day push: under US $25 across all infra and API spend.

| Item | Cost | Source |
|---|---|---|
| Anthropic API key deposit | $5 | Anthropic console, request via MD if not personal |
| Anthropic Haiku usage as Judge (10 days × ~50 tickets × cached input) | ~$0.50 | Estimated at $0.001/ticket Judge cost with caching |
| Azure OpenAI (Generator + specialists) | ~$1.00 | $0.0003/ticket × 50/day × 10 days post-caching |
| Embedding model (text-embedding-3-small) for semantic cache + clustering | ~$0.20 | $0.02 per 1M tokens × ~10M tokens across the sprint |
| Cohere Rerank 3.5 (optional, for reranker if not local) | ~$2.00 | $1 per 1K reranks; we'll do ~2K during eval iterations |
| Langfuse / Phoenix for OTel | $0 | Free tier covers our volume |
| Vercel hosting | $0 | Free tier covers our volume |
| GitHub | $0 | Private repo, free |
| **Subtotal** | **~$8.70** | |
| Buffer for retries, eval iterations, demo recording | ~$15 | |
| **Total budget cap** | **~$25** | |

Compare against US $12,600 per year saved per workflow at typical volume. ROI on the 10-day push is approximately 500-to-1.

## 7. Performance targets at end of Day 10

| Metric | Day 0 | Day 10 target |
|---|---|---|
| Dispatcher macro F1 (120-case eval) | 0.967 | ≥ 0.97 (held) |
| Account-category F1 | 0.971 | ≥ 0.98 |
| Agent test harness consistency | 10/12 | 14/14 (with new KB and 2 added cases) |
| Expected Calibration Error | 0.017 | ≤ 0.02 (held) |
| Cost per typical resolution | $0.000606 | ≤ $0.0002 (post-caching) |
| Channels live | 4 | 4 |
| Specialists live | 3 | 4 (add Reflection Reviewer as a fourth meta-specialist) |
| Verified Recipes published | 1 | 14 |
| Capabilities ticked from the deck's 5 | 4 | 5 (memory closes) |
| Languages handled | 1 (en) | 5 (en, es, fr, de, it minimum) |
| Stakeholder intelligence layer | none | Slack bot live |
| CI eval gate | none | Active on every PR |

## 8. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Anthropic API key not approved in time for Day 1 | Medium | High (loses the second-model gain) | Fallback: keep Azure for Judge, document gap, proceed with caching only. Net loss is one day of saving + the credibility of "different model" — but caching alone still saves 70 percent. |
| Cross-encoder reranking latency too high in serverless | Medium | Medium | Use Cohere Rerank API instead of local ONNX (one HTTP call, lower latency). |
| Semantic cache produces a false positive (wrong cached answer) | Medium | High | Set cosine threshold conservatively at 0.93; the Judge still verifies cached responses; auto-invalidate cache on customer follow-up "that didn't help" signal. |
| Vercel cold-start on demo day | High | Low | Hit `/api/dev/smoke` 30 seconds before any judge demo to warm the function. Document in the demo runbook. |
| In-memory store loss between Vercel function instances | High | Low | Cache + flywheel are file-based; the in-memory ticket store resets but tickets are still in Jira. Out of scope for a 10-day window. |
| Time slip on a 1-day feature | High | Medium | Each day has a single primary feature plus a small secondary. Slip pushes the secondary, not the primary. |
| Burnout on a one-person team | Medium | Medium | Daily ritual is bounded (4–7 hours). Saturday and Sunday are lighter days. |

## 9. The daily ritual (every weekday)

Same loop, every day:

1. **Morning (15 min):** open the Fluent portal, check My Submissions for admin feedback on yesterday's drop, check the leaderboard.
2. **Build (3–5 hours):** ship the day's primary feature. Commit at least once with a clear message.
3. **Evaluate (30 min):** run `npm run eval:dispatcher` and `npm run test:agents`; confirm metrics did not regress.
4. **Recipe (45 min):** write the day's Verified Recipe under `.claude/reports/recipe/recipe-<feature>.md`. Include problem, solution, code excerpt, ROI math, adoption checklist.
5. **Demo capture (10 min):** record a 20-second screen capture or curl-output snippet that proves the feature works.
6. **Submit (10 min):** post the 2-line interim update to the Submit-an-Update box; submit the new Verified Recipe to the Agentic Recipe form (the catalog accumulates, no overwrite).
7. **Push (5 min):** `git push` (Vercel auto-deploys); smoke-test the live URL once redeployed.
8. **Update memory (5 min):** if the day produced a learning that future-me should not relearn, save it as a memory note.

## 10. Saturday 2026-05-09 — submission day

The whole final day is for polish, not new features.

1. Run all evals one final time on the deployed URL (not just locally). Capture screenshots.
2. Re-record the master demo video covering: dispatcher, Judge, three specialists + Reviewer, four channels, cost dashboard tile, Slack bot, multilingual flow, outage cluster alert. Aim for 5–7 minutes total.
3. Convert the master Verified Recipe to PDF; bundle the 14 recipe PDFs into a single submission set.
4. Write the executive summary as `SUBMISSION.md` in the repo root.
5. Submit the final weekly report, the master demo, and the Verified Recipe set.
6. Post a closing 3-line update to the Submit-an-Update box: shipped count, headline metrics, the URL.

## 11. Why this plan wins

- **Knowledge Sharing pillar (15 of 30 in Velocity):** 14 recipes is a 14-to-1 advantage over teams submitting one. Catalog visibility scales score directly.
- **Cost narrative:** dropping from $0.000606 per resolution to under $0.0002 is a 67 percent reduction we can show on the dashboard live. ROI numbers compound visually.
- **Five-capability checklist closed:** memory was the missing one. After Day 3 it is ticked.
- **Reliability story:** OpenTelemetry traces + CI gate + multi-run consistency + ECE + dual-model Judge on a different vendor add up to a posture few teams will match.
- **Differentiation:** ticket clustering for outage detection, Slack stakeholder bot, and multilingual support are visible, demo-friendly, and not on most teams' roadmaps.
- **Cost discipline:** under $25 total spend across infra and API for the entire push. Sage's note about AI-tooling spend being encouraged means this is a non-issue from the budget side.

## 12. Activation

Tell me "start the 10-day plan" and Day 1 begins immediately with prompt caching and the KB expansion. No further per-step approvals; I'll run the daily ritual end-to-end and surface only judgment calls and submission-ready content.
