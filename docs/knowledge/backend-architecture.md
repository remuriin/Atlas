# Atlas backend architecture

The Atlas backend is the API behind the Atlas website, where Filipino Senior High School students share, find, upvote, save, and study study reviewers. This page explains what the backend is built with, how its code is split into layers, what runs for every request, how errors are answered, and what happens when the server starts and stops. All backend code lives in `backend/` of the Atlas repository, and the running code is in `backend/src/`.

## What is the Atlas backend built with?

The Atlas backend is plain JavaScript on Node.js 20 or newer (the `engines` field in `backend/package.json`), written as CommonJS modules (`require` and `module.exports`). There is no TypeScript, no build step, no ORM (a library that writes SQL for you), and no query builder: every database query is hand-written SQL sent through the `pg` driver. The backend has eight runtime packages and no development packages:

| Package | Version range | What Atlas uses it for |
| --- | --- | --- |
| `express` | ^5.2.1 | Web framework: routes, middleware, JSON replies |
| `pg` | ^8.23.1 | PostgreSQL driver and connection pool |
| `firebase-admin` | ^14.5.0 | Checking Firebase login tokens, nothing else |
| `multer` | ^2.4.0 | Receiving uploaded files |
| `helmet` | ^8.3.0 | Protective HTTP response headers |
| `cors` | ^2.8.6 | Letting only the Atlas website call the API from a browser (any page for `/api/ask`) |
| `express-rate-limit` | ^8.7.1 | Limiting how many requests one visitor can make |
| `dotenv` | ^18.0.6 | Reading settings from `backend/.env` |

Google Gemini and Rem RaaS are called with Node's built-in `fetch`, Word and PowerPoint files are opened with Node's built-in `zlib`, and ClamAV is reached through a socket or the `clamscan` program, so none of these need an extra package.

## Which npm scripts does the Atlas backend have?

`backend/package.json` defines four scripts for the Atlas backend, all run from the `backend/` folder:

- `npm run dev` starts the API with `node --watch src/server.js`, which restarts it whenever a file changes. Use it while developing.
- `npm start` starts the API once with `node src/server.js`, the same file a process manager such as pm2 runs on a server.
- `npm run db:migrate` runs `backend/db/migrate.js`, which sends `backend/db/schema.sql` to Postgres to create or update the tables. It is safe to run again.
- `npm run db:seed` runs `backend/db/seed.js`, which adds sample students and sample study reviewers. It never runs by itself.

The Atlas backend has no test script, no lint script, and no automated tests.

## How is the Atlas backend code organised into layers?

The Atlas backend sends every request down one path: routes, then middleware, then a controller, then models, then the database, the disk, or an outside service. Each folder in `backend/src/` is one layer:

- `server.js` starts the HTTP server and handles start-up errors and shutdown.
- `app.js` builds the Express app: security settings, limits, body reading, routers, and error handling.
- `routes/` (5 files) says which middleware and which controller handle each method and address.
- `middleware/` (7 files) holds the checks that run before a controller: login, permissions, uploads, rate limits, and the final error handler.
- `controllers/` (5 files) decides what should happen for each request.
- `models/` (7 files) holds all the SQL, one file per table.
- `utils/` holds shared helpers such as input checks and file checks.
- `config/` reads the settings and builds the database pool and the Firebase Admin connection.

Outside `src/`, `backend/db/` holds the schema, the migration and seed scripts, and `api-user.sql`; `backend/scripts/backup.sh` is the backup script; and `backend/uploads/` is the default folder for uploaded files.

## What does each layer of the Atlas backend do?

Each layer of the Atlas backend has one job, and the rules between the layers are strict:

- **Routes** (`backend/src/routes/*.js`) only list steps. A route such as `router.put('/:id/upvote', rateLimit.writeLimiter, auth.requireAuth, reviewerAccess.loadReviewer, reviewerAccess.hideIfHidden, reviewersController.addUpvote)` is read left to right, and each step must pass before the next one runs.
- **Middleware** (`backend/src/middleware/*.js`) checks one thing and either calls `next()` to continue or passes an error to `next(err)`. Middleware also loads rows the controller needs, such as `req.user`, `req.reviewer`, and `req.saved`.
- **Controllers** (`backend/src/controllers/*.js`) check the input with `backend/src/utils/validate.js`, call model functions, shape the reply (study reviewers and saved items with `backend/src/utils/reviewerItems.js`), and send JSON. Controllers never contain SQL.
- **Models** (`backend/src/models/*.js`) hold every SQL statement, pass values only through `$1`, `$2` placeholders, and return plain rows. Models never see the request or the reply.

Errors from any layer travel to `backend/src/middleware/errorHandler.js`, which writes the error reply.

## What are the files in the utils and config folders of the Atlas backend?

The Atlas backend keeps shared helpers in `backend/src/utils/` and settings in `backend/src/config/`:

- `utils/validate.js`: every input check and limit, plus the search patterns.
- `utils/categories.js`: the allowed strands, grades, quarters, subjects, and material types.
- `utils/reviewerItems.js`: turns database rows into the JSON the website expects.
- `utils/httpError.js`: `createHttpError(status, message, fields)` builds an error that carries an HTTP status.
- `utils/fileContents.js`: checks that a file's bytes match its type.
- `utils/virusScan.js`: scans uploads with ClamAV when it is switched on.
- `utils/zipReader.js`: opens Word and PowerPoint files, which are ZIP archives.
- `utils/materialContent.js`: turns a stored file into material Gemini can read.
- `utils/gemini.js`: asks Google Gemini to write flashcards.
- `utils/rem.js`: passes a question from the Atlas Explorer chat to Rem RaaS and returns its answer.
- `utils/rateLimitStore.js`: keeps some rate limit counts in Postgres.
- `config/env.js`: reads `backend/.env`, checks it, and refuses to start on bad settings.
- `config/db.js`: the one shared database pool of the API.
- `config/createPool.js`: builds a Postgres connection pool.
- `config/firebaseAdmin.js`: verifies Firebase login tokens.

## Which outside systems does the Atlas backend talk to?

The Atlas backend talks to six things outside its own code:

1. **PostgreSQL** holds all data: users, study reviewers, upvotes, views, saved items with their notes, flashcards, reports, and some rate limit counts.
2. **The uploads folder on disk** (`UPLOAD_DIR`, by default `backend/uploads/`) holds the uploaded files under random names. A study reviewer is a database row plus one file, and the folder is created at start-up if it is missing.
3. **Firebase Authentication** is used only to check login tokens with Google's public keys. Atlas never receives or stores passwords.
4. **Google Gemini** is called only when a student makes flashcards. Without `GEMINI_API_KEY`, that one feature answers that it is not set up, and everything else keeps working.
5. **ClamAV**, the antivirus, is used only when `CLAMAV_MODE` is `daemon` or `command`.
6. **Rem RaaS**, the docs chat service, is called only for `POST /api/ask`, the Atlas Explorer chat. Without `RAAS_URL` and `RAAS_KEY`, that one address answers that it is not set up, and everything else keeps working.

The Atlas backend does not use Firestore, Firebase Storage, or any email service.

## What runs for every request in the Atlas API?

`backend/src/app.js` sets up the Atlas API in a fixed order, and every request passes the same steps before it reaches its route:

1. **Trust proxy**: when `TRUST_PROXY=true`, Express trusts exactly one proxy (`app.set('trust proxy', 1)`), so `req.ip` is the visitor's address, not the proxy's.
2. **No X-Powered-By**: `app.disable('x-powered-by')` stops the API from saying it runs Express.
3. **helmet()**: adds protective response headers.
4. **cors**: allows browser calls only from `FRONTEND_ORIGIN`, with the methods GET, POST, PUT, DELETE and the headers Authorization and Content-Type. The one exception is `/api/ask`, which allows any origin, POST only, with the header Content-Type. Browser preflight (OPTIONS) requests are answered here.
5. **generalLimiter**: at most 600 requests per 15 minutes per visitor.
6. **express.json**: reads JSON bodies of up to 512 KB.
7. **GET /api/health**: answers `{ "status": "ok" }`.
8. **Routers**: `/api/reviewers`, `/api/me`, `/api/saved`, `/api/admin`, and `/api/ask`, each with its own middleware chain.
9. **notFoundHandler**: a 404 for any address no route matched.
10. **errorHandler**: turns every error into the standard error reply.

The journey of one whole request is described in [How a request moves through the Atlas API](request-pipeline-and-middleware.md#what-are-the-steps-of-a-typical-atlas-api-request).

## What does an error reply from the Atlas API look like?

Every error from the Atlas API has the same JSON shape: an `error` object with a `message`, and sometimes `fields` or `detail`.

```
{
  "error": {
    "message": "Some details need fixing. Check the highlighted fields.",
    "fields": { "title": "Title must be between 3 and 120 characters." }
  }
}
```

- `message` is always present and is written for people, so the website can show it as it is.
- `fields` appears for form and upload problems. Each key is a form field (`title`, `file`, `notes`, `displayName`, `rightsConfirmed`, and so on), so the website can show each problem next to its input.
- `detail` appears only on a 500 error while `NODE_ENV` is not `production`, and holds the internal error message for the developer.

Controllers and middleware make these errors with `createHttpError(status, message, fields)` from `backend/src/utils/httpError.js`. The 429 replies of the rate limiters are sent by the limiters themselves, in the same shape.

## Which error messages does the Atlas API pass on, and which does it hide?

`backend/src/middleware/errorHandler.js` decides what the visitor of the Atlas API sees. It keeps a list called `SAFE_STATUSES`: every status from 400 to 499, plus 502 and 503 (used when Gemini fails or is not set up). Its rules, checked in this order:

1. A multer upload error becomes 413 `That file is too large. The limit is 10 MB.` (with the real limit), 400 `Upload one file at a time, in the "file" field.`, or 400 `The upload could not be read. Please try again.`
2. A JSON body over the 512 KB limit becomes 413 `The request is too large.`
3. JSON that cannot be parsed becomes 400 `The request could not be read. Check that it is valid.`
4. An error whose status is in `SAFE_STATUSES` keeps its status, its message, and its `fields`. This covers every error Atlas makes on purpose, and also the few other 4xx errors of Express's own body reader, which keep the library's own wording.
5. Everything else becomes 500 `Something went wrong on our side. Please try again.` The full error is printed to the server log, and in production the visitor never sees it.

So a database failure, a bug, or a crash inside a library always reaches the visitor as the same plain 500 message.

## What does the Atlas backend check before it starts?

`backend/src/server.js` loads `backend/src/config/env.js` first, so setting problems are explained before anything else can fail. When a setting is wrong, `stopWithMessage` prints `Atlas backend cannot start yet.`, a dashed line, the reason with steps to fix it, and stops the process with exit code 1. The Atlas backend refuses to start when:

- `DATABASE_URL is missing or is still the placeholder.`
- `FIREBASE_PROJECT_ID is empty.`
- `FIREBASE_AUTH_EMULATOR_HOST is set while NODE_ENV=production.` Emulator tokens are not signed, so anyone could forge a login.
- `CLAMAV_MODE is "...", which is not one of: off, daemon, command.` (with the wrong value in the quotes)

One more check only warns: with `NODE_ENV=production` and `CLAMAV_MODE=off`, it prints `Warning: CLAMAV_MODE is off, so uploads are not virus-scanned.` and starts anyway. Bad numbers do not stop the server: an invalid `MAX_FILE_SIZE_MB` becomes 10 and an invalid `MAX_UPLOADS_PER_USER` becomes 50. Postgres is not contacted at start-up, so the API starts even when the database is down; requests that need the database then fail with a 500.

## Which settings does backend/.env hold for the Atlas backend?

`backend/src/config/env.js` reads these settings from `backend/.env`, which is never committed (`backend/.env.example` is the template with placeholders):

- `DATABASE_URL`: the Postgres connection URL the API uses. Required.
- `MIGRATION_DATABASE_URL`: the table owner's URL for migrations and backups; when empty, `DATABASE_URL` is used.
- `DATABASE_SSL`: `true` encrypts the connection to Postgres.
- `FIREBASE_PROJECT_ID`: the Firebase project whose tokens are accepted. Required.
- `FIREBASE_AUTH_EMULATOR_HOST`: development only; forbidden with `NODE_ENV=production`.
- `FRONTEND_ORIGIN`: the one website address allowed to call the API from a browser (default: the local Vite development address).
- `PORT`: the port the API listens on (the code has a default for local development).
- `UPLOAD_DIR`: the uploads folder, by default `./uploads` inside `backend/`.
- `MAX_FILE_SIZE_MB`: the largest upload, by default 10.
- `MAX_UPLOADS_PER_USER`: the most study reviewers one person may have, by default 50.
- `TRUST_PROXY`: `true` when exactly one proxy sits in front of the API.
- `GEMINI_API_KEY`: the secret key for flashcards; empty turns flashcards off.
- `GEMINI_MODEL`: by default `gemini-3.5-flash-lite`.
- `CLAMAV_MODE`: `off` (the default), `daemon`, or `command`.
- `CLAMAV_SOCKET`: where the ClamAV service listens, for `daemon` mode.
- `RAAS_URL` and `RAAS_KEY`: the Rem RaaS docs service and its secret key, for the Explorer chat; empty turns the chat off.

`NODE_ENV=production` is set by whatever starts the API on the server; it hides error details from replies.

## What happens when the Atlas API's port is already in use?

When `backend/src/server.js` cannot open its port, the Atlas API prints a plain message and stops with exit code 1. If another program already uses the port (`EADDRINUSE`), the message is `Port ... is already in use. Stop the other program or change PORT in backend/.env.`, with the port number where the dots are. Any other start-up failure prints `The server could not start:` followed by the reason. On a normal start the server prints `Atlas API is running on http://localhost:` with the port number, then `Accepting browser requests from` with the `FRONTEND_ORIGIN` value, plus `Using the Firebase Auth EMULATOR (development only).` when the emulator is set.

## How does the Atlas backend shut down?

`backend/src/server.js` listens for two stop signals: `SIGINT` (Ctrl+C in a terminal) and `SIGTERM` (what process managers send). On either one, the Atlas backend shuts down gracefully:

1. `server.close()` stops taking new connections and waits for requests that are already running to finish.
2. `pool.end()` closes every Postgres connection.
3. The process exits with code 0.

The code sets no time limit for step 1, so a request that never finishes keeps the process waiting until the process manager stops it harder. The hourly clean-up timers of the Postgres rate limit store use `unref()`, which means they never keep the process alive on their own.

## How does the Atlas backend connect to PostgreSQL?

The Atlas backend uses one shared connection pool, made in `backend/src/config/db.js` from `DATABASE_URL` by `backend/src/config/createPool.js`. A pool keeps a few connections open and lends them out, instead of opening a new connection for every request. Its settings:

- `max: 10`: at most 10 connections at once; further queries wait for a free one.
- `connectionTimeoutMillis: 10000`: a query waits at most 10 seconds to get a connection, then fails.
- SSL is off unless `DATABASE_SSL=true`. Then the connection is encrypted, but the certificate is not verified (`rejectUnauthorized: false`), which suits a self-signed certificate.
- An `error` listener logs `Unexpected database connection error:` when an idle connection breaks, instead of crashing the process.

Migrations (`npm run db:migrate`) build their own pool from `MIGRATION_DATABASE_URL`. Most queries are single statements. The one multi-step change, replacing a set of flashcards, borrows one connection and wraps its statements in a transaction (`BEGIN`, then `COMMIT`, or `ROLLBACK` on failure), so a half-made set is never saved. When two quick requests try to insert the same row, the database's unique rules stop the second one (error code `23505`). For upvotes, saves, views, and new users the code treats that as success; for a second open report or a duplicate file it becomes a 409.

## How does the Atlas backend use Firebase Admin?

`backend/src/config/firebaseAdmin.js` uses the `firebase-admin` package for one thing only: checking that a login token is genuine. It calls `initializeApp({ projectId })` with just the project id from `FIREBASE_PROJECT_ID`. No service-account key file is stored on the server, because verifying ID tokens needs only Google's public keys.

`verifyIdToken(token)` checks that the token was signed by Google for this Firebase project and has not expired. What the Atlas backend does not do with Firebase Admin:

- It does not create, change, or delete Firebase accounts. When a student deletes their account, the website deletes the Firebase login after the API has deleted the Atlas data.
- It does not check whether a token was revoked (the `checkRevoked` option is not used), so a token stays valid until it expires, about one hour after it was issued.
- It does not use custom claims. Whether someone is an admin is stored in the `users.role` column in Postgres.

## How are the Atlas database tables created and updated?

`npm run db:migrate` runs `backend/db/migrate.js`, which sends the whole of `backend/db/schema.sql` to Postgres as one block. Every statement in the Atlas schema uses `IF NOT EXISTS` or a similar guard, so running it again changes nothing that already exists and only adds what is new. The tables are `users`, `reviewers`, `upvotes`, `recently_viewed`, `saved_items` (which also holds the notes), `flashcards`, `reports`, and `rate_limits`. Migrations connect with `MIGRATION_DATABASE_URL`, the user that owns the tables, or with `DATABASE_URL` when that is empty. When a migration fails, the script prints the Postgres error code and one plain next step, for example `The user name or password in DATABASE_URL is not correct.` There is no migration history table and no undo migration: the schema file is the single description of the database.

## Where does the live Atlas backend run?

The Atlas website is served by Firebase Hosting at https://atlas-f2757.web.app. The live Atlas API answers at https://api.140-245-60-8.sslip.io, on the project's own server, where the API process runs under pm2. In front of the API sits Envoy Gateway, running on k3s (a small Kubernetes). Envoy ends the HTTPS connection (TLS), forwards the request to the API, and gives each request 60 seconds to be answered. The API runs with `TRUST_PROXY=true`, so it trusts exactly that one proxy hop when it reads the visitor's address. Postgres runs on the same server and has no public port. The full path is in [Where Atlas runs and how traffic reaches it](hosting-and-traffic-path.md#how-does-a-request-reach-the-atlas-api).

The README and a comment in `backend/src/app.js` still mention nginx, the proxy used before Envoy; the API only needs exactly one proxy in front of it. On 2026-11-01 the live API runs the code deployed on 2026-10-29. The new search ranking (word-start matching, and titles that start with the search ranked first) is not merged or deployed yet, so it is not live. On the live server ClamAV is installed and set to daemon mode, and the least-privilege database role `learnhub_api` exists (both checked 2026-10-31). Still to do: the EICAR test upload that confirms the virus scan end to end, and the nightly backups.
