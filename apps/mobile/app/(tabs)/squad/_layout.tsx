import { Stack } from 'expo-router';

export default function SquadStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#0A0E1A' },
        headerTintColor: '#FFD700',
        contentStyle: { backgroundColor: '#0A0E1A' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'My Squad' }} />
      <Stack.Screen name="edit" options={{ title: 'Edit Squad' }} />
      <Stack.Screen name="lineup" options={{ title: 'Set Lineup' }} />
      <Stack.Screen name="transfers" options={{ title: 'Transfers' }} />
    </Stack>
  );
}
