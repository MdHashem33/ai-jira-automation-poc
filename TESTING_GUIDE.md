# POC Demo and Overview

**Live URL:** https://ai-jira-automation-poc.vercel.app
**Source:** https://github.com/MdHashem33/ai-jira-automation-poc (private)
**Author:** Mohamad Hashem
**Sprint:** Agentifying Customer Support — Fluent Agentic Games (April 2026)

This document is the single entry point for anyone who wants to understand or evaluate the POC. It covers what the system does, how to demo it, and how each capability maps to the Agentic Games judging rubric.

---

## What this POC does, in plain language

This is a multi-agent customer-support automation system. A customer can submit a request through any of four channels — email, voice transcript, screenshot, or a proactive monitoring alert — and the same pipeline classifies the request, verifies the classification with a separate AI model, hands the request to the correct specialist agent (FAQ, account recovery, or billing), and either auto-resolves it from the knowledge base or escalates to a human via Jira. PII and PHI are stripped before any model call. Every decision is logged with cost in US dollars and a provenance flag indicating whether a model or a fallback rule produced the answer. The system refuses cleanly — rather than hallucinating — when the knowledge base does not cover the request.

The dispatcher classifies inbound requests across seven categories at macro F1 0.967 on a 120-case mock evaluation. Expected Calibration Error on the same eval is 0.017, which means the dispatcher's reported confidences are honest, not inflated. A 12-case multi-run agent test harness following the Talbench 2024 consistency pattern reports 10 of 12 cases at 100 percent across 3 runs each. End-to-end cost per typical auto-resolution is about US $0.0006.

---

## 60-second click-through demo

1. Open the live URL.
2. Click **Email Simulation** in the top tab bar.
3. Click any sample email. The pipeline animates step by step: parse → dispatch → judge verify → specialist (or legacy fallback) → action.
4. Click **Processed Tickets** to see the full ticket detail — dispatcher category, judge faithfulness score, specialist used, KB article cited, cost in USD.
5. Switch back to **Dashboard** to see counters tick and recent activity update.

For a fuller demo, run the curl commands in the next section.

---

## API demo paths

All endpoints live under `https://ai-jira-automation-poc.vercel.app`. Copy any block and paste into a terminal.

### Smoke test — six classifications, full pipeline output
```bash
curl -s https://ai-jira-automation-poc.vercel.app/api/dev/smoke \
  | jq '.results[] | {id, subject, category: .dispatcher.category, conf: .dispatcher.confidence, source: .dispatcher.source, pii: .redact.pii_summary}'
```
Expect six rows, all with `source: "model"`, accurate categories at high confidence.

### Voice intake — auto-resolves via FAQ specialist
```bash
curl -s -X POST https://ai-jira-automation-poc.vercel.app/api/intake/voice \
  -H 'Content-Type: application/json' \
  -d '{"transcript":"Where do I find my API key in settings? I am setting up a new integration.","subjectHint":"Where do I find my API key?","callerName":"Demo"}' \
  | jq '{routedBy: .ticket.routedBy, dispatcher: .ticket.dispatcher.category, faq_resolved: .ticket.faq.resolved, kb: .ticket.faq.kb_article_id, cost: .ticket.cost.totalUsd}'
```
Expect `routedBy: "faq_specialist"`, `kb: "KB-006"`, cost roughly 0.0006.

### Billing intake — uses a scoped read-only invoice-lookup tool
```bash
curl -s -X POST https://ai-jira-automation-poc.vercel.app/api/intake/voice \
  -H 'Content-Type: application/json' \
  -d '{"transcript":"Can you confirm the status of invoice INV-22841 and the VAT applied?","subjectHint":"Question about invoice INV-22841","callerName":"Demo Billing"}' \
  | jq '{routedBy: .ticket.routedBy, category: .ticket.dispatcher.category, cost: .ticket.cost.totalUsd}'
```
Expect `routedBy: "billing_specialist"`. The billing tool returns `INV-22841 → status: paid, amount: 149`, the specialist cites those values verbatim, and refuses to invent a refund.

### Screenshot intake — pre-extracted text path
```bash
curl -s -X POST https://ai-jira-automation-poc.vercel.app/api/intake/screenshot \
  -H 'Content-Type: application/json' \
  -d '{"extractedText":"I forgot my password and the reset email is not arriving.","subject":"Password reset help","fromName":"Demo User"}' \
  | jq '{intake: .intake, routedBy: .ticket.routedBy, category: .ticket.dispatcher.category}'
```
Expect PII flag on email mentions, then `routedBy: "account_specialist"` or a legacy fallback.

### Proactive monitor hook — Datadog/Sentry-shaped event becomes a ticket
```bash
curl -s -X POST https://ai-jira-automation-poc.vercel.app/api/intake/monitor \
  -H 'Content-Type: application/json' \
  -d '{"source":"datadog","error_class":"DBTimeout","message":"Database timeout on /api/exports","count":47,"window_minutes":5,"affected_endpoint":"/api/exports","affected_users":12}' \
  | jq '{intake: .intake, status: .ticket.status, routedBy: .ticket.routedBy, dispatcher: .ticket.dispatcher.category}'
```
Expect a synthetic ticket classified as `technical`, escalated to Jira.

### Knowledge-base search
```bash
curl -s "https://ai-jira-automation-poc.vercel.app/api/kb/search?q=password+reset" | jq
```

### Self-learning flywheel summary
```bash
curl -s https://ai-jira-automation-poc.vercel.app/api/kb/flywheel | jq
```

### Dashboard stats
```bash
curl -s https://ai-jira-automation-poc.vercel.app/api/dashboard/stats \
  | jq '{totalProcessed, autoResolved, escalatedToJira, autoResolveRate, totalCostUsd, avgCostPerTicketUsd, routedBy}'
```

---

## Endpoint map

| Path | Method | Purpose |
|---|---|---|
| `/` | GET | Dashboard, simulation, tickets, monitor tabs |
| `/api/dev/smoke` | GET | Six-sample classification with full pipeline output |
| `/api/email/simulate` | POST | Process one of the seeded sample emails through the pipeline |
| `/api/intake/voice` | POST | Voice transcript → redact → dispatcher → judge → specialist |
| `/api/intake/screenshot` | POST | Image (vision) or extracted-text → same pipeline with a `phi_likely` flag |
| `/api/intake/monitor` | POST | Monitoring event (Datadog / Sentry / Signoz / CloudWatch) → synthetic ticket |
| `/api/kb/search?q=...` | GET | Keyword search over the JSONL knowledge base |
| `/api/kb/flywheel` | GET | Resolution-log summary by category and outcome |
| `/api/dashboard/stats` | GET | Live counters, cost-per-ticket, distribution by `routedBy` |

---

## Architecture summary

```
intake (email / voice / screenshot / monitor)
    │
    ▼
parseEmail → redact (mandatory PII/PHI)
    │
    ▼
dispatcher (Generator)  →  Judge (Reviewer, separate model)
    │                          │
    ▼                          │ faithfulness ≥ 0.70 ?
specialist routing  ◄──────────┘
    │
    ├─► FAQ specialist (how_to → RAG over KB)
    ├─► account specialist (password / MFA / lifecycle)
    ├─► billing specialist (with scoped lookupInvoice tool)
    └─► legacy decision engine (fallback for refusals + uncovered categories)
                    │
                    ▼
             auto-reply  OR  Jira escalation
                    │
                    ▼
        flywheel: append resolution log
```

| File | Role |
|---|---|
| `src/lib/ai/client.ts` | Model adapter (OpenAI direct or Azure OpenAI) with cost accounting |
| `src/lib/ai/redact.ts` | Mandatory PII/PHI redaction |
| `src/lib/agents/dispatcher.ts` | 7-category classifier with pinned JSON output |
| `src/lib/agents/judge.ts` | Dual-Model Judge — separate deployment per the reviewer-different-model rule |
| `src/lib/agents/faqSpecialist.ts` | KB-grounded auto-resolution for `how_to` |
| `src/lib/agents/accountSpecialist.ts` | Sub-intent routing for password / MFA / lifecycle |
| `src/lib/agents/billingSpecialist.ts` | Grounded billing answers backed by `services/billingTool.ts` |
| `src/lib/services/kbStore.ts` | JSONL KB loader, search, resolution-log flywheel |
| `src/lib/services/pipeline.ts` | Orchestration: dispatch → judge → specialist → fallback |
| `fixtures/eval/dispatcher.jsonl` | 120-case mock evaluation set |
| `fixtures/eval/agent-tests.jsonl` | 12-case multi-run test harness |
| `scripts/eval-dispatcher.ts` | Confusion matrix, per-category P/R/F1, macro F1 |
| `scripts/test-agents.ts` | Multi-run consistency harness (Talbench pattern) |
| `scripts/eval-calibration.ts` | Reliability table by confidence bucket, ECE, recommended threshold |

---

## What the application does versus what the Agentic Games asks for

The Agentic Games rubric (Fluent kickoff deck) breaks down to 100 points across three buckets, plus five capabilities the judges want demonstrated, plus three horror stories the judges want defended. Here is exactly how each item maps to what is in this repo and live on the URL above.

### Rubric — Operational Impact and ROI (40 points)

| What the judges look for | What this POC delivers |
|---|---|
| Validated reduction in manual hours | Existing POC saved 4–8 hrs/week on triage; Week-4 specialists add ~1 hr/week. Total 5.5–9 hrs/week per workflow with `tickets/week × min-saved × 4.33` math shown in the weekly report. |
| ≥ 30% automation of a core workflow | Triage and Jira creation are fully automated end-to-end; how-to and account recoveries auto-resolve when the KB covers them. The dispatcher's `routedBy` distribution on the dashboard quantifies this. |
| Cost-per-ticket as a measured metric | Every LLM call records token usage and USD. End-to-end cost per typical auto-resolution is about $0.0006. ROI ≈ 8,000-to-1 versus token spend. |

### Rubric — Technical Orchestration (30 points)

| Sophistication item | How this POC scores |
|---|---|
| Beyond simple prompts → multi-step orchestration | Dispatcher → Judge → specialist → flywheel; legacy fallback on refusal. Five separate agent calls per ticket when the specialist runs. |
| Tool use against external systems | Billing specialist calls `lookupInvoice(INV-…)` through a scoped read-only function, never touches a database directly. Jira escalation creates real tickets via the Atlassian API. |
| Multi-agent coordination | Three specialists, one dispatcher, one Judge, one orchestrator (`pipeline.ts`). All under the flat-hierarchy + context-in-prompt pattern. |
| Provider portability | Single adapter switches between OpenAI direct and Azure OpenAI via env. The Judge can target a separate deployment. |

| Reliability item | How this POC scores |
|---|---|
| Eval set with measurable accuracy | 120-case mock eval, macro F1 0.967, accuracy 96.7 percent, human-review flag accuracy 99.2 percent. |
| Calibration | Expected Calibration Error 0.017 across confidence buckets; recommended human-review threshold 0.95. |
| Multi-run consistency | 12 cases × 3 runs harness (Talbench 2024). 10 of 12 cases consistent at 100 percent. The two refusals are the safety net working, not regressions. |
| Hallucination defense | Mandatory redaction, refusal trigger on KB miss, Dual-Model Judge with `agrees` and `faithfulness`, source provenance on every result. |

### Rubric — Velocity and Contribution (30 points)

| Item | How this POC scores |
|---|---|
| Verified Recipe in the Knowledge Base | Full draft at `.claude/reports/recipe/recipe.md` with architecture diagram, code map, decisions, ROI math, adoption checklist for other Valsoft business units. |
| Weekly portal updates | Reports for Weeks 1–4 in `.claude/reports/weekly/` plus a halftime combined update. Each one is metric-led with explicit hours-saved math. |
| Reusability for other teams | The dispatcher, Judge, multi-channel intake, eval harness, test harness, and flywheel are domain-agnostic. The only domain-specific code is the KB JSONL and the specialist prompts. |

### The five agentic capabilities the judges call out

| Capability | Where it lives in this POC |
|---|---|
| End-to-end resolution | FAQ, account, and billing specialists all auto-resolve and draft replies. Billing specialist calls a tool. |
| Proactive detection | `/api/intake/monitor` accepts Datadog/Sentry events and routes them through the dispatcher. |
| Conversation memory | Resolution-log flywheel gives the next ticket access to prior resolution patterns. (Per-thread chat memory remains a post-sprint item.) |
| Precision routing | Dispatcher emits `category` + `requires_human_review` + confidence; pipeline routes accordingly. |
| Human-in-the-loop collaboration | Refusal trigger on every specialist; PHI mentions force human review; legacy decision engine catches everything the specialists refuse. |

### Horror-story defenses

| Risk | Defense |
|---|---|
| Air Canada — invented refund policy | Specialists answer only from retrieved KB content. Billing specialist refuses any out-of-scope refund. Refusal trigger is a first-class outcome. |
| Chevy Watsonville — $1 Tahoe via prompt injection | Injection patterns route to `escalate` + `requires_human_review`. Dispatcher has no tool access. Multi-run test harness includes 3 injection cases. |
| Cursor "Sam" — hallucinated subscription policy | `source: "model" \| "fallback"` on every result gives provenance. The legacy decision engine is the canonical fallback for refusals. |

---

## Limitations and post-sprint roadmap

- **Per-thread conversation memory** is the cleanest gap. Resolution-log retrieval substitutes for cross-ticket memory; per-thread context on reply chains is the next-week feature.
- **Vision intake on screenshot** depends on whether the deployed Azure model accepts image input. The endpoint falls back cleanly to the `extractedText` path; moving vision to a dedicated `gpt-4o-mini` deployment is the upgrade.
- **Judge currently runs on the same Azure deployment** as the dispatcher because only one model is provisioned in the Sadie-Integration resource. The architectural support for a separate deployment is in place; activate by deploying a second model and setting `AZURE_OPENAI_JUDGE_DEPLOYMENT`.
- **In-memory ticket store** persists per Vercel function instance. Production deployment moves this to SQLite or Postgres in a one-day pass.
- **KB embedding-based retrieval** is a one-day upgrade from the current keyword search. The architecture is ready; the JSONL is already structured for indexing.

---

## Sample API responses (for quick reference)

### Smoke endpoint
```json
{
  "environment": { "openai_configured": true, "anthropic_configured": false, "provider": "openai" },
  "total_samples": 6,
  "results": [
    {
      "id": "demo-002",
      "subject": "How do I reset my password?",
      "redact": { "pii_detected": true, "pii_summary": "EMAIL×1", "tokens_replaced": 1 },
      "dispatcher": {
        "category": "account",
        "confidence": 0.99,
        "reasoning": "Clear password recovery request",
        "requires_human_review": false,
        "source": "model",
        "model": "gpt-5.4-mini",
        "latencyMs": 612
      }
    }
    // ...5 more
  ]
}
```

### Voice intake → FAQ specialist
```json
{
  "success": true,
  "intake": { "source": "voice", "pii_detected": false, "pii_summary": "none" },
  "ticket": {
    "id": "...",
    "status": "resolved_auto",
    "routedBy": "faq_specialist",
    "dispatcher": { "category": "how_to", "confidence": 0.98, "source": "model" },
    "faq": { "resolved": true, "kb_article_id": "KB-006", "kb_title": "Integration Setup Guide" },
    "cost": {
      "totalUsd": 0.000606,
      "byStep": [
        { "step": "dispatcher", "model": "gpt-5.4-mini", "usd": 0.000302 },
        { "step": "judge", "model": "gpt-5.4-mini", "usd": 0.000109 },
        { "step": "faq_specialist", "model": "gpt-5.4-mini", "usd": 0.000195 }
      ]
    }
  }
}
```
