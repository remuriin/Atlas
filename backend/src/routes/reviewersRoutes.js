// Addresses under /api/reviewers.
// Read each route left to right: every step must pass before the next one runs.
const express = require('express');
const auth = require('../middleware/auth');
const rateLimit = require('../middleware/rateLimit');
const reviewerAccess = require('../middleware/reviewerAccess');
const reviewersController = require('../controllers/reviewersController');

const router = express.Router();

// Public: anyone can browse, open, and download. A token is optional.
router.get('/', auth.optionalAuth, reviewersController.listReviewers);
router.get('/:id', auth.optionalAuth, reviewerAccess.loadReviewer, reviewersController.getReviewer);
router.get('/:id/file', reviewerAccess.loadReviewer, reviewersController.sendReviewerFile);
router.get('/:id/file-link', reviewerAccess.loadReviewer, reviewersController.getReviewerFileLink);

// Logged-in users only. The file itself is already in the user's Cloud Storage inbox,
// which only the logged-in user can write to (see storage.rules).
router.post('/', rateLimit.writeLimiter, auth.requireAuth, reviewersController.createReviewer);

router.put(
  '/:id',
  rateLimit.writeLimiter,
  auth.requireAuth,
  reviewerAccess.loadReviewer,
  reviewerAccess.requireOwner,
  reviewersController.updateReviewer
);

router.delete(
  '/:id',
  rateLimit.writeLimiter,
  auth.requireAuth,
  reviewerAccess.loadReviewer,
  reviewerAccess.requireOwner,
  reviewersController.deleteReviewer
);

router.put(
  '/:id/upvote',
  rateLimit.writeLimiter,
  auth.requireAuth,
  reviewerAccess.loadReviewer,
  reviewersController.addUpvote
);

router.delete(
  '/:id/upvote',
  rateLimit.writeLimiter,
  auth.requireAuth,
  reviewerAccess.loadReviewer,
  reviewersController.removeUpvote
);

router.put(
  '/:id/save',
  rateLimit.writeLimiter,
  auth.requireAuth,
  reviewerAccess.loadReviewer,
  reviewersController.saveReviewer
);

router.delete(
  '/:id/save',
  rateLimit.writeLimiter,
  auth.requireAuth,
  reviewerAccess.loadReviewer,
  reviewersController.unsaveReviewer
);

router.post(
  '/:id/view',
  rateLimit.writeLimiter,
  auth.requireAuth,
  reviewerAccess.loadReviewer,
  reviewersController.recordView
);

module.exports = router;
