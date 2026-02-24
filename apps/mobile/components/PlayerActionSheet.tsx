/**
 * PlayerActionSheet — bottom modal for player actions (captain, VC, sub out).
 */
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { PitchPlayer } from './PitchView';

interface PlayerActionSheetProps {
  player: PitchPlayer | null;
  visible: boolean;
  isStarter: boolean;
  onClose: () => void;
  onSetCaptain: (playerId: string) => void;
  onSetViceCaptain: (playerId: string) => void;
  onSubOut: (playerId: string) => void;
}

export function PlayerActionSheet({
  player,
  visible,
  isStarter,
  onClose,
  onSetCaptain,
  onSetViceCaptain,
  onSubOut,
}: PlayerActionSheetProps) {
  if (!player) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          <View style={styles.handle} />

          <Text style={styles.name}>{player.name}</Text>
          <Text style={styles.meta}>
            {player.position} {player.price ? `· £${player.price.toFixed(1)}m` : ''}
          </Text>

          {isStarter && (
            <>
              {!player.isCaptain && (
                <Pressable
                  style={styles.actionBtn}
                  onPress={() => { onSetCaptain(player.id); onClose(); }}
                >
                  <View style={[styles.iconCircle, { backgroundColor: '#FFD700' }]}>
                    <Text style={styles.iconText}>C</Text>
                  </View>
                  <Text style={styles.actionText}>Set as Captain</Text>
                </Pressable>
              )}

              {!player.isViceCaptain && (
                <Pressable
                  style={styles.actionBtn}
                  onPress={() => { onSetViceCaptain(player.id); onClose(); }}
                >
                  <View style={[styles.iconCircle, { backgroundColor: '#81C784' }]}>
                    <Text style={styles.iconText}>V</Text>
                  </View>
                  <Text style={styles.actionText}>Set as Vice-Captain</Text>
                </Pressable>
              )}

              <Pressable
                style={styles.actionBtn}
                onPress={() => { onSubOut(player.id); onClose(); }}
              >
                <View style={[styles.iconCircle, { backgroundColor: '#EF5350' }]}>
                  <Text style={styles.iconText}>↓</Text>
                </View>
                <Text style={styles.actionText}>Sub Out (tap a bench player)</Text>
              </Pressable>
            </>
          )}

          {!isStarter && (
            <Pressable
              style={styles.actionBtn}
              onPress={() => { onSubOut(player.id); onClose(); }}
            >
              <View style={[styles.iconCircle, { backgroundColor: '#4FC3F7' }]}>
                <Text style={styles.iconText}>↑</Text>
              </View>
              <Text style={styles.actionText}>Sub In (tap a starter to swap)</Text>
            </Pressable>
          )}

          <Pressable style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#141824',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3A3A5C',
    alignSelf: 'center',
    marginBottom: 16,
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  meta: {
    fontSize: 13,
    color: '#8888AA',
    textAlign: 'center',
    marginBottom: 20,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E2333',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0A0E1A',
  },
  actionText: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  cancelBtn: {
    marginTop: 8,
    padding: 14,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 15,
    color: '#8888AA',
    fontWeight: '600',
  },
});
