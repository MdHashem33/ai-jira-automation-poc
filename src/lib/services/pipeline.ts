import { v4 as uuidv4 } from 'uuid';
import { EmailInput, ProcessedTicket, ProcessingStep } from '../types';
import { parseEmail } from './emailParser';
import { analyzeEmail } from './aiMiddleware';
import { buildJiraPayload, createJiraTicket, uploadAttachments } from './jiraService';
import { generateAutoReply, generateEscalationConfirmation } from './autoReply';
import { addTicket, updateTicket } from '../store';

export async function processEmail(input: EmailInput): Promise<ProcessedTicket> {
  const startTime = Date.now();
  const ticketId = input.id || uuidv4();

  const steps: ProcessingStep[] = [
    { step: 'Email Parsing', status: 'pending' },
    { step: 'AI Analysis', status: 'pending' },
    { step: 'RAG Knowledge Lookup', status: 'pending' },
    { step: 'Decision Engine', status: 'pending' },
    { step: 'Action Execution', status: 'pending' },
  ];

  const ticket: ProcessedTicket = {
    id: ticketId,
    channel: 'email',
    status: 'processing',
    email: {
      id: ticketId,
      from: input.from,
      fromName: input.from,
      to: input.to,
      subject: input.subject,
      cleanBody: input.body,
      originalBody: input.body,
      language: 'en',
      attachments: input.attachments || [],
      isReply: false,
      receivedAt: input.receivedAt || new Date().toISOString(),
    },
    processingSteps: steps,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    processingTimeMs: 0,
  };

  addTicket(ticket);

  try {
    // Step 1: Email Parsing
    updateStep(steps, 0, 'in_progress');
    updateTicket(ticketId, { processingSteps: steps });

    const parsedEmail = parseEmail(input);
    ticket.email = parsedEmail;

    updateStep(steps, 0, 'completed', `Parsed email from ${parsedEmail.fromName}, language: ${parsedEmail.language}, reply: ${parsedEmail.isReply}`);
    updateTicket(ticketId, { email: parsedEmail, processingSteps: steps });

    // Step 2: AI Analysis
    updateStep(steps, 1, 'in_progress');
    updateTicket(ticketId, { processingSteps: steps });

    const analysis = await analyzeEmail(parsedEmail);
    ticket.aiAnalysis = analysis;

    updateStep(steps, 1, 'completed', `Intent: ${analysis.intent} (${Math.round(analysis.intentConfidence * 100)}%), Priority: ${analysis.priority}, Sentiment: ${analysis.sentiment}`);
    updateTicket(ticketId, { aiAnalysis: analysis, processingSteps: steps });

    // Step 3: RAG Knowledge Lookup
    updateStep(steps, 2, 'in_progress');
    updateTicket(ticketId, { processingSteps: steps });

    const ragFound = analysis.ragMatch?.found || false;
    const ragScore = analysis.ragMatch?.relevanceScore || 0;

    updateStep(steps, 2, 'completed', ragFound
      ? `Match found: "${analysis.ragMatch?.articleTitle}" (score: ${Math.round(ragScore * 100)}%)`
      : 'No matching knowledge base article found');
    updateTicket(ticketId, { processingSteps: steps });

    // Step 4: Decision Engine
    updateStep(steps, 3, 'in_progress');
    updateTicket(ticketId, { processingSteps: steps });

    const autoReply = generateAutoReply(parsedEmail, analysis);
    const shouldAutoResolve = autoReply !== null;

    updateStep(steps, 3, 'completed', shouldAutoResolve
      ? 'Decision: Auto-resolve with KB article'
      : 'Decision: Escalate to Jira');
    updateTicket(ticketId, { processingSteps: steps });

    // Step 5: Action Execution
    updateStep(steps, 4, 'in_progress');
    updateTicket(ticketId, { processingSteps: steps });

    if (shouldAutoResolve) {
      ticket.status = 'resolved_auto';
      ticket.autoReplyContent = autoReply;
      updateStep(steps, 4, 'completed', 'Auto-reply generated and sent to customer');
    } else {
      const jiraPayload = buildJiraPayload(parsedEmail, analysis);
      ticket.jiraTicket = jiraPayload;

      const jiraResult = await createJiraTicket(jiraPayload);

      if (jiraResult.success && jiraResult.key) {
        ticket.status = 'escalated_jira';
        ticket.jiraKey = jiraResult.key;

        // Upload attachments if present
        const attachmentsWithContent = parsedEmail.attachments.filter(a => a.content);
        if (attachmentsWithContent.length > 0) {
          const attachResult = await uploadAttachments(jiraResult.key, attachmentsWithContent);
          console.log(`[Pipeline] Attachments: ${attachResult.uploaded} uploaded, ${attachResult.failed} failed`);
        }

        ticket.autoReplyContent = generateEscalationConfirmation(parsedEmail, jiraResult.key);
        updateStep(steps, 4, 'completed', `Jira ticket created: ${jiraResult.key}${attachmentsWithContent.length > 0 ? ` (${attachmentsWithContent.length} attachment(s))` : ''}`);
      } else {
        ticket.status = 'failed';
        updateStep(steps, 4, 'failed', `Jira creation failed: ${jiraResult.error}`);
      }
    }

    ticket.processingTimeMs = Date.now() - startTime;
    ticket.processingSteps = steps;

    updateTicket(ticketId, {
      status: ticket.status,
      jiraTicket: ticket.jiraTicket,
      jiraKey: ticket.jiraKey,
      autoReplyContent: ticket.autoReplyContent,
      processingSteps: steps,
      processingTimeMs: ticket.processingTimeMs,
    });

    console.log(`[Pipeline] Email processed: ${ticketId} → ${ticket.status} (${ticket.processingTimeMs}ms)`);
    return ticket;

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Pipeline] Processing failed for ${ticketId}:`, message);

    ticket.status = 'failed';
    ticket.processingTimeMs = Date.now() - startTime;

    const currentStep = steps.findIndex(s => s.status === 'in_progress');
    if (currentStep !== -1) {
      updateStep(steps, currentStep, 'failed', message);
    }

    updateTicket(ticketId, {
      status: 'failed',
      processingSteps: steps,
      processingTimeMs: ticket.processingTimeMs,
    });

    return ticket;
  }
}

function updateStep(steps: ProcessingStep[], index: number, status: ProcessingStep['status'], details?: string) {
  const now = new Date().toISOString();
  if (status === 'in_progress') {
    steps[index].status = 'in_progress';
    steps[index].startedAt = now;
  } else {
    steps[index].status = status;
    steps[index].completedAt = now;
    steps[index].details = details;
    if (steps[index].startedAt) {
      steps[index].durationMs = new Date(now).getTime() - new Date(steps[index].startedAt!).getTime();
    }
  }
}
