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

module.exports = {
  generalLimiter: generalLimiter,
  writeLimiter: writeLimiter,
};
