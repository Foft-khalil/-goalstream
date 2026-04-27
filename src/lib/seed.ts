import { db } from '@/lib/db';

/**
 * Seed function - no longer creates fake matches.
 * Match data is now fetched in real-time from the football API.
 * This file is kept for backwards compatibility.
 */
export async function seedMatches() {
  try {
    const existingCount = await db.match.count();
    console.log(`[Seed] ${existingCount} matches in database. Live match data comes from the football API.`);
  } catch (error) {
    console.error('Error checking matches:', error);
  }
}
