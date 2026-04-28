# Progress update — Weeks 2 and 3

**Author:** Mohamad Hashem

## Where the POC stands

The dispatcher is no longer in shadow mode. It classifies inbound tickets at **macro F1 0.967** across 7 categories on a 120-case mock evaluation (target was 0.80), accuracy **96.7 percent**, human-review flag accuracy **99.2 percent**, running on Azure OpenAI `gpt-5.4-mini`. A **Dual-Model Judge** verifies every decision before any downstream action, reporting a faithfulness score that gates the specialist path. A **FAQ specialist** now auto-resolves how-to tickets by retrieving and grounding against the knowledge base, with a refusal trigger for unanswerable cases.

## Channels and cost

The pipeline runs against three intake channels: email, **voice** (transcript-based endpoint, Azure Speech slots in upstream), and **screenshot** (vision or pre-extracted text, mandatory PHI flag). End-to-end cost per typical how-to resolution is about **US $0.0006** — three LLM calls across dispatcher, judge, and specialist.

## Metrics snapshot

| Metric | Result |
|---|---|
| Macro F1 on 120 fixtures | 0.967 |
| Account category F1 (was 0.867 pre-iteration) | 0.971 |
| Human-review flag accuracy | 99.2 percent |
| Average cost per ticket, how-to path | US $0.0006 |
| Channels supported | 3 (email, voice, screenshot) |
| Specialists live | 1 (FAQ, more in Week 4) |
| Hours saved per week (running total) | 4.5 to 8.5 |

## What is next

Week 4 brings a billing specialist and an account-recovery specialist with scoped tool use, a proactive-detection log-hook for Phase 5, a confidence-calibration pass on the dispatcher, and the complete Verified Recipe draft for the knowledge base.
