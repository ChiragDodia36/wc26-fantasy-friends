/**
 * Matches tab — group stage fixtures grouped by round,
 * showing real team names and kickoff dates.
 * Glassmorphism UI with glass cards and press animations.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useMatchStore } from '@/store/matchStore';
import type { Match } from '@/types/api';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { Colors, Gradients, Radius, Spacing, Typography } from '@/theme/constants';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function MatchCard({ match }: { match: Match }) {
  const isLive = match.status === 'LIVE';
  const isFinished = match.status === 'FINISHED';
  const home = match.home_team_name ?? 'TBD';
  const away = match.away_team_name ?? 'TBD';

  return (
    <AnimatedPressable scaleAmount={0.98}>
      <View style={[styles.matchCard, isLive && styles.matchCardLive]}>
        {/* Date + time row */}
        <View style={styles.dateRow}>
          <Text style={styles.dateText}>{formatDate(match.kickoff_utc)}</Text>
          {isLive ? (
            <LinearGradient
              colors={['rgba(255,68,68,0.2)', 'rgba(255,68,68,0.08)']}
              style={styles.liveBadge}
            >
              <Text style={styles.liveText}>● LIVE</Text>
            </LinearGradient>
          ) : isFinished ? (
            <Text style={[styles.statusLabel, { color: Colors.success }]}>FT</Text>
          ) : (
            <Text style={styles.timeText}>{formatTime(match.kickoff_utc)}</Text>
          )}
        </View>

        {/* Teams + score */}
        <View style={styles.teamsRow}>
          <Text style={styles.teamName} numberOfLines={1}>{home}</Text>
          <View style={styles.scoreBox}>
            {isFinished || isLive ? (
              <>
                <Text style={[styles.score, isLive && styles.scoreLive]}>
                  {match.home_score ?? 0}
                </Text>
                <Text style={styles.scoreDash}>-</Text>
                <Text style={[styles.score, isLive && styles.scoreLive]}>
                  {match.away_score ?? 0}
                </Text>
              </>
            ) : (
              <Text style={styles.vs}>vs</Text>
            )}
          </View>
          <Text style={[styles.teamName, { textAlign: 'right' }]} numberOfLines={1}>{away}</Text>
        </View>

        {/* Venue */}
        {match.venue && <Text style={styles.venue}>{match.venue}</Text>}
      </View>
    </AnimatedPressable>
  );
}

interface Section {
  title: string;
  data: Match[];
}

function groupByRound(matches: Match[]): Section[] {
  const map = new Map<string, Match[]>();
  for (const m of matches) {
    const key = m.round_name ?? 'Unknown Round';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(m);
  }
  return Array.from(map.entries()).map(([title, data]) => ({ title, data }));
}

export default function MatchesScreen() {
  const { matches, liveMatches, loading, fetchMatches, fetchLive } = useMatchStore();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    await fetchMatches();
    await fetchLive();
  }, [fetchMatches, fetchLive]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  useEffect(() => {
    load();
    pollRef.current = setInterval(() => { fetchLive(); }, 30_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [load, fetchLive]);

  const allMatches = matches.map((m) => {
    const live = liveMatches.find((l) => l.id === m.id);
    return live ?? m;
  });

  const sections = groupByRound(allMatches);

  return (
    <SectionList
      style={styles.container}
      contentContainerStyle={styles.content}
      sections={sections}
      keyExtractor={(item) => item.id}
      renderSectionHeader={({ section }) => (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
        </View>
      )}
      renderItem={({ item }) => <MatchCard match={item} />}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
      stickySectionHeadersEnabled={false}
      ListEmptyComponent={
        loading ? (
          <View style={styles.center}><ActivityIndicator color={Colors.accent} size="large" /></View>
        ) : (
          <View style={styles.center}>
            <Text style={styles.emptyText}>No fixtures yet</Text>
          </View>
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingBottom: 100 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },

  sectionHeader: { paddingHorizontal: Spacing.lg, paddingTop: 20, paddingBottom: 8 },
  sectionTitle: {
    fontSize: 16, fontWeight: '700', color: Colors.accent,
    textTransform: 'uppercase', letterSpacing: 1,
  },

  matchCard: {
    backgroundColor: Colors.bgCard,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    borderRadius: Radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  matchCardLive: { borderColor: Colors.live },

  dateRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10,
  },
  dateText: { fontSize: 12, color: Colors.textMuted },
  timeText: { fontSize: 12, color: Colors.textMuted },
  statusLabel: { fontSize: 12, fontWeight: '700' },
  liveBadge: {
    borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2,
    borderWidth: 1, borderColor: Colors.live,
  },
  liveText: { color: Colors.live, fontSize: 11, fontWeight: 'bold' },

  teamsRow: { flexDirection: 'row', alignItems: 'center' },
  teamName: { flex: 1, fontSize: 15, color: Colors.textPrimary, fontWeight: '600' },
  scoreBox: { flexDirection: 'row', alignItems: 'center', minWidth: 60, justifyContent: 'center' },
  score: { fontSize: 22, fontWeight: 'bold', color: Colors.textPrimary, minWidth: 20, textAlign: 'center' },
  scoreLive: { color: Colors.live },
  scoreDash: { fontSize: 18, color: Colors.textDim, marginHorizontal: 4 },
  vs: { fontSize: 14, color: Colors.textDim, fontWeight: '600' },

  venue: { fontSize: 11, color: Colors.textDim, marginTop: 6 },
  emptyText: { color: Colors.textDim, fontSize: 16 },
});
