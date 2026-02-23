/**
 * PlayerPicker — searchable/filterable player list using FlashList for performance.
 * Used in Edit Squad and Transfers screens.
 */
import { useState } from 'react';
import { FlashList } from '@shopify/flash-list';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { Player } from '@/types/api';

interface PlayerPickerProps {
  players: Player[];
  selectedIds?: Set<string>;
  onSelect: (player: Player) => void;
  disabled?: (player: Player) => boolean;
}

const POSITIONS = ['ALL', 'GK', 'DEF', 'MID', 'FWD'];
const POSITION_COLOR: Record<string, string> = {
  GK: '#FFD700', DEF: '#4FC3F7', MID: '#81C784', FWD: '#EF9A9A',
};

export function PlayerPicker({ players, selectedIds, onSelect, disabled }: PlayerPickerProps) {
  const [search, setSearch] = useState('');
  const [posFilter, setPosFilter] = useState('ALL');

  const filtered = players.filter(
    (p) =>
      (posFilter === 'ALL' || p.position === posFilter) &&
      p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.search}
        placeholder="Search players..."
        placeholderTextColor="#8888AA"
        value={search}
        onChangeText={setSearch}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {POSITIONS.map((pos) => (
          <Pressable
            key={pos}
            style={[styles.filterBtn, posFilter === pos && styles.filterBtnActive]}
            onPress={() => setPosFilter(pos)}
          >
            <Text style={[styles.filterText, posFilter === pos && styles.filterTextActive]}>
              {pos}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <FlashList
        data={filtered}
        estimatedItemSize={60}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const isSelected = selectedIds?.has(item.id);
          const isDisabled = disabled?.(item) ?? false;

          return (
            <Pressable
              style={[
                styles.row,
                isSelected && styles.rowSelected,
                isDisabled && styles.rowDisabled,
              ]}
              onPress={() => !isDisabled && onSelect(item)}
              disabled={isDisabled}
            >
              <View
                style={[
                  styles.posBadge,
                  { backgroundColor: POSITION_COLOR[item.position] ?? '#555577' },
                ]}
              >
                <Text style={styles.posText}>{item.position}</Text>
              </View>
              <View style={styles.info}>
                <Text style={[styles.name, isDisabled && styles.nameDisabled]}>{item.name}</Text>
                <Text style={styles.price}>£{Number(item.price).toFixed(1)}m</Text>
              </View>
              {isSelected && <Text style={styles.checkmark}>✓</Text>}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  search: {
    backgroundColor: '#1E2333',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#2E3550',
    margin: 16,
  },
  filterRow: { paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  filterBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2E3550',
  },
  filterBtnActive: { backgroundColor: '#FFD700', borderColor: '#FFD700' },
  filterText: { color: '#AAAACC', fontSize: 13, fontWeight: '600' },
  filterTextActive: { color: '#0A0E1A' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E2333',
  },
  rowSelected: { backgroundColor: '#0A1A2A' },
  rowDisabled: { opacity: 0.4 },
  posBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  posText: { fontSize: 10, fontWeight: 'bold', color: '#0A0E1A' },
  info: { flex: 1 },
  name: { fontSize: 15, color: '#FFFFFF', fontWeight: '600' },
  nameDisabled: { color: '#555577' },
  price: { fontSize: 12, color: '#8888AA', marginTop: 2 },
  checkmark: { color: '#FFD700', fontSize: 18, fontWeight: 'bold' },
});
