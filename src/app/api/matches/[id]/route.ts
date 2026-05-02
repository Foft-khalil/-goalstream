import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * Verify admin access via custom header or API key.
 */
function verifyAdminAccess(request: NextRequest): boolean {
  const adminKey = process.env.ADMIN_PASSWORD || 'gs_@dm1n_s3cur3_2026!';
  const authHeader = request.headers.get('x-admin-key');
  const authCookie = request.cookies.get('admin_session')?.value;
  
  if (authHeader === adminKey) return true;
  if (authCookie === adminKey) return true;
  
  return false;
}

// PUT /api/matches/[id] - Update a match (admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Auth check
  if (!verifyAdminAccess(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { streamUrl, channelName, channelLogo, status, homeScore, awayScore } = body;

    // Check if match exists
    const existing = await db.match.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    const match = await db.match.update({
      where: { id },
      data: {
        ...(streamUrl !== undefined && { streamUrl }),
        ...(channelName !== undefined && { channelName }),
        ...(channelLogo !== undefined && { channelLogo }),
        ...(status !== undefined && { status }),
        ...(homeScore !== undefined && { homeScore: homeScore === null ? null : Number(homeScore) }),
        ...(awayScore !== undefined && { awayScore: awayScore === null ? null : Number(awayScore) }),
      },
    });

    return NextResponse.json(match);
  } catch (error) {
    console.error('Error updating match:', error);
    return NextResponse.json(
      { error: 'Failed to update match' },
      { status: 500 }
    );
  }
}

// DELETE /api/matches/[id] - Delete a match (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Auth check
  if (!verifyAdminAccess(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;

    // Check if match exists
    const existing = await db.match.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    await db.match.delete({ where: { id } });

    return NextResponse.json({ message: 'Match deleted successfully' });
  } catch (error) {
    console.error('Error deleting match:', error);
    return NextResponse.json(
      { error: 'Failed to delete match' },
      { status: 500 }
    );
  }
}
