---
Task ID: 9
Agent: Main Agent
Task: Implement extended calendar showing matches for 3 days (today + tomorrow + day after)

Work Log:
- Updated `src/lib/football/types.ts` — Added `dates?: string[]` field to `FootballMatchesResponse`
- Updated `src/lib/basketball/types.ts` — Added `dates?: string[]` field to `BasketballMatchesResponse`
- Rewrote `src/app/api/football/route.ts`:
  - Accepts `date` (single YYYYMMDD) and `dates` (comma-separated) query params
  - Default: fetches 3 days (today + tomorrow + day after tomorrow)
  - Adds `?dates={date}` parameter to ESPN scoreboard URL
  - Fetches all dates in parallel via `fetchESPNMatchesForDate()` per date
  - Includes finished matches in response (was previously filtered out)
  - Per-date cache key: `football-matches-{date}` for single date, `football-matches-3day` for multi
  - Response includes `dates` array so client knows which dates were fetched
  - Backward compatible: no date param = 3-day fetch
- Rewrote `src/app/api/basketball/route.ts`:
  - Same changes as football: `date`/`dates` params, 3-day default, include finished matches
  - Per-date cache: `basketball-matches-{date}` or `basketball-matches-3day`
  - Parallel date fetching
- Updated `src/lib/store.ts`:
  - Added `DateTab` type: `'today' | 'tomorrow' | 'dayAfter'`
  - Added `footballDates: string[]`, `selectedDate: DateTab`, `setSelectedDate` to football section
  - Added `basketballDates: string[]`, `selectedBasketballDate: DateTab`, `setSelectedBasketballDate` to basketball section
  - Updated `fetchFootballMatches(dates?)` and `fetchBasketballMatches(dates?)` to accept optional dates param
  - Fetch functions now pass `dates` query param and store response `dates` array
- Rewrote `src/components/live-matches.tsx`:
  - Added date tab selector at top: "Aujourd'hui" / "Demain" / "Après-demain"
  - Active tab: green background/underline/text, inactive: muted
  - Each tab shows match count badge (green when active, muted when inactive)
  - Sub-label shows date (e.g., "mar. 29" for tomorrow)
  - Client-side filtering by selected date using `isMatchOnDate()` helper
  - Added "Terminés" section for finished matches (with competition grouping)
  - Empty state per-tab when no matches on that date
  - Date helpers: `formatDateYMD()`, `getDateForTab()`, `isMatchOnDate()`
- Rewrote `src/components/basketball-matches.tsx`:
  - Same date tab selector as LiveMatches but with orange theme
  - Active tab: orange background/underline/text, orange count badges
  - Same client-side filtering, finished matches section, empty states
- Updated `src/components/favorites-view.tsx`:
  - Updated empty state message: "sur les 3 prochains jours" instead of "aujourd'hui"
  - Added date label display (Aujourd'hui/Demain/Après-demain/specific date) to FavoriteMatchCard
- Verified: lint passes clean, dev server running
- Tested: Football API returns 7 matches across 3 dates, Basketball API returns 15 matches across 3 dates

Stage Summary:
- Extended calendar shows matches for 3 days instead of just today
- Date tab selector in football (green) and basketball (orange) sections
- Tabs show match count badges, client-side filtering for instant switching
- Finished matches now included in response (shown in "Terminés" section)
- API supports `date`/`dates` params for backward compatibility and flexibility
- Per-date caching for efficient API usage

---
Task ID: 7
Agent: Main Agent
Task: Implement push notifications for favorite team matches (15 min before kickoff)

Work Log:
- Created `/home/z/my-project/src/hooks/use-notifications.ts` — a React hook that:
  - Requests browser notification permission via `Notification.requestPermission()`
  - Checks favorite teams (from useFavorites) against upcoming matches every 60 seconds
  - When a favorite team's match starts within ≤15 minutes, sends a browser Notification
  - Notification body format: "PSG vs Marseille commence dans 12 min — Ligue 1"
  - Tracks already-notified match IDs in localStorage (`goalstream_notified_matches`) to avoid duplicates
  - Cleans up old notified IDs when matches are no longer in the data
  - On notification click, focuses the app window
  - Persists enabled/disabled setting in localStorage (`goalstream_notifications_enabled`)
  - Derives `notificationsEnabled` from both the setting and browser permission state
  - Returns: `requestPermission()`, `permissionState`, `notificationsEnabled`, `toggleNotifications()`, `upcomingFavoriteCount`
- Updated `/home/z/my-project/src/app/page.tsx`:
  - Imported `useNotifications` hook, `Bell` and `BellOff` icons from lucide-react
  - Added notification bell button in desktop header (next to install button):
    - Green Bell icon when enabled, muted BellOff when disabled
    - Small pulsing green badge dot when there are upcoming favorite matches
    - Click toggles notifications or requests permission
  - Added notification bell button in mobile header (next to hamburger menu):
    - Same styling as desktop but slightly larger for touch
    - Wrapped mobile bell + Sheet menu in a flex container
- Fixed lint issues:
  - Used lazy state initializer for `permissionState` to avoid setState in effect
  - Derived `notificationsEnabled` instead of syncing with effect
  - Used `useEffect` to update ref value (not during render)
  - Fixed JSX closing tag mismatch from wrapping mobile elements in div

Stage Summary:
- Push notifications alert users 15 min before their favorite team's match starts
- Works for both football and basketball matches
- Bell icon in header shows notification status (green = enabled, muted = disabled)
- Badge dot appears when upcoming favorite matches are within the alert window
- Duplicate notification prevention via localStorage tracking
- Lint passes clean, dev server running
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

---
Task ID: 8
Agent: Main Agent
Task: Implement multiple IPTV sources + periodic channel health checking

Work Log:
- Updated `src/lib/iptv.ts` — Multiple M3U playlist sources:
  - Added 5 sources: sports.m3u (existing), fra.m3u, eng.m3u, ara.m3u, spa.m3u
  - Sources defined in IPTV_SOURCES array with priority ordering (sports first)
  - All sources fetched in parallel with Promise.allSettled (graceful degradation if any fails)
  - Channels merged and deduped by URL (first seen wins = sports source has priority)
  - Added `source` field to ParsedChannel interface (tracks which playlist each channel came from)
  - Kept fetchSportsChannels() as the main function name (backward compatible)
  - Kept fetchCountryChannels() unchanged (added source field as `country-{code}`)
  - 1-hour cache preserved, stale cache fallback on error preserved
- Created `src/lib/channel-health.ts` — Shared in-memory health status map:
  - `getChannelHealth(url)`: returns 'online' | 'offline' | 'unknown'
  - `setChannelHealth(url, status)`: stores health status for a channel URL
  - `getHealthSummary()`: returns { total, online, offline } counts
  - Used by both the health-cron route and the channels route
- Created `src/app/api/channels-health-cron/route.ts` — Periodic health checking endpoint:
  - GET endpoint that fetches all sports channels and checks up to 50 at a time
  - Uses HEAD requests with 8s timeout per channel (same approach as channels-check)
  - 1-hour cooldown: won't run more than once per hour (tracked via in-memory timestamp)
  - Returns summary: { checked, online, offline, lastChecked, cooldown, totalTracked }
  - Results stored in the shared channel-health map for other routes to consume
- Updated `src/app/api/channels/route.ts` — Integrated health status:
  - Imports getChannelHealth from the shared health map
  - Enriches each channel with a `health` field from the pre-populated health map
  - Channels now return with health status pre-populated when available
- Updated `src/lib/store.ts` — Client-side health integration:
  - Added `source` field to Channel interface
  - Updated fetchChannels to prefer API-provided `health` field over client-side cache
  - Falls back to client-side channelHealthCache if no server health available
- Verified: channels API returns 4716 channels (up from ~500 with single source) with `source` and `health` fields
- Verified: health-cron API checked 50 channels (30 online, 20 offline), cooldown works correctly
- Lint passes clean, dev server running

Stage Summary:
- IPTV channels now fetched from 5 M3U sources (sports, French, English, Arabic, Spanish)
- Channel count increased from ~500 to ~4700+ with proper deduplication
- Each channel tracks its source playlist for transparency
- Periodic health cron endpoint checks 50 channels per hour with cooldown
- Channels API returns pre-populated health status from the shared health map
- Client-side store prefers server-provided health status over local cache
---
Task ID: 10
Agent: Main Agent
Task: Fix wrong channel matching for PSG-Bayern and non-working IPTV channels

Work Log:
- Diagnosed root cause: PSG-Bayern was returning CBS News affiliates and wrong channels
- Rewrote `src/lib/iptv.ts`:
  - Added 10 IPTV sources (sports, fra, eng, ara, spa, deu, ita, por, tur, football category)
  - Added `isSportsChannel()` to detect actual sports channels
  - Added `isLocalAffiliate()` to filter out CBS/NBC/ABC local news stations
  - Added `fetchCountryChannelsBatch()` for parallel country-specific channel fetching
  - Added `checkStreamsBatch()` for parallel real-time health checking
  - Country-specific channel caching
- Rewrote `src/app/api/match-stream/route.ts`:
  - Country-aware broadcaster priority (France = highest for French users)
  - Structured broadcaster database per competition with country + priority info
  - Added L'Equipe, CBS Sports Golazo as known French/football channels
  - French-language web search query ("chaine TV diffusion direct")
  - Real-time stream health check on top 12 candidates
  - Combined score sorting (relevance + health + broadcaster match + geo-blocked penalty)
  - Free sports channel injection (L'Equipe, CBS Golazo, FIFA+, ERT Sports, etc.)
  - Blacklist filtering (combat, strongman, poker, etc.)
  - Canal+ vs generic "Canal" name filtering
  - Geo-blocked channel penalty (-80 points)
  - Non-sports broadcaster match penalty
  - Team country detection for country-specific channel fetching
- Updated `src/lib/channel-health.ts`:
  - Added `setChannelHealthBatch()`, `getChannelHealthBatch()`, `countOnline()`
- Updated `src/app/api/channels-health-cron/route.ts`:
  - Now checks 100 channels (was 50)
  - Fetches from 5 country sources (fr, gb, de, es, it)
  - Prioritizes sports channels in health checks
- Updated match card components to show health indicators (green/red dots)
  - `src/components/match-card.tsx`: Added health field, online/offline indicators, opacity for offline
  - `src/components/basketball-match-card.tsx`: Same updates
- Test results: PSG vs Bayern now shows L'Equipe, CBS Sports Golazo, beIN Sports Xtra as top results
  - Before: CBS News Baltimore, CBS 2 Salt Lake City (wrong channels)
  - After: L'Equipe, beIN Sports, CBS Sports Golazo (correct sports channels)

Stage Summary:
- Channel matching now country-aware (French channels prioritized for French users)
- Local TV affiliates (CBS News, NBC News) are filtered out
- Real-time health check verifies top channels before returning
- L'Equipe and CBS Sports Golazo now appear in results
- Geo-blocked channels are penalized in sorting
- Free sports channels injected directly into results
- 10 IPTV sources (was 5) including football.m3u category
- Health cron checks 100 channels from 5 countries
- Lint passes clean, dev server running
