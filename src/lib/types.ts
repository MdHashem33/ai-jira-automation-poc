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

export interface ProcessedTicket {
  id: string;
  channel: Channel;
  status: TicketStatus;
  email: ParsedEmail;
  aiAnalysis?: AIAnalysis;
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
