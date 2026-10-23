// All database code for "recently viewed" lives in this file.
// Each view is one document named "<user id>_<reviewer id>", so opening the same
// reviewer again simply moves its time to "just now".
const { db } = require('../config/firebase');
const modelHelpers = require('./modelHelpers');
const reviewersModel = require('./reviewersModel');

const viewsCollection = db.collection('recentlyViewed');

const recordView = async (userId, reviewerId) => {
  // Remember that this user opened this reviewer just now.
  await viewsCollection.doc(`${userId}_${reviewerId}`).set({
    userId: userId,
    reviewerId: reviewerId,
    viewedAt: new Date(),
  });
};

const listRecentlyViewedReviewers = async (userId, limit) => {
  // List the reviewers a user opened most recently, newest view first.
  // (This query needs the index in firestore.indexes.json.)
  const snapshot = await viewsCollection
    .where('userId', '==', userId)
    .orderBy('viewedAt', 'desc')
    .limit(limit)
    .get();

  const views = snapshot.docs.map((doc) => doc.data());
  const reviewers = await reviewersModel.findReviewersByIds(views.map((view) => view.reviewerId));

  // Keep the order of the views, and skip any reviewer that has since been deleted.
  const rows = [];
  views.forEach((view) => {
    const row = reviewers.find((reviewer) => reviewer.id === view.reviewerId);
    if (row) {
      rows.push(Object.assign({}, row, { viewed_at: modelHelpers.toDate(view.viewedAt) }));
    }
  });
  return rows;
};

const deleteViewsForReviewer = async (reviewerId) => {
  // Remove every view of a reviewer that is being deleted.
  await modelHelpers.deleteAllFound(viewsCollection.where('reviewerId', '==', reviewerId));
};

module.exports = {
  recordView: recordView,
  listRecentlyViewedReviewers: listRecentlyViewedReviewers,
  deleteViewsForReviewer: deleteViewsForReviewer,
};
