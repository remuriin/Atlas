// Connects to the three Firebase services the API uses:
//   Authentication  checks that a login token is genuine
//   Firestore       the database (it replaced Postgres)
//   Cloud Storage   the uploaded study reviewer files
// Inside Cloud Functions, and inside the local emulator, firebase-admin finds the
// project and its permissions by itself, so no key file is stored anywhere.
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const env = require('./env');

const firebaseApp = initializeApp();

const db = getFirestore(firebaseApp);

// The bucket that holds the uploaded files. It is looked up on first use, because
// while Firebase is only reading this code to deploy it, no bucket is known yet.
// An empty STORAGE_BUCKET setting means "use the project's default bucket".
const getBucket = () => {
  if (env.storageBucket !== '') {
    return getStorage(firebaseApp).bucket(env.storageBucket);
  }
  return getStorage(firebaseApp).bucket();
};

// Checks a Firebase ID token. Resolves with the decoded token, or throws if it is not valid.
const verifyIdToken = (token) => {
  return getAuth(firebaseApp).verifyIdToken(token);
};

module.exports = {
  db: db,
  getBucket: getBucket,
  verifyIdToken: verifyIdToken,
};
