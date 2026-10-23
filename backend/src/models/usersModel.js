// All database code for users lives in this file.
// Each user is one document in the "users" collection, named after their Firebase uid.
// Passwords are NOT stored here: Firebase Authentication owns them.
const { db } = require('../config/firebase');
const countersModel = require('./countersModel');
const modelHelpers = require('./modelHelpers');

const usersCollection = db.collection('users');

// Turns a user document into the row shape the rest of the API uses.
const toUserRow = (doc) => {
  const data = doc.data();
  return {
    id: data.id,
    firebase_uid: doc.id,
    display_name: data.displayName,
    email: data.email,
    created_at: modelHelpers.toDate(data.createdAt),
  };
};

const findUserByFirebaseUid = async (firebaseUid) => {
  // Find the user that belongs to a Firebase account.
  const doc = await usersCollection.doc(firebaseUid).get();
  if (!doc.exists) {
    return null;
  }
  return toUserRow(doc);
};

// Firestore's error code for "that document already exists".
const ALREADY_EXISTS = 6;

const createUser = async (firebaseUid, displayName, email) => {
  // Add a new user and return it. Two requests from a brand new user can arrive
  // together (for example loading the profile while saving the chosen name).
  // "create" never overwrites, so the second one simply finds the first one's user
  // instead of replacing a name that was saved in between.
  const ref = usersCollection.doc(firebaseUid);
  try {
    await db.runTransaction(async (transaction) => {
      const existing = await transaction.get(ref);
      if (existing.exists) {
        return;
      }
      const id = await countersModel.takeIds(transaction, 'users', 1);
      transaction.create(ref, {
        id: id,
        displayName: displayName,
        email: email,
        createdAt: new Date(),
      });
    });
  } catch (err) {
    if (err.code !== ALREADY_EXISTS) {
      throw err;
    }
  }
  return findUserByFirebaseUid(firebaseUid);
};

const updateUserDisplayName = async (firebaseUid, displayName) => {
  // Change a user's display name and return the updated user.
  await usersCollection.doc(firebaseUid).update({ displayName: displayName });
  return findUserByFirebaseUid(firebaseUid);
};

module.exports = {
  findUserByFirebaseUid: findUserByFirebaseUid,
  createUser: createUser,
  updateUserDisplayName: updateUserDisplayName,
};
