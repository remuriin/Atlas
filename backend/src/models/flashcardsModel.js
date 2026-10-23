// All SQL for the "flashcards" table lives in this file.
const pool = require('../config/db');

const listFlashcards = async (savedItemId) => {
  // List the cards of one saved item in the order they were made.
  const result = await pool.query(
    `SELECT id, position, front, back, status
     FROM flashcards
     WHERE saved_item_id = $1
     ORDER BY position ASC, id ASC`,
    [savedItemId]
  );
  return result.rows;
};

const replaceFlashcards = async (savedItemId, cards) => {
  // Swap the old set for a new one. A transaction makes it all-or-nothing:
  // if any INSERT fails, the old cards are kept instead of a half-made set.
  // The same client must run every statement, so it is borrowed from the pool.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM flashcards WHERE saved_item_id = $1', [savedItemId]);
    for (let index = 0; index < cards.length; index += 1) {
      await client.query(
        'INSERT INTO flashcards (saved_item_id, position, front, back) VALUES ($1, $2, $3, $4)',
        [savedItemId, index + 1, cards[index].front, cards[index].back]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const deleteFlashcardsForItem = async (savedItemId) => {
  // Remove every card of one saved item.
  await pool.query('DELETE FROM flashcards WHERE saved_item_id = $1', [savedItemId]);
};

const updateFlashcardStatus = async (cardId, savedItemId, status) => {
  // Change how well a card is known. Checking saved_item_id too means a card can
  // only be changed through the saved item it belongs to.
  const result = await pool.query(
    `UPDATE flashcards SET status = $1
     WHERE id = $2 AND saved_item_id = $3
     RETURNING id, position, front, back, status`,
    [status, cardId, savedItemId]
  );
  return result.rows[0] || null;
};

module.exports = {
  listFlashcards: listFlashcards,
  replaceFlashcards: replaceFlashcards,
  deleteFlashcardsForItem: deleteFlashcardsForItem,
  updateFlashcardStatus: updateFlashcardStatus,
};
