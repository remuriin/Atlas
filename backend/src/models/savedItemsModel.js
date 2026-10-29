// All SQL for the "saved_items" table lives in this file.
const pool = require('../config/db');

// The read queries for one user's saved items all return the same columns.
// LEFT JOIN keeps saved items whose original study reviewer was deleted:
// for those, every r.*, u.*, and upvote column comes back as NULL or 0.
const SELECT_SAVED_ITEMS = `
  SELECT s.id, s.user_id, s.reviewer_id, s.title AS saved_title, s.subject AS saved_subject,
         s.strand AS saved_strand, s.notes, s.notes_format, s.notes_updated_at, s.saved_at,
         r.id AS live_reviewer_id, r.author_id, r.title, r.description,
         r.strand, r.grade, r.quarter, r.subject, r.material_type, r.tags,
         r.file_name, r.stored_name, r.file_mime, r.file_size,
         r.created_at, r.updated_at,
         u.display_name AS author_name,
         (SELECT COUNT(*) FROM upvotes up WHERE up.reviewer_id = r.id) AS upvote_count,
         (SELECT COUNT(*) FROM flashcards f WHERE f.saved_item_id = s.id) AS flashcard_count
  FROM saved_items s
  LEFT JOIN reviewers r ON r.id = s.reviewer_id
  LEFT JOIN users u ON u.id = r.author_id`;

const findSavedByUserAndReviewer = async (userId, reviewerId) => {
  // Check whether this user has saved this reviewer.
  const result = await pool.query(
    'SELECT id FROM saved_items WHERE user_id = $1 AND reviewer_id = $2',
    [userId, reviewerId]
  );
  return result.rows[0] || null;
};

const findSavedById = async (savedItemId) => {
  // Get one saved item with the live details of its study reviewer (if it still exists).
  const result = await pool.query(`${SELECT_SAVED_ITEMS} WHERE s.id = $1`, [savedItemId]);
  return result.rows[0] || null;
};

const listSavedItems = async (userId) => {
  // List everything one user has saved, most recently saved first.
  const result = await pool.query(
    `${SELECT_SAVED_ITEMS}
     WHERE s.user_id = $1
     ORDER BY s.saved_at DESC, s.id DESC`,
    [userId]
  );
  return result.rows;
};

const createSavedItem = async (userId, reviewerId, title, subject, strand) => {
  // Save a reviewer for a user and return the new row's id.
  const result = await pool.query(
    `INSERT INTO saved_items (user_id, reviewer_id, title, subject, strand)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [userId, reviewerId, title, subject, strand]
  );
  return result.rows[0];
};

const deleteSavedItem = async (savedItemId) => {
  // Remove a saved item (its flashcards are removed by ON DELETE CASCADE).
  await pool.query('DELETE FROM saved_items WHERE id = $1', [savedItemId]);
};

const deleteSavedByUserAndReviewer = async (userId, reviewerId) => {
  // Remove this user's saved copy of a reviewer (does nothing if there was none).
  await pool.query('DELETE FROM saved_items WHERE user_id = $1 AND reviewer_id = $2', [
    userId,
    reviewerId,
  ]);
};

const updateNotes = async (savedItemId, notes) => {
  // Replace the notes of a saved item and return when they were saved.
  // Notes saved now are always formatted (HTML), so the format is set too.
  const result = await pool.query(
    `UPDATE saved_items SET notes = $1, notes_format = 'html', notes_updated_at = NOW()
     WHERE id = $2
     RETURNING notes, notes_format, notes_updated_at`,
    [notes, savedItemId]
  );
  return result.rows[0] || null;
};

const refreshSnapshot = async (reviewerId, title, subject, strand) => {
  // Keep the copied title, subject, and strand in step after the uploader edits the
  // reviewer, so they are up to date if the original is ever deleted.
  await pool.query(
    'UPDATE saved_items SET title = $1, subject = $2, strand = $3 WHERE reviewer_id = $4',
    [title, subject, strand, reviewerId]
  );
};

module.exports = {
  findSavedByUserAndReviewer: findSavedByUserAndReviewer,
  findSavedById: findSavedById,
  listSavedItems: listSavedItems,
  createSavedItem: createSavedItem,
  deleteSavedItem: deleteSavedItem,
  deleteSavedByUserAndReviewer: deleteSavedByUserAndReviewer,
  updateNotes: updateNotes,
  refreshSnapshot: refreshSnapshot,
};
