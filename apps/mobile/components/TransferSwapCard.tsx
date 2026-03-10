/**
 * TransferSwapCard — shows a single AI-suggested player swap.
 * Player out (red) → arrow → Player in (green) with reasoning text.
 */
import { StyleSheet, Text, View } from 'react-native';
import type { TransferSwap } from '@/types/ai';
import { Colors } from '@/theme/constants';

interface Props {
  swap: TransferSwap;
  index: number;
}

export default function TransferSwapCard({ swap, index }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Swap {index + 1}</Text>
      </View>

      <View style={styles.body}>
        {/* Player out */}
        <View style={[styles.playerBox, styles.outBox]}>
          <Text style={styles.outLabel}>OUT</Text>
          <Text style={styles.playerName} numberOfLines={1}>
            {swap.out_name || swap.out || '?'}
          </Text>
        </View>

        {/* Arrow */}
        <View style={styles.arrowBox}>
          <Text style={styles.arrow}>→</Text>
        </View>

        {/* Player in */}
        <View style={[styles.playerBox, styles.inBox]}>
          <Text style={styles.inLabel}>IN</Text>
          <Text style={styles.playerName} numberOfLines={1}>
            {swap.in_name || swap.in || '?'}
          </Text>
        </View>
      </View>

      {/* Reasoning */}
      <Text style={styles.reason} numberOfLines={3}>
        {swap.reason}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#141824',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2E3550',
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#1A1F30',
  },
  headerText: {
    color: '#8888AA',
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  playerBox: {
    flex: 1,
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  outBox: {
    backgroundColor: 'rgba(255, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 68, 68, 0.3)',
  },
  inBox: {
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.3)',
  },
  outLabel: {
    color: '#FF6666',
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  inLabel: {
    color: Colors.lime,
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  playerName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  arrowBox: {
    width: 28,
    alignItems: 'center',
  },
  arrow: {
    color: Colors.accent,
    fontSize: 20,
    fontWeight: 'bold',
  },
  reason: {
    color: '#AAAACC',
    fontSize: 12,
    lineHeight: 18,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
});
