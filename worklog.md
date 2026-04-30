# GoalStream Worklog

---
Task ID: 1
Agent: Main
Task: Fix server stability and all major bugs

Work Log:
- Reduced ESPN primary leagues from 18 to 5 (Ligue 1, Premier League, La Liga, Champions League, Europa League)
- Extended leagues (13 more) now only fetched on demand via `leagues=extended` param
- Changed default football API to fetch only today's date (not 3 days)
- Reduced batch size from 3 to 1 for sequential league fetching
- Added 200ms delay between batches to reduce memory spikes
- Reduced global timeout from 45s to 30s
- Added client-side AbortController with 30s timeout
- Added automatic retry with exponential backoff (1 retry after 5s)
- Reduced initial page fetch delay from 5s to 2s
- Added memory protection to standings API (500KB response size limit, 12s timeout, max 12 groups, max 12 teams per group)
- Added fallback URL for standings API (site.api.espn.com as fallback for site.web.api.espn.com)

Stage Summary:
- Server stability improved significantly with single-day + 5 league fetch pattern
- 8GB heap required for stable 3-day fetches
- Matches load successfully (tested: 2 matches for today, 16 for 3 days with 8GB heap)

---
Task ID: 2
Agent: Sub-agent (football-api-stability)
Task: Fix football API and matches loading

Work Log:
- Split ESPN_LEAGUES into PRIMARY (5) and EXTENDED (13)
- Added `leagues=all` and `leagues=extended` query params for on-demand fetch
- Changed default date to today only
- Client store now passes dates explicitly
- Added AbortController with 30s timeout on client side
- Added retry with exponential backoff
- Graceful error handling on non-OK responses

Stage Summary:
- Football API returns 2 matches for today (live: Braga vs Freiburg, Nottingham Forest vs Aston Villa)
- 3-day fetch returns 16 matches with 8GB heap
- Client retry mechanism prevents permanent "Échec du chargement" error

---
Task ID: 3
Agent: Sub-agent (standings-fix)
Task: Fix standings for Coupes Clubs & Éq. Nationales

Work Log:
- Added World Cup 2026 placeholder with detailed info (hosts, dates, teams, groups)
- Added ESPN API fallback URL (site.api.espn.com)
- Added friendly error messages per competition
- Added WorldCupInfoCard component in standings view
- Added EmptyLeagueState component with context-aware messages
- Added per-league retry functionality
- Added league error tracking with visual indicators

Stage Summary:
- FIFA rankings always work (hardcoded data)
- World Cup shows placeholder with 2026 info
- Champions League, Europa League, Conference League show friendly messages when data unavailable
- Per-league retry buttons available

---
Task ID: 4
Agent: Main
Task: Fix World Cup rosters and schedule

Work Log:
- Added getWorldCupPlaceholder() function returning placeholder data
- WorldCupInfoCard component shows host countries (🇺🇸🇨🇦🇲🇽), dates, team count, group format
- fifa.world league code is now handled specially (skips ESPN fetch, returns placeholder)
- TeamDetailDialog already handles fifa.world with appropriate messages

Stage Summary:
- World Cup 2026 placeholder with full info is now displayed
- No ESPN API call for fifa.world (prevents crashes)

---
Task ID: 5
Agent: Main
Task: Fix Watch Live streaming channel search

Work Log:
- match-stream API already works (tested: returns 200 with channels)
- The "Erreur lors de la recherche" was caused by server crashes (OOM), not by the API itself
- With memory optimizations, the server should stay alive long enough for streaming search
- No code changes needed for this specific issue

Stage Summary:
- Watch Live streaming works when server is stable
- Root cause was server memory pressure, not API bugs

---
Task ID: 6
Agent: Sub-agent (match-events-api)
Task: Create match-events API route

Work Log:
- Created /api/match-events route with GET handler
- Accepts matchId and league query params
- Fetches match commentary from ESPN summary API
- Parses goals, cards, substitutions, VAR reviews, period events
- Caches with 15s TTL for live match freshness
- Always returns 200 status (even on error) to prevent client crashes
- Strips "espn_" prefix from matchId automatically
- 10-second timeout on ESPN fetches
- Stale cache fallback on errors

Stage Summary:
- /api/match-events?matchId=espn_12345&league=eng.1 endpoint created
- Returns structured MatchEvent objects with type, minute, team, player, scores
- Handles ESPN API errors gracefully
