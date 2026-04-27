import { NextRequest, NextResponse } from 'next/server';
import { fetchSportsChannels } from '@/lib/iptv';

/**
 * POST /api/match-stream - Find the best IPTV channel for a given match.
 * Body: { homeTeam, awayTeam, competition }
 * Returns: { channels: Array<{ name, url, logo, group, relevance }> }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { homeTeam, awayTeam, competition } = body;

    if (!homeTeam || !awayTeam) {
      return NextResponse.json(
        { error: 'homeTeam and awayTeam are required' },
        { status: 400 }
      );
    }

    // Fetch all sports channels
    const channels = await fetchSportsChannels();

    if (channels.length === 0) {
      return NextResponse.json({ channels: [], message: 'No channels available' });
    }

    const homeLower = homeTeam.toLowerCase();
    const awayLower = awayTeam.toLowerCase();
    const compLower = (competition || '').toLowerCase();

    // Keywords to match against channel names
    const searchTerms = [
      homeLower,
      awayLower,
      // Competition keywords
      ...getCompetitionKeywords(compLower),
      // General sports keywords
      'sport', 'football', 'soccer', 'foot', 'futbol',
    ].filter(Boolean);

    // Score each channel by relevance
    const scored = channels.map((ch) => {
      const nameLower = ch.name.toLowerCase();
      const groupLower = (ch.group || '').toLowerCase();
      let score = 0;

      // Bonus for HLS streams (much more likely to work)
      const isHls = ch.url.includes('.m3u8') || ch.url.includes('m3u8');
      if (isHls) score += 5;

      for (const term of searchTerms) {
        if (!term) continue;
        if (nameLower.includes(term)) {
          score += term.length > 3 ? 10 : 5;
        }
        if (groupLower.includes(term)) {
          score += 3;
        }
      }

      // Bonus for specific competition matches
      if (compLower.includes('ligue 1') && (nameLower.includes('ligue 1') || nameLower.includes('l1') || nameLower.includes('canal+') || nameLower.includes('bein'))) {
        score += 15;
      }
      if (compLower.includes('premier league') && (nameLower.includes('premier') || nameLower.includes('pl') || nameLower.includes('sky sports') || nameLower.includes('bt sport'))) {
        score += 15;
      }
      if (compLower.includes('champions league') && (nameLower.includes('champions') || nameLower.includes('ucl') || nameLower.includes('canal+') || nameLower.includes('bein'))) {
        score += 15;
      }
      if (compLower.includes('la liga') && (nameLower.includes('la liga') || nameLower.includes('liga') || nameLower.includes('bein') || nameLower.includes('movistar'))) {
        score += 15;
      }
      if (compLower.includes('serie a') && (nameLower.includes('serie a') || nameLower.includes('dazn') || nameLower.includes('sky sport'))) {
        score += 15;
      }
      if (compLower.includes('bundesliga') && (nameLower.includes('bundesliga') || nameLower.includes('sky sport'))) {
        score += 15;
      }

      // Bonus for country-specific channels
      if (homeLower.includes('psg') || homeLower.includes('paris') || awayLower.includes('psg') || awayLower.includes('paris')) {
        if (nameLower.includes('canal+') || nameLower.includes('bein') || nameLower.includes('france') || groupLower.includes('france')) {
          score += 8;
        }
      }
      if (homeLower.includes('marseille') || awayLower.includes('marseille')) {
        if (nameLower.includes('canal+') || nameLower.includes('bein') || nameLower.includes('france') || groupLower.includes('france')) {
          score += 8;
        }
      }
      if (homeLower.includes('real madrid') || homeLower.includes('barcelona') || awayLower.includes('real madrid') || awayLower.includes('barcelona')) {
        if (nameLower.includes('movistar') || nameLower.includes('bein') || nameLower.includes('españa') || groupLower.includes('spain')) {
          score += 8;
        }
      }

      // Penalty for non-HTTPS URLs (less reliable)
      if (!ch.url.startsWith('https')) score -= 2;

      return {
        name: ch.name,
        url: ch.url,
        logo: ch.logo,
        group: ch.group,
        country: ch.country,
        relevance: score,
      };
    });

    // Filter channels with relevance > 0, sort by relevance, prioritize HLS
    const relevant = scored
      .filter((ch) => ch.relevance > 0)
      .sort((a, b) => {
        // First sort by HLS priority
        const aHls = a.url.includes('.m3u8') || a.url.includes('m3u8') ? 1 : 0;
        const bHls = b.url.includes('.m3u8') || b.url.includes('m3u8') ? 1 : 0;
        if (bHls !== aHls) return bHls - aHls;
        // Then by relevance
        return b.relevance - a.relevance;
      })
      .slice(0, 8);

    // If no specific match found, return general sports channels
    if (relevant.length === 0) {
      const generalSports = scored
        .filter((ch) => ch.relevance > 0 || ch.name.toLowerCase().includes('sport') || ch.group.toLowerCase().includes('sport'))
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, 8);

      if (generalSports.length > 0) {
        return NextResponse.json({
          channels: generalSports,
          message: 'Canaux sportifs généraux trouvés',
        });
      }

      // Return first 5 channels as last resort
      return NextResponse.json({
        channels: scored.slice(0, 5).map((ch) => ({ ...ch, relevance: 0 })),
        message: 'Aucun canal spécifique trouvé, voici des canaux sportifs',
      });
    }

    return NextResponse.json({
      channels: relevant,
      message: `${relevant.length} canal(aux) trouvé(s)`,
    });
  } catch (error) {
    console.error('[Match Stream API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to find channels', channels: [] },
      { status: 500 }
    );
  }
}

/**
 * Get keywords for a competition name
 */
function getCompetitionKeywords(comp: string): string[] {
  const keywords: string[] = [];

  const compMap: Record<string, string[]> = {
    'ligue 1': ['ligue 1', 'l1', 'canal', 'bein', 'amazon'],
    'premier league': ['premier league', 'pl', 'sky sports', 'bt sport', 'nbc'],
    'champions league': ['champions league', 'ucl', 'canal', 'bein', 'bt sport'],
    'europa league': ['europa league', 'uel'],
    'la liga': ['la liga', 'liga', 'movistar', 'bein', 'espn'],
    'serie a': ['serie a', 'dazn', 'sky sport'],
    'bundesliga': ['bundesliga', 'sky sport', 'dazn'],
    'world cup': ['world cup', 'fifa', 'coupe du monde'],
    'africa cup': ['africa cup', 'can', 'afcon', 'bein'],
    'cup': ['cup', 'coupe'],
  };

  for (const [key, values] of Object.entries(compMap)) {
    if (comp.includes(key)) {
      keywords.push(...values);
    }
  }

  return keywords;
}
