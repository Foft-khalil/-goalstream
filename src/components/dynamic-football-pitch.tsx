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
  lastEventType: string | null;   // 'goal', 'yellow_card', etc.
  matchMinute: number | null;     // current match minute
  events: Array<{
    type: string;
    minute: number;
    team: string;  // team name
  }>;
}

// ─── Position type ────────────────────────────────────────────────────────────
interface Position {
  x: number;
  y: number;
}

// ─── 4-3-3 Formation Positions ────────────────────────────────────────────────
// Home team on LEFT side
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

// ─── Action Marker type ───────────────────────────────────────────────────────
interface ActionMarker {
  id: number;
  type: 'goal' | 'yellow_card' | 'red_card' | 'var_review';
  x: number;
  y: number;
  createdAt: number; // Date.now()
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
  const [driftOffset, setDriftOffset] = useState<Position>({ x: 0, y: 0 });
  const driftRef = useRef<NodeJS.Timeout | null>(null);

  // ── Action markers state ─────────────────────────────────────────────────
  const [actionMarkers, setActionMarkers] = useState<ActionMarker[]>([]);
  const markerIdRef = useRef(0);
  const prevEventTypeRef = useRef<string | null>(null);

  // ── Determine last event's team ──────────────────────────────────────────
  const lastEventTeam = useMemo(() => {
    if (!events || events.length === 0) return null;
    const last = events[events.length - 1];
    return last.team;
  }, [events]);

  // ── Calculate target ball position based on event type ───────────────────
  const getTargetBallPos = useCallback((eventType: string | null, team: string | null): Position => {
    switch (eventType) {
      case 'goal': {
        // If home team scored, ball in away goal area (right); if away scored, left
        // Determine by comparing lastEventTeam to home/away abbreviations
        if (team && team.toLowerCase().includes(homeAbbr.toLowerCase())) {
          return { x: 450, y: 160 }; // Home scored → ball in away goal
        } else if (team && team.toLowerCase().includes(awayAbbr.toLowerCase())) {
          return { x: 50, y: 160 };  // Away scored → ball in home goal
        }
        // Fallback: possession-based
        return possession === 'home' ? { x: 450, y: 160 } : { x: 50, y: 160 };
      }
      case 'yellow_card':
      case 'red_card': {
        // Midfield area with some randomness
        const yOffset = (Math.sin(Date.now() / 1000) * 40);
        return { x: 250, y: 100 + yOffset };
      }
      case 'substitution':
        return { x: 250, y: 295 }; // Near sideline/technical area
      case 'period_start':
      case 'period_end':
        return { x: 250, y: 160 }; // Center circle
      case 'var_review':
        return { x: 250, y: 160 }; // Center
      default:
        return { x: 250, y: 160 }; // Default to center
    }
  }, [possession, homeAbbr, awayAbbr]);

  // ── Update ball position when event type changes ─────────────────────────
  useEffect(() => {
    if (lastEventType && lastEventType !== prevEventTypeRef.current) {
      const target = getTargetBallPos(lastEventType, lastEventTeam);
      setBallPos(target);
      setDriftOffset({ x: 0, y: 0 }); // Reset drift when event fires
      prevEventTypeRef.current = lastEventType;
    }
  }, [lastEventType, lastEventTeam, getTargetBallPos]);

  // ── Default drift: slowly move ball around midfield ──────────────────────
  useEffect(() => {
    if (!isLive) return; // Only drift during live matches

    driftRef.current = setInterval(() => {
      setDriftOffset(prev => {
        const newX = prev.x + (Math.random() - 0.5) * 4;
        const newY = prev.y + (Math.random() - 0.5) * 4;
        // Clamp drift to midfield area (±50 from center)
        return {
          x: Math.max(-50, Math.min(50, newX)),
          y: Math.max(-40, Math.min(40, newY)),
        };
      });
    }, 2000);

    return () => {
      if (driftRef.current) clearInterval(driftRef.current);
    };
  }, [isLive]);

  // ── Actual displayed ball position (base + drift) ────────────────────────
  const displayBallPos = useMemo<Position>(() => {
    const base = lastEventType ? getTargetBallPos(lastEventType, lastEventTeam) : { x: 250, y: 160 };
    return {
      x: Math.max(15, Math.min(485, base.x + driftOffset.x)),
      y: Math.max(15, Math.min(305, base.y + driftOffset.y)),
    };
  }, [lastEventType, lastEventTeam, driftOffset, getTargetBallPos]);

  // ── Update actual ball display position ──────────────────────────────────
  useEffect(() => {
    setBallPos(displayBallPos);
  }, [displayBallPos]);

  // ── Create action markers when events happen ────────────────────────────
  useEffect(() => {
    if (!lastEventType) return;
    if (lastEventType === prevEventTypeRef.current && actionMarkers.length > 0) return;

    const markerTypes = ['goal', 'yellow_card', 'red_card', 'var_review'] as const;
    if (!markerTypes.includes(lastEventType as any)) return;

    const pos = getTargetBallPos(lastEventType, lastEventTeam);
    const newMarker: ActionMarker = {
      id: markerIdRef.current++,
      type: lastEventType as ActionMarker['type'],
      x: pos.x,
      y: pos.y,
      createdAt: Date.now(),
    };

    setActionMarkers(prev => [...prev, newMarker]);
  }, [lastEventType, lastEventTeam, getTargetBallPos, actionMarkers.length]);

  // ── Clean up old markers (older than 5 seconds) ─────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setActionMarkers(prev => prev.filter(m => now - m.createdAt < 5000));
    }, 500);

    return () => clearInterval(interval);
  }, []);

  // ── Shift player positions toward ball (parallax effect) ─────────────────
  const getShiftedPositions = useCallback(
    (basePositions: Position[], isHome: boolean): Position[] => {
      const shiftFactor = 0.06; // Subtle shift
      return basePositions.map(pos => {
        const dx = (ballPos.x - pos.x) * shiftFactor;
        const dy = (ballPos.y - pos.y) * shiftFactor;
        // Clamp shifts so players don't move too far
        const maxShift = 12;
        return {
          x: pos.x + Math.max(-maxShift, Math.min(maxShift, dx)),
          y: pos.y + Math.max(-maxShift, Math.min(maxShift, dy)),
        };
      });
    },
    [ballPos]
  );

  const shiftedHome = useMemo(() => getShiftedPositions(HOME_FORMATION, true), [getShiftedPositions]);
  const shiftedAway = useMemo(() => getShiftedPositions(AWAY_FORMATION, false), [getShiftedPositions]);

  // ── Possession gradient opacity ──────────────────────────────────────────
  const homeGradientOpacity = possession === 'home' ? 0.12 : 0;
  const awayGradientOpacity = possession === 'away' ? 0.12 : 0;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="relative w-full max-w-sm mx-auto">
      {/* CSS Keyframes for animations */}
      <style>{`
        @keyframes pitch-ball-glow {
          0%, 100% { filter: drop-shadow(0 0 4px rgba(255,255,255,0.4)); }
          50% { filter: drop-shadow(0 0 10px rgba(255,255,255,0.7)); }
        }
        @keyframes pitch-player-breathe {
          0%, 100% { r: 5; }
          50% { r: 6; }
        }
        @keyframes pitch-goal-ring {
          0% { r: 6; opacity: 1; }
          100% { r: 35; opacity: 0; }
        }
        @keyframes pitch-goal-ring-2 {
          0% { r: 6; opacity: 0.8; }
          100% { r: 25; opacity: 0; }
        }
        @keyframes pitch-card-flash {
          0% { opacity: 0.9; }
          100% { opacity: 0; }
        }
        @keyframes pitch-var-pulse {
          0%, 100% { r: 8; opacity: 0.8; }
          50% { r: 14; opacity: 0.3; }
        }
        @keyframes pitch-goal-emoji {
          0% { opacity: 1; font-size: 20px; }
          100% { opacity: 0; font-size: 28px; }
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
            <stop offset="0%" stopColor={homeColor} stopOpacity="0.15" />
            <stop offset="100%" stopColor={homeColor} stopOpacity="0" />
          </linearGradient>
          <linearGradient id="awayPossession" x1="1" y1="0" x2="0" y2="0">
            <stop offset="0%" stopColor={awayColor} stopOpacity="0.15" />
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
        </defs>

        {/* Home possession overlay - animates based on ball position */}
        <rect
          x="10" y="10" width="240" height="300"
          fill="url(#homePossession)"
          opacity={homeGradientOpacity}
          style={{ transition: 'opacity 2s ease' }}
        />
        {/* Away possession overlay */}
        <rect
          x="250" y="10" width="240" height="300"
          fill="url(#awayPossession)"
          opacity={awayGradientOpacity}
          style={{ transition: 'opacity 2s ease' }}
        />

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
        {/* Home team (warm/red dots on left side) */}
        {shiftedHome.map((pos, i) => (
          <circle
            key={`home-${i}`}
            cx={pos.x}
            cy={pos.y}
            r={5}
            fill={homeColor}
            opacity={0.85}
            style={{
              transition: 'cx 1s ease, cy 1s ease',
              animation: 'pitch-player-breathe 3s ease-in-out infinite',
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}

        {/* Away team (cool/blue dots on right side) */}
        {shiftedAway.map((pos, i) => (
          <circle
            key={`away-${i}`}
            cx={pos.x}
            cy={pos.y}
            r={5}
            fill={awayColor}
            opacity={0.85}
            style={{
              transition: 'cx 1s ease, cy 1s ease',
              animation: 'pitch-player-breathe 3s ease-in-out infinite',
              animationDelay: `${i * 0.2 + 0.1}s`,
            }}
          />
        ))}

        {/* ── Action Markers ────────────────────────────────────────────── */}
        {actionMarkers.map(marker => {
          const age = Date.now() - marker.createdAt;
          const fadeProgress = Math.min(age / 5000, 1); // 0 → 1 over 5s

          if (marker.type === 'goal') {
            return (
              <g key={marker.id}>
                {/* Expanding ring 1 */}
                <circle
                  cx={marker.x}
                  cy={marker.y}
                  r={6}
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="2"
                  opacity={1 - fadeProgress}
                  style={{ animation: 'pitch-goal-ring 2s ease-out forwards' }}
                />
                {/* Expanding ring 2 */}
                <circle
                  cx={marker.x}
                  cy={marker.y}
                  r={6}
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="1.5"
                  opacity={0.8 - fadeProgress}
                  style={{ animation: 'pitch-goal-ring-2 1.5s ease-out 0.3s forwards' }}
                />
                {/* Goal emoji */}
                <text
                  x={marker.x}
                  y={marker.y + 6}
                  textAnchor="middle"
                  fontSize="18"
                  opacity={1 - fadeProgress}
                  style={{ animation: 'pitch-goal-emoji 2s ease-out forwards' }}
                >
                  ⚽
                </text>
              </g>
            );
          }

          if (marker.type === 'yellow_card') {
            return (
              <g key={marker.id}>
                {/* Yellow flash */}
                <circle
                  cx={marker.x}
                  cy={marker.y}
                  r={20}
                  fill="#facc15"
                  opacity={0.7 * (1 - fadeProgress)}
                  style={{ animation: 'pitch-card-flash 3s ease-out forwards' }}
                />
              </g>
            );
          }

          if (marker.type === 'red_card') {
            return (
              <g key={marker.id}>
                {/* Red flash */}
                <circle
                  cx={marker.x}
                  cy={marker.y}
                  r={20}
                  fill="#ef4444"
                  opacity={0.7 * (1 - fadeProgress)}
                  style={{ animation: 'pitch-card-flash 3s ease-out forwards' }}
                />
              </g>
            );
          }

          if (marker.type === 'var_review') {
            return (
              <g key={marker.id}>
                {/* Purple pulsing indicator */}
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

        {/* ── Ball ──────────────────────────────────────────────────────── */}
        <circle
          cx={ballPos.x}
          cy={ballPos.y}
          r={7}
          fill="#ffffff"
          opacity={0.95}
          style={{
            transition: 'cx 1.5s cubic-bezier(0.25, 0.46, 0.45, 0.94), cy 1.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            filter: isLive ? 'drop-shadow(0 0 6px rgba(255,255,255,0.5))' : 'none',
            animation: isLive ? 'pitch-ball-glow 2s ease-in-out infinite' : 'none',
          }}
        />
        {/* Ball subtle outer ring during live */}
        {isLive && (
          <circle
            cx={ballPos.x}
            cy={ballPos.y}
            r={7}
            fill="none"
            stroke="rgba(255,255,255,0.3)"
            strokeWidth="1.5"
            style={{
              transition: 'cx 1.5s cubic-bezier(0.25, 0.46, 0.45, 0.94), cy 1.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            }}
          >
            <animate attributeName="r" values="7;11;7" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.4;0.1;0.4" dur="2s" repeatCount="indefinite" />
          </circle>
        )}

        {/* ── Match minute in center circle ─────────────────────────────── */}
        {matchMinute != null && isLive && (
          <text
            x="250"
            y="165"
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="16"
            fontWeight="bold"
            fill="#22c55e"
            fontFamily="sans-serif"
            opacity="0.9"
          >
            {matchMinute}&apos;
          </text>
        )}

        {/* ── Possession label ──────────────────────────────────────────── */}
        {possession && (
          <text
            x="250"
            y="300"
            fill={possession === 'home' ? homeColor : awayColor}
            fontSize="9"
            textAnchor="middle"
            fontFamily="sans-serif"
            opacity="0.6"
          >
            Possession: {possession === 'home' ? homeAbbr : awayAbbr}
          </text>
        )}
      </svg>
    </div>
  );
}
