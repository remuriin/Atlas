// Works out WHO is making a request by checking the Firebase ID token
// sent in the "Authorization: Bearer <token>" header.
const firebase = require('../config/firebase');
const usersModel = require('../models/usersModel');
const createHttpError = require('../utils/httpError');

const readBearerToken = (req) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return null;
  }
  const token = header.slice('Bearer '.length).trim();
  if (token === '') {
    return null;
  }
  return token;
};

// Picks a starting display name for a brand new user.
const chooseDisplayName = (decodedToken) => {
  let name = decodedToken.name || '';
  if (name.trim() === '' && decodedToken.email) {
    name = decodedToken.email.split('@')[0];
  }
  name = name.trim().slice(0, 50);
  if (name.length < 2) {
    name = 'New member';
  }
  return name;
};

// The "upsert" is done in plain JavaScript: look the user up first, add them only if missing.
// (createUser is safe when two requests from a new user arrive together.)
const findOrCreateUser = async (decodedToken) => {
  const existingUser = await usersModel.findUserByFirebaseUid(decodedToken.uid);
  if (existingUser) {
    return existingUser;
  }

  const newUser = await usersModel.createUser(
    decodedToken.uid,
    chooseDisplayName(decodedToken),
    decodedToken.email || ''
  );
  return newUser;
};

// For routes that need a logged-in user. Replies 401 when the token is missing or bad.
const requireAuth = async (req, res, next) => {
  const token = readBearerToken(req);
  if (!token) {
    next(createHttpError(401, 'Please log in to do that.'));
    return;
  }

  let decodedToken;
  try {
    decodedToken = await firebase.verifyIdToken(token);
  } catch (err) {
    next(createHttpError(401, 'Your session has expired. Please log in again.'));
    return;
  }

  try {
    req.user = await findOrCreateUser(decodedToken);
    next();
  } catch (err) {
    next(err);
  }
};

// For public routes. A valid token adds req.user; anything else is treated as a
// visitor, so an expired login never stops someone from simply browsing.
const optionalAuth = async (req, res, next) => {
  req.user = null;
  const token = readBearerToken(req);
  if (!token) {
    next();
    return;
  }

  let decodedToken;
  try {
    decodedToken = await firebase.verifyIdToken(token);
  } catch (err) {
    next();
    return;
  }

  try {
    req.user = await findOrCreateUser(decodedToken);
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = {
  requireAuth: requireAuth,
  optionalAuth: optionalAuth,
};
