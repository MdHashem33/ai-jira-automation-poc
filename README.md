# AI-Powered Jira Automation — Email Channel POC

> Enterprise AI middleware that automatically processes inbound support emails, classifies them using AI, resolves known issues via RAG knowledge base lookup, and escalates unresolved issues to Jira — all in seconds, with zero manual intervention.

---

## Executive Summary

This Proof of Concept demonstrates a **fully automated email-to-Jira pipeline** powered by AI. It eliminates the manual process of reading support emails, classifying issues, checking knowledge bases, and creating Jira tickets — reducing ticket creation time from **minutes to seconds** while improving consistency and accuracy.

### Key Metrics (Target)

| Metric | Manual Process | With AI Automation |
|--------|---------------|-------------------|
| Avg. ticket creation time | 5-10 minutes | **< 3 seconds** |
| Auto-resolve rate (known issues) | 0% | **30-40%** |
| Classification accuracy | Varies by agent | **85-95%** |
| 24/7 availability | No | **Yes** |
| Human error in routing | ~15% | **< 2%** |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    INBOUND EMAIL                                │
│         (SMTP / IMAP / Webhook / SendGrid / AWS SES)           │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                  1. EMAIL PARSING LAYER                         │
│  ┌──────────┐ ┌───────────────┐ ┌────────────┐ ┌────────────┐  │
│  │  Thread   │ │   Signature   │ │ Attachment  │ │  Language   │  │
│  │ Cleaning  │ │   Removal     │ │ Extraction  │ │ Detection   │  │
│  └──────────┘ └───────────────┘ └────────────┘ └────────────┘  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                  2. AI ANALYSIS ENGINE                          │
│  ┌──────────┐ ┌───────────────┐ ┌────────────┐ ┌────────────┐  │
│  │  Intent   │ │   Priority    │ │ Sentiment   │ │  Entity     │  │
│  │ Classify  │ │  Prediction   │ │  Analysis   │ │ Extraction  │  │
│  └──────────┘ └───────────────┘ └────────────┘ └────────────┘  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│               3. RAG KNOWLEDGE BASE LOOKUP                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Search knowledge base for matching articles/solutions   │   │
│  │  Score relevance → Determine if auto-resolvable          │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                  4. DECISION ENGINE                             │
│                                                                 │
│         ┌─────── Confidence > Threshold? ───────┐               │
│         │                                       │               │
│     YES ▼                                   NO  ▼               │
│  ┌─────────────┐                      ┌──────────────┐          │
│  │ Auto-Resolve │                      │  Escalate to  │          │
│  │  + KB Reply  │                      │     Jira      │          │
│  └─────────────┘                      └──────────────┘          │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│               5. ACTION EXECUTION                               │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │  Auto-Reply   │  │ Jira Ticket   │  │ Confirmation Email    │  │
│  │  to Customer  │  │  Creation     │  │ with Ticket Number    │  │
│  └──────────────┘  └──────────────┘  └───────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Framework** | Next.js 14 (App Router) | Full-stack React + API routes |
| **Language** | TypeScript | Type safety & maintainability |
| **AI Provider** | OpenAI GPT-4o-mini | Intent classification, priority prediction, sentiment analysis |
| **Email Parsing** | Custom parser (mailparser-compatible) | Thread cleaning, signature removal, language detection |
| **Knowledge Base** | In-memory RAG (vector DB-ready) | Article matching & auto-resolution |
| **Jira Integration** | REST API v3 | Ticket creation with rich formatting |
| **Frontend** | React + TailwindCSS + Lucide Icons | Real-time dashboard & demo UI |
| **Styling** | TailwindCSS | Responsive, dark-themed enterprise UI |

### Production-Ready Upgrade Path

| POC Component | Production Upgrade |
|--------------|-------------------|
| In-memory store | PostgreSQL + Redis cache |
| In-memory RAG | Pinecone / Weaviate / Elasticsearch vector DB |
| Direct API calls | RabbitMQ / Kafka message queue |
| Single process | Dockerized microservices + Kubernetes |
| Console logging | ELK Stack / Datadog / Prometheus + Grafana |

---

## Features

### Email Processing Pipeline
- **Thread cleaning** — Strips quoted replies, forwarded content
- **Signature removal** — Detects and removes email signatures
- **Attachment tracking** — Identifies and catalogs file attachments
- **Language detection** — Supports English, French, Spanish, German, Arabic, CJK
- **Reply detection** — Identifies Re:/Fwd: threads

### AI Classification
- **Intent detection** — Bug report, feature request, billing, security incident, service outage, account issue, how-to question, general inquiry
- **Priority prediction** — Critical, High, Medium, Low with reasoning
- **Sentiment analysis** — Positive, neutral, negative, frustrated, urgent
- **Entity extraction** — Product, component, version, error code, account ID, environment
- **Confidence scoring** — Triggers human review when confidence is low

### Knowledge Base (RAG)
- **Keyword-based matching** — Fast similarity scoring against KB articles
- **Auto-resolution** — Sends KB article as reply when match confidence is high
- **Fallback escalation** — Creates Jira ticket when no match found

### Jira Integration
- **Rich ticket formatting** — Structured Jira description with all AI analysis
- **Field mapping** — Automatic issue type, priority, labels assignment
- **Simulated mode** — Works without Jira credentials for demo purposes
- **Confirmation emails** — Auto-generated ticket confirmation to customer

### Live Email Monitoring (IMAP)
- **Real inbox connection** — Connects to any IMAP mailbox (Gmail, Outlook, etc.)
- **Automatic polling** — Configurable interval to check for new unread emails
- **Start/Stop controls** — One-click monitoring via the dashboard UI
- **Live status dashboard** — Connection details, emails processed, last check time
- **Auto-mark as read** — Processed emails are marked as seen after pipeline completion

### Dashboard
- **Real-time KPIs** — Total processed, auto-resolved, escalated, avg processing time
- **Pipeline visualization** — Step-by-step processing flow
- **Priority & intent breakdown** — Visual distribution charts
- **Ticket detail view** — Full AI analysis, processing steps, auto-reply preview
- **Live Monitor tab** — Start/stop inbox monitoring with real-time status

---

## Quick Start

### Prerequisites

- **Node.js** 18+ installed
- **npm** or **yarn**
- **(Optional)** OpenAI API key for real AI classification
- **(Optional)** Jira Cloud instance + API token for real ticket creation

### 1. Clone & Install

```bash
cd ai-jira-automation-poc
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials:

```env
# Required for AI-powered classification (optional - falls back to rule-based)
OPENAI_API_KEY=sk-your-key-here

# Required for real Jira ticket creation (optional - simulates if not set)
JIRA_BASE_URL=https://your-domain.atlassian.net
JIRA_EMAIL=your-email@company.com
JIRA_API_TOKEN=your-api-token
JIRA_PROJECT_KEY=SUP

# Required for live inbox monitoring (optional - use simulation mode without these)
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_USER=your-email@gmail.com
IMAP_PASS=your-app-password
IMAP_MAILBOX=INBOX
IMAP_POLL_INTERVAL_MS=30000
```

> **Note:** The POC works fully without any API keys — it falls back to intelligent rule-based classification and simulated Jira ticket creation for demo purposes.

#### Gmail IMAP Setup
1. Enable **2-Step Verification** on your Google account
2. Go to [App Passwords](https://myaccount.google.com/apppasswords)
3. Create a new App Password (select "Mail")
4. Use the generated 16-character password as `IMAP_PASS`
5. Ensure IMAP is enabled in Gmail: Settings → See all settings → Forwarding and POP/IMAP → Enable IMAP

### 3. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 4. Demo Walkthrough

1. **Dashboard tab** — View the empty state and architecture pipeline diagram
2. **Email Simulation tab** — Click any sample email to process it
3. Watch the **processing pipeline** execute in real-time
4. Review the **AI analysis** — intent, priority, sentiment, entities
5. Check the **Jira ticket payload** or **auto-reply** generated
6. Return to **Dashboard** to see updated KPIs and statistics
7. Process multiple emails to see aggregated analytics
8. **Live Monitor tab** — Connect to a real inbox and watch emails get processed automatically

---

## Demo Scenarios

| # | Scenario | Expected Outcome |
|---|----------|-----------------|
| 1 | **Production API 500 errors** | Critical priority → Jira escalation |
| 2 | **Password reset question** | KB match → Auto-resolved with instructions |
| 3 | **Feature request: bulk export** | Medium priority → Jira story creation |
| 4 | **GDPR data deletion request** | Compliance intent → Jira with KB article link |
| 5 | **Rate limiting errors** | KB match → Auto-resolved with API limits info |
| 6 | **Duplicate billing charge** | Billing intent → Jira escalation |

---

## API Reference

### POST `/api/email/ingest`
Process a real inbound email through the pipeline.

```json
{
  "from": "user@example.com",
  "subject": "Issue with login",
  "body": "I can't log into my account...",
  "attachments": [{"filename": "screenshot.png", "contentType": "image/png", "size": 45000}]
}
```

### POST `/api/email/simulate`
Process a pre-built sample email for demo purposes.

```json
{
  "sampleIndex": 0
}
```

### GET `/api/email/simulate`
List available sample email scenarios.

### GET `/api/tickets`
List all processed tickets.

### GET `/api/tickets?id={ticketId}`
Get a specific ticket's full details.

### GET `/api/dashboard/stats`
Get dashboard KPIs and analytics.

### GET `/api/monitor`
Get live email monitor status (running, connected host, emails processed, errors).

### POST `/api/monitor`
Start or stop live email monitoring.

```json
{
  "action": "start"
}
```

---

## Roadmap: Future Channels

This POC implements the **Email Channel** only. The architecture is designed for modular channel expansion:

### Phase 2: Voice Channel (AI Speech Recognition)
- Twilio / Amazon Connect telephony integration
- Real-time Speech-to-Text (Deepgram / Whisper)
- Voice-specific slot filling and entity confirmation
- Call recording storage (S3 / Azure Blob)

### Phase 3: Website Chatbot
- Embeddable JS widget
- Multi-turn conversation with context awareness
- Session memory handling
- Live agent escalation fallback

### Phase 4: Enterprise Hardening
- PostgreSQL + Redis for persistence
- Vector DB (Pinecone/Weaviate) for production RAG
- Message queue (RabbitMQ/Kafka) for async processing
- Kubernetes deployment with auto-scaling
- Prometheus + Grafana monitoring
- PII masking and GDPR compliance
- Audit trail for all AI decisions

---

## Security Considerations

- **No PII storage** — POC uses in-memory store, cleared on restart
- **API key isolation** — All credentials in `.env.local` (gitignored)
- **Jira service account** — Uses dedicated API token, not user credentials
- **TLS ready** — Deploy behind HTTPS reverse proxy in production
- **Audit logging** — All processing steps logged with timestamps

---

## Project Structure

```
ai-jira-automation-poc/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout
│   │   ├── page.tsx                # Dashboard + Simulation UI
│   │   ├── globals.css             # Tailwind + custom styles
│   │   └── api/
│   │       ├── email/
│   │       │   ├── ingest/route.ts   # Email webhook endpoint
│   │       │   └── simulate/route.ts # Demo simulation endpoint
│   │       ├── tickets/route.ts      # Ticket CRUD
│   │       └── dashboard/
│   │           └── stats/route.ts    # Dashboard analytics
│   └── lib/
│       ├── types.ts                # TypeScript interfaces
│       ├── store.ts                # In-memory data store
│       ├── knowledgeBase.ts        # RAG knowledge articles
│       ├── sampleEmails.ts         # Demo email scenarios
│       └── services/
│           ├── pipeline.ts         # Orchestration engine
│           ├── emailParser.ts      # Email parsing & cleaning
│           ├── aiMiddleware.ts     # AI classification (OpenAI + fallback)
│           ├── jiraService.ts      # Jira REST API integration
│           ├── autoReply.ts        # Auto-reply generation
│           └── emailMonitor.ts     # IMAP inbox monitoring service
├── .env.example                    # Environment template
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.ts
└── README.md
```

---

## License

Internal R&D — Confidential
