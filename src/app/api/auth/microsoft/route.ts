import { NextResponse } from 'next/server';
import { getAuthUrlAsync, isAuthenticated, getCachedEmail, clearTokens } from '@/lib/services/microsoftAuth';

export async function GET() {
  try {
    const authenticated = isAuthenticated();
    const email = getCachedEmail();
    
    return NextResponse.json({
      authenticated,
      email,
    });
  } catch (error) {
    return NextResponse.json({
      authenticated: false,
      email: null,
      error: String(error),
    });
  }
}

export async function POST(request: Request) {
  try {
    const { action } = await request.json();

    if (action === 'login') {
      const authUrl = await getAuthUrlAsync();
      return NextResponse.json({ authUrl });
    }

    if (action === 'logout') {
      clearTokens();
      return NextResponse.json({ success: true, message: 'Logged out successfully' });
    }

    return NextResponse.json(
      { success: false, message: 'Invalid action. Use "login" or "logout".' },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error: ${error}` },
      { status: 500 }
    );
  }
}
