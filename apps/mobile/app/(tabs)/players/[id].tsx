/**
 * Player Detail screen — stats, price, form chart, FDR badges.
 */
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import api from '@/services/api';
import { FormChart } from '@/components/FormChart';
import { FDRBadge } from '@/components/FDRBadge';
import type { Player } from '@/types/api';

const POSITION_COLOR: Record<string, string> = {
  GK: '#FFD700', DEF: '#4FC3F7', MID: '#81C784', FWD: '#EF9A9A',
};

interface PlayerForm {
  last5Points: number[];
  upcomingFdr: number;
  totalPointsThisTournament: number;
}

export default function PlayerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [player, setPlayer] = useState<Player | null>(null);
  const [form, setForm] = useState<PlayerForm | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<Player>(`/players/${id}`),
      api.get<PlayerForm>(`/players/${id}/form`).catch(() => null),
    ])
      .then(([playerRes, formRes]) => {
        setPlayer(playerRes.data);
        if (formRes) setForm(formRes.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color="#FFD700" size="large" /></View>;
  }

  if (!player) {
    return <View style={styles.center}><Text style={styles.errorText}>Player not found</Text></View>;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Player header */}
      <View style={styles.header}>
        <View style={[styles.posBadge, { backgroundColor: POSITION_COLOR[player.position] ?? '#555577' }]}>
          <Text style={styles.posText}>{player.position}</Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.name}>{player.name}</Text>
          <Text style={styles.price}>£{Number(player.price).toFixed(1)}m</Text>
        </View>
        {form && (
          <View style={styles.totalPts}>
            <Text style={styles.totalPtsNum}>{form.totalPointsThisTournament}</Text>
            <Text style={styles.totalPtsLabel}>pts</Text>
          </View>
        )}
      </View>

      {/* Form chart */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Recent Form (last 5 games)</Text>
        <FormChart points={form?.last5Points ?? []} label="Gameweek points" />
      </View>

      {/* FDR */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Upcoming Fixture Difficulty</Text>
        <View style={styles.fdrRow}>
          {form ? (
            <FDRBadge fdr={form.upcomingFdr} size="md" />
          ) : (
            <Text style={styles.placeholder}>No fixture data available yet</Text>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  content: { padding: 24, gap: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0A0E1A' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  posBadge: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center' },
  posText: { fontSize: 14, fontWeight: 'bold', color: '#0A0E1A' },
  headerInfo: { flex: 1 },
  name: { fontSize: 22, fontWeight: 'bold', color: '#FFFFFF' },
  price: { fontSize: 16, color: '#FFD700', marginTop: 4 },
  totalPts: { alignItems: 'center', backgroundColor: '#141824', borderRadius: 10, padding: 10 },
  totalPtsNum: { fontSize: 24, fontWeight: 'bold', color: '#FFD700' },
  totalPtsLabel: { fontSize: 11, color: '#8888AA' },
  card: { backgroundColor: '#141824', borderRadius: 12, padding: 16, gap: 12 },
  sectionTitle: { fontSize: 13, fontWeight: 'bold', color: '#8888AA', textTransform: 'uppercase', letterSpacing: 1 },
  fdrRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  placeholder: { color: '#555577', fontSize: 13 },
  errorText: { color: '#FF6B6B', fontSize: 16 },
});
