# Task: Fix hardcoded French strings, add share functionality, and create Error Boundary

## Summary of Changes

### 1. Translations (src/lib/i18n/translations.ts)
- Added new keys to `Translations` interface:
  - `standings`: loadingStandings, fetchingData, updating, loadingLeague, loadError, schedule, qualifiedTeams, showNextTeams, otherTeams, barrages, dataUnavailable, competitionPaused, groupsNotFormed, worldCupMessage, copaAmericaMessage, asianCupMessage, goldCupMessage, ranking
  - `match`: share, copied
  - `errors`: boundaryTitle, boundaryMessage
  - `tracker` (new section): timeline, timelineMatch, statistics, keyPlayers, loadingEvents, loadingStats, loadingPlayers, statsUnavailable, playersUnavailable, goal, yellowCard, redCard, substitution, start, end, assist, spectators, referee, summary, winsMatch, draw, halftime, eventsWillAppear, liveAtKickoff, noEvents, autoRefresh, shots, accuratePasses, saves, cantLoadEvents, serverError, possession
- Added translations for all 5 languages: fr, en, ar, es, pt
- Fixed broken Portuguese `basketball` section and Spanish `favorites` section

### 2. Standings View (src/components/standings-view.tsx)
- Imported `useAppStore` and `t` from i18n
- Replaced CATEGORIES array with key-based approach for i18n lookup
- Made LEAGUE_TABS league names language-independent (using English/international names)
- Replaced all hardcoded French strings in WorldCupInfoCard, StandingsTable, EmptyLeagueState, and main component
- Passed `language` prop to child components (WorldCupInfoCard, StandingsTable, EmptyLeagueState)
- Used `t(language, 'key')` for all UI text

### 3. Match Tracker (src/components/match-tracker.tsx)
- Imported `t` from i18n
- Changed `eventLabel` function to accept `language` parameter and use i18n
- Replaced all hardcoded French strings:
  - Event labels (But, Carton jaune, etc.)
  - Tab names (Chronologie, Statistiques, Joueurs clés)
  - Loading messages
  - Error messages
  - Game info labels (spectateurs, Arbitre, Possession)
  - Player category labels (Tirs, Passes réussies, Arrêts)
  - Summary labels (Résumé, Match nul, remporte le match)
  - MI-TEMPS → tracker.halftime

### 4. Favorites View (src/components/favorites-view.tsx)
- Replaced "EN DIRECT" with `t(language, 'common.live').toUpperCase()`
- Replaced "À VENIR" with `t(language, 'common.upcoming').toUpperCase()`
- Replaced "TERMINÉ" with `t(language, 'common.finished').toUpperCase()`

### 5. Match Card (src/components/match-card.tsx)
- Added `Share` icon import from lucide-react
- Added `shareCopied` state
- Created `handleShare` function that:
  - Uses Web Share API if available
  - Falls back to clipboard copy
  - Format: "⚽ {homeTeam} {score} {awayTeam} | {competition} | GoalStream"
- Added Share button in the action buttons row
- Shows "Copied!" confirmation for 2 seconds after clipboard copy

### 6. Error Boundary (src/components/error-boundary.tsx)
- Created new React class component ErrorBoundary
- Catches render errors with getDerivedStateFromError
- Shows friendly error message with AlertTriangle icon
- Retry button to reset error state
- Development mode shows error message in a pre block
- Used in page.tsx to wrap main content

### 7. Page (src/app/page.tsx)
- Imported ErrorBoundary component
- Wrapped main content (all view components) with ErrorBoundary
