/**
 * FormationPicker — horizontal scrollable pill selector for formations.
 * Active state uses gold gradient pill with press animation.
 */
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AnimatedPressable } from './ui/AnimatedPressable';
import { Colors, Gradients, Radius, Spacing } from '@/theme/constants';

const FORMATIONS = ['4-4-2', '4-3-3', '3-4-3', '3-5-2', '4-5-1', '5-4-1', '5-3-2'];

interface FormationPickerProps {
  selected: string;
  onSelect: (formation: string) => void;
}

export function FormationPicker({ selected, onSelect }: FormationPickerProps) {
  return (
    <FlatList
      horizontal
      data={FORMATIONS}
      keyExtractor={(item) => item}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => {
        const isActive = item === selected;
        return (
          <AnimatedPressable scaleAmount={0.95} onPress={() => onSelect(item)}>
            {isActive ? (
              <LinearGradient
                colors={Gradients.pillActive }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.pill}
              >
                <Text style={styles.pillTextActive}>{item}</Text>
              </LinearGradient>
            ) : (
              <View style={[styles.pill, styles.pillInactive]}>
                <Text style={styles.pillText}>{item}</Text>
              </View>
            )}
          </AnimatedPressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: Spacing.lg, gap: Spacing.sm },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  pillInactive: {
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  pillText: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  pillTextActive: { fontSize: 13, fontWeight: '700', color: Colors.bg },
});
