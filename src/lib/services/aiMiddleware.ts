import OpenAI from 'openai';
import { ParsedEmail, AIAnalysis, Intent, Priority, Sentiment } from '../types';
import { searchKnowledgeBase } from '../knowledgeBase';

let openaiClient: OpenAI | null = null;

function getClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || '',
    });
  }
  return openaiClient;
}

const SYSTEM_PROMPT = `You are an AI support ticket classifier for an enterprise software company. Analyze the incoming support email and return a structured JSON response.

You MUST respond with ONLY valid JSON matching this exact schema:
{
  "intent": "bug_report" | "feature_request" | "general_inquiry" | "account_issue" | "billing" | "security_incident" | "service_outage" | "how_to_question",
  "intentConfidence": 0.0-1.0,
  "priority": "critical" | "high" | "medium" | "low",
  "priorityReason": "Brief explanation of priority assignment",
  "sentiment": "positive" | "neutral" | "negative" | "frustrated" | "urgent",
  "summary": "2-3 sentence summary of the issue",
  "extractedEntities": {
    "product": "product name if mentioned",
    "component": "specific component/feature if mentioned",
    "version": "version number if mentioned",
    "errorCode": "error code if mentioned",
    "accountId": "account/customer ID if mentioned",
    "environment": "production/staging/dev if mentioned"
  },
  "suggestedTitle": "Concise Jira ticket title",
  "suggestedLabels": ["label1", "label2"],
  "requiresHumanReview": true/false
}

Priority guidelines:
- critical: Production down, security breach, data loss, or service outage affecting multiple users
- high: Major functionality broken, significant business impact, angry/frustrated customer
- medium: Standard bug reports, feature requests with business justification
- low: General inquiries, how-to questions, minor cosmetic issues

Set requiresHumanReview to true when:
- Intent confidence is below 0.7
- The email is ambiguous or contains multiple unrelated issues
- There's a potential security or legal concern
- The customer seems extremely frustrated or threatens escalation`;

export async function analyzeEmail(email: ParsedEmail): Promise<AIAnalysis> {
  const ragResult = searchKnowledgeBase(`${email.subject} ${email.cleanBody}`);

  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'sk-your-openai-api-key-here') {
    return generateFallbackAnalysis(email, ragResult);
  }

  try {
    const client = getClient();
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    const userMessage = `Analyze this support email:

FROM: ${email.fromName} <${email.from}>
SUBJECT: ${email.subject}
LANGUAGE: ${email.language}
IS REPLY: ${email.isReply}
ATTACHMENTS: ${email.attachments.length > 0 ? email.attachments.map(a => a.filename).join(', ') : 'None'}

BODY:
${email.cleanBody}`;

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.1,
      max_tokens: 1000,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('Empty AI response');

    const parsed = JSON.parse(content);

    return {
      intent: parsed.intent as Intent,
      intentConfidence: parsed.intentConfidence,
      priority: parsed.priority as Priority,
      priorityReason: parsed.priorityReason,
      sentiment: parsed.sentiment as Sentiment,
      summary: parsed.summary,
      extractedEntities: parsed.extractedEntities || {},
      suggestedTitle: parsed.suggestedTitle,
      suggestedLabels: parsed.suggestedLabels || [],
      requiresHumanReview: parsed.requiresHumanReview,
      ragMatch: ragResult ? {
        found: true,
        articleId: ragResult.article.id,
        articleTitle: ragResult.article.title,
        relevanceScore: ragResult.score,
        suggestedResponse: ragResult.article.resolution,
      } : { found: false, relevanceScore: 0 },
    };
  } catch (error) {
    console.error('AI analysis failed, using fallback:', error);
    return generateFallbackAnalysis(email, ragResult);
  }
}

function generateFallbackAnalysis(
  email: ParsedEmail,
  ragResult: ReturnType<typeof searchKnowledgeBase>
): AIAnalysis {
  const text = `${email.subject} ${email.cleanBody}`.toLowerCase();

  let intent: Intent = 'general_inquiry';
  let intentConfidence = 0.6;

  // Order matters: check specific/high-signal intents before generic ones
  if (/security|breach|unauthorized|hack|vulnerability|exploit/i.test(text)) {
    intent = 'security_incident';
    intentConfidence = 0.85;
  } else if (/down|outage|unavailable|503|502|timeout|cannot reach|service is down/i.test(text)) {
    intent = 'service_outage';
    intentConfidence = 0.83;
  } else if (/500 error|api.*(error|fail)|error.*(api|endpoint|request)|production.*(issue|error|fail)/i.test(text)) {
    intent = 'bug_report';
    intentConfidence = 0.84;
  } else if (/\b(bill|invoice|charged?|refund|subscription|pricing)\b/i.test(text) && !/\b(api|error|bug|crash|500)\b/i.test(text)) {
    intent = 'billing';
    intentConfidence = 0.82;
  } else if (/gdpr|data deletion|right to erasure|data request|personal data|right to be forgotten|data protection/i.test(text)) {
    intent = 'account_issue';
    intentConfidence = 0.85;
  } else if (/change .*(email|password|username|login|credentials)|update .*(email|account|profile)|reset .*(password|credentials)|forgot .*(password|login)|locked out|can'?t (log|sign) ?in/i.test(text)) {
    intent = 'account_issue';
    intentConfidence = 0.8;
  } else if (/how to|how do|guide|tutorial|help me|documentation/i.test(text)) {
    intent = 'how_to_question';
    intentConfidence = 0.78;
  } else if (/login|password|access|sign in|cannot log/i.test(text)) {
    intent = 'account_issue';
    intentConfidence = 0.75;
  } else if (/rate limit|429|throttl|too many requests|quota/i.test(text)) {
    intent = 'bug_report';
    intentConfidence = 0.8;
  } else if (/bug|error|crash|broken|not working|doesn't work|fail|500|exception/i.test(text)) {
    intent = 'bug_report';
    intentConfidence = 0.78;
  } else if (/feature|would be nice|suggestion|enhance|improve|add support|capability/i.test(text)) {
    intent = 'feature_request';
    intentConfidence = 0.75;
  }

  let priority: Priority = 'medium';
  let priorityReason = 'Standard support request';

  if (/urgent|critical|emergency|production down|asap|immediately/i.test(text)) {
    priority = 'critical';
    priorityReason = 'Urgency indicators detected in email content';
  } else if (/important|high priority|business impact|blocking|cannot work/i.test(text)) {
    priority = 'high';
    priorityReason = 'High business impact indicated';
  } else if (/when you get a chance|low priority|minor|cosmetic|nice to have/i.test(text)) {
    priority = 'low';
    priorityReason = 'Low urgency language detected';
  }

  if (intent === 'security_incident' || intent === 'service_outage') {
    priority = 'critical';
    priorityReason = `${intent === 'security_incident' ? 'Security incidents' : 'Service outages'} are auto-escalated to critical priority`;
  }

  let sentiment: Sentiment = 'neutral';
  if (/frustrated|angry|unacceptable|terrible|worst|disappointed|furious/i.test(text)) {
    sentiment = 'frustrated';
  } else if (/urgent|asap|immediately|critical|emergency/i.test(text)) {
    sentiment = 'urgent';
  } else if (/hate|awful|horrible|ridiculous|useless/i.test(text)) {
    sentiment = 'negative';
  } else if (/thank|appreciate|great|love|excellent|happy/i.test(text)) {
    sentiment = 'positive';
  }

  const entities: AIAnalysis['extractedEntities'] = {};
  const versionMatch = text.match(/v?(\d+\.\d+(?:\.\d+)?)/);
  if (versionMatch) entities.version = versionMatch[1];
  const errorMatch = text.match(/error\s*(?:code)?\s*[:#]?\s*([A-Z0-9_-]+)/i);
  if (errorMatch) entities.errorCode = errorMatch[1];

  const summary = `${email.fromName} reported a ${intent.replace(/_/g, ' ')} regarding: "${email.subject}". ${priorityReason}.`;

  const requiresHumanReview = intentConfidence < 0.7 ||
    /gdpr|data deletion|right to erasure|data protection|legal|compliance/i.test(text);

  return {
    intent,
    intentConfidence,
    priority,
    priorityReason,
    sentiment,
    summary,
    extractedEntities: entities,
    suggestedTitle: `[${intent.replace(/_/g, ' ').toUpperCase()}] ${email.subject}`,
    suggestedLabels: [intent, `priority-${priority}`, `sentiment-${sentiment}`, 'email-channel'],
    requiresHumanReview,
    ragMatch: ragResult ? {
      found: true,
      articleId: ragResult.article.id,
      articleTitle: ragResult.article.title,
      relevanceScore: ragResult.score,
      suggestedResponse: ragResult.article.resolution,
    } : { found: false, relevanceScore: 0 },
  };
}
