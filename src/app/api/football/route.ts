import { NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
import { db } from '@/lib/db';
import { getCached, getCachedStale, setCache, getCacheAge } from '@/lib/football/cache';
import type { FootballMatch, FootballMatchesResponse } from '@/lib/football/types';

const CACHE_KEY = 'football-matches';

const SYSTEM_PROMPT = `You are a football data extraction assistant. You will be given search result snippets from multiple languages (French, English, Spanish, Italian, German). Your job is to extract ALL real football/soccer matches mentioned and return them as a JSON array.

Each match object must have:
- id (string, create like "team1_vs_team2")
- homeTeam (string, full team name - translate to English if in another language, e.g. "OL" → "Lyon", "Bayern (M)" → "Bayern Munich")
- awayTeam (string, full team name)
- homeScore (number or null if match hasn't started)
- awayScore (number or null if match hasn't started)
- status: "live" if currently playing (shows minute like 45', 67', HT), "upcoming" if not yet started (shows time only), "finished" if ended (shows FT, Full Time, or a completed score)
- minute (number or null, only for live matches - extract the current minute if shown like 45', 67', etc. For "HT" use 45)
- competition (string, league/competition name in English like "Premier League", "Ligue 1", "Champions League", "La Liga", "Serie A", "Bundesliga", etc.)
- matchDate (ISO date string or null - use today's date if not specified)

IMPORTANT RULES:
- Extract matches even from partial data. For example, "Brest 3-3 OL" → {homeTeam: "Brest", awayTeam: "Lyon", homeScore: 3, awayScore: 3, status: "finished"}
- Look for score patterns like "3-2", "0-0", "1-0" in the snippets
- Be ACCURATE with scores. Only include a score if it's clearly shown.
- If a match shows "FT" or "Full Time" or "AET" or "Pen" or just a score, mark status as "finished"
- If a match shows a minute like "45'", "67'", "HT", mark status as "live"  
- If a match only shows a kickoff time like "15:00", "20:45", "03:30", mark status as "upcoming"
- Translate team abbreviations: OL→Lyon, PSG→Paris Saint-Germain, OMA→OMarseille, FCB→Barcelona, etc.
- Do NOT invent or hallucinate matches. Only extract what you can clearly see.
- Do NOT include any markdown formatting, code blocks, or explanation - just the raw JSON array.
- Today's date is ${new Date().toISOString().split('T')[0]}`;

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
  'France': '002395', 'Brazil': '009739', 'Argentina': '74ACDF',
  'Germany': '000000', 'Spain': 'C60A1D', 'England': 'FFFFFF',
  'Italy': '008C45', 'Portugal': '006600', 'Netherlands': 'FF6600',
  'Belgium': 'ED2939', 'Croatia': '171796', 'Uruguay': '5CBEFF',
  'Colombia': 'FCD116', 'Japan': 'BC002D', 'South Korea': '003478',
  'USA': '3C3B6E', 'Mexico': '006341', 'Canada': 'FF0000',
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
        matchDate: match.matchDate ? String(match.matchDate) : new Date().toISOString().split('T')[0],
      };
    });
  } catch {
    console.error('[Football API] Failed to parse LLM response as JSON');
    return [];
  }
}

/**
 * Get today's date formatted for search queries.
 */
function getTodayFormatted(): { full: string; short: string; iso: string } {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  return {
    full: now.toLocaleDateString('en-US', options),
    short: now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    iso: now.toISOString().split('T')[0],
  };
}

/**
 * Fetch football match data using z-ai-web-dev-sdk.
 * Strategy: Multi-language web_search + LLM extraction.
 * Uses French, Spanish, Italian, German queries to get match data from local-language sources
 * which tend to include more score details in their search snippets.
 */
async function fetchMatchData(): Promise<FootballMatch[]> {
  const zai = await ZAI.create();
  const today = getTodayFormatted();

  // Step 1: Web search with multi-language queries
  // Local-language queries return snippets with actual match scores
  console.log('[Football API] Step 1: Searching for live football scores (multi-language)...');
  const searchQueries = [
    `Ligue 1 résultats en direct scores aujourd'hui ${today.iso}`,
    `Premier League results today match scores ${today.iso}`,
    `La Liga resultados hoy marcadores ${today.iso}`,
    `Serie A risultati oggi punteggi ${today.iso}`,
    `Bundesliga Ergebnisse heute Spieltag ${today.iso}`,
    `football match results score goals ${today.short} champions league europa`,
  ];

  const allSnippets: string[] = [];

  for (let i = 0; i < searchQueries.length; i++) {
    try {
      const results = await zai.functions.invoke('web_search', {
        query: searchQueries[i],
        num: 6,
        recency_days: 1,
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
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    } catch (err) {
      console.warn(`[Football API] Search ${i + 1} failed:`, err);
    }
  }

  console.log(`[Football API] Collected ${allSnippets.length} search snippets`);

  // Fallback search if no data
  if (allSnippets.length === 0) {
    console.log('[Football API] No data found, trying fallback search...');
    try {
      const results = await zai.functions.invoke('web_search', {
        query: `football match scores results ${today.full}`,
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
    } catch (err) {
      console.warn('[Football API] Fallback search failed:', err);
    }
  }

  if (allSnippets.length === 0) {
    console.warn('[Football API] No search results found');
    return [];
  }

  // Step 2: Use LLM to extract structured match data from snippets
  console.log('[Football API] Step 2: Extracting match data with LLM...');

  const userPrompt = `Today is ${today.full} (${today.iso}).

SEARCH RESULTS SNIPPETS (from multiple languages):
${allSnippets.join('\n\n')}

Extract ALL real football/soccer matches from these search results. Look for team names, scores (like "3-2", "0-0", "1-0"), and competition names. Even partial data like "Brest 3-3" should be extracted. Return ONLY a valid JSON array of match objects.`;

  try {
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
  } catch (err) {
    console.error('[Football API] LLM extraction failed:', err);
    return [];
  }
}

/**
 * GET /api/football - Returns current football match data from AI search.
 * Results are cached for 3 minutes.
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
          error: 'Les données peuvent être anciennes en raison d\'une erreur de chargement',
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
      error: error instanceof Error ? error.message : 'Impossible de charger les données des matchs',
    };

    return NextResponse.json(emptyResponse, { status: 200 });
  }
}
