/**
 * PitchView — interactive football pitch with player tokens.
 * SVG renders the pitch background only. Player tokens are native Views
 * with absolute positioning for reliable touch handling.
 *
 * Tap flow: tap player → action sheet / tap to swap.
 */
import Svg, { Circle, Defs, Line, LinearGradient, Rect, Stop } from 'react-native-svg';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export interface PitchPlayer {
  id: string;
  name: string;
  position: 'GK' | 'DEF' | 'MID' | 'FWD';
  price?: number;
  isCaptain?: boolean;
  isViceCaptain?: boolean;
  points?: number;
}

interface PitchViewProps {
  players: PitchPlayer[];
  formation?: string;
  width?: number;
  height?: number;
  highlightId?: string | null;
  onPlayerPress?: (player: PitchPlayer) => void;
  onEmptySlotPress?: (position: string) => void;
}

const FORMATIONS: Record<string, Record<string, number>> = {
  '4-4-2': { GK: 1, DEF: 4, MID: 4, FWD: 2 },
  '4-3-3': { GK: 1, DEF: 4, MID: 3, FWD: 3 },
  '3-4-3': { GK: 1, DEF: 3, MID: 4, FWD: 3 },
  '3-5-2': { GK: 1, DEF: 3, MID: 5, FWD: 2 },
  '4-5-1': { GK: 1, DEF: 4, MID: 5, FWD: 1 },
  '5-4-1': { GK: 1, DEF: 5, MID: 4, FWD: 1 },
  '5-3-2': { GK: 1, DEF: 5, MID: 3, FWD: 2 },
};

const POSITION_Y: Record<string, number> = {
  GK: 0.85,
  DEF: 0.65,
  MID: 0.42,
  FWD: 0.19,
};

const POSITION_COLOR: Record<string, string> = {
  GK: '#FFD700',
  DEF: '#4FC3F7',
  MID: '#81C784',
  FWD: '#EF9A9A',
};

const TOKEN_SIZE = 42;

function spreadX(count: number, index: number, width: number, padding = 28): number {
  if (count === 1) return width / 2;
  const step = (width - padding * 2) / (count - 1);
  return padding + index * step;
}

export function PitchView({
  players,
  formation = '4-4-2',
  width = 340,
  height = 460,
  highlightId,
  onPlayerPress,
  onEmptySlotPress,
}: PitchViewProps) {
  const formationMap = FORMATIONS[formation] ?? FORMATIONS['4-4-2'];

  const byPos: Record<string, PitchPlayer[]> = { GK: [], DEF: [], MID: [], FWD: [] };
  players.forEach((p) => {
    if (byPos[p.position]) byPos[p.position].push(p);
  });

  const posOrder: Array<'GK' | 'DEF' | 'MID' | 'FWD'> = ['FWD', 'MID', 'DEF', 'GK'];
  const slots: Array<{ position: string; player?: PitchPlayer; x: number; y: number }> = [];

  for (const pos of posOrder) {
    const count = formationMap[pos] ?? 0;
    const group = byPos[pos] ?? [];
    const baseY = POSITION_Y[pos] * height;

    for (let i = 0; i < count; i++) {
      slots.push({
        position: pos,
        player: group[i],
        x: spreadX(count, i, width),
        y: baseY,
      });
    }
  }

  return (
    <View style={[styles.container, { width, height }]}>
      {/* SVG pitch lines only */}
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="pitchGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#1A4A1A" />
            <Stop offset="0.5" stopColor="#1E3E1E" />
            <Stop offset="1" stopColor="#1A4A1A" />
          </LinearGradient>
        </Defs>
        <Rect width={width} height={height} fill="url(#pitchGrad)" rx={12} />
        {[0.25, 0.5, 0.75].map((pct) => (
          <Rect key={pct} x={0} y={pct * height - 2} width={width} height={height * 0.25} fill="#1B3F1B" opacity={0.3} />
        ))}
        <Rect x={16} y={16} width={width - 32} height={height - 32} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={1.5} rx={4} />
        <Line x1={16} y1={height / 2} x2={width - 16} y2={height / 2} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
        <Circle cx={width / 2} cy={height / 2} r={38} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
        <Circle cx={width / 2} cy={height / 2} r={3} fill="rgba(255,255,255,0.15)" />
        <Rect x={width / 2 - 60} y={16} width={120} height={40} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
        <Rect x={width / 2 - 30} y={16} width={60} height={18} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
        <Rect x={width / 2 - 60} y={height - 56} width={120} height={40} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
        <Rect x={width / 2 - 30} y={height - 34} width={60} height={18} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
      </Svg>

      {/* Native View tokens */}
      {slots.map((slot, idx) => {
        if (slot.player) {
          const isHighlighted = highlightId === slot.player.id;
          return (
            <PlayerToken
              key={slot.player.id}
              x={slot.x}
              y={slot.y}
              player={slot.player}
              highlighted={isHighlighted}
              onPress={onPlayerPress}
            />
          );
        }
        return (
          <EmptySlot
            key={`empty-${slot.position}-${idx}`}
            x={slot.x}
            y={slot.y}
            position={slot.position}
            onPress={onEmptySlotPress}
          />
        );
      })}
    </View>
  );
}

function PlayerToken({
  x,
  y,
  player,
  highlighted,
  onPress,
}: {
  x: number;
  y: number;
  player: PitchPlayer;
  highlighted?: boolean;
  onPress?: (player: PitchPlayer) => void;
}) {
  const color = POSITION_COLOR[player.position] ?? '#FFFFFF';
  const lastName = player.name.split(' ').pop()?.slice(0, 9) ?? '';

  return (
    <Pressable
      onPress={() => onPress?.(player)}
      style={[
        styles.tokenHit,
        {
          left: x - TOKEN_SIZE / 2 - 4,
          top: y - TOKEN_SIZE / 2 - 4,
          width: TOKEN_SIZE + 8,
        },
      ]}
    >
      {/* Outer ring for captain/VC/highlight */}
      <View
        style={[
          styles.tokenCircle,
          { backgroundColor: color },
          player.isCaptain && styles.captainRing,
          player.isViceCaptain && styles.vcRing,
          highlighted && styles.highlightRing,
        ]}
      >
        {/* Captain/VC badge */}
        {player.isCaptain && (
          <View style={[styles.badge, { backgroundColor: '#FFD700' }]}>
            <Text style={styles.badgeText}>C</Text>
          </View>
        )}
        {player.isViceCaptain && (
          <View style={[styles.badge, { backgroundColor: '#81C784' }]}>
            <Text style={styles.badgeText}>V</Text>
          </View>
        )}
      </View>

      {/* Name label */}
      <View style={styles.nameLabel}>
        <Text style={styles.nameText} numberOfLines={1}>{lastName}</Text>
      </View>
    </Pressable>
  );
}

function EmptySlot({
  x,
  y,
  position,
  onPress,
}: {
  x: number;
  y: number;
  position: string;
  onPress?: (position: string) => void;
}) {
  return (
    <Pressable
      onPress={() => onPress?.(position)}
      style={[
        styles.tokenHit,
        {
          left: x - TOKEN_SIZE / 2 - 4,
          top: y - TOKEN_SIZE / 2 - 4,
          width: TOKEN_SIZE + 8,
        },
      ]}
    >
      <View style={styles.emptyCircle}>
        <Text style={styles.emptyPlus}>+</Text>
      </View>
      <View style={styles.nameLabel}>
        <Text style={[styles.nameText, { color: 'rgba(255,255,255,0.4)' }]}>{position}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  tokenHit: {
    position: 'absolute',
    alignItems: 'center',
    paddingTop: 4,
  },
  tokenCircle: {
    width: TOKEN_SIZE,
    height: TOKEN_SIZE,
    borderRadius: TOKEN_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 4,
  },
  captainRing: {
    borderWidth: 3,
    borderColor: '#FFD700',
  },
  vcRing: {
    borderWidth: 2,
    borderColor: '#81C784',
    borderStyle: 'dashed',
  },
  highlightRing: {
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#FFD700',
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#0A0E1A',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#0A0E1A',
  },
  nameLabel: {
    backgroundColor: 'rgba(10,14,26,0.85)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 2,
    maxWidth: 70,
  },
  nameText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  emptyCircle: {
    width: TOKEN_SIZE,
    height: TOKEN_SIZE,
    borderRadius: TOKEN_SIZE / 2,
    backgroundColor: 'rgba(58,58,92,0.5)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyPlus: {
    fontSize: 20,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '300',
  },
});
