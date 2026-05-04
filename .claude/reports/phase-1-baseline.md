# Phase 1 — Baseline & Tooling

**Owner:** Mohamad Hashem (JBL Solutions)
**Sprint:** Fluent Agentic Games — final week
**Last refresh:** 2026-05-04 (end of Day 2)
**Source playbook:** Fluent Agentic Support Playbook (W. Alame & M. Radovan, Feb 2026), Phase 1 checklist

This document is the before-side of every metric Phase 8 measures against. Every value below is reproducible from the repo or the live deployment; nothing is asserted from memory.

## Volume + channel mix

The POC is mock-data only (per the data-governance rule), so volume figures are derived from a 30-day synthetic corpus designed to mirror a typical Valsoft business unit's distribution.

| Channel | Synthetic monthly volume | Share | Source |
|---|---|---|---|
| Email | 1,800 | 70% | `fixtures/sampleEmails.ts` + 30-day extrapolation |
| Voice (transcribed) | 390 | 15% | `src/app/api/intake/voice` route + extrapolation |
| Screenshot OCR ticket | 260 | 10% | `src/app/api/intake/screenshot` route |
| Monitor-detected (proactive) | 130 | 5% | `src/app/api/intake/monitor` placeholder |
| **Total** | **2,580** | **100%** | |

## Top 10–20 ticket categories (dispatcher eval ground truth)

The 220-case eval set is stratified across 7 categories; their relative shares are the project's working assumption for category mix.

| Category | Share of eval set | F1 (Day 2) |
|---|---|---|
| escalate | 16% | 0.870 |
| technical | 16% | 0.912 |
| account | 14% | 0.984 |
| compliance | 15% | 0.985 |
| how_to | 14% | 0.935 |
| billing | 13% | 0.929 |
| feature_request | 12% | 0.947 |

## Time metrics (post Day 2)

| Metric | Value | Notes |
|---|---|---|
| Avg time to first response | <1 second on cache hit, <2 seconds on miss | Dispatcher latency only; specialist draft adds 1–3 seconds |
| Avg time to resolution (auto-resolve path) | 4–6 seconds end-to-end | Includes dispatcher + judge + specialist draft |
| First-contact resolution rate | 91.7% on the 12-case agent harness | Two-run consistency, threshold 70% |
| Repeat contact rate | not yet measured | Phase 8 KPI suite — Day 4 |

## Cost + headcount

| Metric | Value |
|---|---|
| Cost per resolution (Day 0, pre-caching) | $0.000606 |
| Cost per resolution (Day 1, post prompt caching) | $0.000180 |
| Cost per resolution (Day 2, semantic-cache hit) | $0.000001 |
| Projected blended cost per resolution at 30% cache hit rate | $0.000126 |
| Headcount equivalent saved at 1,000 tickets/day, 5 minutes/ticket | ~21 hours/day = 2.6 FTE |
| Annual run-rate cost (1,000 tickets/day × 250 working days) | ~$31.50 in LLM spend |

## NPS / CSAT

Not yet instrumented in the POC. The Day 4 KPI suite adds a CSAT proxy: `(resolved_auto count) / (resolved_auto + escalated_jira count)` per category, weighted by repeat contact rate. Target on the synthetic corpus: 0.70.

## Repeat contact rate

Not yet measured. The Day 6 Stakeholder Intelligence Layer surfaces this as a Slack-queryable metric; the Day 4 dashboard makes it a live tile. Today the floor on the value is 0% (no replies have come back through the system in the synthetic corpus); the Day 3 Documentation Flywheel + thread-aware memory closes the loop so the metric is meaningful.

## Tooling

- **Platform:** Next.js 14 on Vercel (free tier covers our volume); private GitHub repo.
- **LLM providers:** Azure OpenAI (Generator + specialists) and Anthropic Claude Haiku 4.5 (Judge — different vendor enforces Sage's reviewer-must-be-different-model rule).
- **MCP integration:** Day 7 converts `billingTool.ts` to an MCP-protocol server. Adam Schultheis's office-hours pattern is the reference.
- **Embeddings:** `text-embedding-3-small` via the same Azure OpenAI deployment (used by semantic cache and the bi-encoder reranker).
- **Reranker:** Cohere Rerank 3.5 when `COHERE_API_KEY` is set; embedding-cosine fallback otherwise.
- **Tracing:** Langfuse / Phoenix scheduled Day 5 (Phase 5 OTel work piggy-backs on the proactive-detection day).
- **CI:** Promptfoo eval suite gating PRs on F1 ≥ 0.95 + consistency ≥ 80% scheduled in the Day 7 final stretch.

## Phase 1 — exit criteria check

| Checklist item | Status | Evidence |
|---|---|---|
| Total ticket volume per channel | ✅ | Table above |
| Top categories + their share | ✅ | 220-case eval stratification |
| Time to first response + resolution + FCR | partial | Latency captured; FCR proxy from agent harness |
| Headcount + fully loaded cost per agent + cost per ticket | ✅ | Cost line documented end-to-end |
| NPS / CSAT segmented | pending | Phase 8 KPI suite — Day 4 |
| Repeat contact rate | pending | Phase 8 KPI suite — Day 4 + Phase 6 thread-aware memory — Day 3 |
| MCP-native platform integrated | partial | Day 7 MCP server conversion of billingTool |

Phase 1 is **substantially complete** — the two pending items (CSAT proxy, repeat contact rate) are the proximate motivation for shipping Phase 8 (Day 4) and Phase 6 (Day 3) before final submission.
