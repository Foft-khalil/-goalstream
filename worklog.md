---
Task ID: 1
Agent: Main Agent
Task: Fix "Regarder" button not working - streams fail and player gets stuck

Work Log:
- Investigated the issue: when clicking "Regarder", match-stream API finds channels correctly but the IPTV streams are often dead/offline
- The video player would show loading forever or an error with no easy way to try another channel
- Added playerAlternatives to the store - openPlayer now accepts an array of alternative channels
- Rewrote MatchCard to use handleQuickPlay - finds channels and auto-opens first one, passing others as alternatives
- Added a TV icon button to manually show the channel picker
- Rewrote VideoPlayer with auto-switch: when a stream fails, it automatically tries the next alternative channel
- Improved HLS timeout settings for faster failure detection (10s timeout, 1 retry max)
- Error overlay now shows all alternative channels with SkipForward icons
- Updated match-stream API to return 8 channels (was 5) and prioritize HLS (.m3u8) streams
- Added HTTPS priority and non-HTTPS penalty in channel scoring
- Fixed React 19 strict lint issues with setState in effects

Stage Summary:
- Clicking "Regarder" now: finds channels → opens first one → auto-tries next if it fails
- Video player auto-cycles through available channels on stream failure
- Better error UI with list of alternative channels to try
- Lint passes clean, dev server running
---
Task ID: 1
Agent: main
Task: Fix no matches showing - replaced web_search with ESPN API + fixed Regarder button

Work Log:
- Replaced web_search+LLM with ESPN free public API (was getting 429 rate limited)
- ESPN API: 18 leagues, parallel fetch, ~1.6s, structured JSON with logos/scores/status
- Increased cache TTL from 2 to 5 minutes, auto-refresh from 60s to 120s
- Fixed VideoPlayer streamError variable reference bug
- Fixed SheetTitle accessibility error

Stage Summary:
- Football API now uses ESPN API (no auth, no rate limits, fast)
- Matches display correctly with real data
- Regarder button flow works end-to-end

---
Task ID: 2
Agent: Main Agent
Task: Replace Admin tab with Favorites feature (very important for user engagement)

Work Log:
- Created useFavorites hook (useSyncExternalStore + localStorage persistence)
- Created FavoritesView component showing favorited teams' matches and favorited channels
- Added ❤️ heart toggle buttons to MatchCard (both home and away teams)
- Added ❤️ heart toggle buttons to ChannelCard
- Updated ViewType in store to include 'favorites'
- Updated page.tsx with 4-tab navigation: Matchs, Favoris, Chaînes, Classement
- Favoris tab shows: favorited teams as pills, relevant matches (live/upcoming/finished), favorited channels
- Badge count on Favoris tab shows total favorites count
- Clean empty state with guidance on how to add favorites
- "Tout effacer" button with confirmation dialog
- Lint passes clean, app running on port 3000

Stage Summary:
- Admin tab completely replaced with Favoris (Favorites) feature
- Users can now save favorite teams and channels for quick access
- Favorite team matches are automatically filtered and shown in the Favoris tab
- Favorites persist in localStorage across sessions
- 4-tab navigation: Matchs → Favoris → Chaînes → Classement

---
Task ID: 3
Agent: Main Agent
Task: Add team detail view when clicking on a team in standings (Classement)

Work Log:
- Updated standings API to include teamId and leagueCode in team data
- Created /api/team/[id] route using ESPN Core API (sports.core.api.espn.com)
  - Team info: name, logo, color, venue (with city), coach, abbreviation
  - Roster: players with name, position, number, age, nationality
  - Schedule: upcoming and finished matches with scores, opponent, home/away
  - Stats: matches played, wins, draws, losses, goals for/against, goal diff
  - Form: last 5 results (W/D/L)
- Created TeamDetailDialog component with 3 tabs:
  - Infos: venue, coach, founded, abbreviation + season statistics grid
  - Effectif (Roster): grouped by position (GK, DEF, MID, ATT) with numbers and nationality
  - Calendrier (Schedule): live, upcoming, and finished matches with scores
- Updated standings-view.tsx: teams are now clickable, opens dialog on click
- Added ❤️ favorite toggle in team detail dialog header
- Form badges (V/N/D) with color coding (green/amber/red)
- Match rows show date, home/away badge, opponent logo, score with result colors
- Lint passes clean, app running on port 3000

Stage Summary:
- Clicking any team in the standings opens a detailed dialog
- Shows: team info, full roster, match calendar, season stats, recent form
- Data fetched from ESPN Core API (richer data than site API)
- Integrated with favorites - can add team to favorites from dialog

---
Task ID: 4
Agent: Main Agent
Task: Fix incorrect/outdated team detail data in Classement

Work Log:
- Diagnosed root cause: ESPN Site API schedule returns score as object `{value, displayValue}` not simple string, and `status.type.state` is null for all events
- Discovered ESPN Core API coach data is completely wrong (e.g., Mourinho for Man City, Ancelotti for PSG)
- Discovered ESPN Site API pre-populates fake/projected scores for ALL future season matches
- Fixed score parsing: added `parseScore()` function to handle both object and string formats
- Fixed match status: replaced `status.type.state` (always null) with date-based determination (`determineMatchStatus()`)
- Fixed future fake scores: upcoming matches now return homeScore/awayScore as null, hiding projected data
- Fixed coach data: replaced unreliable ESPN Core API coach endpoint with web search via z-ai-web-dev-sdk + LLM extraction
- Fixed roster: using season-specific athletes endpoint (`/seasons/2025/teams/{id}/athletes`) for current season data
- Optimized roster fetch: parallel Promise.allSettled for all athletes (was sequential)
- Added league name mapping (LEAGUE_NAMES) so team detail shows correct league
- Updated MatchRow component to show competition name for upcoming matches
- Verified all fixes: PSG coach now shows "Luis Enrique" (was "Carlo Ancelotti"), scores are correct, future matches don't show fake scores

Stage Summary:
- Score parsing fixed (object format from ESPN Site API)
- Match status determined from dates instead of broken status field
- Future matches no longer show fake/projected scores
- Coach data now from web search (accurate) instead of ESPN Core API (outdated)
- Roster uses current season endpoint
- All data verified correct across multiple teams/leagues

---
Task ID: 5
Agent: Main Agent
Task: Fix missing match date display + wrong IPTV channel for "Regarder" button

Work Log:
- Problem 1: Match cards only showed time (e.g., "15:00") but not the full date
  - Added date formatting: "Aujourd'hui 15:00", "Demain 20:00", or "28 avr. 15:00"
  - Updated MatchCard component to calculate isToday/isTomorrow and display accordingly
- Problem 2: "Regarder" button found wrong IPTV channels because keyword matching was too basic
  - The old approach only searched for team names in IPTV channel names, which rarely match
  - New approach: 3-step pipeline:
    1. Web search (z-ai-web-dev-sdk) to find the REAL broadcaster for the match
    2. Known broadcaster database per competition (Canal+/beIN for Ligue 1, Sky Sports/NBC for PL, etc.)
    3. Map broadcaster names to IPTV channel names (e.g., "beIN Sports" → "beIN SPORTS Xtra (1080p)")
  - Broadcaster matches are prioritized over keyword matches
  - Added broadcaster info display: "Diffusé sur: Canal+, beIN Sports" shown on the match card
  - Channel list shows which broadcaster each IPTV channel maps to (e.g., "via beIN SPORTS")
  - Added matchDate to the API request for better search context
- Tested: PSG vs Marseille → beIN SPORTS; Arsenal vs Man City → Sky Sports/NBC; Real Madrid vs Bayern → TNT Sports/Paramount+
- Lint passes clean

Stage Summary:
- Match dates now clearly displayed (today/tomorrow/full date)
- "Regarder" button now finds the CORRECT broadcaster channel via web search
- Broadcaster info shown on the card ("Diffusé sur: Canal+, beIN Sports")
- IPTV channels matched to real broadcasters for accurate stream selection

---
Task ID: 6
Agent: Main Agent
Task: Add dedicated basketball section to GoalStream

Work Log:
- Created basketball type definitions (`src/lib/basketball/types.ts`): BasketballMatch with period display, clock, abbreviations, team records
- Created basketball cache module (`src/lib/basketball/cache.ts`): 5-min TTL in-memory cache
- Created basketball API route (`src/app/api/basketball/route.ts`): Fetches from ESPN API for 4 leagues:
  - NBA: `basketball/nba`
  - NCAA Men's Basketball: `basketball/mens-college-basketball`
  - EuroLeague: `basketball/euroleague`
  - WNBA: `basketball/wnba`
- Basketball-specific parsing: Quarter display (Q1-Q4), OT periods, team records (e.g., "56-26"), abbreviations (BOS, LAL)
- Created BasketballMatchCard component (`src/components/basketball-match-card.tsx`):
  - Orange theme for live matches (vs red for football)
  - Period display with clock (e.g., "Q2 7:32")
  - Team records shown under team names
  - Abbreviation fallback when no logo
  - Same channel finder flow as football
- Created BasketballMatches component (`src/components/basketball-matches.tsx`):
  - Same layout as LiveMatches: live section + upcoming by competition
  - Auto-refresh every 2 min, countdown timer
  - Loading/error/empty states with orange theme
- Updated Zustand store (`src/lib/store.ts`):
  - Added `basketball` to ViewType
  - Added basketballMatches, basketballLoading, basketballError, basketballLastUpdated
  - Added fetchBasketballMatches action
- Updated main page (`src/app/page.tsx`):
  - Added Basketball tab with Dribbble icon to desktop nav and mobile bottom nav
  - Orange theme for basketball tab indicator
  - Live count badge (orange) for basketball
  - fetchBasketballMatches called on mount
  - Updated subtitle: "Sport en direct" (was "Football en direct")
- Updated match-stream API (`src/app/api/match-stream/route.ts`):
  - Added basketball broadcasters: NBA (ESPN, TNT, ABC, NBA TV), NCAA (CBS, TBS, truTV), EuroLeague, WNBA
  - Added basketball-specific broadcaster-to-IPTV mappings
  - Added sport parameter to search (basketball vs football context)
  - Added basketball keyword search terms
  - Updated getCompetitionKeywords with basketball competitions
- Enhanced football MatchCard: Added kickoff time display for live matches
- Tested: API returns 7 basketball matches (NBA + WNBA), logos and records work

Stage Summary:
- Full basketball section added as new "Basketball" tab
- Covers NBA, NCAA, EuroLeague, WNBA via ESPN API
- Basketball-specific match cards with quarters, records, abbreviations
- Orange visual theme (vs red for football)
- Match-stream API supports basketball channel finding
- Live match date display fixed for football cards

