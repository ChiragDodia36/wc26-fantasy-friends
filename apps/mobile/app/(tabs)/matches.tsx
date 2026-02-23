/**
 * Matches tab — group stage fixtures grouped by round,
 * showing real team names and kickoff dates.
 * Live scores auto-refresh every 30s.
 */
import { useCallback, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useMatchStore } from '@/store/matchStore';
import type { Match } from '@/types/api';

const STATUS_COLOR: Record<string, string> = {
  SCHEDULED: '#555577',
  LIVE: '#FF4444',
  FINISHED: '#81C784',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
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
    <View style={[styles.matchCard, isLive && styles.matchCardLive]}>
      {/* Date + time row */}
      <View style={styles.dateRow}>
        <Text style={styles.dateText}>{formatDate(match.kickoff_utc)}</Text>
        {isLive ? (
          <View style={styles.liveBadge}>
            <Text style={styles.liveText}>● LIVE</Text>
          </View>
        ) : isFinished ? (
          <Text style={[styles.statusLabel, { color: STATUS_COLOR.FINISHED }]}>FT</Text>
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
      {match.venue && (
        <Text style={styles.venue}>{match.venue}</Text>
      )}
    </View>
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

  const load = useCallback(async () => {
    await fetchMatches();
    await fetchLive();
  }, [fetchMatches, fetchLive]);

  useEffect(() => {
    load();
    pollRef.current = setInterval(() => { fetchLive(); }, 30_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [load, fetchLive]);

  // Merge live data into match list
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
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor="#FFD700" />}
      stickySectionHeadersEnabled={false}
      ListEmptyComponent={
        loading ? (
          <View style={styles.center}><ActivityIndicator color="#FFD700" size="large" /></View>
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
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  content: { paddingBottom: 24 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },

  // Section headers
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFD700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  // Match card
  matchCard: {
    backgroundColor: '#141824',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#2E3550',
  },
  matchCardLive: { borderColor: '#FF4444' },

  // Date row
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  dateText: { fontSize: 12, color: '#8888AA' },
  timeText: { fontSize: 12, color: '#8888AA' },
  statusLabel: { fontSize: 12, fontWeight: '700' },
  liveBadge: {
    backgroundColor: '#FF444422',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#FF4444',
  },
  liveText: { color: '#FF4444', fontSize: 11, fontWeight: 'bold' },

  // Teams row
  teamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  teamName: { flex: 1, fontSize: 15, color: '#FFFFFF', fontWeight: '600' },
  scoreBox: { flexDirection: 'row', alignItems: 'center', minWidth: 60, justifyContent: 'center' },
  score: { fontSize: 20, fontWeight: 'bold', color: '#FFFFFF', minWidth: 20, textAlign: 'center' },
  scoreLive: { color: '#FF4444' },
  scoreDash: { fontSize: 18, color: '#555577', marginHorizontal: 4 },
  vs: { fontSize: 14, color: '#555577', fontWeight: '600' },

  // Venue
  venue: { fontSize: 11, color: '#555577', marginTop: 6 },

  emptyText: { color: '#555577', fontSize: 16 },
});
