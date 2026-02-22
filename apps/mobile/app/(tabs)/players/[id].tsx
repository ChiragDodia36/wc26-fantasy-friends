/**
 * Player Detail screen — stats, price, form (placeholder for form chart).
 */
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import api from '@/services/api';
import type { Player } from '@/types/api';

const POSITION_COLOR: Record<string, string> = {
  GK: '#FFD700', DEF: '#4FC3F7', MID: '#81C784', FWD: '#EF9A9A',
};

export default function PlayerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Player>(`/players/${id}`)
      .then((res) => setPlayer(res.data))
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
        <View>
          <Text style={styles.name}>{player.name}</Text>
          <Text style={styles.price}>£{Number(player.price).toFixed(1)}m</Text>
        </View>
      </View>

      {/* Form chart placeholder */}
      <View style={styles.formCard}>
        <Text style={styles.sectionTitle}>Recent Form</Text>
        <Text style={styles.placeholder}>Form chart coming in Step 7 (shared components)</Text>
      </View>

      {/* FDR placeholder */}
      <View style={styles.formCard}>
        <Text style={styles.sectionTitle}>Upcoming Fixtures</Text>
        <Text style={styles.placeholder}>Fixture difficulty badges coming in Step 7</Text>
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
  name: { fontSize: 22, fontWeight: 'bold', color: '#FFFFFF' },
  price: { fontSize: 16, color: '#FFD700', marginTop: 4 },
  formCard: { backgroundColor: '#141824', borderRadius: 12, padding: 16 },
  sectionTitle: { fontSize: 13, fontWeight: 'bold', color: '#8888AA', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 },
  placeholder: { color: '#555577', fontSize: 13 },
  errorText: { color: '#FF6B6B', fontSize: 16 },
});
