import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

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

// POST /api/matches - Create a new match
export async function POST(request: NextRequest) {
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
