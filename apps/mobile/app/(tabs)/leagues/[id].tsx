/**
 * League Detail screen — standings table + invite code sharing.
 */
import { useEffect } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useLeagueStore } from '@/store/leagueStore';

export default function LeagueDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { leagues, standings, fetchLeagues, fetchStandings } = useLeagueStore();

  const league = leagues.find((l) => l.id === id);
  const leagueStandings = standings[id] ?? [];

  useEffect(() => {
    if (!league) fetchLeagues();
    fetchStandings(id);
  }, [id]);

  const handleShare = () => {
    Share.share({
      message: `Join my WC26 Fantasy Friends league "${league?.name}"! Use code: ${league?.code}`,
      title: 'WC26 Fantasy Friends Invite',
    });
  };

  if (!league) {
    return <View style={styles.center}><ActivityIndicator color="#FFD700" size="large" /></View>;
  }

  return (
    <View style={styles.container}>
      {/* Invite code card */}
      <View style={styles.inviteCard}>
        <View>
          <Text style={styles.inviteLabel}>Invite Code</Text>
          <Text style={styles.inviteCode}>{league.code}</Text>
        </View>
        <Pressable style={styles.shareBtn} onPress={handleShare}>
          <Text style={styles.shareText}>Share</Text>
        </Pressable>
      </View>

      {/* Standings */}
      <Text style={styles.sectionTitle}>Standings</Text>
      {leagueStandings.length === 0 ? (
        <Text style={styles.emptyText}>No standings yet — season hasn't started</Text>
      ) : (
        <FlatList
          data={leagueStandings}
          keyExtractor={(item) => item.squad_id}
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => (
            <View style={styles.standingRow}>
              <Text style={[styles.rank, index < 3 && styles.rankTop]}>{item.rank}</Text>
              <Text style={styles.username}>{item.username}</Text>
              <Text style={styles.points}>{item.total_points} pts</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0A0E1A' },
  inviteCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#141824', margin: 16, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#FFD700' },
  inviteLabel: { fontSize: 12, color: '#8888AA', marginBottom: 4 },
  inviteCode: { fontSize: 28, fontWeight: 'bold', color: '#FFD700', letterSpacing: 4 },
  shareBtn: { marginLeft: 'auto', backgroundColor: '#FFD700', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  shareText: { color: '#0A0E1A', fontWeight: 'bold', fontSize: 14 },
  sectionTitle: { fontSize: 13, fontWeight: 'bold', color: '#8888AA', paddingHorizontal: 16, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  emptyText: { color: '#555577', fontSize: 14, padding: 24, textAlign: 'center' },
  list: { padding: 16, gap: 6 },
  standingRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#141824', borderRadius: 10, padding: 14 },
  rank: { width: 32, fontSize: 16, fontWeight: 'bold', color: '#8888AA' },
  rankTop: { color: '#FFD700' },
  username: { flex: 1, fontSize: 15, color: '#FFFFFF', fontWeight: '600' },
  points: { fontSize: 15, fontWeight: 'bold', color: '#FFD700' },
});
