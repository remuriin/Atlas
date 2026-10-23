// All database code for saved study reviewers lives in this file.
// Each saved item is one document in the "savedItems" collection, named after its number.
// The user's notes live on it, and "flashcardCount" keeps how many cards it has.
// If the uploader deletes the original, reviewerId becomes null but the saved item
// stays, so the saved title, subject, notes, and flashcards are not lost.
const { db } = require('../config/firebase');
const countersModel = require('./countersModel');
const modelHelpers = require('./modelHelpers');
const reviewersModel = require('./reviewersModel');

const savedCollection = db.collection('savedItems');

// Joins a saved item with its live reviewer (or null when the original was deleted),
// giving the same columns the old SQL query returned.
const toSavedRow = (doc, reviewer) => {
  const data = doc.data();
  const row = {
    id: Number(doc.id),
    user_id: data.userId,
    reviewer_id: data.reviewerId,
    saved_title: data.title,
    saved_subject: data.subject,
    notes: data.notes,
    notes_format: data.notesFormat,
    notes_updated_at: modelHelpers.toDate(data.notesUpdatedAt),
    saved_at: modelHelpers.toDate(data.savedAt),
    flashcard_count: data.flashcardCount,
    live_reviewer_id: null,
    author_id: null,
    title: null,
    description: null,
    subject: null,
    tags: null,
    file_name: null,
    stored_name: null,
    file_mime: null,
    file_size: null,
    created_at: null,
    updated_at: null,
    author_name: null,
    upvote_count: 0,
  };

  if (reviewer) {
    row.live_reviewer_id = reviewer.id;
    row.author_id = reviewer.author_id;
    row.title = reviewer.title;
    row.description = reviewer.description;
    row.subject = reviewer.subject;
    row.tags = reviewer.tags;
    row.file_name = reviewer.file_name;
    row.stored_name = reviewer.stored_name;
    row.file_mime = reviewer.file_mime;
    row.file_size = reviewer.file_size;
    row.created_at = reviewer.created_at;
    row.updated_at = reviewer.updated_at;
    row.author_name = reviewer.author_name;
    row.upvote_count = reviewer.upvote_count;
  }
  return row;
};

// Finds the live reviewer of each saved item with one trip to the database.
const joinReviewers = async (docs) => {
  const reviewerIds = [];
  docs.forEach((doc) => {
    const reviewerId = doc.get('reviewerId');
    if (reviewerId !== null && reviewerIds.indexOf(reviewerId) === -1) {
      reviewerIds.push(reviewerId);
    }
  });
  const reviewers = await reviewersModel.findReviewersByIds(reviewerIds);

  return docs.map((doc) => {
    const reviewerId = doc.get('reviewerId');
    let reviewer = null;
    if (reviewerId !== null) {
      reviewer = reviewers.find((row) => row.id === reviewerId) || null;
    }
    return toSavedRow(doc, reviewer);
  });
};

const findSavedQuery = (userId, reviewerId) => {
  return savedCollection
    .where('userId', '==', userId)
    .where('reviewerId', '==', reviewerId)
    .limit(1);
};

const findSavedByUserAndReviewer = async (userId, reviewerId) => {
  // Check whether this user has saved this reviewer.
  const snapshot = await findSavedQuery(userId, reviewerId).get();
  if (snapshot.empty) {
    return null;
  }
  return { id: Number(snapshot.docs[0].id) };
};

const listSavedIdsByReviewer = async (userId) => {
  // Which reviewers this user has saved, as { <reviewer id>: <saved item id> }.
  const snapshot = await savedCollection.where('userId', '==', userId).get();
  const savedIds = {};
  snapshot.docs.forEach((doc) => {
    const reviewerId = doc.get('reviewerId');
    if (reviewerId !== null) {
      savedIds[reviewerId] = Number(doc.id);
    }
  });
  return savedIds;
};

const findSavedById = async (savedItemId) => {
  // Get one saved item with the live details of its study reviewer (if it still exists).
  const doc = await savedCollection.doc(String(savedItemId)).get();
  if (!doc.exists) {
    return null;
  }
  const rows = await joinReviewers([doc]);
  return rows[0];
};

// Most recently saved first; items saved at the same moment are ordered by id.
const compareNewestSaved = (a, b) => {
  const timeDifference = b.saved_at.getTime() - a.saved_at.getTime();
  if (timeDifference !== 0) {
    return timeDifference;
  }
  return b.id - a.id;
};

const listSavedItems = async (userId) => {
  // List everything one user has saved, most recently saved first.
  const snapshot = await savedCollection.where('userId', '==', userId).get();
  const rows = await joinReviewers(snapshot.docs);
  rows.sort(compareNewestSaved);
  return rows;
};

const createSavedItem = async (userId, reviewerId, title, subject) => {
  // Save a reviewer for a user and return the saved item's id. The transaction makes
  // two quick clicks safe: the second one finds the item the first one made.
  let savedId = 0;
  await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(findSavedQuery(userId, reviewerId));
    if (!existing.empty) {
      savedId = Number(existing.docs[0].id);
      return;
    }
    savedId = await countersModel.takeIds(transaction, 'savedItems', 1);
    transaction.set(savedCollection.doc(String(savedId)), {
      userId: userId,
      reviewerId: reviewerId,
      title: title,
      subject: subject,
      notes: '',
      // Becomes 'html' with the first save; 'text' matches what the old database used.
      notesFormat: 'text',
      notesUpdatedAt: null,
      savedAt: new Date(),
      flashcardCount: 0,
    });
  });
  return { id: savedId };
};

const deleteSavedItem = async (savedItemId) => {
  // Remove a saved item together with its flashcards.
  await modelHelpers.deleteAllFound(
    db.collection('flashcards').where('savedItemId', '==', savedItemId)
  );
  await savedCollection.doc(String(savedItemId)).delete();
};

const deleteSavedByUserAndReviewer = async (userId, reviewerId) => {
  // Remove this user's saved copy of a reviewer (does nothing if there was none).
  const saved = await findSavedByUserAndReviewer(userId, reviewerId);
  if (saved) {
    await deleteSavedItem(saved.id);
  }
};

const updateNotes = async (savedItemId, notes) => {
  // Replace the notes of a saved item and return when they were saved.
  // Notes saved now are always formatted (HTML), so the format is set too.
  const now = new Date();
  await savedCollection.doc(String(savedItemId)).update({
    notes: notes,
    notesFormat: 'html',
    notesUpdatedAt: now,
  });
  return { notes: notes, notes_format: 'html', notes_updated_at: now };
};

const refreshSnapshot = async (reviewerId, title, subject) => {
  // Keep the copied title and subject in step after the uploader edits the reviewer,
  // so they are up to date if the original is ever deleted.
  await modelHelpers.updateAllFound(savedCollection.where('reviewerId', '==', reviewerId), {
    title: title,
    subject: subject,
  });
};

const detachReviewer = async (reviewerId) => {
  // The original was deleted: keep every saved copy, but stop pointing at it.
  await modelHelpers.updateAllFound(savedCollection.where('reviewerId', '==', reviewerId), {
    reviewerId: null,
  });
};

module.exports = {
  findSavedByUserAndReviewer: findSavedByUserAndReviewer,
  listSavedIdsByReviewer: listSavedIdsByReviewer,
  findSavedById: findSavedById,
  listSavedItems: listSavedItems,
  createSavedItem: createSavedItem,
  deleteSavedItem: deleteSavedItem,
  deleteSavedByUserAndReviewer: deleteSavedByUserAndReviewer,
  updateNotes: updateNotes,
  refreshSnapshot: refreshSnapshot,
  detachReviewer: detachReviewer,
};
