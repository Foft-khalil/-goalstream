/**
 * Shared Team-Matching Library
 *
 * Robust fuzzy matching between team names from different data sources.
 * Used by find-stream, daddylive, and streams routes to ensure a match
 * listed under "Crystal Palace" in one source is correctly matched to
 * "C Palace", "Crystal", "CPFC" etc. in another source's schedule.
 *
 * Design goals:
 * - Be permissive enough to catch real matches despite naming differences
 * - Be strict enough to reject clearly unrelated events
 * - Use a scoring system so partial matches can be ranked, not just binary
 */

// ─── Normalize a team/event name for comparison ────────────────────────────
export function normalizeTeamName(name: string): string {
  return (name || '')
    .toLowerCase()
    // Strip accents
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    // Fuse letter abbreviations BEFORE punctuation stripping: "D.C. United"
    // must become "dc united" (not "d c united") so it matches DaddyLive's
    // "DC United" — and its "dc" identity token stays matchable.
    .replace(/\b([a-z])\.\s*(?=[a-z]\b)/g, '$1')
    .replace(/\b([a-z])\.(?=\s|$)/g, '$1')
    // Remove punctuation (keep alphanumerics and spaces)
    .replace(/[^a-z0-9\s]/g, ' ')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Comprehensive team alias dictionary ────────────────────────────────────
// Keys are normalized "canonical" names; values are arrays of alternate names.
// Both directions are matched in getTeamVariants.
const TEAM_ALIASES: Record<string, string[]> = {
  // ── Premier League (England) ──
  'manchester city': ['man city', 'mancity', 'city', 'mci'],
  'manchester united': ['man utd', 'manchester utd', 'manunited', 'manu', 'mun', 'man united'],
  'tottenham hotspur': ['tottenham', 'spurs', 'tot'],
  'tottenham': ['spurs', 'tot'],
  'crystal palace': ['c palace', 'cpalace', 'palace', 'cpfc'],
  'newcastle united': ['newcastle', 'newcastle utd', 'ncl', 'newcastle utd'],
  'newcastle': ['ncl'],
  'brighton hove albion': ['brighton', 'bha', 'brighton hove'],
  'brighton': ['bha'],
  'west ham united': ['west ham', 'westham', 'whu'],
  'west ham': ['westham', 'whu'],
  'aston villa': ['villa', 'avl'],
  'wolverhampton wanderers': ['wolverhampton', 'wolves', 'wwfc'],
  'wolves': ['wolverhampton', 'wwfc'],
  'nottingham forest': ['nottm forest', 'forest', 'notttingham forest', 'nfo'],
  'sheffield united': ['sheffield utd', 'sheffield', 'shu'],
  'leeds united': ['leeds', 'lufc'],
  'leicester city': ['leicester', 'lei', 'lcfc'],
  'leicester': ['lcfc'],
  'everton': ['eve'],
  'liverpool': ['lfc', 'liv', 'reds'],
  'chelsea': ['che', 'blues'],
  'arsenal': ['ars', 'gunners'],
  'fulham': ['ful'],
  'brentford': ['bre', 'bees'],
  'bournemouth': ['bou', 'afcb'],
  'burnley': ['bur'],
  'luton town': ['luton', 'lut'],
  'luton': ['lut'],

  // ── La Liga (Spain) ──
  'real madrid': ['realmadrid', 'rma', 'madrid', 'los blancos'],
  'barcelona': ['fc barcelona', 'barca', 'fcb', 'blaugrana'],
  'atletico madrid': ['atl madrid', 'atletico', 'atleti', 'atm'],
  'atl madrid': ['atletico', 'atleti', 'atm'],
  'atletico bilbao': ['ath bilbao', 'athletic bilbao', 'athletic club', 'ath'],
  'athletic bilbao': ['ath bilbao', 'athletic club', 'ath'],
  'athletic club': ['ath bilbao', 'athletic bilbao', 'ath'],
  'sevilla': ['sev', 'sevilla fc'],
  'villarreal': ['vill', 'villarreal cf'],
  'real betis': ['betis', 'rbb', 'betis balompie'],
  'betis': ['real betis'],
  'real sociedad': ['r sociedad', 'sociedad', 'rso'],
  'valencia': ['val', 'valencia cf'],
  'celta vigo': ['celta', 'cel', 'rc celta'],
  'celta': ['cel', 'rc celta'],
  'osasuna': ['osa', 'ca osasuna'],
  'rayo vallecano': ['rayo', 'rayo vallecano', 'rv'],
  'mallorca': ['mall', 'rcd mallorca'],
  'getafe': ['get', 'getafe cf'],
  'alaves': ['ala', 'deportivo alaves'],
  'girona': ['gir', 'girona fc'],
  'las palmas': ['lpa', 'ud las palmas'],
  'granada': ['gra', 'granada cf'],
  'cadiz': ['cad', 'cadiz cf'],
  'almeria': ['alm', 'ud almeria'],
  'elche': ['elc', 'elche cf'],
  'espanyol': ['esp', 'rcd espanyol'],

  // ── Serie A (Italy) ──
  'inter milan': ['inter', 'fc internazionale', 'internazionale', 'int'],
  'inter': ['inter milan', 'internazionale', 'int'],
  'ac milan': ['milan', 'acmilan', 'mil'],
  'milan': ['ac milan', 'acmilan', 'mil'],
  'juventus': ['juve', 'juventus fc', 'juv'],
  'napoli': ['naples', 'ssc napoli', 'nap', 'napoli sc'],
  'roma': ['as roma', 'rome', 'aso'],
  'as roma': ['roma', 'rome', 'aso'],
  'lazio': ['ssl lazio', 'laz'],
  'atalanta': ['ata', 'atalanta bc'],
  'fiorentina': ['fio', 'acf fiorentina'],
  'torino': ['tor', 'torino fc'],
  'bologna': ['bol', 'bologna fc'],
  'sassuolo': ['sas', 'us sassuolo'],
  'udinese': ['udi', 'udinese calcio'],
  'genoa': ['gen', 'genoa cfc'],
  'monza': ['monz', 'ac monza'],
  'lecce': ['lec', 'us lecce'],
  'salernitana': ['sal', 'us salernitana'],
  'empoli': ['emp', 'empoli fc'],
  'verona': ['hellas verona', 'hve', 'ver'],
  'hellas verona': ['verona', 'hve', 'ver'],
  'cagliari': ['cag', 'cagliari calcio'],
  'frosinone': ['fro', 'frosinone calcio'],
  'cremonese': ['cre', 'us cremonese'],
  'spezia': ['spe', 'spezia calcio'],
  'sampdoria': ['sam', 'uc sampdoria'],
  'parma': ['par', 'parma calcio'],

  // ── Bundesliga (Germany) ──
  'bayern munich': ['bayern', 'fcb', 'fc bayern', 'bayern munchen', 'bayern munic'],
  'bayern': ['bayern munich', 'fcb', 'fc bayern', 'bayern munchen'],
  'borussia dortmund': ['bvb', 'dortmund', 'bvb dortmund'],
  'dortmund': ['bvb', 'borussia dortmund'],
  'rb leipzig': ['leipzig', 'rbl', 'rb leipzig'],
  'leipzig': ['rb leipzig', 'rbl'],
  'borussia monchengladbach': ['monchengladbach', 'gladbach', 'bmg', 'borussia mgladbach'],
  'gladbach': ['monchengladbach', 'bmg', 'borussia monchengladbach'],
  'bayer leverkusen': ['leverkusen', 'b04', 'leverkussen'],
  'leverkusen': ['bayer leverkusen', 'b04'],
  'eintracht frankfurt': ['frankfurt', 'efr', 'sge', 'eintracht'],
  'frankfurt': ['eintracht frankfurt', 'efr'],
  'vfl wolfsburg': ['wolfsburg', 'wob', 'vfl wolfsburg'],
  'wolfsburg': ['vfl wolfsburg', 'wob'],
  'freiburg': ['sc freiburg', 'scf', 'freiburg'],
  'union berlin': ['union', 'fcu'],
  'mainz': ['mainz 05', 'm05', '1 fsv mainz 05'],
  'augsburg': ['fca', 'fc augsburg'],
  'hoffenheim': ['tsg hoffenheim', 'hof', '1899 hoffenheim'],
  'werder bremen': ['bremen', 'svw', 'werder'],
  'bremen': ['werder bremen', 'svw', 'werder'],
  'stuttgart': ['vfb stuttgart', 'vfb'],
  'bochum': ['vfl bochum', 'boc'],
  'hertha berlin': ['hertha', 'hsc', 'hertha bsc'],
  'hertha': ['hertha berlin', 'hsc'],
  'schalke 04': ['schalke', 's04', 'fc schalke 04'],
  'schalke': ['schalke 04', 's04'],
  'hamburg': ['hsv', 'fc hamburg'],
  'cologne': ['koln', 'fc koln', 'effzeh'],
  'koln': ['cologne', 'fc koln'],
  'darmstadt': ['sv darmstadt 98', 'svd'],
  'heidenheim': ['1 fc heidenheim', 'fch'],

  // ── Ligue 1 (France) ──
  'paris saint-germain': ['psg', 'paris sg', 'paris', 'paris saint germain', 'paris sg'],
  'psg': ['paris saint-germain', 'paris'],
  'marseille': ['om', 'olympique marseille', 'om marseille'],
  'monaco': ['asm', 'as monaco'],
  'lyon': ['ol', 'olympique lyonnais'],
  'lille': ['losc', 'lille osc'],
  'nice': ['ogc nice', 'ogcn'],
  'rennes': ['sr', 'stade rennais'],
  'lens': ['rc lens', 'rcl'],
  'montpellier': ['mhsc', 'montpellier hsc'],
  'nantes': ['fc nantes', 'fcn'],
  'strasbourg': ['rcs', 'racing strasbourg'],
  'reims': 'stade de reims',
  'reims': ['stade de reims'],
  'toulouse': ['tfc', 'toulouse fc'],
  'brest': ['sb29', 'stade brestois'],
  'clermont': ['cfc', 'clermont foot'],
  'le havre': ['hac', 'le havre ac'],
  'metz': ['fc metz'],
  'lorient': ['fcl', 'fc lorient'],
  'angers': ['sco', 'angers sco'],
  'auxerre': ['aja', 'aj auxerre'],
  'troyes': ['estac', 'es troyes ac'],
  'ajaccio': ['acaj', 'ac ajaccio'],
  'lorient': ['fcl', 'fc lorient'],

  // ── MLS / North America ──
  'inter miami': ['miami', 'inter miami cf', 'imu'],
  'inter miami cf': ['inter miami', 'miami', 'imu'],
  'la galaxy': ['galaxy', 'los angeles galaxy', 'lag'],
  'galaxy': ['la galaxy', 'los angeles galaxy'],
  'los angeles fc': ['lafc', 'la fc'],
  'lafc': ['los angeles fc', 'la fc'],
  'new york city': ['nyc fc', 'nycfc', 'nyc'],
  'nycfc': ['new york city', 'nyc fc'],
  'new york red bulls': ['ny red bulls', 'nyrb', 'rba'],
  'red bulls': ['new york red bulls', 'nyrb'],
  'atlanta united': ['atl utd', 'atlanta utd', 'atlu'],
  'toronto fc': ['toronto', 'tfc'],
  'toronto': ['toronto fc', 'tfc'],
  'seattle sounders': ['seattle', 'sounders', 'sea'],
  'portland timbers': ['portland', 'timbers', 'ptt'],
  'portland': ['portland timbers', 'timbers'],
  'vancouver whitecaps': ['vancouver', 'whitecaps', 'van'],
  'vancouver': ['vancouver whitecaps', 'whitecaps'],
  'orlando city': ['orlando', 'ocsc', 'orl'],
  'orlando': ['orlando city', 'ocsc'],
  'dallas': ['fc dallas', 'fdal'],
  'fc dallas': ['dallas'],
  'houston dynamo': ['houston', 'dynamo', 'hou'],
  'houston': ['houston dynamo', 'dynamo'],
  'austin fc': ['austin', 'atx'],
  'austin': ['austin fc', 'atx'],
  'sporting kansas city': ['kansas city', 'sporting kc', 'skc'],
  'kansas city': ['sporting kansas city', 'sporting kc'],
  'colorado rapids': ['colorado', 'rapids', 'col'],
  'real salt lake': ['salt lake', 'rsl', 'utah'],
  'salt lake': ['real salt lake', 'rsl'],
  'san jose earthquakes': ['san jose', 'earthquakes', 'sjq', 'sj'],
  'san jose': ['san jose earthquakes', 'sjq', 'sj'],
  'columbus crew': ['columbus', 'crew', 'clb'],
  'columbus': ['columbus crew', 'crew', 'clb'],
  'cincinnati': ['fc cincinnati', 'cincy', 'cin'],
  'fc cincinnati': ['cincinnati', 'cincy'],
  'nashville sc': ['nashville', 'nsh'],
  'nashville': ['nashville sc', 'nsh'],
  'charlotte fc': ['charlotte', 'clt', 'clt fc'],
  'charlotte': ['charlotte fc', 'clt'],
  'chicago fire': ['chicago', 'fire', 'chi'],
  'chicago': ['chicago fire', 'fire'],
  'dc united': ['dcu', 'dc', 'washington dc'],
  'new england revolution': ['new england', 'revolution', 'nerev', 'ne'],
  'philadelphia union': ['philadelphia', 'union', 'phi'],
  'philadelphia': ['philadelphia union', 'union'],
  'montreal impact': ['montreal', 'cf montreal', 'cfm', 'mtl'],
  'montreal': ['cf montreal', 'montreal impact', 'mtl'],
  'st louis city': ['st louis', 'stl', 'st louis city sc'],
  'st louis': ['st louis city', 'stl'],

  // ── NBA (Basketball) ──
  'boston celtics': ['celtics', 'bos', 'boston'],
  'brooklyn nets': ['nets', 'bkn', 'brooklyn'],
  'new york knicks': ['knicks', 'nyk', 'ny knicks'],
  'knicks': ['new york knicks', 'nyk'],
  'philadelphia 76ers': ['76ers', 'sixers', 'phi', 'phila 76ers'],
  '76ers': ['sixers', 'philadelphia 76ers'],
  'sixers': ['76ers', 'philadelphia 76ers'],
  'toronto raptors': ['raptors', 'tor'],
  'raptors': ['toronto raptors', 'tor'],
  'chicago bulls': ['bulls', 'chi'],
  'bulls': ['chicago bulls', 'chi'],
  'cleveland cavaliers': ['cavaliers', 'cavs', 'cle'],
  'cavaliers': ['cavs', 'cleveland cavaliers', 'cle'],
  'cavs': ['cavaliers', 'cleveland cavaliers'],
  'detroit pistons': ['pistons', 'det'],
  'pistons': ['detroit pistons', 'det'],
  'indiana pacers': ['pacers', 'ind'],
  'pacers': ['indiana pacers', 'ind'],
  'milwaukee bucks': ['bucks', 'mil'],
  'bucks': ['milwaukee bucks', 'mil'],
  'atlanta hawks': ['hawks', 'atl'],
  'hawks': ['atlanta hawks', 'atl'],
  'charlotte hornets': ['hornets', 'cha'],
  'hornets': ['charlotte hornets', 'cha'],
  'miami heat': ['heat', 'mia'],
  'heat': ['miami heat', 'mia'],
  'orlando magic': ['magic', 'orl'],
  'magic': ['orlando magic', 'orl'],
  'washington wizards': ['wizards', 'was'],
  'wizards': ['washington wizards', 'was'],
  'denver nuggets': ['nuggets', 'den'],
  'nuggets': ['denver nuggets', 'den'],
  'minnesota timberwolves': ['timberwolves', 'wolves', 'min', 'minnesota'],
  'wolves': ['timberwolves', 'minnesota timberwolves'],
  'oklahoma city thunder': ['thunder', 'okc', 'oklahoma'],
  'thunder': ['oklahoma city thunder', 'okc'],
  'portland trail blazers': ['trail blazers', 'blazers', 'por', 'portland'],
  'blazers': ['trail blazers', 'portland trail blazers', 'por'],
  'utah jazz': ['jazz', 'uta', 'utah'],
  'jazz': ['utah jazz', 'uta'],
  'golden state warriors': ['warriors', 'gsw', 'golden state', 'gs'],
  'warriors': ['golden state warriors', 'gsw'],
  'la clippers': ['clippers', 'lac', 'la clip'],
  'clippers': ['la clippers', 'lac'],
  'los angeles lakers': ['lakers', 'lal', 'la lakers'],
  'lakers': ['los angeles lakers', 'lal'],
  'phoenix suns': ['suns', 'phx'],
  'suns': ['phoenix suns', 'phx'],
  'sacramento kings': ['kings', 'sac', 'sacto'],
  'kings': ['sacramento kings', 'sac'],
  'dallas mavericks': ['mavericks', 'mavs', 'dal'],
  'mavericks': ['mavs', 'dallas mavericks', 'dal'],
  'mavs': ['mavericks', 'dallas mavericks'],
  'houston rockets': ['rockets', 'hou'],
  'rockets': ['houston rockets', 'hou'],
  'memphis grizzlies': ['grizzlies', 'mem', 'grizz'],
  'grizzlies': ['memphis grizzlies', 'mem'],
  'new orleans pelicans': ['pelicans', 'pels', 'nop', 'no'],
  'pelicans': ['new orleans pelicans', 'nop'],
  'san antonio spurs': ['spurs', 'sas', 'sa spurs'],
  'spurs': ['san antonio spurs', 'sas'],

  // ── Euroleague / EuroCup ──
  'real madrid basketball': ['real madrid baloncesto', 'rmb'],
  'cska moscow': ['cska', 'cska moskva'],
  'olympiacos': ['oly', 'olympiacos piraeus'],
  'panathinaikos': ['pana', 'pao', 'panathinaikos athens'],
  'barcelona basketball': ['fc barcelona basket', 'barca basket'],
  'fenerbahce': ['fener', 'fenerbahce ulker'],
  'anadolu efes': ['efes', 'efes pilsen'],
  'zalgiris': ['zalgiris kaunas', 'zalg'],
  'maccabi tel aviv': ['maccabi', 'mta'],
  'maccabi': ['maccabi tel aviv'],
  'virtus bologna': ['virtus', 'virtus segafredo'],
  'milano': ['olimpia milano', 'ea7 emporio armani'],
  'monaco basketball': ['as monaco basket', 'monaco'],
  'red star belgrade': ['crvena zvezda', 'red star', 'czv'],
  'partizan': ['partizan belgrade', 'partizan nis', 'par'],
  'bayern munich basketball': ['bayern basketball', 'fcb basket'],
  'valencia basketball': ['valencia basket', 'val basket'],
  'unica malaga': ['malaga', 'unicaja'],
};

// ─── Build the full variant set for a team name ─────────────────────────────
export function getTeamVariants(name: string): string[] {
  const normalized = normalizeTeamName(name);
  if (!normalized) return [];

  const variants = new Set<string>();
  variants.add(normalized);

  // Word-level: add each word if 3+ chars (e.g., "city" from "manchester city")
  const words = normalized.split(' ').filter(w => w.length >= 3);
  for (const w of words) variants.add(w);

  // First word (e.g., "manchester")
  if (words.length > 1) variants.add(words[0]);

  // Last word (e.g., "city")
  if (words.length > 1) variants.add(words[words.length - 1]);

  // First 3 letters (only if not already too short)
  if (normalized.length > 4) variants.add(normalized.substring(0, 4));
  if (normalized.length > 3) variants.add(normalized.substring(0, 3));

  // Lookup aliases (both directions: canonical → alternates, alternate → canonical)
  for (const [key, values] of Object.entries(TEAM_ALIASES)) {
    const normKey = normalizeTeamName(key);
    // If our team name matches/contains the canonical key (or vice versa), add all its aliases
    if (normalized === normKey || normalized.includes(normKey) || normKey.includes(normalized)) {
      for (const v of values) {
        const nv = normalizeTeamName(v);
        if (nv) variants.add(nv);
      }
    }
    // Reverse: if our team name matches one of the aliases, add the canonical and all siblings
    for (const v of values) {
      const nv = normalizeTeamName(v);
      if (nv && (normalized === nv || normalized.includes(nv) || nv.includes(normalized))) {
        variants.add(normKey);
        for (const v2 of values) {
          const nv2 = normalizeTeamName(v2);
          if (nv2) variants.add(nv2);
        }
      }
    }
  }

  // Filter out anything shorter than 3 chars (too noisy)
  return [...variants].filter(v => v.length >= 3);
}

// ─── Score how strongly a team matches an event name ────────────────────────
// Returns 0..1 — 1.0 = exact, 0.7+ = strong partial, 0.4+ = weak, <0.4 = no match
export function teamMatchScore(variants: string[], eventName: string): number {
  const nameLower = normalizeTeamName(eventName);
  if (!nameLower) return 0;

  let best = 0;
  for (const v of variants) {
    if (v.length < 3) continue;

    // Exact full-name match → 1.0
    if (nameLower === v) {
      best = Math.max(best, 1.0);
      continue;
    }

    // Variant is a token (single word) inside the event name → strong match
    // Use word boundary to avoid "city" matching "intercity"
    const wordBoundary = new RegExp(`\\b${v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
    if (wordBoundary.test(nameLower)) {
      // Longer variant = more specific = higher score
      const specificity = Math.min(1, v.length / 8);
      best = Math.max(best, 0.7 + specificity * 0.3);
      continue;
    }

    // Variant is a substring of event name (no word boundary) → moderate match
    if (nameLower.includes(v) && v.length >= 4) {
      best = Math.max(best, 0.55);
      continue;
    }

    // Event name is a substring of variant → weak match (event name might be partial)
    if (v.includes(nameLower) && nameLower.length >= 4) {
      best = Math.max(best, 0.45);
      continue;
    }
  }

  return best;
}

// ─── Score an entire event against both teams ───────────────────────────────
// Returns { score, homeScore, awayScore, bothMatch, eitherMatch }
export function scoreEventMatch(
  homeVariants: string[],
  awayVariants: string[],
  eventName: string,
): { score: number; homeScore: number; awayScore: number; bothMatch: boolean; eitherMatch: boolean } {
  const homeScore = teamMatchScore(homeVariants, eventName);
  const awayScore = teamMatchScore(awayVariants, eventName);
  const bothMatch = homeScore >= 0.5 && awayScore >= 0.5;
  const eitherMatch = homeScore >= 0.5 || awayScore >= 0.5;
  // Combined: if both match strongly → 1.0; if both match weakly → 0.6; if only one → 0.3
  const score = (homeScore + awayScore) / 2;
  return { score, homeScore, awayScore, bothMatch, eitherMatch };
}

// ─── STRICT event matching (Task 23 — anti "wrong match" guarantee) ─────────
//
// Problem this solves: with plain token matching, clicking "Tampa Bay Sun FC
// vs Fort Lauderdale United FC" ALSO matched the NWSL event "United States -
// NWSL : Seattle Reign vs Bay FC", because the generic token "bay" hit "Bay
// FC" and "united" hit the league prefix "United States". The user then saw a
// DIFFERENT match than the one they clicked.
//
// Fix, in three layers:
//   1. Strip the league prefix ("League : TeamA vs TeamB" → "TeamA vs TeamB")
//      so country/league words can never satisfy a team token.
//   2. Token COVERAGE of the full team name: the fraction of the team's
//      meaningful tokens (3+ chars, generic words like "fc"/"united"/"city"
//      excluded) found in the event. Requires ≥ 0.5 — a single generic word
//      can no longer carry a match.
//   3. Full-name containment: the exact team name (or a curated alias like
//      "lafc"/"psg") contained in the event forces a 1.0.

// Words that appear in thousands of team/league names — never trusted as
// stand-alone evidence.
const GENERIC_TOKENS = new Set([
  'fc', 'sc', 'cf', 'ac', 'as', 'sk', 'fk', 'bk', 'if', 'sv', 'vfl', 'vfb',
  'tsg', 'fsv', 'tsv', 'ssc', 'afc', 'cfc', 'rsc', 'rc', 'ca', 'ud', 'cd',
  'sd', 'ec', 'us', 'usa',
  'united', 'city', 'town', 'county', 'club', 'real', 'inter', 'sporting',
  'athletic', 'deportivo', 'wanderers', 'rangers', 'rovers', 'dynamo',
  'dynamos', 'olympique', 'olympiacos', 'olympic', 'national', 'academy',
]);

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Whole-word containment — substring includes() is far too loose for short
 *  aliases ('ne' ⊂ 'new' once pulled the whole New England family into every
 *  New York team's alias set and broke their scoring). */
function includesWord(haystack: string, needle: string): boolean {
  if (!haystack || !needle) return false;
  return new RegExp(`\\b${escapeRegExp(needle)}\\b`).test(haystack);
}

/**
 * Light plural stemming — "bulls" ↔ "bull", consistent on BOTH sides
 * (team names and event titles are stemmed the same way, so "Red Bull New
 * York" on DaddyLive matches "New York Red Bulls" from our data source).
 * Protective endings (ss/us/is) and short words are left untouched.
 */
function stemToken(w: string): string {
  if (w.length >= 5 && w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us') && !w.endsWith('is') && !w.endsWith('es')) {
    return w.slice(0, -1);
  }
  return w;
}

/** normalizeTeamName + per-token stemming, re-joined. */
function stemName(name: string): string {
  return normalizeTeamName(name).split(' ').map(stemToken).filter(Boolean).join(' ');
}

/** Tokens of a normalized name that carry real identity (falls back to all tokens). */
function meaningfulTokens(normalizedName: string): string[] {
  const toks = normalizedName.split(' ').filter(w => w.length >= 3);
  const meaningful = toks.filter(w => !GENERIC_TOKENS.has(w));
  return meaningful.length > 0 ? meaningful : toks;
}

/** Curated alias full-names for a team (dictionary only — no mechanical splits).
 *  Family inclusion uses WHOLE-WORD matching, and value-based inclusion needs
 *  a ≥6-char value — short ambiguous values ('bulls', 'ne') otherwise drag in
 *  unrelated families (Chicago Bulls / New England Revolution) and poison the
 *  forward token coverage. */
function dictionaryVariants(name: string): string[] {
  const normalized = normalizeTeamName(name);
  if (!normalized) return [];
  const out = new Set<string>([normalized]);
  for (const [key, values] of Object.entries(TEAM_ALIASES)) {
    const normKey = normalizeTeamName(key);
    const keyMatches =
      normalized === normKey ||
      includesWord(normalized, normKey) ||
      includesWord(normKey, normalized);
    let valueMatches = false;
    for (const v of values) {
      const nv = normalizeTeamName(v);
      if (nv && nv.length >= 6 &&
        (normalized === nv || includesWord(normalized, nv) || includesWord(nv, normalized))) {
        valueMatches = true;
        break;
      }
    }
    if (keyMatches || valueMatches) {
      out.add(normKey);
      for (const v of values) out.add(normalizeTeamName(v));
    }
  }
  return [...out].filter(v => v.length >= 3);
}

/**
 * Score ONE team against ONE team phrase from an event title (0..1).
 *
 * Forward coverage: every meaningful token of the team must be found in the
 * phrase — directly, or via INITIALS (DaddyLive abbreviates sponsor compounds:
 * "New York RB" for "Red Bull New York" / "New York Red Bulls"; a 2-3 char
 * alphabetic phrase token whose letters match the initials of consecutive
 * team tokens credits that whole sequence).
 *
 * Reverse coverage (anti false-positive): every meaningful token of the
 * phrase must be covered by the team. Without this, "New York City FC"
 * ([new, york] after generic stripping) scores 1.0 against the phrase
 * "New York RB" — two DIFFERENT New York clubs — and the user gets channels
 * playing the wrong derby. Reverse coverage rejects it because "rb" is not
 * explained by NYCFC's name.
 */
function scoreTeamInPhrase(teamName: string, phraseNorm: string): number {
  if (!phraseNorm || !teamName) return 0;
  // Dictionary lookup uses the UNSTEMMED normalized name (stemming is for
  // comparison only — "Los Angeles" must still find the 'lafc' alias family).
  const teamRaw = normalizeTeamName(teamName);
  const teamNorm = stemName(teamName);
  if (!teamNorm || !teamRaw) return 0;

  const evTokenList = phraseNorm.split(' ').filter(Boolean);

  // Score against the BEST variant (union of all variants' tokens would let
  // one alias family's irrelevant tokens drag a true match below threshold).
  let best = 0;
  for (const variant of [teamNorm, ...dictionaryVariants(teamRaw).map(stemName)]) {
    const vToks = meaningfulTokens(variant);
    if (vToks.length === 0) continue;

    // Forward coverage — direct token hits + initials credit: a 2-3 char
    // phrase token whose letters are the initials of consecutive variant
    // tokens credits that whole sequence ("New York RB" covers "Red Bull").
    const credit = new Set<string>();
    for (let len = 2; len <= Math.min(3, vToks.length); len++) {
      for (let i = 0; i + len <= vToks.length; i++) {
        const seq = vToks.slice(i, i + len);
        const initials = seq.map(t => t[0]).join('');
        if (evTokenList.includes(initials)) {
          for (const t of seq) credit.add(t);
        }
      }
    }
    let hits = 0;
    for (const tok of vToks) {
      if (credit.has(tok) || new RegExp(`\\b${escapeRegExp(tok)}\\b`).test(phraseNorm)) hits++;
    }
    let score = hits / vToks.length;

    // Full containment wins outright (curated aliases may be 3+ chars, the
    // plain team name needs 4+).
    const minLen = variant === teamNorm ? 4 : 3;
    if (variant.length >= minLen && phraseNorm.includes(variant)) score = 1;

    // Reverse coverage gate: every meaningful PHRASE token must be explained
    // by this variant (direct token or initials of a sequence). Kills
    // look-alike fixtures (NYCFC ≠ New York RB, Tampa Bay Sun ≠ Rowdies).
    // NOTE: phrase-side identity tokens go down to 2 chars — the 2-char
    // abbreviations ("rb" in "New York RB") are exactly the discriminating
    // tokens; meaningfulTokens() would filter them away and NYCFC would
    // score 1.0 against a New York RB fixture.
    const phraseIdentityToks = phraseNorm
      .split(' ')
      .filter(w => w.length >= 2 && !GENERIC_TOKENS.has(w));
    let fullyExplained = true;
    for (const pt of phraseIdentityToks) {
      let covered = new RegExp(`\\b${escapeRegExp(pt)}\\b`).test(variant);
      if (!covered) {
        for (let len = 2; len <= Math.min(3, vToks.length) && !covered; len++) {
          for (let i = 0; i + len <= vToks.length; i++) {
            if (vToks.slice(i, i + len).map(t => t[0]).join('') === pt) covered = true;
          }
        }
      }
      if (!covered) { fullyExplained = false; break; }
    }
    if (!fullyExplained) score = Math.min(score, 0.5);

    if (score > best) best = score;
  }
  return best;
}

/**
 * Score ONE team against an event title (0..1) with the strict rules above.
 * The event is split into team phrases ("TeamA vs TeamB") and the team is
 * scored against its BEST phrase with bidirectional token coverage.
 * 1.0 = full name (or alias) contained; 0.75+ = strict match;
 * < 0.75 = insufficient evidence → treat as NO match.
 */
export function scoreTeamInEvent(teamName: string, eventName: string): number {
  const raw = (eventName || '').replace(/[\u{1F1E6}-\u{1F1FF}]/gu, ' ');
  if (!raw || !teamName) return 0;
  const phrases = raw
    .split(/\s+(?:vs\.?|v\.?)\s+/i)
    .map(p => stemName(p.replace(/\s+/g, ' ').trim()))
    .filter(p => p.length >= 3);
  const candidates = phrases.length > 0 ? phrases : [stemName(raw)];
  let best = 0;
  for (const phrase of candidates) {
    const s = scoreTeamInPhrase(teamName, phrase);
    if (s > best) best = s;
  }
  return best;
}

/**
 * Check an event against both teams STRICTLY.
 * - Strips the "League : " prefix from DaddyLive event titles first.
 * - Returns per-team scores; `ok` requires BOTH teams ≥ 0.75.
 *   (0.75, not 0.5: "Tampa Bay Rowdies" shares 2 of 3 tokens with "Tampa Bay
 *   Sun" — different clubs in different USL leagues. A 2/3 token overlap must
 *   NOT be treated as the same fixture.)
 */
export function matchEventStrict(
  homeTeam: string,
  awayTeam: string,
  eventName: string,
): { home: number; away: number; ok: boolean } {
  let name = eventName || '';
  // DaddyLive format: "⚽ 🇺🇸 USL Super League : Tampa Bay Sun 🇺🇸 vs Fort Lauderdale United 🇺🇸"
  // Drop everything up to the last " : " so league/country words are never scored.
  const colonIdx = name.lastIndexOf(' : ');
  if (colonIdx > 0) name = name.slice(colonIdx + 3);

  const home = scoreTeamInEvent(homeTeam, name);
  const away = scoreTeamInEvent(awayTeam, name);
  return { home, away, ok: home >= 0.75 && away >= 0.75 };
}

// ─── Clean HTML from category/event names ───────────────────────────────────
export function cleanHtml(text: string): string {
  return (text || '').replace(/<\/?span>/g, '').replace(/<\/?[^>]+>/g, '').trim();
}

// ─── Detect sport from category/event ──────────────────────────────────────
export function detectSport(eventName: string, category: string): string {
  const catLower = cleanHtml(category).toLowerCase();
  if (catLower.includes('soccer') || catLower.includes('football')) return 'football';
  if (catLower.includes('basketball') || catLower.includes('nba')) return 'basketball';
  if (catLower.includes('tennis')) return 'tennis';
  if (catLower.includes('mma') || catLower.includes('ufc') || catLower.includes('boxing')) return 'fighting';
  if (catLower.includes('hockey') || catLower.includes('nhl')) return 'hockey';
  if (catLower.includes('baseball') || catLower.includes('mlb')) return 'baseball';
  if (catLower.includes('cricket')) return 'cricket';
  if (catLower.includes('rugby')) return 'rugby';
  if (catLower.includes('golf')) return 'golf';

  const nameLower = (eventName || '').toLowerCase();
  if (nameLower.includes(' nba ') || nameLower.includes('basketball') || nameLower.includes(' ncaa ')) return 'basketball';
  if (
    nameLower.includes('premier league') ||
    nameLower.includes('la liga') ||
    nameLower.includes('serie a') ||
    nameLower.includes('bundesliga') ||
    nameLower.includes('champions league') ||
    nameLower.includes('liga mls') ||
    nameLower.includes('major league soccer')
  ) return 'football';

  return 'other';
}

// ─── Common dead/seized domains (shared) ────────────────────────────────────
export const DEAD_DOMAINS = [
  'streams.center',
  'streamcenter.pro',
  'tvhd2.com',
  'kora-api.top',
  'sportsonlinne.click',
  'dlhd.click',
];

export function isDeadUrl(url: string): boolean {
  return DEAD_DOMAINS.some(d => url.includes(d));
}

// ─── Build today's date key (UTC) for schedule day filtering ────────────────
export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
