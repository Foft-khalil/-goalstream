---
Task ID: 1
Agent: Main Agent
Task: Fix live matches showing fake scores and add click-to-watch functionality

Work Log:
- Read all existing codebase files (football API route, LiveMatches, MatchCard, store, types, etc.)
- Rewrote /api/football/route.ts with stricter LLM prompt that prevents inventing scores for upcoming matches
- Added date filtering to only show matches from today through next 7 days
- Added validation that forces upcoming matches to have null scores
- Added status sorting: live first, then upcoming, then finished
- Created /api/match-stream/route.ts - finds matching IPTV channels for a given match based on team names and competition
- Rewrote MatchCard component with "Regarder" button that finds channels on click
- MatchCard now shows a channel selector with relevance-scored IPTV channels
- Rewrote LiveMatches component with "Aujourd'hui" and "Cette semaine" sections
- Finished matches are collapsed by default (click to expand)
- Tested all endpoints: football API returns clean data, match-stream finds relevant channels
- Lint passes clean

Stage Summary:
- Upcoming matches now have null scores (no fake results)
- Matches organized by: Live → Aujourd'hui → Cette semaine → Terminés (collapsed)
- Clicking "Regarder" on any match finds relevant IPTV channels and lets user pick one to watch
- Match-stream API successfully finds beIN SPORTS, L1 Max, etc. for Ligue 1 matches
- API response time ~18-20s (cached for 2 min after first load)
