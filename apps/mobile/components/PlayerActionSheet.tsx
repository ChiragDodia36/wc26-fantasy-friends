/**
 * PlayerActionSheet — bottom modal for player actions (captain, VC, sub out).
 * Glassmorphism overlay with animated action rows.
 */
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { PitchPlayer } from './PitchView';
import { AnimatedPressable } from './ui/AnimatedPressable';
import { Colors, Radius, Spacing } from '@/theme/constants';

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
  player, visible, isStarter, onClose, onSetCaptain, onSetViceCaptain, onSubOut,
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
                <AnimatedPressable
                  style={styles.actionBtn}
                  onPress={() => { onSetCaptain(player.id); onClose(); }}
                >
                  <View style={[styles.iconCircle, { backgroundColor: Colors.accent }]}>
                    <Text style={styles.iconText}>C</Text>
                  </View>
                  <Text style={styles.actionText}>Set as Captain</Text>
                </AnimatedPressable>
              )}

              {!player.isViceCaptain && (
                <AnimatedPressable
                  style={styles.actionBtn}
                  onPress={() => { onSetViceCaptain(player.id); onClose(); }}
                >
                  <View style={[styles.iconCircle, { backgroundColor: Colors.success }]}>
                    <Text style={styles.iconText}>V</Text>
                  </View>
                  <Text style={styles.actionText}>Set as Vice-Captain</Text>
                </AnimatedPressable>
              )}

              <AnimatedPressable
                style={styles.actionBtn}
                onPress={() => { onSubOut(player.id); onClose(); }}
              >
                <View style={[styles.iconCircle, { backgroundColor: Colors.live }]}>
                  <Text style={styles.iconText}>↓</Text>
                </View>
                <Text style={styles.actionText}>Sub Out (tap a bench player)</Text>
              </AnimatedPressable>
            </>
          )}

          {!isStarter && (
            <AnimatedPressable
              style={styles.actionBtn}
              onPress={() => { onSubOut(player.id); onClose(); }}
            >
              <View style={[styles.iconCircle, { backgroundColor: Colors.posDEF }]}>
                <Text style={styles.iconText}>↑</Text>
              </View>
              <Text style={styles.actionText}>Sub In (tap a starter to swap)</Text>
            </AnimatedPressable>
          )}

          <AnimatedPressable style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </AnimatedPressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.bgOverlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.bgCardSolid,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.xl,
    paddingBottom: 36,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderBottomWidth: 0,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center', marginBottom: Spacing.lg,
  },
  name: {
    fontSize: 18, fontWeight: 'bold', color: Colors.textPrimary, textAlign: 'center',
  },
  meta: {
    fontSize: 13, color: Colors.textMuted, textAlign: 'center', marginBottom: 20,
  },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.md, padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: Colors.glassBorder,
  },
  iconCircle: {
    width: 32, height: 32, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  iconText: { fontSize: 14, fontWeight: 'bold', color: Colors.bg },
  actionText: { fontSize: 15, color: Colors.textPrimary, fontWeight: '500' },
  cancelBtn: { marginTop: 8, padding: 14, alignItems: 'center' },
  cancelText: { fontSize: 15, color: Colors.textMuted, fontWeight: '600' },
});
