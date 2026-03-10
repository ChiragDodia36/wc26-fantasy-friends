/**
 * More tab — links to AI Coach, Settings, About, and Logout.
 */
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { clearToken } from '@/services/storage';
import { useAuthStore } from '@/store/authStore';
import { Colors } from '@/theme/constants';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface MenuItemProps {
  icon: IconName;
  label: string;
  color?: string;
  onPress: () => void;
}

function MenuItem({ icon, label, color = '#FFFFFF', onPress }: MenuItemProps) {
  return (
    <Pressable style={styles.menuItem} onPress={onPress}>
      <Ionicons name={icon} size={22} color={color} style={styles.menuIcon} />
      <Text style={[styles.menuLabel, { color }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color="#555577" />
    </Pressable>
  );
}

export default function MoreScreen() {
  const router = useRouter();
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await clearToken();
          setAuthenticated(false);
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>More</Text>

      <View style={styles.section}>
        <MenuItem
          icon="bulb"
          label="AI Coach"
          onPress={() => router.push('/(tabs)/ai')}
        />
        <MenuItem
          icon="people"
          label="Browse Players"
          onPress={() => router.push('/(tabs)/squad/transfers')}
        />
      </View>

      <View style={styles.section}>
        <MenuItem
          icon="information-circle"
          label="About"
          onPress={() =>
            Alert.alert(
              'WC26 Fantasy Friends',
              'FIFA World Cup 2026 Fantasy Football.\nBuilt with Expo + FastAPI.\n\nVersion 0.1.0',
            )
          }
        />
      </View>

      <View style={styles.section}>
        <MenuItem icon="log-out" label="Log Out" color="#EF5350" onPress={handleLogout} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 20, paddingBottom: 40 },
  heading: { fontSize: 28, fontWeight: 'bold', color: Colors.accent, marginBottom: 24 },

  section: {
    backgroundColor: '#141824',
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1E2333',
    overflow: 'hidden',
  },

  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E2333',
  },
  menuIcon: { marginRight: 14 },
  menuLabel: { flex: 1, fontSize: 16, fontWeight: '500' },
});
