---
Task ID: 1
Agent: main
Task: Fix all bugs and implement features for GoalStream

Work Log:
- Fixed DateTab type from 3 options (today/tomorrow/dayAfter) to 7 options (day0-day6)
- Updated football API route to accept up to 7 dates (was max 3)
- Updated basketball API route to accept up to 7 dates
- Updated live-matches.tsx with scrollable 7-day date selector
- Updated basketball-matches.tsx with scrollable 7-day date selector
- Updated page.tsx initial fetch to load today first, then remaining 6 days after 5s delay
- Updated store.ts DateTab type and default values
- Created MatchTracker component (match-tracker.tsx) with:
  - Real-time event timeline (goals, cards, substitutions, VAR)
  - Auto-refresh every 15s for live matches
  - Score banner with live clock
  - Event icons and French labels
  - Full-screen overlay UI
- Added "Suivre" (Track) button to MatchCard
- Added sport parameter to match-stream API calls from MatchCard
- Added scrollbar-hide CSS utility for date tabs
- Fixed standings API: increased MAX_TEAMS_PER_GROUP from 12 to 36 for league phase
- Fixed standings API: added fifa.rankings to NATIONALES array
- Enhanced World Cup data with 30 qualified teams and schedule milestones
- Enhanced FIFA rankings with country flags

Stage Summary:
- 7-day match schedule working (tested: 33 matches across 7 days)
- Live Match Tracker created with real-time events display
- Standings Coupes Clubs now shows 36 teams in league phase
- Standings Éq. Nationales now shows FIFA rankings and World Cup info
- All API endpoints tested and working
