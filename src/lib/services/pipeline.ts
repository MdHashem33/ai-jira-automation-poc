import { v4 as uuidv4 } from 'uuid';
import { EmailInput, ProcessedTicket, ProcessingStep, CostAccounting } from '../types';
import { parseEmail } from './emailParser';
import { analyzeEmail } from './aiMiddleware';
import { buildJiraPayload, createJiraTicket, uploadAttachments } from './jiraService';
import { generateAutoReply, generateEscalationConfirmation } from './autoReply';
import { addTicket, updateTicket } from '../store';
import { dispatch } from '../agents/dispatcher';
import { verifyDispatch } from '../agents/judge';
import { attemptFaqResolution } from '../agents/faqSpecialist';
import { attemptAccountResolution } from '../agents/accountSpecialist';
import { attemptBillingResolution } from '../agents/billingSpecialist';
import { appendResolution } from './kbStore';
import { lookup as semanticCacheLookup, record as semanticCacheRecord, isSemanticCacheConfigured } from './semanticCache';

function addCost(cost: CostAccounting, step: string, model: string | undefined, usd: number | undefined) {
  if (!usd) return;
  cost.totalUsd = Math.round((cost.totalUsd + usd) * 1_000_000) / 1_000_000;
  cost.byStep.push({ step, model, usd });
}

export async function processEmail(input: EmailInput): Promise<ProcessedTicket> {
  const startTime = Date.now();
  const ticketId = input.id || uuidv4();

  const steps: ProcessingStep[] = [
    { step: 'Email Parsing', status: 'pending' },
    { step: 'Semantic Cache', status: 'pending' },
    { step: 'Dispatcher', status: 'pending' },
    { step: 'Judge (verify)', status: 'pending' },
    { step: 'FAQ Specialist', status: 'pending' },
    { step: 'AI Analysis (legacy)', status: 'pending' },
    { step: 'RAG Knowledge Lookup', status: 'pending' },
    { step: 'Decision Engine', status: 'pending' },
    { step: 'Action Execution', status: 'pending' },
  ];

  const cost: CostAccounting = { totalUsd: 0, byStep: [] };

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
    cost,
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

    // Step 2: Semantic Cache — cosine match against prior resolutions; serve at ~$0 on hit.
    updateStep(steps, 1, 'in_progress');
    updateTicket(ticketId, { processingSteps: steps });

    const cacheQuery = `${parsedEmail.subject}\n${parsedEmail.cleanBody}`;
    const cacheHit = isSemanticCacheConfigured() ? await semanticCacheLookup(cacheQuery) : null;

    if (cacheHit) {
      const similarityPct = Math.round(cacheHit.similarity * 100);
      updateStep(
        steps,
        1,
        'completed',
        `HIT (similarity ${similarityPct}%, citing ticket ${cacheHit.record.citationTicketId}, served at $0)`,
      );
      // Mark every downstream step skipped — full short-circuit.
      for (let i = 2; i < steps.length; i++) updateStep(steps, i, 'completed', 'Skipped (semantic cache hit)');

      ticket.status = 'resolved_auto';
      ticket.autoReplyContent = cacheHit.record.resolution;
      ticket.routedBy = 'faq_specialist';
      ticket.processingTimeMs = Date.now() - startTime;
      ticket.processingSteps = steps;
      ticket.cost = cost;

      appendResolution({
        ticketId,
        category: cacheHit.record.category ?? 'how_to',
        patternSummary: parsedEmail.subject.slice(0, 140),
        resolutionSteps: `semantic-cache hit (sim=${cacheHit.similarity.toFixed(3)}, source=${cacheHit.record.source}, citing=${cacheHit.record.citationTicketId})`,
        outcome: 'resolved_auto',
      });

      updateTicket(ticketId, {
        status: ticket.status,
        autoReplyContent: ticket.autoReplyContent,
        routedBy: ticket.routedBy,
        processingSteps: steps,
        processingTimeMs: ticket.processingTimeMs,
        cost,
      });
      console.log(`[Pipeline] ${ticketId} resolved via semantic-cache (sim=${similarityPct}%, $0.000000)`);
      return ticket;
    }

    updateStep(
      steps,
      1,
      'completed',
      isSemanticCacheConfigured() ? 'MISS (no prior resolution above threshold)' : 'Skipped (embeddings not configured)',
    );
    updateTicket(ticketId, { processingSteps: steps });

    // Step 3: Dispatcher (live routing)
    updateStep(steps, 2, 'in_progress');
    updateTicket(ticketId, { processingSteps: steps });

    const dispatchResult = await dispatch(parsedEmail);
    addCost(cost, 'dispatcher', dispatchResult.model, dispatchResult.costUsd);
    ticket.dispatcherShadow = {
      category: dispatchResult.category,
      confidence: dispatchResult.confidence,
      reasoning: dispatchResult.reasoning,
      requires_human_review: dispatchResult.requires_human_review,
      pii_detected: dispatchResult.pii_detected,
      pii_summary: dispatchResult.pii_summary,
      source: dispatchResult.source,
      model: dispatchResult.model,
      latencyMs: dispatchResult.latencyMs,
    };
    updateStep(
      steps,
      2,
      'completed',
      `${dispatchResult.category} (${Math.round(dispatchResult.confidence * 100)}%, ${dispatchResult.source}), human-review: ${dispatchResult.requires_human_review}, PII: ${dispatchResult.pii_summary}`,
    );
    updateTicket(ticketId, { dispatcherShadow: ticket.dispatcherShadow, processingSteps: steps });

    // Step 4: Judge — verify dispatcher decision
    updateStep(steps, 3, 'in_progress');
    updateTicket(ticketId, { processingSteps: steps });
    let judgeVerdict;
    try {
      judgeVerdict = await verifyDispatch(parsedEmail, dispatchResult);
      addCost(cost, 'judge', judgeVerdict.model, judgeVerdict.costUsd);
      ticket.judgeVerdict = judgeVerdict;
      updateStep(
        steps,
        3,
        'completed',
        `agrees=${judgeVerdict.agrees}, faithfulness=${judgeVerdict.faithfulness.toFixed(2)}${judgeVerdict.suggested_category ? `, suggested=${judgeVerdict.suggested_category}` : ''}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      updateStep(steps, 3, 'completed', `Judge skipped: ${message} (non-blocking)`);
    }
    updateTicket(ticketId, { judgeVerdict: ticket.judgeVerdict, processingSteps: steps });

    // Step 5: Specialist routing — pick a specialist based on dispatcher category
    const specialistEligible =
      dispatchResult.confidence >= 0.75 &&
      !dispatchResult.requires_human_review &&
      (judgeVerdict?.agrees ?? true) &&
      (judgeVerdict?.faithfulness ?? 1) >= 0.70;

    let specialistAnswer: string | null = null;
    let specialistName: ProcessedTicket['routedBy'] | null = null;
    let specialistKbId: string | undefined;
    let specialistSourceTag: string = 'specialist';

    if (!specialistEligible) {
      updateStep(steps, 4, 'completed', `Skipped (category=${dispatchResult.category}, human_review=${dispatchResult.requires_human_review})`);
    } else if (dispatchResult.category === 'how_to') {
      updateStep(steps, 4, 'in_progress');
      updateTicket(ticketId, { processingSteps: steps });
      const faq = await attemptFaqResolution(parsedEmail);
      addCost(cost, 'faq_specialist', faq.model, faq.costUsd);
      ticket.faqSpecialist = {
        resolved: faq.resolved,
        source: faq.source,
        kb_article_id: faq.kb_article_id,
        kb_title: faq.kb_title,
        reasoning: faq.reasoning,
        model: faq.model,
        latencyMs: faq.latencyMs,
      };
      updateStep(steps, 4, 'completed', faq.resolved ? `FAQ specialist resolved via KB ${faq.kb_article_id}` : `FAQ specialist refused: ${faq.reasoning ?? ''}`);
      if (faq.resolved && faq.answer) {
        specialistAnswer = faq.answer;
        specialistName = 'faq_specialist';
        specialistKbId = faq.kb_article_id;
        specialistSourceTag = `faq_specialist:${faq.source}`;
      }
    } else if (dispatchResult.category === 'account') {
      updateStep(steps, 4, 'in_progress');
      updateTicket(ticketId, { processingSteps: steps });
      const account = await attemptAccountResolution(parsedEmail);
      addCost(cost, 'account_specialist', account.model, account.costUsd);
      updateStep(steps, 4, 'completed', account.resolved ? `Account specialist resolved (${account.sub_intent}) via KB ${account.kb_article_id}` : `Account specialist refused: ${account.reasoning ?? ''}`);
      if (account.resolved && account.answer) {
        specialistAnswer = account.answer;
        specialistName = 'account_specialist' as ProcessedTicket['routedBy'];
        specialistKbId = account.kb_article_id;
        specialistSourceTag = `account_specialist:${account.source}`;
      }
    } else if (dispatchResult.category === 'billing') {
      updateStep(steps, 4, 'in_progress');
      updateTicket(ticketId, { processingSteps: steps });
      const billing = await attemptBillingResolution(parsedEmail);
      addCost(cost, 'billing_specialist', billing.model, billing.costUsd);
      updateStep(
        steps,
        4,
        'completed',
        billing.resolved
          ? `Billing specialist resolved${billing.invoice ? ` (invoice ${billing.invoice.invoice_number}, ${billing.invoice.status})` : ''}`
          : `Billing specialist refused: ${billing.reasoning ?? ''}`,
      );
      if (billing.resolved && billing.answer) {
        specialistAnswer = billing.answer;
        specialistName = 'billing_specialist' as ProcessedTicket['routedBy'];
        specialistKbId = billing.kb_article_id;
        specialistSourceTag = `billing_specialist:${billing.source}`;
      }
    } else {
      updateStep(steps, 4, 'completed', `No specialist for category ${dispatchResult.category}; falling back to legacy`);
    }

    if (specialistAnswer && specialistName) {
      // Short-circuit legacy pipeline — specialist resolved end-to-end
      updateStep(steps, 5, 'completed', 'Skipped (specialist resolved)');
      updateStep(steps, 6, 'completed', 'Skipped (specialist resolved)');
      updateStep(steps, 7, 'completed', `Decision: Auto-resolve via ${specialistName}`);
      updateStep(steps, 8, 'completed', `Auto-reply drafted by ${specialistName}`);
      ticket.status = 'resolved_auto';
      ticket.autoReplyContent = specialistAnswer;
      ticket.routedBy = specialistName;
      ticket.processingTimeMs = Date.now() - startTime;
      ticket.processingSteps = steps;

      appendResolution({
        ticketId,
        category: dispatchResult.category,
        patternSummary: parsedEmail.subject.slice(0, 140),
        resolutionSteps: `${specialistKbId ?? 'unknown-kb'} applied by ${specialistName}`,
        outcome: 'resolved_auto',
      });

      // Persist the resolution into the semantic cache so future near-duplicates
      // can be served at $0. Honors SEMANTIC_CACHE_DISABLED for opt-out.
      if (isSemanticCacheConfigured()) {
        await semanticCacheRecord({
          query: cacheQuery,
          resolution: specialistAnswer,
          source: specialistSourceTag,
          citationTicketId: ticketId,
          category: dispatchResult.category,
          kbArticleId: specialistKbId,
        }).catch((err) => console.warn('[pipeline] semantic-cache record failed:', err));
      }

      ticket.cost = cost;
      updateTicket(ticketId, {
        status: ticket.status,
        autoReplyContent: ticket.autoReplyContent,
        faqSpecialist: ticket.faqSpecialist,
        routedBy: ticket.routedBy,
        processingSteps: steps,
        processingTimeMs: ticket.processingTimeMs,
        cost,
      });
      console.log(`[Pipeline] ${ticketId} auto-resolved via ${specialistName} ($${cost.totalUsd.toFixed(6)})`);
      return ticket;
    }
    updateTicket(ticketId, { faqSpecialist: ticket.faqSpecialist, processingSteps: steps });

    // Step 6: AI Analysis (legacy path — fallback for everything the FAQ specialist did not handle)
    updateStep(steps, 5, 'in_progress');
    updateTicket(ticketId, { processingSteps: steps });

    const analysis = await analyzeEmail(parsedEmail);
    ticket.aiAnalysis = analysis;

    updateStep(steps, 5, 'completed', `Intent: ${analysis.intent} (${Math.round(analysis.intentConfidence * 100)}%), Priority: ${analysis.priority}, Sentiment: ${analysis.sentiment}`);
    updateTicket(ticketId, { aiAnalysis: analysis, processingSteps: steps });

    // Step 7: RAG Knowledge Lookup
    updateStep(steps, 6, 'in_progress');
    updateTicket(ticketId, { processingSteps: steps });

    const ragFound = analysis.ragMatch?.found || false;
    const ragScore = analysis.ragMatch?.relevanceScore || 0;

    updateStep(steps, 6, 'completed', ragFound
      ? `Match found: "${analysis.ragMatch?.articleTitle}" (score: ${Math.round(ragScore * 100)}%)`
      : 'No matching knowledge base article found');
    updateTicket(ticketId, { processingSteps: steps });

    // Step 8: Decision Engine
    updateStep(steps, 7, 'in_progress');
    updateTicket(ticketId, { processingSteps: steps });

    const autoReply = generateAutoReply(parsedEmail, analysis);
    const shouldAutoResolve = autoReply !== null;

    updateStep(steps, 7, 'completed', shouldAutoResolve
      ? 'Decision: Auto-resolve with legacy KB match'
      : 'Decision: Escalate to Jira');
    updateTicket(ticketId, { processingSteps: steps });

    // Step 9: Action Execution
    updateStep(steps, 8, 'in_progress');
    updateTicket(ticketId, { processingSteps: steps });

    if (shouldAutoResolve) {
      ticket.status = 'resolved_auto';
      ticket.autoReplyContent = autoReply;
      ticket.routedBy = 'legacy_decision_engine';
      updateStep(steps, 8, 'completed', 'Auto-reply generated via legacy decision engine');
      appendResolution({
        ticketId,
        category: dispatchResult.category,
        patternSummary: parsedEmail.subject.slice(0, 140),
        resolutionSteps: 'legacy-decision-engine auto-reply',
        outcome: 'resolved_auto',
      });
      if (isSemanticCacheConfigured() && autoReply) {
        await semanticCacheRecord({
          query: cacheQuery,
          resolution: autoReply,
          source: 'legacy_decision_engine',
          citationTicketId: ticketId,
          category: dispatchResult.category,
        }).catch((err) => console.warn('[pipeline] semantic-cache record failed:', err));
      }
    } else {
      const jiraPayload = buildJiraPayload(parsedEmail, analysis);
      ticket.jiraTicket = jiraPayload;

      const jiraResult = await createJiraTicket(jiraPayload);

      if (jiraResult.success && jiraResult.key) {
        ticket.status = 'escalated_jira';
        ticket.jiraKey = jiraResult.key;
        ticket.routedBy = 'jira_escalation';

        const attachmentsWithContent = parsedEmail.attachments.filter(a => a.content);
        if (attachmentsWithContent.length > 0) {
          const attachResult = await uploadAttachments(jiraResult.key, attachmentsWithContent);
          console.log(`[Pipeline] Attachments: ${attachResult.uploaded} uploaded, ${attachResult.failed} failed`);
        }

        ticket.autoReplyContent = generateEscalationConfirmation(parsedEmail, jiraResult.key);
        updateStep(steps, 8, 'completed', `Jira ticket created: ${jiraResult.key}${attachmentsWithContent.length > 0 ? ` (${attachmentsWithContent.length} attachment(s))` : ''}`);
        appendResolution({
          ticketId,
          category: dispatchResult.category,
          patternSummary: parsedEmail.subject.slice(0, 140),
          resolutionSteps: `escalated to ${jiraResult.key}`,
          outcome: 'escalated_jira',
        });
      } else {
        ticket.status = 'failed';
        updateStep(steps, 8, 'failed', `Jira creation failed: ${jiraResult.error}`);
      }
    }

    ticket.processingTimeMs = Date.now() - startTime;
    ticket.processingSteps = steps;
    ticket.cost = cost;

    updateTicket(ticketId, {
      status: ticket.status,
      jiraTicket: ticket.jiraTicket,
      jiraKey: ticket.jiraKey,
      autoReplyContent: ticket.autoReplyContent,
      routedBy: ticket.routedBy,
      processingSteps: steps,
      processingTimeMs: ticket.processingTimeMs,
      cost,
    });

    console.log(`[Pipeline] Email processed: ${ticketId} → ${ticket.status} via ${ticket.routedBy} (${ticket.processingTimeMs}ms, $${cost.totalUsd.toFixed(6)})`);
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
