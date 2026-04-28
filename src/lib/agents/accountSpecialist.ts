import { callModel } from '../ai/client';
import { topMatch } from '../services/kbStore';
import type { ParsedEmail } from '../types';

export type AccountSubIntent =
  | 'password_reset'
  | 'mfa_recovery'
  | 'email_change'
  | 'account_lockout'
  | 'user_lifecycle'
  | 'other';

export interface AccountResult {
  resolved: boolean;
  source: 'model' | 'template' | 'refused';
  sub_intent: AccountSubIntent;
  kb_article_id?: string;
  kb_title?: string;
  answer?: string;
  reasoning?: string;
  model?: string;
  latencyMs?: number;
  costUsd?: number;
}

const SYSTEM_PROMPT =
  'You are Eva, a customer-support assistant. You only handle account-related requests (password resets, MFA recovery, email changes, account access). Answer using only the provided KB article. If the request is outside your scope or the KB cannot answer, return JSON {"can_answer": false, "sub_intent": "...", "answer": "", "reasoning": "..."}. Never invent policy. Sign as Eva.';

function classifySubIntent(email: ParsedEmail): AccountSubIntent {
  const text = `${email.subject}\n${email.cleanBody}`.toLowerCase();
  if (/\b(password|reset|forgot|locked out|cannot log|can'?t log)\b/.test(text)) return 'password_reset';
  if (/\b(mfa|2fa|two-factor|authenticator|sms code)\b/.test(text)) return 'mfa_recovery';
  if (/\b(change .*(email|e-mail)|update .*(email|e-mail)|new email)\b/.test(text)) return 'email_change';
  if (/\b(lockout|locked|unlock|suspended|reactivate)\b/.test(text)) return 'account_lockout';
  if (/\b(invite|provision|onboard|deactivate|merge|transfer ownership|user .*(remove|delete)|seat)\b/.test(text)) return 'user_lifecycle';
  return 'other';
}

export async function attemptAccountResolution(email: ParsedEmail): Promise<AccountResult> {
  const subIntent = classifySubIntent(email);
  const match = topMatch(`${email.subject}\n${email.cleanBody}`, 3);

  if (!match) {
    return {
      resolved: false,
      source: 'refused',
      sub_intent: subIntent,
      reasoning: 'No KB article matched',
    };
  }

  const started = Date.now();
  const userTurn = `<knowledge_base_article>
<id>${match.article.id}</id>
<title>${match.article.title}</title>
<resolution>
${match.article.resolution}
</resolution>
</knowledge_base_article>

<message>
SUBJECT: ${email.subject}
BODY:
${email.cleanBody}
</message>

<task>
Account sub-intent: ${subIntent}. Answer the customer using only the KB article. Return a single JSON object with keys: can_answer (boolean), sub_intent (string), answer (string), reasoning (one sentence). Sign the answer as Eva. If the article does not cover the request, can_answer must be false.
</task>

Return the JSON object now.`;

  try {
    const response = await callModel('draft_reply', SYSTEM_PROMPT, userTurn, { jsonMode: true });
    const parsed = JSON.parse(response.text);
    const canAnswer = Boolean(parsed.can_answer);
    if (!canAnswer) {
      return {
        resolved: false,
        source: 'refused',
        sub_intent: subIntent,
        kb_article_id: match.article.id,
        kb_title: match.article.title,
        reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : 'Refused per KB scope',
        model: response.model,
        latencyMs: Date.now() - started,
        costUsd: response.costUsd,
      };
    }
    return {
      resolved: true,
      source: 'model',
      sub_intent: subIntent,
      kb_article_id: match.article.id,
      kb_title: match.article.title,
      answer: typeof parsed.answer === 'string' ? parsed.answer : '',
      reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
      model: response.model,
      latencyMs: Date.now() - started,
      costUsd: response.costUsd,
    };
  } catch (err) {
    return {
      resolved: true,
      source: 'template',
      sub_intent: subIntent,
      kb_article_id: match.article.id,
      kb_title: match.article.title,
      answer: `${match.article.resolution}\n\n— Eva`,
      reasoning: `LLM unavailable; returned KB article ${match.article.id} verbatim. Error: ${err instanceof Error ? err.message : 'Unknown'}`,
      latencyMs: Date.now() - started,
    };
  }
}
