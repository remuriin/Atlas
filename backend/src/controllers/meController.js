// Request handlers for the logged-in user's own profile and lists.
const usersModel = require('../models/usersModel');
const reviewersModel = require('../models/reviewersModel');
const recentlyViewedModel = require('../models/recentlyViewedModel');
const savedItemsModel = require('../models/savedItemsModel');
const validate = require('../utils/validate');
const reviewerItems = require('../utils/reviewerItems');
const env = require('../config/env');
const upload = require('../middleware/upload');
const createHttpError = require('../utils/httpError');

// Deleting an account needs a login from the last few minutes, so someone who finds
// a phone that was left logged in cannot do it. Firebase asks the same before it
// deletes the login itself, so this also makes that step work.
const RECENT_LOGIN_SECONDS = 5 * 60;

const RECENTLY_VIEWED_LIMIT = 20;

// The email is only ever sent to its owner, through these /api/me routes.
const toProfileJson = (user) => {
  return {
    id: user.id,
    displayName: user.display_name,
    email: user.email,
    role: user.role,
    createdAt: user.created_at,
  };
};

// GET /api/me   (requireAuth already found or created the row)
// Also says how many study reviewers the user has and how many they may have.
const getMe = async (req, res, next) => {
  try {
    const profile = toProfileJson(req.user);
    profile.uploadCount = await reviewersModel.countReviewersByAuthor(req.user.id);
    profile.uploadLimit = env.maxUploadsPerUser;
    res.json(profile);
  } catch (err) {
    next(err);
  }
};

// PUT /api/me
const updateMe = async (req, res, next) => {
  try {
    const body = req.body || {};
    const displayName = validate.validateDisplayName(body.displayName);
    const updatedUser = await usersModel.updateUserDisplayName(req.user.id, displayName);
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

// DELETE /api/me   (removes the account and everything in it)
const deleteMe = async (req, res, next) => {
  try {
    const secondsSinceLogin = Date.now() / 1000 - req.authTime;
    if (!req.authTime || secondsSinceLogin > RECENT_LOGIN_SECONDS) {
      throw createHttpError(
        401,
        'For your safety, log in again, then delete your account within 5 minutes.'
      );
    }

    // Read the file names first: once the rows are gone, nothing points at the files.
    const storedNames = await reviewersModel.listStoredNamesByAuthor(req.user.id);
    await usersModel.deleteUser(req.user.id);
    for (const storedName of storedNames) {
      await upload.removeStoredFile(storedName);
    }

    console.log(`User ${req.user.id} deleted their account (${storedNames.length} files).`);
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  deleteMe: deleteMe,
  listMySaved: listMySaved,
  getMe: getMe,
  updateMe: updateMe,
  listMyReviewers: listMyReviewers,
  listMyRecentlyViewed: listMyRecentlyViewed,
};
