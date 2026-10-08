// All SQL for the "reviewers" table lives in this file.
const pool = require('../config/db');

// The read queries below all return the same columns, so the shared part is
// written once here. These are fixed pieces of SQL text: user input is never
// added to them, it only ever travels through the $1, $2 placeholders.
// COUNT(up.user_id) counts real upvote rows only, so a reviewer with no upvotes gets 0.
const SELECT_REVIEWERS = `
  SELECT r.id, r.author_id, r.title, r.description, r.subject, r.tags,
         r.file_name, r.stored_name, r.file_mime, r.file_size,
         r.created_at, r.updated_at,
         u.display_name AS author_name,
         COUNT(up.user_id) AS upvote_count
  FROM reviewers r
  INNER JOIN users u ON u.id = r.author_id
  LEFT JOIN upvotes up ON up.reviewer_id = r.id`;

// An empty string for $1 or $2 means "do not filter by this".
const FILTER_BY_SUBJECT_AND_SEARCH = `
  ($1 = '' OR r.subject = $1)
  AND ($2 = '' OR r.title ILIKE $2 OR r.description ILIKE $2 OR r.tags ILIKE $2)`;

const listNewReviewers = async (subject, searchPattern, limit, offset) => {
  // List reviewers, newest first.
  const result = await pool.query(
    `${SELECT_REVIEWERS}
     WHERE ${FILTER_BY_SUBJECT_AND_SEARCH}
     GROUP BY r.id, u.id
     ORDER BY r.created_at DESC, r.id DESC
     LIMIT $3 OFFSET $4`,
    [subject, searchPattern, limit, offset]
  );
  return result.rows;
};

const listTopReviewers = async (subject, searchPattern, limit, offset) => {
  // List reviewers with the most upvotes first.
  const result = await pool.query(
    `${SELECT_REVIEWERS}
     WHERE ${FILTER_BY_SUBJECT_AND_SEARCH}
     GROUP BY r.id, u.id
     ORDER BY upvote_count DESC, r.created_at DESC, r.id DESC
     LIMIT $3 OFFSET $4`,
    [subject, searchPattern, limit, offset]
  );
  return result.rows;
};

const findReviewerById = async (reviewerId) => {
  // Get one reviewer with its author name and upvote count.
  const result = await pool.query(
    `${SELECT_REVIEWERS}
     WHERE r.id = $1
     GROUP BY r.id, u.id`,
    [reviewerId]
  );
  return result.rows[0] || null;
};

const listReviewersByAuthor = async (authorId) => {
  // List everything one user has uploaded, newest first.
  const result = await pool.query(
    `${SELECT_REVIEWERS}
     WHERE r.author_id = $1
     GROUP BY r.id, u.id
     ORDER BY r.created_at DESC, r.id DESC`,
    [authorId]
  );
  return result.rows;
};

const createReviewer = async (reviewer) => {
  // Add a new reviewer and return its new id.
  const result = await pool.query(
    `INSERT INTO reviewers
       (author_id, title, description, subject, tags, file_name, stored_name, file_mime, file_size)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [
      reviewer.authorId,
      reviewer.title,
      reviewer.description,
      reviewer.subject,
      reviewer.tags,
      reviewer.fileName,
      reviewer.storedName,
      reviewer.fileMime,
      reviewer.fileSize,
    ]
  );
  return result.rows[0];
};

const updateReviewer = async (reviewerId, reviewer) => {
  // Change the text details of a reviewer (the file stays the same).
  const result = await pool.query(
    `UPDATE reviewers
     SET title = $1, description = $2, subject = $3, tags = $4, updated_at = NOW()
     WHERE id = $5
     RETURNING id`,
    [reviewer.title, reviewer.description, reviewer.subject, reviewer.tags, reviewerId]
  );
  return result.rows[0] || null;
};

const updateReviewerWithFile = async (reviewerId, reviewer) => {
  // Change the text details of a reviewer and point it at a replacement file.
  const result = await pool.query(
    `UPDATE reviewers
     SET title = $1, description = $2, subject = $3, tags = $4,
         file_name = $5, stored_name = $6, file_mime = $7, file_size = $8,
         updated_at = NOW()
     WHERE id = $9
     RETURNING id`,
    [
      reviewer.title,
      reviewer.description,
      reviewer.subject,
      reviewer.tags,
      reviewer.fileName,
      reviewer.storedName,
      reviewer.fileMime,
      reviewer.fileSize,
      reviewerId,
    ]
  );
  return result.rows[0] || null;
};

const deleteReviewer = async (reviewerId) => {
  // Remove a reviewer (its upvotes and view history are removed by ON DELETE CASCADE).
  const result = await pool.query('DELETE FROM reviewers WHERE id = $1 RETURNING id', [reviewerId]);
  return result.rows[0] || null;
};

module.exports = {
  listNewReviewers: listNewReviewers,
  listTopReviewers: listTopReviewers,
  findReviewerById: findReviewerById,
  listReviewersByAuthor: listReviewersByAuthor,
  createReviewer: createReviewer,
  updateReviewer: updateReviewer,
  updateReviewerWithFile: updateReviewerWithFile,
  deleteReviewer: deleteReviewer,
};
