import { NextResponse } from 'next/server';

/**
 * Seed endpoint - no longer creates fake matches.
 * Match data is now fetched in real-time from the football API.
 */
export async function POST() {
  return NextResponse.json({
    success: true,
    message: 'Live match data is now fetched in real-time from the football API. No seeding needed.',
  });
}
