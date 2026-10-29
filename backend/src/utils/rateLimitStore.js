// Keeps express-rate-limit's counts in Postgres instead of in memory, so a restart of
// the API (or a second API process) does not hand everyone a fresh allowance.
// Used for the limits that matter beyond the next few minutes: changes to data, and the
// daily flashcard allowance, which costs money.
//
// One row per counted key: how many hits so far, and when the window ends.
const pool = require('../config/db');

// Rows whose window ended are deleted this often. Nothing depends on it being prompt:
// an ended window is started fresh on the next hit anyway.
const CLEANUP_EVERY_MS = 60 * 60 * 1000;

// "prefix" keeps the keys of each limiter apart in the one table.
const createPostgresStore = (prefix) => {
  // Set by init() from the limiter's own settings.
  let windowMs = 0;

  return {
    // Tells express-rate-limit the counts are shared, not kept inside this process.
    localKeys: false,
    prefix: prefix,

    // Called once by express-rate-limit with the limiter's settings.
    init: (options) => {
      windowMs = options.windowMs;
      const timer = setInterval(() => {
        pool.query('DELETE FROM rate_limits WHERE reset_at < NOW()').catch((err) => {
          console.error('Could not clear old rate limit rows:', err.message);
        });
      }, CLEANUP_EVERY_MS);
      // The timer must not keep the process alive on its own (for example in scripts).
      timer.unref();
    },

    // Adds one hit. A window that has ended starts again from 1.
    // Returns { totalHits, resetTime } as express-rate-limit expects.
    increment: async (key) => {
      const result = await pool.query(
        `INSERT INTO rate_limits (key, hits, reset_at)
         VALUES ($1, 1, NOW() + $2 * INTERVAL '1 millisecond')
         ON CONFLICT (key) DO UPDATE SET
           hits = CASE WHEN rate_limits.reset_at <= NOW() THEN 1 ELSE rate_limits.hits + 1 END,
           reset_at = CASE WHEN rate_limits.reset_at <= NOW() THEN EXCLUDED.reset_at
                           ELSE rate_limits.reset_at END
         RETURNING hits, reset_at`,
        [prefix + key, windowMs]
      );
      return { totalHits: result.rows[0].hits, resetTime: result.rows[0].reset_at };
    },

    // Takes one hit back (used by skipFailedRequests: a failed attempt does not count).
    decrement: async (key) => {
      await pool.query('UPDATE rate_limits SET hits = GREATEST(hits - 1, 0) WHERE key = $1', [
        prefix + key,
      ]);
    },

    resetKey: async (key) => {
      await pool.query('DELETE FROM rate_limits WHERE key = $1', [prefix + key]);
    },
  };
};

module.exports = createPostgresStore;
