// All SQL for the "recently_viewed" table lives in this file.
const pool = require('../config/db');

const findView = async (userId, reviewerId) => {
  // Check whether this user has opened this reviewer before.
  const result = await pool.query(
    'SELECT viewed_at FROM recently_viewed WHERE user_id = $1 AND reviewer_id = $2',
    [userId, reviewerId]
  );
  return result.rows[0] || null;
};

const createView = async (userId, reviewerId) => {
  // Remember that this user opened this reviewer for the first time.
  await pool.query('INSERT INTO recently_viewed (user_id, reviewer_id) VALUES ($1, $2)', [
    userId,
    reviewerId,
  ]);
};

const updateViewTime = async (userId, reviewerId) => {
  // Move an existing view to "just now".
  await pool.query(
    'UPDATE recently_viewed SET viewed_at = NOW() WHERE user_id = $1 AND reviewer_id = $2',
    [userId, reviewerId]
  );
};

const listRecentlyViewedReviewers = async (userId, limit) => {
  // List the reviewers a user opened most recently, newest view first.
  const result = await pool.query(
    `SELECT r.id, r.author_id, r.title, r.description, r.subject, r.tags,
            r.file_name, r.stored_name, r.file_mime, r.file_size,
            r.created_at, r.updated_at,
            u.display_name AS author_name,
            rv.viewed_at,
            COUNT(up.user_id) AS upvote_count
     FROM recently_viewed rv
     INNER JOIN reviewers r ON r.id = rv.reviewer_id
     INNER JOIN users u ON u.id = r.author_id
     LEFT JOIN upvotes up ON up.reviewer_id = r.id
     WHERE rv.user_id = $1
     GROUP BY r.id, u.id, rv.viewed_at
     ORDER BY rv.viewed_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  return result.rows;
};

module.exports = {
  findView: findView,
  createView: createView,
  updateViewTime: updateViewTime,
  listRecentlyViewedReviewers: listRecentlyViewedReviewers,
};
