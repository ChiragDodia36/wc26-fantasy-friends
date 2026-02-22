/**
 * My Squad tab — placeholder for Step 6.
 * Shows a basic screen so the tab navigator renders without errors.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';

export default function SquadScreen() {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Squad</Text>
      <Text style={styles.subtitle}>Squad view coming in Step 6</Text>

      <Pressable
        style={styles.logoutButton}
        onPress={async () => {
          await logout();
        }}
      >
        <Text style={styles.logoutText}>Sign Out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E1A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#8888AA',
    marginBottom: 48,
  },
  logoutButton: {
    borderWidth: 1,
    borderColor: '#FF4444',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  logoutText: {
    color: '#FF4444',
    fontSize: 16,
  },
});
