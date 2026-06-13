# Task ID: 1 — Date Tab & Infinite Scroll Improvements

## Changes Made

### Improvement 1: Better Date Tab Display

**Files modified:**
- `/home/z/my-project/src/components/live-matches.tsx`
- `/home/z/my-project/src/components/basketball-matches.tsx`

**What changed:**
- Replaced the old 3-row compact layout (month / dayNum / weekday) with a cleaner 2-row layout:
  - **Row 1**: Label text using `text-[11px] font-semibold` — shows "Auj." for today, "Dem." for tomorrow, month abbreviation for 1st of month, or weekday abbreviation for other days
  - **Row 2**: Day number using `text-[16px] font-bold` for today, `text-[14px]` for others
- Removed the separate month separator label that appeared on 1st of month — now the month abbreviation appears in the label row itself
- Kept all existing features: match count badge, active indicator line, today dot indicator

### Improvement 2: Infinite Scroll for Matches

**Files modified:**
- `/home/z/my-project/src/components/live-matches.tsx`
- `/home/z/my-project/src/components/basketball-matches.tsx`

**What changed:**
- Added `visibleCount` state (starts at 10) and `loadMoreRef` for IntersectionObserver sentinel
- Live matches always shown in full (not counted in visibleCount)
- Non-live matches (upcoming + finished) are sliced to `visibleCount` before grouping
- IntersectionObserver with `rootMargin: '200px'` auto-loads 10 more matches when user scrolls near the sentinel
- Visible count resets to 10 when date tab or competition filter changes (via event handler wrappers, not effects)
- Shows "X / Y matches" indicator with spinner when more matches are loading
- Shows total count when all matches are loaded

**Lint compliance:**
- Avoided `setState` in effects (lint error) by using wrapper callbacks (`handleDateSelect`, `handleCompetitionSelect`)
- Avoided ref access during render (lint error) by using event handlers instead of refs to track previous values
- All changes pass `bun run lint` cleanly

## Summary
Both improvements are implemented across both football and basketball match components. Date tabs now show a clear label+number layout, and matches load progressively with infinite scroll behavior.
