import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isRateLimited, getClientIp } from '@/lib/security';

/**
 * Verify admin access via custom header or API key.
 * In production, this should use proper session-based auth (next-auth).
 */
function verifyAdminAccess(request: NextRequest): boolean {
  const adminKey = process.env.ADMIN_PASSWORD || 'gs_@dm1n_s3cur3_2026!';
  const authHeader = request.headers.get('x-admin-key');
  const authCookie = request.cookies.get('admin_session')?.value;
  
  // Check custom header or cookie
  if (authHeader === adminKey) return true;
  if (authCookie === adminKey) return true;
  
  return false;
}

// GET /api/matches - Returns all matches, ordered by matchDate
export async function GET() {
  try {
    const matches = await db.match.findMany({
      orderBy: {
        matchDate: 'asc',
      },
    });

    return NextResponse.json(matches);
  } catch (error) {
    console.error('Error fetching matches:', error);
    return NextResponse.json(
      { error: 'Failed to fetch matches' },
      { status: 500 }
    );
  }
}

// POST /api/matches - Create a new match (admin only)
export async function POST(request: NextRequest) {
  // Auth check
  if (!verifyAdminAccess(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Rate limiting
  const clientIp = getClientIp(request);
  if (isRateLimited(clientIp, 30, 60_000)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }
  
  try {
    const body = await request.json();
    const { homeTeam, awayTeam, homeLogo, awayLogo, competition, matchDate, status } = body;

    // Validate required fields
    if (!homeTeam || !awayTeam || !matchDate) {
      return NextResponse.json(
        { error: 'homeTeam, awayTeam, and matchDate are required' },
        { status: 400 }
      );
    }

    const match = await db.match.create({
      data: {
        homeTeam,
        awayTeam,
        homeLogo: homeLogo || null,
        awayLogo: awayLogo || null,
        competition: competition || null,
        matchDate: new Date(matchDate),
        status: status || 'upcoming',
      },
    });

    return NextResponse.json(match, { status: 201 });
  } catch (error) {
    console.error('Error creating match:', error);
    return NextResponse.json(
      { error: 'Failed to create match' },
      { status: 500 }
    );
  }
}
