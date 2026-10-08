// firebase-admin is used for ONE thing: checking that a login token is genuine.
// Passwords and accounts live in Firebase Authentication, never in our database.
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const env = require('./env');

// Only the project id is needed to verify ID tokens (Google's public keys do the rest),
// so no service-account key file has to be stored on the server.
const firebaseApp = initializeApp({ projectId: env.firebaseProjectId });

// Checks a Firebase ID token. Resolves with the decoded token, or throws if it is not valid.
const verifyIdToken = (token) => {
  return getAuth(firebaseApp).verifyIdToken(token);
};

module.exports = {
  verifyIdToken: verifyIdToken,
};
