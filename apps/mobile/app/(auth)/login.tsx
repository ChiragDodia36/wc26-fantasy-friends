/**
 * Login screen — Email/Password + Google Sign-In.
 * Apple Sign-In is shown only on iOS (App Store requirement).
 *
 * After successful sign-in the root layout's useEffect detects the
 * auth state change and redirects to /(tabs)/squad automatically.
 */
import { useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
} from 'react-native';
import { Link } from 'expo-router';
import { signInWithEmail, signInWithGoogle } from '@/services/firebaseAuth';
import { useAuthStore } from '@/store/authStore';

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
      await signInWithEmail(email, password);
      setAuthenticated(true);
    } catch (err: any) {
      Alert.alert('Login Failed', err?.message ?? 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setLoading(true);
    try {
      await signInWithGoogle();
      setAuthenticated(true);
    } catch (err: any) {
      if (err?.code !== 'SIGN_IN_CANCELLED') {
        Alert.alert('Google Sign-In Failed', err?.message ?? 'Unknown error');
      }
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

      {/* Divider */}
      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.dividerLine} />
      </View>

      {/* Social sign-in */}
      <Pressable style={styles.googleButton} onPress={handleGoogleLogin} disabled={loading}>
        <Text style={styles.googleButtonText}>Continue with Google</Text>
      </Pressable>
    </View>
  );
}

const GOLD = '#FFD700';
const NAVY = '#0A0E1A';
const CARD = '#141824';
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
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#2E3550',
  },
  dividerText: {
    color: '#8888AA',
    marginHorizontal: 12,
    fontSize: 14,
  },
  googleButton: {
    backgroundColor: CARD,
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2E3550',
  },
  googleButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
