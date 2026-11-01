# Rate limits in Atlas

Rate limits cap how many requests one visitor or one account can send to the Atlas API within a period of time. They slow down abuse such as spam uploads, protect the server from floods, and keep the cost of the Gemini flashcard feature and the Atlas Explorer chat under control. This page explains the five limiters in `backend/src/middleware/rateLimit.js`, how visitors are told apart, where the counts are kept, what a blocked request looks like, and the side effects students and developers may notice.

## Which rate limits does Atlas use?

Atlas uses five limiters from the `express-rate-limit` package (version 8), all defined in `backend/src/middleware/rateLimit.js`:

| Limiter | Limit | Window | Counted per | Count kept in | Where it runs |
| --- | --- | --- | --- | --- | --- |
| `generalLimiter` | 600 | 15 minutes | IP address | Memory | Every request |
| `writeLimiter` | 120 | 15 minutes | IP address | Postgres | Every change except notes and card marks |
| `studyLimiter` | 600 | 15 minutes | IP address | Memory | Notes autosave and marking a flashcard |
| `flashcardLimiter` | 10 | 24 hours | User account | Postgres | Making a flashcard set |
| `askLimiter` | 30 | 15 minutes | IP address | Memory | Questions to the Atlas Explorer chat (`POST /api/ask`) |

`writeLimiter` covers uploading, editing, deleting, upvoting, saving, unsaving, recording a view, reporting, changing the display name, deleting the account, deleting a saved item or its flashcards, making flashcards, and every admin change (restore, fix category, delete). `studyLimiter` covers `PUT /api/saved/:savedId/notes` and `PUT /api/saved/:savedId/flashcards/:cardId`, which happen often during normal studying, so they do not use up the stricter write limit. `askLimiter` covers only `POST /api/ask`, which needs no login and uses the shared Gemini allowance of Rem RaaS for each answer. One request can pass several limiters: making flashcards counts toward the general, the write, and the flashcard limits.

## How does Atlas tell visitors apart for rate limiting?

Four of the five Atlas limiters count per IP address, using `req.ip`, the default key of `express-rate-limit`. The live API sits behind one proxy, Envoy Gateway, so the address the API sees directly is the proxy's. With `TRUST_PROXY=true`, `backend/src/app.js` calls `app.set('trust proxy', 1)`, and Express reads the visitor's address from the last entry of the `X-Forwarded-For` header, the one the proxy wrote. Addresses a visitor writes into that header themselves sit further left and are ignored. IPv6 visitors are grouped by the first 56 bits of their address, the library's default, because one home or phone network often holds many IPv6 addresses.

The flashcard limiter counts per account instead, with the key `user-` plus the user's id. It runs after `requireAuth`, so students who share a school network each get their own 10 sets a day. If `TRUST_PROXY` were left off behind a proxy, every visitor would seem to come from the proxy and all of them would share one allowance. How the proxy passes on the visitor's address is explained in [How does the Atlas API know each visitor's address?](hosting-and-traffic-path.md#how-does-the-atlas-api-know-each-visitors-address)

## Where are Atlas rate limit counts kept?

The general, study, and ask limits of Atlas are counted in memory, inside the API process. That is fast, and losing the counts in a restart does no harm, because these limits only smooth out bursts. The write and flashcard limits are counted in Postgres, in the `rate_limits` table, so a restart or a second API process does not hand everyone a fresh allowance.

The Postgres store is `backend/src/utils/rateLimitStore.js`. Each counted key has one row: `key` (the limiter's prefix `write:` or `flashcards:` plus the visitor's key), `hits`, and `reset_at`, the moment the window ends. Each hit is one SQL statement (`INSERT ... ON CONFLICT ... DO UPDATE`) that adds 1, or starts again at 1 when the window has ended. `reset_at` is a `TIMESTAMPTZ` (with time zone), unlike the other tables, because the API compares it with its own clock. Once an hour each Postgres-backed limiter deletes the rows whose window has ended; nothing depends on this clean-up being prompt. Because write keys are IP addresses, the table holds visitors' IP addresses for a short time, until their window ends and the next clean-up runs.

## What happens to Atlas rate limits when the database is down?

Every Atlas limiter is built with `passOnStoreError: true`. If the store cannot count a request, for example because Postgres cannot be reached, the limiter logs `express-rate-limit: error from store, allowing request without rate-limiting.` and lets the request through instead of failing it. This matters only for the write and flashcard limits, whose counts live in Postgres; the in-memory counts of the general, study, and ask limits do not fail this way. The choice favours availability: a short database problem never blocks everyone with 429 errors. In practice, a request that changes data usually fails a moment later anyway, when its controller needs the same database, and answers 500 `Something went wrong on our side. Please try again.`

## How does the Atlas flashcard limit work?

Making flashcards calls Google Gemini, which costs money per request, so `flashcardLimiter` in `backend/src/middleware/rateLimit.js` gives each Atlas account 10 flashcard sets per 24 hours. It runs only on `POST /api/saved/:savedId/flashcards`, after `requireAuth`, `writeLimiter`, and `loadSavedItem`, and it counts per user id, not per IP address. Its counts are kept in Postgres with the prefix `flashcards:`.

`skipFailedRequests: true` means only sets that were really made count. When the reply has a status of 400 or higher, or the connection closes before the reply is finished, the limiter takes the hit back. So a wrong `count`, a damaged file, or a Gemini error does not use up a turn. A refused request gets 429 `You have made flashcards 10 times today. Please try again tomorrow.` "Today" is really a 24-hour window that starts with the first attempt after the previous window ended, not a calendar day. Deleting a flashcard set does not give a turn back.

## What does a request blocked by an Atlas rate limit look like?

A request over any Atlas limit gets status 429 (Too Many Requests) and the same JSON error shape as every other API error, with one of these messages:

- General limit: `Too many requests. Please wait a few minutes and try again.`
- Write limit: `You are making changes too quickly. Please wait a few minutes and try again.`
- Study limit: `You are saving too quickly. Please wait a few minutes and try again.`
- Flashcard limit: `You have made flashcards 10 times today. Please try again tomorrow.`
- Ask limit: `You have asked a lot of questions. Please wait a few minutes and try again.`

For example: `{ "error": { "message": "You are making changes too quickly. Please wait a few minutes and try again." } }`. The limiter sends this reply itself, so the request never reaches its controller and changes nothing. Blocked requests still add to the count of the general, write, study, and ask limits (the flashcard limit gives them back, as it does every failed attempt), but they never move the end of the window. The Atlas website shows the message like any other error message.

## Which RateLimit headers does the Atlas API send?

Each Atlas limiter has `standardHeaders: true` and `legacyHeaders: false`. In `express-rate-limit` 8 that means the headers of the IETF draft version 6. Because the general limiter runs on every request, every reply except a preflight carries them:

- `RateLimit-Policy`: the limit and the window, for example `120;w=900` (120 requests per 900 seconds).
- `RateLimit-Limit`: the limit, for example `120`.
- `RateLimit-Remaining`: how many requests are left in this window.
- `RateLimit-Reset`: seconds until the window ends.
- `Retry-After`: seconds to wait, added only on a 429 reply.

The older `X-RateLimit-*` headers are not sent. When several limiters run on one request, each one overwrites these headers, so the reply shows the last limiter that ran: the write limit on `POST /api/reviewers`, the flashcard limit on `POST /api/saved/:savedId/flashcards`, and the ask limit on `POST /api/ask`. The API does not list these headers in `Access-Control-Expose-Headers`, so the Atlas website's JavaScript cannot read them; tools such as curl can.

## How does an Atlas rate limit window reset?

Every Atlas limiter uses a fixed window for each visitor or account. The window starts with the first request after the previous window ended and lasts 15 minutes (24 hours for flashcards). During the window each request adds 1 to the count. When the window ends, the next request starts a new window at 1. There is no sliding window and no gradual refill: someone who used all 120 writes in the first minute waits about 14 minutes and then has all 120 again. The in-memory limits also reset whenever the API process restarts, because their counts are lost; the Postgres limits survive restarts. A maintainer can clear one Postgres count by deleting its row from the `rate_limits` table, for example after a mistake. The Atlas API has no endpoint for resetting limits.

## What limits sit in front of and behind the Atlas API?

Some limits come from the systems around the Atlas API, not from `backend/src/middleware/rateLimit.js`:

- **Envoy Gateway**, in front of the live API, ends HTTPS and gives each request 60 seconds to be answered. A slower request gets a gateway error from Envoy, which the website shows as `Something went wrong. Please try again.`, even though the API may keep working on it. The API allows Gemini up to 120 seconds, so a large flashcard set could time out at Envoy while the API still saves the cards; such an attempt probably does not use up a daily turn, because the connection closes before the reply is sent. Envoy applies no rate limits of its own to Atlas.
- **Request size**: JSON bodies are limited to 512 KB by `express.json`, and uploads to one file of `MAX_FILE_SIZE_MB` (10 MB by default) by multer.
- **Gemini's own quota**: when Gemini answers 429, the API answers 503 `The flashcard service is busy right now. Please try again later.`
- **Firebase Authentication**: sign-up, login, and password resets go from the browser to Firebase directly, never through the Atlas API, so the Atlas limits do not apply to them.

The other timeouts on the way in are listed in [What timeouts and size limits apply on the way to the Atlas API?](hosting-and-traffic-path.md#what-timeouts-and-size-limits-apply-on-the-way-to-the-atlas-api)

## What side effects of the Atlas rate limits should students and developers know about?

The Atlas rate limits have a few effects that are easy to miss:

- **Viewing spends a write.** When a logged-in student opens a study reviewer, the website calls `POST /api/reviewers/:id/view`, which uses `writeLimiter`. Opening 120 study reviewers in 15 minutes blocks upvotes, saves, and uploads for the rest of the window.
- **The write limit is counted per IP address.** Students behind one school or household network share one address, so they share 120 writes and 600 general requests per 15 minutes. One busy classroom can block everyone on that network for a while.
- **Failed writes count.** The write limit counts every request, refused ones included. Under `/api/reviewers` it even runs before the login check. Only the flashcard limit gives failed attempts back.
- **In-memory limits are per process.** The general, study, and ask counts reset when the API restarts, and they would not be shared if a second API process ever ran.
- **"Tomorrow" means 24 hours.** The flashcard message says "today" and "tomorrow", but the window is 24 hours from its start, not midnight.
- **Headers show the last limiter.** A reply carries the RateLimit headers of the last limiter that ran on it.
- **Health checks count.** `GET /api/health` uses the general allowance like any other request.

## Which Atlas requests use only the general limit?

Requests that only read data pass just the general limit of 600 requests per 15 minutes per IP address. In the Atlas API these are:

- `GET /api/health`
- `GET /api/reviewers`, `GET /api/reviewers/:id`, and `GET /api/reviewers/:id/file`
- `GET /api/me`, `GET /api/me/reviewers`, `GET /api/me/recently-viewed`, and `GET /api/me/saved`
- `GET /api/saved/:savedId` and `GET /api/saved/:savedId/flashcards`
- `GET /api/admin/reports`
- addresses that do not exist, which get a 404 but still count

Browser preflight requests (OPTIONS) do not count at all, because `cors` answers them before the general limiter runs. Every other endpoint also counts toward the write limit, the study limit, the ask limit, or both the write and the flashcard limits. The full list of endpoints is in [Atlas API endpoints](api-endpoints.md#which-endpoints-does-the-atlas-api-have).
