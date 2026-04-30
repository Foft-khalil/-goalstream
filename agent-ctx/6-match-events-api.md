# Task 6 - Match Events API Route

## Agent: Main Developer
## Status: Completed

## Summary
Created `/home/z/my-project/src/app/api/match-events/route.ts` — a GET API endpoint for live match event tracking.

## What was created

### `/api/match-events/route.ts` (426 lines)
A complete GET endpoint that:

1. **Accepts query parameters**: `matchId` (required) and `league` (optional, defaults to `eng.1`)
2. **Strips "espn_" prefix** from matchId if present
3. **Fetches from ESPN API**: `https://site.api.espn.com/apis/site/v2/sports/soccer/{league}/summary?event={eventId}`
4. **Parses commentary data** to extract:
   - Goals (with assist player, own goal, penalty detection)
   - Yellow/Red cards
   - Substitutions (player in/out)
   - Period start/end events
   - VAR review events
5. **Uses existing cache library** (`@/lib/football/cache`) with `hasLive=true` for 15s TTL (closest to requested 10s with existing cache API)
6. **Error handling**:
   - Returns 400 if matchId is missing
   - Returns 200 with empty events array + error message on ESPN API failures
   - Falls back to stale cache on errors
   - 10-second timeout for ESPN fetches
7. **All user-facing messages in French**

## Type definitions (exported from route)
```typescript
interface MatchEvent {
  id: string;
  type: 'goal' | 'yellow_card' | 'red_card' | 'substitution' | 'period_start' | 'period_end' | 'var_review';
  minute: number;
  team: string;
  teamLogo: string | null;
  player: string;
  assistPlayer?: string;
  playerIn?: string;
  detail?: string;
  homeScore: number;
  awayScore: number;
}

interface MatchEventsResponse {
  events: MatchEvent[];
  matchId: string;
  lastUpdated: string;
  error?: string;
}
```

## Search results
- **No "Erreur lors du chargement" component found** in the codebase
- **No match-tracker component found** — the existing `MatchCard` and `LiveMatches` components don't consume match events data yet
- The existing `MatchEvent` type in `/lib/football/types.ts` is a simpler version used by the football detail API (which uses z-ai-web-dev-sdk)
- The new route uses direct ESPN API fetches instead, providing more reliable real-time data

## Verification
- `bun run lint` — passed with no errors
- Dev log shows no compilation errors related to the new file
