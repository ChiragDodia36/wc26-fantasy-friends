/**
 * Leagues tab — shows user's leagues with standings preview.
 * Create new league or join via invite code.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLeagueStore } from '@/store/leagueStore';
import type { League } from '@/types/api';

export default function LeaguesScreen() {
  const { leagues, loading, error, fetchLeagues, createLeague, joinLeague } = useLeagueStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [leagueName, setLeagueName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchLeagues();
  }, []);

  const handleCreate = async () => {
    if (!leagueName.trim()) { Alert.alert('Error', 'Enter a league name.'); return; }
    setProcessing(true);
    try {
      await createLeague(leagueName.trim());
      setShowCreateModal(false);
      setLeagueName('');
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.detail ?? 'Failed to create league');
    } finally {
      setProcessing(false);
    }
  };

  const handleJoin = async () => {
    if (!inviteCode.trim()) { Alert.alert('Error', 'Enter an invite code.'); return; }
    setProcessing(true);
    try {
      await joinLeague(inviteCode.trim().toUpperCase());
      setShowJoinModal(false);
      setInviteCode('');
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.detail ?? 'Invalid invite code');
    } finally {
      setProcessing(false);
    }
  };

  const renderLeague = ({ item }: { item: League }) => (
    <Pressable style={styles.leagueCard}>
      <View style={styles.leagueCardLeft}>
        <Text style={styles.leagueName}>{item.name}</Text>
        <Text style={styles.leagueCode}>Code: {item.code}</Text>
      </View>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      {/* Action buttons */}
      <View style={styles.buttonRow}>
        <Pressable style={styles.actionBtn} onPress={() => setShowCreateModal(true)}>
          <Text style={styles.actionBtnText}>+ Create League</Text>
        </Pressable>
        <Pressable style={[styles.actionBtn, styles.actionBtnSecondary]} onPress={() => setShowJoinModal(true)}>
          <Text style={[styles.actionBtnText, styles.actionBtnSecondaryText]}>Join with Code</Text>
        </Pressable>
      </View>

      {loading && leagues.length === 0 ? (
        <View style={styles.center}><ActivityIndicator color="#FFD700" size="large" /></View>
      ) : leagues.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>No leagues yet</Text>
          <Text style={styles.emptySubtext}>Create one or join with an invite code</Text>
        </View>
      ) : (
        <FlatList
          data={leagues}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchLeagues} tintColor="#FFD700" />}
          renderItem={renderLeague}
        />
      )}

      {/* Create League Modal */}
      <Modal visible={showCreateModal} transparent animationType="slide">
        <View style={styles.modal}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Create League</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="League name"
              placeholderTextColor="#8888AA"
              value={leagueName}
              onChangeText={setLeagueName}
            />
            <Pressable style={styles.modalConfirm} onPress={handleCreate} disabled={processing}>
              {processing ? <ActivityIndicator color="#0A0E1A" /> : <Text style={styles.modalConfirmText}>Create</Text>}
            </Pressable>
            <Pressable style={styles.modalCancel} onPress={() => setShowCreateModal(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Join League Modal */}
      <Modal visible={showJoinModal} transparent animationType="slide">
        <View style={styles.modal}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Join League</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Invite code (e.g. ABC123)"
              placeholderTextColor="#8888AA"
              value={inviteCode}
              onChangeText={setInviteCode}
              autoCapitalize="characters"
            />
            <Pressable style={styles.modalConfirm} onPress={handleJoin} disabled={processing}>
              {processing ? <ActivityIndicator color="#0A0E1A" /> : <Text style={styles.modalConfirmText}>Join</Text>}
            </Pressable>
            <Pressable style={styles.modalCancel} onPress={() => setShowJoinModal(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  buttonRow: { flexDirection: 'row', gap: 10, padding: 16 },
  actionBtn: { flex: 1, backgroundColor: '#FFD700', borderRadius: 10, padding: 12, alignItems: 'center' },
  actionBtnSecondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#FFD700' },
  actionBtnText: { color: '#0A0E1A', fontWeight: 'bold', fontSize: 14 },
  actionBtnSecondaryText: { color: '#FFD700' },
  list: { padding: 16, gap: 10 },
  leagueCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#141824', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#2E3550' },
  leagueCardLeft: { flex: 1 },
  leagueName: { fontSize: 17, fontWeight: 'bold', color: '#FFFFFF' },
  leagueCode: { fontSize: 13, color: '#8888AA', marginTop: 4 },
  emptyText: { fontSize: 20, color: '#FFFFFF', fontWeight: 'bold', marginBottom: 8 },
  emptySubtext: { fontSize: 14, color: '#8888AA', textAlign: 'center' },
  modal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: '#141824', borderRadius: 16, padding: 24, gap: 12 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#FFD700' },
  modalInput: { backgroundColor: '#1E2333', borderRadius: 10, padding: 14, fontSize: 16, color: '#FFFFFF', borderWidth: 1, borderColor: '#2E3550' },
  modalConfirm: { backgroundColor: '#FFD700', borderRadius: 10, padding: 14, alignItems: 'center' },
  modalConfirmText: { color: '#0A0E1A', fontWeight: 'bold', fontSize: 16 },
  modalCancel: { padding: 12, alignItems: 'center' },
  modalCancelText: { color: '#8888AA', fontSize: 15 },
});
