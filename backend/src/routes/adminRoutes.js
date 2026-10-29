// Addresses under /api/admin. Every one of them needs a logged-in admin.
const express = require('express');
const auth = require('../middleware/auth');
const rateLimit = require('../middleware/rateLimit');
const reviewerAccess = require('../middleware/reviewerAccess');
const adminController = require('../controllers/adminController');

const router = express.Router();

router.use(auth.requireAuth, auth.requireAdmin);

router.get('/reports', adminController.listReports);

router.post(
  '/reviewers/:id/restore',
  rateLimit.writeLimiter,
  reviewerAccess.loadReviewer,
  adminController.restoreReviewer
);

router.put(
  '/reviewers/:id/category',
  rateLimit.writeLimiter,
  reviewerAccess.loadReviewer,
  adminController.updateCategory
);

router.delete(
  '/reviewers/:id',
  rateLimit.writeLimiter,
  reviewerAccess.loadReviewer,
  adminController.deleteReviewer
);

module.exports = router;
