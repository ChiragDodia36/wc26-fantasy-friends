/**
 * PitchView — animated SVG football pitch with player tokens positioned
 * by formation. Captain token has a gold ring.
 *
 * Uses react-native-svg which is bundled with Expo by default.
 */
import Svg, { Circle, Ellipse, G, Line, Rect, Text as SvgText } from 'react-native-svg';
import { StyleSheet, View } from 'react-native';

export interface PitchPlayer {
  id: string;
  name: string;
  position: 'GK' | 'DEF' | 'MID' | 'FWD';
  isCaptain?: boolean;
  isViceCaptain?: boolean;
  points?: number;
}

interface PitchViewProps {
  players: PitchPlayer[];
  formation?: string; // e.g. "4-4-2"
  width?: number;
  height?: number;
}

const POSITION_Y: Record<string, number> = {
  GK: 0.88,
  DEF: 0.68,
  MID: 0.45,
  FWD: 0.22,
};

const POSITION_COLOR: Record<string, string> = {
  GK: '#FFD700',
  DEF: '#4FC3F7',
  MID: '#81C784',
  FWD: '#EF9A9A',
};

function spreadX(count: number, index: number, width: number, padding = 30): number {
  if (count === 1) return width / 2;
  const step = (width - padding * 2) / (count - 1);
  return padding + index * step;
}

export function PitchView({ players, width = 320, height = 440 }: PitchViewProps) {
  // Group by position
  const byPos: Record<string, PitchPlayer[]> = { GK: [], DEF: [], MID: [], FWD: [] };
  players.forEach((p) => {
    if (byPos[p.position]) byPos[p.position].push(p);
  });

  const tokens: Array<{ x: number; y: number; player: PitchPlayer }> = [];
  Object.entries(byPos).forEach(([pos, group]) => {
    const baseY = POSITION_Y[pos] * height;
    group.forEach((player, i) => {
      tokens.push({ x: spreadX(group.length, i, width), y: baseY, player });
    });
  });

  return (
    <View style={[styles.container, { width, height }]}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* Pitch background */}
        <Rect width={width} height={height} fill="#1A3A1A" rx={8} />

        {/* Pitch lines */}
        <Rect x={20} y={20} width={width - 40} height={height - 40} fill="none" stroke="#2E5E2E" strokeWidth={1.5} rx={4} />
        <Line x1={20} y1={height / 2} x2={width - 20} y2={height / 2} stroke="#2E5E2E" strokeWidth={1} />
        <Circle cx={width / 2} cy={height / 2} r={35} fill="none" stroke="#2E5E2E" strokeWidth={1} />

        {/* Goal areas */}
        <Rect x={width / 2 - 50} y={20} width={100} height={35} fill="none" stroke="#2E5E2E" strokeWidth={1} />
        <Rect x={width / 2 - 50} y={height - 55} width={100} height={35} fill="none" stroke="#2E5E2E" strokeWidth={1} />

        {/* Player tokens */}
        {tokens.map(({ x, y, player }) => {
          const color = POSITION_COLOR[player.position] ?? '#FFFFFF';
          const initials = player.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

          return (
            <G key={player.id}>
              {/* Captain ring */}
              {player.isCaptain && (
                <Circle cx={x} cy={y} r={20} fill="none" stroke="#FFD700" strokeWidth={2.5} />
              )}
              {/* VC ring */}
              {player.isViceCaptain && (
                <Circle cx={x} cy={y} r={20} fill="none" stroke="#81C784" strokeWidth={2} strokeDasharray="4 2" />
              )}
              {/* Player circle */}
              <Circle cx={x} cy={y} r={17} fill={color} opacity={0.9} />
              {/* Initials */}
              <SvgText
                x={x}
                y={y + 5}
                textAnchor="middle"
                fontSize={11}
                fontWeight="bold"
                fill="#0A0E1A"
              >
                {initials}
              </SvgText>
              {/* Name label */}
              <SvgText x={x} y={y + 31} textAnchor="middle" fontSize={9} fill="#FFFFFF" opacity={0.85}>
                {player.name.split(' ').pop()?.slice(0, 8)}
              </SvgText>
              {/* Points badge */}
              {player.points !== undefined && (
                <>
                  <Circle cx={x + 13} cy={y - 13} r={9} fill="#0A0E1A" />
                  <SvgText x={x + 13} y={y - 9} textAnchor="middle" fontSize={9} fontWeight="bold" fill="#FFD700">
                    {player.points}
                  </SvgText>
                </>
              )}
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: 8, overflow: 'hidden' },
});
