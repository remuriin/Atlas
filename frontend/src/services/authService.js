// Everything that talks to Firebase Authentication.
// Pages call these functions and never import Firebase themselves.
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
} from 'firebase/auth';
import { auth } from '../firebase';
import { updateMyProfile } from './profileService';

// Creates the Firebase account, then saves the chosen display name in our API.
// Returns the saved LearnHub profile.
export const register = async (displayName, email, password) => {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(credential.user, { displayName: displayName });
  const profile = await updateMyProfile(displayName);
  return profile;
};

export const login = async (email, password) => {
  await signInWithEmailAndPassword(auth, email, password);
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
  // Errors from our own API already have a friendly message.
  if (code === '' && err.message) {
    return err.message;
  }
  return 'Something went wrong. Please try again.';
};
