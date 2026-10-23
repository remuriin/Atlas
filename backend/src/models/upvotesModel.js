// All database code for upvotes lives in this file.
// Each upvote is one document named "<reviewer id>_<user id>", so one user can
// only ever have one upvote on a reviewer: a second one would have the same name.
// The total is kept on the reviewer as "upvoteCount" and changed together with it.
const { FieldValue } = require('firebase-admin/firestore');
const { db } = require('../config/firebase');
const modelHelpers = require('./modelHelpers');
const reviewersModel = require('./reviewersModel');

const upvotesCollection = db.collection('upvotes');

const upvoteRef = (reviewerId, userId) => {
  return upvotesCollection.doc(`${reviewerId}_${userId}`);
};

const findUpvotedReviewerIds = async (reviewerIds, userId) => {
  // Of these reviewers, list the ones this user has upvoted (one database trip for all).
  if (reviewerIds.length === 0) {
    return [];
  }
  const refs = reviewerIds.map((reviewerId) => upvoteRef(reviewerId, userId));
  const docs = await db.getAll.apply(db, refs);
  const upvoted = [];
  docs.forEach((doc, index) => {
    if (doc.exists) {
      upvoted.push(reviewerIds[index]);
    }
  });
  return upvoted;
};

// Adds (change = 1) or removes (change = -1) this user's upvote. The transaction
// changes the upvote and the reviewer's total together, so they always agree,
// and doing it twice (a double click) changes nothing the second time.
const changeUpvote = async (reviewerId, userId, change) => {
  const ref = upvoteRef(reviewerId, userId);
  const reviewerRef = db.collection('reviewers').doc(String(reviewerId));

  await db.runTransaction(async (transaction) => {
    const upvote = await transaction.get(ref);
    const reviewer = await transaction.get(reviewerRef);
    if (!reviewer.exists) {
      return;
    }
    if (change === 1 && !upvote.exists) {
      transaction.set(ref, { reviewerId: reviewerId, userId: userId, createdAt: new Date() });
      transaction.update(reviewerRef, { upvoteCount: FieldValue.increment(1) });
    }
    if (change === -1 && upvote.exists) {
      transaction.delete(ref);
      transaction.update(reviewerRef, { upvoteCount: FieldValue.increment(-1) });
    }
  });
  reviewersModel.forgetCachedReviewers();
};

const createUpvote = async (reviewerId, userId) => {
  // Record a new upvote (does nothing if it is already there).
  await changeUpvote(reviewerId, userId, 1);
};

const deleteUpvote = async (reviewerId, userId) => {
  // Remove this user's upvote (does nothing if there was none).
  await changeUpvote(reviewerId, userId, -1);
};

const countUpvotes = async (reviewerId) => {
  // How many upvotes a reviewer has right now.
  const reviewer = await reviewersModel.findReviewerById(reviewerId);
  if (!reviewer) {
    return 0;
  }
  return reviewer.upvote_count;
};

const deleteUpvotesForReviewer = async (reviewerId) => {
  // Remove every upvote of a reviewer that is being deleted.
  await modelHelpers.deleteAllFound(upvotesCollection.where('reviewerId', '==', reviewerId));
};

module.exports = {
  findUpvotedReviewerIds: findUpvotedReviewerIds,
  createUpvote: createUpvote,
  deleteUpvote: deleteUpvote,
  countUpvotes: countUpvotes,
  deleteUpvotesForReviewer: deleteUpvotesForReviewer,
};
