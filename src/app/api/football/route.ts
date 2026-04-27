import { NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
import { db } from '@/lib/db';
import { getCached, getCachedStale, setCache, getCacheAge } from '@/lib/football/cache';
import type { FootballMatch, FootballMatchesResponse } from '@/lib/football/types';

const CACHE_KEY = 'football-matches';

const SYSTEM_PROMPT = `You are a football data extraction assistant. Extract all football/soccer matches from the provided search results. Return ONLY a valid JSON array. Each match should have:
- id (string, create a unique id like "team1_vs_team2")
- homeTeam (string)
- awayTeam (string)
- homeScore (number or null if match hasn't started)
- awayScore (number or null if match hasn't started)
- status ("live" if currently playing, "upcoming" if not started, "finished" if ended)
- minute (number or null, only for live matches)
- competition (string like "Premier League", "Ligue 1", "Champions League", etc.)
- matchDate (ISO date string or null)

Be accurate - only include real matches you can identify from the search snippets. If a score is mentioned, include it. If a match is described as "FT" or "Full Time", mark it as finished. If a match has a current minute mentioned, mark it as live. Do NOT include any markdown formatting, code blocks, or explanation - just the raw JSON array.`;

/**
 * Enrich matches with stream assignments from the database.
 */
async function enrichWithStreams(matches: FootballMatch[]): Promise<FootballMatch[]> {
  if (matches.length === 0) return matches;

  try {
    const dbMatches = await db.match.findMany({
      where: { streamUrl: { not: null } },
    });

    const streamMap = new Map<string, { streamUrl: string; channelName: string | null; channelLogo: string | null }>();

    for (const dbMatch of dbMatches) {
      const key = `${dbMatch.homeTeam.toLowerCase()}|${dbMatch.awayTeam.toLowerCase()}`;
      streamMap.set(key, {
        streamUrl: dbMatch.streamUrl!,
        channelName: dbMatch.channelName,
        channelLogo: dbMatch.channelLogo,
      });
    }

    return matches.map((match) => {
      const key = `${match.homeTeam.toLowerCase()}|${match.awayTeam.toLowerCase()}`;
      const stream = streamMap.get(key);
      return {
        ...match,
        streamUrl: stream?.streamUrl ?? null,
        channelName: stream?.channelName ?? null,
        channelLogo: stream?.channelLogo ?? null,
      };
    });
  } catch {
    // DB might not be available
    return matches;
  }
}

/**
 * Generate team logo URL using ui-avatars.com as fallback.
 */
function generateLogoUrl(teamName: string, color: string): string {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(teamName.slice(0, 2).toUpperCase())}&background=${color}&color=fff&size=64&bold=true`;
}

const TEAM_COLORS: Record<string, string> = {
  // Premier League
  'Arsenal': 'EF0107', 'Aston Villa': '670E36', 'Bournemouth': 'DA291C', 'Brentford': 'e30613',
  'Brighton': '0057B8', 'Chelsea': '034694', 'Crystal Palace': '1B458F', 'Everton': '003399',
  'Fulham': '000000', 'Ipswich': '0033A0', 'Leicester': '003090', 'Liverpool': 'C8102E',
  'Man City': '6CABDD', 'Man Utd': 'DA291C', 'Newcastle': '241F20', 'Nottm Forest': 'DD0000',
  'Southampton': 'D71920', 'Tottenham': '132257', 'West Ham': '7A263A', 'Wolves': 'FDB913',
  // Ligue 1
  'PSG': '004170', 'Paris Saint-Germain': '004170', 'Marseille': '2FAEE0', 'Lyon': '1A3C7B',
  'Monaco': 'E7192C', 'Lille': 'E2001A', 'Nice': 'CC0000', 'Rennes': 'E2001A',
  'Lens': 'FFD700', 'Strasbourg': '005BA9', 'Montpellier': 'FF6900', 'Nantes': 'FCDD09',
  'Toulouse': '7B2D8E', 'Reims': 'E2001A', 'Brest': 'E2001A', 'Angers': '1C3D5A',
  'Le Havre': '0055A4', 'Lorient': 'F47920', 'Metz': '7A003C', 'Auxerre': '0066B3',
  // La Liga
  'Real Madrid': 'FEBE10', 'Barcelona': 'A50044', 'Atletico Madrid': 'CB3524',
  'Real Sociedad': '143C8B', 'Villarreal': 'FFE114', 'Betis': '00954C',
  'Athletic Bilbao': 'EE2523', 'Sevilla': 'D40E27', 'Valencia': 'EE3524',
  // Serie A
  'Inter Milan': '0068A8', 'AC Milan': 'FB090B', 'Juventus': '000000',
  'Napoli': '12A0D7', 'Roma': '8E1F2F', 'Lazio': '87D8F7',
  'Atalanta': '1E71B8', 'Fiorentina': '5B2C8A', 'Udinese': '1A1A1A',
  'Cagliari': '92001A', 'Torino': '8B0000',
  // Bundesliga
  'Bayern Munich': 'DC052D', 'Dortmund': 'FDE100', 'Leverkusen': 'E32221',
  'RB Leipzig': 'DD0741', 'Stuttgart': 'E32219', 'Frankfurt': 'E1000F',
  // Champions League / International
  'Benfica': 'FF0000', 'Porto': '003399', 'Sporting CP': '00843D',
  'Ajax': 'D2122E', 'PSV': 'ED1C24', 'Feyenoord': 'ED1C24',
  'Celtic': '007A3D', 'Rangers': '003B7A',
  'Salzburg': 'E2001A', 'Shakhtar': 'F47920',
  'Morocco': 'C1272D', 'Senegal': '006A4E', 'Algeria': '006633',
  'Tunisia': 'E70013', 'Egypt': 'C8102E',
};

/**
 * Parse the LLM response to extract the JSON array of matches.
 */
function parseMatchesResponse(llmContent: string): FootballMatch[] {
  let jsonStr = llmContent.trim();

  // Remove markdown code blocks if present
  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim();
  }

  // Try to find a JSON array in the response
  const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    jsonStr = arrayMatch[0];
  }

  try {
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) return [];

    return parsed.map((match: Record<string, unknown>) => {
      const homeTeam = String(match.homeTeam || 'Unknown');
      const awayTeam = String(match.awayTeam || 'Unknown');

      return {
        id: String(match.id || `${homeTeam.replace(/\s/g, '_')}_vs_${awayTeam.replace(/\s/g, '_')}`),
        homeTeam,
        awayTeam,
        homeScore: typeof match.homeScore === 'number' ? match.homeScore : null,
        awayScore: typeof match.awayScore === 'number' ? match.awayScore : null,
        status: ['live', 'upcoming', 'finished'].includes(String(match.status))
          ? (String(match.status) as FootballMatch['status'])
          : 'upcoming',
        minute: typeof match.minute === 'number' ? match.minute : null,
        competition: String(match.competition || 'Football'),
        homeLogo: match.homeLogo ? String(match.homeLogo) : generateLogoUrl(homeTeam, TEAM_COLORS[homeTeam] || '444444'),
        awayLogo: match.awayLogo ? String(match.awayLogo) : generateLogoUrl(awayTeam, TEAM_COLORS[awayTeam] || '666666'),
        matchDate: match.matchDate ? String(match.matchDate) : null,
      };
    });
  } catch {
    console.error('[Football API] Failed to parse LLM response as JSON');
    return [];
  }
}

/**
 * Fetch football match data using z-ai-web-dev-sdk web search.
 * Uses sequential searches with delay to avoid rate limiting.
 */
async function fetchMatchData(): Promise<FootballMatch[]> {
  const zai = await ZAI.create();

  const searchQueries = [
    'premier league ligue 1 champions league scores results today',
    'la liga serie a bundesliga football scores fixtures today',
  ];

  // Run searches sequentially with delay to avoid rate limiting
  console.log('[Football API] Searching for match data...');
  const allSnippets: string[] = [];

  for (let i = 0; i < searchQueries.length; i++) {
    try {
      const results = await zai.functions.invoke('web_search', {
        query: searchQueries[i],
        num: 10,
      });

      if (Array.isArray(results)) {
        for (const result of results) {
          if (result && typeof result === 'object') {
            const snippet = result.snippet || '';
            const name = result.name || '';
            if (snippet || name) {
              allSnippets.push(`${name}: ${snippet}`);
            }
          }
        }
      }

      // Delay between searches to avoid rate limiting
      if (i < searchQueries.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } catch (err) {
      console.warn(`[Football API] Search ${i + 1} failed:`, err);
    }
  }

  if (allSnippets.length === 0) {
    console.warn('[Football API] No search results found');
    return [];
  }

  console.log(`[Football API] Collected ${allSnippets.length} search snippets`);

  // Build the user prompt with search snippets
  const userPrompt = `Here are football/soccer search results from today. Extract all real matches mentioned - scores, fixtures, and results.

SEARCH RESULTS:
${allSnippets.join('\n\n')}

Extract all football/soccer matches from these search results. Include the actual scores if mentioned. Return ONLY a valid JSON array of match objects.`;

  // Use LLM to extract structured data
  console.log('[Football API] Extracting match data with LLM...');
  const completion = await zai.chat.completions.create({
    messages: [
      { role: 'assistant', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    thinking: { type: 'disabled' },
  });

  const llmContent = completion.choices[0]?.message?.content || '[]';
  console.log('[Football API] LLM response length:', llmContent.length);

  const matches = parseMatchesResponse(llmContent);
  console.log(`[Football API] Extracted ${matches.length} matches`);

  // Deduplicate matches by team names
  const seen = new Set<string>();
  const dedupedMatches = matches.filter((match) => {
    const key = `${match.homeTeam.toLowerCase()}|${match.awayTeam.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return dedupedMatches;
}

/**
 * GET /api/football - Returns current football match data from AI search.
 * Results are cached for 5 minutes.
 */
export async function GET() {
  try {
    // Check cache first
    const cached = getCached<FootballMatchesResponse>(CACHE_KEY);
    if (cached) {
      const age = getCacheAge(CACHE_KEY);
      console.log(`[Football API] Returning cached data (age: ${age}s)`);
      return NextResponse.json(cached, {
        headers: { 'X-Cache': 'HIT', 'X-Cache-Age': String(age) },
      });
    }

    // Fetch fresh data
    console.log('[Football API] Fetching fresh match data...');
    const matches = await fetchMatchData();

    // Enrich with stream data from the database
    const enrichedMatches = await enrichWithStreams(matches);

    const response: FootballMatchesResponse = {
      matches: enrichedMatches,
      lastUpdated: new Date().toISOString(),
      source: 'ai-search',
    };

    // Cache the result
    setCache(CACHE_KEY, response);

    return NextResponse.json(response, {
      headers: { 'X-Cache': 'MISS' },
    });
  } catch (error) {
    console.error('[Football API] Error fetching match data:', error);

    // Try to return stale cache on error
    const stale = getCachedStale<FootballMatchesResponse>(CACHE_KEY);
    if (stale) {
      console.log('[Football API] Returning stale cache due to error');
      return NextResponse.json(
        {
          ...stale,
          error: 'Data may be stale due to a fetch error',
        },
        {
          headers: { 'X-Cache': 'STALE' },
        }
      );
    }

    // No cache available, return empty response with error info
    const emptyResponse: FootballMatchesResponse = {
      matches: [],
      lastUpdated: new Date().toISOString(),
      source: 'ai-search',
      error: error instanceof Error ? error.message : 'Failed to fetch match data',
    };

    return NextResponse.json(emptyResponse, { status: 200 });
  }
}
