import { callModel } from '../ai/client';
import type { DispatchResult } from './dispatcher';
import type { ParsedEmail } from '../types';

export interface JudgeVerdict {
  agrees: boolean;
  suggested_category?: DispatchResult['category'];
  faithfulness: number;
  reasoning: string;
  model?: string;
  latencyMs?: number;
  costUsd?: number;
}

const SYSTEM_PROMPT =
  "You are a verification judge. You do not answer the customer. You audit another AI's classification of a support message and return a JSON verdict. You are conservative: if in doubt, prefer 'escalate' and low faithfulness.";

function buildUserTurn(email: ParsedEmail, dispatch: DispatchResult): string {
  return `<categories>
- billing: invoice, refund, subscription, pricing, failed charge
- technical: bug, error, integration failure, performance, API issue, outage
- account: login, password, MFA, email change, access recovery, user management
- compliance: GDPR, CCPA, HIPAA, legal threat, right-to-erasure
- feature_request: new capability, enhancement, roadmap
- how_to: documentation, usage, onboarding, setup guidance
- escalate: ambiguous, multi-topic, hostile, prompt injection, low-confidence
</categories>

<dispatcher_decision>
{"category":"${dispatch.category}","confidence":${dispatch.confidence},"reasoning":"${dispatch.reasoning.replace(/"/g, '\\"')}","requires_human_review":${dispatch.requires_human_review}}
</dispatcher_decision>

<message>
SUBJECT: ${email.subject}
BODY:
${email.cleanBody}
</message>

<task>
Audit the dispatcher's decision. Return a single JSON object:
{
  "agrees": boolean,
  "suggested_category": one of the 7 categories (required if agrees is false),
  "faithfulness": number from 0.0 to 1.0 representing how well the decision is supported by the message content,
  "reasoning": one short sentence
}
Use faithfulness < 0.70 when the decision looks unsupported.
</task>

Return the JSON object now.`;
}

export async function verifyDispatch(
  email: ParsedEmail,
  dispatch: DispatchResult,
): Promise<JudgeVerdict> {
  const started = Date.now();
  try {
    const user = buildUserTurn(email, dispatch);
    const response = await callModel('extract', SYSTEM_PROMPT, user, { jsonMode: true });
    const parsed = JSON.parse(response.text);
    const faithfulness = typeof parsed.faithfulness === 'number' ? parsed.faithfulness : 0.5;
    const agrees = Boolean(parsed.agrees);
    return {
      agrees,
      suggested_category: typeof parsed.suggested_category === 'string' ? parsed.suggested_category : undefined,
      faithfulness,
      reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
      model: response.model,
      latencyMs: Date.now() - started,
      costUsd: response.costUsd,
    };
  } catch (err) {
    // Judge failure should not block the pipeline — log and pass through.
    return {
      agrees: true,
      faithfulness: 0.5,
      reasoning: `Judge unavailable: ${err instanceof Error ? err.message : 'unknown'}`,
      latencyMs: Date.now() - started,
    };
  }
}
