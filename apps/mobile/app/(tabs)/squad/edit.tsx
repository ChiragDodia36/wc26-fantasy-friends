/**
 * Edit Squad screen — pick 15 players within budget.
 * Enforces position limits: 2 GK / 5 DEF / 5 MID / 3 FWD, max 2 per team.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
} from 'react-native';
import api from '@/services/api';
import { useSquadStore } from '@/store/squadStore';
import type { Player } from '@/types/api';

const DEFAULT_LEAGUE_ID = 'default';
const BUDGET = 100;
const LIMITS = { GK: 2, DEF: 5, MID: 5, FWD: 3 };

export default function EditSquadScreen() {
  const { players, loading, fetchSquad } = useSquadStore();
  const [selected, setSelected] = useState<Player[]>([]);
  const [search, setSearch] = useState('');
  const [posFilter, setPosFilter] = useState<string>('ALL');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSquad(DEFAULT_LEAGUE_ID);
  }, []);

  const spent = selected.reduce((sum, p) => sum + Number(p.price), 0);
  const remaining = BUDGET - spent;

  const posCounts = selected.reduce(
    (acc, p) => ({ ...acc, [p.position]: (acc[p.position] ?? 0) + 1 }),
    {} as Record<string, number>
  );

  const canAdd = (player: Player) => {
    if (selected.length >= 15) return false;
    if (selected.find((p) => p.id === player.id)) return false;
    if ((posCounts[player.position] ?? 0) >= LIMITS[player.position as keyof typeof LIMITS]) return false;
    if (Number(player.price) > remaining) return false;
    return true;
  };

  const togglePlayer = (player: Player) => {
    const idx = selected.findIndex((p) => p.id === player.id);
    if (idx >= 0) {
      setSelected((prev) => prev.filter((_, i) => i !== idx));
    } else if (canAdd(player)) {
      setSelected((prev) => [...prev, player]);
    } else {
      Alert.alert('Cannot add', `Position limit or budget exceeded for ${player.name}`);
    }
  };

  const handleSave = async () => {
    if (selected.length !== 15) {
      Alert.alert('Incomplete', `Select exactly 15 players (${selected.length}/15)`);
      return;
    }
    setSaving(true);
    try {
      const budget_remaining = remaining;
      await api.post('/squads', {
        league_id: DEFAULT_LEAGUE_ID,
        player_ids: selected.map((p) => p.id),
        budget_remaining,
      });
      await fetchSquad(DEFAULT_LEAGUE_ID);
      Alert.alert('Squad saved!', 'Your squad has been created.');
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.detail ?? 'Failed to save squad');
    } finally {
      setSaving(false);
    }
  };

  const filtered = players.filter(
    (p) =>
      (posFilter === 'ALL' || p.position === posFilter) &&
      p.name.toLowerCase().includes(search.toLowerCase())
  );

  const positions = ['ALL', 'GK', 'DEF', 'MID', 'FWD'];

  return (
    <View style={styles.container}>
      {/* Budget bar */}
      <View style={styles.budgetBar}>
        <Text style={styles.budgetLabel}>Budget remaining</Text>
        <Text style={[styles.budgetValue, remaining < 0 && { color: '#FF4444' }]}>
          £{remaining.toFixed(1)}m
        </Text>
        <Text style={styles.countLabel}>{selected.length}/15 players</Text>
      </View>

      {/* Position filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {positions.map((pos) => (
          <Pressable
            key={pos}
            style={[styles.filterBtn, posFilter === pos && styles.filterBtnActive]}
            onPress={() => setPosFilter(pos)}
          >
            <Text style={[styles.filterText, posFilter === pos && styles.filterTextActive]}>{pos}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <TextInput
        style={styles.searchInput}
        placeholder="Search players..."
        placeholderTextColor="#8888AA"
        value={search}
        onChangeText={setSearch}
      />

      {loading ? (
        <ActivityIndicator color="#FFD700" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered.slice(0, 80)}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 6 }}
          renderItem={({ item }) => {
            const isSelected = !!selected.find((p) => p.id === item.id);
            const addable = canAdd(item);
            return (
              <Pressable
                style={[styles.playerRow, isSelected && styles.playerRowSelected]}
                onPress={() => togglePlayer(item)}
              >
                <View>
                  <Text style={styles.playerName}>{item.name}</Text>
                  <Text style={styles.playerSub}>{item.position} · £{Number(item.price).toFixed(1)}m</Text>
                </View>
                <View style={[styles.toggleBtn, isSelected && styles.toggleBtnSelected, !addable && !isSelected && styles.toggleBtnDisabled]}>
                  <Text style={[styles.toggleBtnText, isSelected && { color: '#0A0E1A' }]}>
                    {isSelected ? '✓' : '+'}
                  </Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}

      <Pressable style={styles.saveBtn} onPress={handleSave} disabled={saving}>
        {saving ? <ActivityIndicator color="#0A0E1A" /> : <Text style={styles.saveBtnText}>Save Squad ({selected.length}/15)</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  budgetBar: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#141824', gap: 12 },
  budgetLabel: { fontSize: 13, color: '#8888AA' },
  budgetValue: { fontSize: 20, fontWeight: 'bold', color: '#FFD700', flex: 1 },
  countLabel: { fontSize: 13, color: '#AAAACC' },
  filterRow: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#2E3550' },
  filterBtnActive: { backgroundColor: '#FFD700', borderColor: '#FFD700' },
  filterText: { color: '#AAAACC', fontSize: 13, fontWeight: '600' },
  filterTextActive: { color: '#0A0E1A' },
  searchInput: { backgroundColor: '#1E2333', borderRadius: 10, padding: 12, fontSize: 15, color: '#FFFFFF', borderWidth: 1, borderColor: '#2E3550', marginHorizontal: 16, marginBottom: 4 },
  playerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#141824', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#2E3550' },
  playerRowSelected: { borderColor: '#FFD700' },
  playerName: { fontSize: 15, color: '#FFFFFF', fontWeight: '600' },
  playerSub: { fontSize: 12, color: '#8888AA', marginTop: 2 },
  toggleBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: '#FFD700', justifyContent: 'center', alignItems: 'center' },
  toggleBtnSelected: { backgroundColor: '#FFD700' },
  toggleBtnDisabled: { borderColor: '#444466' },
  toggleBtnText: { color: '#FFD700', fontSize: 18, fontWeight: 'bold', lineHeight: 24 },
  saveBtn: { backgroundColor: '#FFD700', margin: 16, padding: 16, borderRadius: 12, alignItems: 'center' },
  saveBtnText: { color: '#0A0E1A', fontSize: 16, fontWeight: 'bold' },
});
