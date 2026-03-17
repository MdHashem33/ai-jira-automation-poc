import { ParsedEmail, AIAnalysis } from '../types';

export function generateAutoReply(email: ParsedEmail, analysis: AIAnalysis): string | null {
  console.log('[AutoReply] Checking auto-resolve:', {
    ragFound: analysis.ragMatch?.found,
    ragScore: analysis.ragMatch?.relevanceScore,
    intent: analysis.intent,
    confidence: analysis.intentConfidence,
    priority: analysis.priority,
    sentiment: analysis.sentiment,
  });

  if (!analysis.ragMatch?.found || !analysis.ragMatch.suggestedResponse) {
    console.log('[AutoReply] Rejected: no RAG match or no suggested response');
    return null;
  }

  if (analysis.ragMatch.relevanceScore < 0.2) {
    console.log('[AutoReply] Rejected: RAG score too low:', analysis.ragMatch.relevanceScore);
    return null;
  }

  const autoResolveEnabled = process.env.AUTO_RESOLVE_ENABLED !== 'false';
  if (!autoResolveEnabled) return null;

  const confidenceThreshold = parseFloat(process.env.CONFIDENCE_THRESHOLD || '0.7');
  if (analysis.intentConfidence < confidenceThreshold) return null;

  // Never auto-resolve if human review is required
  if (analysis.requiresHumanReview) return null;

  // These intents always require human review — never auto-resolve
  if (['security_incident', 'service_outage', 'billing', 'feature_request'].includes(analysis.intent)) return null;
  if (['frustrated', 'urgent'].includes(analysis.sentiment) && analysis.priority !== 'low') return null;
  if (analysis.priority === 'critical' || analysis.priority === 'high') return null;

  return formatAutoReplyEmail(email, analysis);
}

function formatAutoReplyEmail(email: ParsedEmail, analysis: AIAnalysis): string {
  const greeting = email.fromName ? `Hi ${email.fromName.split(' ')[0]}` : 'Hello';
  const resolution = analysis.ragMatch!.suggestedResponse!;
  const articleTitle = analysis.ragMatch!.articleTitle || 'our knowledge base';

  return `${greeting},

Thank you for reaching out to us regarding "${email.subject}".

Based on your inquiry, I found relevant information from our knowledge base that may help resolve your question:

---

**${articleTitle}**

${resolution}

---

If this resolves your issue, no further action is needed. If you need additional assistance or this doesn't fully address your concern, simply reply to this email and a support engineer will follow up with you personally.

Best regards,
AI Support Assistant
---
*This is an automated response powered by our AI support system. Reference: ${analysis.ragMatch!.articleId}*
*Your request was classified as: ${analysis.intent.replace(/_/g, ' ')} | Confidence: ${Math.round(analysis.intentConfidence * 100)}%*`;
}

export function generateEscalationConfirmation(email: ParsedEmail, jiraKey: string): string {
  const greeting = email.fromName ? `Hi ${email.fromName.split(' ')[0]}` : 'Hello';

  return `${greeting},

Thank you for contacting us regarding "${email.subject}".

We've created a support ticket for your request and our team is on it. Here are your ticket details:

**Ticket Reference:** ${jiraKey}
**Status:** Open - Assigned to Support Team

You can expect an update within 1 business day. If this is urgent, please reference ticket ${jiraKey} in any follow-up communications.

Best regards,
Support Team
---
*This is an automated confirmation. Your request is being handled by our support engineers.*`;
}
