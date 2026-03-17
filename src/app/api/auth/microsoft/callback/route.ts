import { NextResponse } from 'next/server';
import { exchangeCodeForTokens } from '@/lib/services/microsoftAuth';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');

  if (error) {
    console.error('[Microsoft OAuth] Error:', error, errorDescription);
    return NextResponse.redirect(
      new URL(`/?auth_error=${encodeURIComponent(errorDescription || error)}`, process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL('/?auth_error=No authorization code received', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')
    );
  }

  try {
    const { email } = await exchangeCodeForTokens(code);
    console.log(`[Microsoft OAuth] Successfully authenticated: ${email}`);
    
    return NextResponse.redirect(
      new URL(`/?auth_success=true&email=${encodeURIComponent(email)}`, process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')
    );
  } catch (err) {
    console.error('[Microsoft OAuth] Token exchange failed:', err);
    return NextResponse.redirect(
      new URL(`/?auth_error=${encodeURIComponent(String(err))}`, process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')
    );
  }
}
