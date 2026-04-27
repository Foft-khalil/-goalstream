# Task 3: Update Zustand store and LiveMatches to use real football data

## Agent: Store & Frontend Updater

## Work Log:

### 1. Updated `/src/lib/store.ts`
- Added `FootballMatch` interface (exported) with all required fields including `minute`, `matchDate` (nullable), and optional `streamUrl`/`channelName`/`channelLogo`
- Added new state fields: `footballMatches`, `footballLoading`, `footballError`, `footballLastUpdated`
- Added `fetchFootballMatches()` function that calls `/api/football` GET endpoint with proper loading/error handling
- Preserved all existing `matches` state and `fetchMatches` function (used by admin dashboard)
- Set French error message: "Échec du chargement des matchs"

### 2. Updated `/src/components/live-matches.tsx`
- **Removed** `seedMatches` import and auto-seed logic entirely
- **Replaced** `matches` with `footballMatches` from store
- **Added** auto-refresh every 5 minutes via `setInterval`
- **Added** proper loading state with spinner and French text ("Chargement des matchs en direct...")
- **Added** error state with retry button ("Erreur de chargement" / "Réessayer")
- **Added** error banner when data exists but refresh fails
- **Grouped** matches by status: live (hero + list), upcoming ("À venir"), finished ("Terminés")
- **Added** last updated time display with manual refresh button ("Dernière mise à jour")
- **Added** friendly empty state: "Aucun match trouvé aujourd'hui. Revenez plus tard pour les scores en direct !"
- **Shows** minute of play for live matches (e.g., "67'")
- All section headers translated to French

### 3. Updated `/src/components/match-card.tsx`
- **Added** `minute?: number | null` to MatchCardProps
- **Shows** minute next to the LIVE badge (e.g., "67'") when status is 'live' and minute is available
- **Made** `matchDate` nullable (`string | null`) to support FootballMatch type
- **Made** `streamUrl`, `channelName`, `channelLogo` optional to support both Match and FootballMatch
- Translated status labels: "LIVE", "À VENIR", "TERMINÉ"
- Translated default competition: "Amical", no stream: "Pas de flux", watch button: "Regarder"
- Maintained backward compatibility with existing DB Match interface

### 4. Updated `/src/app/page.tsx`
- **Replaced** `matches` with `footballMatches` in both `AppHeader` and `MobileBottomNav`
- **Updated** `liveCount` calculation to use `footballMatches` instead of `matches`
- **Added** `fetchFootballMatches` to initial data fetch useEffect
- Preserved all other page functionality intact

## Lint Result: ✅ Passed with no errors
## Dev Server: ✅ Running, `/api/football` endpoint confirmed working (returning real data with LLM extraction)
