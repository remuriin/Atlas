// Limits how many requests one visitor can make, to slow down abuse.
const { rateLimit } = require('express-rate-limit');

const FIFTEEN_MINUTES = 15 * 60 * 1000;

const buildLimiter = (maxRequests, message) => {
  return rateLimit({
    windowMs: FIFTEEN_MINUTES,
    limit: maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    // Same error shape as every other error from this API.
    message: { error: { message: message } },
  });
};

// Applies to every request.
const generalLimiter = buildLimiter(
  600,
  'Too many requests. Please wait a few minutes and try again.'
);

// Stricter: applies to requests that change data (upload, edit, delete, upvote).
const writeLimiter = buildLimiter(
  120,
  'You are making changes too quickly. Please wait a few minutes and try again.'
);

// For small saves made while studying (notes autosave, marking a flashcard as known).
// These happen often in normal use, so they get a roomier limit of their own and do
// not use up the stricter one above.
const studyLimiter = buildLimiter(
  600,
  'You are saving too quickly. Please wait a few minutes and try again.'
);

// Making flashcards calls Gemini, which costs money per request, so each account
// gets a small daily allowance. Counted per logged-in user (it runs after
// requireAuth), so sharing a network with others does not use up your share.
const flashcardLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `user-${req.user.id}`,
  // Only sets that were really made count; a failed attempt does not use up a turn.
  skipFailedRequests: true,
  message: {
    error: { message: 'You have made flashcards 10 times today. Please try again tomorrow.' },
  },
});

module.exports = {
  generalLimiter: generalLimiter,
  writeLimiter: writeLimiter,
  studyLimiter: studyLimiter,
  flashcardLimiter: flashcardLimiter,
};
