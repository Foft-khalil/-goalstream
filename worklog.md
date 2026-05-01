---
Task ID: 4
Agent: main
Task: Fix hydration error and enhance dynamic pitch/court visualizations

Work Log:
- Diagnosed hydration error: `toLocaleDateString('fr-FR', ...)` produces different results on server vs client due to timezone differences (server renders `ven. 1`, client renders `sam. 2` around midnight)
- Created `/home/z/my-project/src/lib/date-utils.ts` with deterministic French date formatters (`formatFrShort`, `formatFrLong`) that use manual lookup arrays instead of `toLocaleDateString`
- Updated `live-matches.tsx`: replaced `mounted` state + `toLocaleDateString` with deterministic `formatFrShort`/`formatFrLong` imports
- Updated `basketball-matches.tsx`: same replacement for its date tab labels and header date string
- Completely rewrote `dynamic-football-pitch.tsx` with major enhancements:
  - Replaced subtle 2s interval drift (±4px) with `requestAnimationFrame`-based 60fps smooth animation
  - Added ball trajectory system: generates waypoint paths every ~8s based on possession, with smoothstep interpolation
  - Added attacking/defending formation positions (HOME_ATTACKING, AWAY_ATTACKING, HOME_DEFENDING, AWAY_DEFENDING) that shift based on possession
  - Players now have idle movement (sin/cos patterns) + shift toward ball position + formation-based positioning
  - Added attack direction animated arrow (dashed line with flow animation)
  - Added possession indicator bar at bottom of pitch
  - Added player number labels on dots
  - Enhanced action markers: longer duration (8s), bigger effects, goal flash fill
  - Match minute displayed in styled pill badge in center circle
  - Possession zone gradient now pulses during live matches
- Completely rewrote `dynamic-basketball-court.tsx` with same enhancements:
  - requestAnimationFrame-based 60fps smooth animation
  - Ball trajectory paths with smoothstep interpolation
  - Attacking/defending 5-on-5 formations based on possession
  - Position labels (PG, SG, SF, PF, C) on player dots
  - Attack direction animated arrow
  - Possession indicator bar
  - Enhanced action markers with longer duration
  - Clock displayed in styled pill badge in center circle
  - Possession zone gradient pulses during live
- Lint passed with zero errors
- Dev server running without compilation errors

Stage Summary:
- Hydration error fixed: replaced locale-dependent date formatting with deterministic French formatters
- Football pitch now has truly dynamic, continuous animation: ball follows smooth trajectories, players shift between attacking/defending formations, attack direction arrows, possession bar
- Basketball court has the same dynamic features adapted for basketball
- Both terrains are now significantly more interactive and visually dynamic during live matches
