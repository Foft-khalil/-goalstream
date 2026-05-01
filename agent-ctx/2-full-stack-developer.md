# Task 2: Add NBA Standings

## Agent: full-stack-developer

## Summary
Added NBA standings to the GoalStream app with all 30 teams, logos, stats, and conference-based rankings.

## Files Modified
- `/src/app/api/standings/route.ts` — Added `fetchNBAStandings()` function, NBA URL constants, `league=nba` and `category=basketball` handling, NBA-specific ParsedTeam fields
- `/src/components/standings-view.tsx` — Added basketball category, NBA league tab, NBA-specific table layout (W/L/PCT/GB columns), conference separation, NBA legend
- `/src/lib/i18n/translations.ts` — Added basketball/NBA translation keys to all 5 languages

## API Test Results
- `GET /api/standings?league=nba` returns 30 teams (15 Eastern + 15 Western)
- All teams have ESPN logos
- Win percentage and games behind correctly parsed
- Lint: 0 errors

## Key Design Decisions
- Used `points` field internally as `winPct * 1000` for sorting compatibility
- NBA uses separate grid layout (no draws column)
- `gamesBehind` of 0 displays as "-" (conference leader)
- Win percentage formatted as .xxx (e.g., .806)
- NBA row highlighting: green=clinched, blue=play-in, red=eliminated
