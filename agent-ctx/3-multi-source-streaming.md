# Task 3: Multi-Source Streaming System

## Agent: Main
## Task ID: 3

## Summary
Implemented a multi-source streaming system for GoalStream with 3 new sources in addition to the existing iptv-org source.

## Changes Made

### 1. src/lib/iptv.ts
- Added Free-TV project to IPTV_SOURCES array
- Added ALTERNATIVE_SOURCES array for non-iptv-org playlists
- Added `fetchAlternativeSources()` function with caching and timeout

### 2. src/app/api/match-stream/route.ts
- Added `findStreamUrlViaSearch()` - uses z-ai-web-dev-sdk to find direct .m3u8 URLs via web search
- Added `KNOWN_FREE_STREAMS` database - maps competitions to free official streaming URLs
- Added `getKnownFreeStreams()` - returns official free streams with relevance 150
- Updated Step 2: also fetches alternative sources in parallel
- Added Step 2.5: web search for stream URLs runs in parallel with broadcaster search
- Updated Step 7: web-search results inserted at TOP (relevance 200+)
- Added Step 7.5: official free streams inserted (relevance 150)
- Tagged all IPTV results with source: 'iptv-org'
- Added source-aware scoring in finalScore()

### 3. src/components/match-card.tsx
- Added `source` field to FoundChannel interface
- Dynamic subtitle based on sources found
- Color-coded source badges: Web (violet), Officiel (emerald), IPTV (sky)

## Priority Order
1. web-search (relevance 200+, scoring +30)
2. official-free (relevance 150, scoring +20)
3. iptv-org (base relevance, no bonus)

## Key Design Decisions
- All z-ai-web-dev-sdk calls in backend only
- 10-second timeout for web search with graceful fallback
- 5-minute cache for web search results per match
- If one source fails, others still work independently
- iptv-org kept as FALLBACK (lowest priority), not primary
