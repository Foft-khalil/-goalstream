# Task 6 - standings-fixer

## Task
Fix standings Coupes Clubs & Éq. Nationales tabs + World Cup

## Work Log
- Tested all 7 standings API endpoints — all returned 200 with data
- Root cause: MAX_TEAMS_PER_GROUP=12 truncated league phase from 36→12 teams
- Root cause: fifa.rankings missing from NATIONALES array in API route
- Fixed API route: increased MAX_TEAMS_PER_GROUP to 36, added fifa.rankings to NATIONALES, added skip in fetch loop
- Enhanced World Cup with 30 qualified teams, 6 schedule events, extended info
- Enhanced FIFA rankings with country flags
- Rewrote frontend standings-view.tsx with StandingsTable component (show more/less), enhanced WorldCupInfoCard

## Key Results
- Coupes Clubs: 3 standings × 36 teams, 0 errors
- Éq. Nationales: FIFA rankings (30), World Cup (30+schedule), Euro (6×4), CAN (6×4), 0 errors
- All API endpoints verified working
