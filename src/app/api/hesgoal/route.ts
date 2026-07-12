import { NextRequest, NextResponse } from 'next/server';

/**
 * HesGoal API Integration
 * 
 * Fetches live football match data from kora-api.space (same API used by hes-goal.eu)
 * and resolves playable stream URLs for each match.
 * 
 * API Endpoints used:
 * - GET https://ws.kora-api.space/api/matches/{YYYY-MM-DD}/{page} — daily match list
 * - GET https://ws.kora-api.space/api/matches/{id} — specific match data
 * 
 * Stream resolution:
 * - Matches with has_channels=1 and active=1 have stream URLs
 * - Stream page URL: https://go4score.app/?m={matchId}&lang=en
 * - The stream page contains embedded players that resolve to m3u8 via our proxy
 */

const KORA_API_BASE = 'https://ws.kora-api.space';
const TEAM_IMG_BASE = 'https://cdn.kora-api.space/uploads/team/';
const LEAGUE_IMG_BASE = 'https://cdn.kora-api.space/uploads/league/';
const STREAM_BASE = 'https://go4score.app/';

// ─── In-memory cache ────────────────────────────────────────────────────────
interface CacheEntry {
  data: HesGoalMatch[];
  timestamp: number;
}

const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes
const cache = new Map<string, CacheEntry>();

// ─── Types ──────────────────────────────────────────────────────────────────
interface KoraMatch {
  id: string;
  page_id: string;
  page: number;
  category: string;
  sitemap: number;
  api_matche_id: string;
  status: number; // 1 = live, 2 = finished, 0/3 = upcoming
  date: string;
  time: string;
  score: string;
  home_score: string;
  away_score: string;
  league: string;
  league_en: string;
  league_logo: string;
  home: string;
  home_en: string;
  home_logo: string;
  away: string;
  away_en: string;
  away_logo: string;
  tv: string;
  selected: string;
  english: string;
  has_channels: string; // "1" or "0"
  event: string;
  event_desc: string;
  active: string; // "1" or "0"
  redirect_url: string;
  redirect_domain_ids: string[];
  edges: string[];
  edge_domain: string | null;
  ext_domain: string | null;
  ar_ext_links: string[];
  en_ext_links: string[];
}

interface HesGoalMatch {
  id: string;
  status: 'live' | 'finished' | 'upcoming';
  date: string;
  time: string;
  score: string;
  homeTeam: string;
  awayTeam: string;
  homeLogo: string;
  awayLogo: string;
  league: string;
  leagueLogo: string;
  hasStream: boolean;
  streamUrl: string | null;
  category: string;
}

// ─── Helper: status mapping ─────────────────────────────────────────────────
function mapStatus(status: number): 'live' | 'finished' | 'upcoming' {
  if (status === 1) return 'live';
  if (status === 2) return 'finished';
  return 'upcoming';
}

// ─── Helper: build full image URL ───────────────────────────────────────────
function teamLogoUrl(logo: string): string {
  if (!logo) return '';
  if (logo.startsWith('http')) return logo;
  return `${TEAM_IMG_BASE}${logo}`;
}

function leagueLogoUrl(logo: string): string {
  if (!logo) return '';
  if (logo.startsWith('http')) return logo;
  return `${LEAGUE_IMG_BASE}${logo}`;
}

// ─── Helper: build stream URL ───────────────────────────────────────────────
function buildStreamUrl(matchId: string): string {
  return `${STREAM_BASE}?m=${matchId}&lang=en`;
}

// ─── Fetch matches for a date ───────────────────────────────────────────────
async function fetchMatchesForDate(date: string): Promise<KoraMatch[]> {
  const allMatches: KoraMatch[] = [];
  let page = 1;

  try {
    // Fetch first page (usually all matches fit in one page)
    const url = `${KORA_API_BASE}/api/matches/${date}/${page}`;
    console.log(`[HesGoal API] Fetching: ${url}`);

    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      console.warn(`[HesGoal API] kora-api returned HTTP ${res.status}`);
      return [];
    }

    const data = await res.json();
    const matches: KoraMatch[] = data.matches || [];

    if (matches.length === 0) {
      console.log(`[HesGoal API] No matches for ${date}`);
      return [];
    }

    allMatches.push(...matches);
    console.log(`[HesGoal API] Fetched ${matches.length} matches for ${date}`);
  } catch (err) {
    console.warn('[HesGoal API] Error fetching from kora-api:', err);
  }

  return allMatches;
}

// ─── GET handler ────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date'); // YYYY-MM-DD format
    const matchId = searchParams.get('id'); // specific match

    // ─── Single match lookup ────────────────────────────────────────────
    if (matchId) {
      const cacheKey = `match-${matchId}`;
      const cached = cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return NextResponse.json({ match: cached.data[0] });
      }

      try {
        // Fetch today's matches and find the specific one
        const today = new Date().toISOString().split('T')[0];
        const matches = await fetchMatchesForDate(today);
        const found = matches.find((m) => m.id === matchId);

        if (!found) {
          return NextResponse.json({ error: 'Match not found' }, { status: 404 });
        }

        const mapped: HesGoalMatch = {
          id: found.id,
          status: mapStatus(found.status),
          date: found.date,
          time: found.time,
          score: found.score !== '0 - 0' && found.score !== '-' ? found.score : '',
          homeTeam: found.home_en,
          awayTeam: found.away_en,
          homeLogo: teamLogoUrl(found.home_logo),
          awayLogo: teamLogoUrl(found.away_logo),
          league: found.league_en,
          leagueLogo: leagueLogoUrl(found.league_logo),
          hasStream: found.active === '1' && found.has_channels === '1',
          streamUrl: found.active === '1' && found.has_channels === '1'
            ? buildStreamUrl(found.id)
            : null,
          category: found.category,
        };

        cache.set(cacheKey, [mapped]);

        return NextResponse.json({ match: mapped });
      } catch (err) {
        console.error('[HesGoal API] Error fetching match:', err);
        return NextResponse.json({ error: 'Failed to fetch match' }, { status: 500 });
      }
    }

    // ─── Date-based match list ──────────────────────────────────────────
    const targetDate = date || new Date().toISOString().split('T')[0];
    const cacheKey = `date-${targetDate}`;

    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      console.log(`[HesGoal API] Cache hit for ${targetDate} (${cached.data.length} matches)`);
      return NextResponse.json({
        matches: cached.data,
        date: targetDate,
        liveCount: cached.data.filter((m) => m.status === 'live').length,
      });
    }

    const koraMatches = await fetchMatchesForDate(targetDate);

    // Filter to only football/soccer matches
    const soccerMatches = koraMatches.filter(
      (m) => m.category === 'Soccer' || m.category === 'soccer' || !m.category
    );

    // Map to our format
    const mapped: HesGoalMatch[] = soccerMatches.map((m) => ({
      id: m.id,
      status: mapStatus(m.status),
      date: m.date,
      time: m.time,
      score: m.score !== '0 - 0' && m.score !== '-' ? m.score : '',
      homeTeam: m.home_en,
      awayTeam: m.away_en,
      homeLogo: teamLogoUrl(m.home_logo),
      awayLogo: teamLogoUrl(m.away_logo),
      league: m.league_en,
      leagueLogo: leagueLogoUrl(m.league_logo),
      hasStream: m.active === '1' && m.has_channels === '1',
      streamUrl: m.active === '1' && m.has_channels === '1'
        ? buildStreamUrl(m.id)
        : null,
      category: m.category,
    }));

    // Sort: live first, then upcoming, then finished
    mapped.sort((a, b) => {
      const order = { live: 0, upcoming: 1, finished: 2 };
      return order[a.status] - order[b.status];
    });

    cache.set(cacheKey, { data: mapped, timestamp: Date.now() });

    console.log(`[HesGoal API] Returning ${mapped.length} matches for ${targetDate}`);

    return NextResponse.json({
      matches: mapped,
      date: targetDate,
      liveCount: mapped.filter((m) => m.status === 'live').length,
    });
  } catch (err) {
    console.error('[HesGoal API] Error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch HesGoal data' },
      { status: 500 }
    );
  }
}
