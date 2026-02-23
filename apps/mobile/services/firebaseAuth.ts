/**
 * Firebase Auth wrappers — stubbed for Expo Go compatibility.
 *
 * Native Firebase (@react-native-firebase) requires a dev build.
 * In Expo Go, use the "Dev Mode (Skip Login)" button instead.
 * These stubs prevent import errors while keeping the API surface.
 */

// No-op in Expo Go — configure once you have a dev build
export function configureGoogleSignIn() {
  // Requires @react-native-google-signin/google-signin (dev build only)
}

export async function signUpWithEmail(_email: string, _password: string): Promise<string> {
  throw new Error('Firebase Auth requires a dev build. Use "Dev Mode (Skip Login)" in Expo Go.');
}

export async function signInWithEmail(_email: string, _password: string): Promise<string> {
  throw new Error('Firebase Auth requires a dev build. Use "Dev Mode (Skip Login)" in Expo Go.');
}

export async function signInWithGoogle(): Promise<string> {
  throw new Error('Google Sign-In requires a dev build. Use "Dev Mode (Skip Login)" in Expo Go.');
}

export async function signOut(): Promise<void> {
  // No-op — dev mode clears token via storage
}
