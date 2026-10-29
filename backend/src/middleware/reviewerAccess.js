// Small checks shared by every route that has ":id" in its address.
const reviewersModel = require('../models/reviewersModel');
const validate = require('../utils/validate');
const createHttpError = require('../utils/httpError');

// Checks the id, loads the reviewer, and stores it on req.reviewer.
// Bad id -> 400, no such reviewer -> 404 (never a 500).
const loadReviewer = async (req, res, next) => {
  const reviewerId = validate.parseId(req.params.id);
  if (reviewerId === null) {
    next(createHttpError(400, 'That study reviewer id is not valid.'));
    return;
  }

  try {
    const reviewer = await reviewersModel.findReviewerById(reviewerId);
    if (!reviewer) {
      next(createHttpError(404, 'That study reviewer could not be found.'));
      return;
    }
    req.reviewer = reviewer;
    next();
  } catch (err) {
    next(err);
  }
};

// Runs after requireAuth and loadReviewer. Only the author may continue.
// This runs BEFORE the file upload step, so strangers cannot fill the disk.
const requireOwner = (req, res, next) => {
  if (req.reviewer.author_id !== req.user.id) {
    next(createHttpError(403, 'Only the person who uploaded this study reviewer can change it.'));
    return;
  }
  next();
};

// Runs after loadReviewer (and requireAuth or optionalAuth). A reviewer hidden by
// reports answers 404, as if it were gone, to everyone but its uploader and the admins.
const hideIfHidden = (req, res, next) => {
  const user = req.user;
  const canSee = user && (user.id === req.reviewer.author_id || user.role === 'admin');
  if (req.reviewer.is_hidden && !canSee) {
    next(createHttpError(404, 'That study reviewer could not be found.'));
    return;
  }
  next();
};

module.exports = {
  loadReviewer: loadReviewer,
  requireOwner: requireOwner,
  hideIfHidden: hideIfHidden,
};
