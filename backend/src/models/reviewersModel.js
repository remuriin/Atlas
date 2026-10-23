// All database code for study reviewers lives in this file.
// Each reviewer is one document in the "reviewers" collection, named after its number.
// The author's name and the number of upvotes are kept on the reviewer itself,
// because Firestore cannot join collections the way SQL can.
const { db } = require('../config/firebase');
const countersModel = require('./countersModel');
const modelHelpers = require('./modelHelpers');

const reviewersCollection = db.collection('reviewers');

// Turns a reviewer document into the row shape the rest of the API uses
// (the same columns the old SQL query returned).
const toReviewerRow = (doc) => {
  const data = doc.data();
  return {
    id: Number(doc.id),
    author_id: data.authorId,
    title: data.title,
    description: data.description,
    subject: data.subject,
    tags: data.tags,
    file_name: data.fileName,
    stored_name: data.storedName,
    file_mime: data.fileMime,
    file_size: data.fileSize,
    created_at: modelHelpers.toDate(data.createdAt),
    updated_at: modelHelpers.toDate(data.updatedAt),
    author_name: data.authorName,
    upvote_count: data.upvoteCount,
  };
};

// --- A short-lived copy of every reviewer, kept in memory ---
// Firestore cannot search inside text, so the lists below are filtered and sorted
// here in JavaScript instead. Reading every reviewer for each request would use up
// the free daily reads quickly, so the list is kept for up to a minute, and every
// change to a reviewer or an upvote throws it away at once.
// (There is only ever one copy of the server, so this memory is shared by every visitor.)
const CACHE_MILLISECONDS = 60 * 1000;
let cachedRows = null;
let cachedAt = 0;
// Goes up on every change, so a slow read that started before a change is not kept.
let cacheVersion = 0;

const forgetCachedReviewers = () => {
  cachedRows = null;
  cacheVersion += 1;
};

const loadAllReviewers = async () => {
  if (cachedRows && Date.now() - cachedAt < CACHE_MILLISECONDS) {
    return cachedRows;
  }
  const versionAtStart = cacheVersion;
  const snapshot = await reviewersCollection.get();
  const rows = snapshot.docs.map(toReviewerRow);
  if (versionAtStart === cacheVersion) {
    cachedRows = rows;
    cachedAt = Date.now();
  }
  return rows;
};

// An empty string for subject or searchText means "do not filter by this".
// The search ignores upper and lower case, and matches any part of the
// title, description, or tags (like the old ILIKE '%text%').
const filterReviewers = (rows, subject, searchText) => {
  const search = searchText.toLowerCase();
  return rows.filter((row) => {
    if (subject !== '' && row.subject !== subject) {
      return false;
    }
    if (search === '') {
      return true;
    }
    return (
      row.title.toLowerCase().includes(search) ||
      row.description.toLowerCase().includes(search) ||
      (row.tags || '').toLowerCase().includes(search)
    );
  });
};

// Newest first; reviewers made at the same moment are ordered by id.
const compareNewest = (a, b) => {
  const timeDifference = b.created_at.getTime() - a.created_at.getTime();
  if (timeDifference !== 0) {
    return timeDifference;
  }
  return b.id - a.id;
};

// Most upvotes first, then newest first.
const compareTop = (a, b) => {
  if (b.upvote_count !== a.upvote_count) {
    return b.upvote_count - a.upvote_count;
  }
  return compareNewest(a, b);
};

const listNewReviewers = async (subject, searchText, limit, offset) => {
  // List reviewers, newest first.
  const rows = filterReviewers(await loadAllReviewers(), subject, searchText);
  rows.sort(compareNewest);
  return rows.slice(offset, offset + limit);
};

const listTopReviewers = async (subject, searchText, limit, offset) => {
  // List reviewers with the most upvotes first.
  const rows = filterReviewers(await loadAllReviewers(), subject, searchText);
  rows.sort(compareTop);
  return rows.slice(offset, offset + limit);
};

const findReviewerById = async (reviewerId) => {
  // Get one reviewer, always fresh from the database (never from the copy in memory),
  // because this is what owner checks and file downloads rely on.
  const doc = await reviewersCollection.doc(String(reviewerId)).get();
  if (!doc.exists) {
    return null;
  }
  return toReviewerRow(doc);
};

const findReviewersByIds = async (reviewerIds) => {
  // Get several reviewers at once. Ids that no longer exist are left out.
  if (reviewerIds.length === 0) {
    return [];
  }
  const refs = reviewerIds.map((reviewerId) => reviewersCollection.doc(String(reviewerId)));
  const docs = await db.getAll.apply(db, refs);
  return docs.filter((doc) => doc.exists).map(toReviewerRow);
};

const listReviewersByAuthor = async (authorId) => {
  // List everything one user has uploaded, newest first.
  const rows = (await loadAllReviewers()).filter((row) => row.author_id === authorId);
  rows.sort(compareNewest);
  return rows;
};

const createReviewer = async (reviewer) => {
  // Add a new reviewer and return its new id.
  let newId = 0;
  await db.runTransaction(async (transaction) => {
    newId = await countersModel.takeIds(transaction, 'reviewers', 1);
    const now = new Date();
    transaction.set(reviewersCollection.doc(String(newId)), {
      authorId: reviewer.authorId,
      authorName: reviewer.authorName,
      title: reviewer.title,
      description: reviewer.description,
      subject: reviewer.subject,
      tags: reviewer.tags,
      fileName: reviewer.fileName,
      storedName: reviewer.storedName,
      fileMime: reviewer.fileMime,
      fileSize: reviewer.fileSize,
      upvoteCount: 0,
      createdAt: now,
      updatedAt: now,
    });
  });
  forgetCachedReviewers();
  return { id: newId };
};

// Firestore's error code for "that document does not exist".
const NOT_FOUND = 5;

// Applies changes to one reviewer. Returns { id }, or null if it no longer exists.
const changeReviewer = async (reviewerId, changes) => {
  try {
    await reviewersCollection.doc(String(reviewerId)).update(changes);
  } catch (err) {
    if (err.code === NOT_FOUND) {
      return null;
    }
    throw err;
  }
  forgetCachedReviewers();
  return { id: reviewerId };
};

const updateReviewer = async (reviewerId, reviewer) => {
  // Change the text details of a reviewer (the file stays the same).
  return changeReviewer(reviewerId, {
    title: reviewer.title,
    description: reviewer.description,
    subject: reviewer.subject,
    tags: reviewer.tags,
    updatedAt: new Date(),
  });
};

const updateReviewerWithFile = async (reviewerId, reviewer) => {
  // Change the text details of a reviewer and point it at a replacement file.
  return changeReviewer(reviewerId, {
    title: reviewer.title,
    description: reviewer.description,
    subject: reviewer.subject,
    tags: reviewer.tags,
    fileName: reviewer.fileName,
    storedName: reviewer.storedName,
    fileMime: reviewer.fileMime,
    fileSize: reviewer.fileSize,
    updatedAt: new Date(),
  });
};

const deleteReviewer = async (reviewerId) => {
  // Remove a reviewer. Its upvotes, views, and saved copies are tidied up by the
  // controller, using the other model files.
  await reviewersCollection.doc(String(reviewerId)).delete();
  forgetCachedReviewers();
  return { id: reviewerId };
};

const renameAuthor = async (authorId, authorName) => {
  // Keep the author name shown on every reviewer in step after a user renames themselves.
  await modelHelpers.updateAllFound(reviewersCollection.where('authorId', '==', authorId), {
    authorName: authorName,
  });
  forgetCachedReviewers();
};

module.exports = {
  listNewReviewers: listNewReviewers,
  listTopReviewers: listTopReviewers,
  findReviewerById: findReviewerById,
  findReviewersByIds: findReviewersByIds,
  listReviewersByAuthor: listReviewersByAuthor,
  createReviewer: createReviewer,
  updateReviewer: updateReviewer,
  updateReviewerWithFile: updateReviewerWithFile,
  deleteReviewer: deleteReviewer,
  renameAuthor: renameAuthor,
  forgetCachedReviewers: forgetCachedReviewers,
};
