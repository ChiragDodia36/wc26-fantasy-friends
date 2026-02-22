/**
 * Transfers screen — search for players to swap in/out.
 * Shows free transfer count, wildcard chip button, -4pt penalty warning.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
} from 'react-native';
import { useSquadStore } from '@/store/squadStore';
import type { Player } from '@/types/api';

const DEFAULT_LEAGUE_ID = 'default';

export default function TransfersScreen() {
  const { squad, players, loading, error, fetchSquad, activateWildcard, makeTransfer } =
    useSquadStore();
  const [search, setSearch] = useState('');
  const [playerOut, setPlayerOut] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchSquad(DEFAULT_LEAGUE_ID);
  }, []);

  const squadPlayerIds = new Set(squad?.players.map((sp) => sp.player_id) ?? []);
  const freeTransfers = squad?.free_transfers_remaining ?? 1;
  const wildcardUsed = squad?.wildcard_used ?? false;

  const filteredPlayers = players.filter(
    (p) =>
      !squadPlayerIds.has(p.id) &&
      p.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleTransfer = useCallback(
    async (playerInId: string) => {
      if (!playerOut) {
        Alert.alert('Select player to remove', 'Tap a squad player first to swap out.');
        return;
      }
      const penalty = freeTransfers <= 0 ? ' (-4 pts penalty)' : '';
      Alert.alert(
        'Confirm Transfer',
        `Swap out selected player for ${players.find((p) => p.id === playerInId)?.name}?${penalty}`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Confirm',
            style: 'destructive',
            onPress: async () => {
              setProcessing(true);
              try {
                await makeTransfer(playerOut, playerInId);
                setPlayerOut(null);
                Alert.alert('Transfer complete', 'Your squad has been updated.');
              } catch (err: any) {
                Alert.alert('Transfer failed', err?.response?.data?.detail ?? 'Try again');
              } finally {
                setProcessing(false);
              }
            },
          },
        ]
      );
    },
    [playerOut, freeTransfers, players, makeTransfer]
  );

  const handleWildcard = () => {
    Alert.alert(
      'Activate Wildcard',
      'This allows unlimited free transfers this round. You can only use it once per season.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Activate',
          onPress: async () => {
            try {
              await activateWildcard();
              Alert.alert('Wildcard activated!', 'Make as many transfers as you want this round.');
            } catch (err: any) {
              Alert.alert('Error', err?.response?.data?.detail ?? 'Failed');
            }
          },
        },
      ]
    );
  };

  if (loading && !squad) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#FFD700" size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Transfer info bar */}
      <View style={styles.infoBar}>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Free Transfers</Text>
          <Text style={[styles.infoValue, freeTransfers <= 0 && styles.infoRed]}>
            {freeTransfers}
          </Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Budget</Text>
          <Text style={styles.infoValue}>£{squad?.budget_remaining?.toFixed(1) ?? '?'}m</Text>
        </View>
        {!wildcardUsed && (
          <Pressable style={styles.wildcardBtn} onPress={handleWildcard}>
            <Text style={styles.wildcardText}>Use Wildcard</Text>
          </Pressable>
        )}
      </View>

      {freeTransfers <= 0 && (
        <View style={styles.penaltyBanner}>
          <Text style={styles.penaltyText}>⚠️ Extra transfers cost -4 pts each</Text>
        </View>
      )}

      {/* Step 1: select player to remove */}
      <Text style={styles.sectionTitle}>1. Select player to remove</Text>
      <FlatList
        horizontal
        data={squad?.players.filter((sp) => sp.is_starting)}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        style={{ maxHeight: 60, marginBottom: 12 }}
        renderItem={({ item }) => {
          const p = players.find((pl) => pl.id === item.player_id);
          const selected = item.player_id === playerOut;
          return (
            <Pressable
              style={[styles.miniCard, selected && styles.miniCardSelected]}
              onPress={() => setPlayerOut(selected ? null : item.player_id)}
            >
              <Text style={[styles.miniText, selected && { color: '#0A0E1A' }]}>
                {p?.name.split(' ').pop() ?? item.player_id.slice(0, 6)}
              </Text>
            </Pressable>
          );
        }}
      />

      {/* Step 2: search replacement */}
      <Text style={styles.sectionTitle}>2. Select replacement</Text>
      <TextInput
        style={styles.searchInput}
        placeholder="Search players..."
        placeholderTextColor="#8888AA"
        value={search}
        onChangeText={setSearch}
      />

      <FlatList
        data={filteredPlayers.slice(0, 50)}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 6 }}
        renderItem={({ item }) => (
          <Pressable style={styles.playerRow} onPress={() => handleTransfer(item.id)} disabled={processing}>
            <View>
              <Text style={styles.playerName}>{item.name}</Text>
              <Text style={styles.playerSub}>{item.position} · £{Number(item.price).toFixed(1)}m</Text>
            </View>
            <View style={styles.addBtn}>
              <Text style={styles.addBtnText}>+</Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  center: { flex: 1, backgroundColor: '#0A0E1A', justifyContent: 'center', alignItems: 'center' },
  infoBar: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, backgroundColor: '#141824' },
  infoItem: { alignItems: 'center', marginRight: 8 },
  infoLabel: { fontSize: 11, color: '#8888AA' },
  infoValue: { fontSize: 18, fontWeight: 'bold', color: '#FFD700' },
  infoRed: { color: '#FF4444' },
  wildcardBtn: { marginLeft: 'auto', backgroundColor: '#2E1A3A', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#9C27B0' },
  wildcardText: { color: '#CE93D8', fontSize: 13, fontWeight: 'bold' },
  penaltyBanner: { backgroundColor: '#2A1A1A', borderLeftWidth: 3, borderLeftColor: '#FF4444', padding: 10, marginHorizontal: 16, marginBottom: 8, borderRadius: 6 },
  penaltyText: { color: '#FF9999', fontSize: 13 },
  sectionTitle: { fontSize: 12, fontWeight: 'bold', color: '#8888AA', paddingHorizontal: 16, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 },
  miniCard: { backgroundColor: '#1E2333', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#2E3550' },
  miniCardSelected: { backgroundColor: '#FFD700', borderColor: '#FFD700' },
  miniText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  searchInput: { backgroundColor: '#1E2333', borderRadius: 10, padding: 12, fontSize: 15, color: '#FFFFFF', borderWidth: 1, borderColor: '#2E3550', marginHorizontal: 16, marginBottom: 8 },
  playerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#141824', borderRadius: 10, padding: 12 },
  playerName: { fontSize: 15, color: '#FFFFFF', fontWeight: '600' },
  playerSub: { fontSize: 12, color: '#8888AA', marginTop: 2 },
  addBtn: { backgroundColor: '#FFD700', width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  addBtnText: { color: '#0A0E1A', fontSize: 20, fontWeight: 'bold', lineHeight: 24 },
});
