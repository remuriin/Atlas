// All SQL for the "users" table lives in this file.
const pool = require('../config/db');

const findUserByFirebaseUid = async (firebaseUid) => {
  // Find the user that belongs to a Firebase account.
  const result = await pool.query(
    'SELECT id, firebase_uid, display_name, email, created_at FROM users WHERE firebase_uid = $1',
    [firebaseUid]
  );
  return result.rows[0] || null;
};

const createUser = async (firebaseUid, displayName, email) => {
  // Add a new user row and return it.
  const result = await pool.query(
    `INSERT INTO users (firebase_uid, display_name, email)
     VALUES ($1, $2, $3)
     RETURNING id, firebase_uid, display_name, email, created_at`,
    [firebaseUid, displayName, email]
  );
  return result.rows[0];
};

const updateUserDisplayName = async (userId, displayName) => {
  // Change a user's display name and return the updated row.
  const result = await pool.query(
    `UPDATE users SET display_name = $1 WHERE id = $2
     RETURNING id, firebase_uid, display_name, email, created_at`,
    [displayName, userId]
  );
  return result.rows[0] || null;
};

module.exports = {
  findUserByFirebaseUid: findUserByFirebaseUid,
  createUser: createUser,
  updateUserDisplayName: updateUserDisplayName,
};
