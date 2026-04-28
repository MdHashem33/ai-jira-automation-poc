import { callModel } from '../ai/client';
import { topMatch, type KBArticle } from '../services/kbStore';
import type { ParsedEmail } from '../types';

export type FaqSource = 'model' | 'template' | 'refused';

export interface FaqResult {
  resolved: boolean;
  source: FaqSource;
  kb_article_id?: string;
  kb_title?: string;
  answer?: string;
  reasoning?: string;
  model?: string;
  latencyMs?: number;
  costUsd?: number;
}

const SYSTEM_PROMPT =
  "You are a customer-support assistant named Eva. Your only job is to answer the user's question using the provided knowledge-base article and nothing else. If the article does not contain the answer, respond exactly with: {\"can_answer\": false, \"answer\": \"\", \"reasoning\": \"KB does not cover this request\"}. Never invent facts. Never recommend commitments, refunds, or policy exceptions that are not in the article. Sign off as Eva.";

function buildUserTurn(email: ParsedEmail, article: KBArticle): string {
  return `<knowledge_base_article>
<id>${article.id}</id>
<title>${article.title}</title>
<content>${article.content}</content>
<resolution>
${article.resolution}
</resolution>
</knowledge_base_article>

<message>
FROM: ${email.fromName}
SUBJECT: ${email.subject}
BODY:
${email.cleanBody}
</message>

<task>
Answer the customer using only the knowledge-base article. Return a single JSON object with keys: can_answer (boolean), answer (string, empty when can_answer is false), reasoning (one short sentence). When you answer, include the resolution steps verbatim and sign off as Eva.
</task>

Return the JSON object now.`;
}

/**
 * Attempt to auto-resolve an inbound email using the KB.
 * Returns resolved=false when no confident KB match exists OR when the model
 * says it cannot answer from the article. The caller should then escalate.
 */
export async function attemptFaqResolution(
  email: ParsedEmail,
  options: { minScore?: number } = {},
): Promise<FaqResult> {
  const match = topMatch(`${email.subject}\n${email.cleanBody}`, options.minScore ?? 4);
  if (!match) {
    return {
      resolved: false,
      source: 'refused',
      reasoning: 'No KB article matched the query with sufficient score',
    };
  }

  const started = Date.now();
  try {
    const user = buildUserTurn(email, match.article);
    const response = await callModel('draft_reply', SYSTEM_PROMPT, user, { jsonMode: true });
    const parsed = JSON.parse(response.text);
    const canAnswer = Boolean(parsed.can_answer);
    if (!canAnswer) {
      return {
        resolved: false,
        source: 'refused',
        kb_article_id: match.article.id,
        kb_title: match.article.title,
        reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : 'Model refused to answer from KB',
        model: response.model,
        latencyMs: Date.now() - started,
        costUsd: response.costUsd,
      };
    }

    return {
      resolved: true,
      source: 'model',
      kb_article_id: match.article.id,
      kb_title: match.article.title,
      answer: typeof parsed.answer === 'string' ? parsed.answer : '',
      reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
      model: response.model,
      latencyMs: Date.now() - started,
      costUsd: response.costUsd,
    };
  } catch (err) {
    // LLM failed or JSON parse failed — fall back to the KB resolution text verbatim.
    const fallback = `${match.article.resolution}\n\n— Eva`;
    return {
      resolved: true,
      source: 'template',
      kb_article_id: match.article.id,
      kb_title: match.article.title,
      answer: fallback,
      reasoning: `LLM unavailable; returned KB article ${match.article.id} verbatim. Error: ${
        err instanceof Error ? err.message : 'Unknown error'
      }`,
      latencyMs: Date.now() - started,
    };
  }
}
