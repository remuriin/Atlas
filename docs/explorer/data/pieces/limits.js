// The five rate limiters in backend/src/middleware/rateLimit.js. They are values made with
// express-rate-limit, not functions, so lib/extract.js does not see them. The build links
// each one to the endpoints whose chain names it.
module.exports = [
  {
    id: 'mw:generalLimiter', kind: 'mw', name: 'generalLimiter', title: 'generalLimiter',
    plain: 'A speed limit on every request: one visitor can send up to 600 requests in 15 minutes. It only stops floods, so normal use never meets it.',
    tech: 'express-rate-limit, 600 requests per 15 minutes per IP address (req.ip, read from X-Forwarded-For because of trust proxy 1). Counted in memory, so a restart forgets it. Mounted with app.use before the routers; a refused request gets 429 with the RateLimit headers.',
    facts: [['Limit', '600 requests per 15 minutes'], ['Counted per', 'IP address'], ['Count kept in', 'Memory'], ['Runs on', 'Every request (`backend/src/app.js`)']],
    path: 'backend/src/middleware/rateLimit.js#L26', usedBy: ['mwfile:rateLimit', 'file:app.js'],
    docs: ['rate-limits#which-rate-limits-does-atlas-use'], opens: 'l-rate', term: 'rate-limit',
  },
  {
    id: 'mw:writeLimiter', kind: 'mw', name: 'writeLimiter', title: 'writeLimiter',
    plain: 'A stricter limit on changes: one visitor can upload, edit, delete, upvote, save or report up to 120 times in 15 minutes.',
    tech: 'express-rate-limit, 120 requests per 15 minutes per IP address, counted in the Postgres table rate_limits (prefix write:) so a restart does not reset it. passOnStoreError lets requests through if the database cannot count them.',
    facts: [['Limit', '120 changes per 15 minutes'], ['Counted per', 'IP address'], ['Count kept in', 'Postgres, table `rate_limits`'], ['Runs on', 'Every route that changes data, except notes and card marks']],
    path: 'backend/src/middleware/rateLimit.js#L32', usedBy: ['mwfile:rateLimit'], uses: ['util:rateLimitStore', 'table:rate_limits'],
    docs: ['rate-limits#which-rate-limits-does-atlas-use', 'rate-limits#where-are-atlas-rate-limit-counts-kept'], opens: 'l-rate', term: 'rate-limit',
  },
  {
    id: 'mw:studyLimiter', kind: 'mw', name: 'studyLimiter', title: 'studyLimiter',
    plain: 'A roomy limit for the small saves made while studying: notes autosave and marking a flashcard as known. It keeps those from using up the stricter change limit.',
    tech: 'express-rate-limit, 600 requests per 15 minutes per IP address, counted in memory. Used only by PUT /api/saved/:savedId/notes and PUT /api/saved/:savedId/flashcards/:cardId.',
    facts: [['Limit', '600 saves per 15 minutes'], ['Counted per', 'IP address'], ['Count kept in', 'Memory'], ['Runs on', 'Notes autosave and flashcard marks']],
    path: 'backend/src/middleware/rateLimit.js#L41', usedBy: ['mwfile:rateLimit'],
    docs: ['rate-limits#which-rate-limits-does-atlas-use'], opens: 'l-rate', term: 'rate-limit',
  },
  {
    id: 'mw:flashcardLimiter', kind: 'mw', name: 'flashcardLimiter', title: 'flashcardLimiter',
    plain: 'Each account can make flashcards 10 times a day, because every set is made by Google Gemini and costs money. A failed attempt does not use up a turn.',
    tech: 'express-rate-limit, 10 per 24 hours per user (key user-<id>, after requireAuth), counted in the Postgres table rate_limits (prefix flashcards:). skipFailedRequests takes the hit back when the reply is 400 or higher.',
    facts: [['Limit', '10 flashcard sets per 24 hours'], ['Counted per', 'User account'], ['Count kept in', 'Postgres, table `rate_limits`'], ['Runs on', '`POST /api/saved/:savedId/flashcards`']],
    path: 'backend/src/middleware/rateLimit.js#L49', usedBy: ['mwfile:rateLimit'], uses: ['util:rateLimitStore', 'table:rate_limits'],
    docs: ['rate-limits#how-does-the-atlas-flashcard-limit-work'], opens: 'l-flashcards', term: 'rate-limit',
  },
  {
    id: 'mw:askLimiter', kind: 'mw', name: 'askLimiter', title: 'askLimiter',
    plain: 'A limit on questions to Rem, the Explorer’s chat: one visitor can ask up to 30 questions in 15 minutes, because every answer uses the shared Gemini allowance.',
    tech: 'express-rate-limit, 30 requests per 15 minutes per IP address, counted in memory. Used only by POST /api/ask, which needs no login.',
    facts: [['Limit', '30 questions per 15 minutes'], ['Counted per', 'IP address'], ['Count kept in', 'Memory'], ['Runs on', '`POST /api/ask`']],
    path: 'backend/src/middleware/rateLimit.js#L66', usedBy: ['mwfile:rateLimit'],
    docs: ['rate-limits#which-rate-limits-does-atlas-use'], opens: 'l-rate', term: 'rate-limit',
  },
  { id: 'mwfile:rateLimit', uses: ['mw:generalLimiter', 'mw:writeLimiter', 'mw:studyLimiter', 'mw:flashcardLimiter', 'mw:askLimiter'] },
  { id: 'file:app.js', uses: ['mw:generalLimiter'] },
];
