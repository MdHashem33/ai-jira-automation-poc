export type TicketStatus = 'processing' | 'classified' | 'resolved_auto' | 'escalated_jira' | 'failed';
export type Priority = 'critical' | 'high' | 'medium' | 'low';
export type Intent = 'bug_report' | 'feature_request' | 'general_inquiry' | 'account_issue' | 'billing' | 'security_incident' | 'service_outage' | 'how_to_question';
export type Sentiment = 'positive' | 'neutral' | 'negative' | 'frustrated' | 'urgent';
export type Channel = 'email' | 'voice' | 'chatbot';

export interface EmailInput {
  id: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  htmlBody?: string;
  attachments?: AttachmentInfo[];
  receivedAt: string;
  headers?: Record<string, string>;
}

export interface AttachmentInfo {
  filename: string;
  contentType: string;
  size: number;
  content?: Buffer;
}

export interface ParsedEmail {
  id: string;
  from: string;
  fromName: string;
  to: string;
  subject: string;
  cleanBody: string;
  originalBody: string;
  language: string;
  attachments: AttachmentInfo[];
  isReply: boolean;
  threadId?: string;
  receivedAt: string;
}

export interface AIAnalysis {
  intent: Intent;
  intentConfidence: number;
  priority: Priority;
  priorityReason: string;
  sentiment: Sentiment;
  summary: string;
  extractedEntities: {
    product?: string;
    component?: string;
    version?: string;
    errorCode?: string;
    accountId?: string;
    environment?: string;
  };
  suggestedTitle: string;
  suggestedLabels: string[];
  requiresHumanReview: boolean;
  ragMatch?: RAGResult;
}

export interface RAGResult {
  found: boolean;
  articleId?: string;
  articleTitle?: string;
  relevanceScore: number;
  suggestedResponse?: string;
}

export interface JiraTicket {
  key?: string;
  projectKey: string;
  issueType: string;
  summary: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  description: any;
  priority: string;
  labels: string[];
  customFields?: Record<string, unknown>;
}

export type DispatchCategoryName =
  | 'billing'
  | 'technical'
  | 'account'
  | 'compliance'
  | 'feature_request'
  | 'how_to'
  | 'escalate';

export interface DispatcherShadowResult {
  category: DispatchCategoryName;
  confidence: number;
  reasoning: string;
  requires_human_review: boolean;
  pii_detected: boolean;
  pii_summary: string;
  source: 'model' | 'fallback';
  model?: string;
  latencyMs?: number;
}

export interface JudgeVerdictRecord {
  agrees: boolean;
  suggested_category?: DispatchCategoryName;
  faithfulness: number;
  reasoning: string;
  model?: string;
  latencyMs?: number;
}

export interface FaqSpecialistRecord {
  resolved: boolean;
  source: 'model' | 'template' | 'refused';
  kb_article_id?: string;
  kb_title?: string;
  reasoning?: string;
  model?: string;
  latencyMs?: number;
}

export interface CostAccounting {
  totalUsd: number;
  byStep: Array<{ step: string; model?: string; usd: number }>;
}

export interface ProcessedTicket {
  id: string;
  channel: Channel;
  status: TicketStatus;
  email: ParsedEmail;
  aiAnalysis?: AIAnalysis;
  dispatcherShadow?: DispatcherShadowResult;
  judgeVerdict?: JudgeVerdictRecord;
  faqSpecialist?: FaqSpecialistRecord;
  cost?: CostAccounting;
  routedBy?:
    | 'faq_specialist'
    | 'account_specialist'
    | 'billing_specialist'
    | 'legacy_decision_engine'
    | 'jira_escalation'
    | 'human_review';
  jiraTicket?: JiraTicket;
  jiraKey?: string;
  autoReplyContent?: string;
  processingSteps: ProcessingStep[];
  createdAt: string;
  updatedAt: string;
  processingTimeMs: number;
}

export interface ProcessingStep {
  step: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startedAt?: string;
  completedAt?: string;
  details?: string;
  durationMs?: number;
}

export interface DashboardStats {
  totalProcessed: number;
  autoResolved: number;
  escalatedToJira: number;
  failed: number;
  avgProcessingTimeMs: number;
  byPriority: Record<Priority, number>;
  byIntent: Record<Intent, number>;
  bySentiment: Record<Sentiment, number>;
  autoResolveRate: number;
  recentTickets: ProcessedTicket[];
  processingTimeline: { date: string; count: number; autoResolved: number }[];
  totalCostUsd: number;
  avgCostPerTicketUsd: number;
  routedBy: Record<string, number>;
}

export interface PipelineConfig {
  openaiApiKey: string;
  openaiModel: string;
  jiraBaseUrl: string;
  jiraEmail: string;
  jiraApiToken: string;
  jiraProjectKey: string;
  confidenceThreshold: number;
  autoResolveEnabled: boolean;
}
