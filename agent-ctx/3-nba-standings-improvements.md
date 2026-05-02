# Task 3: NBA Standings Improvements

## Summary of Changes

### 1. API Route (`src/app/api/nba-standings/route.ts`)
- **Added `l10Record` field** to `NBAStandingTeam` interface (string type, e.g., "7-3")
- **Added `l10Record` parsing logic**: `l10Record: String(statMap['L10'] || statMap['l10'] || '-')`
- **Added NBA team color fallback map** (`NBA_TEAM_COLORS`): Static map of 30 NBA team abbreviations to their primary colors, used when ESPN API doesn't provide the `color` field
- **Updated color parsing**: Falls back to `NBA_TEAM_COLORS[abbreviation]` when `team.color` is not available from API
- **Fixed `pointsFor` parsing**: Removed the `pointDifferential` conditional check, now uses `Number(String(statMap['pointsFor'] || statMap['PF'] || 0).replace(/,/g, ''))` for cleaner comma handling
- **Fixed `pointsAgainst` and `pointDiff` parsing**: Same comma-removal cleanup for consistency

### 2. Standings View Component (`src/components/standings-view.tsx`)
- **Added `l10Record` field** to the local `NBAStandingTeam` interface (matching the API type)
- **Added Point Differential column**: Shows `+669` (green) or `-123` (red) format
- **Added Last 10 (L10) column**: Shows record like "7-3"
- **Added team color accent on hover**: 3px colored bar on the left edge of each row, using `group-hover:opacity-100` with the team's color
- **Made standings table responsive**:
  - Mobile (7 cols): #, Team, W, L, %, GB, Streak
  - Desktop (10 cols): #, Team, W, L, %, GB, Home/Away, Streak, Diff, L10
  - Uses `hidden sm:block` for columns hidden on mobile
  - Uses responsive grid templates: `grid-cols-[...]` and `sm:grid-cols-[...]`
- **Updated header row**: Now uses `t()` for all column labels (previously some were hardcoded French)
- **Improved hover behavior**: Changed from `hover:text-green-500` to `group-hover:text-orange-500` for NBA team rows, matching the NBA color scheme

### 3. Translations (`src/lib/i18n/translations.ts`)
Added 4 new translation keys in all 4 languages (fr, en, ar, es):
- `standings.nbaDiff` - Point Differential column header
- `standings.nbaL10` - Last 10 games column header
- `standings.nbaHomeAway` - Home/Away record column header
- `standings.nbaStreak` - Streak column header

## Files Modified
1. `src/app/api/nba-standings/route.ts` - API parsing + color fallback map
2. `src/components/standings-view.tsx` - UI improvements + responsive layout
3. `src/lib/i18n/translations.ts` - New translation keys

## Verification
- Lint passes: `bun run lint` ✓
- TypeScript check: No errors in modified files ✓
- API returns correct data including `l10Record` and `color` fields ✓
- All 30 NBA teams displayed (15 East + 15 West) ✓
