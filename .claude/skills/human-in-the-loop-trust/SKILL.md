---
name: human-in-the-loop-trust
description: Use when deciding whether AI output goes directly to a customer or through a human agent. Enforces trust-preserving defaults — AI behind-the-scenes for sensitive contexts, full auto only when safe and confident.
---

# Human-in-the-Loop & Trust

Sources: team meeting + Anthropic support-chat guide.

## The Spectrum

| Mode | When to use | Example |
|---|---|---|
| **Full auto** | High confidence + low risk + KB-grounded + non-sensitive | Password reset, rate-limit question |
| **AI draft → human send** | Medium confidence, or client is AI-resistant, or brand-tone matters | Billing dispute explanation |
| **AI summary → human writes** | Low confidence, or sensitive topic (medical, legal, compliance) | GDPR/PHI request, complaint |
| **AI hidden entirely** | PHI, regulated, or client contractually forbids AI-to-customer | Mental-health intake |

## The Rule for AI-Resistant Clients

Do **not** force AI-to-customer interaction where the client's users don't trust AI. Instead, use AI behind-the-scenes to empower human agents: draft replies, pull KB snippets, summarize threads, highlight risk flags. The customer talks to a human; the human's effective throughput doubles.

## Mandatory Human Review (auto-escalate, never auto-resolve)

Trigger human review whenever ANY of these fire:

- `requires_human_review = true` from dispatcher
- PHI detected (medical terms, MRN, diagnoses)
- GDPR / CCPA / HIPAA / right-to-erasure language
- Legal threat words ("lawsuit", "attorney", "sue")
- Sentiment = `frustrated` + priority ≥ `high`
- Dispatcher confidence < threshold (default 0.70)
- KB relevance < 0.20 (no grounded answer)
- Intent ∈ {security_incident, service_outage, billing_dispute, feature_request}

This list already matches the POC's Decision Engine (`src/lib/services/pipeline.ts`) — extend it, don't replace it.

## UI/UX Implications

- Every AI-drafted reply that a human sends needs a one-click "approve & send" and a "edit" path.
- Log every override: human corrections are the highest-value training signal we have.
- Show the confidence + KB-source inline so the human can trust/verify fast.

## Anti-Patterns

- Shipping full-auto for a category you haven't evaluated — always stage: shadow → AI-draft → auto.
- Hiding the AI when the customer would appreciate knowing (transparency > deception).
- Treating "escalate to human" as failure. It's a core success mode; instrument it, don't hide it.
