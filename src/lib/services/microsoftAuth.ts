import * as msal from '@azure/msal-node';

const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID || '';
const MICROSOFT_CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET || '';
const MICROSOFT_TENANT_ID = process.env.MICROSOFT_TENANT_ID || 'common';
const REDIRECT_URI = process.env.NEXT_PUBLIC_APP_URL 
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/microsoft/callback`
  : 'http://localhost:3000/api/auth/microsoft/callback';

// Token storage (in production, use a database)
let cachedTokens: {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  email: string;
} | null = null;

const msalConfig: msal.Configuration = {
  auth: {
    clientId: MICROSOFT_CLIENT_ID,
    clientSecret: MICROSOFT_CLIENT_SECRET,
    authority: `https://login.microsoftonline.com/${MICROSOFT_TENANT_ID}`,
  },
};

let msalClient: msal.ConfidentialClientApplication | null = null;

function getClient(): msal.ConfidentialClientApplication {
  if (!msalClient) {
    if (!MICROSOFT_CLIENT_ID || !MICROSOFT_CLIENT_SECRET) {
      throw new Error('Microsoft OAuth credentials not configured. Set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET in .env.local');
    }
    msalClient = new msal.ConfidentialClientApplication(msalConfig);
  }
  return msalClient;
}

// Scopes needed for IMAP OAuth2
const SCOPES = [
  'https://outlook.office365.com/IMAP.AccessAsUser.All',
  'https://outlook.office365.com/SMTP.Send',
  'offline_access',
  'openid',
  'profile',
  'email',
];

export function getAuthUrl(): string {
  const client = getClient();
  return client.getAuthCodeUrl({
    scopes: SCOPES,
    redirectUri: REDIRECT_URI,
    prompt: 'consent',
  }).then(url => url).catch(err => {
    throw new Error(`Failed to generate auth URL: ${err}`);
  }) as unknown as string;
}

export async function getAuthUrlAsync(): Promise<string> {
  const client = getClient();
  return client.getAuthCodeUrl({
    scopes: SCOPES,
    redirectUri: REDIRECT_URI,
    prompt: 'consent',
  });
}

export async function exchangeCodeForTokens(code: string): Promise<{
  accessToken: string;
  email: string;
}> {
  const client = getClient();
  
  const result = await client.acquireTokenByCode({
    code,
    scopes: SCOPES,
    redirectUri: REDIRECT_URI,
  });

  if (!result || !result.accessToken) {
    throw new Error('Failed to acquire tokens from Microsoft');
  }

  // Extract email from account info
  const email = result.account?.username || process.env.IMAP_USER || '';

  // Cache the tokens
  cachedTokens = {
    accessToken: result.accessToken,
    refreshToken: '', // MSAL handles refresh internally via cache
    expiresAt: result.expiresOn ? result.expiresOn.getTime() : Date.now() + 3600000,
    email,
  };

  console.log(`[MicrosoftAuth] Tokens acquired for ${email}`);

  return {
    accessToken: result.accessToken,
    email,
  };
}

export async function getAccessToken(): Promise<string | null> {
  if (!cachedTokens) {
    return null;
  }

  // Check if token is expired (with 5 min buffer)
  if (Date.now() > cachedTokens.expiresAt - 300000) {
    console.log('[MicrosoftAuth] Token expired, attempting refresh...');
    
    try {
      const client = getClient();
      const accounts = await client.getTokenCache().getAllAccounts();
      
      if (accounts.length > 0) {
        const result = await client.acquireTokenSilent({
          scopes: SCOPES,
          account: accounts[0],
        });
        
        if (result && result.accessToken) {
          cachedTokens.accessToken = result.accessToken;
          cachedTokens.expiresAt = result.expiresOn ? result.expiresOn.getTime() : Date.now() + 3600000;
          console.log('[MicrosoftAuth] Token refreshed successfully');
          return result.accessToken;
        }
      }
    } catch (err) {
      console.error('[MicrosoftAuth] Token refresh failed:', err);
      cachedTokens = null;
      return null;
    }
  }

  return cachedTokens.accessToken;
}

export function getCachedEmail(): string | null {
  return cachedTokens?.email || null;
}

export function isAuthenticated(): boolean {
  return cachedTokens !== null && Date.now() < cachedTokens.expiresAt;
}

export function clearTokens(): void {
  cachedTokens = null;
  msalClient = null;
}

export function getRedirectUri(): string {
  return REDIRECT_URI;
}
