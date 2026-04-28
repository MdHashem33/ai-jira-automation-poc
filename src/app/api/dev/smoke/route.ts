import { NextResponse } from 'next/server';
import { sampleEmails } from '@/lib/sampleEmails';
import { parseEmail } from '@/lib/services/emailParser';
import { redact, summarizePii } from '@/lib/ai/redact';
import { dispatch } from '@/lib/agents/dispatcher';
import { isConfigured } from '@/lib/ai/client';

export const dynamic = 'force-dynamic';

export async function GET() {
  const configured = isConfigured();
  const started = Date.now();

  const results = await Promise.all(
    sampleEmails.map(async (input) => {
      const parsed = parseEmail(input);
      const redacted = redact(`${parsed.subject}\n${parsed.cleanBody}`);
      const dispatchResult = await dispatch(parsed);

      return {
        id: input.id,
        subject: input.subject,
        from: parsed.fromName,
        redact: {
          pii_detected: redacted.piiDetected,
          pii_summary: summarizePii(redacted.entries),
          tokens_replaced: redacted.entries.length,
          preview: redacted.cleansed.slice(0, 200),
        },
        dispatcher: {
          category: dispatchResult.category,
          confidence: Math.round(dispatchResult.confidence * 100) / 100,
          reasoning: dispatchResult.reasoning,
          requires_human_review: dispatchResult.requires_human_review,
          source: dispatchResult.source,
          model: dispatchResult.model,
          latencyMs: dispatchResult.latencyMs,
        },
      };
    })
  );

  return NextResponse.json({
    environment: {
      openai_configured: configured.openai,
      anthropic_configured: configured.anthropic,
      provider: process.env.AI_PROVIDER || 'openai',
    },
    total_samples: sampleEmails.length,
    total_latency_ms: Date.now() - started,
    results,
  });
}
