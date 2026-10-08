// All SQL for the "upvotes" table lives in this file.
const pool = require('../config/db');

const findUpvote = async (reviewerId, userId) => {
  // Check whether this user has already upvoted this reviewer.
  const result = await pool.query(
    'SELECT 1 AS found FROM upvotes WHERE reviewer_id = $1 AND user_id = $2',
    [reviewerId, userId]
  );
  return result.rows[0] || null;
};

const createUpvote = async (reviewerId, userId) => {
  // Record a new upvote.
  await pool.query('INSERT INTO upvotes (reviewer_id, user_id) VALUES ($1, $2)', [
    reviewerId,
    userId,
  ]);
};

const deleteUpvote = async (reviewerId, userId) => {
  // Remove this user's upvote (does nothing if there was none).
  await pool.query('DELETE FROM upvotes WHERE reviewer_id = $1 AND user_id = $2', [
    reviewerId,
    userId,
  ]);
};

const countUpvotes = async (reviewerId) => {
  // Count how many upvotes a reviewer has right now.
  const result = await pool.query(
    'SELECT COUNT(*) AS total FROM upvotes WHERE reviewer_id = $1',
    [reviewerId]
  );
  // Postgres returns COUNT as text (it can be a very big number), so convert it.
  return Number(result.rows[0].total);
};

module.exports = {
  findUpvote: findUpvote,
  createUpvote: createUpvote,
  deleteUpvote: deleteUpvote,
  countUpvotes: countUpvotes,
};
