---
Task ID: 1
Agent: Main Agent
Task: Fix all GoalStream bugs - build error, standings, streaming, World Cup

Work Log:
- Fixed build error in match-stream/route.ts: `continue` statement inside `.map()` callback (line 617) - replaced with `return` statement
- Converted all `import ZAI from 'z-ai-web-dev-sdk'` top-level imports to dynamic `await import()` in 3 files: match-stream/route.ts, team/[id]/route.ts, football/[id]/route.ts
- Refactored match-stream/route.ts to use Prisma database instead of heavy @/lib/iptv (which fetches 38 IPTV playlists)
- Added inline isSportsChannel(), isLocalAffiliate(), checkStreamsBatchLight() functions to replace @/lib/iptv imports
- Rewrote standings API route: sequential league fetching instead of Promise.allSettled, FIFA rankings use fallback data directly, MAX_TEAMS_PER_GROUP=24 limit
- Updated standings-view.tsx: loads data per-league instead of entire category at once, lazy category loading
- Updated page.tsx: only fetches football data on mount, other data fetched when user navigates

Stage Summary:
- Build error fixed (continue in .map callback)
- Standings Coupes Clubs tab now works (Champions League, Europa League, Conference League all return data)
- Standings Éq. Nationales tab now works (FIFA rankings via fallback, World Cup groups, Euro, CAN)
- World Cup section shows 12 groups with teams from ESPN API
- Match Stream API works (finds 12 channels for matches using Prisma database)
- Server OOM is an environmental limitation - each API works individually but multiple simultaneous compilations cause OOM
- All code changes are correct and lint-passing
