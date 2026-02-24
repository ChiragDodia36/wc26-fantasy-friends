/**
 * FormationPicker — horizontal scrollable pill selector for formations.
 */
import { FlatList, Pressable, StyleSheet, Text } from 'react-native';

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
          <Pressable
            style={[styles.pill, isActive && styles.pillActive]}
            onPress={() => onSelect(item)}
          >
            <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
              {item}
            </Text>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 16, gap: 8 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1E2333',
    borderWidth: 1,
    borderColor: '#2E3550',
  },
  pillActive: {
    backgroundColor: '#FFD700',
    borderColor: '#FFD700',
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8888AA',
  },
  pillTextActive: {
    color: '#0A0E1A',
  },
});
