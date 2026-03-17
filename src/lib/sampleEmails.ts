import { EmailInput } from './types';

export const sampleEmails: EmailInput[] = [
  {
    id: 'demo-001',
    from: '"Sarah Chen" <sarah.chen@techcorp.com>',
    to: 'support@company.com',
    subject: 'URGENT: Production API returning 500 errors since 2am',
    body: `Hi Support Team,

Our production environment has been experiencing intermittent 500 errors from your API since approximately 2:00 AM UTC today. This is affecting our payment processing pipeline and we're losing transactions.

Error details:
- Endpoint: POST /api/v2/transactions
- Error code: ERR_INTERNAL_SERVER_500
- Frequency: ~30% of requests failing
- Environment: Production
- Account ID: ACC-7829

We've already tried:
1. Rotating our API keys
2. Reducing request rate
3. Checking our payload format

None of these resolved the issue. This is critically impacting our business - we estimate $50k+ in lost revenue per hour.

Please escalate immediately.

Best regards,
Sarah Chen
VP of Engineering
TechCorp Inc.`,
    attachments: [
      { filename: 'error_logs_03102026.txt', contentType: 'text/plain', size: 45200 },
      { filename: 'api_response_screenshot.png', contentType: 'image/png', size: 128400 },
    ],
    receivedAt: new Date().toISOString(),
  },
  {
    id: 'demo-002',
    from: '"Mike Johnson" <mike.j@startup.io>',
    to: 'support@company.com',
    subject: 'How do I reset my password?',
    body: `Hello,

I forgot my password and can't log into my account. Can you help me reset it? My username is mike.j@startup.io.

Thanks,
Mike`,
    attachments: [],
    receivedAt: new Date().toISOString(),
  },
  {
    id: 'demo-003',
    from: '"Rachel Torres" <r.torres@enterprise.com>',
    to: 'support@company.com',
    subject: 'Feature Request: Bulk export with custom date ranges',
    body: `Hi there,

We love the product and our team has been using it extensively. I wanted to suggest a feature that would save us significant time:

Currently, we can only export data for predefined periods (last 7 days, 30 days, etc.). We need the ability to:

1. Select custom date ranges for exports
2. Export in CSV and JSON formats
3. Schedule recurring exports
4. Filter exports by specific tags/labels

This would help our analytics team tremendously. We're on the Enterprise plan and process about 50,000 records monthly.

Would love to discuss this further if helpful.

Best,
Rachel Torres
Data Analytics Lead
Enterprise Corp`,
    attachments: [],
    receivedAt: new Date().toISOString(),
  },
  {
    id: 'demo-004',
    from: '"Alex Petrov" <alex.p@globalbank.com>',
    to: 'support@company.com',
    subject: 'GDPR Data Deletion Request - Account #GB-4421',
    body: `To whom it may concern,

Under Article 17 of the GDPR (Right to Erasure), I am formally requesting the complete deletion of all personal data associated with:

Account: GB-4421
Email: alex.p@globalbank.com
Company: Global Bank Ltd

This includes:
- All user profile data
- Transaction histories
- API logs containing our data
- Any backups or archives

Please confirm receipt of this request and provide a timeline for completion.

Regards,
Alex Petrov
Data Protection Officer
Global Bank Ltd`,
    attachments: [
      { filename: 'gdpr_deletion_request_formal.pdf', contentType: 'application/pdf', size: 89600 },
    ],
    receivedAt: new Date().toISOString(),
  },
  {
    id: 'demo-005',
    from: '"Priya Sharma" <priya@devstudio.tech>',
    to: 'support@company.com',
    subject: 'Getting 429 rate limit errors on Standard plan',
    body: `Hi,

We've been hitting rate limit errors (HTTP 429) consistently for the past week. We're on the Standard plan and our usage has grown.

Current request volume: ~800 requests/minute
Errors start appearing around 600 req/min mark which doesn't match your documented 1000 req/min limit.

Is there an issue with rate limiting on your end, or are we miscounting?

Our integration uses exponential backoff already but the errors are impacting our user experience.

Could you look into this?

Thanks,
Priya Sharma
Senior Developer`,
    attachments: [],
    receivedAt: new Date().toISOString(),
  },
  {
    id: 'demo-006',
    from: '"Thomas Weber" <t.weber@consulting.de>',
    to: 'support@company.com',
    subject: 'Invoice discrepancy - charged twice for March',
    body: `Hello Billing Team,

I noticed we were charged twice for our March subscription:

- March 1: $499.00 (expected)
- March 3: $499.00 (duplicate charge)

Our account ID is CON-2287. Could you please investigate and process a refund for the duplicate charge?

I've attached a screenshot of both transactions from our bank statement.

Thank you,
Thomas Weber
Finance Manager
Weber Consulting GmbH

--
Thomas Weber | Finance Manager
Weber Consulting GmbH
Phone: +49 30 1234567
www.weber-consulting.de`,
    attachments: [
      { filename: 'bank_statement_march.pdf', contentType: 'application/pdf', size: 234500 },
    ],
    receivedAt: new Date().toISOString(),
  },
];
