import { callModel } from '../ai/client';
import { topMatch } from '../services/kbStore';
import { extractInvoiceNumber, lookupInvoice, type InvoiceRecord } from '../services/billingTool';
import type { ParsedEmail } from '../types';

export interface BillingResult {
  resolved: boolean;
  source: 'model' | 'template' | 'refused';
  invoice?: InvoiceRecord;
  kb_article_id?: string;
  kb_title?: string;
  answer?: string;
  reasoning?: string;
  model?: string;
  latencyMs?: number;
  costUsd?: number;
}

const SYSTEM_PROMPT =
  'You are Eva, a customer-support assistant for billing questions. You may consult an invoice-lookup tool result and a KB article. Answer using only the tool data and the article. Never invent invoice numbers, amounts, or refund policies. If the tool returns status unknown OR the customer is asking for an action your KB does not cover (refund of arbitrary amount, billing exception, contract change), return {"can_answer": false, ...}. Sign as Eva.';

export async function attemptBillingResolution(email: ParsedEmail): Promise<BillingResult> {
  const invoiceNumber = extractInvoiceNumber(`${email.subject}\n${email.cleanBody}`);
  const invoice = invoiceNumber ? lookupInvoice(invoiceNumber) : undefined;
  const match = topMatch(`${email.subject}\n${email.cleanBody}`, 3);

  const started = Date.now();
  const userTurn = `<tool_result name="lookupInvoice">
${invoice ? JSON.stringify(invoice, null, 2) : 'No invoice number found in the message — tool was not called.'}
</tool_result>

<knowledge_base_article>
${match
    ? `<id>${match.article.id}</id>
<title>${match.article.title}</title>
<resolution>
${match.article.resolution}
</resolution>`
    : 'No KB article matched.'}
</knowledge_base_article>

<message>
SUBJECT: ${email.subject}
BODY:
${email.cleanBody}
</message>

<task>
Answer the customer's billing question using only the tool result and the KB article. Return a single JSON object: {"can_answer": boolean, "answer": string, "reasoning": string}. Cite the invoice number explicitly if the tool returned data. Refuse and set can_answer=false if the customer is requesting a refund, contract change, or any commitment the KB does not authorize. Sign as Eva.
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
        invoice,
        kb_article_id: match?.article.id,
        kb_title: match?.article.title,
        reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : 'Refused (action outside KB scope)',
        model: response.model,
        latencyMs: Date.now() - started,
        costUsd: response.costUsd,
      };
    }
    return {
      resolved: true,
      source: 'model',
      invoice,
      kb_article_id: match?.article.id,
      kb_title: match?.article.title,
      answer: typeof parsed.answer === 'string' ? parsed.answer : '',
      reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
      model: response.model,
      latencyMs: Date.now() - started,
      costUsd: response.costUsd,
    };
  } catch (err) {
    return {
      resolved: false,
      source: 'refused',
      invoice,
      reasoning: `LLM unavailable: ${err instanceof Error ? err.message : 'unknown'}`,
      latencyMs: Date.now() - started,
    };
  }
}
