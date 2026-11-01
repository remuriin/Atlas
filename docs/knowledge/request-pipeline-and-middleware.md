# How a request moves through the Atlas API

Every request to the Atlas API passes through the same series of steps: the proxy in front of the server, a set of checks that run for every request, the checks of its own route, a controller, and the database. This page follows one request from start to finish, then explains each file in `backend/src/middleware/`: what it checks, on which routes it runs, in which order, and which status codes and messages it answers with.

## What are the steps of a typical Atlas API request?

Take a logged-in student who upvotes study reviewer 42. The Atlas website sends `PUT /api/reviewers/42/upvote` with the header `Authorization: Bearer` followed by the student's Firebase ID token. The request then moves through these steps:

1. **Envoy Gateway** receives it over HTTPS, ends the TLS encryption, adds the visitor's address to the `X-Forwarded-For` header, and passes it to the API.
2. **Express settings** in `backend/src/app.js`: with `TRUST_PROXY=true`, `req.ip` becomes the visitor's address.
3. **helmet** adds protective headers to the reply.
4. **cors** adds `Access-Control-Allow-Origin` with the Atlas website's address.
5. **generalLimiter** counts the request against 600 per 15 minutes.
6. **express.json** reads a JSON body, if there is one.
7. **The router** for `/api/reviewers` finds the route `PUT /:id/upvote` and runs its chain: `writeLimiter`, `requireAuth`, `loadReviewer`, `hideIfHidden`.
8. **The controller** `addUpvote` in `backend/src/controllers/reviewersController.js` asks the models to add the upvote if it is missing, then to count the upvotes.
9. **The reply** is JSON: `{ "upvoteCount": 5, "hasUpvoted": true }`.

If any step calls `next(err)`, Express skips the remaining steps and runs `backend/src/middleware/errorHandler.js`, which sends the standard error reply. If no route matches, the 404 handler answers instead.

## Which headers does helmet add to Atlas API replies?

`app.use(helmet())` in `backend/src/app.js` runs helmet 8 with its default settings on every reply of the Atlas API, including error replies and file downloads:

- `Content-Security-Policy` with helmet's default policy: scripts only from the API's own address, no plugin objects, and framing only by the API's own address.
- `Cross-Origin-Resource-Policy: same-origin`, so other websites cannot embed API replies directly, and `Cross-Origin-Opener-Policy: same-origin`, which cuts the link between an API page and a window from another site that opened it.
- `Origin-Agent-Cluster: ?1`.
- `Referrer-Policy: no-referrer`.
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`, which tells browsers to use only HTTPS for the API for a year.
- `X-Content-Type-Options: nosniff`, so browsers trust the declared file type instead of guessing it.
- `X-DNS-Prefetch-Control: off`, `X-Download-Options: noopen`, `X-Frame-Options: SAMEORIGIN`, `X-Permitted-Cross-Domain-Policies: none`, and `X-XSS-Protection: 0`.

Helmet also removes `X-Powered-By`, and `app.disable('x-powered-by')` makes sure Express never sends it. Atlas does not change any helmet default.

## How does CORS work in the Atlas API?

CORS (cross-origin resource sharing) is the browser rule that decides whether a web page on one address may read replies from another address. The Atlas website and the Atlas API live on different addresses, so the API must allow the website. `backend/src/app.js` configures the `cors` package with:

- `origin`: exactly one address, `FRONTEND_ORIGIN` from `backend/.env`. Every reply carries `Access-Control-Allow-Origin` with that one address, so browsers let only the Atlas website read the replies.
- `methods`: GET, POST, PUT, and DELETE.
- `allowedHeaders`: Authorization and Content-Type.

Browser preflight requests (OPTIONS) are answered by `cors` with status 204 before any rate limiter runs. Atlas uses no cookies and does not allow credentials in the CORS sense: the login travels in the `Authorization` header. No extra reply headers are exposed to the website's JavaScript. CORS is enforced only by browsers: a script or a tool such as curl can still call the API, so the real protection is the login, owner, and admin checks on each route.

## How does the Atlas API read request bodies?

The Atlas API reads two kinds of request bodies:

- **JSON**: `express.json({ limit: '512kb' })` in `backend/src/app.js` reads bodies sent with `Content-Type: application/json`. The largest body Atlas expects is formatted notes of up to 100,000 characters, which can reach about 400 KB once accents and other alphabets are encoded. A larger body is refused with 413 `The request is too large.`, and JSON that cannot be parsed gets 400 `The request could not be read. Check that it is valid.`
- **Multipart forms with a file**: `express.json` ignores these. Only the two upload routes, `POST /api/reviewers` and `PUT /api/reviewers/:id`, read them, with multer (`backend/src/middleware/upload.js`), and only after the login checks have passed.

When a request has no JSON body, Express 5 leaves `req.body` undefined, so the controllers read it as `req.body || {}` and treat missing fields as empty. Values are then checked by `backend/src/utils/validate.js`, never trusted as they arrive.

## What happens when no Atlas API route matches?

When no route matches the method and the address, `notFoundHandler` in `backend/src/middleware/errorHandler.js` answers 404 with `{ "error": { "message": "That address does not exist on this API." } }`. A wrong method on a real address, such as PATCH on `/api/reviewers/1`, gets the same 404.

Two details surprise people. First, the routers for `/api/me`, `/api/saved`, and `/api/admin` check the login for every address under them before they look for a route. So an unknown address such as `/api/me/unknown` answers 401 without a valid token, and an unknown address under `/api/admin` answers 403 for a logged-in non-admin; only after those checks does the 404 appear. Second, an address like `/api/reviewers/abc` matches the `/:id` route, so it answers 400 `That study reviewer id is not valid.` rather than 404; in the same way `/api/saved/abc` answers 400 `That saved item id is not valid.` after the login check.

## In which order does middleware run on the /api/reviewers routes?

Each route in `backend/src/routes/reviewersRoutes.js` lists its steps left to right, after the global steps of `backend/src/app.js` (helmet, cors, generalLimiter, express.json):

- `GET /api/reviewers`: optionalAuth, listReviewers
- `GET /api/reviewers/:id`: optionalAuth, loadReviewer, hideIfHidden, getReviewer
- `GET /api/reviewers/:id/file`: optionalAuth, loadReviewer, hideIfHidden, sendReviewerFile
- `POST /api/reviewers`: writeLimiter, requireAuth, checkUploadQuota, upload.single, checkUpload, createReviewer
- `PUT /api/reviewers/:id`: writeLimiter, requireAuth, loadReviewer, requireOwner, upload.single, checkUpload, updateReviewer
- `DELETE /api/reviewers/:id`: writeLimiter, requireAuth, loadReviewer, requireOwner, deleteReviewer
- `PUT /api/reviewers/:id/upvote`: writeLimiter, requireAuth, loadReviewer, hideIfHidden, addUpvote
- `DELETE /api/reviewers/:id/upvote`: writeLimiter, requireAuth, loadReviewer, removeUpvote
- `PUT /api/reviewers/:id/save`: writeLimiter, requireAuth, loadReviewer, hideIfHidden, saveReviewer
- `DELETE /api/reviewers/:id/save`: writeLimiter, requireAuth, loadReviewer, unsaveReviewer
- `POST /api/reviewers/:id/view`: writeLimiter, requireAuth, loadReviewer, hideIfHidden, recordView
- `POST /api/reviewers/:id/report`: writeLimiter, requireAuth, loadReviewer, hideIfHidden, reportReviewer

On these routes the write limit runs before the login check, so attempts without a login also use up the visitor's write allowance. Removing an upvote or a save skips `hideIfHidden`, so people can still undo them after a study reviewer is hidden.

## In which order does middleware run on the /api/me, /api/saved and /api/admin routes?

The routers for `/api/me`, `/api/saved`, and `/api/admin` begin with `router.use(...)`, which runs the login check, and for admin also the admin check, before every route under them. After the global steps from `backend/src/app.js`:

- `GET /api/me`, `GET /api/me/reviewers`, `GET /api/me/recently-viewed`, `GET /api/me/saved`: requireAuth, then the controller
- `PUT /api/me`, `DELETE /api/me`: requireAuth, writeLimiter, then updateMe or deleteMe
- `GET /api/saved/:savedId`, `GET /api/saved/:savedId/flashcards`: requireAuth, loadSavedItem, then the controller
- `DELETE /api/saved/:savedId`, `DELETE /api/saved/:savedId/flashcards`: requireAuth, writeLimiter, loadSavedItem, then the controller
- `PUT /api/saved/:savedId/notes`: requireAuth, studyLimiter, loadSavedItem, updateNotes
- `POST /api/saved/:savedId/flashcards`: requireAuth, writeLimiter, loadSavedItem, flashcardLimiter, createFlashcards
- `PUT /api/saved/:savedId/flashcards/:cardId`: requireAuth, studyLimiter, loadSavedItem, updateFlashcardStatus
- `GET /api/admin/reports`: requireAuth, requireAdmin, listReports
- `POST /api/admin/reviewers/:id/restore`, `PUT /api/admin/reviewers/:id/category`, `DELETE /api/admin/reviewers/:id`: requireAuth, requireAdmin, writeLimiter, loadReviewer, then the controller

Admin routes use `loadReviewer` but not `hideIfHidden`, because admins must reach hidden study reviewers.

## What does requireAuth check?

`requireAuth` in `backend/src/middleware/auth.js` is the login check for Atlas routes that need a logged-in user. It runs these steps:

1. It reads the `Authorization` header, which must start with `Bearer ` and a token. A missing header, another scheme, or an empty token answers 401 `Please log in to do that.`
2. It verifies the Firebase ID token with `firebase-admin`. Any failure (expired, made for another project, damaged, or Google's keys could not be fetched) answers 401 `Your session has expired. Please log in again.`
3. It finds the user's row in the `users` table by Firebase user id, or creates it the first time (find-or-create). A new user's display name is the name in the token, else the part of the email before the @ sign, cut to 50 characters, or `New member` when that is shorter than 2 characters. If two first requests race, the unique rule on `firebase_uid` stops the second insert and the row is read again.
4. It stores the row on `req.user` and the token's `auth_time` (when the person last typed a password or chose a Google account) on `req.authTime`, then continues.

A database failure in step 3 becomes a 500. `requireAuth` runs on every route that changes data and on every route under `/api/me`, `/api/saved`, and `/api/admin`.

## What does optionalAuth do?

`optionalAuth` in `backend/src/middleware/auth.js` serves the public Atlas routes `GET /api/reviewers`, `GET /api/reviewers/:id`, and `GET /api/reviewers/:id/file`. It never refuses a request because of the login:

- With no token, or with a token that fails verification, it sets `req.user` to `null` and the request continues as a visitor. An expired login never stops someone from simply browsing.
- With a valid token, it finds or creates the user's row exactly like `requireAuth` and stores it on `req.user`. The reply can then say whether this user has upvoted or saved each study reviewer and whether they uploaded it, and the uploader or an admin can open a hidden study reviewer.

`optionalAuth` does not set `req.authTime`. Its only possible error is a database failure while finding or creating the user, which becomes a 500.

## What does requireAdmin check?

`requireAdmin` in `backend/src/middleware/auth.js` runs after `requireAuth` on every Atlas route under `/api/admin`. It checks the `role` column of the logged-in user's row in the `users` table. Only the role `admin` may continue; anyone else gets 403 `Only admins can do that.` The role is not part of the Firebase token: it is set by hand in the database with an SQL `UPDATE` on `users`, and `member` is the default for everyone. There is no admin sign-up and no API endpoint that changes roles. A change of role takes effect on the very next request, because `requireAuth` reads the row again on every request.

## What does loadReviewer check?

`loadReviewer` in `backend/src/middleware/reviewerAccess.js` runs on every Atlas route with `:id` in its address, under `/api/reviewers` and `/api/admin/reviewers`. It does two things:

1. It checks the id with `parseId` from `backend/src/utils/validate.js`: the id must be digits only, at most 10 of them, with a value from 1 to 2147483647 (the largest Postgres INTEGER). Anything else answers 400 `That study reviewer id is not valid.`
2. It loads the study reviewer, with its author name and upvote count, using `findReviewerById` from `backend/src/models/reviewersModel.js`. If no such row exists, it answers 404 `That study reviewer could not be found.`

The row is stored on `req.reviewer` for the next steps. Checking the id first means a bad id never reaches the database, so it cannot cause a database error and a 500.

## What do requireOwner and hideIfHidden check?

Both checks are in `backend/src/middleware/reviewerAccess.js` and use the study reviewer row that `loadReviewer` stored on `req.reviewer`.

- `requireOwner` runs after `requireAuth` on `PUT /api/reviewers/:id` and `DELETE /api/reviewers/:id`. Only the uploader (the row's `author_id` equals the user's id) may continue. Anyone else, admins included, gets 403 `Only the person who uploaded this study reviewer can change it.` On edits it runs before the upload step, so strangers cannot put files on the disk. Admins remove study reviewers through `DELETE /api/admin/reviewers/:id` instead.
- `hideIfHidden` runs on the routes that show or use a study reviewer: `GET /api/reviewers/:id`, `GET /api/reviewers/:id/file`, `PUT /api/reviewers/:id/upvote`, `PUT /api/reviewers/:id/save`, `POST /api/reviewers/:id/view`, and `POST /api/reviewers/:id/report`. When reports have hidden the study reviewer (`is_hidden` is true), everyone except its uploader and the admins gets 404 `That study reviewer could not be found.`, the same answer as for one that does not exist. Visitors without a login always get the 404 for a hidden study reviewer.

## What does checkUploadQuota check?

`checkUploadQuota` in `backend/src/middleware/reviewerAccess.js` runs only on `POST /api/reviewers`, after `requireAuth` and before the file is read. It counts the study reviewers the user has now, hidden ones included, with `countReviewersByAuthor`. When the count has reached `MAX_UPLOADS_PER_USER` (50 by default), it answers 403 `You have 50 study reviewers, the most one person can share. Delete one from your profile to upload another.`, with the number taken from the setting. Replacing the file of an existing study reviewer does not count, and deleting one frees a place. `GET /api/me` returns `uploadCount` and `uploadLimit`, so the Atlas website can show the limit before anyone picks a file.

## What does loadSavedItem check?

`loadSavedItem` in `backend/src/middleware/savedAccess.js` runs after `requireAuth` on every Atlas route under `/api/saved/:savedId`. It does three things:

1. It checks the saved item id with `parseId`. A bad id answers 400 `That saved item id is not valid.`
2. It loads the saved item, joined with its study reviewer's current details, with `findSavedById`.
3. If the row is missing, or belongs to someone else, it answers 404 `That saved item could not be found.`

Someone else's saved item gets the same 404 as a missing one on purpose: trying ids one by one cannot reveal what other people saved. The row is stored on `req.saved`. The flashcard routes rely on it too, because a card can only be read or changed through the saved item it belongs to.

## What does the upload middleware in upload.js do?

`backend/src/middleware/upload.js` sets up multer, the package that receives files, and exports `upload.single`, which accepts one file in the form field named `file`. It runs only on `POST /api/reviewers` and `PUT /api/reviewers/:id`, after the login, quota, and owner checks. Its rules:

- **Allowlist**: the file name's extension and the browser's content type must match one pair: `.pdf` with `application/pdf`, `.docx` and `.pptx` with their Office types, `.txt` with `text/plain`, `.png` with `image/png`, and `.jpg` or `.jpeg` with `image/jpeg`. Otherwise it answers 415 `That file type is not allowed. Upload a PDF, Word, PowerPoint, text, PNG, or JPG file.` before anything is written to disk. Old `.doc` and `.ppt` files are not accepted.
- **Limits**: one file of at most `MAX_FILE_SIZE_MB` (10 MB by default), and at most 10 text fields of up to 20 KB each. The error handler turns a broken limit into 413 or 400, and multer deletes any partly written file.
- **Stored name**: a random 32-character hex name plus the allowed extension, never the visitor's file name, so a name like `../../server.js` cannot escape the uploads folder.
- **Display name**: the original name is kept for showing and downloading, without folder parts or control characters, and at most 200 characters long.

## What does checkUpload.js do after a file arrives?

`backend/src/middleware/checkUpload.js` runs right after `upload.single` on the two Atlas upload routes, before anything about the file is saved in the database. With no file (an edit of the text only) it simply continues. With a file:

1. It reads the whole file (at most 10 MB by default) and checks with `backend/src/utils/fileContents.js` that its bytes match its extension, for example that a PDF starts with `%PDF-` and holds no scripts or attached files. A mismatch answers 415 with a message such as `This file is not a real PDF.`
2. It runs the virus scan of `backend/src/utils/virusScan.js`. If the scanner itself fails, it answers 503 `Uploads are paused because the virus scan is not working. Try again in a few minutes.` If the scan finds something, it answers 422 `The virus scan flagged this file as unsafe, so it was not uploaded.` and logs the threat name with the user id. With `CLAMAV_MODE=off` the scan always passes.
3. It stores the file's SHA-256 fingerprint on `req.fileHash`, which the controller uses to refuse the same file twice.

Every refused file is deleted from disk at once, and every refusal carries `fields.file`. An unexpected failure during these checks also deletes the file and then becomes a 500. Each check is explained in [Uploads and file safety in Atlas](uploads-and-file-safety.md#how-does-atlas-check-an-uploaded-file).

## Which rate limiters run in the Atlas API pipeline?

`backend/src/middleware/rateLimit.js` defines four limiters, and each runs at a fixed place in the Atlas API pipeline:

- `generalLimiter` (600 requests per 15 minutes per visitor) runs for every request, in `backend/src/app.js`, right after cors.
- `writeLimiter` (120 per 15 minutes per visitor) runs on every route that changes data, except notes and flashcard marks. Under `/api/reviewers` it runs before the login check; under `/api/me`, `/api/saved`, and `/api/admin` it runs after it.
- `studyLimiter` (600 per 15 minutes per visitor) runs on `PUT /api/saved/:savedId/notes` and `PUT /api/saved/:savedId/flashcards/:cardId`.
- `flashcardLimiter` (10 per 24 hours per account) runs on `POST /api/saved/:savedId/flashcards`, after `writeLimiter` and `loadSavedItem`.

A refused request gets 429 with the standard error shape and never reaches its controller. The windows, the stores, the messages, and the side effects are explained in [Rate limits in Atlas](rate-limits.md#which-rate-limits-does-atlas-use).

## What does errorHandler.js do?

`backend/src/middleware/errorHandler.js` holds the last two steps of every request in the Atlas API:

- `notFoundHandler` answers 404 `That address does not exist on this API.` when no route matched.
- `errorHandler` receives every error passed to `next(err)` and writes the reply `{ "error": { "message": "..." } }`. It turns multer upload errors into 413 (file too large) or 400, a JSON body over 512 KB into 413 `The request is too large.`, and broken JSON into 400 `The request could not be read. Check that it is valid.` An error whose status is from 400 to 499, or 502 or 503, keeps its status, its message, and its `fields`. Anything else becomes 500 `Something went wrong on our side. Please try again.`

For a 500, the full error is written to the server log with `console.error`. While `NODE_ENV` is not `production`, the reply also carries `detail` with the internal message, to help during development; in production it never does. Express knows `errorHandler` is an error handler because the function takes four arguments.

## Why does Atlas check login and upload quota before reading the file?

On `POST /api/reviewers` the order is `writeLimiter`, `requireAuth`, `checkUploadQuota`, `upload.single`, `checkUpload`, and only then `createReviewer`. On `PUT /api/reviewers/:id` it is `writeLimiter`, `requireAuth`, `loadReviewer`, `requireOwner`, `upload.single`, `checkUpload`, `updateReviewer`. The Atlas API only reads the file and writes it to disk at `upload.single`, so every step before it is cheap and refuses early:

- Someone who sends too many changes gets 429.
- Someone who is not logged in gets 401.
- Someone at the upload limit gets 403.
- On an edit, someone who is not the uploader gets 403.

In each case the file is never stored, checked, or scanned. This keeps strangers and spammers from filling the server's disk and saves the work of handling a 10 MB file for a request that would be refused anyway. After the file arrives, `checkUpload` deletes it at once if it fails a check, and the controllers delete it if saving the database row fails, so no file is ever left without an owner.
