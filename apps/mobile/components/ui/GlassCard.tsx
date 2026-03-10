/**
 * GlassCard — semi-transparent card with gradient background and glass border.
 */
import { type ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Gradients, Radius, Shadows, Spacing } from '@/theme/constants';

type Variant = 'default' | 'elevated' | 'gold' | 'ai' | 'live' | 'error';

interface GlassCardProps {
  children: ReactNode;
  variant?: Variant;
  style?: ViewStyle;
  noPadding?: boolean;
}

const VARIANT_GRADIENTS: Record<Variant, [string, string]> = {
  default: Gradients.card,
  elevated: Gradients.cardElevated,
  gold: Gradients.cardGold,
  ai: Gradients.cardAi,
  live: Gradients.cardLive,
  error: Gradients.cardError,
};

const VARIANT_BORDERS: Partial<Record<Variant, string>> = {
  gold: 'rgba(255,215,0,0.15)',
  ai: Colors.aiBorder,
  live: 'rgba(255,68,68,0.2)',
  error: 'rgba(255,107,107,0.15)',
};

export function GlassCard({ children, variant = 'default', style, noPadding }: GlassCardProps) {
  const gradientColors = VARIANT_GRADIENTS[variant];
  const borderColor = VARIANT_BORDERS[variant] ?? Colors.glassBorder;

  return (
    <View
      style={[
        styles.outer,
        Shadows.card,
        { borderColor },
        style,
      ]}
    >
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.gradient, noPadding && { padding: 0 }]}
      >
        {children}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  gradient: {
    padding: Spacing.lg,
  },
});
