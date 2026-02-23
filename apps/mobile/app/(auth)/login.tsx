/**
 * Login screen — Email/Password sign-in via backend API.
 * Google Sign-In requires a native dev build (not available in Expo Go).
 */
import { useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
} from 'react-native';
import { Link } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import api from '@/services/api';
import { setToken } from '@/services/storage';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);

  async function handleEmailLogin() {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { email, password });
      await setToken(res.data.access_token);
      setAuthenticated(true);
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? err?.message ?? 'Unknown error';
      Alert.alert('Login Failed', msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleDevLogin() {
    setLoading(true);
    try {
      const devEmail = 'dev@test.com';
      const devPass = 'devpass123';
      try {
        const loginRes = await api.post('/auth/login', { email: devEmail, password: devPass });
        await setToken(loginRes.data.access_token);
      } catch {
        await api.post('/auth/signup', { email: devEmail, username: 'DevUser', password: devPass });
        const loginRes = await api.post('/auth/login', { email: devEmail, password: devPass });
        await setToken(loginRes.data.access_token);
      }
      setAuthenticated(true);
    } catch (err: any) {
      Alert.alert('Dev Login Failed', err?.message ?? 'Is the backend running?');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.trophy}>🏆</Text>
        <Text style={styles.title}>WC26 Fantasy</Text>
        <Text style={styles.subtitle}>Friends League</Text>
      </View>

      {/* Email / Password form */}
      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#8888AA"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#8888AA"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <Pressable style={styles.primaryButton} onPress={handleEmailLogin} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#0A0E1A" />
          ) : (
            <Text style={styles.primaryButtonText}>Sign In</Text>
          )}
        </Pressable>

        <Link href="/(auth)/signup" asChild>
          <Pressable style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Create Account</Text>
          </Pressable>
        </Link>
      </View>

      {/* Dev mode bypass — remove before production */}
      {__DEV__ && (
        <Pressable style={styles.devButton} onPress={handleDevLogin} disabled={loading}>
          <Text style={styles.devButtonText}>Dev Mode (Skip Login)</Text>
        </Pressable>
      )}
    </View>
  );
}

const GOLD = '#FFD700';
const NAVY = '#0A0E1A';
const INPUT_BG = '#1E2333';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: NAVY,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  trophy: {
    fontSize: 64,
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: GOLD,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 16,
    color: '#8888AA',
    marginTop: 4,
  },
  form: {
    gap: 12,
  },
  input: {
    backgroundColor: INPUT_BG,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#2E3550',
  },
  primaryButton: {
    backgroundColor: GOLD,
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryButtonText: {
    color: NAVY,
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButton: {
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2E3550',
  },
  secondaryButtonText: {
    color: '#AAAACC',
    fontSize: 15,
  },
  devButton: {
    backgroundColor: '#2E3550',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 24,
    borderWidth: 1,
    borderColor: '#FF6B6B',
    borderStyle: 'dashed',
  },
  devButtonText: {
    color: '#FF6B6B',
    fontSize: 14,
    fontWeight: '600',
  },
});
