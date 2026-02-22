/**
 * Matches tab — fixture calendar with live score cards.
 * Live scores auto-refresh every 30s when live matches exist.
 */
import { useCallback, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Link } from 'expo-router';
import { useMatchStore } from '@/store/matchStore';
import type { Match } from '@/types/api';

const STATUS_COLOR: Record<string, string> = {
  scheduled: '#555577',
  live: '#FF4444',
  finished: '#81C784',
  postponed: '#FF6B35',
};

const STATUS_LABEL: Record<string, string> = {
  scheduled: 'Upcoming',
  live: '● LIVE',
  finished: 'FT',
  postponed: 'PPD',
};

function MatchCard({ match }: { match: Match }) {
  const isLive = match.status === 'live';
  return (
    <Link href={`/(tabs)/matches/${match.id}`} asChild>
      <Pressable style={[styles.matchCard, isLive && styles.matchCardLive]}>
        <View style={styles.matchHeader}>
          <View style={[styles.statusBadge, { backgroundColor: STATUS_COLOR[match.status] + '33', borderColor: STATUS_COLOR[match.status] }]}>
            <Text style={[styles.statusText, { color: STATUS_COLOR[match.status] }]}>
              {STATUS_LABEL[match.status] ?? match.status}
            </Text>
          </View>
          <Text style={styles.kickoff}>
            {match.status === 'scheduled' ? new Date(match.kickoff_utc).toLocaleString() : ''}
          </Text>
        </View>
        <View style={styles.scoreRow}>
          <Text style={styles.teamName} numberOfLines={1}>Home</Text>
          <View style={styles.scoreBox}>
            <Text style={styles.score}>{match.home_score ?? '—'}</Text>
            <Text style={styles.scoreDash}> : </Text>
            <Text style={styles.score}>{match.away_score ?? '—'}</Text>
          </View>
          <Text style={[styles.teamName, { textAlign: 'right' }]} numberOfLines={1}>Away</Text>
        </View>
      </Pressable>
    </Link>
  );
}

export default function MatchesScreen() {
  const { matches, liveMatches, loading, fetchMatches, fetchLive } = useMatchStore();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    await fetchMatches();
    await fetchLive();
  }, [fetchMatches, fetchLive]);

  useEffect(() => {
    load();
    // Poll live scores every 30s if any live matches exist
    pollRef.current = setInterval(() => {
      fetchLive();
    }, 30_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [load, fetchLive]);

  const allMatches = matches.map((m) => {
    const live = liveMatches.find((l) => l.id === m.id);
    return live ?? m;
  });

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor="#FFD700" />}
      data={allMatches}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <MatchCard match={item} />}
      ListEmptyComponent={
        loading ? (
          <View style={styles.center}><ActivityIndicator color="#FFD700" size="large" /></View>
        ) : (
          <View style={styles.center}>
            <Text style={styles.emptyText}>No fixtures yet</Text>
          </View>
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  content: { padding: 16, gap: 8 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
  matchCard: { backgroundColor: '#141824', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#2E3550' },
  matchCardLive: { borderColor: '#FF4444' },
  matchHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  statusBadge: { borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  statusText: { fontSize: 11, fontWeight: 'bold' },
  kickoff: { marginLeft: 8, fontSize: 12, color: '#8888AA' },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  teamName: { flex: 1, fontSize: 14, color: '#FFFFFF', fontWeight: '600' },
  scoreBox: { flexDirection: 'row', alignItems: 'center' },
  score: { fontSize: 22, fontWeight: 'bold', color: '#FFD700', minWidth: 20, textAlign: 'center' },
  scoreDash: { fontSize: 22, color: '#555577' },
  emptyText: { color: '#555577', fontSize: 16 },
});
