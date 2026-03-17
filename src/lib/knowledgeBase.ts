export interface KBArticle {
  id: string;
  title: string;
  category: string;
  keywords: string[];
  patterns: RegExp[];
  content: string;
  resolution: string;
}

export const knowledgeBase: KBArticle[] = [
  {
    id: 'KB-001',
    title: 'How to Reset Your Password',
    category: 'account',
    keywords: ['password', 'reset', 'forgot', 'login', 'cannot login', 'locked out', 'access'],
    patterns: [
      /how (do|can) i (reset|change|update) my (password|credentials|login)/i,
      /forgot .*(password|login)/i,
      /can'?t (log|sign) ?in/i,
      /locked out of .*(account|system)/i,
      /reset .*(password|credentials)/i,
      /password .*(not|isn'?t|doesn'?t) work/i,
      /need .*(new|different) password/i,
    ],
    content: 'Users can reset their password via the login page by clicking "Forgot Password".',
    resolution: `To reset your password, please follow these steps:
1. Go to the login page at https://app.example.com/login
2. Click "Forgot Password" below the sign-in button
3. Enter the email address associated with your account
4. Check your inbox for a password reset link (valid for 24 hours)
5. Click the link and set a new password (min 8 characters, must include a number and special character)

If you don't receive the email within 5 minutes, please check your spam folder. If the issue persists, our support team is here to help.`,
  },
  {
    id: 'KB-002',
    title: 'API Rate Limiting Policy',
    category: 'technical',
    keywords: ['rate limit', 'api', '429', 'throttle', 'too many requests', 'quota'],
    patterns: [
      /getting .*(429|rate limit|throttl)/i,
      /api .*(limit|quota|throttl)/i,
      /too many requests/i,
      /how many (requests|calls) (can|do) (i|we)/i,
      /what .*(rate limit|api limit|request limit)/i,
      /increase .*(rate|api|request) limit/i,
      /hit(ting)? .*(rate|api) limit/i,
    ],
    content: 'API rate limits are 1000 requests/minute for standard plans and 5000 for enterprise.',
    resolution: `Our API rate limits are as follows:
- **Standard Plan**: 1,000 requests per minute
- **Professional Plan**: 3,000 requests per minute
- **Enterprise Plan**: 5,000 requests per minute

If you're hitting rate limits (HTTP 429), consider:
1. Implementing exponential backoff in your retry logic
2. Caching responses where appropriate
3. Using bulk/batch endpoints instead of individual calls
4. Upgrading your plan for higher limits

You can monitor your current usage via the API Dashboard at https://app.example.com/api/usage`,
  },
  {
    id: 'KB-003',
    title: 'Billing Cycle and Invoice Questions',
    category: 'billing',
    keywords: ['billing', 'invoice', 'charge', 'payment', 'subscription', 'plan', 'pricing', 'refund'],
    patterns: [
      /where .*(invoice|bill|receipt)/i,
      /how (do|can) i .*(pay|upgrade|downgrade|cancel)/i,
      /when .*(charged|billed|invoiced)/i,
      /charged? (twice|double|extra|wrong)/i,
      /want .*(refund|money back)/i,
      /cancel .*(subscription|plan|account)/i,
      /change .*(plan|subscription|payment)/i,
      /what .*(plan|pricing|cost)/i,
    ],
    content: 'Billing cycles are monthly. Invoices are generated on the 1st of each month.',
    resolution: `Here's a summary of our billing process:
- Billing cycles run monthly, invoices generated on the 1st
- You can view and download invoices at https://app.example.com/billing
- Payment methods accepted: Credit card, ACH, wire transfer (Enterprise only)
- For plan changes, prorated charges/credits are applied automatically
- Refund requests are handled within 5 business days

For specific billing inquiries or refund requests, our billing team will review your account and follow up within 1 business day.`,
  },
  {
    id: 'KB-004',
    title: 'Data Export and GDPR Requests',
    category: 'compliance',
    keywords: ['gdpr', 'data export', 'delete my data', 'privacy', 'data request', 'personal data', 'right to be forgotten'],
    patterns: [
      /delete .*(my|our|all) (data|account|information)/i,
      /gdpr .*(request|deletion|compliance|erasure)/i,
      /right to (erasure|be forgotten|deletion)/i,
      /export .*(my|our|all) data/i,
      /data .*(deletion|removal|export|privacy) request/i,
      /how (do|can) i .*(export|download|delete) .*(data|information)/i,
      /personal data .*(request|deletion|access)/i,
    ],
    content: 'GDPR data export and deletion requests are processed within 30 days.',
    resolution: `We take data privacy seriously. Here's how we handle data requests:

**Data Export**: You can export your data anytime from Settings > Data > Export. This generates a ZIP file with all your data in JSON format.

**GDPR Deletion Request**: Submit a formal request to privacy@example.com. We will:
1. Acknowledge your request within 48 hours
2. Process the deletion within 30 days
3. Confirm completion via email

**Data Retention**: By default, we retain data for 12 months after account closure. You can request immediate deletion.`,
  },
  {
    id: 'KB-005',
    title: 'How to Change Your Email Address',
    category: 'account',
    keywords: ['email', 'change email', 'update email', 'email address', 'new email', 'switch email'],
    patterns: [
      /how (do|can) i (change|update|switch|modify) my email/i,
      /change .*(email|e-mail) (address|account)/i,
      /update .*(email|e-mail)/i,
      /want .*(new|different) email/i,
      /switch .*(email|e-mail)/i,
      /new (work |company )?email/i,
    ],
    content: 'Users can update their email address from the Account Settings page.',
    resolution: `To change the email address associated with your account:
1. Log in and go to Settings > Account > Profile
2. Click "Edit" next to your current email address
3. Enter your new email address
4. We'll send a verification link to the new address
5. Click the link to confirm the change (valid for 24 hours)

**Important notes**:
- You must have access to both the old and new email addresses during the transition
- All future notifications will be sent to the new address
- Your login credentials will update to use the new email
- If you no longer have access to your current email, contact support for manual verification`,
  },
  {
    id: 'KB-006',
    title: 'Integration Setup Guide',
    category: 'technical',
    keywords: ['integration', 'webhook', 'api key', 'connect', 'setup', 'slack', 'teams', 'configure'],
    patterns: [
      /how (do|can) i .*(set ?up|connect|configure|integrate) .*(slack|teams|github|gitlab|webhook|pagerduty|datadog)/i,
      /set ?up .*(integration|webhook|connection)/i,
      /connect .*(slack|teams|github|gitlab)/i,
      /where .*(api key|integration|webhook)/i,
      /how (do|can) i .*(generate|create|get) .*(api key|token)/i,
      /configure .*(webhook|integration|notification)/i,
    ],
    content: 'Integrations can be configured from the Settings > Integrations page.',
    resolution: `To set up an integration:
1. Navigate to Settings > Integrations
2. Select the integration you want to configure
3. Follow the provider-specific authorization flow
4. Configure webhook URLs and event subscriptions
5. Test the connection using the "Send Test Event" button

**Available integrations**: Slack, Microsoft Teams, GitHub, GitLab, PagerDuty, Datadog, and custom webhooks.

For API key generation, go to Settings > API > Generate New Key. Store it securely — we don't display keys after creation.`,
  },
  {
    id: 'KB-007',
    title: 'Known Issue: Dashboard Loading Slowly',
    category: 'known_issue',
    keywords: ['slow', 'dashboard', 'loading', 'performance', 'timeout', 'hang', 'spinning'],
    patterns: [
      /dashboard .*(slow|hang|stuck|freeze|lag|not loading|takes? (forever|long|too long))/i,
      /slow .*(dashboard|page|loading|performance)/i,
      /page .*(not|isn'?t|won'?t) load/i,
      /dashboard .*(time ?out|crash|unresponsive)/i,
      /performance (issue|problem|degradation)/i,
      /why is .*(dashboard|page|app) .*(slow|taking)/i,
    ],
    content: 'There is a known performance issue with dashboards containing >50 widgets.',
    resolution: `We're aware of a performance issue affecting dashboards with more than 50 widgets. Our engineering team is actively working on a fix (target: next release).

**Workarounds**:
1. Reduce the number of widgets to under 50 per dashboard
2. Use date range filters to limit data queries
3. Try our new "Lite Dashboard" mode: Settings > Dashboard > Enable Lite Mode
4. Clear your browser cache and disable browser extensions

We apologize for the inconvenience. This fix is our top engineering priority.`,
  },
];

export function searchKnowledgeBase(query: string): { article: KBArticle; score: number } | null {
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);

  let bestMatch: { article: KBArticle; score: number } | null = null;

  for (const article of knowledgeBase) {
    let score = 0;
    let matched = false;

    // Pattern matching — highest signal, scores 6 points per match
    let patternHits = 0;
    for (const pattern of article.patterns) {
      if (pattern.test(query)) {
        patternHits++;
        score += 6;
        matched = true;
      }
    }

    // Keyword matching — 3 points per direct hit
    let keywordHits = 0;
    for (const keyword of article.keywords) {
      if (queryLower.includes(keyword.toLowerCase())) {
        score += 3;
        keywordHits++;
        matched = true;
      }
    }

    // Word-level fuzzy matching — lower signal
    for (const word of queryWords) {
      if (article.title.toLowerCase().includes(word)) score += 1;
      if (article.content.toLowerCase().includes(word)) score += 0.5;
      for (const kw of article.keywords) {
        if (kw.toLowerCase().includes(word)) score += 1.5;
      }
    }

    // Normalize: pattern hits are worth more, so use a higher divisor
    // 1 pattern hit (6) + 1 keyword hit (3) = 9 → ~0.5 normalized
    // 2 pattern hits (12) + 2 keyword hits (6) = 18 → 1.0
    const normalizedScore = Math.min(score / 18, 1.0);

    if (matched && normalizedScore > 0.1 && (!bestMatch || normalizedScore > bestMatch.score)) {
      bestMatch = { article, score: normalizedScore };
    }
  }

  return bestMatch;
}
