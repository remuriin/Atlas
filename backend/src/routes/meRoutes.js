// Addresses under /api/me. Every one of them needs a logged-in user.
const express = require('express');
const auth = require('../middleware/auth');
const rateLimit = require('../middleware/rateLimit');
const meController = require('../controllers/meController');

const router = express.Router();

router.use(auth.requireAuth);

router.get('/', meController.getMe);
router.put('/', rateLimit.writeLimiter, meController.updateMe);
router.get('/reviewers', meController.listMyReviewers);
router.get('/recently-viewed', meController.listMyRecentlyViewed);
router.get('/saved', meController.listMySaved);

module.exports = router;
