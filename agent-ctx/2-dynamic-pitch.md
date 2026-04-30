---
Task ID: 2
Agent: full-stack-developer
Task: Create DynamicFootballPitch component

Work Log:
- Examined existing FootballPitch in match-tracker.tsx (SVG viewBox 0 0 500 320)
- Created /home/z/my-project/src/components/dynamic-football-pitch.tsx with:
  - Ball position tracking based on event types with smooth 1.5s CSS transition
  - 4-3-3 player formation dots with parallax shift toward ball
  - Action markers (goal rings, card flashes, VAR purple pulse) that auto-remove after 5s
  - Possession zone gradient overlays with 2s ease transition
  - Match minute display in center circle
- Updated match-tracker.tsx to import and use DynamicFootballPitch instead of static FootballPitch
- Removed unused static FootballPitch function
- Lint passed, dev server running clean

Stage Summary:
- All 5 dynamic features implemented and working
- Component is self-contained ('use client', no external deps beyond React)
- SVG pitch markings identical to original
