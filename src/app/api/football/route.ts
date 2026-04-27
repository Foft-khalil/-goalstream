import { NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
import { getCached, getCachedStale, setCache, getCacheAge } from '@/lib/football/cache';
import type { FootballMatch, FootballMatchesResponse } from '@/lib/football/types';

const CACHE_KEY = 'football-matches';

const TEAM_COLORS: Record<string, string> = {
  // Premier League
  'Arsenal': 'EF0107', 'Aston Villa': '670E36', 'Bournemouth': 'DA291C', 'Brentford': 'e30613',
  'Brighton': '0057B8', 'Chelsea': '034694', 'Crystal Palace': '1B458F', 'Everton': '003399',
  'Fulham': '000000', 'Ipswich': '0033A0', 'Leicester': '003090', 'Liverpool': 'C8102E',
  'Man City': '6CABDD', 'Man Utd': 'DA291C', 'Manchester United': 'DA291C', 'Newcastle': '241F20',
  'Nottm Forest': 'DD0000', 'Southampton': 'D71920', 'Tottenham': '132257', 'West Ham': '7A263A',
  'Wolves': 'FDB913',
  // Ligue 1
  'PSG': '004170', 'Paris Saint-Germain': '004170', 'Marseille': '2FAEE0', 'Lyon': '1A3C7B',
  'Monaco': 'E7192C', 'Lille': 'E2001A', 'Nice': 'CC0000', 'Rennes': 'E2001A',
  'Lens': 'FFD700', 'Strasbourg': '005BA9', 'Montpellier': 'FF6900', 'Nantes': 'FCDD09',
  'Toulouse': '7B2D8E', 'Reims': 'E2001A', 'Brest': 'E2001A', 'Angers': '1C3D5A',
  'Le Havre': '0055A4', 'Lorient': 'F47920', 'Metz': '7A003C', 'Auxerre': '0066B3',
  'Saint-Étienne': '009E60', 'Paris FC': '003399', 'LOSC': 'E2001A',
  // La Liga
  'Real Madrid': 'FEBE10', 'Barcelona': 'A50044', 'Atletico Madrid': 'CB3524',
  'Real Sociedad': '143C8B', 'Villarreal': 'FFE114', 'Betis': '00954C',
  'Athletic Bilbao': 'EE2523', 'Sevilla': 'D40E27', 'Valencia': 'EE3524',
  'Girona': 'CD2633', 'Osasuna': 'C60001', 'Celta Vigo': '8AC3EE',
  'Mallorca': 'E20613', 'Getafe': '004999', 'Rayo Vallecano': 'E53027',
  'Las Palmas': 'FFE400', 'Alaves': '003DA5', 'Cadiz': 'FFE100', 'Granada': 'A31C3E',
  // Serie A
  'Inter Milan': '0068A8', 'Inter': '0068A8', 'AC Milan': 'FB090B', 'Milan': 'FB090B',
  'Juventus': '000000', 'Napoli': '12A0D7', 'Roma': '8E1F2F', 'Lazio': '87D8F7',
  'Atalanta': '1E71B8', 'Fiorentina': '5B2C8A', 'Udinese': '1A1A1A',
  'Cagliari': '92001A', 'Torino': '8B0000', 'Bologna': 'A11E22',
  'Monza': 'CE0E2D', 'Lecce': 'FFE500', 'Genoa': '9E1B32',
  'Empoli': '005BA9', 'Verona': '003DA5',
  // Bundesliga
  'Bayern Munich': 'DC052D', 'Bayern': 'DC052D', 'Dortmund': 'FDE100',
  'Leverkusen': 'E32221', 'RB Leipzig': 'DD0741', 'Stuttgart': 'E32219',
  'Frankfurt': 'E1000F', 'Wolfsburg': '65B32E', 'Freiburg': '000000',
  'Hoffenheim': '0053A0', 'Union Berlin': 'EB1923', 'Mainz': 'C3141E',
  'Augsburg': 'BA3733', 'Werder Bremen': '1D9053', 'Bochum': '005BA9',
  'Heidenheim': 'E30613', 'Darmstadt': '004E9E',
  // Champions League / International / Other
  'Benfica': 'FF0000', 'Porto': '003399', 'Sporting CP': '00843D',
  'Ajax': 'D2122E', 'PSV': 'ED1C24', 'Feyenoord': 'ED1C24',
  'Celtic': '007A3D', 'Rangers': '003B7A',
  'Salzburg': 'E2001A', 'Shakhtar': 'F47920',
  'Club Brugge': '0055A4', 'Anderlecht': '7B0098',
  'Fenerbahce': 'FFED00', 'Galatasaray': 'FF0000', 'Besiktas': '000000',
  'Morocco': 'C1272D', 'Senegal': '006A4E', 'Algeria': '006633',
  'Tunisia': 'E70013', 'Egypt': 'C8102E',
  'France': '002395', 'Brazil': '009739', 'Argentina': '74ACDF',
  'Germany': '000000', 'Spain': 'C60A1D', 'England': 'FFFFFF',
  'Italy': '008C45', 'Portugal': '006600', 'Netherlands': 'FF6600',
  'Belgium': 'ED2939', 'Croatia': '171796', 'Uruguay': '5CBEFF',
  'Colombia': 'FCD116', 'Japan': 'BC002D', 'South Korea': '003478',
  'USA': '3C3B6E', 'Mexico': '006341', 'Canada': 'FF0000',
};

function generateLogoUrl(teamName: string, color: string): string {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(teamName.slice(0, 2).toUpperCase())}&background=${color}&color=fff&size=64&bold=true`;
}

const SYSTEM_PROMPT = `You are a football match data extraction assistant. You will be given search result snippets about football matches happening TODAY. Extract ALL real football/soccer matches mentioned and return a JSON array.

Each match object must have:
- id (string, like "team1_vs_team2")
- homeTeam (string, full team name - translate abbreviations: OL→Lyon, PSG→Paris Saint-Germain, FCB→Barcelona, OMA→Marseille, MUFC→Manchester United)
- awayTeam (string, full team name)
- homeScore (number or null - MUST be null if match has NOT started yet)
- awayScore (number or null - MUST be null if match has NOT started yet)
- status: "live" | "upcoming"
- minute (number or null, ONLY for live matches. "HT"→45)
- competition (string, league name)
- matchDate (ISO date string with kickoff time, e.g. "2025-03-04T21:00:00Z")

CRITICAL STATUS RULES:
- "live" = CURRENTLY PLAYING RIGHT NOW. Must have a minute indicator (e.g. 45', 67', HT). Both scores MUST be numbers.
- "upcoming" = MATCH HAS NOT STARTED YET. Shows kickoff time ONLY. homeScore and awayScore MUST be null.
- Do NOT include matches that have already finished (FT, Full Time, Terminé, Final). SKIP those entirely.
- Do NOT include matches from yesterday or previous days. ONLY today's matches.

CRITICAL SCORE RULES:
- For "upcoming" matches: homeScore MUST be null, awayScore MUST be null.
- For "live" matches: Both homeScore and awayScore MUST be numbers (0 is valid).
- If you are NOT 100% CERTAIN about the score, set both to null and status to "upcoming".
- NEVER assign a score like 0-0 to an upcoming match.

RULES:
- Both homeTeam AND awayTeam must be real team names, NEVER "Opponent", "Unknown", "TBD", "TBA"
- If you can only identify one team, skip that match
- Translate abbreviations to full names
- Include the competition/league name when available
- Do NOT invent matches that are not mentioned in the search results
- Do NOT invent scores
- Return ONLY the raw JSON array, no markdown or explanation`;

/**
 * Parse the LLM response to extract the JSON array of matches.
 */
function parseMatchesResponse(llmContent: string): FootballMatch[] {
  let jsonStr = llmContent.trim();
  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) jsonStr = codeBlockMatch[1].trim();
  const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
  if (arrayMatch) jsonStr = arrayMatch[0];

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
        status: ['live', 'upcoming'].includes(String(match.status))
          ? (String(match.status) as FootballMatch['status']) : 'upcoming',
        minute: typeof match.minute === 'number' ? match.minute : null,
        competition: String(match.competition || 'Football'),
        homeLogo: match.homeLogo ? String(match.homeLogo) : generateLogoUrl(homeTeam, TEAM_COLORS[homeTeam] || '444444'),
        awayLogo: match.awayLogo ? String(match.awayLogo) : generateLogoUrl(awayTeam, TEAM_COLORS[awayTeam] || '666666'),
        matchDate: match.matchDate ? String(match.matchDate) : new Date().toISOString().split('T')[0],
      };
    });
  } catch {
    console.error('[Football API] Failed to parse LLM response');
    return [];
  }
}

/**
 * Sleep helper for rate limiting
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch football match data for TODAY ONLY using z-ai-web-dev-sdk.
 */
async function fetchMatchData(): Promise<FootballMatch[]> {
  const zai = await ZAI.create();
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const timeStr = today.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });

  // Get day name in French for better search results
  const dayNames = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const dayName = dayNames[today.getDay()];

  console.log(`[Football API] Fetching TODAY's matches for ${todayStr} (${dayName}) at ${timeStr}...`);

  // Search specifically for TODAY's fixtures only
  const searchQueries = [
    `football matches today ${todayStr} ${dayName} kickoff times premier league ligue 1 la liga serie a bundesliga champions league`,
    `match football ${dayName} ${todayStr} programme horaires aujourd'hui ligue 1 championnat`,
    `soccer fixtures today ${todayStr} schedule kickoff times`,
  ];

  const allSnippets: string[] = [];

  for (let i = 0; i < searchQueries.length; i++) {
    try {
      console.log(`[Football API] Search ${i + 1}/${searchQueries.length}...`);
      const results = await zai.functions.invoke('web_search', {
        query: searchQueries[i],
        num: 8,
        recency_days: 1,
      });

      if (Array.isArray(results)) {
        for (const item of results) {
          if (item && typeof item === 'object') {
            const snippet = item.snippet || '';
            const name = item.name || '';
            if (snippet || name) {
              allSnippets.push(`${name}: ${snippet}`);
            }
          }
        }
      }

      if (i < searchQueries.length - 1) {
        await sleep(2500);
      }
    } catch (err: any) {
      if (err?.message?.includes('429')) {
        console.warn(`[Football API] Rate limited on search ${i + 1}, waiting 5s...`);
        await sleep(5000);
        try {
          const results = await zai.functions.invoke('web_search', {
            query: searchQueries[i],
            num: 8,
            recency_days: 1,
          });
          if (Array.isArray(results)) {
            for (const item of results) {
              if (item && typeof item === 'object') {
                const snippet = item.snippet || '';
                const name = item.name || '';
                if (snippet || name) allSnippets.push(`${name}: ${snippet}`);
              }
            }
          }
        } catch {
          console.warn(`[Football API] Retry failed for search ${i + 1}, skipping`);
        }
      } else {
        console.warn(`[Football API] Search ${i + 1} failed:`, err?.message || err);
      }
    }
  }

  console.log(`[Football API] Collected ${allSnippets.length} search snippets`);

  if (allSnippets.length === 0) {
    console.warn('[Football API] No search results found');
    return [];
  }

  console.log('[Football API] Extracting match data with LLM...');

  const userPrompt = `Today is ${todayStr} (${dayName}). Current time: ${timeStr} (Paris timezone).

IMPORTANT: Extract ONLY matches happening TODAY. Do NOT include finished matches. Do NOT include matches from other days.

SEARCH RESULTS:
${allSnippets.join('\n\n')}

Extract ONLY today's football matches that are either LIVE or UPCOMING.
- "live" = currently playing (has minute indicator). MUST have numeric scores.
- "upcoming" = has not started yet (shows kickoff time). Scores MUST be null.
- SKIP any match that is finished (FT, Full Time, Terminé, Final).
- SKIP any match from a different day.

Return ONLY a JSON array.`;

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
    console.log(`[Football API] Extracted ${matches.length} raw matches`);

    // Deduplicate
    const seen = new Set<string>();
    const dedupedMatches = matches.filter((match) => {
      const key = `${match.homeTeam.toLowerCase()}|${match.awayTeam.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Validate and clean up - ONLY live and upcoming, NO finished
    const validated = dedupedMatches
      .filter((match) => {
        // Filter out matches with placeholder team names
        const lowerHome = match.homeTeam.toLowerCase();
        const lowerAway = match.awayTeam.toLowerCase();
        const badNames = ['opponent', 'unknown', 'tbd', 'tba', 'vs'];
        if (badNames.some((bad) => lowerHome.includes(bad) || lowerAway.includes(bad))) {
          return false;
        }
        // Only keep live and upcoming
        if (match.status === 'finished') return false;
        return true;
      })
      .map((match) => {
        // Force upcoming status if no score and no minute
        if (match.status === 'live' && match.homeScore === null && match.awayScore === null && match.minute === null) {
          return { ...match, status: 'upcoming' as const };
        }
        // Ensure upcoming matches have null scores
        if (match.status === 'upcoming') {
          return { ...match, homeScore: null, awayScore: null, minute: null };
        }
        return match;
      });

    // Sort: live first, then upcoming by time
    const statusOrder = { live: 0, upcoming: 1, finished: 2 };
    validated.sort((a, b) => {
      const statusDiff = (statusOrder[a.status] ?? 1) - (statusOrder[b.status] ?? 1);
      if (statusDiff !== 0) return statusDiff;
      const dateA = a.matchDate ? new Date(a.matchDate).getTime() : Infinity;
      const dateB = b.matchDate ? new Date(b.matchDate).getTime() : Infinity;
      return dateA - dateB;
    });

    console.log(`[Football API] Returning ${validated.length} matches (live: ${validated.filter(m => m.status === 'live').length}, upcoming: ${validated.filter(m => m.status === 'upcoming').length})`);

    return validated;
  } catch (err: any) {
    console.error('[Football API] LLM extraction failed:', err?.message || err);
    return [];
  }
}

/**
 * GET /api/football - Returns today's football match data from AI search.
 * Only returns live + upcoming matches (no finished).
 * Results are cached for 2 minutes.
 */
export async function GET() {
  try {
    const cached = getCached<FootballMatchesResponse>(CACHE_KEY);
    if (cached) {
      const age = getCacheAge(CACHE_KEY);
      console.log(`[Football API] Returning cached data (age: ${age}s)`);
      return NextResponse.json(cached, {
        headers: { 'X-Cache': 'HIT', 'X-Cache-Age': String(age) },
      });
    }

    const matches = await fetchMatchData();

    const response: FootballMatchesResponse = {
      matches,
      lastUpdated: new Date().toISOString(),
      source: 'ai-search',
    };

    setCache(CACHE_KEY, response);

    return NextResponse.json(response, {
      headers: { 'X-Cache': 'MISS' },
    });
  } catch (error) {
    console.error('[Football API] Error fetching match data:', error);

    const stale = getCachedStale<FootballMatchesResponse>(CACHE_KEY);
    if (stale) {
      console.log('[Football API] Returning stale cache due to error');
      return NextResponse.json(
        { ...stale, error: 'Les données peuvent être anciennes' },
        { headers: { 'X-Cache': 'STALE' } }
      );
    }

    const emptyResponse: FootballMatchesResponse = {
      matches: [],
      lastUpdated: new Date().toISOString(),
      source: 'ai-search',
      error: error instanceof Error ? error.message : 'Impossible de charger les données',
    };

    return NextResponse.json(emptyResponse, { status: 200 });
  }
}
