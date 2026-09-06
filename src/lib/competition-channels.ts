/**
 * Competition → Channel Mapping
 *
 * When the DaddyLive schedule doesn't contain a specific match (e.g., the schedule
 * is stale, or the match simply isn't listed), we fall back to showing channels
 * that are likely to broadcast the competition. This gives users a sensible set
 * of channels to try instead of an empty list.
 *
 * Channel names MUST exactly match the keys in nightah/daddylive channels-data.json
 * so they can be resolved to m3u8 stream URLs.
 */

export interface FallbackChannel {
  name: string;        // exact channel name in channels-data.json
  reason: string;      // why this channel likely broadcasts the match
  priority: number;    // lower = higher priority
}

const EPL = 'premier league';
const LALIGA = 'la liga';
const SERIE_A = 'serie a';
const BUNDESLIGA = 'bundesliga';
const LIGUE1 = 'ligue 1';
const MLS = 'mls';
const SAUDI = 'saudi pro league';
const NWSL = 'nws';
const UCL = 'champions league';
const UEL = 'europa league';
const EUROPA_CONF = 'conference league';
const NBA = 'nba';
const EUROLEAGUE = 'euroleague';
const NCAA = 'ncaa';

// Channel names verified to exist in nightah/daddylive channels-data.json
const CH = {
  SKY_SPL: 'Sky Sports Premier League',
  SKY_MAIN: 'Sky Sports Main Event',
  SKY_FOOT: 'Sky Sports Football UK',
  SKY_MIX: 'Sky Sports MIX UK',
  TNT1: 'TNT Sports 1 UK',
  TNT2: 'TNT Sports 2 UK',
  TNT3: 'TNT Sports 3 UK',
  TNT4: 'TNT Sports 4 UK',
  USA_NET: 'USA Network',
  NBC: 'NBC USA',
  CANAL_FOOT: "Canal+ Foot France",
  CANAL_SPORT: 'Canal+ Sport France',
  CANAL_SPORT360: 'Canal+ Sport360',
  BEIN_FR1: 'beIN SPORTS 1 France',
  BEIN_FR2: 'beIN SPORTS 2 France',
  BEIN_FR3: 'beIN SPORTS 3 France',
  BEIN_USA: 'BeIN SPORTS USA',
  BEIN_AU1: 'beIN SPORTS Australia 1',
  ESPN_USA: 'ESPN USA',
  ESPN2_USA: 'ESPN2 USA',
  ESPNEWS: 'ESPNews',
  FS1: 'Fox Sports 1 USA',
  FS2: 'Fox Sports 2 USA',
  TNT_USA: 'TNT USA',
  NBA_TV: 'NBA TV USA',
  CBS_GOLAZO: 'CBS Sports Golazo',
  DAZN1_DE: 'DAZN 1 Bar DE',
  DAZN2_DE: 'DAZN 2 Bar DE',
  VAMOS_ES: '#Vamos Spain',
  NOVA_SPL_GR: 'Nova Sports Premier League Greece',
  NOVA_S1_GR: 'Nova Sports 1 Greece',
  COSMOTE_S1: 'Cosmote Sport 1 HD',
  ARENA_S1_RS: 'Arena Sport 1 Serbia',
  SETANTA: 'Premier Sports Ireland 1',
  BBC1: 'BBC One UK',
  ITV1: 'ITV 1 UK',
  ITV4: 'ITV 4 UK',
  DAZN_UK: 'DAZN 1 UK',
};

/**
 * Map a competition name (as displayed in the UI) to channels likely to broadcast it.
 * Returns a prioritized list of channel names.
 */
export function getCompetitionChannels(competition: string | null | undefined, sport: 'football' | 'basketball'): FallbackChannel[] {
  const c = (competition || '').toLowerCase();
  if (!c) return getDefaultChannels(sport);

  const isFootball = sport === 'football';

  // ── Football: per-competition mapping ──
  if (isFootball) {
    if (c.includes('premier league') && !c.includes('women') && !c.includes('wsl')) {
      return [
        { name: CH.SKY_SPL, reason: 'Diffuseur officiel UK', priority: 1 },
        { name: CH.TNT1, reason: 'Co-diffuseur UK', priority: 2 },
        { name: CH.TNT2, reason: 'Co-diffuseur UK', priority: 3 },
        { name: CH.USA_NET, reason: 'NBC / diffuseur US', priority: 4 },
        { name: CH.BEIN_USA, reason: 'Diffuseur international', priority: 5 },
        { name: CH.BEIN_FR1, reason: 'Diffuseur France', priority: 6 },
        { name: CH.NOVA_SPL_GR, reason: 'Diffuseur Grèce', priority: 7 },
      ];
    }
    if (c.includes('la liga')) {
      return [
        { name: CH.BEIN_USA, reason: 'Diffuseur US LaLiga', priority: 1 },
        { name: CH.BEIN_FR1, reason: 'Diffuseur France', priority: 2 },
        { name: CH.BEIN_FR2, reason: 'Diffuseur France', priority: 3 },
        { name: CH.VAMOS_ES, reason: 'Diffuseur Espagne', priority: 4 },
        { name: CH.BEIN_AU1, reason: 'Diffuseur Australie', priority: 5 },
      ];
    }
    if (c.includes('serie a')) {
      return [
        { name: CH.CBS_GOLAZO, reason: 'Diffuseur US Serie A', priority: 1 },
        { name: CH.BEIN_USA, reason: 'Diffuseur international', priority: 2 },
        { name: CH.DAZN_UK, reason: 'Co-diffuseur UK', priority: 3 },
      ];
    }
    if (c.includes('bundesliga')) {
      return [
        { name: CH.DAZN1_DE, reason: 'Diffuseur officiel Allemagne', priority: 1 },
        { name: CH.DAZN2_DE, reason: 'Co-diffuseur Allemagne', priority: 2 },
        { name: CH.ESPN_USA, reason: 'Diffuseur US', priority: 3 },
      ];
    }
    if (c.includes('ligue 1') || c.includes('ligue1')) {
      return [
        { name: CH.CANAL_FOOT, reason: 'Diffuseur officiel France', priority: 1 },
        { name: CH.CANAL_SPORT, reason: 'Co-diffuseur France', priority: 2 },
        { name: CH.BEIN_FR1, reason: 'Co-diffuseur France', priority: 3 },
        { name: CH.BEIN_FR2, reason: 'Co-diffuseur France', priority: 4 },
      ];
    }
    if (c.includes('mls') || c.includes('major league soccer')) {
      return [
        { name: CH.FS1, reason: 'Diffuseur US MLS', priority: 1 },
        { name: CH.FS2, reason: 'Diffuseur US MLS', priority: 2 },
        { name: CH.ESPN_USA, reason: 'Diffuseur US MLS', priority: 3 },
        { name: CH.ESPN2_USA, reason: 'Diffuseur US MLS', priority: 4 },
      ];
    }
    if (c.includes('saudi') || c.includes('spl')) {
      return [
        { name: CH.BEIN_USA, reason: 'Diffuseur international', priority: 1 },
        { name: CH.BEIN_FR1, reason: 'Diffuseur international', priority: 2 },
      ];
    }
    if (c.includes('champions league') || c.includes('ucl')) {
      return [
        { name: CH.CBS_GOLAZO, reason: 'Diffuseur US UCL', priority: 1 },
        { name: CH.TNT1, reason: 'Diffuseur UK', priority: 2 },
        { name: CH.ARENA_S1_RS, reason: 'Diffuseur Balkans', priority: 3 },
        { name: CH.BEIN_FR1, reason: 'Diffuseur France', priority: 4 },
      ];
    }
    if (c.includes('europa league') || c.includes('conference')) {
      return [
        { name: CH.TNT1, reason: 'Diffuseur UK', priority: 1 },
        { name: CH.TNT2, reason: 'Diffuseur UK', priority: 2 },
        { name: CH.BEIN_FR1, reason: 'Diffuseur France', priority: 3 },
      ];
    }
    if (c.includes('nws') || c.includes('women') || c.includes('feminine') || c.includes('wsl')) {
      return [
        { name: CH.ESPN_USA, reason: 'Diffuseur women football', priority: 1 },
        { name: CH.ESPN2_USA, reason: 'Diffuseur women football', priority: 2 },
        { name: CH.BBC1, reason: 'Diffuseur UK', priority: 3 },
        { name: CH.ITV4, reason: 'Diffuseur UK', priority: 4 },
      ];
    }
    if (c.includes(' eredivisie')) {
      return [
        { name: CH.ESPN_USA, reason: 'Diffuseur international', priority: 1 },
        { name: CH.BEIN_USA, reason: 'Diffuseur international', priority: 2 },
      ];
    }
    if (c.includes('primeira') || c.includes('liga portugal') || c.includes('portugal')) {
      return [
        { name: CH.BEIN_USA, reason: 'Diffuseur international', priority: 1 },
        { name: CH.BEIN_FR1, reason: 'Diffuseur international', priority: 2 },
      ];
    }
    if (c.includes('super liga') || c.includes('argentine') || c.includes('primera division')) {
      return [
        { name: CH.ESPN_USA, reason: 'Diffuseur Amérique latine', priority: 1 },
        { name: CH.ESPN2_USA, reason: 'Diffuseur US', priority: 2 },
      ];
    }
    // Generic football fallback
    return [
      { name: CH.SKY_SPL, reason: 'Chaîne football UK', priority: 1 },
      { name: CH.BEIN_USA, reason: 'Chaîne football international', priority: 2 },
      { name: CH.ESPN_USA, reason: 'Chaîne football US', priority: 3 },
    ];
  }

  // ── Basketball: per-competition mapping ──
  if (c.includes('nba')) {
    return [
      { name: CH.ESPN_USA, reason: 'Diffuseur officiel NBA', priority: 1 },
      { name: CH.TNT_USA, reason: 'Diffuseur officiel NBA', priority: 2 },
      { name: CH.NBA_TV, reason: 'Chaîne NBA dédiée', priority: 3 },
      { name: CH.ESPN2_USA, reason: 'Co-diffuseur NBA', priority: 4 },
    ];
  }
  if (c.includes('euroleague') || c.includes('euro cup') || c.includes('eurocup')) {
    return [
      { name: CH.ESPN_USA, reason: 'Diffuseur Euroleague', priority: 1 },
      { name: CH.BEIN_USA, reason: 'Diffuseur international', priority: 2 },
    ];
  }
  if (c.includes('ncaa') || c.includes('college')) {
    return [
      { name: CH.ESPN_USA, reason: 'Diffuseur NCAA', priority: 1 },
      { name: CH.ESPN2_USA, reason: 'Diffuseur NCAA', priority: 2 },
      { name: CH.ESPNEWS, reason: 'Diffuseur NCAA', priority: 3 },
      { name: CH.FS1, reason: 'Diffuseur NCAA', priority: 4 },
    ];
  }
  if (c.includes('acb') || c.includes('liga endesa')) {
    return [
      { name: CH.BEIN_USA, reason: 'Diffuseur Espagne basket', priority: 1 },
      { name: CH.BEIN_FR1, reason: 'Diffuseur international', priority: 2 },
    ];
  }
  if (c.includes('lega serie a') && !c.includes('calcio')) {
    // Italian basketball
    return [
      { name: CH.ESPN_USA, reason: 'Diffuseur international', priority: 1 },
    ];
  }
  // Generic basketball fallback
  return [
    { name: CH.ESPN_USA, reason: 'Chaîne basket US', priority: 1 },
    { name: CH.TNT_USA, reason: 'Chaîne basket US', priority: 2 },
    { name: CH.NBA_TV, reason: 'Chaîne basket dédiée', priority: 3 },
  ];
}

function getDefaultChannels(sport: 'football' | 'basketball'): FallbackChannel[] {
  if (sport === 'football') {
    return [
      { name: CH.SKY_SPL, reason: 'Chaîne football UK', priority: 1 },
      { name: CH.BEIN_USA, reason: 'Chaîne football international', priority: 2 },
      { name: CH.ESPN_USA, reason: 'Chaîne football US', priority: 3 },
    ];
  }
  return [
    { name: CH.ESPN_USA, reason: 'Chaîne basket US', priority: 1 },
    { name: CH.TNT_USA, reason: 'Chaîne basket US', priority: 2 },
    { name: CH.NBA_TV, reason: 'Chaîne basket dédiée', priority: 3 },
  ];
}
