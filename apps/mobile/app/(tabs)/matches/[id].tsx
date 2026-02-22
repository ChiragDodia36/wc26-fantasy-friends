/**
 * Match Detail screen — shows score, status, and player stats.
 */
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import api from '@/services/api';
import type { Match } from '@/types/api';

export default function MatchDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Match>(`/matches/${id}`)
      .then((res) => setMatch(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color="#FFD700" size="large" /></View>;
  }

  if (!match) {
    return <View style={styles.center}><Text style={styles.errorText}>Match not found</Text></View>;
  }

  const statusColor = match.status === 'live' ? '#FF4444' : match.status === 'finished' ? '#81C784' : '#555577';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={[styles.statusBadge, { borderColor: statusColor }]}>
        <Text style={[styles.statusText, { color: statusColor }]}>
          {match.status.toUpperCase()}
        </Text>
      </View>

      <View style={styles.scoreCard}>
        <Text style={styles.teamName}>Home Team</Text>
        <Text style={styles.scoreLine}>
          {match.home_score ?? '—'} : {match.away_score ?? '—'}
        </Text>
        <Text style={styles.teamName}>Away Team</Text>
      </View>

      <Text style={styles.kickoff}>
        {new Date(match.kickoff_utc).toLocaleString()}
      </Text>

      <Text style={styles.placeholder}>Player stats will appear here after match completion.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  content: { padding: 24, alignItems: 'center', gap: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0A0E1A' },
  statusBadge: { borderRadius: 6, paddingHorizontal: 16, paddingVertical: 6, borderWidth: 1 },
  statusText: { fontSize: 13, fontWeight: 'bold', letterSpacing: 1 },
  scoreCard: { backgroundColor: '#141824', borderRadius: 16, padding: 24, alignItems: 'center', width: '100%', gap: 12 },
  teamName: { fontSize: 16, color: '#FFFFFF', fontWeight: '600' },
  scoreLine: { fontSize: 48, fontWeight: 'bold', color: '#FFD700' },
  kickoff: { fontSize: 13, color: '#8888AA' },
  placeholder: { color: '#555577', fontSize: 14, textAlign: 'center', marginTop: 16 },
  errorText: { color: '#FF6B6B', fontSize: 16 },
});
