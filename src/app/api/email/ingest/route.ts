import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { EmailInput } from '@/lib/types';
import { processEmail } from '@/lib/services/pipeline';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const emailInput: EmailInput = {
      id: body.id || uuidv4(),
      from: body.from,
      to: body.to || 'support@company.com',
      subject: body.subject,
      body: body.body,
      htmlBody: body.htmlBody,
      attachments: body.attachments || [],
      receivedAt: body.receivedAt || new Date().toISOString(),
      headers: body.headers,
    };

    if (!emailInput.from || !emailInput.subject || !emailInput.body) {
      return NextResponse.json(
        { error: 'Missing required fields: from, subject, body' },
        { status: 400 }
      );
    }

    const result = await processEmail(emailInput);

    return NextResponse.json({
      success: true,
      ticket: result,
    });
  } catch (error) {
    console.error('[API] Email ingest error:', error);
    return NextResponse.json(
      { error: 'Failed to process email', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
