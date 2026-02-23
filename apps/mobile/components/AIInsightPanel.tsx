/**
 * AIInsightPanel — compact player recommendation card with AI score and reasoning.
 * Used in squad/transfer screens to surface AI-suggested picks.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface AIInsightPanelProps {
  playerName: string;
  position: string;
  price: number;
  aiScore: number;        // 0–100
  reasoning: string;
  onViewPlayer?: () => void;
}

const POSITION_COLOR: Record<string, string> = {
  GK: '#FFD700', DEF: '#4FC3F7', MID: '#81C784', FWD: '#EF9A9A',
};

function ScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? '#81C784' : score >= 40 ? '#FFD700' : '#EF9A9A';
  return (
    <View style={styles.scoreBarBg}>
      <View style={[styles.scoreBarFill, { width: `${score}%`, backgroundColor: color }]} />
    </View>
  );
}

export function AIInsightPanel({
  playerName,
  position,
  price,
  aiScore,
  reasoning,
  onViewPlayer,
}: AIInsightPanelProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.posBadge, { backgroundColor: POSITION_COLOR[position] ?? '#555577' }]}>
          <Text style={styles.posText}>{position}</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.name}>{playerName}</Text>
          <Text style={styles.price}>£{price.toFixed(1)}m</Text>
        </View>
        <View style={styles.scoreBox}>
          <Text style={styles.scoreLabel}>AI</Text>
          <Text style={styles.scoreValue}>{aiScore}</Text>
        </View>
      </View>

      <ScoreBar score={aiScore} />

      <Text style={styles.reasoning} numberOfLines={2}>{reasoning}</Text>

      {onViewPlayer && (
        <Pressable style={styles.viewBtn} onPress={onViewPlayer}>
          <Text style={styles.viewBtnText}>View Player →</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#141824',
    borderRadius: 12,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: '#1E2A4A',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  posBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  posText: { fontSize: 11, fontWeight: 'bold', color: '#0A0E1A' },
  headerRight: { flex: 1 },
  name: { fontSize: 15, fontWeight: 'bold', color: '#FFFFFF' },
  price: { fontSize: 12, color: '#8888AA' },
  scoreBox: {
    alignItems: 'center',
    backgroundColor: '#1E2A4A',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  scoreLabel: { fontSize: 9, color: '#8888AA', textTransform: 'uppercase' },
  scoreValue: { fontSize: 18, fontWeight: 'bold', color: '#FFD700' },
  scoreBarBg: { height: 4, backgroundColor: '#2E3550', borderRadius: 2 },
  scoreBarFill: { height: 4, borderRadius: 2 },
  reasoning: { fontSize: 12, color: '#AAAACC', lineHeight: 17 },
  viewBtn: { alignSelf: 'flex-start' },
  viewBtnText: { color: '#FFD700', fontSize: 13, fontWeight: '600' },
});
