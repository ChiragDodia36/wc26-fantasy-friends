/**
 * Squad tab — management hub.
 * New users: "Build Your Squad" CTA → edit screen.
 * Existing users: transfer/edit cards + squad summary.
 * Glassmorphism UI with gradient cards and micro-animations.
 */
import { useCallback, useEffect } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSquadStore } from '@/store/squadStore';
import { GlassCard } from '@/components/ui/GlassCard';
import { GradientButton } from '@/components/ui/GradientButton';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { StatChip } from '@/components/ui/StatChip';
import { Colors, Spacing, Typography } from '@/theme/constants';

const DEFAULT_LEAGUE_ID = 'default';

export default function SquadHubScreen() {
  const { squad, loading, error, fetchSquad, fetchCurrentRound, transferAllowance, fetchTransferAllowance } =
    useSquadStore();

  const load = useCallback(async () => {
    await Promise.all([fetchSquad(DEFAULT_LEAGUE_ID), fetchCurrentRound()]);
  }, [fetchSquad, fetchCurrentRound]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (squad) fetchTransferAllowance();
  }, [squad?.id, fetchTransferAllowance]);

  if (loading && !squad) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.accent} size="large" />
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

  // ── New user: no squad yet ──
  if (!squad) {
    return (
      <View style={styles.center}>
        <Ionicons name="people" size={56} color={Colors.accent} />
        <Text style={styles.welcomeTitle}>Build Your Squad</Text>
        <Text style={styles.welcomeSubtitle}>
          Pick 15 players within your £100m budget to compete in the World Cup 2026 fantasy league.
        </Text>
        <Link href="/(tabs)/squad/edit" asChild>
          <GradientButton icon={<Ionicons name="add-circle" size={20} color={Colors.bg} />}>
            Start Building
          </GradientButton>
        </Link>
      </View>
    );
  }

  // ── Existing user: management hub ──
  const playerCount = squad.players.length;
  const freeTransfers = transferAllowance?.free_remaining ?? squad.free_transfers_remaining ?? 1;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={Colors.accent} />}
    >
      {/* Summary Header */}
      <View style={styles.header}>
        <Text style={Typography.screenTitle}>{squad.team_name || 'My Team'}</Text>
      </View>

      <View style={styles.statsRow}>
        <StatChip label="Players" value={`${playerCount}/15`} variant="blue" />
        <StatChip label="Budget" value={`£${squad.budget_remaining?.toFixed(1)}m`} variant="gold" />
        <StatChip label="Free Transfers" value={`${freeTransfers}`} variant="green" />
      </View>

      {/* Action Cards */}
      <View style={styles.cards}>
        <Link href="/(tabs)/squad/transfers" asChild>
          <AnimatedPressable>
            <GlassCard variant="elevated">
              <View style={styles.cardRow}>
                <View style={[styles.cardIconWrap, { backgroundColor: 'rgba(255,215,0,0.12)' }]}>
                  <Ionicons name="swap-horizontal" size={24} color={Colors.accent} />
                </View>
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle}>Make Transfers</Text>
                  <Text style={styles.cardDesc}>
                    {freeTransfers} free transfer{freeTransfers !== 1 ? 's' : ''} available.
                    Swap players to strengthen your squad.
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.textDim} />
              </View>
            </GlassCard>
          </AnimatedPressable>
        </Link>

        <Link href="/(tabs)/squad/edit" asChild>
          <AnimatedPressable>
            <GlassCard variant="elevated">
              <View style={styles.cardRow}>
                <View style={[styles.cardIconWrap, { backgroundColor: 'rgba(79,195,247,0.12)' }]}>
                  <Ionicons name="create-outline" size={24} color={Colors.posDEF} />
                </View>
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle}>Edit Squad</Text>
                  <Text style={styles.cardDesc}>
                    Rebuild your squad from scratch. Pick new players within your budget.
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.textDim} />
              </View>
            </GlassCard>
          </AnimatedPressable>
        </Link>

        <Link href={'/(tabs)/squad/ai-transfers' as any} asChild>
          <AnimatedPressable>
            <GlassCard variant="ai">
              <View style={styles.cardRow}>
                <View style={[styles.cardIconWrap, { backgroundColor: 'rgba(129,199,132,0.12)' }]}>
                  <Ionicons name="sparkles" size={24} color={Colors.success} />
                </View>
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle}>AI Transfer Advisor</Text>
                  <Text style={styles.cardDesc}>
                    Get AI-powered transfer suggestions based on form, fixtures, and budget.
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.textDim} />
              </View>
            </GlassCard>
          </AnimatedPressable>
        </Link>
      </View>

      {/* Wildcard info */}
      {!squad.wildcard_used && (
        <GlassCard variant="gold" style={styles.wildcardBanner}>
          <View style={styles.wildcardRow}>
            <Ionicons name="flash" size={18} color={Colors.accent} />
            <Text style={styles.wildcardText}>
              Wildcard available — unlimited free transfers for one round
            </Text>
          </View>
        </GlassCard>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingBottom: 100 },
  center: { flex: 1, backgroundColor: Colors.bg, justifyContent: 'center', alignItems: 'center', padding: 32 },

  errorText: { color: Colors.error, fontSize: 16, marginBottom: 16, textAlign: 'center', padding: 16 },

  welcomeTitle: { fontSize: 24, fontWeight: 'bold', color: Colors.textPrimary, marginTop: 20, marginBottom: 12 },
  welcomeSubtitle: { fontSize: 15, color: Colors.textMuted, textAlign: 'center', marginBottom: 28, lineHeight: 22 },

  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.md },
  statsRow: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.lg, marginBottom: Spacing.xl },

  cards: { paddingHorizontal: Spacing.lg, gap: Spacing.md },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  cardIconWrap: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: 'bold', color: Colors.textPrimary, marginBottom: 4 },
  cardDesc: { fontSize: 12, color: Colors.textMuted, lineHeight: 18 },

  wildcardBanner: { marginHorizontal: Spacing.lg, marginTop: Spacing.xl },
  wildcardRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  wildcardText: { flex: 1, color: Colors.accent, fontSize: 13 },
});
