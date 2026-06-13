import { NextRequest, NextResponse } from 'next/server';

// Health check for stream URLs - uses HEAD request with timeout
export async function POST(request: NextRequest) {
  try {
    const { urls } = await request.json();

    if (!urls || !Array.isArray(urls)) {
      return NextResponse.json({ error: 'urls array required' }, { status: 400 });
    }

    // Check up to 10 URLs at a time
    const batch = urls.slice(0, 10);

    const results = await Promise.allSettled(
      batch.map(async (url: string) => {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 8000); // 8s timeout

          const res = await fetch(url, {
            method: 'HEAD',
            signal: controller.signal,
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; GoalStream/1.0)',
            },
          });

          clearTimeout(timeout);

          return {
            url,
            status: res.ok ? 'online' as const : 'offline' as const,
            statusCode: res.status,
          };
        } catch(_e) {
          return {
            url,
            status: 'offline' as const,
            statusCode: 0,
          };
        }
      })
    );

    const data = results.map((r) =>
      r.status === 'fulfilled' ? r.value : { url: '', status: 'offline' as const, statusCode: 0 }
    );

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in /api/channels-check:', error);
    return NextResponse.json({ error: 'Failed to check channels' }, { status: 500 });
  }
}
