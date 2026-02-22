/**
 * My Squad tab — shows squad overview with player list and key actions.
 * Tapping a player shows captain/VC assignment; links to Edit, Lineup, Transfers.
 */
import { useCallback, useEffect } from 'react';
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
import { useSquadStore } from '@/store/squadStore';

// Will come from league selection in onboarding — hardcoded for MVP
const DEFAULT_LEAGUE_ID = 'default';

const POSITION_COLOR: Record<string, string> = {
  GK: '#FFD700',
  DEF: '#4FC3F7',
  MID: '#81C784',
  FWD: '#EF9A9A',
};

export default function SquadScreen() {
  const { squad, players, currentRound, loading, error, fetchSquad, fetchCurrentRound } =
    useSquadStore();

  const load = useCallback(async () => {
    await Promise.all([fetchSquad(DEFAULT_LEAGUE_ID), fetchCurrentRound()]);
  }, [fetchSquad, fetchCurrentRound]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !squad) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#FFD700" size="large" />
      </View>
    );
  }

  if (error && !squad) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.retryBtn} onPress={load}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const enriched = squad?.players.map((sp) => ({
    ...sp,
    player: players.find((p) => p.id === sp.player_id),
  })) ?? [];

  const starters = enriched.filter((sp) => sp.is_starting);
  const bench = enriched.filter((sp) => !sp.is_starting);

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor="#FFD700" />}
      ListHeaderComponent={
        <>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Budget</Text>
              <Text style={styles.statValue}>£{squad?.budget_remaining?.toFixed(1) ?? '—'}m</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Free Transfers</Text>
              <Text style={styles.statValue}>{squad?.free_transfers_remaining ?? 1}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Round</Text>
              <Text style={styles.statValue} numberOfLines={1}>
                {currentRound?.name ?? '—'}
              </Text>
            </View>
          </View>

          {currentRound?.deadline_utc && (
            <View style={styles.deadlineBanner}>
              <Text style={styles.deadlineText}>
                Deadline: {new Date(currentRound.deadline_utc).toLocaleString()}
              </Text>
            </View>
          )}

          <View style={styles.actionRow}>
            <Link href="/(tabs)/squad/lineup" asChild>
              <Pressable style={styles.actionBtn}>
                <Text style={styles.actionText}>Lineup</Text>
              </Pressable>
            </Link>
            <Link href="/(tabs)/squad/transfers" asChild>
              <Pressable style={[styles.actionBtn, styles.actionBtnPrimary]}>
                <Text style={[styles.actionText, styles.actionTextPrimary]}>Transfers</Text>
              </Pressable>
            </Link>
            <Link href="/(tabs)/squad/edit" asChild>
              <Pressable style={styles.actionBtn}>
                <Text style={styles.actionText}>Edit Squad</Text>
              </Pressable>
            </Link>
          </View>

          <Text style={styles.sectionTitle}>Starting XI</Text>
        </>
      }
      data={starters}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <View style={styles.playerCard}>
          <View style={[styles.posBadge, { backgroundColor: POSITION_COLOR[item.player?.position ?? 'MID'] ?? '#555577' }]}>
            <Text style={styles.posText}>{item.player?.position ?? '?'}</Text>
          </View>
          <View style={styles.playerInfo}>
            <Text style={styles.playerName}>
              {item.player?.name ?? item.player_id}
              {item.is_captain ? ' ©' : item.is_vice_captain ? ' (V)' : ''}
            </Text>
            <Text style={styles.playerSub}>£{item.player?.price?.toFixed(1) ?? '?'}m</Text>
          </View>
          {item.is_captain && (
            <View style={styles.captainBadge}>
              <Text style={styles.captainText}>AI Pick</Text>
            </View>
          )}
        </View>
      )}
      ListFooterComponent={
        bench.length > 0 ? (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Bench</Text>
            {bench.map((item) => (
              <View key={item.id} style={[styles.playerCard, { opacity: 0.7 }]}>
                <View style={[styles.posBadge, { backgroundColor: '#444466' }]}>
                  <Text style={styles.posText}>{item.player?.position ?? '?'}</Text>
                </View>
                <View style={styles.playerInfo}>
                  <Text style={[styles.playerName, { color: '#AAAACC' }]}>
                    {item.player?.name ?? item.player_id}
                  </Text>
                  <Text style={styles.playerSub}>£{item.player?.price?.toFixed(1) ?? '?'}m</Text>
                </View>
              </View>
            ))}
          </>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  content: { padding: 16 },
  center: { flex: 1, backgroundColor: '#0A0E1A', justifyContent: 'center', alignItems: 'center' },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statCard: { flex: 1, backgroundColor: '#141824', borderRadius: 10, padding: 12, alignItems: 'center' },
  statLabel: { fontSize: 11, color: '#8888AA', marginBottom: 4 },
  statValue: { fontSize: 15, fontWeight: 'bold', color: '#FFD700' },
  deadlineBanner: { backgroundColor: '#1E2333', borderRadius: 8, padding: 10, marginBottom: 12, borderLeftWidth: 3, borderLeftColor: '#FF6B35' },
  deadlineText: { color: '#AAAACC', fontSize: 13 },
  actionRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  actionBtn: { flex: 1, borderRadius: 8, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#2E3550' },
  actionBtnPrimary: { backgroundColor: '#FFD700', borderColor: '#FFD700' },
  actionText: { color: '#AAAACC', fontSize: 13, fontWeight: '600' },
  actionTextPrimary: { color: '#0A0E1A' },
  sectionTitle: { fontSize: 13, fontWeight: 'bold', color: '#8888AA', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  playerCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#141824', borderRadius: 10, padding: 12, marginBottom: 6 },
  posBadge: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  posText: { fontSize: 11, fontWeight: 'bold', color: '#0A0E1A' },
  playerInfo: { flex: 1 },
  playerName: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  playerSub: { fontSize: 12, color: '#8888AA', marginTop: 2 },
  captainBadge: { backgroundColor: '#1A2A4A', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: '#FFD700' },
  captainText: { color: '#FFD700', fontSize: 11, fontWeight: 'bold' },
  errorText: { color: '#FF6B6B', fontSize: 16, marginBottom: 16, textAlign: 'center', padding: 16 },
  retryBtn: { backgroundColor: '#1E2333', borderRadius: 8, padding: 12 },
  retryText: { color: '#FFD700', fontWeight: '600' },
});
