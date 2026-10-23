// Request handlers for the logged-in user's own profile and lists.
const usersModel = require('../models/usersModel');
const reviewersModel = require('../models/reviewersModel');
const recentlyViewedModel = require('../models/recentlyViewedModel');
const savedItemsModel = require('../models/savedItemsModel');
const validate = require('../utils/validate');
const reviewerItems = require('../utils/reviewerItems');

const RECENTLY_VIEWED_LIMIT = 20;

// The email is only ever sent to its owner, through these /api/me routes.
const toProfileJson = (user) => {
  return {
    id: user.id,
    displayName: user.display_name,
    email: user.email,
    createdAt: user.created_at,
  };
};

// GET /api/me   (requireAuth already found or created the row)
const getMe = (req, res) => {
  res.json(toProfileJson(req.user));
};

// PUT /api/me
const updateMe = async (req, res, next) => {
  try {
    const body = req.body || {};
    const displayName = validate.validateDisplayName(body.displayName);
    const updatedUser = await usersModel.updateUserDisplayName(req.user.firebase_uid, displayName);
    // Every reviewer shows its author's name, so update those too.
    await reviewersModel.renameAuthor(req.user.id, displayName);
    res.json(toProfileJson(updatedUser));
  } catch (err) {
    next(err);
  }
};

// GET /api/me/reviewers
const listMyReviewers = async (req, res, next) => {
  try {
    const rows = await reviewersModel.listReviewersByAuthor(req.user.id);
    const items = await reviewerItems.buildReviewerItems(rows, req.user);
    res.json({ items: items });
  } catch (err) {
    next(err);
  }
};

// GET /api/me/recently-viewed
const listMyRecentlyViewed = async (req, res, next) => {
  try {
    const rows = await recentlyViewedModel.listRecentlyViewedReviewers(
      req.user.id,
      RECENTLY_VIEWED_LIMIT
    );
    const items = await reviewerItems.buildReviewerItems(rows, req.user);
    res.json({ items: items });
  } catch (err) {
    next(err);
  }
};

// GET /api/me/saved
const listMySaved = async (req, res, next) => {
  try {
    const rows = await savedItemsModel.listSavedItems(req.user.id);
    res.json({ items: rows.map(reviewerItems.toSavedJson) });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listMySaved: listMySaved,
  getMe: getMe,
  updateMe: updateMe,
  listMyReviewers: listMyReviewers,
  listMyRecentlyViewed: listMyRecentlyViewed,
};
