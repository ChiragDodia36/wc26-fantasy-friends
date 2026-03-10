/**
 * GradientButton — vibrant gradient CTA with press animation and glow.
 */
import { type ReactNode, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Animation, Colors, Gradients, Radius, Shadows } from '@/theme/constants';

type Variant = 'solid' | 'outline' | 'ghost';

interface GradientButtonProps {
  children: ReactNode;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  style?: ViewStyle;
  icon?: ReactNode;
}

export function GradientButton({
  children, onPress, variant = 'solid', disabled, style, icon,
}: GradientButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    Animated.spring(scale, {
      toValue: Animation.pressScale,
      damping: Animation.spring.damping,
      stiffness: Animation.spring.stiffness,
      useNativeDriver: true,
    }).start();
  };

  const onPressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      damping: Animation.spring.damping,
      stiffness: Animation.spring.stiffness,
      useNativeDriver: true,
    }).start();
  };

  if (variant === 'outline') {
    return (
      <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} disabled={disabled}>
        <Animated.View
          style={[styles.base, styles.outline, disabled && styles.disabled, { transform: [{ scale }] }, style]}
        >
          {icon}
          {typeof children === 'string' ? <Text style={styles.outlineText}>{children}</Text> : children}
        </Animated.View>
      </Pressable>
    );
  }

  if (variant === 'ghost') {
    return (
      <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} disabled={disabled}>
        <Animated.View
          style={[styles.base, disabled && styles.disabled, { transform: [{ scale }] }, style]}
        >
          {icon}
          {typeof children === 'string' ? <Text style={styles.ghostText}>{children}</Text> : children}
        </Animated.View>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} disabled={disabled}>
      <Animated.View style={[{ transform: [{ scale }] }, disabled && styles.disabled]}>
        <LinearGradient
          colors={Gradients.primaryCta}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.base, styles.solid, Shadows.glow, style]}
        >
          {icon}
          {typeof children === 'string' ? <Text style={styles.solidText}>{children}</Text> : children}
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: Radius.pill,
    paddingHorizontal: 24,
    gap: 8,
  },
  solid: {},
  solidText: { fontSize: 15, fontWeight: '700', color: '#0B0D1F' },
  outline: {
    borderWidth: 1.5,
    borderColor: Colors.accent,
    backgroundColor: 'rgba(0,212,255,0.06)',
  },
  outlineText: { fontSize: 14, fontWeight: '600', color: Colors.accent },
  ghostText: { fontSize: 14, fontWeight: '600', color: Colors.accent },
  disabled: { opacity: 0.5 },
});
