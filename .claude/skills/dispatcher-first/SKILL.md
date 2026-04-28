---
name: dispatcher-first
description: Use when deciding what to build next in the support-automation pipeline. Enforces the team's rule — build and harden the dispatcher/classifier to >=80% accuracy BEFORE building specialized resolvers.
---

# Dispatcher-First Architecture

Source: team meeting (2026-04), reinforced by Sage Franch office hours (April 17) and the Fluent 8-phase playbook (Phase 3).

## The Rule

Build **one thing first**: a dispatcher that classifies each inbound request into a category (billing / technical / account / compliance / feature-request / escalate-to-human) with ≥ 80% accuracy on a held-out test set for production-readiness, and ≥ 85% sustained accuracy before expanding to additional channels (the Fluent Phase-3 rollout gate). Only then build specialist sub-agents.

**Design the dispatcher before you build it** (Sage, office hours 13:01). Even if you don't ship the dispatcher first, the category set you define for it is the spec sheet for every specialist that follows. Don't design specialists in isolation.

## Why

- 75/25 rule: ~75% of support requests are repetitive and automatable; ~25% need human empathy/judgment. Misrouting the 25% costs trust; misrouting the 75% costs money. The dispatcher is the single biggest lever on both.
- Specialist quality is capped by dispatcher quality. A billing-specialist is useless if only 60% of billing emails reach it.
- Cheap to iterate: classification is a narrow task you can eval fast with confusion matrices.

## Build Order

1. Define the category set (≤ 8 categories, mutually exclusive).
2. Label a test set of ≥ 100 real-representative messages (use mock data for competition — see `data-governance`).
3. Write the dispatcher prompt per `customer-support-prompting` rules.
4. Run eval → confusion matrix. Iterate prompt + examples until ≥ 80% weighted F1.
5. Only then wire specialists behind it.

## Dispatcher Output Schema

Pin this schema — every caller depends on it:

```json
{
  "category": "billing | technical | account | compliance | feature_request | escalate",
  "confidence": 0.0,
  "reasoning": "one sentence",
  "requires_human_review": true,
  "pii_detected": false
}
```

## Anti-Patterns

- Building 5 specialists in parallel before the dispatcher works. You'll re-label everything.
- Letting the dispatcher "also" resolve easy cases. Keep it pure classification; routing decisions live in the orchestrator.
- Hiding confidence from downstream. Always emit it — the decision engine uses it to gate auto-resolve vs. escalate.

## Checklist

- [ ] Category set written down and frozen
- [ ] Labeled test set ≥ 100 items (≥ 200 for the hallucination benchmark per `hallucination-defense`), stratified across categories
- [ ] Confusion matrix computed
- [ ] Macro F1 ≥ 0.80 for production, ≥ 0.85 sustained before channel expansion (Fluent Phase 3 gate)
- [ ] Low-confidence fallback route defined (auto-demote to `escalate` below 0.70)

## First specialist to build: FAQ (Jordi's office-hours pattern)

When moving from "dispatcher alone" to "dispatcher + specialists," ship the **FAQ/how-to specialist first**. Reason: low risk (informational only), high volume (a large share of inbound), RAG-shaped (already have KB). Dispatcher's `how_to` category maps 1:1. Every other specialist can stay as "escalate to human" until the FAQ path is solid.
