import { NextResponse } from 'next/server';
import { warmupCaches } from '@/lib/daddylive-cache';

/**
 * Warmup API — pre-fetches the DaddyLive schedule + channels data into the SHARED cache.
 *
 * Called by the frontend on app load so the first "Watch Live" click is instant
 * (no 9s wait for schedule fetch on first call).
 *
 * GET /api/warmup
 */
export async function GET() {
  const start = Date.now();
  try {
    const ok = await warmupCaches();
    const elapsed = Date.now() - start;
    console.log(`[Warmup] Completed in ${elapsed}ms (ok=${ok})`);
    return NextResponse.json({ ok, elapsed });
  } catch (err) {
    console.warn('[Warmup] Error:', err);
    return NextResponse.json({ ok: false, error: 'warmup failed' }, { status: 200 });
  }
}
