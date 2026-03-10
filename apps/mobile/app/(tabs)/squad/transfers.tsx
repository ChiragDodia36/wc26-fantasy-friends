/**
 * Transfers screen — search for players to swap in/out.
 * Glassmorphism UI with gradient accents and press animations.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSquadStore } from '@/store/squadStore';
import type { Player } from '@/types/api';
import { GlassCard } from '@/components/ui/GlassCard';
import { GradientButton } from '@/components/ui/GradientButton';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { StatChip } from '@/components/ui/StatChip';
import { Colors, Gradients, POS_COLORS, Radius, Spacing, Typography } from '@/theme/constants';

const DEFAULT_LEAGUE_ID = 'default';

export default function TransfersScreen() {
  const {
    squad, players, transferAllowance, loading, error,
    fetchSquad, fetchTransferAllowance, activateWildcard, makeTransfer,
  } = useSquadStore();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [playerOut, setPlayerOut] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => { fetchSquad(DEFAULT_LEAGUE_ID); }, []);
  useEffect(() => { if (squad) fetchTransferAllowance(); }, [squad?.id]);

  const squadPlayerIds = new Set(squad?.players.map((sp) => sp.player_id) ?? []);
  const freeTransfers = transferAllowance?.free_remaining ?? squad?.free_transfers_remaining ?? 3;
  const wildcardUsed = squad?.wildcard_used ?? false;
  const isKnockout = transferAllowance?.is_knockout ?? false;

  const filteredPlayers = players.filter(
    (p) => !squadPlayerIds.has(p.id) && p.name.toLowerCase().includes(search.toLowerCase()),
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
                await fetchTransferAllowance();
                Alert.alert('Transfer complete', 'Your squad has been updated.');
              } catch (err: any) {
                Alert.alert('Transfer failed', err?.response?.data?.detail ?? 'Try again');
              } finally {
                setProcessing(false);
              }
            },
          },
        ],
      );
    },
    [playerOut, freeTransfers, players, makeTransfer, fetchTransferAllowance],
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
      ],
    );
  };

  if (loading && !squad) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.accent} size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
      {/* Transfer info bar */}
      <GlassCard variant="elevated" style={styles.infoBar} noPadding>
        <View style={styles.infoRow}>
          <StatChip
            label={isKnockout ? 'Free (round)' : 'Free (today)'}
            value={`${freeTransfers}`}
            variant={freeTransfers <= 0 ? 'gold' : 'green'}
          />
          <StatChip label="Budget" value={`£${squad?.budget_remaining?.toFixed(1) ?? '?'}m`} variant="blue" />
          {!wildcardUsed && (
            <AnimatedPressable onPress={handleWildcard}>
              <LinearGradient
                colors={['rgba(156,39,176,0.2)', 'rgba(156,39,176,0.08)']}
                style={styles.wildcardChip}
              >
                <Ionicons name="flash" size={14} color={Colors.purple} />
                <Text style={styles.wildcardText}>Wildcard</Text>
              </LinearGradient>
            </AnimatedPressable>
          )}
        </View>
      </GlassCard>

      {/* AI Suggest button */}
      <View style={{ paddingHorizontal: Spacing.lg, marginVertical: Spacing.sm }}>
        <GradientButton
          variant="outline"
          onPress={() => router.push('/(tabs)/squad/ai-transfers' as any)}
          icon={<Ionicons name="sparkles" size={16} color={Colors.accent} />}
        >
          AI Suggest Transfers
        </GradientButton>
      </View>

      {freeTransfers <= 0 && (
        <GlassCard variant="error" style={styles.penaltyBanner}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="warning" size={16} color={Colors.error} />
            <Text style={styles.penaltyText}>Extra transfers cost -4 pts each</Text>
          </View>
        </GlassCard>
      )}

      {/* Step 1: select player to remove */}
      <Text style={[Typography.sectionLabel, styles.sectionHeader]}>1. Select player to remove</Text>
      <View style={{ paddingHorizontal: Spacing.lg, gap: 6, marginBottom: Spacing.md }}>
        {(squad?.players ?? []).map((item) => {
          const p = players.find((pl) => pl.id === item.player_id);
          const selected = item.player_id === playerOut;
          return (
            <AnimatedPressable
              key={item.player_id}
              scaleAmount={0.98}
              onPress={() => setPlayerOut(selected ? null : item.player_id)}
            >
              <View style={[styles.squadRow, selected && styles.squadRowSelected]}>
                <View style={[styles.posBadge, { backgroundColor: POS_COLORS[p?.position ?? ''] ?? Colors.textDim }]}>
                  <Text style={styles.posBadgeText}>{p?.position ?? '?'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.squadName, selected && { color: '#0B0D1F' }]}>
                    {p?.name ?? 'Unknown'}
                  </Text>
                  <Text style={[styles.squadMeta, selected && { color: '#333' }]}>
                    £{Number(p?.price ?? 0).toFixed(1)}m{!item.is_starting ? ' · Bench' : ''}
                  </Text>
                </View>
                {selected && (
                  <View style={styles.selectedBadge}>
                    <Ionicons name="checkmark-circle" size={20} color="#0B0D1F" />
                  </View>
                )}
              </View>
            </AnimatedPressable>
          );
        })}
      </View>

      {/* Step 2: search replacement */}
      <Text style={[Typography.sectionLabel, styles.sectionHeader]}>2. Select replacement</Text>
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={Colors.textDim} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search players..."
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <View style={{ paddingHorizontal: Spacing.lg, gap: 6 }}>
        {filteredPlayers.slice(0, 50).map((item) => (
          <AnimatedPressable
            key={item.id}
            scaleAmount={0.98}
            onPress={() => handleTransfer(item.id)}
            disabled={processing}
          >
            <View style={styles.playerRow}>
              <View style={[styles.posBadge, { backgroundColor: POS_COLORS[item.position] ?? Colors.textDim }]}>
                <Text style={styles.posBadgeText}>{item.position}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.playerName}>{item.name}</Text>
                <Text style={styles.playerSub}>£{Number(item.price).toFixed(1)}m</Text>
              </View>
              <LinearGradient
                colors={Gradients.goldCta}
                style={styles.addBtn}
              >
                <Text style={styles.addBtnText}>+</Text>
              </LinearGradient>
            </View>
          </AnimatedPressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, backgroundColor: Colors.bg, justifyContent: 'center', alignItems: 'center' },

  infoBar: { marginHorizontal: Spacing.lg, marginTop: Spacing.md },
  infoRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: Spacing.sm },

  wildcardChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(156,39,176,0.3)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  wildcardText: { color: Colors.purple, fontSize: 12, fontWeight: 'bold' },

  penaltyBanner: { marginHorizontal: Spacing.lg, marginBottom: Spacing.sm },
  penaltyText: { color: '#FF9999', fontSize: 13 },

  sectionHeader: { paddingHorizontal: Spacing.lg, marginBottom: 6, marginTop: Spacing.md },

  squadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.md,
    padding: 10,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  squadRowSelected: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  squadName: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  squadMeta: { color: Colors.textMuted, fontSize: 11, marginTop: 1 },
  selectedBadge: { marginLeft: 4 },

  posBadge: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  posBadgeText: { color: Colors.bg, fontSize: 10, fontWeight: 'bold' },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 15, color: Colors.textPrimary },

  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  playerName: { fontSize: 14, color: Colors.textPrimary, fontWeight: '600' },
  playerSub: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  addBtn: {
    width: 32, height: 32, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
  },
  addBtnText: { color: '#0B0D1F', fontSize: 20, fontWeight: 'bold', lineHeight: 24 },
});
