// Addresses under /api/saved: one saved study reviewer, its notes, and its flashcards.
// Every one of them needs a logged-in user, and only reaches the user's own items.
const express = require('express');
const auth = require('../middleware/auth');
const rateLimit = require('../middleware/rateLimit');
const savedAccess = require('../middleware/savedAccess');
const savedController = require('../controllers/savedController');

const router = express.Router();

router.use(auth.requireAuth);

router.get('/:savedId', savedAccess.loadSavedItem, savedController.getSavedItem);

router.delete(
  '/:savedId',
  rateLimit.writeLimiter,
  savedAccess.loadSavedItem,
  savedController.deleteSavedItem
);

router.put(
  '/:savedId/notes',
  rateLimit.studyLimiter,
  savedAccess.loadSavedItem,
  savedController.updateNotes
);

router.get('/:savedId/flashcards', savedAccess.loadSavedItem, savedController.listFlashcards);

router.post(
  '/:savedId/flashcards',
  rateLimit.writeLimiter,
  savedAccess.loadSavedItem,
  rateLimit.flashcardLimiter,
  savedController.createFlashcards
);

router.delete(
  '/:savedId/flashcards',
  rateLimit.writeLimiter,
  savedAccess.loadSavedItem,
  savedController.deleteFlashcards
);

router.put(
  '/:savedId/flashcards/:cardId',
  rateLimit.studyLimiter,
  savedAccess.loadSavedItem,
  savedController.updateFlashcardStatus
);

module.exports = router;
