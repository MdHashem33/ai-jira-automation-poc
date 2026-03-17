import { AIAnalysis, AttachmentInfo, ParsedEmail, JiraTicket } from '../types';

interface JiraCreateResponse {
  id: string;
  key: string;
  self: string;
}

export function buildJiraPayload(email: ParsedEmail, analysis: AIAnalysis): JiraTicket {
  const projectKey = process.env.JIRA_PROJECT_KEY || 'SUP';

  const issueTypeMap: Record<string, string> = {
    bug_report: 'Bug',
    feature_request: 'Story',
    general_inquiry: 'Task',
    account_issue: 'Task',
    billing: 'Task',
    security_incident: 'Bug',
    service_outage: 'Bug',
    how_to_question: 'Task',
  };

  const priorityMap: Record<string, string> = {
    critical: 'Highest',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
  };

  const description = buildAdfDescription(email, analysis);

  return {
    projectKey,
    issueType: issueTypeMap[analysis.intent] || 'Task',
    summary: email.subject,
    description,
    priority: priorityMap[analysis.priority] || 'Medium',
    labels: analysis.suggestedLabels,
  };
}

export async function createJiraTicket(ticket: JiraTicket): Promise<{ success: boolean; key?: string; error?: string }> {
  const baseUrl = process.env.JIRA_BASE_URL;
  const email = process.env.JIRA_EMAIL;
  const apiToken = process.env.JIRA_API_TOKEN;

  if (!baseUrl || !email || !apiToken ||
      baseUrl === 'https://your-domain.atlassian.net' ||
      email === 'your-email@company.com') {
    console.log('[Jira] No valid Jira credentials configured — simulating ticket creation');
    const simulatedKey = `${ticket.projectKey}-${Math.floor(Math.random() * 9000) + 1000}`;
    return { success: true, key: simulatedKey };
  }

  try {
    const body = {
      fields: {
        project: { key: ticket.projectKey },
        summary: ticket.summary,
        description: ticket.description,
        issuetype: { name: ticket.issueType },
        priority: { name: ticket.priority },
        labels: ticket.labels,
        ...(ticket.customFields || {}),
      },
    };

    const response = await fetch(`${baseUrl}/rest/api/3/issue`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[Jira] API error:', response.status, errorBody);
      return { success: false, error: `Jira API error: ${response.status} - ${errorBody}` };
    }

    const data: JiraCreateResponse = await response.json();
    console.log(`[Jira] Ticket created: ${data.key}`);
    return { success: true, key: data.key };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Jira] Failed to create ticket:', message);
    return { success: false, error: message };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildAdfDescription(email: ParsedEmail, analysis: AIAnalysis): any {
  const content: unknown[] = [];

  // --- Email Body ---
  const bodyLines = email.cleanBody.split('\n');
  for (const line of bodyLines) {
    content.push({
      type: 'paragraph',
      content: line.trim() ? [{ type: 'text', text: line }] : [],
    });
  }

  // --- Divider ---
  content.push({ type: 'rule' });

  // --- AI Analysis heading ---
  content.push({
    type: 'heading',
    attrs: { level: 3 },
    content: [{ type: 'text', text: 'AI Analysis' }],
  });

  // --- Info panel with classification details ---
  const infoRows = [
    ['From', email.fromName !== email.from ? `${email.fromName} (${email.from})` : email.from],
    ['Intent', `${analysis.intent.replace(/_/g, ' ')} (${Math.round(analysis.intentConfidence * 100)}% confidence)`],
    ['Priority', `${analysis.priority} — ${analysis.priorityReason}`],
    ['Sentiment', analysis.sentiment],
  ];

  const entities = Object.entries(analysis.extractedEntities).filter(([, v]) => v);
  if (entities.length > 0) {
    infoRows.push(['Entities', entities.map(([k, v]) => `${k}: ${v}`).join(', ')]);
  }

  content.push({
    type: 'table',
    attrs: { isNumberColumnEnabled: false, layout: 'default' },
    content: infoRows.map(([label, value]) => ({
      type: 'tableRow',
      content: [
        {
          type: 'tableHeader',
          attrs: {},
          content: [{ type: 'paragraph', content: [{ type: 'text', text: label, marks: [{ type: 'strong' }] }] }],
        },
        {
          type: 'tableCell',
          attrs: {},
          content: [{ type: 'paragraph', content: [{ type: 'text', text: value }] }],
        },
      ],
    })),
  });

  // --- Attachments ---
  if (email.attachments.length > 0) {
    content.push({
      type: 'heading',
      attrs: { level: 3 },
      content: [{ type: 'text', text: 'Attachments' }],
    });
    content.push({
      type: 'bulletList',
      content: email.attachments.map(a => ({
        type: 'listItem',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: `${a.filename} (${formatSize(a.size)})` }] }],
      })),
    });
  }

  // --- Footer ---
  content.push({ type: 'rule' });
  content.push({
    type: 'paragraph',
    content: [
      {
        type: 'text',
        text: `This ticket was automatically created by the AI-Powered Jira Automation system. Confidence: ${Math.round(analysis.intentConfidence * 100)}%`,
        marks: [{ type: 'em' }],
      },
    ],
  });

  return { version: 1, type: 'doc', content };
}

export async function uploadAttachments(
  issueKey: string,
  attachments: AttachmentInfo[]
): Promise<{ uploaded: number; failed: number }> {
  const baseUrl = process.env.JIRA_BASE_URL;
  const email = process.env.JIRA_EMAIL;
  const apiToken = process.env.JIRA_API_TOKEN;

  if (!baseUrl || !email || !apiToken ||
      baseUrl === 'https://your-domain.atlassian.net' ||
      email === 'your-email@company.com') {
    console.log(`[Jira] Simulating attachment upload for ${issueKey}: ${attachments.length} file(s)`);
    return { uploaded: attachments.length, failed: 0 };
  }

  let uploaded = 0;
  let failed = 0;

  for (const att of attachments) {
    if (!att.content) {
      console.warn(`[Jira] Skipping ${att.filename}: no content buffer`);
      failed++;
      continue;
    }

    try {
      const form = new FormData();
      const blob = new Blob([new Uint8Array(att.content)], { type: att.contentType });
      form.append('file', blob, att.filename);

      const response = await fetch(`${baseUrl}/rest/api/3/issue/${issueKey}/attachments`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`,
          'Accept': 'application/json',
          'X-Atlassian-Token': 'no-check',
        },
        body: form,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[Jira] Failed to upload ${att.filename}:`, response.status, errorBody);
        failed++;
      } else {
        console.log(`[Jira] Uploaded ${att.filename} to ${issueKey}`);
        uploaded++;
      }
    } catch (error) {
      console.error(`[Jira] Error uploading ${att.filename}:`, error);
      failed++;
    }
  }

  return { uploaded, failed };
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
