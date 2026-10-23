// Sets up Firebase. Atlas uses Firebase for ONE thing only: Authentication
// (sign up, log in, log out, password reset). All other data lives in our own API.
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';

const isEmulatorEnabled = import.meta.env.VITE_USE_AUTH_EMULATOR === 'true';

// These values identify the Firebase project. They are public, not secret.
// The emulator ignores the key, so a stand-in keeps local setup working
// before the real values have been filled in.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'emulator-api-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

if (isEmulatorEnabled) {
  // Local development: accounts are created in the emulator, never in the real project.
  // disableWarnings hides the banner the SDK would otherwise add to the bottom of the page.
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
}
