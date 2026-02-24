/**
 * Home tab — dashboard combining squad summary, deadline countdown,
 * action items, live matches, news, and league standings.
 * Shows a welcome/onboarding state if the user has no squad.
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
import { useHomeStore } from '@/store/homeStore';
import type {
  MatchSnippet,
  PlayerFixture,
  LeagueSnippet,
  NewsItem,
} from '@/store/homeStore';

// ── Countdown helper ────────────────────────────────────────────────────────
function useCountdown(targetIso: string | undefined) {
  const [remaining, setRemaining] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!targetIso) {
      setRemaining('');
      return;
    }
    const update = () => {
      const diff = new Date(targetIso).getTime() - Date.now();
      if (diff <= 0) {
        setRemaining('Deadline passed');
        return;
      }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(
        d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`,
      );
    };
    update();
    intervalRef.current = setInterval(update, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [targetIso]);

  return remaining;
}

// ── Tournament start countdown ──────────────────────────────────────────────
const TOURNAMENT_START = '2026-06-11T00:00:00Z';

function useTournamentCountdown() {
  const [text, setText] = useState('');
  useEffect(() => {
    const update = () => {
      const diff = new Date(TOURNAMENT_START).getTime() - Date.now();
      if (diff <= 0) {
        setText('Tournament underway!');
        return;
      }
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

// ── Position colors ─────────────────────────────────────────────────────────
const POS_COLOR: Record<string, string> = {
  GK: '#FFD700',
  DEF: '#4FC3F7',
  MID: '#81C784',
  FWD: '#EF9A9A',
};

// ── Main screen ─────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const { dashboard, news, loading, loadAll } = useHomeStore();

  const onRefresh = useCallback(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const countdown = useCountdown(dashboard?.deadline?.deadline_utc);
  const tournamentCountdown = useTournamentCountdown();

  if (loading && !dashboard) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#FFD700" size="large" />
      </View>
    );
  }

  const hasSquad = !!dashboard?.squad_summary;

  // ── No squad — Welcome state ────────────────────────────────────────
  if (!hasSquad) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor="#FFD700" />}
      >
        <View style={styles.welcomeHeader}>
          <Text style={styles.wcBadge}>FIFA World Cup 2026</Text>
          <Text style={styles.appTitle}>Fantasy Friends</Text>
          <Text style={styles.welcomeSubtext}>
            Tournament starts June 11, 2026
          </Text>
          <Text style={styles.countdownLarge}>{tournamentCountdown}</Text>
        </View>

        <Link href="/(tabs)/squad/edit" asChild>
          <Pressable style={styles.ctaCard}>
            <Text style={styles.ctaEmoji}>⚽</Text>
            <Text style={styles.ctaTitle}>Create Your Squad</Text>
            <Text style={styles.ctaDesc}>Pick 15 players · £100m budget</Text>
            <Text style={styles.ctaArrow}>Get Started →</Text>
          </Pressable>
        </Link>

        <View style={styles.quickActions}>
          <Link href="/(tabs)/leagues" asChild>
            <Pressable style={styles.quickCard}>
              <Text style={styles.quickEmoji}>🏆</Text>
              <Text style={styles.quickLabel}>Join a League</Text>
            </Pressable>
          </Link>
          <Link href="/(tabs)/squad/transfers" asChild>
            <Pressable style={styles.quickCard}>
              <Text style={styles.quickEmoji}>👥</Text>
              <Text style={styles.quickLabel}>Browse Players</Text>
            </Pressable>
          </Link>
          <Link href="/(tabs)/matches" asChild>
            <Pressable style={styles.quickCard}>
              <Text style={styles.quickEmoji}>📅</Text>
              <Text style={styles.quickLabel}>WC Schedule</Text>
            </Pressable>
          </Link>
        </View>

        <NewsSection news={news} />
        <UpcomingMatchesSection matches={dashboard?.upcoming_matches ?? []} />
      </ScrollView>
    );
  }

  // ── With squad — Full dashboard ─────────────────────────────────────
  const sq = dashboard!.squad_summary!;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor="#FFD700" />}
    >
      {/* Welcome header */}
      <View style={styles.dashHeader}>
        <Text style={styles.teamNameLarge}>{sq.team_name || 'My Team'}</Text>
        <Text style={styles.pointsBadge}>{sq.total_points} pts</Text>
      </View>

      {/* Deadline countdown */}
      {dashboard?.deadline && (
        <View style={styles.deadlineCard}>
          <Text style={styles.deadlineLabel}>⏱ DEADLINE</Text>
          <Text style={styles.deadlineRound}>{dashboard.deadline.round_name}</Text>
          <Text style={styles.deadlineTime}>{countdown}</Text>
        </View>
      )}

      {/* Squad summary */}
      <View style={styles.squadSummaryCard}>
        <Text style={styles.sectionTitle}>📋 SQUAD SUMMARY</Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{sq.formation}</Text>
            <Text style={styles.summaryLabel}>Formation</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{sq.captain_name?.split(' ').pop() ?? '—'}</Text>
            <Text style={styles.summaryLabel}>Captain</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{sq.player_count}/15</Text>
            <Text style={styles.summaryLabel}>Players</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>£{sq.budget_remaining.toFixed(1)}m</Text>
            <Text style={styles.summaryLabel}>Budget</Text>
          </View>
        </View>
        <Link href="/(tabs)/squad" asChild>
          <Pressable style={styles.linkBtn}>
            <Text style={styles.linkBtnText}>View Squad →</Text>
          </Pressable>
        </Link>
      </View>

      {/* Action items */}
      {dashboard!.action_items.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>🎯 ACTION ITEMS</Text>
          {dashboard!.action_items.map((item, i) => (
            <View key={i} style={styles.actionItem}>
              <View style={styles.actionDot} />
              <Text style={styles.actionText}>{item}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Live matches */}
      {dashboard!.live_matches.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>🔴 LIVE MATCHES</Text>
          {dashboard!.live_matches.map((m) => (
            <MatchCard key={m.id} match={m} />
          ))}
        </View>
      )}

      {/* Upcoming matches */}
      <UpcomingMatchesSection matches={dashboard!.upcoming_matches} />

      {/* News */}
      <NewsSection news={news} />

      {/* My leagues */}
      {dashboard!.leagues.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>🏆 MY LEAGUES</Text>
          {dashboard!.leagues.map((lg) => (
            <LeagueRow key={lg.league_id} league={lg} />
          ))}
          <Link href="/(tabs)/leagues" asChild>
            <Pressable style={styles.linkBtn}>
              <Text style={styles.linkBtnText}>View Leagues →</Text>
            </Pressable>
          </Link>
        </View>
      )}

      {/* My players' next fixtures */}
      {dashboard!.my_fixtures.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>📅 MY PLAYERS' FIXTURES</Text>
          {dashboard!.my_fixtures.slice(0, 6).map((f, i) => (
            <FixtureRow key={i} fixture={f} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function MatchCard({ match }: { match: MatchSnippet }) {
  const isLive = match.status === 'LIVE';
  return (
    <View style={[styles.matchCard, isLive && styles.matchCardLive]}>
      <View style={styles.matchTeams}>
        <Text style={styles.matchTeam} numberOfLines={1}>{match.home_team_name ?? 'TBD'}</Text>
        <View style={styles.matchScore}>
          {match.home_score != null ? (
            <Text style={styles.matchScoreText}>
              {match.home_score} - {match.away_score}
            </Text>
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
      {match.round_name && (
        <Text style={styles.matchRound}>{match.round_name}</Text>
      )}
    </View>
  );
}

function UpcomingMatchesSection({ matches }: { matches: MatchSnippet[] }) {
  if (matches.length === 0) return null;
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>⚽ UPCOMING MATCHES</Text>
      {matches.map((m) => (
        <MatchCard key={m.id} match={m} />
      ))}
      <Link href="/(tabs)/matches" asChild>
        <Pressable style={styles.linkBtn}>
          <Text style={styles.linkBtnText}>View All Matches →</Text>
        </Pressable>
      </Link>
    </View>
  );
}

function NewsSection({ news }: { news: NewsItem[] }) {
  if (news.length === 0) return null;
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>📰 BREAKING NEWS</Text>
      {news.map((item, i) => (
        <View key={i} style={styles.newsItem}>
          <Text style={styles.newsTitle} numberOfLines={2}>{item.title}</Text>
          {item.description && (
            <Text style={styles.newsDesc} numberOfLines={2}>{item.description}</Text>
          )}
          <Text style={styles.newsSource}>{item.source}</Text>
        </View>
      ))}
    </View>
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
      <View style={[styles.posChip, { backgroundColor: POS_COLOR[fixture.position] ?? '#555577' }]}>
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

// ── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  content: { paddingBottom: 32 },
  center: { flex: 1, backgroundColor: '#0A0E1A', justifyContent: 'center', alignItems: 'center' },

  // Welcome state (no squad)
  welcomeHeader: { alignItems: 'center', paddingTop: 40, paddingBottom: 24 },
  wcBadge: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFD700',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 4,
  },
  appTitle: { fontSize: 32, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 8 },
  welcomeSubtext: { fontSize: 14, color: '#8888AA' },
  countdownLarge: { fontSize: 22, fontWeight: 'bold', color: '#FFD700', marginTop: 8 },

  ctaCard: {
    backgroundColor: '#141824',
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 16,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  ctaEmoji: { fontSize: 36, marginBottom: 8 },
  ctaTitle: { fontSize: 20, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 4 },
  ctaDesc: { fontSize: 14, color: '#8888AA', marginBottom: 12 },
  ctaArrow: { fontSize: 16, fontWeight: 'bold', color: '#FFD700' },

  quickActions: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 20 },
  quickCard: {
    flex: 1,
    backgroundColor: '#141824',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E2333',
  },
  quickEmoji: { fontSize: 24, marginBottom: 6 },
  quickLabel: { fontSize: 11, fontWeight: '600', color: '#AAAACC', textAlign: 'center' },

  // Dashboard state (with squad)
  dashHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  teamNameLarge: { fontSize: 24, fontWeight: 'bold', color: '#FFFFFF', flex: 1 },
  pointsBadge: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFD700',
    backgroundColor: '#1E2A4A',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    overflow: 'hidden',
  },

  deadlineCard: {
    backgroundColor: '#1E2333',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#FF6B35',
  },
  deadlineLabel: { fontSize: 10, fontWeight: 'bold', color: '#FF6B35', letterSpacing: 1, marginBottom: 4 },
  deadlineRound: { fontSize: 14, color: '#AAAACC', marginBottom: 4 },
  deadlineTime: { fontSize: 22, fontWeight: 'bold', color: '#FFFFFF' },

  squadSummaryCard: {
    backgroundColor: '#141824',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1E2333',
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  summaryItem: { alignItems: 'center', flex: 1 },
  summaryValue: { fontSize: 14, fontWeight: 'bold', color: '#FFD700', marginBottom: 2 },
  summaryLabel: { fontSize: 10, color: '#8888AA' },

  // Generic card
  card: {
    backgroundColor: '#141824',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1E2333',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#8888AA',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },

  linkBtn: { alignSelf: 'flex-start', marginTop: 8 },
  linkBtnText: { color: '#FFD700', fontSize: 13, fontWeight: '600' },

  // Action items
  actionItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  actionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFD700',
    marginRight: 10,
  },
  actionText: { color: '#CCCCDD', fontSize: 13, flex: 1 },

  // Matches
  matchCard: {
    backgroundColor: '#0A0E1A',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  matchCardLive: { borderWidth: 1, borderColor: '#EF5350' },
  matchTeams: { flexDirection: 'row', alignItems: 'center' },
  matchTeam: { flex: 1, fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
  matchScore: { paddingHorizontal: 12 },
  matchScoreText: { fontSize: 16, fontWeight: 'bold', color: '#FFD700' },
  matchTimeText: { fontSize: 13, color: '#8888AA' },
  liveIndicator: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#EF5350',
    textAlign: 'center',
    marginTop: 4,
  },
  matchRound: { fontSize: 10, color: '#555577', textAlign: 'center', marginTop: 2 },

  // News
  newsItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#1E2333',
    paddingBottom: 10,
    marginBottom: 10,
  },
  newsTitle: { fontSize: 14, fontWeight: '600', color: '#FFFFFF', marginBottom: 4 },
  newsDesc: { fontSize: 12, color: '#8888AA', marginBottom: 4, lineHeight: 17 },
  newsSource: { fontSize: 10, color: '#555577' },

  // Leagues
  leagueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1E2333',
  },
  leagueName: { fontSize: 14, fontWeight: '600', color: '#FFFFFF', flex: 1 },
  leagueMeta: { fontSize: 12, color: '#8888AA' },

  // Fixtures
  fixtureRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  posChip: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  posChipText: { fontSize: 9, fontWeight: 'bold', color: '#0A0E1A' },
  fixtureInfo: { flex: 1 },
  fixtureName: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
  fixtureOpponent: { fontSize: 11, color: '#8888AA' },
});
