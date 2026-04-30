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
  lastEventType: string | null;   // 'field_goal', 'three_pointer', 'foul', etc.
  clockDisplay: string | null;    // "7:32", "0:00"
  periodDisplay: string | null;   // "Q1", "Q2", "HT", "OT"
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
// Home team on LEFT side
const HOME_FORMATION: Position[] = [
  { x: 45, y: 150 },   // PG - point guard
  { x: 110, y: 80 },   // SG - shooting guard
  { x: 110, y: 220 },  // SF - small forward
  { x: 155, y: 120 },  // PF - power forward
  { x: 155, y: 180 },  // C  - center
];

// Away team on RIGHT side (mirrored)
const AWAY_FORMATION: Position[] = [
  { x: 455, y: 150 },  // PG
  { x: 390, y: 80 },   // SG
  { x: 390, y: 220 },  // SF
  { x: 345, y: 120 },  // PF
  { x: 345, y: 180 },  // C
];

// ─── Action Marker type ───────────────────────────────────────────────────────
interface ActionMarker {
  id: number;
  type: 'field_goal' | 'three_pointer' | 'free_throw' | 'foul' | 'technical_foul' | 'flagrant_foul' | 'timeout' | 'substitution';
  x: number;
  y: number;
  team: 'home' | 'away';
  createdAt: number;
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
  const [driftOffset, setDriftOffset] = useState<Position>({ x: 0, y: 0 });
  const driftRef = useRef<NodeJS.Timeout | null>(null);

  // ── Action markers state ─────────────────────────────────────────────────
  const [actionMarkers, setActionMarkers] = useState<ActionMarker[]>([]);
  const markerIdRef = useRef(0);
  const prevEventTypeRef = useRef<string | null>(null);

  // ── Determine last event's team side ─────────────────────────────────────
  const lastEventTeamSide = useMemo<'home' | 'away' | null>(() => {
    if (!events || events.length === 0) return null;
    const last = events[events.length - 1];
    const teamLower = last.team.toLowerCase();
    if (teamLower.includes(homeAbbr.toLowerCase()) || homeAbbr.toLowerCase().includes(teamLower)) {
      return 'home';
    }
    if (teamLower.includes(awayAbbr.toLowerCase()) || awayAbbr.toLowerCase().includes(teamLower)) {
      return 'away';
    }
    return possession;
  }, [events, homeAbbr, awayAbbr, possession]);

  // ── Calculate target ball position based on event type ───────────────────
  const getTargetBallPos = useCallback((eventType: string | null, teamSide: 'home' | 'away' | null): Position => {
    const isHome = teamSide === 'home';

    switch (eventType) {
      case 'field_goal': {
        // 2-pointer: near the basket
        return isHome ? { x: 60, y: 150 } : { x: 440, y: 150 };
      }
      case 'three_pointer': {
        // 3-pointer: beyond the arc
        return isHome
          ? { x: 140, y: 80 + Math.random() * 140 }
          : { x: 360, y: 80 + Math.random() * 140 };
      }
      case 'free_throw': {
        // Free throw line
        return isHome ? { x: 90, y: 150 } : { x: 410, y: 150 };
      }
      case 'foul':
      case 'technical_foul':
      case 'flagrant_foul': {
        // Foul happened near midcourt or in the key
        return isHome ? { x: 120, y: 110 + Math.random() * 80 } : { x: 380, y: 110 + Math.random() * 80 };
      }
      case 'rebound': {
        // Under the basket
        return isHome ? { x: 55, y: 130 + Math.random() * 40 } : { x: 445, y: 130 + Math.random() * 40 };
      }
      case 'substitution':
      case 'timeout': {
        // Near the sideline/bench
        return { x: 250, y: 280 };
      }
      case 'period_start':
      case 'period_end': {
        // Center circle
        return { x: 250, y: 150 };
      }
      case 'turnover': {
        // Midcourt area
        return { x: 250, y: 100 + Math.random() * 100 };
      }
      case 'jump_ball': {
        return { x: 250, y: 150 };
      }
      default:
        return { x: 250, y: 150 };
    }
  }, [possession]);

  // ── Update ball position when event type changes ─────────────────────────
  useEffect(() => {
    if (lastEventType && lastEventType !== prevEventTypeRef.current) {
      const target = getTargetBallPos(lastEventType, lastEventTeamSide);
      setBallPos(target);
      setDriftOffset({ x: 0, y: 0 });
      prevEventTypeRef.current = lastEventType;
    }
  }, [lastEventType, lastEventTeamSide, getTargetBallPos]);

  // ── Default drift: slowly move ball during live matches ──────────────────
  useEffect(() => {
    if (!isLive) return;

    driftRef.current = setInterval(() => {
      setDriftOffset(prev => {
        const newX = prev.x + (Math.random() - 0.5) * 6;
        const newY = prev.y + (Math.random() - 0.5) * 6;
        return {
          x: Math.max(-40, Math.min(40, newX)),
          y: Math.max(-30, Math.min(30, newY)),
        };
      });
    }, 1800);

    return () => {
      if (driftRef.current) clearInterval(driftRef.current);
    };
  }, [isLive]);

  // ── Actual displayed ball position (base + drift) ────────────────────────
  const displayBallPos = useMemo<Position>(() => {
    const base = lastEventType ? getTargetBallPos(lastEventType, lastEventTeamSide) : { x: 250, y: 150 };
    return {
      x: Math.max(15, Math.min(485, base.x + driftOffset.x)),
      y: Math.max(15, Math.min(285, base.y + driftOffset.y)),
    };
  }, [lastEventType, lastEventTeamSide, driftOffset, getTargetBallPos]);

  useEffect(() => {
    setBallPos(displayBallPos);
  }, [displayBallPos]);

  // ── Create action markers when events happen ────────────────────────────
  useEffect(() => {
    if (!lastEventType) return;
    if (lastEventType === prevEventTypeRef.current && actionMarkers.length > 0) return;

    const markerTypes = ['field_goal', 'three_pointer', 'free_throw', 'foul', 'technical_foul', 'flagrant_foul', 'timeout'] as const;
    if (!markerTypes.includes(lastEventType as any)) return;

    const pos = getTargetBallPos(lastEventType, lastEventTeamSide);
    const newMarker: ActionMarker = {
      id: markerIdRef.current++,
      type: lastEventType as ActionMarker['type'],
      x: pos.x,
      y: pos.y,
      team: lastEventTeamSide || 'home',
      createdAt: Date.now(),
    };

    setActionMarkers(prev => [...prev, newMarker]);
  }, [lastEventType, lastEventTeamSide, getTargetBallPos, actionMarkers.length]);

  // ── Clean up old markers ─────────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setActionMarkers(prev => prev.filter(m => now - m.createdAt < 5000));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // ── Shift player positions toward ball (parallax effect) ─────────────────
  const getShiftedPositions = useCallback(
    (basePositions: Position[]): Position[] => {
      const shiftFactor = 0.08;
      return basePositions.map(pos => {
        const dx = (ballPos.x - pos.x) * shiftFactor;
        const dy = (ballPos.y - pos.y) * shiftFactor;
        const maxShift = 15;
        return {
          x: pos.x + Math.max(-maxShift, Math.min(maxShift, dx)),
          y: pos.y + Math.max(-maxShift, Math.min(maxShift, dy)),
        };
      });
    },
    [ballPos]
  );

  const shiftedHome = useMemo(() => getShiftedPositions(HOME_FORMATION), [getShiftedPositions]);
  const shiftedAway = useMemo(() => getShiftedPositions(AWAY_FORMATION), [getShiftedPositions]);

  // ── Possession gradient opacity ──────────────────────────────────────────
  const homeGradientOpacity = possession === 'home' ? 0.15 : 0;
  const awayGradientOpacity = possession === 'away' ? 0.15 : 0;

  return (
    <div className="relative w-full max-w-sm mx-auto">
      {/* CSS Keyframes for animations */}
      <style>{`
        @keyframes bball-ball-glow {
          0%, 100% { filter: drop-shadow(0 0 4px rgba(255,165,0,0.4)); }
          50% { filter: drop-shadow(0 0 10px rgba(255,165,0,0.7)); }
        }
        @keyframes bball-player-breathe {
          0%, 100% { r: 6; }
          50% { r: 7; }
        }
        @keyframes bball-basket-ring {
          0% { r: 5; opacity: 1; }
          100% { r: 30; opacity: 0; }
        }
        @keyframes bball-basket-ring-2 {
          0% { r: 5; opacity: 0.8; }
          100% { r: 22; opacity: 0; }
        }
        @keyframes bball-three-ring {
          0% { r: 5; opacity: 1; }
          100% { r: 28; opacity: 0; }
        }
        @keyframes bball-flash {
          0% { opacity: 0.8; }
          100% { opacity: 0; }
        }
        @keyframes bball-foul-pulse {
          0%, 100% { r: 8; opacity: 0.8; }
          50% { r: 14; opacity: 0.3; }
        }
        @keyframes bball-score-emoji {
          0% { opacity: 1; font-size: 18px; }
          100% { opacity: 0; font-size: 26px; }
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
        </defs>

        {/* Home possession overlay */}
        <rect
          x="10" y="10" width="240" height="280"
          fill="url(#homePossBBall)"
          opacity={homeGradientOpacity}
          style={{ transition: 'opacity 2s ease' }}
        />
        {/* Away possession overlay */}
        <rect
          x="250" y="10" width="240" height="280"
          fill="url(#awayPossBBall)"
          opacity={awayGradientOpacity}
          style={{ transition: 'opacity 2s ease' }}
        />

        {/* ── Court outline ─────────────────────────────────────────────── */}
        <rect x="10" y="10" width="480" height="280" fill="none" stroke="#3d3d5c" strokeWidth="2" rx="2" />

        {/* ── Half court line ─────────────────────────────────────────────── */}
        <line x1="250" y1="10" x2="250" y2="290" stroke="#3d3d5c" strokeWidth="2" />

        {/* ── Center circle ─────────────────────────────────────────────── */}
        <circle cx="250" cy="150" r="40" fill="none" stroke="#3d3d5c" strokeWidth="2" />
        <circle cx="250" cy="150" r="4" fill="#3d3d5c" />

        {/* ── Left key/paint ─────────────────────────────────────────────── */}
        <rect x="10" y="100" width="80" height="100" fill="rgba(255,107,0,0.06)" stroke="#3d3d5c" strokeWidth="1.5" />
        {/* Left basket circle */}
        <circle cx="40" cy="150" r="20" fill="none" stroke="#3d3d5c" strokeWidth="1.5" />
        <circle cx="40" cy="150" r="3" fill={homeColor} opacity="0.6" />
        {/* Left free throw circle */}
        <circle cx="90" cy="150" r="40" fill="none" stroke="#3d3d5c" strokeWidth="1" strokeDasharray="4 4" />
        {/* Left 3-point arc */}
        <path d="M 10 35 Q 170 35 170 150 Q 170 265 10 265" fill="none" stroke="#3d3d5c" strokeWidth="1.5" />

        {/* ── Right key/paint ────────────────────────────────────────────── */}
        <rect x="410" y="100" width="80" height="100" fill="rgba(34,197,94,0.06)" stroke="#3d3d5c" strokeWidth="1.5" />
        {/* Right basket circle */}
        <circle cx="460" cy="150" r="20" fill="none" stroke="#3d3d5c" strokeWidth="1.5" />
        <circle cx="460" cy="150" r="3" fill={awayColor} opacity="0.6" />
        {/* Right free throw circle */}
        <circle cx="410" cy="150" r="40" fill="none" stroke="#3d3d5c" strokeWidth="1" strokeDasharray="4 4" />
        {/* Right 3-point arc */}
        <path d="M 490 35 Q 330 35 330 150 Q 330 265 490 265" fill="none" stroke="#3d3d5c" strokeWidth="1.5" />

        {/* ── Team labels ───────────────────────────────────────────────── */}
        <text x="60" y="25" fill={homeColor} fontSize="12" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">
          {homeAbbr}
        </text>
        <text x="440" y="25" fill={awayColor} fontSize="12" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">
          {awayAbbr}
        </text>

        {/* ── Player formation dots ─────────────────────────────────────── */}
        {/* Home team (orange/warm dots on left side) */}
        {shiftedHome.map((pos, i) => (
          <circle
            key={`home-${i}`}
            cx={pos.x}
            cy={pos.y}
            r={6}
            fill={homeColor}
            opacity={0.9}
            style={{
              transition: 'cx 1s ease, cy 1s ease',
              animation: 'bball-player-breathe 3s ease-in-out infinite',
              animationDelay: `${i * 0.3}s`,
            }}
          />
        ))}

        {/* Away team (green/cool dots on right side) */}
        {shiftedAway.map((pos, i) => (
          <circle
            key={`away-${i}`}
            cx={pos.x}
            cy={pos.y}
            r={6}
            fill={awayColor}
            opacity={0.9}
            style={{
              transition: 'cx 1s ease, cy 1s ease',
              animation: 'bball-player-breathe 3s ease-in-out infinite',
              animationDelay: `${i * 0.3 + 0.15}s`,
            }}
          />
        ))}

        {/* ── Action Markers ────────────────────────────────────────────── */}
        {actionMarkers.map(marker => {
          const age = Date.now() - marker.createdAt;
          const fadeProgress = Math.min(age / 5000, 1);

          // Scoring plays: basket ring animation
          if (marker.type === 'field_goal') {
            return (
              <g key={marker.id}>
                <circle
                  cx={marker.x}
                  cy={marker.y}
                  r={5}
                  fill="none"
                  stroke={marker.team === 'home' ? homeColor : awayColor}
                  strokeWidth="2"
                  opacity={1 - fadeProgress}
                  style={{ animation: 'bball-basket-ring 1.5s ease-out forwards' }}
                />
                <circle
                  cx={marker.x}
                  cy={marker.y}
                  r={5}
                  fill="none"
                  stroke={marker.team === 'home' ? homeColor : awayColor}
                  strokeWidth="1.5"
                  opacity={0.8 - fadeProgress}
                  style={{ animation: 'bball-basket-ring-2 1.2s ease-out 0.2s forwards' }}
                />
                <text
                  x={marker.x}
                  y={marker.y + 5}
                  textAnchor="middle"
                  fontSize="16"
                  opacity={1 - fadeProgress}
                  style={{ animation: 'bball-score-emoji 2s ease-out forwards' }}
                >
                  🏀
                </text>
              </g>
            );
          }

          if (marker.type === 'three_pointer') {
            return (
              <g key={marker.id}>
                <circle
                  cx={marker.x}
                  cy={marker.y}
                  r={5}
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="2"
                  opacity={1 - fadeProgress}
                  style={{ animation: 'bball-three-ring 1.5s ease-out forwards' }}
                />
                <circle
                  cx={marker.x}
                  cy={marker.y}
                  r={5}
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="1"
                  opacity={0.7 - fadeProgress}
                  style={{ animation: 'bball-basket-ring-2 1s ease-out 0.3s forwards' }}
                />
                <text
                  x={marker.x}
                  y={marker.y + 5}
                  textAnchor="middle"
                  fontSize="16"
                  fill="#22c55e"
                  fontWeight="bold"
                  opacity={1 - fadeProgress}
                  style={{ animation: 'bball-score-emoji 2s ease-out forwards' }}
                >
                  3️⃣
                </text>
              </g>
            );
          }

          if (marker.type === 'free_throw') {
            return (
              <g key={marker.id}>
                <circle
                  cx={marker.x}
                  cy={marker.y}
                  r={18}
                  fill={marker.team === 'home' ? homeColor : awayColor}
                  opacity={0.4 * (1 - fadeProgress)}
                  style={{ animation: 'bball-flash 2s ease-out forwards' }}
                />
                <text
                  x={marker.x}
                  y={marker.y + 4}
                  textAnchor="middle"
                  fontSize="10"
                  fill="white"
                  fontWeight="bold"
                  opacity={0.9 * (1 - fadeProgress)}
                  fontFamily="sans-serif"
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
                <circle
                  cx={marker.x}
                  cy={marker.y}
                  r={8}
                  fill={foulColor}
                  opacity={0.7 * (1 - fadeProgress)}
                  style={{ animation: 'bball-foul-pulse 1s ease-in-out infinite' }}
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
                  {marker.type === 'technical_foul' ? 'T' : marker.type === 'flagrant_foul' ? 'F' : '⚡'}
                </text>
              </g>
            );
          }

          if (marker.type === 'timeout') {
            return (
              <g key={marker.id}>
                <circle
                  cx={marker.x}
                  cy={marker.y}
                  r={15}
                  fill={marker.team === 'home' ? homeColor : awayColor}
                  opacity={0.3 * (1 - fadeProgress)}
                  style={{ animation: 'bball-flash 3s ease-out forwards' }}
                />
                <text
                  x={marker.x}
                  y={marker.y + 4}
                  textAnchor="middle"
                  fontSize="10"
                  fill="white"
                  fontWeight="bold"
                  opacity={0.8 * (1 - fadeProgress)}
                  fontFamily="sans-serif"
                >
                  ⏱
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
          r={8}
          fill="#ff8c00"
          opacity={0.95}
          style={{
            transition: 'cx 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94), cy 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            filter: isLive ? 'drop-shadow(0 0 6px rgba(255,140,0,0.5))' : 'none',
            animation: isLive ? 'bball-ball-glow 2s ease-in-out infinite' : 'none',
          }}
        />
        {/* Ball cross-lines (basketball texture) */}
        <line
          x1={ballPos.x - 5}
          y1={ballPos.y}
          x2={ballPos.x + 5}
          y2={ballPos.y}
          stroke="#1a1a2e"
          strokeWidth="0.8"
          opacity="0.4"
          style={{
            transition: 'x1 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94), y1 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          }}
        />
        <line
          x1={ballPos.x}
          y1={ballPos.y - 5}
          x2={ballPos.x}
          y2={ballPos.y + 5}
          stroke="#1a1a2e"
          strokeWidth="0.8"
          opacity="0.4"
          style={{
            transition: 'x1 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94), y1 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          }}
        />
        {/* Ball outer ring during live */}
        {isLive && (
          <circle
            cx={ballPos.x}
            cy={ballPos.y}
            r={8}
            fill="none"
            stroke="rgba(255,140,0,0.3)"
            strokeWidth="1.5"
            style={{
              transition: 'cx 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94), cy 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            }}
          >
            <animate attributeName="r" values="8;13;8" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.4;0.1;0.4" dur="2s" repeatCount="indefinite" />
          </circle>
        )}

        {/* ── Clock / Period in center circle ───────────────────────────── */}
        {isLive && (clockDisplay || periodDisplay) && (
          <g>
            <text
              x="250"
              y="145"
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="14"
              fontWeight="bold"
              fill="#ff8c00"
              fontFamily="sans-serif"
              opacity="0.9"
            >
              {clockDisplay && clockDisplay !== '0:00' ? clockDisplay : ''}
            </text>
            <text
              x="250"
              y="162"
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="10"
              fontWeight="bold"
              fill="#ff8c00"
              fontFamily="sans-serif"
              opacity="0.7"
            >
              {periodDisplay || ''}
            </text>
          </g>
        )}

        {/* ── Possession label ──────────────────────────────────────────── */}
        {possession && (
          <text
            x="250"
            y="282"
            fill={possession === 'home' ? homeColor : awayColor}
            fontSize="9"
            textAnchor="middle"
            fontFamily="sans-serif"
            opacity="0.7"
          >
            Possession: {possession === 'home' ? homeAbbr : awayAbbr}
          </text>
        )}
      </svg>
    </div>
  );
}
