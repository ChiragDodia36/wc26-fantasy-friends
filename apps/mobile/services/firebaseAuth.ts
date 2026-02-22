/**
 * Firebase Auth wrappers for Email/Password and Google Sign-In.
 *
 * Uses @react-native-firebase/auth (native SDK — supports iOS + Android).
 * After any successful sign-in, call exchangeForJwt() to swap the Firebase
 * ID token for our own backend JWT (stored in SecureStore).
 */
import auth from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { GOOGLE_WEB_CLIENT_ID } from '@/constants/firebase';
import api from './api';
import { setToken } from './storage';

// Configure Google Sign-In once (call at app startup)
export function configureGoogleSignIn() {
  GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
}

/**
 * Exchange a Firebase ID token for our backend JWT and persist it.
 * Returns the JWT string.
 */
async function exchangeForJwt(firebaseIdToken: string): Promise<string> {
  const response = await api.post<{ access_token: string }>('/auth/firebase', {
    id_token: firebaseIdToken,
  });
  const jwt = response.data.access_token;
  await setToken(jwt);
  return jwt;
}

// ── Email / Password ──────────────────────────────────────────────────────────

export async function signUpWithEmail(email: string, password: string): Promise<string> {
  const credential = await auth().createUserWithEmailAndPassword(email, password);
  const idToken = await credential.user.getIdToken();
  return exchangeForJwt(idToken);
}

export async function signInWithEmail(email: string, password: string): Promise<string> {
  const credential = await auth().signInWithEmailAndPassword(email, password);
  const idToken = await credential.user.getIdToken();
  return exchangeForJwt(idToken);
}

// ── Google Sign-In ────────────────────────────────────────────────────────────

export async function signInWithGoogle(): Promise<string> {
  await GoogleSignin.hasPlayServices();
  const { data } = await GoogleSignin.signIn();
  if (!data?.idToken) throw new Error('No ID token from Google');

  const googleCredential = auth.GoogleAuthProvider.credential(data.idToken);
  const credential = await auth().signInWithCredential(googleCredential);
  const idToken = await credential.user.getIdToken();
  return exchangeForJwt(idToken);
}

// ── Sign Out ──────────────────────────────────────────────────────────────────

export async function signOut(): Promise<void> {
  await auth().signOut();
  try {
    await GoogleSignin.signOut();
  } catch {
    // Not signed in via Google — ignore
  }
}
