# Verified Recipe: PHI-Safe Support Automation in Unstructured Text

**Author:** Mohamad Hashem
**Domain:** customer-support automation in regulated industries (healthcare, finance, education, legal)
**Audience:** any Valsoft business unit whose support data may include Personal Health Information, Personally Identifiable Information, or other regulated content
**Source repo:** https://github.com/MdHashem33/ai-jira-automation-poc
**Status:** in production on https://ai-jira-automation-poc.vercel.app, with a Day-6 hybrid-NER upgrade scheduled

## Problem

Customer-support data is the wildest data inside an enterprise. It is unstructured, written by stressed users, and routinely carries regulated content — health conditions, prescriptions, account numbers, social security numbers, IP addresses, internal employee names — embedded inside ordinary sentences. Tracy Harrison's framing in the April 24 office hours captured the problem precisely: PHI in support is *incidental*, not *structured*. A user writes "I was documenting on Mrs. Jones's fall today and I noticed your button doesn't work" and the support system now holds protected information it did not ask for, alongside a routine bug report.

A naïve LLM deployment makes this worse. The model sees the raw text. The vendor's data-retention policy decides what happens next. Logs become a discovery liability. Compliance reviews stall. HIPAA business-associate agreements take six weeks. Tracy's team cannot even ship a live demo because of this exact pathway.

The conventional answer — "send the data to an LLM and ask it to identify the PHI" — defeats the point: the sensitive data has already left the perimeter. The right answer is layered, deterministic-first, and assumes the worst about what the user pasted.

## Solution

This recipe documents a four-layer defense that runs on every inbound message before any external model call sees it. It is in production today on the support pipeline this Verified Recipe set is built around. Every layer is independently testable and independently auditable.

### Layer 1 — Channel-aware intake with explicit PHI flagging

Every intake endpoint is purpose-built and structured. Email goes through `/api/email/simulate`. Voice transcripts go through `/api/intake/voice`. Screenshots go through `/api/intake/screenshot` with an explicit `phi_likely` flag returned by the vision step. Proactive monitor events go through `/api/intake/monitor`. Each endpoint has its own validation; none accept raw blobs without structure.

The screenshot endpoint deserves special attention: when the customer attaches an image, the vision step is asked specifically whether the image contains PHI markers (medical conditions, patient identifiers, prescriptions, diagnoses) before the extracted text proceeds. The flag travels with the ticket forever and forces human review regardless of category later.

### Layer 2 — Deterministic regex redaction with reversible map

Before any text reaches an LLM, it is passed through `redact()` in `src/lib/ai/redact.ts`. The function applies seven regex patterns in order:

```
EMAIL    → [EMAIL_n]
URL      → [URL_n]
CARD     → [CARD_n]    (13–19 digit runs with optional separators)
SSN      → [SSN_n]
PHONE    → [PHONE_n]   (international + multiple separator formats)
IP       → [IP_n]
ACCOUNT  → [ACCOUNT_n] (account, customer, policy, member, MRN, patient identifiers)
```

The output is `{ cleansed, entries, piiDetected }`. The `entries` array holds the reversible map — each token paired with the original value — and is kept server-side. The cleansed string goes to the LLM; the original strings never leave the function unless the response needs to be re-hydrated for the customer (e.g., echoing back their email address with `rehydrate()` after the model has already produced the reply).

Key design choices:
- **Tokens are unique per occurrence within a session.** Two appearances of the same email get the same token, so the model can still reason about "the same person was mentioned twice" without ever seeing the email itself.
- **The MRN/patient pattern is in the ACCOUNT bucket on purpose.** Healthcare account identifiers are functionally PII and they should be redacted with the same priority as a credit card.
- **Regex order matters.** Email is matched first because card-pattern false positives can occur on long phone numbers; running EMAIL → URL → CARD → SSN preserves precision.

### Layer 3 — Dispatcher PHI rule (LLM-side, post-redaction)

The dispatcher's first user turn includes an explicit rule (Rule 3 in `src/lib/agents/dispatcher.ts`):

> If the message mentions medical conditions, patient data, diagnoses, or PHI — set `requires_human_review=true` regardless of category.

Even after regex redaction strips identifiers, the *content* of a message can still indicate PHI. "I was documenting on a patient's fall" no longer carries the patient's name (redacted), but the dispatcher recognises the *context* and forces human review. The eval set tests this: `eval-028` is a clinic-staff onboarding question that mentions a patient diagnosis; the expected outcome is `requires_human_review=true`. `eval-111` is a similar PHI-mention case that should escalate.

The dispatcher Judge then verifies the dispatcher's call. If the Judge disagrees on the PHI flag, the ticket escalates regardless. Two independent agents must both agree before PHI-flagged content reaches an automated reply path; in practice, this never happens, because the design refuses auto-reply on `requires_human_review=true`.

### Layer 4 — Audit trail with provenance

Every ticket records:
- `pii_detected: boolean` — at least one regex pattern fired
- `pii_summary: string` — counts by kind (e.g. `EMAIL×1, ACCOUNT×2`)
- `dispatcher.source: 'model' | 'fallback'` — provenance flag
- `judge.faithfulness: number` — independent verification score
- `routedBy: enum` — which agent, if any, produced the auto-reply

The flywheel resolution log appends an entry on every outcome. A compliance review can answer two questions for any past ticket: did sensitive data appear, and who (or what) handled it. The audit trail is exportable as CSV via `/api/audit/export` (Day 9 feature).

## Day-6 upgrade — hybrid offline NER

Sage Franch's RegTech precedent (April 24 office hours) and Tracy Harrison's pain point both point at the same gap: regex catches structured patterns, not incidental mentions. Names, places, organisations, conditions written in narrative form ("the patient with hypertension I saw last Tuesday") slip through.

The Day-6 upgrade adds a fifth layer between intake and regex:

- A small, prompt-cached LLM call (Anthropic Claude Haiku 4.5 with `cache_control: ephemeral`) extracts named entities — `PERSON`, `LOCATION`, `ORGANIZATION`, `MEDICAL_CONDITION`, `MEDICATION` — from the cleansed text.
- Each entity is replaced with a `[NAME_n]`, `[LOCATION_n]`, etc. placeholder in the same reversible-map style.
- Cached input keeps cost negligible: the first ticket pays full price, every repeat ticket within the cache window pays 10 percent.

This is the offline-NER hybrid Sage recommended, adapted for serverless. The local-model alternative (spaCy, lingua-py NER) was considered but rejected for serverless deployment cold-start time. A future deployment pinned to a single instance can swap in `en_core_web_trf` and remove the LLM call entirely.

## Limits and risk register

- **Re-identification of de-labeled medical data** is a real concern in high-stakes contexts. Replacing names with tokens does not anonymise the dataset against an adversary with auxiliary information. For HIPAA Limited Data Sets this approach is sufficient; for full anonymisation it is not. Document the risk tolerance for the deployment and apply additional masking (date shifting, ZIP-3 truncation) when warranted.
- **The regex layer cannot detect novel patterns.** A new account-ID format your team adopts is invisible to the redactor until you add the regex. Audit the patterns quarterly; treat the regex set as a maintained artifact, not a static list.
- **The vision PHI flag is best-effort.** A small thumbnail of an EHR screen may not be classifiable; the flag is a heuristic, not a guarantee. Treat any unflagged image as a candidate for routing through human review when the customer's segment is known to be healthcare.
- **Reversible map is in-memory.** Production needs an encrypted store keyed by ticket ID. The current implementation is per-request; the next-week upgrade is to KV with TTL.
- **No PHI in logs.** The cleansed string is what gets logged, but the audit trail still records `pii_summary`. If a regulator wanted bit-for-bit reconstruction, the reversible map's encrypted store would have to be retained and produced on subpoena. Plan for that retention as part of your DPO conversation.

## Adoption checklist for another Valsoft business unit

1. **Inventory your PII/PHI surface.** What kinds of identifiers appear in your support data? Add a regex for each, in priority order, to `redact.ts`.
2. **Decide retention for the reversible map.** Per-request (no retention) is the safest default. If your team needs to re-hydrate post-incident, encrypt and TTL.
3. **Add domain-specific dispatcher rules.** The dispatcher's PHI rule is the template. Add equivalent rules for any content that should force human review in your context (litigation hold, executive-level escalation, regulator-named entities).
4. **Test with adversarial fixtures.** Add at least 10 PHI-laden examples to your eval set. Confirm the dispatcher routes each to `requires_human_review=true`. Run the multi-run test harness three times — consistency below 70 percent on PHI cases is a non-shipper.
5. **Wire the audit export.** A compliance officer should be able to answer "did this ticket touch PHI?" with one query.
6. **BAA before go-live.** If your customers are HIPAA-covered entities, sign your BAA with the LLM vendor before any non-mock traffic. For Anthropic Claude Workspaces and Azure OpenAI this is straightforward; for other vendors confirm the data-retention controls.
7. **Tabletop a breach drill quarterly.** Walk through what happens if a regex misses a credit-card number. The exercise will surface gaps faster than any spec.

## ROI of getting this right

The cost of getting PHI handling wrong is not measured in hours. It is measured in HIPAA penalties (US $100 to US $50,000 per violation, capped at US $1.5M per year per identical violation), in BAA breach disclosures, and in customer trust. The cost of getting it right, in this implementation, is the four layers above plus a Day-6 hybrid NER stage — total infrastructure: zero, total ongoing API cost on the cached NER: under US $0.01 per 1,000 tickets after the cache warms.

## Reuse map

| Layer | File | Lines |
|---|---|---|
| Channel-aware intake | `src/app/api/intake/voice/route.ts`, `screenshot/route.ts`, `monitor/route.ts` | redact call sites |
| Regex redaction | `src/lib/ai/redact.ts` | 28-67 |
| Dispatcher PHI rule | `src/lib/agents/dispatcher.ts` | rule 3 in the GUIDE block |
| Audit fields on ticket | `src/lib/types.ts` | `dispatcherShadow.pii_*`, `routedBy`, `judgeVerdict.faithfulness` |
| Eval coverage | `fixtures/eval/dispatcher.jsonl` | `eval-028`, `eval-111`, plus the 24 entries with `pii_expected: true` |

The full implementation is in the repo's `main` branch as of 2026-04-30. Day-6 hybrid NER lands as a separate commit; until it ships, the four layers above are the production posture.

## Acknowledgements

This pattern is informed by Sage Franch's hallucination-mitigation playbook (the production-readiness checklist's PHI risk rating), Sage's RegTech offline-model recommendation (April 24 office hours), Tracy Harrison's office-hours framing of incidental PHI in unstructured text, and the data-governance constraints documented at the start of this sprint.
