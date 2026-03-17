import { ImapFlow } from 'imapflow';
import { processEmail } from './pipeline';
import { EmailInput } from '../types';
import { simpleParser } from 'mailparser';
import { v4 as uuidv4 } from 'uuid';
import { getAccessToken, getCachedEmail, isAuthenticated } from './microsoftAuth';

interface MonitorConfig {
  host: string;
  port: number;
  auth: {
    user: string;
    pass?: string;
    accessToken?: string;
  };
  tls: boolean;
  pollIntervalMs: number;
  mailbox: string;
  useOAuth: boolean;
}

interface MonitorStatus {
  running: boolean;
  connectedAt: string | null;
  lastCheckAt: string | null;
  emailsProcessed: number;
  errors: string[];
  mailbox: string;
  host: string;
  user: string;
  authType: 'basic' | 'oauth2' | 'none';
}

// Singleton state
let client: ImapFlow | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let reconnecting = false;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY_MS = 5000;
let reconnectAttempts = 0;

let monitorStatus: MonitorStatus = {
  running: false,
  connectedAt: null,
  lastCheckAt: null,
  emailsProcessed: 0,
  errors: [],
  mailbox: '',
  host: '',
  user: '',
  authType: 'none',
};

async function getConfig(): Promise<MonitorConfig> {
  // Check if Microsoft OAuth is available first
  if (isAuthenticated()) {
    // Always get a fresh token — getAccessToken() handles refresh internally
    const accessToken = await getAccessToken();
    const email = getCachedEmail();

    if (accessToken && email) {
      console.log('[EmailMonitor] Using Microsoft OAuth2 authentication');
      return {
        host: 'outlook.office365.com',
        port: 993,
        auth: { user: email, accessToken },
        tls: true,
        pollIntervalMs: parseInt(process.env.IMAP_POLL_INTERVAL_MS || '30000', 10),
        mailbox: process.env.IMAP_MAILBOX || 'INBOX',
        useOAuth: true,
      };
    }
  }

  // Fall back to basic auth
  const host = process.env.IMAP_HOST;
  const user = process.env.IMAP_USER;
  const pass = process.env.IMAP_PASS;

  if (!host || !user || !pass) {
    throw new Error(
      'IMAP credentials not configured. Either authenticate with Microsoft OAuth or set IMAP_HOST, IMAP_USER, and IMAP_PASS in .env.local'
    );
  }

  console.log('[EmailMonitor] Using basic password authentication');
  return {
    host,
    port: parseInt(process.env.IMAP_PORT || '993', 10),
    auth: { user, pass },
    tls: process.env.IMAP_TLS !== 'false',
    pollIntervalMs: parseInt(process.env.IMAP_POLL_INTERVAL_MS || '30000', 10),
    mailbox: process.env.IMAP_MAILBOX || 'INBOX',
    useOAuth: false,
  };
}

async function connectClient(config: MonitorConfig): Promise<ImapFlow> {
  const authConfig = config.useOAuth && config.auth.accessToken
    ? { user: config.auth.user, accessToken: config.auth.accessToken }
    : { user: config.auth.user, pass: config.auth.pass! };

  const newClient = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.tls,
    auth: authConfig,
    logger: {
      debug: (msg: unknown) => console.log('[IMAP DEBUG]', msg),
      info: (msg: unknown) => console.log('[IMAP INFO]', msg),
      warn: (msg: unknown) => console.warn('[IMAP WARN]', msg),
      error: (msg: unknown) => console.error('[IMAP ERROR]', msg),
    },
  });

  newClient.on('error', (err: Error) => {
    console.error('[EmailMonitor] IMAP connection error:', err.message);
    addError(`Connection error: ${err.message}`);
    // Trigger reconnect instead of stopping
    handleDisconnect();
  });

  await newClient.connect();
  return newClient;
}

function addError(msg: string) {
  monitorStatus.errors.push(msg);
  if (monitorStatus.errors.length > 20) {
    monitorStatus.errors = monitorStatus.errors.slice(-20);
  }
}

async function handleDisconnect() {
  if (reconnecting || !monitorStatus.running) return;
  reconnecting = true;

  // Clean up dead client
  if (client) {
    try { await client.logout(); } catch { /* ignore */ }
    client = null;
  }

  console.log('[EmailMonitor] Connection lost, attempting reconnect...');

  while (reconnectAttempts < MAX_RECONNECT_ATTEMPTS && monitorStatus.running) {
    reconnectAttempts++;
    const delay = RECONNECT_DELAY_MS * reconnectAttempts;
    console.log(`[EmailMonitor] Reconnect attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delay / 1000}s...`);
    addError(`Reconnecting (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);

    await new Promise(resolve => setTimeout(resolve, delay));

    if (!monitorStatus.running) break; // stopped while waiting

    try {
      // Get fresh config (with fresh OAuth token if applicable)
      const config = await getConfig();
      client = await connectClient(config);

      monitorStatus.connectedAt = new Date().toISOString();
      reconnectAttempts = 0;
      reconnecting = false;
      console.log('[EmailMonitor] Reconnected successfully');
      addError('Reconnected successfully');
      return;
    } catch (err) {
      console.error(`[EmailMonitor] Reconnect attempt ${reconnectAttempts} failed:`, err);
      addError(`Reconnect failed: ${err}`);
    }
  }

  // All attempts exhausted
  reconnecting = false;
  if (monitorStatus.running) {
    console.error('[EmailMonitor] Max reconnect attempts reached, stopping monitor');
    addError('Max reconnect attempts reached — monitor stopped');
    monitorStatus.running = false;
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }
}

async function fetchAndProcessNewEmails(): Promise<number> {
  if (!client || !monitorStatus.running) return 0;

  // For OAuth, refresh the IMAP connection if the token was refreshed
  if (monitorStatus.authType === 'oauth2') {
    try {
      const freshToken = await getAccessToken();
      if (!freshToken) {
        addError('OAuth token expired and could not be refreshed');
        handleDisconnect();
        return 0;
      }
    } catch (err) {
      addError(`OAuth token refresh check failed: ${err}`);
      handleDisconnect();
      return 0;
    }
  }

  let processed = 0;
  const mailbox = monitorStatus.mailbox || 'INBOX';

  try {
    const lock = await client.getMailboxLock(mailbox);

    try {
      // Debug: check total unseen emails first
      const allUnseen = await client.search({ seen: false }, { uid: true });
      const allUnseenCount = Array.isArray(allUnseen) ? allUnseen.length : 0;
      console.log(`[EmailMonitor] Total unseen emails in mailbox: ${allUnseenCount}`);

      // Search for unseen messages with "Support Ticket" in subject (using UIDs for stability)
      const unseenMessages = await client.search({ seen: false, subject: 'Support Ticket' }, { uid: true });
      const unseenCount = Array.isArray(unseenMessages) ? unseenMessages.length : 0;
      console.log(`[EmailMonitor] Unseen with "Support Ticket" subject: ${unseenCount}`);

      if (unseenCount === 0) {
        monitorStatus.lastCheckAt = new Date().toISOString();
        return 0;
      }

      console.log(`[EmailMonitor] Found ${unseenCount} unread email(s)`);

      for (const uid of unseenMessages as number[]) {
        try {
          // Fetch the full message by UID
          const message = await client.fetchOne(String(uid), {
            source: true,
            envelope: true,
            uid: true,
          }, { uid: true });

          if (!message || !message.source) continue;

          // Parse the raw email
          const parsed = await simpleParser(message.source);

          // Convert to our EmailInput format
          const emailInput: EmailInput = {
            id: uuidv4(),
            from: parsed.from?.text || 'unknown@email.com',
            to: parsed.to
              ? Array.isArray(parsed.to)
                ? parsed.to.map((t) => t.text).join(', ')
                : parsed.to.text
              : monitorStatus.user,
            subject: parsed.subject || '(No Subject)',
            body: parsed.text || parsed.html || '',
            attachments: (parsed.attachments || []).map((att) => ({
              filename: att.filename || 'unnamed',
              contentType: att.contentType || 'application/octet-stream',
              size: att.size || 0,
              content: att.content,
            })),
            receivedAt: (parsed.date || new Date()).toISOString(),
          };

          console.log(
            `[EmailMonitor] Processing email from ${emailInput.from}: "${emailInput.subject}"`
          );

          // Process through the AI pipeline
          const result = await processEmail(emailInput);

          console.log(
            `[EmailMonitor] Result: ${result.status} | Intent: ${result.aiAnalysis?.intent} | Priority: ${result.aiAnalysis?.priority}`
          );

          // Mark as read (seen) after successful processing, using UID
          await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });

          processed++;
          monitorStatus.emailsProcessed++;
        } catch (emailErr) {
          const errMsg = `Failed to process email UID ${uid}: ${emailErr}`;
          console.error(`[EmailMonitor] ${errMsg}`);
          addError(errMsg);
        }
      }
    } finally {
      lock.release();
    }
  } catch (err) {
    const errMsg = `Mailbox fetch error: ${err}`;
    console.error(`[EmailMonitor] ${errMsg}`);
    addError(errMsg);

    // If the connection is dead, trigger reconnect
    const errStr = String(err);
    if (errStr.includes('closed') || errStr.includes('disconnect') || errStr.includes('ECONNRESET') || errStr.includes('timeout')) {
      handleDisconnect();
    }
  }

  monitorStatus.lastCheckAt = new Date().toISOString();
  return processed;
}

export async function startMonitor(): Promise<{ success: boolean; message: string }> {
  // Clean up any existing connection first
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  if (client) {
    try { await client.logout(); } catch { /* ignore */ }
    client = null;
  }
  monitorStatus.running = false;
  reconnecting = false;
  reconnectAttempts = 0;

  try {
    const config = await getConfig();

    console.log(`[EmailMonitor] Connecting to ${config.host}:${config.port} as ${config.auth.user}`);

    client = await connectClient(config);

    monitorStatus = {
      running: true,
      connectedAt: new Date().toISOString(),
      lastCheckAt: null,
      emailsProcessed: 0,
      errors: [],
      mailbox: config.mailbox,
      host: config.host,
      user: config.auth.user,
      authType: config.useOAuth ? 'oauth2' : 'basic',
    };

    console.log(
      `[EmailMonitor] Connected to ${config.host} as ${config.auth.user}, watching ${config.mailbox}`
    );

    // Initial fetch
    await fetchAndProcessNewEmails();

    // Set up polling interval
    pollTimer = setInterval(async () => {
      if (reconnecting) return; // skip poll while reconnecting
      try {
        await fetchAndProcessNewEmails();
      } catch (err) {
        console.error('[EmailMonitor] Poll error:', err);
        addError(`Poll error: ${err}`);
      }
    }, config.pollIntervalMs);

    return {
      success: true,
      message: `Connected to ${config.host}, monitoring ${config.mailbox} every ${config.pollIntervalMs / 1000}s`,
    };
  } catch (err) {
    monitorStatus.running = false;
    const errorMsg = `Failed to connect: ${err}`;
    addError(errorMsg);
    return { success: false, message: errorMsg };
  }
}

export async function stopMonitor(): Promise<{ success: boolean; message: string }> {
  if (!monitorStatus.running) {
    return { success: false, message: 'Monitor is not running' };
  }

  // Signal everything to stop
  monitorStatus.running = false;

  try {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }

    if (client) {
      await client.logout();
      client = null;
    }

    const processed = monitorStatus.emailsProcessed;
    monitorStatus.connectedAt = null;
    reconnecting = false;
    reconnectAttempts = 0;

    console.log(`[EmailMonitor] Stopped. Processed ${processed} emails total.`);

    return {
      success: true,
      message: `Monitor stopped. Processed ${processed} emails during session.`,
    };
  } catch (err) {
    client = null;
    return { success: false, message: `Error during shutdown: ${err}` };
  }
}

export function getMonitorStatus(): MonitorStatus {
  return { ...monitorStatus };
}
