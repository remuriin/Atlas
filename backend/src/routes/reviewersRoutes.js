// Addresses under /api/reviewers.
// Read each route left to right: every step must pass before the next one runs.
const express = require('express');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const checkUpload = require('../middleware/checkUpload');
const rateLimit = require('../middleware/rateLimit');
const reviewerAccess = require('../middleware/reviewerAccess');
const reviewersController = require('../controllers/reviewersController');

const router = express.Router();

// Public: anyone can browse, open, and download. A token is optional.
router.get('/', auth.optionalAuth, reviewersController.listReviewers);
router.get(
  '/:id',
  auth.optionalAuth,
  reviewerAccess.loadReviewer,
  reviewerAccess.hideIfHidden,
  reviewersController.getReviewer
);
router.get(
  '/:id/file',
  auth.optionalAuth,
  reviewerAccess.loadReviewer,
  reviewerAccess.hideIfHidden,
  reviewersController.sendReviewerFile
);

// Logged-in users only. Login is checked BEFORE the upload is accepted.
router.post(
  '/',
  rateLimit.writeLimiter,
  auth.requireAuth,
  upload.single,
  checkUpload,
  reviewersController.createReviewer
);

router.put(
  '/:id',
  rateLimit.writeLimiter,
  auth.requireAuth,
  reviewerAccess.loadReviewer,
  reviewerAccess.requireOwner,
  upload.single,
  checkUpload,
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
  reviewerAccess.hideIfHidden,
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
  reviewerAccess.hideIfHidden,
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
  reviewerAccess.hideIfHidden,
  reviewersController.recordView
);

router.post(
  '/:id/report',
  rateLimit.writeLimiter,
  auth.requireAuth,
  reviewerAccess.loadReviewer,
  reviewerAccess.hideIfHidden,
  reviewersController.reportReviewer
);

module.exports = router;
