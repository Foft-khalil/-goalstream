# Task 7-8: PWA & Highlights Agent

## Task Summary
Improve PWA service worker, manifest, and add match highlights/replay links for finished matches.

## Files Modified

### Task 7a: manifest.webmanifest
- `/home/z/my-project/public/manifest.webmanifest` — Updated description to English, added scope: "/", added shortcuts array with "Live Matches" and "Basketball", changed lang to "en"

### Task 7b: Service Worker
- `/home/z/my-project/public/sw.js` — Bumped cache to goalstream-v2, replaced "Hors ligne" with JSON response, added SPA navigation fallback, added stale-while-revalidate for /_next/*

### Task 7c: use-pwa.ts
- Verified hook works correctly — no changes needed

### Task 8: Match Highlights
- `/home/z/my-project/src/lib/i18n/translations.ts` — Added `highlights` key to Translations interface and all 5 language implementations
- `/home/z/my-project/src/components/match-card.tsx` — Added Film icon import and Highlights button for finished matches
- `/home/z/my-project/src/components/basketball-match-card.tsx` — Added Film icon import and Highlights button for finished matches

## Lint Status
All files pass `bun run lint` with zero errors.
