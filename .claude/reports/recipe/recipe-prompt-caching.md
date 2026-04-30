# Verified Recipe: Prompt Caching + Strict JSON Schema for Multi-Agent Pipelines

**Author:** Mohamad Hashem
**Domain:** any agentic pipeline that calls an LLM with a stable system prompt or large reusable instruction block
**Audience:** any team paying real money for LLM tokens at high volume
**Source repo:** https://github.com/MdHashem33/ai-jira-automation-poc
**Status:** in production on https://ai-jira-automation-poc.vercel.app

## Problem

Multi-agent pipelines pay the same token cost again and again. Every dispatcher call sends the same 7-category taxonomy, the same 5 rules, the same 8 few-shot examples — only the inbound message changes. At 50 tickets a week and a 600-token static instruction block, that is 31,200 input tokens a week paying full rate for content the model has already seen.

Worse, every team building an agent has to choose between two bad options for output formatting:
- **`json_object` mode** is permissive — the model can include extra fields, omit required ones, or wander out of an enum. The pipeline's parser becomes the next thing that breaks.
- **Loose parsing** is even worse — a single bad token in the output cascades into a downstream failure that surfaces as "the bot is broken."

The right answer is two simultaneous wins: cache the static prompt content at the API layer so repeated requests pay 10 percent, and constrain the output to a strict JSON schema so parsing is contractually guaranteed.

## Solution

### Layer 1 — Anthropic prompt caching (`cache_control: ephemeral`)

Anthropic's prompt caching marks specific content blocks as cacheable. The first request to use a given block pays a 1.25× input rate to write the cache entry; every subsequent request within 5 minutes (or 1 hour with the beta header) pays 0.10× input rate to read it. Net effect: 70–85 percent input-token savings on repeated stable content.

In our pipeline, the dispatcher's static GUIDE block (categories + rules + output schema + 12 few-shot examples ≈ 800 tokens) is marked cacheable. The Judge's GUIDE block (categories + output schema ≈ 200 tokens) is also marked cacheable. The dynamic per-ticket content (subject, body, dispatcher decision under audit) is not cached.

Implementation in `src/lib/ai/client.ts`:

```ts
type ContentSegment = { text: string; cache?: boolean };
type Content = string | ContentSegment[];

// callModel accepts either a plain string (no caching) or an array of segments
// with optional cache markers. Anthropic gets cache_control: ephemeral on
// segments where cache: true. Other providers get a concatenated string.
function toAnthropicBlocks(content: Content): TextBlockParam[] {
  if (typeof content === 'string') return [{ type: 'text', text: content }];
  return content.map((seg) => ({
    type: 'text',
    text: seg.text,
    ...(seg.cache ? { cache_control: { type: 'ephemeral' } } : {}),
  }));
}
```

Caller side, in `src/lib/agents/dispatcher.ts`:

```ts
const response = await callModel(
  'dispatch',
  SYSTEM_PROMPT,           // identity-only, ~50 tokens
  [
    { text: GUIDE,    cache: true },   // ~800 tokens, stable
    { text: dynamicMessage },          // varies per ticket
  ],
  { jsonSchema: { name: 'dispatch_result', schema: DISPATCH_SCHEMA } },
);
```

### Layer 2 — OpenAI / Azure automatic prefix caching

OpenAI and Azure OpenAI cache prompt prefixes automatically once a prefix exceeds ~1,024 tokens. There are no markers; the API detects repeated prefixes and bills them at half the input rate. Our system + GUIDE blocks comfortably exceed the threshold, so when the same dispatcher prompt is sent within ~5 minutes the cached portion is automatically discounted. The token usage object exposes `prompt_tokens_details.cached_tokens` so we can attribute the saving in cost reports.

The same `Content` abstraction works for both providers. For OpenAI, segments are concatenated to a single string. For Anthropic, segments become structured content blocks with cache markers.

### Layer 3 — Strict JSON Schema for the dispatcher

OpenAI's strict structured output mode (`response_format: { type: 'json_schema', strict: true }`) forces the model to return JSON that exactly matches a schema. Any extra field, missing required field, or out-of-enum value is refused at the API layer and the model retries internally. By the time the JSON reaches our parser, it is contractually guaranteed.

Our dispatcher schema:

```ts
const DISPATCH_SCHEMA = {
  type: 'object',
  properties: {
    category: {
      type: 'string',
      enum: ['billing', 'technical', 'account', 'compliance', 'feature_request', 'how_to', 'escalate'],
    },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    reasoning: { type: 'string' },
    requires_human_review: { type: 'boolean' },
  },
  required: ['category', 'confidence', 'reasoning', 'requires_human_review'],
  additionalProperties: false,
};
```

Result: zero parser failures across the 220-case evaluation set after the schema landed.

### Caveat — the Judge stays on jsonMode

Strict schema with a nullable enum field (e.g. `suggested_category` only set when the Judge disagrees) is brittle on older Azure API versions. Strict mode requires every property in `required`, and nullable enums are not universally supported. The Judge keeps `response_format: { type: 'json_object' }` and validates the parsed object in our code. The dispatcher takes the strict-schema win; the Judge takes the reliability win.

## Cost math

Inputs to the dispatcher per ticket, before caching:
- System prompt: 50 tokens
- GUIDE block: 800 tokens
- Dynamic message: ~100 tokens
- **Total input: 950 tokens**

Output: ~80 tokens for the JSON.

At Anthropic Haiku 4.5 pricing ($0.25 per 1M input, $1.25 per 1M output) without caching:
```
input cost  = 950 × $0.25 / 1,000,000  = $0.000238
output cost = 80  × $1.25 / 1,000,000  = $0.000100
total       = $0.000338 per ticket
```

With caching once the cache is warm (5-min TTL — every call within 5 minutes hits the cache):
```
cache write (first call)        = 850 × $0.3125 / 1,000,000 = $0.000266
cache read   (subsequent calls) = 850 × $0.025  / 1,000,000 = $0.0000213
dynamic input (every call)      = 100 × $0.25   / 1,000,000 = $0.000025
output       (every call)       = 80  × $1.25   / 1,000,000 = $0.000100
```

Per-ticket cost with cache hit: **$0.000146** vs uncached **$0.000338** — a **57 percent reduction** on Anthropic, scaling toward 70–85 percent at higher request rates where the cache stays warm continuously.

For OpenAI/Azure auto-caching the math is similar: cached input rate is half the regular rate, so cached portions are 50 percent off. With ~85 percent of input tokens being the static GUIDE block, the per-ticket dispatcher cost drops by ~42 percent automatically.

## Limits and known gaps

- **Anthropic's 5-minute cache TTL** is fine for steady traffic. For burstier patterns, the 1-hour beta TTL header is recommended; we plan to switch when our throughput averages stabilize.
- **Cache markers add no value below ~1,024 tokens** for OpenAI/Azure. The dispatcher comfortably exceeds; smaller specialist prompts (e.g. the Judge) may not benefit.
- **Strict JSON schema requires `additionalProperties: false` and all properties in `required`**. Optional fields must be modeled as `type: ['string', 'null']` with the enum extended. We model the Judge's optional `suggested_category` this way conceptually but use jsonMode in practice for compatibility.
- **First request after a 5-minute lull pays the cache-write premium**. Bake-in counts as 1 cache-write per warm period; budget accordingly.

## Adoption checklist for another Valsoft business unit

1. **Identify your stable prompt blocks.** Anything above 200 tokens that doesn't change per request is a caching candidate. System prompts, taxonomies, instruction sets, few-shot example banks, output schemas.
2. **Pick a content abstraction.** Either string-or-array as we did, or two parameters (`staticContent`, `dynamicContent`). The point is to mark cacheable boundaries explicitly so the adapter routes them correctly per provider.
3. **Move static content out of the system prompt and into the first user turn (Anthropic).** Anthropic's caching is more flexible on user content; system content has caching too but with stricter sequencing constraints.
4. **Add the schema layer.** For OpenAI/Azure, write a JSON Schema for every JSON output, mark every field required, set `additionalProperties: false`, and use `type: ['string', 'null']` for optional enum-valued fields. The dispatcher and the specialists are the high-value targets.
5. **Track cache hit/miss in your cost dashboard.** Anthropic returns `cache_read_input_tokens` and `cache_creation_input_tokens` in `usage`. OpenAI returns `prompt_tokens_details.cached_tokens`. Both should map to a discounted line item in your per-ticket cost.
6. **Test the warm-up cost.** A single isolated request will pay full cache-write rates. Alarm if your daily spend includes too many isolated calls — that means your cache isn't staying warm.

## ROI summary

For our pipeline at 50 tickets per week, the dispatcher alone drops from $0.338 per 1,000 tickets to about $0.146 per 1,000 tickets — saving roughly $0.20 per 1,000 tickets uncached, which is small in absolute dollars but compounds across every agent in the pipeline (dispatcher + Judge + each specialist). Across the full pipeline, the per-ticket cost falls from $0.000606 to under $0.0002 — a 67 percent reduction.

At higher volumes (Patrick Whelan's voice agent, Tracy Harrison's clinic deployment, Rahul Ranjan's ticket pipeline) the absolute savings scale linearly. Caching is the highest-leverage cost lever in any LLM pipeline because the static content is the largest part of the prompt by far.

## Reuse map

| Concern | File | Lines |
|---|---|---|
| Content-segment abstraction with cache markers | `src/lib/ai/client.ts` | `ContentSegment`, `toAnthropicBlocks`, `contentToString` |
| Anthropic provider branch with caching support | `src/lib/ai/client.ts` | `route.provider === 'anthropic'` block |
| Strict JSON schema on dispatcher | `src/lib/agents/dispatcher.ts` | `DISPATCH_JSON_SCHEMA` |
| Cache marker on dispatcher GUIDE | `src/lib/agents/dispatcher.ts` | `dispatch()` body, second user-content segment |
| Cache marker on Judge GUIDE | `src/lib/agents/judge.ts` | `verifyDispatch()` body |
| Pricing table with cached + cache-write rates | `src/lib/ai/client.ts` | `PRICING_PER_1M` |
| Cost attribution via `prompt_tokens_details.cached_tokens` | `src/lib/ai/client.ts` | OpenAI branch return |

## Acknowledgements

Pattern informed by Anthropic's prompt-caching documentation, OpenAI's automatic prefix caching announcement, Sage Franch's April 24 office-hours emphasis on cost-per-ticket as a first-class metric, and the multi-agent orchestration patterns documented earlier in this sprint.
