/**
 * AnimatedPressable — generic press-in scale wrapper with spring animation.
 */
import { type ReactNode, useRef } from 'react';
import { Animated, Pressable, type ViewStyle } from 'react-native';
import { Animation } from '@/theme/constants';

interface AnimatedPressableProps {
  children: ReactNode;
  scaleAmount?: number;
  style?: ViewStyle | ViewStyle[];
  onPress?: () => void;
  disabled?: boolean;
}

export function AnimatedPressable({
  children,
  scaleAmount = Animation.pressScale,
  style,
  onPress,
  disabled,
}: AnimatedPressableProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    Animated.spring(scale, {
      toValue: scaleAmount,
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

  return (
    <Pressable onPressIn={onPressIn} onPressOut={onPressOut} onPress={onPress} disabled={disabled}>
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
