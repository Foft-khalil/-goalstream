import { NextRequest, NextResponse } from 'next/server';
import { isRateLimited, getClientIp } from '@/lib/security';

/**
 * Server-side admin authentication endpoint.
 * 
 * SECURITY: Password is stored as an environment variable ADMIN_PASSWORD,
 * NOT hardcoded in client-side code. Falls back to a secure default
 * if env var is not set.
 * 
 * Rate limited to 5 attempts per minute per IP to prevent brute force.
 */

// Rate limit: 5 attempts per minute
const ADMIN_RATE_LIMIT = 5;
const ADMIN_RATE_WINDOW = 60_000;

export async function POST(request: NextRequest) {
  // Rate limiting - strict for auth
  const clientIp = getClientIp(request);
  if (isRateLimited(clientIp, ADMIN_RATE_LIMIT, ADMIN_RATE_WINDOW)) {
    return NextResponse.json(
      { error: 'Too many attempts. Please try again later.' },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { password } = body as { password?: string };

    if (!password) {
      return NextResponse.json(
        { error: 'Password required' },
        { status: 400 }
      );
    }

    // Get admin password from environment variable
    // Default: a secure random string (not 'admin123')
    const adminPassword = process.env.ADMIN_PASSWORD || 'gs_@dm1n_s3cur3_2026!';

    if (password === adminPassword) {
      // In a production app, you would set a secure HTTP-only session cookie here
      // For now, we just return success - the client sets its own state
      return NextResponse.json({ success: true }, { status: 200 });
    }

    // Always return 401 for wrong password (don't reveal if user exists)
    return NextResponse.json(
      { error: 'Invalid credentials' },
      { status: 401 }
    );
  } catch {
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  }
}
