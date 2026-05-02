# Task 2: Update standings-view.tsx for new sports categories

## Summary
Added 9 new category tabs (MLB, NHL, Cricket, Motor Sport, MMA, Boxing, Motorsports, Other, Rugby) to the standings-view component, including new table formats, icons, league tabs, and legend support.

## Changes Made

### 1. StandingTeam Interface
- Added `otLosses?: number` (NHL overtime losses)
- Added `ties?: number` (NFL ties)

### 2. Category Type
- Extended from 5 to 14 categories: `'championnats' | 'basketball' | 'coupes' | 'nationales' | 'feminines' | 'mlb' | 'nhl' | 'cricket' | 'motorSport' | 'mma' | 'boxing' | 'motorsports' | 'other' | 'rugby'`

### 3. CATEGORY_KEYS
- Added all 9 new i18n lookup keys (standings.mlb, standings.nhl, standings.cricket, standings.motorSport, standings.mma, standings.boxing, standings.motorsports, standings.other, standings.rugby)

### 4. CATEGORY_ICONS
- MLB: Volleyball icon
- NHL: Shield icon
- Cricket: Activity icon
- Motor Sport: Gauge icon
- MMA: Swords icon
- Boxing: Flame icon
- Motorsports: Car icon
- Other: Grid3x3 icon
- Rugby: Radar icon

### 5. CATEGORIES Array
- Extended to 14 entries in logical order

### 6. LEAGUE_TABS
- mlb: MLB
- nhl: NHL
- cricket: IPL, Big Bash, PSL, SA20, CPL, ICC World Cup
- motorSport: Formula 1
- mma: UFC Rankings
- boxing: Boxing Rankings
- motorsports: NASCAR Cup, IndyCar, MotoGP
- other: NFL, NCAA Football
- rugby: Six Nations, Premiership, URC, Super Rugby, The Rugby Champ., NRL

### 7. StandingsTable Updates
- New props: isMLB, isNHL, isNFL, isF1
- MLB format: same as NBA (W | L | PCT | GB)
- NHL format: W | L | OTL | PTS | GB
- NFL format: W | L | T | PCT | GB
- F1 format: same as FIFA Rankings (# | Name | PTS)
- Updated getGridCols() for all new formats
- Updated header rendering for each format
- Updated row rendering with otLosses/ties display

### 8. Legend Section
- MLB: Playoffs / Play-In / Eliminated (same as NBA)
- NHL: Playoffs / Wild Card / Eliminated
- NFL: Playoffs / Draft Pick / Eliminated

### 9. Main Component State
- Replaced hardcoded data/loading initializers with utility objects generated from CATEGORIES array
- Added NO_SCORERS_CATEGORIES constant for categories without top scorers
- Updated isMLB, isNHL, isNFL, isF1 computed flags
- Updated sub-tab toggle to use hasScorers check
- Updated category reset effect to disable scorers for all new categories

### 10. Category Tabs
- Made scrollable with overflow-x-auto and flex-nowrap
- Reduced padding for compact display (px-2.5)
- Added whitespace-nowrap for proper scrolling

### 11. EmptyLeagueState
- Added new placeholder codes for all new league codes (ipl, bbl, ufc.rankings, nascar-cup, etc.)

### 12. Imports
- Added: Swords, Flame, Gauge, Car, Grid3x3, Volleyball, Shield, Radar, Activity

## File Stats
- Original: 1201 lines
- Updated: 1353 lines
- Lint: Zero errors
