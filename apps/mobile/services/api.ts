/**
 * Axios singleton with automatic Bearer token injection.
 *
 * Base URL resolves automatically:
 *   - Android emulator:  http://10.0.2.2:8000
 *   - iOS simulator/web: http://localhost:8000
 *   - Override:          API_BASE_URL env var via Expo constants
 */
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import axios, { type InternalAxiosRequestConfig } from 'axios';
import { getToken } from './storage';

function resolveBaseUrl(): string {
  const override = Constants.expoConfig?.extra?.apiBaseUrl as string | undefined;
  if (override) return override;
  if (Platform.OS === 'android') return 'http://10.0.2.2:8000';

  // On a physical device via Expo Go, localhost won't reach the Mac.
  // Use the Expo dev server host IP (same machine running the backend).
  const debuggerHost = Constants.expoConfig?.hostUri ?? Constants.manifest2?.extra?.expoGo?.debuggerHost;
  if (debuggerHost) {
    const ip = debuggerHost.split(':')[0];
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
      return `http://${ip}:8000`;
    }
  }

  return 'http://localhost:8000';
}

const api = axios.create({
  baseURL: resolveBaseUrl(),
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

// Inject Bearer token from secure storage on every request
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
