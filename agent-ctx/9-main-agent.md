# Task 9 - Extended Calendar (3-day view)

## Summary
Implemented an extended calendar that shows matches for 3 days (today + tomorrow + day after tomorrow) instead of just today.

## Changes Made

### API Routes
- **Football API** (`src/app/api/football/route.ts`): Accepts `date`/`dates` query params, defaults to 3-day fetch, includes finished matches, per-date cache keys
- **Basketball API** (`src/app/api/basketball/route.ts`): Same changes as football

### Types
- `src/lib/football/types.ts`: Added `dates?: string[]` to `FootballMatchesResponse`
- `src/lib/basketball/types.ts`: Added `dates?: string[]` to `BasketballMatchesResponse`

### Store
- `src/lib/store.ts`: Added `DateTab` type, `selectedDate`/`selectedBasketballDate` state, `setSelectedDate`/`setSelectedBasketballDate` actions, updated fetch functions with dates param

### Components
- `src/components/live-matches.tsx`: Date tab selector (green theme), client-side date filtering, finished matches section
- `src/components/basketball-matches.tsx`: Date tab selector (orange theme), same filtering logic
- `src/components/favorites-view.tsx`: Updated empty state message, added date labels to match cards

## Verification
- Lint passes clean
- Dev server running, APIs return 3-day data correctly
- Football: 7 matches across 3 dates
- Basketball: 15 matches across 3 dates
