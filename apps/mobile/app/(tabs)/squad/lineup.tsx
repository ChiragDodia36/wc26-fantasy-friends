/**
 * Lineup screen — tap players to set captain (C) and vice-captain (VC).
 * Captain earns 2× points, vice-captain earns 1.5×.
 */
import { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
} from 'react-native';
import api from '@/services/api';
import { useSquadStore } from '@/store/squadStore';

const DEFAULT_LEAGUE_ID = 'default';

export default function LineupScreen() {
  const { squad, players, loading, fetchSquad } = useSquadStore();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSquad(DEFAULT_LEAGUE_ID);
  }, []);

  if (loading && !squad) {
    return <View style={styles.center}><ActivityIndicator color="#FFD700" size="large" /></View>;
  }

  const starters = squad?.players
    .filter((sp) => sp.is_starting)
    .map((sp) => ({ ...sp, player: players.find((p) => p.id === sp.player_id) })) ?? [];

  const captain = squad?.players.find((sp) => sp.is_captain)?.player_id;
  const viceCaptain = squad?.players.find((sp) => sp.is_vice_captain)?.player_id;

  const handleSetRole = (playerId: string) => {
    Alert.alert(
      'Set Role',
      `Set role for ${players.find((p) => p.id === playerId)?.name}:`,
      [
        {
          text: 'Captain (2× pts)',
          onPress: () => updateCaptaincy(playerId, null),
        },
        {
          text: 'Vice-Captain (1.5× pts)',
          onPress: () => updateCaptaincy(captain ?? null, playerId),
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const updateCaptaincy = async (captainId: string | null, vcId: string | null) => {
    if (!squad) return;
    setSaving(true);
    try {
      const updatedPlayers = squad.players.map((sp) => ({
        player_id: sp.player_id,
        is_starting: sp.is_starting,
        bench_order: sp.bench_order,
        is_captain: sp.player_id === captainId,
        is_vice_captain: sp.player_id === vcId,
      }));
      await api.put(`/squads/${squad.id}/lineup`, { players: updatedPlayers });
      await fetchSquad(DEFAULT_LEAGUE_ID);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.detail ?? 'Failed to update lineup');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.subtitle}>Tap a player to set Captain or Vice-Captain</Text>

      {saving && (
        <View style={styles.savingBar}>
          <ActivityIndicator color="#FFD700" size="small" />
          <Text style={styles.savingText}>Saving...</Text>
        </View>
      )}

      <FlatList
        data={starters}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const isCaptain = item.player_id === captain;
          const isVC = item.player_id === viceCaptain;
          return (
            <Pressable
              style={[
                styles.playerCard,
                isCaptain && styles.captainCard,
                isVC && styles.vcCard,
              ]}
              onPress={() => handleSetRole(item.player_id)}
            >
              <View style={styles.playerLeft}>
                <Text style={styles.posText}>{item.player?.position ?? '?'}</Text>
                <Text style={styles.playerName}>{item.player?.name ?? item.player_id}</Text>
              </View>
              {isCaptain && <Text style={styles.roleLabel}>© Captain</Text>}
              {isVC && <Text style={[styles.roleLabel, styles.vcLabel]}>(V) Vice</Text>}
              {!isCaptain && !isVC && <Text style={styles.tapHint}>Tap to assign</Text>}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  center: { flex: 1, backgroundColor: '#0A0E1A', justifyContent: 'center', alignItems: 'center' },
  subtitle: { fontSize: 13, color: '#8888AA', padding: 16, textAlign: 'center' },
  savingBar: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', paddingVertical: 8 },
  savingText: { color: '#FFD700', fontSize: 13 },
  list: { padding: 16, gap: 8 },
  playerCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#141824', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#2E3550' },
  captainCard: { borderColor: '#FFD700', backgroundColor: '#1A2A3A' },
  vcCard: { borderColor: '#81C784', backgroundColor: '#1A2A1A' },
  playerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  posText: { fontSize: 12, color: '#8888AA', width: 30 },
  playerName: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  roleLabel: { color: '#FFD700', fontSize: 13, fontWeight: 'bold' },
  vcLabel: { color: '#81C784' },
  tapHint: { color: '#555577', fontSize: 12 },
});
