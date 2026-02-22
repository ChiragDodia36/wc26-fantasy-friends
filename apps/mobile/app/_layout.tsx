/**
 * Root layout — checks for a stored JWT on startup and redirects to the
 * correct route: /(auth)/login if unauthenticated, /(tabs)/squad if authenticated.
 *
 * This is the ONLY place auth-gating happens. All child layouts trust that
 * the root has already verified authentication.
 */
import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { configureGoogleSignIn } from '@/services/firebaseAuth';
import { getToken } from '@/services/storage';
import { useAuthStore } from '@/store/authStore';

configureGoogleSignIn();

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const { isAuthenticated, isLoading, setAuthenticated, setLoading } = useAuthStore();

  // On mount: check persisted token to restore session
  useEffect(() => {
    (async () => {
      const token = await getToken();
      setAuthenticated(!!token);
      setLoading(false);
    })();
  }, []);

  // Redirect based on auth state once loading is complete
  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)/squad');
    }
  }, [isAuthenticated, isLoading, segments]);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#0A0E1A' },
          headerTintColor: '#FFD700',
          headerTitleStyle: { fontWeight: 'bold' },
          contentStyle: { backgroundColor: '#0A0E1A' },
        }}
      >
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
