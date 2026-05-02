---
Task ID: 1
Agent: Backend Standings Agent
Task: Update the backend standings API to support new sports categories

Work Log:
- Read existing `/src/app/api/standings/route.ts` (910 lines) and worklog.md for context
- Added 5 new league definition arrays: MOTOR_SPORT (F1), MOTORSPORTS (NASCAR/IndyCar/MotoGP), CRICKET (IPL/BBL/PSL/SA20/CPL/ICC), RUGBY (6Nations/Premiership/URC/SuperRugby/TRC/NRL), OTHER (NFL/NCAA Football)
- Added 8 new ESPN API base URLs: ESPN_MLB_PRIMARY/FALLBACK, ESPN_NHL_PRIMARY/FALLBACK, ESPN_NFL_PRIMARY/FALLBACK, ESPN_CFB_PRIMARY/FALLBACK, ESPN_F1_PRIMARY/FALLBACK
- Added 3 new ParsedTeam fields: otLosses (NHL), ties (NFL), streak (general)
- Created generic `fetchESPNData()` helper to reduce code duplication across all sport fetch functions
- Created `fetchMLBStandings()` - 2 children (AL/NL), W/L/PCT/GB format, conference field
- Created `fetchNHLStandings()` - 2 children (Eastern/Western), W/L/OTL/PTS/GB format, otLosses field
- Created `fetchNFLStandings()` - 2 children (AFC/NFC), W/L/T/PCT/GB format, ties field
- Created `fetchCollegeFootballStandings()` - Multiple conference groups, similar to NFL format
- Created `fetchF1Standings()` - 2 children (Driver/Constructor), uses athlete field for drivers, rank/championshipPts stats
- Created 7 placeholder generators: getNASCARPlaceholder(), getIndyCarPlaceholder(), getMotoGPPlaceholder(), getIPLPlaceholder(), getSixNationsPlaceholder(), getUFCRankingsPlaceholder(), getBoxingRankingsPlaceholder()
- UFC placeholder uses weight class groups (10 weight classes, 5 fighters each)
- Boxing placeholder uses weight class groups (5 weight classes, 3-5 fighters each)
- Updated PLACEHOLDER_CODES with all new placeholder league codes
- Updated GET handler to route all new league codes and categories (mlb, nhl, nfl, college-football, f1, nascar-cup, indycar, moto-gp, ipl, 6nations, ufc.rankings, boxing.rankings, and category-based: mlb, nhl, motorSport, motorsports, cricket, rugby, mma, boxing, other)
- Lint passes with zero errors

Stage Summary:
- All 12 new sports categories implemented in the backend standings API
- ESPN API integration: MLB, NHL, NFL, College Football, F1 (with primary/fallback URL pattern)
- Off-season placeholders: NASCAR Cup, IndyCar, MotoGP, IPL, Six Nations
- Hardcoded rankings: UFC (10 weight classes), Boxing (5 weight classes)
- PLACEHOLDER_CODES updated with all new codes
- File grew from 910 lines to 1846 lines
- All changes lint-clean
