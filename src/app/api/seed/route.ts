import { NextResponse } from 'next/server';
import { seedMatches } from '@/lib/seed';

export async function POST() {
  try {
    await seedMatches();
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to seed' }, { status: 500 });
  }
}
