// Limits how many requests one visitor can make, to slow down abuse.
// The 15-minute limits are counted in memory. That works because the function
// runs as one single copy (maxInstances: 1 in src/index.js).
const { rateLimit } = require('express-rate-limit');
const flashcardUsageModel = require('../models/flashcardUsageModel');
const createHttpError = require('../utils/httpError');

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
// The count is kept in Firestore, so a restart of the server does not reset it.
const FLASHCARD_DAILY_LIMIT = 10;
const ONE_DAY = 24 * 60 * 60 * 1000;

const flashcardLimiter = async (req, res, next) => {
  let isAllowed = false;
  try {
    isAllowed = await flashcardUsageModel.takeTurn(req.user.id, FLASHCARD_DAILY_LIMIT, ONE_DAY);
  } catch (err) {
    next(err);
    return;
  }
  if (!isAllowed) {
    next(
      createHttpError(
        429,
        `You have made flashcards ${FLASHCARD_DAILY_LIMIT} times today. Please try again tomorrow.`
      )
    );
    return;
  }

  // Only sets that were really made count; a failed attempt does not use up a turn.
  // "close" also runs when the visitor leaves before the answer is ready.
  let isSettled = false;
  const settle = () => {
    if (isSettled) {
      return;
    }
    isSettled = true;
    if (res.statusCode >= 400 || !res.writableFinished) {
      flashcardUsageModel.giveBackTurn(req.user.id).catch((err) => {
        console.error('Could not give back a flashcard turn:', err.message);
      });
    }
  };
  res.on('finish', settle);
  res.on('close', settle);
  next();
};

module.exports = {
  generalLimiter: generalLimiter,
  writeLimiter: writeLimiter,
  studyLimiter: studyLimiter,
  flashcardLimiter: flashcardLimiter,
};
