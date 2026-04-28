# AI-Powered Jira Automation - Testing Guide

## Overview

This POC demonstrates an AI-powered system that automatically monitors an email inbox, analyzes incoming support emails using AI, and creates Jira tickets with intelligent classification (intent, priority, sentiment).

**Live Demo URL:** https://ai-automationtest-production.up.railway.app

---

## How to Test

### Option 1: Live Email Monitoring (Real-time)

1. **Open the app** at https://ai-automationtest-production.up.railway.app
2. **Go to the "Live Monitor" tab**
3. **Click "Start Monitoring"** - the system will connect to the configured Gmail inbox
4. **Send a test email** to: `mhdhashem53@gmail.com`
   - **Important:** Include "Support Ticket" in the subject line
5. **Wait 30 seconds** for the system to poll and process the email
6. **Check the "Tickets" tab** to see the auto-created ticket with AI analysis

### Option 2: Email Simulation (Instant Demo)

1. **Open the app** at https://ai-automationtest-production.up.railway.app
2. **Go to the "Simulate Email" tab**
3. **Select a sample email** from the dropdown (e.g., "Password Reset Issue")
4. **Click "Simulate"** to instantly process the email
5. **View the AI analysis** showing intent, priority, and sentiment
6. **Check the "Tickets" tab** to see the created ticket

---

## Sample Test Emails

Copy and paste these into your email client. Send to: **mhdhashem53@gmail.com**

### Email 1: Bug Report (High Priority)
```
To: mhdhashem53@gmail.com
Subject: Support Ticket - Application Crashes on Login

Hi Support Team,

I'm experiencing a critical issue with the application. Every time I try to log in, 
the app crashes immediately after entering my credentials. This started happening 
after the latest update.

Error message: "Fatal Error: Authentication module failed to initialize"

This is blocking my entire team from accessing the system. We need urgent help!

Best regards,
John Smith
Senior Developer
Acme Corporation
```

### Email 2: Feature Request (Medium Priority)
```
To: mhdhashem53@gmail.com
Subject: Support Ticket - Request for Dark Mode Feature

Hello,

I've been using your application for several months now and I love it! 
However, I work late hours and the bright interface strains my eyes.

Would it be possible to add a dark mode option? Many modern applications 
offer this feature and it would greatly improve the user experience for 
those of us who work in low-light environments.

Thank you for considering this suggestion!

Best,
Sarah Johnson
```

### Email 3: General Inquiry (Low Priority)
```
To: mhdhashem53@gmail.com
Subject: Support Ticket - Question About Pricing Plans

Hi there,

I'm currently on the Basic plan and I'm interested in learning more about 
the Premium features. Could you please send me a comparison of what's 
included in each tier?

Also, do you offer any discounts for annual subscriptions?

Thanks!
Mike Chen
```

### Email 4: Urgent Complaint (Critical Priority)
```
To: mhdhashem53@gmail.com
Subject: Support Ticket - URGENT: Data Loss After System Update

URGENT ATTENTION REQUIRED!

After your system update last night, we have lost access to 3 months of 
customer data. This is completely unacceptable and is causing significant 
business impact.

We need immediate escalation to your technical team. Our operations are 
at a standstill until this is resolved.

I expect a response within the hour.

David Williams
Operations Director
Global Tech Inc.
```

---

## What the AI Analyzes

For each email, the system automatically detects:

| Analysis | Description | Example Values |
|----------|-------------|----------------|
| **Intent** | What the user wants | bug_report, feature_request, inquiry, complaint |
| **Priority** | Urgency level | critical, high, medium, low |
| **Sentiment** | Emotional tone | frustrated, neutral, positive, urgent |
| **Category** | Support category | technical, billing, general, account |
| **Confidence** | AI certainty | 0.0 - 1.0 (higher = more confident) |

---

## Expected Results

After processing an email, you should see:

1. **Dashboard** - Updated statistics showing processed emails
2. **Tickets Tab** - New ticket with:
   - Auto-generated title from email subject
   - AI-determined priority badge
   - Intent classification
   - Sentiment indicator
   - Full email content preserved
3. **Jira Integration** - Ticket automatically created in Jira (if configured)

---

## Architecture Highlights

- **Email Monitoring:** IMAP connection to Gmail with 30-second polling
- **AI Processing:** OpenAI GPT-4o-mini for intelligent classification
- **Knowledge Base:** RAG-style matching against known solutions
- **Jira Integration:** Automatic ticket creation via Atlassian API
- **Real-time UI:** React dashboard with live status updates

---

## Questions?

Contact the development team for any issues or questions about this POC.
