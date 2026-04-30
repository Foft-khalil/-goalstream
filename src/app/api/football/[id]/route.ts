import { NextRequest, NextResponse } from 'next/server';
// z-ai-web-dev-sdk is loaded dynamically to reduce initial compilation memory
import { db } from '@/lib/db';
import { getCached, getCachedStale, setCache, getCacheAge } from '@/lib/football/cache';
import type { MatchDetail, MatchDetailResponse, MatchEvent, MatchStat } from '@/lib/football/types';

const DETAIL_CACHE_PREFIX = 'football-detail';

const DETAIL_SYSTEM_PROMPT = `You are a football data extraction assistant. Extract detailed match information from the provided content. Return ONLY valid JSON with this structure:
{
  "lineups": { "home": ["Player1", "Player2", ...], "away": ["Player1", "Player2", ...] },
  "events": [
    { "minute": 45, "type": "goal|yellow_card|red_card|substitution|penalty|own_goal|var", "team": "home|away", "player": "Player Name", "detail": "optional detail" }
  ],
  "stats": [
    { "name": "Possession", "home": "60%", "away": "40%" }
  ]
}
Only include data you can clearly identify from the content. Use empty arrays if no data found. Do NOT include any markdown formatting, code blocks, or explanation - just the raw JSON object.`;

/**
 * Parse the LLM response for match detail.
 */
function parseDetailResponse(llmContent: string): Pick<MatchDetail, 'lineups' | 'events' | 'stats'> {
  let jsonStr = llmContent.trim();

  // Remove markdown code blocks if present
  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim();
  }

  // Try to find a JSON object in the response
  const objMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (objMatch) {
    jsonStr = objMatch[0];
  }

  try {
    const parsed = JSON.parse(jsonStr);
    const result: Pick<MatchDetail, 'lineups' | 'events' | 'stats'> = {
      lineups: { home: [], away: [] },
      events: [],
      stats: [],
    };

    // Parse lineups
    if (parsed.lineups && typeof parsed.lineups === 'object') {
      if (Array.isArray(parsed.lineups.home)) {
        result.lineups.home = parsed.lineups.home.map(String);
      }
      if (Array.isArray(parsed.lineups.away)) {
        result.lineups.away = parsed.lineups.away.map(String);
      }
    }

    // Parse events
    if (Array.isArray(parsed.events)) {
      result.events = parsed.events
        .filter((e: Record<string, unknown>) => e && typeof e === 'object')
        .map((e: Record<string, unknown>) => ({
          minute: typeof e.minute === 'number' ? e.minute : 0,
          type: (['goal', 'yellow_card', 'red_card', 'substitution', 'penalty', 'own_goal', 'var'].includes(String(e.type))
            ? String(e.type)
            : 'goal') as MatchEvent['type'],
          team: e.team === 'away' ? 'away' : 'home',
          player: String(e.player || 'Unknown'),
          detail: e.detail ? String(e.detail) : undefined,
        }));
    }

    // Parse stats
    if (Array.isArray(parsed.stats)) {
      result.stats = parsed.stats
        .filter((s: Record<string, unknown>) => s && typeof s === 'object')
        .map((s: Record<string, unknown>) => ({
          name: String(s.name || 'Unknown'),
          home: String(s.home || '0'),
          away: String(s.away || '0'),
        })) as MatchStat[];
    }

    return result;
  } catch {
    console.error('[Football Detail API] Failed to parse LLM response as JSON');
    return { lineups: { home: [], away: [] }, events: [], stats: [] };
  }
}

/**
 * GET /api/football/[id] - Returns detailed info about a specific match.
 * Uses the match ID to find the base match from cache or database,
 * then searches for more details using z-ai-web-dev-sdk.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const cacheKey = `${DETAIL_CACHE_PREFIX}-${id}`;

    // Check cache first
    const cached = getCached<MatchDetailResponse>(cacheKey);
    if (cached) {
      const age = getCacheAge(cacheKey);
      console.log(`[Football Detail API] Returning cached detail for ${id} (age: ${age}s)`);
      return NextResponse.json(cached, {
        headers: { 'X-Cache': 'HIT', 'X-Cache-Age': String(age) },
      });
    }

    // Find the base match from the database or from the matches cache
    let homeTeam = '';
    let awayTeam = '';
    let baseMatch: MatchDetail | null = null;

    // Try to find in database first
    const dbMatch = await db.match.findUnique({ where: { id } });
    if (dbMatch) {
      homeTeam = dbMatch.homeTeam;
      awayTeam = dbMatch.awayTeam;
      baseMatch = {
        id: dbMatch.id,
        homeTeam: dbMatch.homeTeam,
        awayTeam: dbMatch.awayTeam,
        homeScore: dbMatch.homeScore,
        awayScore: dbMatch.awayScore,
        status: dbMatch.status as MatchDetail['status'],
        minute: null,
        competition: dbMatch.competition || 'Unknown',
        homeLogo: dbMatch.homeLogo,
        awayLogo: dbMatch.awayLogo,
        matchDate: dbMatch.matchDate.toISOString(),
        streamUrl: dbMatch.streamUrl,
        channelName: dbMatch.channelName,
        channelLogo: dbMatch.channelLogo,
      };
    } else {
      // Try to find in the football matches cache
      const matchesCache = getCachedStale<{ matches: MatchDetail[] }>('football-matches');
      if (matchesCache?.matches) {
        const found = matchesCache.matches.find((m) => m.id === id);
        if (found) {
          homeTeam = found.homeTeam;
          awayTeam = found.awayTeam;
          baseMatch = found;
        }
      }
    }

    if (!baseMatch || !homeTeam || !awayTeam) {
      return NextResponse.json(
        { error: 'Match not found', id },
        { status: 404 }
      );
    }

    // Search for detailed match info using z-ai-web-dev-sdk
    console.log(`[Football Detail API] Fetching details for ${homeTeam} vs ${awayTeam}...`);
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    const zai = await ZAI.create();

    const searchQuery = `${homeTeam} vs ${awayTeam} live score match details lineup events`;
    const searchResults = await zai.functions.invoke('web_search', {
      query: searchQuery,
      num: 5,
    });

    const searchContent = typeof searchResults === 'string'
      ? searchResults
      : JSON.stringify(searchResults);

    // Try to read a relevant page for detailed info
    let pageContent = '';
    try {
      const searchObj = typeof searchResults === 'string' ? null : searchResults as { results?: Array<{ url?: string }> };
      const urls: string[] = [];

      if (searchObj && Array.isArray(searchObj.results)) {
        for (const result of searchObj.results) {
          if (result.url) urls.push(result.url);
        }
      }

      if (urls.length > 0) {
        console.log('[Football Detail API] Reading page:', urls[0]);
        const pageData = await zai.functions.invoke('page_reader', {
          url: urls[0],
        });
        pageContent = typeof pageData === 'string'
          ? pageData
          : (pageData as { content?: string })?.content || JSON.stringify(pageData);
      }
    } catch (err) {
      console.warn('[Football Detail API] Failed to read detail page:', err);
    }

    // Use LLM to extract detailed match info
    const userPrompt = `Here is data about the football match ${homeTeam} vs ${awayTeam}. Extract detailed match information.

SEARCH RESULTS:
${searchContent.slice(0, 8000)}

${pageContent ? `MATCH DETAIL PAGE:\n${pageContent.slice(0, 12000)}` : ''}

Extract lineups, events (goals, cards, substitutions), and match statistics. Return ONLY valid JSON.`;

    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: DETAIL_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      thinking: { type: 'disabled' },
    });

    const llmContent = completion.choices[0]?.message?.content || '{}';
    const detailData = parseDetailResponse(llmContent);

    // Merge base match with extracted details
    const matchDetail: MatchDetail = {
      ...baseMatch,
      lineups: detailData.lineups,
      events: detailData.events,
      stats: detailData.stats,
    };

    const response: MatchDetailResponse = {
      match: matchDetail,
      lastUpdated: new Date().toISOString(),
      source: 'ai-search',
    };

    // Cache the result
    setCache(cacheKey, response);

    return NextResponse.json(response, {
      headers: { 'X-Cache': 'MISS' },
    });
  } catch (error) {
    console.error('[Football Detail API] Error:', error);

    // Try stale cache
    const cacheKey = `${DETAIL_CACHE_PREFIX}-${id}`;
    const stale = getCachedStale<MatchDetailResponse>(cacheKey);
    if (stale) {
      return NextResponse.json(
        { ...stale, error: 'Data may be stale due to a fetch error' },
        { headers: { 'X-Cache': 'STALE' } }
      );
    }

    return NextResponse.json(
      {
        match: null,
        lastUpdated: new Date().toISOString(),
        source: 'ai-search' as const,
        error: error instanceof Error ? error.message : 'Failed to fetch match details',
      },
      { status: 200 }
    );
  }
}
