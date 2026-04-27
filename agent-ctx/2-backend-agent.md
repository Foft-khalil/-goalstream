# Task 2 - Backend Agent: Football API Routes

## Task
Create backend API routes for fetching real football match data using z-ai-web-dev-sdk.

## Files Created

1. **`/src/lib/football/cache.ts`** - In-memory cache utility
   - `getCached<T>(key)` - Returns cached data if fresh (< 5 min)
   - `getCachedStale<T>(key)` - Returns cached data even if stale (for error fallback)
   - `setCache<T>(key, data)` - Stores data with timestamp
   - `getCacheAge(key)` - Returns cache age in seconds

2. **`/src/lib/football/types.ts`** - TypeScript type definitions
   - `FootballMatch` - Match data structure
   - `MatchDetail` - Extended match with lineups, events, stats
   - `FootballMatchesResponse` - API response for list endpoint
   - `MatchDetailResponse` - API response for detail endpoint
   - `MatchEvent`, `MatchStat` - Event and stat structures

3. **`/src/app/api/football/route.ts`** - Main football matches endpoint
   - GET handler fetches match data via z-ai-web-dev-sdk
   - Searches for live scores + upcoming fixtures
   - Reads relevant page from search results
   - Extracts structured data via LLM
   - Enriches with stream URLs from Prisma database
   - Returns cached data (5-min TTL) or fresh data

4. **`/src/app/api/football/[id]/route.ts`** - Match detail endpoint
   - GET handler fetches detailed match info
   - Looks up match by ID in DB or cache
   - Searches for specific match details
   - Extracts lineups, events, stats via LLM
   - Returns detailed match data with caching

## Key Design Decisions
- Cache utility is shared between both routes
- Stale cache serves as fallback on errors
- Team name matching (case-insensitive) for DB stream enrichment
- Robust JSON parsing handles markdown code blocks in LLM output
- All z-ai-web-dev-sdk usage is server-side only (API routes)

## Verification
- `bun run lint` passes with no errors
- Dev server log shows successful API calls:
  - Search + LLM extraction working
  - Database query for stream enrichment working
  - Cache HIT/MISS working correctly
