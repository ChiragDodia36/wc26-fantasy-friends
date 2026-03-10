import { Stack } from 'expo-router';
import { Colors } from '@/theme/constants';

export default function MySquadStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.bg },
        headerTintColor: Colors.accent,
        contentStyle: { backgroundColor: Colors.bg },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'My Squad' }} />
    </Stack>
  );
}
