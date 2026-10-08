// Addresses under /api/reviewers.
// Read each route left to right: every step must pass before the next one runs.
const express = require('express');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const rateLimit = require('../middleware/rateLimit');
const reviewerAccess = require('../middleware/reviewerAccess');
const reviewersController = require('../controllers/reviewersController');

const router = express.Router();

// Public: anyone can browse, open, and download. A token is optional.
router.get('/', auth.optionalAuth, reviewersController.listReviewers);
router.get('/:id', auth.optionalAuth, reviewerAccess.loadReviewer, reviewersController.getReviewer);
router.get('/:id/file', reviewerAccess.loadReviewer, reviewersController.sendReviewerFile);

// Logged-in users only. Login is checked BEFORE the upload is accepted.
router.post(
  '/',
  rateLimit.writeLimiter,
  auth.requireAuth,
  upload.single,
  reviewersController.createReviewer
);

router.put(
  '/:id',
  rateLimit.writeLimiter,
  auth.requireAuth,
  reviewerAccess.loadReviewer,
  reviewerAccess.requireOwner,
  upload.single,
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

router.post(
  '/:id/view',
  rateLimit.writeLimiter,
  auth.requireAuth,
  reviewerAccess.loadReviewer,
  reviewersController.recordView
);

module.exports = router;
