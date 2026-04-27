import { NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
import { db } from '@/lib/db';
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
  'Saint-Étienne': '009E60', 'Paris FC': '003399',
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
  'Empoli': '005BA9', 'Verona': '003DA5', 'Frosinone': 'FFD700',
  'Sassuolo': '00A850', 'Salernitana': '6A0032',
  // Bundesliga
  'Bayern Munich': 'DC052D', 'Bayern': 'DC052D', 'Dortmund': 'FDE100',
  'Leverkusen': 'E32221', 'RB Leipzig': 'DD0741', 'Stuttgart': 'E32219',
  'Frankfurt': 'E1000F', 'Wolfsburg': '65B32E', 'Freiburg': '000000',
  'Hoffenheim': '0053A0', 'Union Berlin': 'EB1923', 'Mainz': 'C3141E',
  'Augsburg': 'BA3733', 'Werder Bremen': '1D9053', 'Bochum': '005BA9',
  'Koln': 'ED1C24', 'Heidenheim': 'E30613', 'Darmstadt': '004E9E',
  // Champions League / International / Other
  'Benfica': 'FF0000', 'Porto': '003399', 'Sporting CP': '00843D',
  'Ajax': 'D2122E', 'PSV': 'ED1C24', 'Feyenoord': 'ED1C24',
  'Celtic': '007A3D', 'Rangers': '003B7A',
  'Salzburg': 'E2001A', 'Shakhtar': 'F47920',
  'Club Brugge': '0055A4', 'Bruges': '0055A4', 'Anderlecht': '7B0098',
  'Fenerbahce': 'FFED00', 'Galatasaray': 'FF0000', 'Besiktas': '000000',
  'Panathinaikos': '007934', 'Olympiacos': 'E30613', 'PAOK': '000000',
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

const SYSTEM_PROMPT = `You are a football live scores data extraction assistant. You will be given search result snippets about football matches from multiple languages. Your job is to extract ALL real football/soccer matches mentioned and return them as a JSON array.

Each match object must have:
- id (string, create like "team1_vs_team2")
- homeTeam (string, full team name - translate abbreviations: OL→Lyon, PSG→Paris Saint-Germain, FCB→Barcelona, OMA→Marseille, MUFC→Manchester United, etc.)
- awayTeam (string, full team name)
- homeScore (number or null if match hasn't started yet)
- awayScore (number or null if match hasn't started yet)
- status: MUST be one of:
  * "live" - ONLY if the match is CURRENTLY IN PROGRESS RIGHT NOW (shows a minute like 45', 67', HT, or a LIVE/EN DIRECT indicator)
  * "upcoming" - match has NOT started yet (only shows kickoff time)
  * "finished" - match has ENDED (shows "FT", "Full Time", "AET", "Pen", "Terminé", "Final", or completed score)
- minute (number or null, ONLY for live matches - extract the current minute. For "HT" use 45)
- competition (string, league/competition name in English like "Premier League", "Ligue 1", "Champions League", "La Liga", "Serie A", "Bundesliga", etc.)
- matchDate (ISO date string - use today's date if not specified)

CRITICAL STATUS CLASSIFICATION RULES:
1. "live" = match is CURRENTLY PLAYING RIGHT NOW. Must show a current minute (e.g., 45', 67', 89') or "HT" or "LIVE" or "en direct" indicator.
2. "finished" = match has ENDED. Shows "FT", "Full Time", "Terminé", "Final", "AET", "Penalties", OR has a final score with no live/playing indicator.
3. "upcoming" = match has NOT started. Only shows kickoff time with NO score.
4. A match with a score BUT no "live" or minute indicator is FINISHED, NOT LIVE.
5. If you see "FT" or "Full Time" near a score, the match is FINISHED.
6. Matches from earlier today with final scores are FINISHED.
7. Do NOT confuse "results" with "live" - results are finished matches.

IMPORTANT EXTRACTION RULES:
- Extract matches from all languages
- Look for score patterns like "3-2", "0-0", "1-0"
- Be ACCURATE with scores
- Translate team abbreviations to full names
- Do NOT invent or hallucinate matches
- Do NOT include any markdown, code blocks, or explanation - just the raw JSON array`;

/**
 * Parse the LLM response to extract the JSON array of matches.
 */
function parseMatchesResponse(llmContent: string): FootballMatch[] {
  let jsonStr = llmContent.trim();

  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim();
  }

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
 * Fetch football match data using z-ai-web-dev-sdk.
 * Strategy: Parallel multi-language web searches + LLM extraction.
 * Focuses on finding currently live matches and today's fixtures.
 */
async function fetchMatchData(): Promise<FootballMatch[]> {
  const zai = await ZAI.create();
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const timeStr = today.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  console.log(`[Football API] Fetching match data for ${todayStr} at ${timeStr}...`);

  // Search queries focused on LIVE matches and today's fixtures
  // Using multiple languages to get more diverse results
  const searchQueries = [
    `live football scores right now ${todayStr} currently playing minute`,
    `match en direct football aujourd'hui scores ${todayStr} minute`,
    `football live scores now premier league ligue 1 la liga serie a bundesliga`,
    `resultados fútbol en vivo hoy marcadores ${todayStr} minuto`,
    `risultati calcio in diretta oggi punteggi ${todayStr}`,
    `football match today fixtures kickoff times ${todayStr}`,
  ];

  // Run ALL searches IN PARALLEL for speed
  console.log('[Football API] Running parallel searches...');
  const searchResults = await Promise.allSettled(
    searchQueries.map((query) =>
      zai.functions.invoke('web_search', {
        query,
        num: 6,
        recency_days: 1,
      })
    )
  );

  const allSnippets: string[] = [];
  const allUrls: string[] = [];

  for (const result of searchResults) {
    if (result.status === 'fulfilled' && Array.isArray(result.value)) {
      for (const item of result.value) {
        if (item && typeof item === 'object') {
          const snippet = item.snippet || '';
          const name = item.name || '';
          const url = item.url || '';
          if (snippet || name) {
            allSnippets.push(`${name}: ${snippet}`);
          }
          if (url) {
            allUrls.push(url);
          }
        }
      }
    }
  }

  console.log(`[Football API] Collected ${allSnippets.length} search snippets from ${searchQueries.length} queries`);

  // Try to read a page from search results for more detailed data
  let pageContent = '';
  const readableUrls = allUrls.filter(
    (url) =>
      !url.includes('flashscore') &&
      !url.includes('sofascore') &&
      !url.includes('livescore') &&
      !url.includes('google') &&
      !url.includes('youtube')
  );

  // Try up to 2 pages
  for (const url of readableUrls.slice(0, 2)) {
    try {
      console.log(`[Football API] Reading page: ${url}`);
      const pageResult = await zai.functions.invoke('page_reader', { url });

      if (pageResult && pageResult.data && pageResult.data.html) {
        const text = pageResult.data.html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]*>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        if (text.length > 100) {
          pageContent += text.slice(0, 10000) + '\n';
          console.log(`[Football API] Got ${text.length} chars from ${url}`);
          break; // Got a good page, stop
        }
      }
    } catch (err) {
      // Page reading failed, continue with search data only
    }
  }

  if (allSnippets.length === 0 && !pageContent) {
    console.warn('[Football API] No data found from any source');
    return [];
  }

  // Use LLM to extract structured match data
  console.log('[Football API] Extracting match data with LLM...');

  let userPrompt = `Today is ${todayStr}. Current time: ${timeStr}.

SEARCH RESULTS (from multiple languages):
${allSnippets.join('\n\n')}`;

  if (pageContent) {
    userPrompt += `

ADDITIONAL PAGE CONTENT:
${pageContent}`;
  }

  userPrompt += `

Extract ALL real football/soccer matches from these sources. Pay close attention to the match status:
- "live" = CURRENTLY PLAYING (shows minute like 45', 67' or LIVE indicator)
- "finished" = ENDED (shows FT, Full Time, Terminé, Final, or completed score without live indicator)
- "upcoming" = NOT YET STARTED (shows future time, no score)

IMPORTANT: Do NOT mark finished matches as "live". A match with a final score but no "live" indicator is FINISHED.
Return ONLY a valid JSON array of match objects.`;

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

    // Deduplicate matches
    const seen = new Set<string>();
    const dedupedMatches = matches.filter((match) => {
      const key = `${match.homeTeam.toLowerCase()}|${match.awayTeam.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Post-validate: A live match should have at least a score or minute
    const validatedMatches = dedupedMatches.map((match) => {
      if (match.status === 'live') {
        if (match.homeScore === null && match.awayScore === null && match.minute === null) {
          return { ...match, status: 'upcoming' as const };
        }
      }
      return match;
    });

    return validatedMatches;
  } catch (err) {
    console.error('[Football API] LLM extraction failed:', err);
    return [];
  }
}

/**
 * GET /api/football - Returns current football match data from AI search.
 * Results are cached for 2 minutes.
 */
export async function GET() {
  try {
    // Check cache first
    const cached = getCached<FootballMatchesResponse>(CACHE_KEY);
    if (cached) {
      const age = getCacheAge(CACHE_KEY);
      return NextResponse.json(cached, {
        headers: { 'X-Cache': 'HIT', 'X-Cache-Age': String(age) },
      });
    }

    // Fetch fresh data
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

    // No cache available
    const emptyResponse: FootballMatchesResponse = {
      matches: [],
      lastUpdated: new Date().toISOString(),
      source: 'ai-search',
      error: error instanceof Error ? error.message : 'Impossible de charger les données des matchs',
    };

    return NextResponse.json(emptyResponse, { status: 200 });
  }
}
