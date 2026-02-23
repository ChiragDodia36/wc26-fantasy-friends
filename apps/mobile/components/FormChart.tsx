/**
 * FormChart — a compact sparkline showing last-N gameweek points.
 * Uses victory-native ^36 (Line chart, React 18 compatible).
 * Falls back to a simple bar visualization if victory is unavailable.
 */
import { StyleSheet, Text, View } from 'react-native';

interface FormChartProps {
  points: number[];
  label?: string;
}

const BAR_MAX_HEIGHT = 32;
const MAX_POINTS = 20; // for bar scaling

export function FormChart({ points, label }: FormChartProps) {
  if (!points || points.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No form data</Text>
      </View>
    );
  }

  const maxP = Math.max(...points, 1);

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.bars}>
        {points.map((p, i) => {
          const height = Math.max(4, (p / maxP) * BAR_MAX_HEIGHT);
          const color = p >= 8 ? '#81C784' : p >= 4 ? '#FFD700' : '#EF9A9A';
          return (
            <View key={i} style={styles.barCol}>
              <Text style={styles.barPts}>{p}</Text>
              <View style={[styles.bar, { height, backgroundColor: color }]} />
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 4 },
  label: { fontSize: 11, color: '#8888AA', textTransform: 'uppercase', letterSpacing: 1 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: BAR_MAX_HEIGHT + 20 },
  barCol: { alignItems: 'center', gap: 2 },
  bar: { width: 20, borderRadius: 3, minHeight: 4 },
  barPts: { fontSize: 10, color: '#AAAACC' },
  empty: { height: 52, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#555577', fontSize: 12 },
});
