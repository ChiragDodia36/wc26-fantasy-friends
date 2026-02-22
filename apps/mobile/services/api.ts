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
