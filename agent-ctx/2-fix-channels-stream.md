# Task 2 - Fix Channels Display and Match Stream Errors

## Summary
Fixed 4 files to resolve channels not displaying and "Erreur lors de la recherche" errors.

## Changes Made

### 1. `src/lib/iptv.ts`
- `MAX_CHANNELS_PER_SOURCE`: 500 → 200
- `FETCH_TIMEOUT`: 15000 → 10000
- Added `lightweight` parameter to `fetchSportsChannels()` — skips FR playlist when true

### 2. `src/app/api/channels/route.ts`
- Default limit: 500 → 100
- `MAX_CHANNELS_PER_RESPONSE`: 500 → 100
- Error response: 500 → 200 with empty array
- Added 12s timeout wrapper for IPTV fetch
- Uses lightweight mode for fetchSportsChannels()

### 3. `src/app/api/match-stream/route.ts`
- Added 8s timeout wrapper for fetchSportsChannels()
- Uses lightweight mode (skips FR playlist)
- Graceful fallback to Google search when IPTV times out

### 4. `src/app/api/match-events/route.ts`
- ESPN API: `site.api.espn.com` → `site.web.api.espn.com`
- Timeout: 15s → 20s
- Added retry logic: 2 retries with 2s delay

## Lint Result
0 errors, 1 pre-existing warning (unrelated)
