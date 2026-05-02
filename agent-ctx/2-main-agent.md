# Task 2 - Fix ESPN Standings API to fetch ALL groups

## Summary
Fixed the `fetchLeagueStandings` function to iterate ALL children (groups) from ESPN API instead of only `children[0]`. This allows international competitions like World Cup (12 groups A-L) and UEFA Nations League (14 groups) to display all teams instead of just 4.

## Files Changed
1. `src/app/api/standings/route.ts` - Added StandingsGroup interface, rewrote fetchLeagueStandings, added 3 new competitions
2. `src/lib/store.ts` - Added StandingsGroup export, updated StandingsLeague with groups field
3. `src/components/standings-view.tsx` - Added group tabs UI, activeGroup state, displayEntries filtering

## Key Decisions
- Used `handleLeagueChange` callback instead of useEffect to reset activeGroup (avoids lint error)
- `groups` field is only populated when there are 2+ groups (domestic leagues remain unchanged)
- Flat `entries` array still contains all teams for backward compatibility
- Group tabs color-coded by category: blue for national, amber for club

## Lint Status
All checks pass cleanly.
