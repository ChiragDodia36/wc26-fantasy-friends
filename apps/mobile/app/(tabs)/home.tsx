/**
 * Home tab — dashboard combining squad summary, deadline countdown,
 * action items, live matches, news, and league standings.
 * Glassmorphism UI with gradient cards and micro-animations.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useHomeStore } from '@/store/homeStore';
import type { MatchSnippet, PlayerFixture, LeagueSnippet, NewsItem } from '@/store/homeStore';
import { GlassCard } from '@/components/ui/GlassCard';
import { GradientButton } from '@/components/ui/GradientButton';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { StatChip } from '@/components/ui/StatChip';
import { Colors, Gradients, POS_COLORS, Spacing, Radius, Typography } from '@/theme/constants';

// ── Countdown helper ──
function useCountdown(targetIso: string | undefined) {
  const [remaining, setRemaining] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!targetIso) { setRemaining(''); return; }
    const update = () => {
      const diff = new Date(targetIso).getTime() - Date.now();
      if (diff <= 0) { setRemaining('Deadline passed'); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`);
    };
    update();
    intervalRef.current = setInterval(update, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [targetIso]);
  return remaining;
}

const TOURNAMENT_START = '2026-06-11T00:00:00Z';

function useTournamentCountdown() {
  const [text, setText] = useState('');
  useEffect(() => {
    const update = () => {
      const diff = new Date(TOURNAMENT_START).getTime() - Date.now();
      if (diff <= 0) { setText('Tournament underway!'); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      setText(`${d} days, ${h} hours`);
    };
    update();
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, []);
  return text;
}

// ── Main screen ──
export default function HomeScreen() {
  const { dashboard, news, loading, loadAll } = useHomeStore();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }, [loadAll]);
  useEffect(() => { loadAll(); }, [loadAll]);

  const countdown = useCountdown(dashboard?.deadline?.deadline_utc);
  const tournamentCountdown = useTournamentCountdown();

  if (loading && !dashboard) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.accent} size="large" />
      </View>
    );
  }

  const hasSquad = !!dashboard?.squad_summary;

  // ── No squad — Welcome state ──
  if (!hasSquad) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
      >
        <View style={styles.welcomeHeader}>
          <Text style={styles.wcBadge}>FIFA World Cup 2026</Text>
          <Text style={Typography.hero}>Fantasy Friends</Text>
          <Text style={styles.welcomeSubtext}>Tournament starts June 11, 2026</Text>
          <Text style={styles.countdownLarge}>{tournamentCountdown}</Text>
        </View>

        <Link href="/(tabs)/squad/edit" asChild>
          <AnimatedPressable>
            <GlassCard variant="gold" style={styles.ctaCard}>
              <Text style={styles.ctaEmoji}>⚽</Text>
              <Text style={styles.ctaTitle}>Create Your Squad</Text>
              <Text style={styles.ctaDesc}>Pick 15 players · £100m budget</Text>
              <GradientButton>Get Started</GradientButton>
            </GlassCard>
          </AnimatedPressable>
        </Link>

        <View style={styles.quickActions}>
          <Link href="/(tabs)/leagues" asChild>
            <AnimatedPressable style={{ flex: 1 }}>
              <GlassCard style={styles.quickCard}>
                <Ionicons name="trophy" size={24} color={Colors.accent} />
                <Text style={styles.quickLabel}>Join a League</Text>
              </GlassCard>
            </AnimatedPressable>
          </Link>
          <Link href="/(tabs)/squad/transfers" asChild>
            <AnimatedPressable style={{ flex: 1 }}>
              <GlassCard style={styles.quickCard}>
                <Ionicons name="people" size={24} color={Colors.posDEF} />
                <Text style={styles.quickLabel}>Browse Players</Text>
              </GlassCard>
            </AnimatedPressable>
          </Link>
          <Link href="/(tabs)/matches" asChild>
            <AnimatedPressable style={{ flex: 1 }}>
              <GlassCard style={styles.quickCard}>
                <Ionicons name="calendar" size={24} color={Colors.posMID} />
                <Text style={styles.quickLabel}>WC Schedule</Text>
              </GlassCard>
            </AnimatedPressable>
          </Link>
        </View>

        <NewsSection news={news} />
        <UpcomingMatchesSection matches={dashboard?.upcoming_matches ?? []} />
      </ScrollView>
    );
  }

  // ── With squad — Full dashboard ──
  const sq = dashboard!.squad_summary!;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
    >
      {/* Welcome header */}
      <View style={styles.dashHeader}>
        <Text style={Typography.screenTitle}>{sq.team_name || 'My Team'}</Text>
        <LinearGradient colors={Gradients.goldCta} style={styles.pointsBadge}>
          <Text style={styles.pointsBadgeText}>{sq.total_points} pts</Text>
        </LinearGradient>
      </View>

      {/* Deadline countdown */}
      {dashboard?.deadline && (
        <GlassCard variant="gold" style={styles.deadlineCard}>
          <View style={styles.deadlineRow}>
            <View>
              <Text style={styles.deadlineLabel}>DEADLINE</Text>
              <Text style={styles.deadlineRound}>{dashboard.deadline.round_name}</Text>
            </View>
            <Text style={styles.deadlineTime}>{countdown}</Text>
          </View>
        </GlassCard>
      )}

      {/* Squad summary */}
      <GlassCard variant="elevated" style={styles.sectionCard}>
        <Text style={Typography.sectionLabel}>SQUAD SUMMARY</Text>
        <View style={styles.summaryRow}>
          <StatChip label="Formation" value={sq.formation} variant="blue" />
          <StatChip label="Captain" value={sq.captain_name?.split(' ').pop() ?? '—'} variant="gold" />
          <StatChip label="Players" value={`${sq.player_count}/15`} variant="green" />
        </View>
        <Link href="/(tabs)/squad" asChild>
          <Pressable style={styles.linkBtn}>
            <Text style={styles.linkBtnText}>View Squad →</Text>
          </Pressable>
        </Link>
      </GlassCard>

      {/* Action items */}
      {dashboard!.action_items.length > 0 && (
        <GlassCard style={styles.sectionCard}>
          <Text style={Typography.sectionLabel}>ACTION ITEMS</Text>
          {dashboard!.action_items.map((item, i) => (
            <View key={i} style={styles.actionItem}>
              <View style={styles.actionDot} />
              <Text style={styles.actionText}>{item}</Text>
            </View>
          ))}
        </GlassCard>
      )}

      {/* Live matches */}
      {dashboard!.live_matches.length > 0 && (
        <GlassCard variant="live" style={styles.sectionCard}>
          <Text style={[Typography.sectionLabel, { color: Colors.live }]}>LIVE MATCHES</Text>
          {dashboard!.live_matches.map((m) => <MatchCard key={m.id} match={m} />)}
        </GlassCard>
      )}

      <UpcomingMatchesSection matches={dashboard!.upcoming_matches} />
      <NewsSection news={news} />

      {/* My leagues */}
      {dashboard!.leagues.length > 0 && (
        <GlassCard style={styles.sectionCard}>
          <Text style={Typography.sectionLabel}>MY LEAGUES</Text>
          {dashboard!.leagues.map((lg) => <LeagueRow key={lg.league_id} league={lg} />)}
          <Link href="/(tabs)/leagues" asChild>
            <Pressable style={styles.linkBtn}>
              <Text style={styles.linkBtnText}>View Leagues →</Text>
            </Pressable>
          </Link>
        </GlassCard>
      )}

      {/* My players' next fixtures */}
      {dashboard!.my_fixtures.length > 0 && (
        <GlassCard style={styles.sectionCard}>
          <Text style={Typography.sectionLabel}>MY PLAYERS' FIXTURES</Text>
          {dashboard!.my_fixtures.slice(0, 6).map((f, i) => <FixtureRow key={i} fixture={f} />)}
        </GlassCard>
      )}
    </ScrollView>
  );
}

// ── Sub-components ──

function MatchCard({ match }: { match: MatchSnippet }) {
  const isLive = match.status === 'LIVE';
  return (
    <View style={[styles.matchCard, isLive && styles.matchCardLive]}>
      <View style={styles.matchTeams}>
        <Text style={styles.matchTeam} numberOfLines={1}>{match.home_team_name ?? 'TBD'}</Text>
        <View style={styles.matchScore}>
          {match.home_score != null ? (
            <Text style={styles.matchScoreText}>{match.home_score} - {match.away_score}</Text>
          ) : (
            <Text style={styles.matchTimeText}>
              {new Date(match.kickoff_utc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          )}
        </View>
        <Text style={[styles.matchTeam, { textAlign: 'right' }]} numberOfLines={1}>
          {match.away_team_name ?? 'TBD'}
        </Text>
      </View>
      {isLive && <Text style={styles.liveIndicator}>LIVE</Text>}
      {match.round_name && <Text style={styles.matchRound}>{match.round_name}</Text>}
    </View>
  );
}

function UpcomingMatchesSection({ matches }: { matches: MatchSnippet[] }) {
  if (matches.length === 0) return null;
  return (
    <GlassCard style={styles.sectionCard}>
      <Text style={Typography.sectionLabel}>UPCOMING MATCHES</Text>
      {matches.map((m) => <MatchCard key={m.id} match={m} />)}
      <Link href="/(tabs)/matches" asChild>
        <Pressable style={styles.linkBtn}>
          <Text style={styles.linkBtnText}>View All Matches →</Text>
        </Pressable>
      </Link>
    </GlassCard>
  );
}

function NewsSection({ news }: { news: NewsItem[] }) {
  if (news.length === 0) return null;
  return (
    <GlassCard style={styles.sectionCard}>
      <Text style={Typography.sectionLabel}>BREAKING NEWS</Text>
      {news.map((item, i) => (
        <View key={i} style={styles.newsItem}>
          <Text style={styles.newsTitle} numberOfLines={2}>{item.title}</Text>
          {item.description && <Text style={styles.newsDesc} numberOfLines={2}>{item.description}</Text>}
          <Text style={styles.newsSource}>{item.source}</Text>
        </View>
      ))}
    </GlassCard>
  );
}

function LeagueRow({ league }: { league: LeagueSnippet }) {
  return (
    <View style={styles.leagueRow}>
      <Text style={styles.leagueName} numberOfLines={1}>{league.league_name}</Text>
      <Text style={styles.leagueMeta}>
        {league.total_members} member{league.total_members !== 1 ? 's' : ''}
      </Text>
    </View>
  );
}

function FixtureRow({ fixture }: { fixture: PlayerFixture }) {
  return (
    <View style={styles.fixtureRow}>
      <View style={[styles.posChip, { backgroundColor: POS_COLORS[fixture.position] ?? Colors.textDim }]}>
        <Text style={styles.posChipText}>{fixture.position}</Text>
      </View>
      <View style={styles.fixtureInfo}>
        <Text style={styles.fixtureName} numberOfLines={1}>{fixture.player_name}</Text>
        <Text style={styles.fixtureOpponent}>
          {fixture.is_home ? 'vs' : '@'} {fixture.opponent}
        </Text>
      </View>
    </View>
  );
}

// ── Styles ──
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingBottom: 100 },
  center: { flex: 1, backgroundColor: Colors.bg, justifyContent: 'center', alignItems: 'center' },

  welcomeHeader: { alignItems: 'center', paddingTop: 40, paddingBottom: 24 },
  wcBadge: {
    fontSize: 12, fontWeight: 'bold', color: Colors.accent,
    textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4,
  },
  welcomeSubtext: { fontSize: 14, color: Colors.textMuted, marginTop: 8 },
  countdownLarge: { fontSize: 22, fontWeight: 'bold', color: Colors.accent, marginTop: 8 },

  ctaCard: { marginHorizontal: Spacing.lg, marginBottom: Spacing.lg, alignItems: 'center' },
  ctaEmoji: { fontSize: 36, marginBottom: 8 },
  ctaTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.textPrimary, marginBottom: 4 },
  ctaDesc: { fontSize: 14, color: Colors.textMuted, marginBottom: 16 },

  quickActions: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.lg, marginBottom: 20 },
  quickCard: { alignItems: 'center', paddingVertical: 16 },
  quickLabel: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary, textAlign: 'center', marginTop: 8 },

  dashHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.md,
  },
  pointsBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  pointsBadgeText: { fontSize: 14, fontWeight: 'bold', color: '#0B0D1F' },

  deadlineCard: { marginHorizontal: Spacing.lg, marginBottom: Spacing.md },
  deadlineRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  deadlineLabel: { fontSize: 10, fontWeight: 'bold', color: Colors.warning, letterSpacing: 1, marginBottom: 4 },
  deadlineRound: { fontSize: 14, color: Colors.textSecondary },
  deadlineTime: { fontSize: 22, fontWeight: 'bold', color: Colors.textPrimary },

  sectionCard: { marginHorizontal: Spacing.lg, marginBottom: Spacing.md },
  summaryRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md, marginBottom: Spacing.md },

  linkBtn: { alignSelf: 'flex-start', marginTop: 8 },
  linkBtnText: { color: Colors.accent, fontSize: 13, fontWeight: '600' },

  actionItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  actionDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.accent, marginRight: 10 },
  actionText: { color: Colors.textSecondary, fontSize: 13, flex: 1 },

  matchCard: {
    backgroundColor: 'rgba(22,20,50,0.6)', borderRadius: Radius.sm, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: Colors.glassBorder,
  },
  matchCardLive: { borderColor: Colors.live },
  matchTeams: { flexDirection: 'row', alignItems: 'center' },
  matchTeam: { flex: 1, fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  matchScore: { paddingHorizontal: 12 },
  matchScoreText: { fontSize: 16, fontWeight: 'bold', color: Colors.accent },
  matchTimeText: { fontSize: 13, color: Colors.textMuted },
  liveIndicator: { fontSize: 10, fontWeight: 'bold', color: Colors.live, textAlign: 'center', marginTop: 4 },
  matchRound: { fontSize: 10, color: Colors.textDim, textAlign: 'center', marginTop: 2 },

  newsItem: { borderBottomWidth: 1, borderBottomColor: Colors.glassBorder, paddingBottom: 10, marginBottom: 10 },
  newsTitle: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary, marginBottom: 4 },
  newsDesc: { fontSize: 12, color: Colors.textMuted, marginBottom: 4, lineHeight: 17 },
  newsSource: { fontSize: 10, color: Colors.textDim },

  leagueRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.glassBorder,
  },
  leagueName: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary, flex: 1 },
  leagueMeta: { fontSize: 12, color: Colors.textMuted },

  fixtureRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  posChip: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  posChipText: { fontSize: 9, fontWeight: 'bold', color: Colors.bg },
  fixtureInfo: { flex: 1 },
  fixtureName: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  fixtureOpponent: { fontSize: 11, color: Colors.textMuted },
});
