/**
 * Edit Squad screen — pick 15 players within budget.
 * Enforces position limits: 2 GK / 5 DEF / 5 MID / 3 FWD, max 2 per team.
 * Players grouped by position with section headers. Search by name or team.
 */
import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  SectionList,
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
const MAX_PER_TEAM = 2;
const LIMITS: Record<string, number> = { GK: 2, DEF: 5, MID: 5, FWD: 3 };
const POSITION_ORDER = ['GK', 'DEF', 'MID', 'FWD'];
const POSITION_COLOR: Record<string, string> = {
  GK: '#FFD700', DEF: '#4FC3F7', MID: '#81C784', FWD: '#EF9A9A',
};
const POSITION_LABEL: Record<string, string> = {
  GK: 'Goalkeepers', DEF: 'Defenders', MID: 'Midfielders', FWD: 'Forwards',
};

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

  const teamCounts = selected.reduce(
    (acc, p) => ({ ...acc, [p.team_id]: (acc[p.team_id] ?? 0) + 1 }),
    {} as Record<string, number>
  );

  const canAdd = (player: Player) => {
    if (selected.length >= 15) return false;
    if (selected.find((p) => p.id === player.id)) return false;
    if ((posCounts[player.position] ?? 0) >= LIMITS[player.position]) return false;
    if ((teamCounts[player.team_id] ?? 0) >= MAX_PER_TEAM) return false;
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
      if ((teamCounts[player.team_id] ?? 0) >= MAX_PER_TEAM) {
        Alert.alert('Team limit', `Max ${MAX_PER_TEAM} players from ${player.team_name ?? 'same team'}`);
      } else if ((posCounts[player.position] ?? 0) >= LIMITS[player.position]) {
        Alert.alert('Position full', `Already have ${LIMITS[player.position]} ${player.position} players`);
      } else if (Number(player.price) > remaining) {
        Alert.alert('Over budget', `£${Number(player.price).toFixed(1)}m exceeds remaining £${remaining.toFixed(1)}m`);
      } else {
        Alert.alert('Cannot add', 'Squad is full (15/15)');
      }
    }
  };

  const handleSave = async () => {
    if (selected.length !== 15) {
      Alert.alert('Incomplete', `Select exactly 15 players (${selected.length}/15)`);
      return;
    }
    setSaving(true);
    try {
      await api.post('/squads', {
        league_id: DEFAULT_LEAGUE_ID,
        player_ids: selected.map((p) => p.id),
        budget_remaining: remaining,
      });
      await fetchSquad(DEFAULT_LEAGUE_ID);
      Alert.alert('Squad saved!', 'Your squad has been created.');
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.detail ?? 'Failed to save squad');
    } finally {
      setSaving(false);
    }
  };

  // Filter by search (name or team) and position
  const filtered = players.filter(
    (p) =>
      (posFilter === 'ALL' || p.position === posFilter) &&
      (search === '' ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.team_name ?? '').toLowerCase().includes(search.toLowerCase()))
  );

  // Group into sections by position
  const sections = posFilter === 'ALL'
    ? POSITION_ORDER.map((pos) => ({
        title: pos,
        data: filtered.filter((p) => p.position === pos),
      })).filter((s) => s.data.length > 0)
    : [{ title: posFilter, data: filtered }];

  const positions = ['ALL', 'GK', 'DEF', 'MID', 'FWD'];

  return (
    <View style={styles.container}>
      {/* Budget bar with position counts */}
      <View style={styles.budgetBar}>
        <View style={styles.budgetLeft}>
          <Text style={styles.budgetLabel}>Budget</Text>
          <Text style={[styles.budgetValue, remaining < 0 && { color: '#FF4444' }]}>
            £{remaining.toFixed(1)}m
          </Text>
        </View>
        <View style={styles.posCountRow}>
          {POSITION_ORDER.map((pos) => (
            <View key={pos} style={styles.posCountItem}>
              <View style={[styles.posCountDot, { backgroundColor: POSITION_COLOR[pos] }]} />
              <Text style={styles.posCountText}>
                {posCounts[pos] ?? 0}/{LIMITS[pos]}
              </Text>
            </View>
          ))}
        </View>
        <Text style={styles.countLabel}>{selected.length}/15</Text>
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
        placeholder="Search by player or team name..."
        placeholderTextColor="#8888AA"
        value={search}
        onChangeText={setSearch}
      />

      {loading ? (
        <ActivityIndicator color="#FFD700" style={{ marginTop: 40 }} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 80 }}
          stickySectionHeadersEnabled
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionDot, { backgroundColor: POSITION_COLOR[section.title] }]} />
              <Text style={styles.sectionTitle}>{POSITION_LABEL[section.title] ?? section.title}</Text>
              <Text style={styles.sectionCount}>
                {posCounts[section.title] ?? 0}/{LIMITS[section.title]}
              </Text>
            </View>
          )}
          renderItem={({ item }) => {
            const isSelected = !!selected.find((p) => p.id === item.id);
            const addable = canAdd(item);
            const teamFull = !isSelected && (teamCounts[item.team_id] ?? 0) >= MAX_PER_TEAM;
            return (
              <Pressable
                style={[styles.playerRow, isSelected && styles.playerRowSelected]}
                onPress={() => togglePlayer(item)}
              >
                <View style={styles.playerInfo}>
                  <Text style={styles.playerName}>{item.name}</Text>
                  <Text style={styles.playerSub}>
                    {item.team_name ?? 'Unknown'} · £{Number(item.price).toFixed(1)}m
                    {teamFull ? '  · Team full' : ''}
                  </Text>
                </View>
                <View style={[
                  styles.toggleBtn,
                  isSelected && styles.toggleBtnSelected,
                  !addable && !isSelected && styles.toggleBtnDisabled,
                ]}>
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
        {saving ? (
          <ActivityIndicator color="#0A0E1A" />
        ) : (
          <Text style={styles.saveBtnText}>Save Squad ({selected.length}/15)</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  budgetBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingHorizontal: 16,
    backgroundColor: '#141824',
    gap: 12,
  },
  budgetLeft: { marginRight: 4 },
  budgetLabel: { fontSize: 11, color: '#8888AA' },
  budgetValue: { fontSize: 18, fontWeight: 'bold', color: '#FFD700' },
  posCountRow: { flex: 1, flexDirection: 'row', gap: 8, justifyContent: 'center' },
  posCountItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  posCountDot: { width: 8, height: 8, borderRadius: 4 },
  posCountText: { fontSize: 12, color: '#AAAACC', fontWeight: '600' },
  countLabel: { fontSize: 14, color: '#FFD700', fontWeight: 'bold' },
  filterRow: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  filterBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2E3550',
  },
  filterBtnActive: { backgroundColor: '#FFD700', borderColor: '#FFD700' },
  filterText: { color: '#AAAACC', fontSize: 13, fontWeight: '600' },
  filterTextActive: { color: '#0A0E1A' },
  searchInput: {
    backgroundColor: '#1E2333',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#2E3550',
    marginHorizontal: 16,
    marginBottom: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingTop: 14,
    gap: 8,
    backgroundColor: '#0A0E1A',
  },
  sectionDot: { width: 10, height: 10, borderRadius: 5 },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#FFFFFF', flex: 1 },
  sectionCount: { fontSize: 13, color: '#8888AA', fontWeight: '600' },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141824',
    borderRadius: 10,
    padding: 10,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#1E2333',
  },
  playerRowSelected: { borderColor: '#FFD700' },
  playerInfo: { flex: 1 },
  playerName: { fontSize: 14, color: '#FFFFFF', fontWeight: '600' },
  playerSub: { fontSize: 12, color: '#8888AA', marginTop: 1 },
  toggleBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleBtnSelected: { backgroundColor: '#FFD700' },
  toggleBtnDisabled: { borderColor: '#444466' },
  toggleBtnText: { color: '#FFD700', fontSize: 16, fontWeight: 'bold' },
  saveBtn: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFD700',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveBtnText: { color: '#0A0E1A', fontSize: 16, fontWeight: 'bold' },
});
