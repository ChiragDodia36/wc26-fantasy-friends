/**
 * StatChip — compact stat display with gradient background.
 */
import { StyleSheet, Text, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Gradients, Radius, Spacing } from '@/theme/constants';

type ChipVariant = 'blue' | 'green' | 'gold';

interface StatChipProps {
  label: string;
  value: string;
  variant?: ChipVariant;
  style?: ViewStyle;
}

const CHIP_GRADIENTS: Record<ChipVariant, [string, string]> = {
  blue: Gradients.statBlue,
  green: Gradients.statGreen,
  gold: Gradients.statGold,
};

export function StatChip({ label, value, variant = 'gold', style }: StatChipProps) {
  return (
    <LinearGradient
      colors={CHIP_GRADIENTS[variant] }
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.chip, style]}
    >
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  chip: {
    flex: 1,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    alignItems: 'center',
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.accent,
  },
});
