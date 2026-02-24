/**
 * My Squad tab — FPL-inspired pitch view with formation picker,
 * interactive player tokens, bench row, and team header.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Link } from 'expo-router';
import { useSquadStore } from '@/store/squadStore';
import { PitchView, type PitchPlayer } from '@/components/PitchView';
import { FormationPicker } from '@/components/FormationPicker';
import { PlayerActionSheet } from '@/components/PlayerActionSheet';

const DEFAULT_LEAGUE_ID = 'default';
const SCREEN_WIDTH = Dimensions.get('window').width;
const PITCH_WIDTH = Math.min(SCREEN_WIDTH - 32, 360);
const PITCH_HEIGHT = Math.round(PITCH_WIDTH * 1.35);

const POSITION_COLOR: Record<string, string> = {
  GK: '#FFD700',
  DEF: '#4FC3F7',
  MID: '#81C784',
  FWD: '#EF9A9A',
};

export default function SquadScreen() {
  const {
    squad,
    players,
    currentRound,
    loading,
    error,
    fetchSquad,
    fetchCurrentRound,
    setCaptain,
    setViceCaptain,
    swapPlayers,
    updateLineup,
    updateTeamName,
  } = useSquadStore();

  const [selectedPlayer, setSelectedPlayer] = useState<PitchPlayer | null>(null);
  const [isSelectedStarter, setIsSelectedStarter] = useState(true);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [subOutId, setSubOutId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [teamName, setTeamName] = useState('');

  const load = useCallback(async () => {
    await Promise.all([fetchSquad(DEFAULT_LEAGUE_ID), fetchCurrentRound()]);
  }, [fetchSquad, fetchCurrentRound]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (squad?.team_name) setTeamName(squad.team_name);
  }, [squad?.team_name]);

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

  // Enrich squad players with full player data
  const enriched = squad?.players.map((sp) => ({
    ...sp,
    player: players.find((p) => p.id === sp.player_id),
  })) ?? [];

  const starters = enriched.filter((sp) => sp.is_starting);
  const bench = enriched
    .filter((sp) => !sp.is_starting)
    .sort((a, b) => (a.bench_order ?? 99) - (b.bench_order ?? 99));

  // Build PitchPlayer array for starters
  const pitchPlayers: PitchPlayer[] = starters
    .filter((sp) => sp.player)
    .map((sp) => ({
      id: sp.player!.id,
      name: sp.player!.name,
      position: sp.player!.position,
      price: sp.player!.price,
      isCaptain: sp.is_captain,
      isViceCaptain: sp.is_vice_captain,
    }));

  const formation = squad?.formation ?? '4-4-2';
  const playerCount = squad?.players.length ?? 0;

  const handlePlayerPress = (player: PitchPlayer) => {
    if (subOutId) {
      // We're in "sub" mode — swap the sub-out starter with this bench player
      // But if tapping a starter while sub-out is active, just swap them
      swapPlayers(subOutId, player.id);
      setSubOutId(null);
      return;
    }
    setSelectedPlayer(player);
    setIsSelectedStarter(true);
    setSheetVisible(true);
  };

  const handleBenchPlayerPress = (sp: typeof bench[0]) => {
    if (!sp.player) return;
    if (subOutId) {
      swapPlayers(subOutId, sp.player.id);
      setSubOutId(null);
      return;
    }
    setSelectedPlayer({
      id: sp.player.id,
      name: sp.player.name,
      position: sp.player.position,
      price: sp.player.price,
    });
    setIsSelectedStarter(false);
    setSheetVisible(true);
  };

  const handleSubOut = (playerId: string) => {
    setSubOutId(playerId);
  };

  const handleFormationChange = async (newFormation: string) => {
    if (!squad) return;
    // Rebuild lineup for new formation
    const formationMap: Record<string, Record<string, number>> = {
      '4-4-2': { GK: 1, DEF: 4, MID: 4, FWD: 2 },
      '4-3-3': { GK: 1, DEF: 4, MID: 3, FWD: 3 },
      '3-4-3': { GK: 1, DEF: 3, MID: 4, FWD: 3 },
      '3-5-2': { GK: 1, DEF: 3, MID: 5, FWD: 2 },
      '4-5-1': { GK: 1, DEF: 4, MID: 5, FWD: 1 },
      '5-4-1': { GK: 1, DEF: 5, MID: 4, FWD: 1 },
      '5-3-2': { GK: 1, DEF: 5, MID: 3, FWD: 2 },
    };
    const needed = formationMap[newFormation] ?? formationMap['4-4-2'];

    // Group all squad players by position
    const byPos: Record<string, typeof enriched> = { GK: [], DEF: [], MID: [], FWD: [] };
    enriched.forEach((sp) => {
      if (sp.player) byPos[sp.player.position]?.push(sp);
    });

    // Sort by current is_starting first, then price
    for (const pos of Object.keys(byPos)) {
      byPos[pos].sort((a, b) => {
        if (a.is_starting !== b.is_starting) return a.is_starting ? -1 : 1;
        return (b.player?.price ?? 0) - (a.player?.price ?? 0);
      });
    }

    const newStarterIds = new Set<string>();
    for (const [pos, count] of Object.entries(needed)) {
      const group = byPos[pos] ?? [];
      for (let i = 0; i < count && i < group.length; i++) {
        newStarterIds.add(group[i].player_id);
      }
    }

    let benchOrder = 1;
    const updatedPlayers = squad.players.map((sp) => ({
      ...sp,
      is_starting: newStarterIds.has(sp.player_id),
      bench_order: newStarterIds.has(sp.player_id) ? null : benchOrder++,
      is_captain: sp.is_captain && newStarterIds.has(sp.player_id),
      is_vice_captain: sp.is_vice_captain && newStarterIds.has(sp.player_id),
    }));

    await updateLineup(updatedPlayers, newFormation);
  };

  const handleSaveTeamName = () => {
    if (teamName.trim()) {
      updateTeamName(teamName.trim());
    }
    setEditingName(false);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor="#FFD700" />}
    >
      {/* Team Header */}
      <View style={styles.teamHeader}>
        {editingName ? (
          <TextInput
            style={styles.teamNameInput}
            value={teamName}
            onChangeText={setTeamName}
            onBlur={handleSaveTeamName}
            onSubmitEditing={handleSaveTeamName}
            autoFocus
            maxLength={30}
            placeholder="Team Name"
            placeholderTextColor="#555577"
          />
        ) : (
          <Pressable onPress={() => setEditingName(true)}>
            <Text style={styles.teamName}>
              {squad?.team_name || 'My Team'}
              <Text style={styles.editIcon}> ✎</Text>
            </Text>
          </Pressable>
        )}
        <Text style={styles.teamMeta}>
          {playerCount}/15 selected · £{squad?.budget_remaining?.toFixed(1) ?? '100.0'}m remaining
        </Text>
      </View>

      {/* Stats Row */}
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

      {/* Formation Picker */}
      <View style={styles.formationRow}>
        <Text style={styles.sectionLabel}>Formation</Text>
        <FormationPicker selected={formation} onSelect={handleFormationChange} />
      </View>

      {/* Sub mode indicator */}
      {subOutId && (
        <View style={styles.subBanner}>
          <Text style={styles.subBannerText}>Tap a player to swap with</Text>
          <Pressable onPress={() => setSubOutId(null)}>
            <Text style={styles.subCancelText}>Cancel</Text>
          </Pressable>
        </View>
      )}

      {/* Pitch View */}
      <PitchView
        players={pitchPlayers}
        formation={formation}
        width={PITCH_WIDTH}
        height={PITCH_HEIGHT}
        highlightId={subOutId}
        onPlayerPress={handlePlayerPress}
      />

      {/* Bench */}
      <Text style={[styles.sectionLabel, { marginTop: 16, marginLeft: 16 }]}>Bench</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.benchRow}>
        {bench.map((sp) => {
          const p = sp.player;
          if (!p) return null;
          const isSubTarget = subOutId !== null;
          return (
            <Pressable
              key={sp.player_id}
              style={[styles.benchCard, isSubTarget && styles.benchCardHighlight]}
              onPress={() => handleBenchPlayerPress(sp)}
            >
              <View style={[styles.benchPosBadge, { backgroundColor: POSITION_COLOR[p.position] ?? '#555577' }]}>
                <Text style={styles.benchPosText}>{p.position}</Text>
              </View>
              <Text style={styles.benchName} numberOfLines={1}>
                {p.name.split(' ').pop()}
              </Text>
              <Text style={styles.benchPrice}>£{p.price?.toFixed(1)}m</Text>
            </Pressable>
          );
        })}
        {bench.length === 0 && (
          <View style={styles.benchEmpty}>
            <Text style={styles.benchEmptyText}>No bench players</Text>
          </View>
        )}
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actionRow}>
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

      {/* Player Action Sheet */}
      <PlayerActionSheet
        player={selectedPlayer}
        visible={sheetVisible}
        isStarter={isSelectedStarter}
        onClose={() => setSheetVisible(false)}
        onSetCaptain={(id) => setCaptain(id)}
        onSetViceCaptain={(id) => setViceCaptain(id)}
        onSubOut={handleSubOut}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  content: { paddingBottom: 32 },
  center: { flex: 1, backgroundColor: '#0A0E1A', justifyContent: 'center', alignItems: 'center' },

  // Team header
  teamHeader: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  teamName: { fontSize: 22, fontWeight: 'bold', color: '#FFFFFF' },
  editIcon: { fontSize: 16, color: '#8888AA' },
  teamNameInput: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    borderBottomWidth: 2,
    borderBottomColor: '#FFD700',
    paddingBottom: 4,
  },
  teamMeta: { fontSize: 13, color: '#8888AA', marginTop: 4 },

  // Stats
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 12, paddingHorizontal: 16 },
  statCard: { flex: 1, backgroundColor: '#141824', borderRadius: 10, padding: 10, alignItems: 'center' },
  statLabel: { fontSize: 10, color: '#8888AA', marginBottom: 2 },
  statValue: { fontSize: 14, fontWeight: 'bold', color: '#FFD700' },

  deadlineBanner: {
    backgroundColor: '#1E2333',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    marginHorizontal: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#FF6B35',
  },
  deadlineText: { color: '#AAAACC', fontSize: 12 },

  // Formation
  formationRow: { marginBottom: 12 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#8888AA',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    paddingHorizontal: 16,
  },

  // Sub banner
  subBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2A1A00',
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  subBannerText: { color: '#FFD700', fontSize: 13, fontWeight: '600' },
  subCancelText: { color: '#FF6B6B', fontSize: 13, fontWeight: '600' },

  // Bench
  benchRow: { paddingHorizontal: 16, gap: 8, paddingBottom: 4 },
  benchCard: {
    backgroundColor: '#141824',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    width: 80,
    borderWidth: 1,
    borderColor: '#1E2333',
  },
  benchCardHighlight: {
    borderColor: '#FFD700',
    backgroundColor: '#1A1A2E',
  },
  benchPosBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  benchPosText: { fontSize: 10, fontWeight: 'bold', color: '#0A0E1A' },
  benchName: { fontSize: 11, fontWeight: '600', color: '#FFFFFF', textAlign: 'center' },
  benchPrice: { fontSize: 10, color: '#8888AA', marginTop: 2 },
  benchEmpty: { flex: 1, alignItems: 'center', padding: 20 },
  benchEmptyText: { color: '#555577', fontSize: 13 },

  // Actions
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 16, paddingHorizontal: 16 },
  actionBtn: {
    flex: 1,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2E3550',
  },
  actionBtnPrimary: { backgroundColor: '#FFD700', borderColor: '#FFD700' },
  actionText: { color: '#AAAACC', fontSize: 14, fontWeight: '600' },
  actionTextPrimary: { color: '#0A0E1A' },

  // Error
  errorText: { color: '#FF6B6B', fontSize: 16, marginBottom: 16, textAlign: 'center', padding: 16 },
  retryBtn: { backgroundColor: '#1E2333', borderRadius: 8, padding: 12 },
  retryText: { color: '#FFD700', fontWeight: '600' },
});
