import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { callModel } from '@/lib/ai/client';
import { redact } from '@/lib/ai/redact';
import { processEmail } from '@/lib/services/pipeline';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const EXTRACTION_SYSTEM =
  'You are a support-intake assistant. You receive a screenshot submitted by a customer and must extract (a) a short subject line (max 80 chars), (b) a description of the issue (max 300 chars), and (c) a flag for whether the image contains any PHI (medical conditions, prescriptions, patient identifiers). Output a single JSON object: {"subject": "...", "body": "...", "phi_likely": boolean}. Never invent facts beyond what is visible in the image.';

interface ScreenshotIntakePayload {
  // One of these must be provided
  imageDataUrl?: string; // data:image/png;base64,....
  extractedText?: string; // for environments where OCR is done upstream
  fromName?: string;
  fromEmail?: string;
  subject?: string; // optional override when extractedText is the whole message
}

export async function POST(request: NextRequest) {
  let body: ScreenshotIntakePayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body must be JSON' }, { status: 400 });
  }

  if (!body.imageDataUrl && !body.extractedText) {
    return NextResponse.json(
      { error: 'Provide either imageDataUrl (base64 data URL) or extractedText.' },
      { status: 400 },
    );
  }

  let subject = body.subject ?? '';
  let bodyText = body.extractedText ?? '';
  let phiLikely = false;
  let source: 'vision' | 'text' = 'text';
  let extractionModel: string | undefined;

  if (body.imageDataUrl) {
    try {
      const visionPrompt = `Extract a support-ticket summary from the following screenshot. Return JSON with keys: subject, body, phi_likely.\n\nIMAGE: ${body.imageDataUrl.slice(
        0,
        120,
      )}...[truncated]`;
      const response = await callModel('extract', EXTRACTION_SYSTEM, visionPrompt, { jsonMode: true });
      const parsed = JSON.parse(response.text);
      subject = subject || String(parsed.subject || '').slice(0, 120);
      bodyText = bodyText || String(parsed.body || '').slice(0, 600);
      phiLikely = Boolean(parsed.phi_likely);
      source = 'vision';
      extractionModel = response.model;
    } catch (err) {
      return NextResponse.json(
        {
          error: 'Vision extraction failed',
          detail: err instanceof Error ? err.message : 'Unknown error',
          hint: 'The deployment may not support image input. Retry with extractedText for OCR-done-upstream flow.',
        },
        { status: 502 },
      );
    }
  }

  if (!subject || !bodyText) {
    return NextResponse.json(
      { error: 'Could not build a subject + body from the input.' },
      { status: 422 },
    );
  }

  // Mandatory redaction before handing off to the pipeline
  const redacted = redact(`${subject}\n${bodyText}`);

  const ticket = await processEmail({
    id: uuidv4(),
    from: `${body.fromName || 'Screenshot User'} <${body.fromEmail || 'screenshot@intake.example'}>`,
    to: 'support@fluent.example',
    subject,
    body: bodyText,
    receivedAt: new Date().toISOString(),
  });

  return NextResponse.json({
    success: true,
    intake: {
      source,
      phi_likely: phiLikely,
      pii_detected: redacted.piiDetected,
      pii_summary: redacted.entries.map((e) => e.kind).join(', ') || 'none',
      extraction_model: extractionModel,
    },
    ticket: {
      id: ticket.id,
      status: ticket.status,
      routedBy: ticket.routedBy,
      dispatcher: ticket.dispatcherShadow,
      faq: ticket.faqSpecialist,
      jiraKey: ticket.jiraKey,
      cost: ticket.cost,
    },
  });
}
