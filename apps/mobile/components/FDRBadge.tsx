/**
 * FDRBadge — Fixture Difficulty Rating badge (1–5 scale).
 * 1 = easiest (dark green) → 5 = hardest (dark red)
 */
import { StyleSheet, Text, View } from 'react-native';

const FDR_COLORS: Record<number, { bg: string; text: string }> = {
  1: { bg: '#1B5E20', text: '#A5D6A7' },
  2: { bg: '#388E3C', text: '#E8F5E9' },
  3: { bg: '#F9A825', text: '#FFF8E1' },
  4: { bg: '#E64A19', text: '#FBE9E7' },
  5: { bg: '#B71C1C', text: '#FFCDD2' },
};

interface FDRBadgeProps {
  fdr: number;
  opponent?: string;
  size?: 'sm' | 'md';
}

export function FDRBadge({ fdr, opponent, size = 'md' }: FDRBadgeProps) {
  const clampedFdr = Math.max(1, Math.min(5, Math.round(fdr)));
  const colors = FDR_COLORS[clampedFdr];
  const isSmall = size === 'sm';

  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }, isSmall && styles.badgeSm]}>
      <Text style={[styles.fdrNum, { color: colors.text }, isSmall && styles.fdrNumSm]}>
        {clampedFdr}
      </Text>
      {opponent && !isSmall && (
        <Text style={[styles.opponent, { color: colors.text }]} numberOfLines={1}>
          {opponent}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 36,
  },
  badgeSm: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    minWidth: 24,
    borderRadius: 4,
  },
  fdrNum: { fontSize: 16, fontWeight: 'bold' },
  fdrNumSm: { fontSize: 12 },
  opponent: { fontSize: 11, marginTop: 2 },
});
