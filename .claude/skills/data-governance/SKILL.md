---
name: data-governance
description: Use whenever handling support data, test fixtures, KB content, logs, or anything fed to an LLM. Enforces PHI/PII rules and the competition's mock-data-only policy.
---

# Data Governance & Mock Data

Source: team meeting (2026-04).

## Hard Rules

1. **Never put real customer, PHI, or production data into free or unproven LLM tooling.** For the competition, this means **mock/dummy data only**.
2. **Cleansing layer is mandatory** — every payload that enters an AI call passes through PII/PHI redaction first.
3. **No black-box third-party tools** on sensitive data paths. If we can't audit the data-flow, we don't use it.
4. **Model-agnostic storage of prompts/outputs.** Log the prompt, model ID, and output to our own store, not the vendor's dashboard.

## Cleansing Layer — what to strip/mask before LLM

- Email addresses → `[EMAIL]` (or tokenize if needed for correlation)
- Phone numbers → `[PHONE]`
- Names → `[NAME_1]`, `[NAME_2]` (consistent within a session)
- Account IDs, policy numbers, SSN, MRN → `[ID_KIND]`
- Credit-card-like 13–19-digit runs → `[CARD]`
- Dates of birth → `[DOB]`
- Street addresses → `[ADDR]`
- Free-text medical/diagnosis terms (if PHI in scope) → flag for human review, do NOT send to LLM

Keep a reversible mapping server-side so the final reply can be re-hydrated with real names for the user.

## Mock Data Generation

- Keep a `fixtures/` directory of seeded fake emails, tickets, and KB articles.
- Use Faker-style generation with a fixed seed for reproducible evals.
- Never copy real production text into fixtures — paraphrase.
- Label each fixture file: `# GENERATED — NOT REAL DATA` on line 1.

## Logging

- Log prompt + response + model ID to our own DB with a retention policy.
- Redact PII/PHI from logs too — the cleansed version is what the LLM saw anyway.
- Audit trail: every AI decision gets a row (timestamp, input hash, model, output, confidence, human-override-yes/no).

## Checklist before any LLM call

- [ ] Cleansing layer ran and redaction map is stored
- [ ] Data origin confirmed (mock / cleansed-real / NEVER raw-production)
- [ ] Destination model's data-retention policy is acceptable (or zero-retention endpoint used)
- [ ] Output re-hydration step present if user-facing
- [ ] Logged to our audit store, not only vendor's

## Vendor risk — Tier 1 vs Tier 2 (Valsoft Vendor Risk Assessment)

Any third-party platform or model endpoint used in production must pass vendor-risk review:

- **Tier 1** (required for): access to sensitive data, privileged systems, remote management tools, backups, security tooling, critical operations. Stronger evidence, tighter contractual controls, closer review of access/incident-response/recovery. Usually scoped narrowly; reassessment required before scope expansion.
- **Tier 2** (acceptable for): business-function support without deep privileged access or broad sensitive-data exposure. Reasonable due diligence and standard contractual review. Reassess if scope grows.

**Hard gate:** vendors without SOC 2 or ISO 27001 certification AND GDPR/CCPA documentation do NOT pass assessment and cannot be used. AI products exposed to PII or IP need product-level vetting on top of vendor-level.

For our POC, Azure OpenAI qualifies (enterprise-controlled, Microsoft's compliance footprint). Any swap to a consumer API or a smaller vendor triggers a fresh Tier-1 review.

## Tooling access via MCP + read-only service accounts

From the April 17 office hours (Victor 16:20, Patrick 20:46, Adam 23:02): never give an AI direct database access or a broad-scope API token. Build **tools** — tight, purpose-built endpoints on our own service layer — and expose them to the AI via an MCP server. Scope the service account to the minimum read/write the task requires.

Pattern:
1. Identify the smallest data the specialist actually needs.
2. Write a tool (function) that returns exactly that data.
3. Expose the tool via MCP with an account that can call only that function.
4. The AI never sees the raw DB, never runs raw SQL, never holds a write token for systems it only reads.
