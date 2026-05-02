'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';

// ─── Props Interface ──────────────────────────────────────────────────────────
interface DynamicBasketballCourtProps {
  possession: 'home' | 'away' | null;
  homeAbbr: string;
  awayAbbr: string;
  homeColor: string;
  awayColor: string;
  isLive: boolean;
  lastEventType: string | null;
  clockDisplay: string | null;
  periodDisplay: string | null;
  events: Array<{
    type: string;
    minute: string;
    period: string;
    team: string;
    scoringPlay: boolean;
  }>;
}

// ─── Position type ────────────────────────────────────────────────────────────
interface Position {
  x: number;
  y: number;
}

// ─── Basketball 5-on-5 Formation Positions ────────────────────────────────────
// Home team on LEFT side — base/neutral positions
const HOME_FORMATION: Position[] = [
  { x: 60, y: 150 },   // PG - point guard
  { x: 120, y: 75 },   // SG - shooting guard
  { x: 120, y: 225 },  // SF - small forward
  { x: 170, y: 115 },  // PF - power forward
  { x: 170, y: 185 },  // C  - center
];

// Away team on RIGHT side (mirrored)
const AWAY_FORMATION: Position[] = [
  { x: 440, y: 150 },  // PG
  { x: 380, y: 75 },   // SG
  { x: 380, y: 225 },  // SF
  { x: 330, y: 115 },  // PF
  { x: 330, y: 185 },  // C
];

// Attacking positions — when team has possession
const HOME_ATTACKING: Position[] = [
  { x: 100, y: 150 },  // PG brings ball up
  { x: 170, y: 65 },   // SG on wing
  { x: 170, y: 235 },  // SF on wing
  { x: 130, y: 115 },  // PF at elbow
  { x: 55, y: 150 },   // C posts up
];

const AWAY_ATTACKING: Position[] = [
  { x: 400, y: 150 },  // PG
  { x: 330, y: 65 },   // SG
  { x: 330, y: 235 },  // SF
  { x: 370, y: 115 },  // PF
  { x: 445, y: 150 },  // C
];

// Defending positions — when team doesn't have possession
const HOME_DEFENDING: Position[] = [
  { x: 30, y: 150 },   // PG drops back
  { x: 70, y: 80 },    // SG
  { x: 70, y: 220 },   // SF
  { x: 55, y: 130 },   // PF in paint
  { x: 55, y: 170 },   // C in paint
];

const AWAY_DEFENDING: Position[] = [
  { x: 470, y: 150 },  // PG
  { x: 430, y: 80 },   // SG
  { x: 430, y: 220 },  // SF
  { x: 445, y: 130 },  // PF
  { x: 445, y: 170 },  // C
];

// ─── Action Marker type ───────────────────────────────────────────────────────
interface ActionMarker {
  id: number;
  type: 'field_goal' | 'three_pointer' | 'free_throw' | 'foul' | 'technical_foul' | 'flagrant_foul' | 'timeout';
  x: number;
  y: number;
  team: 'home' | 'away';
  createdAt: number;
}

// ─── Ball trajectory point ────────────────────────────────────────────────────
interface BallTrajectoryPoint {
  x: number;
  y: number;
  t: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

// ─── Generate smooth ball trajectory for basketball ──────────────────────────
function generateBasketballPath(
  possession: 'home' | 'away' | null,
  currentPos: Position
): BallTrajectoryPoint[] {
  const points: BallTrajectoryPoint[] = [];
  const now = Date.now();

  // Home possession → ball on right side (attacking away basket)
  // Away possession → ball on left side (attacking home basket)
  const baseX = possession === 'home' ? 350 : possession === 'away' ? 150 : 250;
  const baseY = 150;

  const numPoints = 10 + Math.floor(Math.random() * 5);
  let prevX = currentPos.x;
  let prevY = currentPos.y;

  for (let i = 0; i < numPoints; i++) {
    const progress = (i + 1) / numPoints;

    // Create weaving path around the offensive half
    const targetX = baseX + Math.sin(i * 1.4) * 70 + Math.cos(i * 0.8) * 30;
    const targetY = baseY + Math.cos(i * 1.2) * 80 + Math.sin(i * 0.6) * 25;

    const x = clamp(lerp(prevX, targetX, 0.55), 15, 485);
    const y = clamp(lerp(prevY, targetY, 0.55), 15, 285);

    points.push({ x, y, t: now + (progress * 7000) });
    prevX = x;
    prevY = y;
  }

  return points;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DynamicBasketballCourt({
  possession,
  homeAbbr,
  awayAbbr,
  homeColor,
  awayColor,
  isLive,
  lastEventType,
  clockDisplay,
  periodDisplay,
  events,
}: DynamicBasketballCourtProps) {
  // ── Ball position state ──────────────────────────────────────────────────
  const [ballPos, setBallPos] = useState<Position>({ x: 250, y: 150 });
  const ballPosRef = useRef<Position>({ x: 250, y: 150 });

  // ── Player positions ─────────────────────────────────────────────────────
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

  // ── Determine last event's team side ─────────────────────────────────────
  const lastEventTeamSide = useMemo<'home' | 'away' | null>(() => {
    if (!events || events.length === 0) return null;
    const last = events[0]; // Newest first in basketball
    const teamLower = last.team.toLowerCase();
    if (teamLower.includes(homeAbbr.toLowerCase()) || homeAbbr.toLowerCase().includes(teamLower)) {
      return 'home';
    }
    if (teamLower.includes(awayAbbr.toLowerCase()) || awayAbbr.toLowerCase().includes(teamLower)) {
      return 'away';
    }
    return possession;
  }, [events, homeAbbr, awayAbbr, possession]);

  // ── Unique event key ─────────────────────────────────────────────────────
  const lastEventKey = useMemo(() => {
    if (!events || events.length === 0) return null;
    const last = events[0];
    return `${last.type}-${last.minute}-${last.team}`;
  }, [events]);

  // ── Get target ball position based on event type ─────────────────────────
  const getTargetBallPos = useCallback((eventType: string | null, teamSide: 'home' | 'away' | null): Position => {
    const isHome = teamSide === 'home';

    switch (eventType) {
      case 'field_goal':
        return isHome ? { x: 60, y: 150 } : { x: 440, y: 150 };
      case 'three_pointer':
        return isHome
          ? { x: 140, y: 80 + Math.sin(Date.now() / 1000) * 60 }
          : { x: 360, y: 80 + Math.sin(Date.now() / 1000) * 60 };
      case 'free_throw':
        return isHome ? { x: 90, y: 150 } : { x: 410, y: 150 };
      case 'foul':
      case 'technical_foul':
      case 'flagrant_foul':
        return isHome ? { x: 120, y: 110 + Math.sin(Date.now() / 800) * 40 } : { x: 380, y: 110 + Math.sin(Date.now() / 800) * 40 };
      case 'rebound':
        return isHome ? { x: 55, y: 130 + Math.random() * 40 } : { x: 445, y: 130 + Math.random() * 40 };
      case 'substitution':
      case 'timeout':
        return { x: 250, y: 280 };
      case 'period_start':
      case 'period_end':
      case 'jump_ball':
        return { x: 250, y: 150 };
      case 'turnover':
        return { x: 250, y: 100 + Math.random() * 100 };
      default:
        return { x: 250, y: 150 };
    }
  }, [possession]);

  // ── Create action markers when events happen ────────────────────────────
  useEffect(() => {
    if (!lastEventKey || lastEventKey === prevEventIdRef.current) return;
    prevEventIdRef.current = lastEventKey;

    const markerTypes = ['field_goal', 'three_pointer', 'free_throw', 'foul', 'technical_foul', 'flagrant_foul', 'timeout'] as const;
    const evtType = events[0]?.type;
    if (!evtType || !markerTypes.includes(evtType as any)) return;

    const pos = getTargetBallPos(evtType, lastEventTeamSide);
    const newMarker: ActionMarker = {
      id: markerIdRef.current++,
      type: evtType as ActionMarker['type'],
      x: pos.x,
      y: pos.y,
      team: lastEventTeamSide || 'home',
      createdAt: Date.now(),
    };

    setActionMarkers(prev => [...prev.slice(-8), newMarker]);

    // Snap ball to event position
    ballPosRef.current = pos;
    setBallPos(pos);
    trajectoryRef.current = [];
  }, [lastEventKey, lastEventTeamSide, getTargetBallPos, events]);

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

  // ── Generate new ball trajectory ─────────────────────────────────────────
  const generateNewTrajectory = useCallback(() => {
    const pos = possessionRef.current;
    const current = ballPosRef.current;
    const newPath = generateBasketballPath(pos, current);
    trajectoryRef.current = newPath;
    trajectoryStartRef.current = Date.now();
    lastPathGenTimeRef.current = Date.now();
  }, []);

  // ── Generate trajectory when possession changes ──────────────────────────
  useEffect(() => {
    generateNewTrajectory();
  }, [possession, generateNewTrajectory]);

  // ── Generate new trajectory every ~7s during live ────────────────────────
  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => {
      if (trajectoryRef.current.length === 0 ||
          Date.now() - lastPathGenTimeRef.current > 6000) {
        generateNewTrajectory();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isLive, generateNewTrajectory]);

  // ── Main animation loop ──────────────────────────────────────────────────
  useEffect(() => {
    if (!isLive) {
      if (lastEventType) {
        const pos = getTargetBallPos(lastEventType, lastEventTeamSide);
        setBallPos(pos);
      }
      return;
    }

    let lastTime = performance.now();

    const animate = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      // ── Animate ball along trajectory ──────────────────────────────────
      const trajectory = trajectoryRef.current;
      if (trajectory.length > 0) {
        const elapsed = Date.now() - trajectoryStartRef.current;

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
          const easeT = t * t * (3 - 2 * t); // smoothstep

          const newX = lerp(prevPoint.x, nextPoint.x, easeT);
          const newY = lerp(prevPoint.y, nextPoint.y, easeT);

          ballPosRef.current = { x: newX, y: newY };
          setBallPos({ x: newX, y: newY });
        } else if (elapsed > 0 && trajectory.length > 0) {
          const lastPoint = trajectory[trajectory.length - 1];
          ballPosRef.current = { x: lastPoint.x, y: lastPoint.y };
          setBallPos({ x: lastPoint.x, y: lastPoint.y });

          if (Date.now() - lastPathGenTimeRef.current > 5000) {
            generateNewTrajectory();
          }
        }
      } else {
        generateNewTrajectory();
      }

      // ── Animate player positions ───────────────────────────────────────
      const pos = possessionRef.current;
      const homeTarget = pos === 'home' ? HOME_ATTACKING : pos === 'away' ? HOME_DEFENDING : HOME_FORMATION;
      const awayTarget = pos === 'away' ? AWAY_ATTACKING : pos === 'home' ? AWAY_DEFENDING : AWAY_FORMATION;

      const timeS = now / 1000;

      setHomePositions(homeTarget.map((target, i) => {
        const idle = {
          x: Math.sin(timeS * 0.6 + i * 1.5) * 6 + Math.cos(timeS * 0.4 + i * 0.8) * 4,
          y: Math.cos(timeS * 0.5 + i * 1.3) * 5 + Math.sin(timeS * 0.7 + i * 1.1) * 3,
        };

        const ball = ballPosRef.current;
        const toBallX = (ball.x - target.x) * 0.05;
        const toBallY = (ball.y - target.y) * 0.05;
        const maxBallShift = 18;

        return {
          x: clamp(target.x + idle.x + clamp(toBallX, -maxBallShift, maxBallShift), 10, 490),
          y: clamp(target.y + idle.y + clamp(toBallY, -maxBallShift, maxBallShift), 10, 290),
        };
      }));

      setAwayPositions(awayTarget.map((target, i) => {
        const idle = {
          x: Math.sin(timeS * 0.6 + i * 1.5 + 2) * 6 + Math.cos(timeS * 0.4 + i * 0.8 + 1) * 4,
          y: Math.cos(timeS * 0.5 + i * 1.3 + 2) * 5 + Math.sin(timeS * 0.7 + i * 1.1 + 1) * 3,
        };

        const ball = ballPosRef.current;
        const toBallX = (ball.x - target.x) * 0.05;
        const toBallY = (ball.y - target.y) * 0.05;
        const maxBallShift = 18;

        return {
          x: clamp(target.x + idle.x + clamp(toBallX, -maxBallShift, maxBallShift), 10, 490),
          y: clamp(target.y + idle.y + clamp(toBallY, -maxBallShift, maxBallShift), 10, 290),
        };
      }));

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isLive, lastEventType, lastEventTeamSide, getTargetBallPos, generateNewTrajectory]);

  // ── Attack direction ─────────────────────────────────────────────────────
  const attackDirection = possession === 'home' ? 'right' : possession === 'away' ? 'left' : null;

  // ── Possession gradient opacity ──────────────────────────────────────────
  const homeGradientOpacity = possession === 'home' ? 0.15 : 0;
  const awayGradientOpacity = possession === 'away' ? 0.15 : 0;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="relative w-full max-w-sm mx-auto">
      <style>{`
        @keyframes bball-ball-glow {
          0%, 100% { filter: drop-shadow(0 0 4px rgba(255,165,0,0.4)); }
          50% { filter: drop-shadow(0 0 10px rgba(255,165,0,0.8)); }
        }
        @keyframes bball-basket-ring {
          0% { r: 5; opacity: 1; }
          100% { r: 35; opacity: 0; }
        }
        @keyframes bball-basket-ring-2 {
          0% { r: 5; opacity: 0.8; }
          100% { r: 25; opacity: 0; }
        }
        @keyframes bball-three-ring {
          0% { r: 5; opacity: 1; }
          100% { r: 30; opacity: 0; }
        }
        @keyframes bball-flash {
          0% { opacity: 0.9; r: 6; }
          100% { opacity: 0; r: 25; }
        }
        @keyframes bball-foul-pulse {
          0%, 100% { r: 8; opacity: 0.8; }
          50% { r: 16; opacity: 0.3; }
        }
        @keyframes bball-score-emoji {
          0% { opacity: 1; font-size: 18px; }
          100% { opacity: 0; font-size: 28px; }
        }
        @keyframes bball-attack-arrow {
          0% { opacity: 0.15; strokeDashoffset: 20; }
          50% { opacity: 0.5; strokeDashoffset: 0; }
          100% { opacity: 0.15; strokeDashoffset: -20; }
        }
        @keyframes bball-possession-pulse {
          0%, 100% { opacity: 0.08; }
          50% { opacity: 0.2; }
        }
      `}</style>

      <svg viewBox="0 0 500 300" className="w-full h-auto rounded-xl overflow-hidden border border-border/30">
        {/* ── Court background ──────────────────────────────────────────── */}
        <rect x="0" y="0" width="500" height="300" fill="#1a1a2e" />

        {/* ── Wood floor texture stripes ────────────────────────────────── */}
        <rect x="10" y="10" width="40" height="280" fill="#1d1d35" opacity="0.4" />
        <rect x="50" y="10" width="40" height="280" fill="#1f1f38" opacity="0.3" />
        <rect x="90" y="10" width="40" height="280" fill="#1d1d35" opacity="0.4" />
        <rect x="130" y="10" width="40" height="280" fill="#1f1f38" opacity="0.3" />
        <rect x="170" y="10" width="40" height="280" fill="#1d1d35" opacity="0.4" />
        <rect x="210" y="10" width="40" height="280" fill="#1f1f38" opacity="0.3" />
        <rect x="250" y="10" width="40" height="280" fill="#1d1d35" opacity="0.4" />
        <rect x="290" y="10" width="40" height="280" fill="#1f1f38" opacity="0.3" />
        <rect x="330" y="10" width="40" height="280" fill="#1d1d35" opacity="0.4" />
        <rect x="370" y="10" width="40" height="280" fill="#1f1f38" opacity="0.3" />
        <rect x="410" y="10" width="40" height="280" fill="#1d1d35" opacity="0.4" />
        <rect x="450" y="10" width="40" height="280" fill="#1f1f38" opacity="0.3" />

        {/* ── Possession zone gradient overlay ──────────────────────────── */}
        <defs>
          <linearGradient id="homePossBBall" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={homeColor} stopOpacity="0.2" />
            <stop offset="100%" stopColor={homeColor} stopOpacity="0" />
          </linearGradient>
          <linearGradient id="awayPossBBall" x1="1" y1="0" x2="0" y2="0">
            <stop offset="0%" stopColor={awayColor} stopOpacity="0.2" />
            <stop offset="100%" stopColor={awayColor} stopOpacity="0" />
          </linearGradient>
          <marker id="bbArrowRight" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <path d="M0,0 L8,3 L0,6" fill={homeColor} opacity="0.5" />
          </marker>
          <marker id="bbArrowLeft" markerWidth="8" markerHeight="6" refX="0" refY="3" orient="auto">
            <path d="M8,0 L0,3 L8,6" fill={awayColor} opacity="0.5" />
          </marker>
        </defs>

        {/* Home possession overlay with pulse */}
        {isLive && possession === 'home' && (
          <rect
            x="10" y="10" width="240" height="280"
            fill="url(#homePossBBall)"
            opacity={homeGradientOpacity}
            style={{ animation: 'bball-possession-pulse 3s ease-in-out infinite' }}
          />
        )}
        {!isLive && (
          <rect x="10" y="10" width="240" height="280" fill="url(#homePossBBall)" opacity={homeGradientOpacity} />
        )}

        {/* Away possession overlay with pulse */}
        {isLive && possession === 'away' && (
          <rect
            x="250" y="10" width="240" height="280"
            fill="url(#awayPossBBall)"
            opacity={awayGradientOpacity}
            style={{ animation: 'bball-possession-pulse 3s ease-in-out infinite' }}
          />
        )}
        {!isLive && (
          <rect x="250" y="10" width="240" height="280" fill="url(#awayPossBBall)" opacity={awayGradientOpacity} />
        )}

        {/* ── Attack direction arrow ──────────────────────────────────────── */}
        {isLive && attackDirection && (
          <line
            x1={attackDirection === 'right' ? 100 : 400}
            y1={150}
            x2={attackDirection === 'right' ? 400 : 100}
            y2={150}
            stroke={attackDirection === 'right' ? homeColor : awayColor}
            strokeWidth="2"
            strokeDasharray="8 6"
            opacity="0.3"
            markerEnd={attackDirection === 'right' ? 'url(#bbArrowRight)' : 'url(#bbArrowLeft)'}
            style={{ animation: 'bball-attack-arrow 2s ease-in-out infinite' }}
          />
        )}

        {/* ── Court outline ─────────────────────────────────────────────── */}
        <rect x="10" y="10" width="480" height="280" fill="none" stroke="#3d3d5c" strokeWidth="2" rx="2" />

        {/* ── Half court line ─────────────────────────────────────────────── */}
        <line x1="250" y1="10" x2="250" y2="290" stroke="#3d3d5c" strokeWidth="2" />

        {/* ── Center circle ─────────────────────────────────────────────── */}
        <circle cx="250" cy="150" r="40" fill="none" stroke="#3d3d5c" strokeWidth="2" />
        <circle cx="250" cy="150" r="4" fill="#3d3d5c" />

        {/* ── Left key/paint ─────────────────────────────────────────────── */}
        <rect x="10" y="100" width="80" height="100" fill="rgba(255,107,0,0.06)" stroke="#3d3d5c" strokeWidth="1.5" />
        <circle cx="40" cy="150" r="20" fill="none" stroke="#3d3d5c" strokeWidth="1.5" />
        <circle cx="40" cy="150" r="3" fill={homeColor} opacity="0.6" />
        <circle cx="90" cy="150" r="40" fill="none" stroke="#3d3d5c" strokeWidth="1" strokeDasharray="4 4" />
        <path d="M 10 35 Q 170 35 170 150 Q 170 265 10 265" fill="none" stroke="#3d3d5c" strokeWidth="1.5" />

        {/* ── Right key/paint ────────────────────────────────────────────── */}
        <rect x="410" y="100" width="80" height="100" fill="rgba(34,197,94,0.06)" stroke="#3d3d5c" strokeWidth="1.5" />
        <circle cx="460" cy="150" r="20" fill="none" stroke="#3d3d5c" strokeWidth="1.5" />
        <circle cx="460" cy="150" r="3" fill={awayColor} opacity="0.6" />
        <circle cx="410" cy="150" r="40" fill="none" stroke="#3d3d5c" strokeWidth="1" strokeDasharray="4 4" />
        <path d="M 490 35 Q 330 35 330 150 Q 330 265 490 265" fill="none" stroke="#3d3d5c" strokeWidth="1.5" />

        {/* ── Team labels ───────────────────────────────────────────────── */}
        <text x="60" y="25" fill={homeColor} fontSize="12" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">
          {homeAbbr}
        </text>
        <text x="440" y="25" fill={awayColor} fontSize="12" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">
          {awayAbbr}
        </text>

        {/* ── Player formation dots ─────────────────────────────────────── */}
        {/* Home team */}
        {homePositions.map((pos, i) => {
          const labels = ['PG', 'SG', 'SF', 'PF', 'C'];
          return (
            <g key={`home-${i}`}>
              {/* Shadow */}
              <circle cx={pos.x} cy={pos.y + 2} r={7} fill="rgba(0,0,0,0.3)" />
              {/* Player dot */}
              <circle
                cx={pos.x}
                cy={pos.y}
                r={6}
                fill={homeColor}
                opacity={0.9}
                stroke={homeColor}
                strokeWidth="1"
                strokeOpacity="0.3"
              />
              {/* Position label */}
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
                {labels[i]}
              </text>
            </g>
          );
        })}

        {/* Away team */}
        {awayPositions.map((pos, i) => {
          const labels = ['PG', 'SG', 'SF', 'PF', 'C'];
          return (
            <g key={`away-${i}`}>
              <circle cx={pos.x} cy={pos.y + 2} r={7} fill="rgba(0,0,0,0.3)" />
              <circle
                cx={pos.x}
                cy={pos.y}
                r={6}
                fill={awayColor}
                opacity={0.9}
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
                {labels[i]}
              </text>
            </g>
          );
        })}

        {/* ── Action Markers ────────────────────────────────────────────── */}
        {actionMarkers.map(marker => {
          const age = Date.now() - marker.createdAt;
          const fadeProgress = Math.min(age / 8000, 1);

          if (marker.type === 'field_goal') {
            return (
              <g key={marker.id}>
                <circle cx={marker.x} cy={marker.y} r={5} fill="none"
                  stroke={marker.team === 'home' ? homeColor : awayColor}
                  strokeWidth="2.5" opacity={1 - fadeProgress}
                  style={{ animation: 'bball-basket-ring 2s ease-out forwards' }}
                />
                <circle cx={marker.x} cy={marker.y} r={5} fill="none"
                  stroke={marker.team === 'home' ? homeColor : awayColor}
                  strokeWidth="1.5" opacity={0.8 - fadeProgress}
                  style={{ animation: 'bball-basket-ring-2 1.5s ease-out 0.3s forwards' }}
                />
                <circle cx={marker.x} cy={marker.y} r={15}
                  fill={marker.team === 'home' ? homeColor : awayColor}
                  opacity={0.25 * (1 - fadeProgress)}
                />
                <text x={marker.x} y={marker.y + 6} textAnchor="middle" fontSize="18"
                  opacity={1 - fadeProgress}
                  style={{ animation: 'bball-score-emoji 2.5s ease-out forwards' }}
                >
                  🏀
                </text>
              </g>
            );
          }

          if (marker.type === 'three_pointer') {
            return (
              <g key={marker.id}>
                <circle cx={marker.x} cy={marker.y} r={5} fill="none" stroke="#22c55e"
                  strokeWidth="2.5" opacity={1 - fadeProgress}
                  style={{ animation: 'bball-three-ring 2s ease-out forwards' }}
                />
                <circle cx={marker.x} cy={marker.y} r={5} fill="none" stroke="#22c55e"
                  strokeWidth="1" opacity={0.7 - fadeProgress}
                  style={{ animation: 'bball-basket-ring-2 1.5s ease-out 0.3s forwards' }}
                />
                <circle cx={marker.x} cy={marker.y} r={18} fill="#22c55e"
                  opacity={0.2 * (1 - fadeProgress)}
                />
                <text x={marker.x} y={marker.y + 6} textAnchor="middle" fontSize="16"
                  fill="#22c55e" fontWeight="bold" opacity={1 - fadeProgress}
                  style={{ animation: 'bball-score-emoji 2.5s ease-out forwards' }}
                >
                  3️⃣
                </text>
              </g>
            );
          }

          if (marker.type === 'free_throw') {
            return (
              <g key={marker.id}>
                <circle cx={marker.x} cy={marker.y} r={6}
                  fill={marker.team === 'home' ? homeColor : awayColor}
                  opacity={0.5 * (1 - fadeProgress)}
                  style={{ animation: 'bball-flash 3s ease-out forwards' }}
                />
                <text x={marker.x} y={marker.y + 4} textAnchor="middle" fontSize="10"
                  fill="white" fontWeight="bold" opacity={0.9 * (1 - fadeProgress)} fontFamily="sans-serif"
                >
                  FT
                </text>
              </g>
            );
          }

          if (marker.type === 'foul' || marker.type === 'technical_foul' || marker.type === 'flagrant_foul') {
            const foulColor = marker.type === 'flagrant_foul' ? '#ef4444' : '#facc15';
            return (
              <g key={marker.id}>
                <circle cx={marker.x} cy={marker.y} r={8} fill={foulColor}
                  opacity={0.7 * (1 - fadeProgress)}
                  style={{ animation: 'bball-foul-pulse 1s ease-in-out infinite' }}
                />
                <text x={marker.x} y={marker.y + 4} textAnchor="middle" fontSize="8"
                  fontWeight="bold" fill="white" opacity={0.9 * (1 - fadeProgress)} fontFamily="sans-serif"
                >
                  {marker.type === 'technical_foul' ? 'T' : marker.type === 'flagrant_foul' ? 'F' : '⚡'}
                </text>
              </g>
            );
          }

          if (marker.type === 'timeout') {
            return (
              <g key={marker.id}>
                <circle cx={marker.x} cy={marker.y} r={15}
                  fill={marker.team === 'home' ? homeColor : awayColor}
                  opacity={0.3 * (1 - fadeProgress)}
                  style={{ animation: 'bball-flash 3s ease-out forwards' }}
                />
                <text x={marker.x} y={marker.y + 4} textAnchor="middle" fontSize="10"
                  fill="white" fontWeight="bold" opacity={0.8 * (1 - fadeProgress)} fontFamily="sans-serif"
                >
                  ⏱
                </text>
              </g>
            );
          }

          return null;
        })}

        {/* ── Ball trail ──────────────────────────────────────────────────── */}
        {isLive && (
          <>
            <circle cx={ballPos.x} cy={ballPos.y} r={14} fill="#ff8c00" opacity="0.05" />
            <circle cx={ballPos.x} cy={ballPos.y} r={11} fill="#ff8c00" opacity="0.1" />
          </>
        )}

        {/* ── Ball ──────────────────────────────────────────────────────── */}
        <circle
          cx={ballPos.x}
          cy={ballPos.y}
          r={8}
          fill="#ff8c00"
          opacity={0.95}
          style={{
            animation: isLive ? 'bball-ball-glow 2s ease-in-out infinite' : 'none',
          }}
        />
        {/* Ball cross-lines */}
        <line x1={ballPos.x - 5} y1={ballPos.y} x2={ballPos.x + 5} y2={ballPos.y}
          stroke="#1a1a2e" strokeWidth="0.8" opacity="0.4" />
        <line x1={ballPos.x} y1={ballPos.y - 5} x2={ballPos.x} y2={ballPos.y + 5}
          stroke="#1a1a2e" strokeWidth="0.8" opacity="0.4" />
        {/* Ball outer ring during live */}
        {isLive && (
          <circle cx={ballPos.x} cy={ballPos.y} r={8} fill="none"
            stroke="rgba(255,140,0,0.4)" strokeWidth="1.5"
          >
            <animate attributeName="r" values="8;13;8" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.5;0.1;0.5" dur="2s" repeatCount="indefinite" />
          </circle>
        )}

        {/* ── Clock / Period in center circle ───────────────────────────── */}
        {isLive && (clockDisplay || periodDisplay) && (
          <g>
            <rect x="218" y="130" width="64" height="36" rx="18"
              fill="rgba(0,0,0,0.6)" stroke="#ff8c00" strokeWidth="0.5" opacity="0.9" />
            <text x="250" y="147" textAnchor="middle" dominantBaseline="central"
              fontSize="14" fontWeight="bold" fill="#ff8c00" fontFamily="sans-serif" opacity="0.95"
            >
              {clockDisplay && clockDisplay !== '0:00' ? clockDisplay : '--:--'}
            </text>
            <text x="250" y="161" textAnchor="middle" dominantBaseline="central"
              fontSize="9" fontWeight="bold" fill="#ff8c00" fontFamily="sans-serif" opacity="0.7"
            >
              {periodDisplay || ''}
            </text>
          </g>
        )}

        {/* ── Possession indicator bar ──────────────────────────────────── */}
        {possession && isLive && (
          <g>
            <rect x="100" y="272" width="300" height="5" rx="2.5" fill="rgba(255,255,255,0.08)" />
            <rect x="100" y="272"
              width={possession === 'home' ? 190 : 110}
              height="5" rx="2.5"
              fill={possession === 'home' ? homeColor : awayColor}
              opacity="0.6"
            >
              <animate attributeName="opacity" values="0.4;0.7;0.4" dur="3s" repeatCount="indefinite" />
            </rect>
            <text x="250" y="268" fill={possession === 'home' ? homeColor : awayColor}
              fontSize="8" textAnchor="middle" fontFamily="sans-serif" opacity="0.7"
            >
              {possession === 'home' ? `${homeAbbr} attaque →` : `← ${awayAbbr} attaque`}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
