'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';

// ─── Props Interface ──────────────────────────────────────────────────────────
interface DynamicFootballPitchProps {
  possession: 'home' | 'away' | null;
  homeAbbr: string;
  awayAbbr: string;
  homeColor: string;
  awayColor: string;
  isLive: boolean;
  lastEventType: string | null;
  matchMinute: number | null;
  events: Array<{
    type: string;
    minute: number;
    team: string;
  }>;
}

// ─── Position type ────────────────────────────────────────────────────────────
interface Position {
  x: number;
  y: number;
}

// ─── 4-3-3 Formation Positions ────────────────────────────────────────────────
// Home team on LEFT side — base positions
const HOME_FORMATION: Position[] = [
  { x: 30, y: 160 },   // GK
  { x: 95, y: 65 },    // DEF 1
  { x: 95, y: 125 },   // DEF 2
  { x: 95, y: 195 },   // DEF 3
  { x: 95, y: 255 },   // DEF 4
  { x: 165, y: 85 },   // MID 1
  { x: 165, y: 160 },  // MID 2
  { x: 165, y: 235 },  // MID 3
  { x: 225, y: 80 },   // FWD 1
  { x: 225, y: 160 },  // FWD 2
  { x: 225, y: 240 },  // FWD 3
];

// Away team on RIGHT side (mirrored)
const AWAY_FORMATION: Position[] = [
  { x: 470, y: 160 },  // GK
  { x: 405, y: 65 },   // DEF 1
  { x: 405, y: 125 },  // DEF 2
  { x: 405, y: 195 },  // DEF 3
  { x: 405, y: 255 },  // DEF 4
  { x: 335, y: 85 },   // MID 1
  { x: 335, y: 160 },  // MID 2
  { x: 335, y: 235 },  // MID 3
  { x: 275, y: 80 },   // FWD 1
  { x: 275, y: 160 },  // FWD 2
  { x: 275, y: 240 },  // FWD 3
];

// Attacking positions — when team is in possession, shift forward
const HOME_ATTACKING: Position[] = [
  { x: 30, y: 160 },   // GK stays
  { x: 105, y: 70 },   // DEF push up slightly
  { x: 115, y: 130 },
  { x: 115, y: 190 },
  { x: 105, y: 250 },
  { x: 195, y: 90 },   // MID push forward
  { x: 210, y: 160 },
  { x: 195, y: 230 },
  { x: 290, y: 75 },   // FWD push into final third
  { x: 300, y: 155 },
  { x: 290, y: 235 },
];

const AWAY_ATTACKING: Position[] = [
  { x: 470, y: 160 },  // GK stays
  { x: 395, y: 70 },
  { x: 385, y: 130 },
  { x: 385, y: 190 },
  { x: 395, y: 250 },
  { x: 305, y: 90 },
  { x: 290, y: 160 },
  { x: 305, y: 230 },
  { x: 210, y: 75 },
  { x: 200, y: 155 },
  { x: 210, y: 235 },
];

// Defending positions — when team is not in possession, shift back
const HOME_DEFENDING: Position[] = [
  { x: 25, y: 160 },   // GK stays deeper
  { x: 70, y: 60 },
  { x: 70, y: 125 },
  { x: 70, y: 195 },
  { x: 70, y: 260 },
  { x: 120, y: 90 },
  { x: 120, y: 160 },
  { x: 120, y: 230 },
  { x: 165, y: 85 },
  { x: 165, y: 160 },
  { x: 165, y: 235 },
];

const AWAY_DEFENDING: Position[] = [
  { x: 475, y: 160 },
  { x: 430, y: 60 },
  { x: 430, y: 125 },
  { x: 430, y: 195 },
  { x: 430, y: 260 },
  { x: 380, y: 90 },
  { x: 380, y: 160 },
  { x: 380, y: 230 },
  { x: 335, y: 85 },
  { x: 335, y: 160 },
  { x: 335, y: 235 },
];

// ─── Action Marker type ───────────────────────────────────────────────────────
interface ActionMarker {
  id: number;
  type: 'goal' | 'yellow_card' | 'red_card' | 'var_review';
  x: number;
  y: number;
  createdAt: number;
}

// ─── Ball trajectory point ────────────────────────────────────────────────────
interface BallTrajectoryPoint {
  x: number;
  y: number;
  t: number; // timestamp when this point should be reached
}

// ─── Lerp helper ──────────────────────────────────────────────────────────────
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpPosition(a: Position, b: Position, t: number): Position {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}

// ─── Clamp helper ─────────────────────────────────────────────────────────────
function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

// ─── Generate smooth ball trajectory for possession-based movement ────────────
function generateBallPath(
  possession: 'home' | 'away' | null,
  currentPos: Position,
  matchMinute: number | null
): BallTrajectoryPoint[] {
  const points: BallTrajectoryPoint[] = [];
  const now = Date.now();

  // Ball moves based on which team has possession
  // Home possession → ball moves in right half (attacking toward away goal)
  // Away possession → ball moves in left half (attacking toward home goal)
  const baseX = possession === 'home' ? 320 : possession === 'away' ? 180 : 250;
  const baseY = 160;

  // Generate 8-12 waypoints over ~8 seconds
  const numPoints = 8 + Math.floor(Math.random() * 5);
  let prevX = currentPos.x;
  let prevY = currentPos.y;

  for (let i = 0; i < numPoints; i++) {
    const progress = (i + 1) / numPoints;

    // Create a path that weaves around the attacking half
    const targetX = baseX + (Math.sin(i * 1.2 + (matchMinute || 0) * 0.1) * 80) +
      (Math.cos(i * 0.7) * 30);
    const targetY = baseY + (Math.cos(i * 1.5 + (matchMinute || 0) * 0.08) * 90) +
      (Math.sin(i * 0.9) * 30);

    const x = clamp(lerp(prevX, targetX, 0.6), 15, 485);
    const y = clamp(lerp(prevY, targetY, 0.6), 15, 305);

    points.push({ x, y, t: now + (progress * 8000) });
    prevX = x;
    prevY = y;
  }

  return points;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DynamicFootballPitch({
  possession,
  homeAbbr,
  awayAbbr,
  homeColor,
  awayColor,
  isLive,
  lastEventType,
  matchMinute,
  events,
}: DynamicFootballPitchProps) {
  // ── Ball position state ──────────────────────────────────────────────────
  const [ballPos, setBallPos] = useState<Position>({ x: 250, y: 160 });
  const ballPosRef = useRef<Position>({ x: 250, y: 160 });

  // ── Player positions (smoothly animated) ─────────────────────────────────
  const [homePositions, setHomePositions] = useState<Position[]>(HOME_FORMATION);
  const [awayPositions, setAwayPositions] = useState<Position[]>(AWAY_FORMATION);

  // ── Action markers state ─────────────────────────────────────────────────
  const [actionMarkers, setActionMarkers] = useState<ActionMarker[]>([]);
  const markerIdRef = useRef(0);
  const prevEventIdRef = useRef<string | null>(null);

  // ── Animation refs ───────────────────────────────────────────────────────
  const rafRef = useRef<number | null>(null);
  const trajectoryRef = useRef<BallTrajectoryPoint[]>([]);
  const trajectoryStartRef = useRef<number>(Date.now());
  const possessionRef = useRef<'home' | 'away' | null>(possession);
  const lastPathGenTimeRef = useRef<number>(0);

  // ── Determine last event's team ──────────────────────────────────────────
  const lastEventTeam = useMemo(() => {
    if (!events || events.length === 0) return null;
    const last = events[events.length - 1];
    return last.team;
  }, [events]);

  // ── Unique event ID for detecting new events ─────────────────────────────
  const lastEventKey = useMemo(() => {
    if (!events || events.length === 0) return null;
    const last = events[events.length - 1];
    return `${last.type}-${last.minute}-${last.team}`;
  }, [events]);

  // ── Get target ball position based on event type ─────────────────────────
  const getTargetBallPos = useCallback((eventType: string | null, team: string | null): Position => {
    switch (eventType) {
      case 'goal': {
        if (team && team.toLowerCase().includes(homeAbbr.toLowerCase())) {
          return { x: 455, y: 160 };
        } else if (team && team.toLowerCase().includes(awayAbbr.toLowerCase())) {
          return { x: 45, y: 160 };
        }
        return possession === 'home' ? { x: 455, y: 160 } : { x: 45, y: 160 };
      }
      case 'yellow_card':
      case 'red_card': {
        const yOff = Math.sin(Date.now() / 1000) * 40;
        return { x: 250, y: 100 + yOff };
      }
      case 'substitution':
        return { x: 250, y: 295 };
      case 'period_start':
      case 'period_end':
        return { x: 250, y: 160 };
      case 'var_review':
        return { x: 250, y: 160 };
      default:
        return { x: 250, y: 160 };
    }
  }, [possession, homeAbbr, awayAbbr]);

  // ── Create action markers when events happen ────────────────────────────
  useEffect(() => {
    if (!lastEventKey || lastEventKey === prevEventIdRef.current) return;
    prevEventIdRef.current = lastEventKey;

    const markerTypes = ['goal', 'yellow_card', 'red_card', 'var_review'] as const;
    const evtType = events[events.length - 1]?.type;
    if (!evtType || !markerTypes.includes(evtType as any)) return;

    const pos = getTargetBallPos(evtType, lastEventTeam);
    const newMarker: ActionMarker = {
      id: markerIdRef.current++,
      type: evtType as ActionMarker['type'],
      x: pos.x,
      y: pos.y,
      createdAt: Date.now(),
    };

    setActionMarkers(prev => [...prev.slice(-8), newMarker]); // Keep max 9 markers

    // Also snap ball to event position immediately
    ballPosRef.current = pos;
    setBallPos(pos);
    trajectoryRef.current = []; // Reset trajectory on event
  }, [lastEventKey, lastEventTeam, getTargetBallPos, events]);

  // ── Clean up old markers ─────────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setActionMarkers(prev => prev.filter(m => now - m.createdAt < 8000));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // ── Keep possessionRef in sync ───────────────────────────────────────────
  useEffect(() => {
    possessionRef.current = possession;
  }, [possession]);

  // ── Generate new ball trajectory when possession changes or periodically ─
  const generateNewTrajectory = useCallback(() => {
    const pos = possessionRef.current;
    const current = ballPosRef.current;
    const newPath = generateBallPath(pos, current, matchMinute);
    trajectoryRef.current = newPath;
    trajectoryStartRef.current = Date.now();
    lastPathGenTimeRef.current = Date.now();
  }, [matchMinute]);

  // ── Generate trajectory when possession changes ──────────────────────────
  useEffect(() => {
    generateNewTrajectory();
  }, [possession, generateNewTrajectory]);

  // ── Generate new trajectory every ~8s during live ────────────────────────
  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => {
      if (trajectoryRef.current.length === 0 ||
          Date.now() - lastPathGenTimeRef.current > 7000) {
        generateNewTrajectory();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isLive, generateNewTrajectory]);

  // ── Main animation loop (requestAnimationFrame) ──────────────────────────
  useEffect(() => {
    if (!isLive) {
      // For non-live, just set ball to center or last event position
      if (lastEventType) {
        const pos = getTargetBallPos(lastEventType, lastEventTeam);
        setBallPos(pos);
      }
      return;
    }

    let lastTime = performance.now();

    const animate = (now: number) => {
      const dt = (now - lastTime) / 1000; // delta in seconds
      lastTime = now;

      // ── Animate ball along trajectory ──────────────────────────────────
      const trajectory = trajectoryRef.current;
      if (trajectory.length > 0) {
        const elapsed = Date.now() - trajectoryStartRef.current;

        // Find the two points we're between
        let prevPoint = trajectory[0];
        let nextPoint = trajectory[0];
        let found = false;

        for (let i = 0; i < trajectory.length - 1; i++) {
          const elapsedStart = trajectory[i].t - trajectoryStartRef.current;
          const elapsedEnd = trajectory[i + 1].t - trajectoryStartRef.current;

          if (elapsed >= elapsedStart && elapsed < elapsedEnd) {
            prevPoint = trajectory[i];
            nextPoint = trajectory[i + 1];
            found = true;
            break;
          }
        }

        if (found) {
          const segDuration = nextPoint.t - prevPoint.t;
          const segElapsed = elapsed - (prevPoint.t - trajectoryStartRef.current);
          const t = clamp(segElapsed / Math.max(segDuration, 1), 0, 1);

          // Smooth easing
          const easeT = t * t * (3 - 2 * t); // smoothstep

          const newX = lerp(prevPoint.x, nextPoint.x, easeT);
          const newY = lerp(prevPoint.y, nextPoint.y, easeT);

          ballPosRef.current = { x: newX, y: newY };
          setBallPos({ x: newX, y: newY });
        } else if (elapsed > 0 && trajectory.length > 0) {
          // Past last point — generate new path
          const lastPoint = trajectory[trajectory.length - 1];
          ballPosRef.current = { x: lastPoint.x, y: lastPoint.y };
          setBallPos({ x: lastPoint.x, y: lastPoint.y });

          if (Date.now() - lastPathGenTimeRef.current > 6000) {
            generateNewTrajectory();
          }
        }
      } else if (trajectory.length === 0) {
        // No trajectory — generate one
        generateNewTrajectory();
      }

      // ── Animate player positions ───────────────────────────────────────
      const pos = possessionRef.current;

      // Interpolate between base/attacking/defending formations
      const homeTarget = pos === 'home' ? HOME_ATTACKING : pos === 'away' ? HOME_DEFENDING : HOME_FORMATION;
      const awayTarget = pos === 'away' ? AWAY_ATTACKING : pos === 'home' ? AWAY_DEFENDING : AWAY_FORMATION;

      // Add some per-player idle movement based on time
      const timeS = now / 1000;

      setHomePositions(prev => {
        return homeTarget.map((target, i) => {
          const idle = {
            x: Math.sin(timeS * 0.5 + i * 1.3) * 5 + Math.cos(timeS * 0.3 + i * 0.7) * 3,
            y: Math.cos(timeS * 0.4 + i * 1.1) * 4 + Math.sin(timeS * 0.6 + i * 0.9) * 3,
          };

          // Shift slightly toward ball
          const ball = ballPosRef.current;
          const toBallX = (ball.x - target.x) * 0.04;
          const toBallY = (ball.y - target.y) * 0.04;
          const maxBallShift = 15;

          return {
            x: clamp(target.x + idle.x + clamp(toBallX, -maxBallShift, maxBallShift), 10, 490),
            y: clamp(target.y + idle.y + clamp(toBallY, -maxBallShift, maxBallShift), 10, 310),
          };
        });
      });

      setAwayPositions(prev => {
        return awayTarget.map((target, i) => {
          const idle = {
            x: Math.sin(timeS * 0.5 + i * 1.3 + 2) * 5 + Math.cos(timeS * 0.3 + i * 0.7 + 1) * 3,
            y: Math.cos(timeS * 0.4 + i * 1.1 + 2) * 4 + Math.sin(timeS * 0.6 + i * 0.9 + 1) * 3,
          };

          const ball = ballPosRef.current;
          const toBallX = (ball.x - target.x) * 0.04;
          const toBallY = (ball.y - target.y) * 0.04;
          const maxBallShift = 15;

          return {
            x: clamp(target.x + idle.x + clamp(toBallX, -maxBallShift, maxBallShift), 10, 490),
            y: clamp(target.y + idle.y + clamp(toBallY, -maxBallShift, maxBallShift), 10, 310),
          };
        });
      });

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isLive, lastEventType, lastEventTeam, getTargetBallPos, generateNewTrajectory]);

  // ── Possession gradient opacity ──────────────────────────────────────────
  const homeGradientOpacity = possession === 'home' ? 0.15 : 0;
  const awayGradientOpacity = possession === 'away' ? 0.15 : 0;

  // ── Attack direction arrow ───────────────────────────────────────────────
  const attackDirection = possession === 'home' ? 'right' : possession === 'away' ? 'left' : null;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="relative w-full max-w-sm mx-auto">
      {/* CSS Keyframes for animations */}
      <style>{`
        @keyframes pitch-ball-glow {
          0%, 100% { filter: drop-shadow(0 0 4px rgba(255,255,255,0.4)); }
          50% { filter: drop-shadow(0 0 10px rgba(255,255,255,0.8)); }
        }
        @keyframes pitch-goal-ring {
          0% { r: 6; opacity: 1; }
          100% { r: 40; opacity: 0; }
        }
        @keyframes pitch-goal-ring-2 {
          0% { r: 6; opacity: 0.8; }
          100% { r: 28; opacity: 0; }
        }
        @keyframes pitch-card-flash {
          0% { opacity: 0.9; r: 6; }
          100% { opacity: 0; r: 30; }
        }
        @keyframes pitch-var-pulse {
          0%, 100% { r: 8; opacity: 0.8; }
          50% { r: 16; opacity: 0.3; }
        }
        @keyframes pitch-goal-emoji {
          0% { opacity: 1; font-size: 20px; }
          100% { opacity: 0; font-size: 30px; }
        }
        @keyframes attack-arrow-flow {
          0% { opacity: 0.15; strokeDashoffset: 20; }
          50% { opacity: 0.5; strokeDashoffset: 0; }
          100% { opacity: 0.15; strokeDashoffset: -20; }
        }
        @keyframes possession-pulse {
          0%, 100% { opacity: 0.08; }
          50% { opacity: 0.18; }
        }
      `}</style>

      <svg viewBox="0 0 500 320" className="w-full h-auto rounded-xl overflow-hidden border border-border/30">
        {/* ── Pitch background ──────────────────────────────────────────── */}
        <rect x="0" y="0" width="500" height="320" fill="#0f2b1a" />

        {/* ── Grass stripes ─────────────────────────────────────────────── */}
        <rect x="10" y="10" width="60" height="300" fill="#0f2b1a" opacity="0.5" />
        <rect x="70" y="10" width="60" height="300" fill="#133a22" opacity="0.3" />
        <rect x="130" y="10" width="60" height="300" fill="#0f2b1a" opacity="0.5" />
        <rect x="190" y="10" width="60" height="300" fill="#133a22" opacity="0.3" />
        <rect x="250" y="10" width="60" height="300" fill="#0f2b1a" opacity="0.5" />
        <rect x="310" y="10" width="60" height="300" fill="#133a22" opacity="0.3" />
        <rect x="370" y="10" width="60" height="300" fill="#0f2b1a" opacity="0.5" />
        <rect x="430" y="10" width="60" height="300" fill="#133a22" opacity="0.3" />

        {/* ── Possession zone gradient overlay ──────────────────────────── */}
        <defs>
          <linearGradient id="homePossession" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={homeColor} stopOpacity="0.2" />
            <stop offset="100%" stopColor={homeColor} stopOpacity="0" />
          </linearGradient>
          <linearGradient id="awayPossession" x1="1" y1="0" x2="0" y2="0">
            <stop offset="0%" stopColor={awayColor} stopOpacity="0.2" />
            <stop offset="100%" stopColor={awayColor} stopOpacity="0" />
          </linearGradient>
          {/* Ball glow filter */}
          <filter id="ballGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Attack arrow marker */}
          <marker id="arrowRight" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <path d="M0,0 L8,3 L0,6" fill={homeColor} opacity="0.5" />
          </marker>
          <marker id="arrowLeft" markerWidth="8" markerHeight="6" refX="0" refY="3" orient="auto">
            <path d="M8,0 L0,3 L8,6" fill={awayColor} opacity="0.5" />
          </marker>
        </defs>

        {/* Home possession overlay with pulse */}
        {isLive && possession === 'home' && (
          <rect
            x="10" y="10" width="240" height="300"
            fill="url(#homePossession)"
            opacity={homeGradientOpacity}
            style={{ animation: 'possession-pulse 3s ease-in-out infinite' }}
          />
        )}
        {!isLive && (
          <rect
            x="10" y="10" width="240" height="300"
            fill="url(#homePossession)"
            opacity={homeGradientOpacity}
          />
        )}

        {/* Away possession overlay with pulse */}
        {isLive && possession === 'away' && (
          <rect
            x="250" y="10" width="240" height="300"
            fill="url(#awayPossession)"
            opacity={awayGradientOpacity}
            style={{ animation: 'possession-pulse 3s ease-in-out infinite' }}
          />
        )}
        {!isLive && (
          <rect
            x="250" y="10" width="240" height="300"
            fill="url(#awayPossession)"
            opacity={awayGradientOpacity}
          />
        )}

        {/* ── Attack direction arrow ──────────────────────────────────────── */}
        {isLive && attackDirection && (
          <line
            x1={attackDirection === 'right' ? 120 : 380}
            y1={160}
            x2={attackDirection === 'right' ? 380 : 120}
            y2={160}
            stroke={attackDirection === 'right' ? homeColor : awayColor}
            strokeWidth="2"
            strokeDasharray="8 6"
            opacity="0.3"
            markerEnd={attackDirection === 'right' ? 'url(#arrowRight)' : 'url(#arrowLeft)'}
            style={{ animation: 'attack-arrow-flow 2s ease-in-out infinite' }}
          />
        )}

        {/* ── Pitch outline ─────────────────────────────────────────────── */}
        <rect x="10" y="10" width="480" height="300" fill="none" stroke="#2d6b45" strokeWidth="2" rx="1" />

        {/* ── Half-way line ─────────────────────────────────────────────── */}
        <line x1="250" y1="10" x2="250" y2="310" stroke="#2d6b45" strokeWidth="1.5" />

        {/* ── Center circle ─────────────────────────────────────────────── */}
        <circle cx="250" cy="160" r="50" fill="none" stroke="#2d6b45" strokeWidth="1.5" />
        <circle cx="250" cy="160" r="4" fill="#2d6b45" />

        {/* ── Left penalty area ─────────────────────────────────────────── */}
        <rect x="10" y="80" width="80" height="160" fill="none" stroke="#2d6b45" strokeWidth="1.5" />
        <rect x="10" y="120" width="30" height="80" fill="none" stroke="#2d6b45" strokeWidth="1.5" />
        <circle cx="65" cy="160" r="3" fill="#2d6b45" />
        <path d="M 90 120 Q 110 160 90 200" fill="none" stroke="#2d6b45" strokeWidth="1.5" />
        <rect x="2" y="140" width="8" height="40" fill="none" stroke="#3d8b5c" strokeWidth="2" rx="2" />

        {/* ── Right penalty area ────────────────────────────────────────── */}
        <rect x="410" y="80" width="80" height="160" fill="none" stroke="#2d6b45" strokeWidth="1.5" />
        <rect x="460" y="120" width="30" height="80" fill="none" stroke="#2d6b45" strokeWidth="1.5" />
        <circle cx="435" cy="160" r="3" fill="#2d6b45" />
        <path d="M 410 120 Q 390 160 410 200" fill="none" stroke="#2d6b45" strokeWidth="1.5" />
        <rect x="490" y="140" width="8" height="40" fill="none" stroke="#3d8b5c" strokeWidth="2" rx="2" />

        {/* ── Corner arcs ───────────────────────────────────────────────── */}
        <path d="M 10 15 Q 15 10 20 10" fill="none" stroke="#2d6b45" strokeWidth="1" />
        <path d="M 10 305 Q 15 310 20 310" fill="none" stroke="#2d6b45" strokeWidth="1" />
        <path d="M 480 10 Q 485 10 490 15" fill="none" stroke="#2d6b45" strokeWidth="1" />
        <path d="M 480 310 Q 485 310 490 305" fill="none" stroke="#2d6b45" strokeWidth="1" />

        {/* ── Team labels ───────────────────────────────────────────────── */}
        <text x="50" y="30" fill={homeColor} fontSize="11" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif" opacity="0.8">
          {homeAbbr}
        </text>
        <text x="450" y="30" fill={awayColor} fontSize="11" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif" opacity="0.8">
          {awayAbbr}
        </text>

        {/* ── Player formation dots ─────────────────────────────────────── */}
        {/* Home team */}
        {homePositions.map((pos, i) => (
          <g key={`home-${i}`}>
            {/* Player shadow/glow */}
            <circle
              cx={pos.x}
              cy={pos.y + 2}
              r={6}
              fill="rgba(0,0,0,0.3)"
            />
            {/* Player dot */}
            <circle
              cx={pos.x}
              cy={pos.y}
              r={i === 0 ? 6 : 5} // GK slightly larger
              fill={i === 0 ? homeColor : homeColor}
              opacity={i === 0 ? 1 : 0.85}
              stroke={homeColor}
              strokeWidth="1"
              strokeOpacity="0.3"
            />
            {/* Player number hint */}
            <text
              x={pos.x}
              y={pos.y + 3}
              textAnchor="middle"
              fontSize="6"
              fontWeight="bold"
              fill="white"
              fontFamily="sans-serif"
              opacity="0.8"
            >
              {i + 1}
            </text>
          </g>
        ))}

        {/* Away team */}
        {awayPositions.map((pos, i) => (
          <g key={`away-${i}`}>
            <circle
              cx={pos.x}
              cy={pos.y + 2}
              r={6}
              fill="rgba(0,0,0,0.3)"
            />
            <circle
              cx={pos.x}
              cy={pos.y}
              r={i === 0 ? 6 : 5}
              fill={awayColor}
              opacity={i === 0 ? 1 : 0.85}
              stroke={awayColor}
              strokeWidth="1"
              strokeOpacity="0.3"
            />
            <text
              x={pos.x}
              y={pos.y + 3}
              textAnchor="middle"
              fontSize="6"
              fontWeight="bold"
              fill="white"
              fontFamily="sans-serif"
              opacity="0.8"
            >
              {i + 1}
            </text>
          </g>
        ))}

        {/* ── Action Markers ────────────────────────────────────────────── */}
        {actionMarkers.map(marker => {
          const age = Date.now() - marker.createdAt;
          const fadeProgress = Math.min(age / 8000, 1);

          if (marker.type === 'goal') {
            return (
              <g key={marker.id}>
                <circle
                  cx={marker.x}
                  cy={marker.y}
                  r={6}
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="2.5"
                  opacity={1 - fadeProgress}
                  style={{ animation: 'pitch-goal-ring 2.5s ease-out forwards' }}
                />
                <circle
                  cx={marker.x}
                  cy={marker.y}
                  r={6}
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="1.5"
                  opacity={0.8 - fadeProgress}
                  style={{ animation: 'pitch-goal-ring-2 2s ease-out 0.4s forwards' }}
                />
                {/* Goal flash fill */}
                <circle
                  cx={marker.x}
                  cy={marker.y}
                  r={20}
                  fill="#22c55e"
                  opacity={0.3 * (1 - fadeProgress)}
                />
                <text
                  x={marker.x}
                  y={marker.y + 7}
                  textAnchor="middle"
                  fontSize="22"
                  opacity={1 - fadeProgress}
                  style={{ animation: 'pitch-goal-emoji 2.5s ease-out forwards' }}
                >
                  ⚽
                </text>
              </g>
            );
          }

          if (marker.type === 'yellow_card') {
            return (
              <g key={marker.id}>
                <circle
                  cx={marker.x}
                  cy={marker.y}
                  r={6}
                  fill="#facc15"
                  opacity={0.7 * (1 - fadeProgress)}
                  style={{ animation: 'pitch-card-flash 4s ease-out forwards' }}
                />
                <rect
                  x={marker.x - 4}
                  y={marker.y - 6}
                  width="8"
                  height="12"
                  rx="1"
                  fill="#facc15"
                  opacity={0.9 * (1 - fadeProgress)}
                  stroke="#ca8a04"
                  strokeWidth="0.5"
                />
              </g>
            );
          }

          if (marker.type === 'red_card') {
            return (
              <g key={marker.id}>
                <circle
                  cx={marker.x}
                  cy={marker.y}
                  r={6}
                  fill="#ef4444"
                  opacity={0.7 * (1 - fadeProgress)}
                  style={{ animation: 'pitch-card-flash 4s ease-out forwards' }}
                />
                <rect
                  x={marker.x - 4}
                  y={marker.y - 6}
                  width="8"
                  height="12"
                  rx="1"
                  fill="#ef4444"
                  opacity={0.9 * (1 - fadeProgress)}
                  stroke="#dc2626"
                  strokeWidth="0.5"
                />
              </g>
            );
          }

          if (marker.type === 'var_review') {
            return (
              <g key={marker.id}>
                <circle
                  cx={marker.x}
                  cy={marker.y}
                  r={8}
                  fill="#8b5cf6"
                  opacity={0.7 * (1 - fadeProgress)}
                  style={{ animation: 'pitch-var-pulse 1s ease-in-out infinite' }}
                />
                <text
                  x={marker.x}
                  y={marker.y + 4}
                  textAnchor="middle"
                  fontSize="8"
                  fontWeight="bold"
                  fill="white"
                  opacity={0.9 * (1 - fadeProgress)}
                  fontFamily="sans-serif"
                >
                  VAR
                </text>
              </g>
            );
          }

          return null;
        })}

        {/* ── Ball trail (fading previous positions) ─────────────────────── */}
        {isLive && (
          <>
            <circle
              cx={ballPos.x}
              cy={ballPos.y}
              r={12}
              fill="white"
              opacity="0.06"
            />
            <circle
              cx={ballPos.x}
              cy={ballPos.y}
              r={10}
              fill="white"
              opacity="0.1"
            />
          </>
        )}

        {/* ── Ball ──────────────────────────────────────────────────────── */}
        <circle
          cx={ballPos.x}
          cy={ballPos.y}
          r={7}
          fill="#ffffff"
          opacity={0.95}
          filter="url(#ballGlow)"
          style={{
            animation: isLive ? 'pitch-ball-glow 2s ease-in-out infinite' : 'none',
          }}
        />
        {/* Ball outer glow ring during live */}
        {isLive && (
          <circle
            cx={ballPos.x}
            cy={ballPos.y}
            r={7}
            fill="none"
            stroke="rgba(255,255,255,0.4)"
            strokeWidth="1.5"
          >
            <animate attributeName="r" values="7;12;7" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.5;0.1;0.5" dur="2s" repeatCount="indefinite" />
          </circle>
        )}

        {/* ── Match minute in center circle ─────────────────────────────── */}
        {matchMinute != null && isLive && (
          <g>
            <rect
              x="222"
              y="145"
              width="56"
              height="28"
              rx="14"
              fill="rgba(0,0,0,0.6)"
              stroke="#22c55e"
              strokeWidth="0.5"
              opacity="0.9"
            />
            <text
              x="250"
              y="164"
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="13"
              fontWeight="bold"
              fill="#22c55e"
              fontFamily="sans-serif"
              opacity="0.95"
            >
              {matchMinute}&apos;
            </text>
          </g>
        )}

        {/* ── Possession indicator bar ──────────────────────────────────── */}
        {possession && isLive && (
          <g>
            <rect x="100" y="289" width="300" height="6" rx="3" fill="rgba(255,255,255,0.08)" />
            <rect
              x="100"
              y="289"
              width={possession === 'home' ? 180 : 120}
              height="6"
              rx="3"
              fill={possession === 'home' ? homeColor : awayColor}
              opacity="0.6"
            >
              <animate attributeName="opacity" values="0.4;0.7;0.4" dur="3s" repeatCount="indefinite" />
            </rect>
            <text
              x="250"
              y="285"
              fill={possession === 'home' ? homeColor : awayColor}
              fontSize="8"
              textAnchor="middle"
              fontFamily="sans-serif"
              opacity="0.7"
            >
              {possession === 'home' ? `${homeAbbr} attaque →` : `← ${awayAbbr} attaque`}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
