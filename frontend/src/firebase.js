// Sets up Firebase. The website uses Firebase for TWO things:
//   Authentication  sign up, log in, log out, password reset
//   Cloud Storage   putting an uploaded file in the user's own inbox folder
// Everything else goes through the LearnHub API.
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getStorage, connectStorageEmulator } from 'firebase/storage';

const isEmulatorEnabled = import.meta.env.VITE_USE_EMULATORS === 'true';

// These values identify the Firebase project. They are public, not secret.
// The emulator ignores the key, so a stand-in keeps local setup working
// before the real values have been filled in.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'emulator-api-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const storage = getStorage(app);

if (isEmulatorEnabled) {
  // Local development: accounts and files go to the emulators, never to the real project.
  // disableWarnings hides the banner the SDK would otherwise add to the bottom of the page.
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectStorageEmulator(storage, '127.0.0.1', 9199);
}
