// Everything that talks to Firebase Authentication.
// Pages call these functions and never import Firebase themselves.
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
} from 'firebase/auth';
import { auth } from '../firebase';
import { updateMyProfile } from './profileService';

// Where to go after a Google sign-in that had to leave the page (see below).
const RETURN_PATH_KEY = 'atlas-return-path';

// Creates the Firebase account, then saves the chosen display name in our API.
// Returns the saved Atlas profile.
export const register = async (displayName, email, password) => {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(credential.user, { displayName: displayName });
  const profile = await updateMyProfile(displayName);
  return profile;
};

export const login = async (email, password) => {
  await signInWithEmailAndPassword(auth, email, password);
};

// Signs in with a Google account in a small pop-up window. The Google account's
// name and profile picture come along with it. A new Google user gets an Atlas
// profile the same way as anyone else (on their first request to /api/me).
// returnPath: the page to come back to if the pop-up is blocked and the whole
// page has to go to Google instead.
export const loginWithGoogle = async (returnPath) => {
  const provider = new GoogleAuthProvider();
  // Always show the account chooser, so people with several Google accounts can pick one.
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    if (err.code !== 'auth/popup-blocked') {
      throw err;
    }
    // The browser blocked the pop-up: go to Google in this tab instead. The page
    // reloads afterwards, so the return path is remembered for that moment.
    try {
      window.sessionStorage.setItem(RETURN_PATH_KEY, returnPath || '/');
    } catch (storageErr) {
      // Storage can be blocked (private browsing); the home page is used then.
    }
    await signInWithRedirect(auth, provider);
  }
};

// The page to return to after a redirected Google sign-in ('' when there is none).
export const readReturnPath = () => {
  try {
    return window.sessionStorage.getItem(RETURN_PATH_KEY) || '';
  } catch (err) {
    return '';
  }
};

export const clearReturnPath = () => {
  try {
    window.sessionStorage.removeItem(RETURN_PATH_KEY);
  } catch (err) {
    // Nothing to clear if storage is blocked.
  }
};

export const logout = async () => {
  await signOut(auth);
};

export const sendPasswordReset = async (email) => {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (err) {
    // Saying "no account with that email" would tell strangers who has an account,
    // so a missing account is treated the same as success.
    if (err.code !== 'auth/user-not-found') {
      throw err;
    }
  }
};

// Turns Firebase's technical error codes into plain language.
export const describeAuthError = (err) => {
  const code = err.code || '';

  if (code === 'auth/email-already-in-use') {
    return 'An account with that email already exists. Try logging in instead.';
  }
  if (code === 'auth/invalid-email') {
    return 'That email address does not look right. Check it and try again.';
  }
  if (code === 'auth/weak-password') {
    return 'That password is too easy to guess. Use at least 8 characters.';
  }
  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found'
  ) {
    return 'The email or password is not correct.';
  }
  if (code === 'auth/user-disabled') {
    return 'This account has been turned off. Contact support for help.';
  }
  if (code === 'auth/too-many-requests') {
    return 'Too many attempts. Please wait a few minutes and try again.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Could not reach the login service. Check your internet connection and try again.';
  }
  // Google sign-in. Closing the pop-up on purpose is not an error worth showing.
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return '';
  }
  if (code === 'auth/operation-not-allowed') {
    return 'Google sign-in is not turned on yet. Use your email and password for now.';
  }
  if (code === 'auth/unauthorized-domain') {
    return 'Google sign-in is not allowed on this web address yet. Use your email and password for now.';
  }
  if (code === 'auth/account-exists-with-different-credential') {
    return 'An account with this email already exists. Log in with your email and password instead.';
  }
  // Errors from our own API already have a friendly message.
  if (code === '' && err.message) {
    return err.message;
  }
  return 'Something went wrong. Please try again.';
};
