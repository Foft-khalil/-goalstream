---
Task ID: 5
Agent: main
Task: Fix basketball live matches not showing — data flow issues

Work Log:
- Diagnosed root cause: basketball data flow had multiple issues preventing live matches from appearing
- Bug 1 (CRITICAL): API defaulted to only 3 days but UI showed 7 date tabs — tabs day3-day6 always empty
  - Fixed: Changed `getDefaultDates()` in `/api/basketball/route.ts` to return 7 days (today through day 6)
- Bug 2 (CRITICAL): `fetchBasketballMatches()` in store replaced all matches instead of merging
  - Fixed: Added merge logic — when fetching specific dates, keep existing matches for other dates, replace only the requested dates
  - Added deduplication by match ID and re-sorting (live → upcoming → finished)
  - Also merged `basketballDates` array instead of replacing
- Bug 3: Basketball data only loaded when user navigated to basketball tab (lazy), so live badge never showed
  - Fixed: Added pre-fetch in `page.tsx` — fetches today's basketball matches after 8s delay
  - Updated `basketball-matches.tsx` initial fetch to skip if data already exists from pre-fetch
- Bug 4: No on-demand date tab fetching (football has it, basketball didn't)
  - Fixed: Added `useEffect` in `basketball-matches.tsx` that fetches data when user clicks a date tab with no matches
- Bug 5: Cache key collision — `basketball-matches-3day` could match different date sets
  - Fixed: Changed cache key to use actual dates: `basketball-matches-${dates.join('-')}`
- Lint passed with zero errors
- Dev server running without compilation errors

Stage Summary:
- Basketball API now returns 7 days by default matching the 7-tab UI
- Basketball data merges properly when fetching additional dates
- Basketball data is pre-fetched on page load so live badge appears immediately in nav
- On-demand fetch when clicking empty date tabs
- Cache keys are now unique per date set
- All live basketball matches should now be visible
