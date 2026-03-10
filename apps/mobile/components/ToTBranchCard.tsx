/**
 * ToTBranchCard — expandable Tree of Thought reasoning card.
 * Shows branch strategy (Safe / Differential / Fixture), confidence, and reasoning.
 * "Apply" button pre-fills squad/transfer actions.
 */
import { useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ToTBranchCard as ToTBranchData } from '@/types/ai';
import { Colors } from '@/theme/constants';

const BRANCH_COLORS: Record<string, { border: string; icon: string; label: string }> = {
  safe: { border: Colors.posDEF, icon: '🛡️', label: 'Safe & Consistent' },
  differential: { border: '#CE93D8', icon: '🎯', label: 'Differential Pick' },
  fixture: { border: Colors.lime, icon: '📅', label: 'Fixture-Based' },
};

interface ToTBranchCardProps {
  data: ToTBranchData;
  isSelected?: boolean;
  onApply?: (data: ToTBranchData) => void;
}

export function ToTBranchCard({ data, isSelected, onApply }: ToTBranchCardProps) {
  const [expanded, setExpanded] = useState(isSelected);
  const config = BRANCH_COLORS[data.branch] ?? BRANCH_COLORS.safe;
  const confidenceColor =
    data.confidencePct >= 70 ? Colors.lime : data.confidencePct >= 40 ? Colors.gold : Colors.pink;

  return (
    <Pressable
      style={[styles.card, { borderColor: config.border }, isSelected && styles.cardSelected]}
      onPress={() => setExpanded((e) => !e)}
    >
      {/* Header row */}
      <View style={styles.header}>
        <Text style={styles.icon}>{config.icon}</Text>
        <View style={styles.headerText}>
          <Text style={[styles.branch, { color: config.border }]}>{config.label}</Text>
          <Text style={styles.title}>{data.title}</Text>
        </View>
        <View style={styles.confidenceBox}>
          <Text style={[styles.confidenceNum, { color: confidenceColor }]}>
            {data.confidencePct}%
          </Text>
          <Text style={styles.confidenceLabel}>confidence</Text>
        </View>
        <Text style={styles.chevron}>{expanded ? '▲' : '▼'}</Text>
      </View>

      {/* Confidence bar */}
      <View style={styles.barBg}>
        <View
          style={[
            styles.barFill,
            { width: `${data.confidencePct}%`, backgroundColor: confidenceColor },
          ]}
        />
      </View>

      {/* Expandable reasoning */}
      {expanded && (
        <View style={styles.body}>
          <Text style={styles.reasoningTitle}>Reasoning</Text>
          <Text style={styles.reasoning}>{data.reasoning}</Text>

          {data.recommendedPlayerIds.length > 0 && (
            <>
              <Text style={styles.reasoningTitle}>Key Picks ({data.recommendedPlayerIds.length})</Text>
              <Text style={styles.playerIds} numberOfLines={2}>
                {data.recommendedPlayerIds.slice(0, 5).join(', ')}
                {data.recommendedPlayerIds.length > 5 ? ` +${data.recommendedPlayerIds.length - 5} more` : ''}
              </Text>
            </>
          )}

          {onApply && (
            <Pressable style={styles.applyBtn} onPress={() => onApply(data)}>
              <Text style={styles.applyText}>Apply This Plan</Text>
            </Pressable>
          )}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#141824',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2E3550',
    padding: 14,
    gap: 10,
  },
  cardSelected: { backgroundColor: '#1A2038' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { fontSize: 24 },
  headerText: { flex: 1 },
  branch: { fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },
  title: { fontSize: 15, fontWeight: 'bold', color: '#FFFFFF', marginTop: 2 },
  confidenceBox: { alignItems: 'center' },
  confidenceNum: { fontSize: 20, fontWeight: 'bold' },
  confidenceLabel: { fontSize: 9, color: '#8888AA', textTransform: 'uppercase' },
  chevron: { color: '#555577', fontSize: 14, marginLeft: 4 },
  barBg: { height: 3, backgroundColor: '#2E3550', borderRadius: 2 },
  barFill: { height: 3, borderRadius: 2 },
  body: { gap: 10, paddingTop: 4 },
  reasoningTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#8888AA',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  reasoning: { fontSize: 14, color: '#CCCCDD', lineHeight: 20 },
  playerIds: { fontSize: 12, color: '#8888AA', fontStyle: 'italic' },
  applyBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  applyText: { color: Colors.bg, fontWeight: 'bold', fontSize: 15 },
});
