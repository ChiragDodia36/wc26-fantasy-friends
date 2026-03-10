import { Stack } from 'expo-router';
import { Colors } from '@/theme/constants';

export default function SquadStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.bg },
        headerTintColor: Colors.accent,
        contentStyle: { backgroundColor: Colors.bg },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Squad' }} />
      <Stack.Screen name="edit" options={{ title: 'Edit Squad' }} />
      <Stack.Screen name="lineup" options={{ title: 'Set Lineup' }} />
      <Stack.Screen name="transfers" options={{ title: 'Transfers' }} />
    </Stack>
  );
}
