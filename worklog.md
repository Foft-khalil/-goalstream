---
Task ID: 1
Agent: Main Agent
Task: Fix Turbopack HMR module factory error and implement proper streaming links

Work Log:
- Cleared .next cache to fix Turbopack HMR module factory error
- Restarted dev server with fresh cache - app loads successfully
- Analyzed reference streaming sites (us-sport.eu, tarjetarojaenvivo.cx)
- Enhanced /api/streams route with competition-based matching (not just team name matching)
- Added Saudi Pro League, MLS, and more team abbreviations for better fuzzy matching
- Updated match-tracker.tsx to use kora-api as primary source (was only using IPTV)
- Added external streaming site links (SportStream, RojaDirecta) to match-tracker
- Added external streaming site links to match-card.tsx (football and basketball)
- Added Globe icon button for direct external site access
- Added "Sources externes" section in channel selector dropdown
- Added external site links in error states when no channels found

Stage Summary:
- HMR error fixed by clearing cache
- Streaming system now uses 3-tier approach: kora-api (fast) → IPTV (fallback) → External sites (last resort)
- Enhanced kora-api matching with competition/category-based search
- Users can now access SportStream and RojaDirecta directly from the app
- All changes lint-free and app loads successfully
