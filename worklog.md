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

---
Task ID: 2
Agent: main
Task: Fix two priority issues: (1) "Regarder en direct" button visibility, (2) Match results/history for finished matches

Work Log:
- Fixed match-card.tsx: "Regarder" button now only shows for live matches or matches about to start (within 30 min of kickoff)
- Fixed match-card.tsx: Finished matches now show actual final score instead of "VS" placeholder
- Fixed match-card.tsx: Added "Terminé" badge in top row for finished matches
- Fixed match-card.tsx: For finished matches, primary action button is "Voir le résumé" (opens MatchTracker)
- Fixed match-card.tsx: For upcoming matches not yet close to kickoff, primary action is "Suivre le match" (sets reminder via tracker)
- Fixed match-card.tsx: TV channel picker button only shows when canWatchLive is true
- Fixed match-tracker.tsx: "Regarder en direct" button now only shows for live or about-to-start matches
- Fixed match-tracker.tsx: Implemented working onClick handler that calls /api/match-stream, opens player, and closes tracker
- Fixed match-tracker.tsx: Added "Résumé du match" info box for finished matches
- Fixed match-events/route.ts: Fixed TypeScript error on line 171 (participants type using NonNullable utility type)
- Fixed match-events/route.ts: Same fix applied to extractAssistPlayer and extractSubstitution functions

Stage Summary:
- "Regarder en direct" button only visible when match is live or within 30 min of kickoff
- Finished matches display final score (e.g., "2 - 1") instead of "VS"
- Finished matches show "Terminé" badge and "Voir le résumé" button
- Match Tracker "Regarder" button now functional (calls match-stream API, opens video player)
- TypeScript errors in match-events route fixed
