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

---
Task ID: 3
Agent: full-stack-developer
Task: Create /api/streams route for kora-api.space integration

Work Log:
- Read worklog.md and reviewed existing project structure and API patterns
- Created `/home/z/my-project/src/app/api/streams/route.ts` with full kora-api.space integration
- Implemented POST handler with request body: { homeTeam, awayTeam, competition, sport }
- Implemented in-memory cache with 2-minute TTL using Map<string, CacheEntry>
- Implemented pagination support for kora-api (fetches additional pages if total > per_page * page)
- Implemented category filtering: basketball → category IDs [4, 26], football → category ID [9]
- Implemented fuzzy team name matching with:
  - Normalization (lowercase, strip common suffixes like FC, CF, SC, etc.)
  - Known abbreviation mapping (PSG ↔ Paris Saint-Germain, etc.)
  - Word-level partial matching (60% threshold)
  - Two-pass matching: strict (both teams) then lenient (at least one team)
- Added language flag emoji mapping for English, Spanish, Italian, Deutch, French, Portuguese, Arabic
- Added comprehensive NBA team abbreviations (30+ teams)
- Error handling: returns 200 with empty streams on kora-api failure, 400 on missing required fields
- Lint passed with zero errors
- Tested API with live matches:
  - "New York Knicks" vs "Atlanta Hawks" (basketball) → found match with English stream, isLive: true
  - "Boston Celtics" vs "Philadelphia 76ers" (basketball) → found match, isLive: false
  - "Knicks" vs "Hawks" (abbreviated) → correctly matched
  - "Celtics" vs "76ers" (abbreviated) → correctly matched
  - Missing awayTeam → 400 validation error
  - Cached responses served in ~24ms (well under 500ms target)

Stage Summary:
- New API route `POST /api/streams` fully functional at `/src/app/api/streams/route.ts`
- Integrates with kora-api.space (`https://ws.kora-api.space/api/matches`) for direct streaming links
- Supports both football (category 9) and basketball (categories 4, 26) filtering
- Fuzzy matching handles team name variations and abbreviations
- In-memory cache (2-min TTL) ensures fast repeated lookups
- Graceful error handling returns empty streams array on API failures

---
Task ID: 4-5-6-7
Agent: main
Task: Integrate kora-api.space streaming links, update match cards, fix video player for iframe streams

Work Log:
- Analyzed us-sport.eu website and discovered they use kora-api.space API for direct streaming links
- Created /api/streams route (POST) that fetches from kora-api.space and fuzzy-matches team names
- Updated match-card.tsx to use kora-api streams as primary source, IPTV as fallback
- Updated basketball-match-card.tsx with same kora-api + IPTV dual approach
- Added KoraStream type with language flags for stream display
- Updated video-player.tsx to support both HLS streams (video element) and iframe embed streams (iframe element)
- Added isHlsUrl() function to detect stream type
- For iframe streams: player shows iframe with autoplay/fullscreen/presentation permissions
- For HLS streams: player shows video element with hls.js (existing behavior)
- Added "DIRECT" badge for iframe-based streams in header
- Removed duplicate iframeReady declaration (was moved before its usage)
- Fixed lint error with setState in effect by computing iframeReady as derived state
- Basketball live matches already working from previous fix (Task ID 5 in worklog)

Stage Summary:
- New streaming flow: kora-api (primary, fast <1s) → IPTV (fallback, 10-45s)
- Stream URLs from kora-api are iframe embeds (e.g. https://streams.center/embed/ch67.php)
- Video player now supports both HLS (.m3u8) and iframe embed streams
- Stream selector shows kora streams with language flags (🇬🇧 English) and "DIRECT" badge
- IPTV channels shown as fallback when kora-api has no streams
- All lint checks pass, dev server running cleanly
