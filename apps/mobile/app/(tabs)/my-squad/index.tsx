/**
 * My Squad tab — pitch view with formation picker, captain/VC selection,
 * bench row, player swaps, and AI lineup suggestions.
 * Glassmorphism UI with gradient cards and micro-animations.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSquadStore } from '@/store/squadStore';
import { PitchView, type PitchPlayer } from '@/components/PitchView';
import { FormationPicker } from '@/components/FormationPicker';
import { PlayerActionSheet } from '@/components/PlayerActionSheet';
import { GlassCard } from '@/components/ui/GlassCard';
import { GradientButton } from '@/components/ui/GradientButton';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { StatChip } from '@/components/ui/StatChip';
import { Colors, POS_COLORS, Spacing, Typography } from '@/theme/constants';
import api from '@/services/api';
import type { LineupSuggestion } from '@/types/ai';

const DEFAULT_LEAGUE_ID = 'default';
const SCREEN_WIDTH = Dimensions.get('window').width;
const PITCH_WIDTH = Math.min(SCREEN_WIDTH - 32, 360);
const PITCH_HEIGHT = Math.round(PITCH_WIDTH * 1.35);

export default function MySquadScreen() {
  const {
    squad, players, currentRound, loading, error,
    fetchSquad, fetchCurrentRound, setCaptain, setViceCaptain, swapPlayers, updateLineup,
  } = useSquadStore();

  const [selectedPlayer, setSelectedPlayer] = useState<PitchPlayer | null>(null);
  const [isSelectedStarter, setIsSelectedStarter] = useState(true);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [subOutId, setSubOutId] = useState<string | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<LineupSuggestion | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const load = useCallback(async () => {
    await Promise.all([fetchSquad(DEFAULT_LEAGUE_ID), fetchCurrentRound()]);
  }, [fetchSquad, fetchCurrentRound]);

  useEffect(() => { load(); }, [load]);

  if (loading && !squad) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.accent} size="large" />
      </View>
    );
  }

  if (!squad) {
    return (
      <View style={styles.center}>
        <Ionicons name="shirt-outline" size={48} color={Colors.textDim} />
        <Text style={styles.emptyTitle}>No Squad Yet</Text>
        <Text style={styles.emptySubtitle}>Head to the Squad tab to build your team first.</Text>
      </View>
    );
  }

  if (error && !squad) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <GradientButton variant="outline" onPress={load}>Retry</GradientButton>
      </View>
    );
  }

  const enriched = squad.players.map((sp) => ({
    ...sp,
    player: players.find((p) => p.id === sp.player_id),
  }));

  const starters = enriched.filter((sp) => sp.is_starting);
  const bench = enriched
    .filter((sp) => !sp.is_starting)
    .sort((a, b) => (a.bench_order ?? 99) - (b.bench_order ?? 99));

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

  const formation = squad.formation ?? '4-4-2';
  const playerCount = squad.players.length ?? 0;

  const handlePlayerPress = (player: PitchPlayer) => {
    if (subOutId) { swapPlayers(subOutId, player.id); setSubOutId(null); return; }
    setSelectedPlayer(player); setIsSelectedStarter(true); setSheetVisible(true);
  };

  const handleBenchPlayerPress = (sp: typeof bench[0]) => {
    if (!sp.player) return;
    if (subOutId) { swapPlayers(subOutId, sp.player.id); setSubOutId(null); return; }
    setSelectedPlayer({
      id: sp.player.id, name: sp.player.name, position: sp.player.position, price: sp.player.price,
    });
    setIsSelectedStarter(false); setSheetVisible(true);
  };

  const handleFormationChange = async (newFormation: string) => {
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
    const byPos: Record<string, typeof enriched> = { GK: [], DEF: [], MID: [], FWD: [] };
    enriched.forEach((sp) => { if (sp.player) byPos[sp.player.position]?.push(sp); });
    for (const pos of Object.keys(byPos)) {
      byPos[pos].sort((a, b) => {
        if (a.is_starting !== b.is_starting) return a.is_starting ? -1 : 1;
        return (b.player?.price ?? 0) - (a.player?.price ?? 0);
      });
    }
    const newStarterIds = new Set<string>();
    for (const [pos, count] of Object.entries(needed)) {
      const group = byPos[pos] ?? [];
      for (let i = 0; i < count && i < group.length; i++) newStarterIds.add(group[i].player_id);
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

  const fetchAiSuggestion = async () => {
    setAiLoading(true); setAiError(null); setAiSuggestion(null);
    try {
      const res = await api.post<{ explanation: string; data: LineupSuggestion }>('/ai/lineup', {
        squad_id: squad.id,
        league_id: squad.league_id ?? 'default',
        round_id: currentRound?.id ?? '',
      });
      const data = res.data.data ?? res.data;
      setAiSuggestion({
        explanation: data.explanation ?? res.data.explanation ?? '',
        starting: data.starting ?? [],
        bench: data.bench ?? [],
        captain_id: data.captain_id ?? null,
        vice_captain_id: data.vice_captain_id ?? null,
      });
    } catch (err: any) {
      let msg = 'Failed to get AI suggestions';
      try {
        const detail = err?.response?.data?.detail;
        if (typeof detail === 'string') msg = detail;
        else if (Array.isArray(detail)) msg = detail.map((d: any) => String(d?.msg ?? JSON.stringify(d))).join('; ');
        else if (err?.message) msg = String(err.message);
      } catch { /* fallback */ }
      setAiError(msg);
    } finally { setAiLoading(false); }
  };

  const applyCaptain = async () => { if (aiSuggestion?.captain_id) await setCaptain(aiSuggestion.captain_id); };
  const applyViceCaptain = async () => { if (aiSuggestion?.vice_captain_id) await setViceCaptain(aiSuggestion.vice_captain_id); };
  const applyLineup = async () => {
    if (!aiSuggestion) return;
    const startingSet = new Set(aiSuggestion.starting);
    let benchOrder = 1;
    const updatedPlayers = squad.players.map((sp) => ({
      ...sp,
      is_starting: startingSet.has(sp.player_id),
      bench_order: startingSet.has(sp.player_id) ? null : benchOrder++,
      is_captain: sp.player_id === aiSuggestion.captain_id,
      is_vice_captain: sp.player_id === aiSuggestion.vice_captain_id,
    }));
    await updateLineup(updatedPlayers, formation);
    setAiSuggestion(null);
  };

  const getPlayerName = (playerId: string) => players.find((pl) => pl.id === playerId)?.name ?? 'Unknown';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Team Header */}
      <View style={styles.teamHeader}>
        <Text style={Typography.screenTitle}>{squad.team_name || 'My Team'}</Text>
        <Text style={styles.teamMeta}>
          {playerCount}/15 selected · £{squad.budget_remaining?.toFixed(1) ?? '100.0'}m remaining
        </Text>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <StatChip label="Budget" value={`£${squad.budget_remaining?.toFixed(1) ?? '—'}m`} variant="blue" />
        <StatChip label="Free Transfers" value={`${squad.free_transfers_remaining ?? 1}`} variant="green" />
        <StatChip label="Round" value={currentRound?.name ?? '—'} variant="gold" />
      </View>

      {currentRound?.deadline_utc && (
        <GlassCard variant="gold" style={styles.deadlineBanner}>
          <View style={styles.deadlineRow}>
            <Ionicons name="time-outline" size={16} color={Colors.warning} />
            <Text style={styles.deadlineText}>
              Deadline: {new Date(currentRound.deadline_utc).toLocaleString()}
            </Text>
          </View>
        </GlassCard>
      )}

      {/* Formation Picker */}
      <View style={styles.formationRow}>
        <Text style={Typography.sectionLabel}>  Formation</Text>
        <FormationPicker selected={formation} onSelect={handleFormationChange} />
      </View>

      {/* Sub mode indicator */}
      {subOutId && (
        <GlassCard variant="gold" style={styles.subBanner}>
          <View style={styles.subRow}>
            <Text style={styles.subBannerText}>Tap a player to swap with</Text>
            <AnimatedPressable onPress={() => setSubOutId(null)}>
              <Text style={styles.subCancelText}>Cancel</Text>
            </AnimatedPressable>
          </View>
        </GlassCard>
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
      <Text style={[Typography.sectionLabel, { marginTop: 16, marginLeft: 16 }]}>Bench</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.benchRow}>
        {bench.map((sp) => {
          const p = sp.player;
          if (!p) return null;
          const isSubTarget = subOutId !== null;
          return (
            <AnimatedPressable
              key={sp.player_id}
              scaleAmount={0.95}
              onPress={() => handleBenchPlayerPress(sp)}
            >
              <GlassCard
                variant={isSubTarget ? 'gold' : 'default'}
                style={styles.benchCard}
              >
                <View style={[styles.benchPosBadge, { backgroundColor: POS_COLORS[p.position] ?? Colors.textDim }]}>
                  <Text style={styles.benchPosText}>{p.position}</Text>
                </View>
                <Text style={styles.benchName} numberOfLines={1}>
                  {p.name.split(' ').pop()}
                </Text>
                <Text style={styles.benchPrice}>£{p.price?.toFixed(1)}m</Text>
              </GlassCard>
            </AnimatedPressable>
          );
        })}
        {bench.length === 0 && (
          <View style={styles.benchEmpty}>
            <Text style={styles.benchEmptyText}>No bench players</Text>
          </View>
        )}
      </ScrollView>

      {/* AI Lineup Suggestions */}
      <View style={styles.aiSection}>
        <Text style={[Typography.sectionLabel, { paddingHorizontal: Spacing.lg }]}>AI Lineup Suggestions</Text>

        <View style={{ paddingHorizontal: Spacing.lg }}>
          <GradientButton
            onPress={fetchAiSuggestion}
            disabled={aiLoading}
            icon={aiLoading
              ? <ActivityIndicator color="#0B0D1F" size="small" />
              : <Ionicons name="sparkles" size={18} color="#0B0D1F" />
            }
          >
            {aiLoading ? 'Analyzing...' : 'Get AI Suggestions'}
          </GradientButton>
        </View>

        {aiError && (
          <GlassCard variant="error" style={styles.aiErrorCard}>
            <Text style={styles.aiErrorText}>{typeof aiError === 'string' ? aiError : String(aiError)}</Text>
          </GlassCard>
        )}

        {aiSuggestion && (
          <View style={styles.aiResults}>
            {aiSuggestion.explanation ? (
              <Text style={styles.aiExplanation}>{aiSuggestion.explanation}</Text>
            ) : null}

            {aiSuggestion.captain_id && (
              <GlassCard variant="ai">
                <View style={styles.aiCardHeader}>
                  <Ionicons name="star" size={16} color={Colors.accent} />
                  <Text style={styles.aiCardTitle}>Captain</Text>
                </View>
                <Text style={styles.aiCardPlayer}>{getPlayerName(aiSuggestion.captain_id)}</Text>
                <GradientButton variant="outline" onPress={applyCaptain}>Apply Captain</GradientButton>
              </GlassCard>
            )}

            {aiSuggestion.vice_captain_id && (
              <GlassCard variant="ai">
                <View style={styles.aiCardHeader}>
                  <Ionicons name="star-half" size={16} color="#C0C0C0" />
                  <Text style={styles.aiCardTitle}>Vice Captain</Text>
                </View>
                <Text style={styles.aiCardPlayer}>{getPlayerName(aiSuggestion.vice_captain_id)}</Text>
                <GradientButton variant="outline" onPress={applyViceCaptain}>Apply Vice Captain</GradientButton>
              </GlassCard>
            )}

            {aiSuggestion.starting.length > 0 && (
              <GlassCard variant="ai">
                <View style={styles.aiCardHeader}>
                  <Ionicons name="people" size={16} color={Colors.success} />
                  <Text style={styles.aiCardTitle}>Suggested Starting XI</Text>
                </View>
                {aiSuggestion.starting.map((pid) => {
                  const p = players.find((pl) => pl.id === pid);
                  return p ? (
                    <View key={pid} style={styles.aiPlayerRow}>
                      <View style={[styles.aiPosDot, { backgroundColor: POS_COLORS[p.position] ?? Colors.textDim }]} />
                      <Text style={styles.aiPlayerName}>{p.name}</Text>
                      <Text style={styles.aiPlayerPos}>{p.position}</Text>
                    </View>
                  ) : null;
                })}
                <View style={{ marginTop: 12 }}>
                  <GradientButton variant="outline" onPress={applyLineup}>Apply Full Lineup</GradientButton>
                </View>
              </GlassCard>
            )}
          </View>
        )}
      </View>

      <PlayerActionSheet
        player={selectedPlayer}
        visible={sheetVisible}
        isStarter={isSelectedStarter}
        onClose={() => setSheetVisible(false)}
        onSetCaptain={(id) => setCaptain(id)}
        onSetViceCaptain={(id) => setViceCaptain(id)}
        onSubOut={(id) => setSubOutId(id)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingBottom: 100 },
  center: { flex: 1, backgroundColor: Colors.bg, justifyContent: 'center', alignItems: 'center', padding: 32 },

  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.textPrimary, marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', marginTop: 8 },
  errorText: { color: Colors.error, fontSize: 16, marginBottom: 16, textAlign: 'center', padding: 16 },

  teamHeader: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.sm },
  teamMeta: { fontSize: 13, color: Colors.textMuted, marginTop: 4 },

  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md, paddingHorizontal: Spacing.lg },

  deadlineBanner: { marginHorizontal: Spacing.lg, marginBottom: Spacing.md },
  deadlineRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  deadlineText: { color: Colors.textSecondary, fontSize: 12 },

  formationRow: { marginBottom: Spacing.md },

  subBanner: { marginHorizontal: Spacing.lg, marginBottom: Spacing.sm },
  subRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subBannerText: { color: Colors.accent, fontSize: 13, fontWeight: '600' },
  subCancelText: { color: Colors.error, fontSize: 13, fontWeight: '600' },

  benchRow: { paddingHorizontal: Spacing.lg, gap: Spacing.sm, paddingBottom: 4 },
  benchCard: { alignItems: 'center', width: 80 },
  benchPosBadge: {
    width: 28, height: 28, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center', marginBottom: 6,
  },
  benchPosText: { fontSize: 10, fontWeight: 'bold', color: Colors.bg },
  benchName: { fontSize: 11, fontWeight: '600', color: Colors.textPrimary, textAlign: 'center' },
  benchPrice: { fontSize: 10, color: Colors.textMuted, marginTop: 2 },
  benchEmpty: { flex: 1, alignItems: 'center', padding: 20 },
  benchEmptyText: { color: Colors.textDim, fontSize: 13 },

  aiSection: { marginTop: Spacing.xxl, paddingBottom: Spacing.lg, gap: Spacing.md },
  aiErrorCard: { marginHorizontal: Spacing.lg },
  aiErrorText: { color: Colors.error, fontSize: 13 },
  aiResults: { paddingHorizontal: Spacing.lg, gap: Spacing.md },
  aiExplanation: { color: Colors.textSecondary, fontSize: 13, lineHeight: 20 },

  aiCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  aiCardTitle: { fontSize: 13, fontWeight: 'bold', color: Colors.textPrimary },
  aiCardPlayer: { fontSize: 16, fontWeight: '600', color: Colors.accent, marginBottom: 10 },

  aiPlayerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, gap: 8 },
  aiPosDot: { width: 8, height: 8, borderRadius: 4 },
  aiPlayerName: { flex: 1, color: Colors.textPrimary, fontSize: 13 },
  aiPlayerPos: { color: Colors.textMuted, fontSize: 11 },
});
