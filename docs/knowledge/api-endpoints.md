# Atlas API endpoints

The Atlas API is the JSON web service behind the Atlas website. This page lists every endpoint in `backend/src/routes/` plus the health check: who may call it, which checks and rate limits run first, what to send, what comes back, and the main errors. It describes the code in the repository. On 2026-11-01 the live API runs the code deployed on 2026-10-29, which does not have the new search ranking yet, so search results can differ on the live site.

## What are the conventions of the Atlas API?

The Atlas API follows the same conventions on every endpoint:

- **Base URL**: the live API is https://api.140-245-60-8.sslip.io. On a developer's computer it is http://localhost with the port set in `PORT` in `backend/.env`. Every path starts with `/api`.
- **Format**: requests and replies are JSON, except uploads (multipart form data) and file downloads (the file itself).
- **Login**: send the header `Authorization: Bearer` followed by a space and the Firebase ID token. The website gets the token from the Firebase client with `getIdToken()`, which renews it before it expires (tokens last about an hour).
- **Errors**: always `{ "error": { "message": "..." } }`, plus `fields` for form problems and `detail` only on a 500 outside production.
- **Pagination**: only `GET /api/reviewers` has pages. It takes `page` (from 1) and `limit` (default 12, maximum 50; a bigger number is lowered to 50) and returns `{ "items": [...], "page": 1, "hasMore": true }`. `hasMore` is true when at least one more item exists. Other lists return `{ "items": [...] }` with everything at once.
- **Ids**: ids in addresses are whole numbers from 1 to 2147483647; anything else is a 400.
- **Limits**: every request counts toward a general limit of 600 per 15 minutes; changes also count toward stricter limits, see [Rate limits in Atlas](rate-limits.md#which-rate-limits-does-atlas-use).

## Which status codes does the Atlas API use?

The Atlas API uses these HTTP status codes:

- 200: success.
- 201: something was created, by `POST /api/reviewers`, `POST /api/reviewers/:id/report`, or `POST /api/saved/:savedId/flashcards`.
- 400: the input is wrong; `fields` often names the field.
- 401: not logged in, the login expired, or, for account deletion only, the login is not recent enough.
- 403: logged in but not allowed: not the uploader, not an admin, at the upload limit, or reporting your own study reviewer.
- 404: not found, which includes hidden study reviewers and other people's saved items.
- 409: a conflict: the same file is already on Atlas, an open report already exists, or the original study reviewer was deleted before flashcards were made.
- 413: the file or the request body is too large.
- 415: the file type or its contents are not allowed.
- 422: the virus scan flagged the file, or flashcards cannot be made from the material.
- 429: a rate limit was reached.
- 500: an unexpected error; the message is always `Something went wrong on our side. Please try again.`
- 502 and 503: the flashcard service (Gemini) failed, is busy, or is not set up; 503 also when the virus scanner is not working.

## Which endpoints does the Atlas API have?

The Atlas API has 30 endpoints. In brackets: "anyone" needs no login, "optional" works for anyone and adds details for logged-in users, "user" needs a login, "owner" means only the uploader, "mine" means the saved item must be the user's own, and "admin" means only admins.

- `GET /api/health` (anyone)
- `GET /api/reviewers`, `GET /api/reviewers/:id`, `GET /api/reviewers/:id/file` (optional)
- `POST /api/reviewers` (user)
- `PUT /api/reviewers/:id` and `DELETE /api/reviewers/:id` (owner)
- `PUT /api/reviewers/:id/upvote` and `DELETE /api/reviewers/:id/upvote` (user)
- `PUT /api/reviewers/:id/save` and `DELETE /api/reviewers/:id/save` (user)
- `POST /api/reviewers/:id/view` and `POST /api/reviewers/:id/report` (user)
- `GET /api/me`, `PUT /api/me`, `DELETE /api/me` (user)
- `GET /api/me/reviewers`, `GET /api/me/recently-viewed`, `GET /api/me/saved` (user)
- `GET /api/saved/:savedId` and `DELETE /api/saved/:savedId` (mine)
- `PUT /api/saved/:savedId/notes` (mine)
- `GET /api/saved/:savedId/flashcards`, `POST /api/saved/:savedId/flashcards`, `DELETE /api/saved/:savedId/flashcards` (mine)
- `PUT /api/saved/:savedId/flashcards/:cardId` (mine)
- `GET /api/admin/reports` (admin)
- `POST /api/admin/reviewers/:id/restore`, `PUT /api/admin/reviewers/:id/category`, `DELETE /api/admin/reviewers/:id` (admin)

The routes are defined in `backend/src/routes/reviewersRoutes.js`, `meRoutes.js`, `savedRoutes.js`, and `adminRoutes.js`; the health check is in `backend/src/app.js`.

## What does a study reviewer object contain in the Atlas API?

Several Atlas API endpoints return study reviewers in the same shape, built by `toReviewerJson` in `backend/src/utils/reviewerItems.js`:

- `id`, `title`, `description`
- `strand`, `grade`, `quarter`, `subject`, `materialType`
- `tags`: a list of lowercase words, for example `["calculus", "midterm"]`
- `authorName`: the uploader's display name, never their email
- `fileName`, `fileMime`, `fileSize` (in bytes)
- `upvoteCount`: counted fresh from the `upvotes` table
- `hasUpvoted`, `isSaved`, `savedId`: about the logged-in user; false or null for visitors
- `isOwner`: true when the logged-in user uploaded it
- `isHidden`: true when reports hid it; only the uploader and admins can ever receive a hidden one
- `createdAt`, `updatedAt`

A study reviewer object never contains the file itself, the file's name on disk, its fingerprint, or who reported it. The file comes from `GET /api/reviewers/:id/file`.

## What does a saved item object contain in the Atlas API?

`GET /api/me/saved` and `GET /api/saved/:savedId` return saved items in the shape built by `toSavedJson` in `backend/src/utils/reviewerItems.js`:

- `id`: the saved item id, used in the `/api/saved/:savedId` addresses
- `reviewerId`: the study reviewer's id, or null after it was deleted
- `isRemoved`: true when the original was deleted by its uploader, by an admin, or with the uploader's account
- `title`, `subject`, `strand`: the live values, or, once the original is gone, the copies Atlas keeps for that case (updated whenever the original was edited)
- `hasNotes`: true when the notes contain visible text
- `notesUpdatedAt`, `flashcardCount`, `savedAt`
- `reviewer`: null when the original was removed, otherwise `{ id, description, grade, quarter, materialType, tags, authorName, fileName, fileMime, fileSize, upvoteCount, createdAt }`

`GET /api/saved/:savedId` adds `notes`, the stored notes, and `notesFormat`: `html`, or `text` for notes written before formatting existed. Notes are only ever sent to their owner.

## What does GET /api/health do?

`GET /api/health` answers `{ "status": "ok" }` with status 200. Anyone can call it, without a login. It is defined directly in `backend/src/app.js`, so it passes helmet, cors, the general limit of 600 requests per 15 minutes, and the JSON reader like every other request, but no route middleware. It shows only that the Atlas API process is running and answering. It does not check the database, the uploads folder, Firebase, Gemini, or ClamAV, so it can answer "ok" while the database is down.

## What does GET /api/reviewers do?

`GET /api/reviewers` returns the Atlas feed of study reviewers. Anyone can call it; a login is optional (`optionalAuth`) and only adds `hasUpvoted`, `isSaved`, `savedId`, and `isOwner` for that user. Only the general limit applies. All query parameters are optional:

- `sort`: `top` (most upvotes first, the default) or `new` (newest first). Anything else answers 400 `"sort" must be top or new.`
- `strand`, `grade`, `quarter`, `subject`: filters. A value that is not in the lists of `backend/src/utils/categories.js` is ignored, so an old link still loads. A strand filter also shows study reviewers filed under "All strands".
- `q`: search words, cut to 100 characters.
- `page`: from 1. `limit`: default 12, maximum 50 (a bigger number becomes 50). Both must be whole numbers from 1 to 999999, otherwise 400, for example `"page" must be a whole number of 1 or more.`

The reply is `{ "items": [...], "page": 1, "hasMore": true }`, where each item is a study reviewer object. The API asks the database for one row more than `limit`; if it comes back, `hasMore` is true. Ties are broken by the newest first, then the highest id. Study reviewers hidden by reports never appear in the feed, not even for their uploader or admins.

## How does search work in GET /api/reviewers?

The `q` parameter of `GET /api/reviewers` searches the Atlas feed. The rules live in `buildSearchWords` and `buildSearchStart` in `backend/src/utils/validate.js` and in `FILTER_BY_CATEGORY_AND_SEARCH` and `SEARCH_SCORE` in `backend/src/models/reviewersModel.js`:

- The text is trimmed, cut to 100 characters, and split at spaces. Only the first 8 words count.
- A study reviewer matches only when every word is found in its title, description, tags, subject, strand, material type, or uploader's display name, taken together. Case does not matter.
- Each word must match at the start of a word: `chem` finds "chemistry", and `stem` finds "STEM" but not "systems". A word that starts with a symbol, such as `(2)`, may match anywhere.
- Symbols are searched for as they are, so `c++` looks for "c++".
- Matches are ranked before the chosen sort. A title that starts with the whole search gets 100 points. Each word then adds 3 points if it is in the title, otherwise 2 if it is in the tags or subject, otherwise 1.
- Within the same score, `sort=top` orders by upvotes and `sort=new` by date. Without a search every study reviewer scores 0, so the plain sort applies.

Search combines with the filters, and hidden study reviewers are never found. On 2026-11-01 the word-start matching and the title bonus are not live yet, because the new search ranking is not merged or deployed. More examples: [Search and the feed in Atlas](search-and-feed.md#how-does-atlas-search-match-study-reviewers).

## What does GET /api/reviewers/:id do?

`GET /api/reviewers/:id` returns one study reviewer object. Anyone can call it; a login is optional (`optionalAuth`) and only adds the user's own details such as `hasUpvoted`, `isSaved`, and `isOwner`. Only the general limit applies. The chain is `optionalAuth`, `loadReviewer`, `hideIfHidden`, `getReviewer`. Errors:

- 400 `That study reviewer id is not valid.` for an id that is not a whole number from 1 to 2147483647.
- 404 `That study reviewer could not be found.` when it does not exist, and also when reports have hidden it and the caller is not its uploader or an admin.

Opening a study reviewer this way never changes any data. The Atlas website records a view separately, with `POST /api/reviewers/:id/view`.

## What does GET /api/reviewers/:id/file do?

`GET /api/reviewers/:id/file` sends the uploaded file itself, not JSON. Anyone can call it and a login is optional, but the uploader and admins must send their login to open a file that reports have hidden. Only the general limit applies. The chain is `optionalAuth`, `loadReviewer`, `hideIfHidden`, `sendReviewerFile`.

- PDF, PNG, and JPG files are sent with `Content-Disposition: inline`, so the browser shows them. Every other type (Word, PowerPoint, text, and old `.doc` or `.ppt` files) is sent as `attachment`, a download.
- Adding `?download=1` always makes it a download.
- The reply sets `Content-Type` to the type stored at upload time (taken from the allowlist, not from what the browser claimed), `Content-Length`, a download name that works in old and new browsers, and `X-Content-Type-Options: nosniff`.

Errors: 400 for a bad id, 404 `That study reviewer could not be found.` (missing or hidden), and 404 `The file for this study reviewer is missing.` when the database row exists but the file is not on disk.

## What does POST /api/reviewers do?

`POST /api/reviewers` uploads a new study reviewer. Only logged-in users can call it. The chain is `writeLimiter`, `requireAuth`, `checkUploadQuota`, `upload.single`, `checkUpload`, `createReviewer`. The body is multipart form data with:

- `file`: exactly one PDF, DOCX, PPTX, TXT, PNG, or JPG file of at most `MAX_FILE_SIZE_MB` (10 MB by default)
- `title` (3 to 120 characters) and `description` (10 to 2000 characters)
- `strand`, `grade`, `quarter`, `subject`, `materialType`: values from `backend/src/utils/categories.js`; the subject must belong to the strand
- `tags` (optional): comma-separated, at most 8, each at most 30 characters; stored in lowercase without repeats
- `rightsConfirmed`: the text `true`, meaning "I made this file, or I have the right to share it"

The reply is 201 with the new study reviewer object. Main errors: 429 write limit; 401 not logged in; 403 at the upload limit; 413 file too large; 415 wrong type or contents; 422 flagged by the virus scan; 503 scanner not working; 400 `Choose a file to upload.`, `Some details need fixing. Check the highlighted fields.` (with `fields`), or `Confirm that you made this file or have the right to share it.`; and 409 when the exact same file is already on Atlas, with a message that names that study reviewer. A refused file is deleted from disk.

## What does PUT /api/reviewers/:id do?

`PUT /api/reviewers/:id` edits a study reviewer. Only its uploader can call it; admins cannot. The chain is `writeLimiter`, `requireAuth`, `loadReviewer`, `requireOwner`, `upload.single`, `checkUpload`, `updateReviewer`. The body is multipart form data (or JSON when no new file is sent) with the same text fields as `POST /api/reviewers`: `title`, `description`, `strand`, `grade`, `quarter`, `subject`, `materialType`, and `tags`. All of them except `tags` are required every time, because an edit replaces them all; leaving `tags` out clears the tags. A new `file` is optional:

- Without a file, only the text changes and no rights confirmation is needed.
- With a file, `rightsConfirmed` must be `true`, the file passes the same checks as a new upload, and the old file is deleted from disk once the database points at the new one. Replacing a file does not count toward the upload limit, and uploading the study reviewer's own current file again is allowed.

Saved copies get the new title, subject, and strand too. The reply is 200 with the updated study reviewer object. Main errors: 400 bad id or bad fields, 401, 403 `Only the person who uploaded this study reviewer can change it.`, 404, 409 same file already on Atlas, 429 write limit, and the upload errors 413, 415, 422, and 503. A hidden study reviewer can still be edited by its uploader, and editing does not unhide it.

## What does DELETE /api/reviewers/:id do?

`DELETE /api/reviewers/:id` deletes a study reviewer and its file. Only its uploader can call it; admins use `DELETE /api/admin/reviewers/:id` instead. The chain is `writeLimiter`, `requireAuth`, `loadReviewer`, `requireOwner`, `deleteReviewer`. There is no body. The database row is deleted first and the file second, so a failed delete never leaves a row that points at a missing file. The study reviewer's upvotes, views, and reports are deleted with it (`ON DELETE CASCADE`). Other people's saved copies stay: they keep the copied title, subject, and strand, their notes, and their flashcards, and they show as removed. The reply is `{ "deleted": true, "id": 42 }`. Errors: 400 bad id, 401, 403 `Only the person who uploaded this study reviewer can change it.`, 404 `That study reviewer could not be found.`, and 429 when the write limit is reached.

## What does PUT /api/reviewers/:id/upvote do?

`PUT /api/reviewers/:id/upvote` adds the logged-in user's upvote to a study reviewer. Only logged-in users can call it. The chain is `writeLimiter`, `requireAuth`, `loadReviewer`, `hideIfHidden`, `addUpvote`. There is no body. It is safe to repeat: if the upvote already exists nothing changes, and a double click that tries to add it twice is stopped by the table's primary key and treated as success. The reply is `{ "upvoteCount": 5, "hasUpvoted": true }`, with the total counted fresh from the database. Errors: 400 bad id, 401 not logged in, 404 when the study reviewer does not exist or is hidden by reports, and 429 when the write limit is reached. The API has no rule against upvoting your own study reviewer.

## What does DELETE /api/reviewers/:id/upvote do?

`DELETE /api/reviewers/:id/upvote` removes the logged-in user's upvote from a study reviewer. Only logged-in users can call it. The chain is `writeLimiter`, `requireAuth`, `loadReviewer`, `removeUpvote`. There is no body, and it is safe to repeat: removing an upvote that does not exist does nothing. It skips `hideIfHidden`, so a student can still take back an upvote after reports hide the study reviewer. The reply is `{ "upvoteCount": 4, "hasUpvoted": false }`, with the total counted fresh from the database. Errors: 400 bad id, 401 not logged in, 404 `That study reviewer could not be found.`, and 429 when the write limit is reached.

## What does PUT /api/reviewers/:id/save do?

`PUT /api/reviewers/:id/save` adds a study reviewer to the logged-in user's Saved list. Only logged-in users can call it. The chain is `writeLimiter`, `requireAuth`, `loadReviewer`, `hideIfHidden`, `saveReviewer`. There is no body. It creates a `saved_items` row that also keeps a copy of the title, subject, and strand, so the saved item still makes sense if the original is deleted later. It is safe to repeat: saving twice keeps one saved item. The reply is `{ "isSaved": true, "savedId": 7 }`, and `savedId` is the id used by the `/api/saved/:savedId` endpoints for notes and flashcards. Errors: 400 bad id, 401, 404 when the study reviewer does not exist or is hidden by reports, and 429 when the write limit is reached.

## What does DELETE /api/reviewers/:id/save do?

`DELETE /api/reviewers/:id/save` removes a study reviewer from the logged-in user's Saved list. Only logged-in users can call it. The chain is `writeLimiter`, `requireAuth`, `loadReviewer`, `unsaveReviewer`. There is no body. It deletes the user's saved item for that study reviewer, and with it the user's notes and flashcards for it; this cannot be undone. It is safe to repeat: when nothing is saved, nothing happens. It skips `hideIfHidden`, so it also works after reports hide the study reviewer. The reply is `{ "isSaved": false, "savedId": null }`. Errors: 400 bad id, 401, 404 when the study reviewer does not exist, and 429 when the write limit is reached. A saved item whose original was deleted is removed with `DELETE /api/saved/:savedId` instead.

## What does POST /api/reviewers/:id/view do?

`POST /api/reviewers/:id/view` records that the logged-in user opened a study reviewer, for the Recently viewed list. Only logged-in users can call it. The chain is `writeLimiter`, `requireAuth`, `loadReviewer`, `hideIfHidden`, `recordView`. There is no body. The first view creates a `recently_viewed` row, and later views move its time to now, so each study reviewer appears once in the list. The reply is `{ "recorded": true }`. The Atlas website calls it as a separate request after a logged-in user's reviewer page has loaded, so loading the page itself never changes data. Because it uses the write limit, every study reviewer a logged-in user opens spends one of the 120 writes per 15 minutes. Errors: 400 bad id, 401, 404 missing or hidden, and 429.

## What does POST /api/reviewers/:id/report do?

`POST /api/reviewers/:id/report` reports someone else's study reviewer to the admins. Only logged-in users can call it. The chain is `writeLimiter`, `requireAuth`, `loadReviewer`, `hideIfHidden`, `reportReviewer`. The body is JSON: `{ "reason": "Spam", "details": "optional text" }`. `reason` must be `Offensive`, `Spam`, `Irrelevant`, `Wrong category`, or `Copyright`, and `details` may be at most 500 characters. When 3 different people have open reports on it, the study reviewer is hidden from everyone but its uploader and the admins. The reply is 201 `{ "reported": true }`. Errors:

- 403 `You cannot report your own study reviewer. Edit or delete it instead.`
- 400 `Some details need fixing. Check the highlighted fields.` with `fields.reason` or `fields.details`.
- 409 `You already reported this study reviewer. An admin will look at it.` while the same person's earlier report is still open.
- 400 bad id, 401, 404 missing or hidden, and 429.

Reporters' names are never shown to anyone, admins included.

## What does GET /api/me do?

`GET /api/me` returns the logged-in user's Atlas profile. Only logged-in users can call it. `requireAuth` finds the user's row or creates it on the first call, so this is also how a new account appears in the Atlas database. Only the general limit applies. The reply looks like this:

```
{
  "id": 12,
  "displayName": "Andrea Santos",
  "email": "the user's email",
  "role": "member",
  "createdAt": "2026-10-31T08:00:00.000Z",
  "uploadCount": 3,
  "uploadLimit": 50
}
```

`role` is `member` or `admin`. `uploadCount` is how many study reviewers the user has now, and `uploadLimit` is `MAX_UPLOADS_PER_USER`. The email is only ever sent to its owner, through the `/api/me` endpoints. Errors: 401 `Please log in to do that.` or `Your session has expired. Please log in again.`

## What does PUT /api/me do?

`PUT /api/me` changes the logged-in user's display name, the name shown as the uploader on their study reviewers. Only logged-in users can call it. The chain is `requireAuth`, `writeLimiter`, `updateMe`. The body is JSON: `{ "displayName": "New name" }`. The name is trimmed and must be 2 to 50 characters long; otherwise the reply is 400 `Display name must be between 2 and 50 characters.` with the same text in `fields.displayName`. The reply is the updated profile: `id`, `displayName`, `email`, `role`, and `createdAt`, without `uploadCount` and `uploadLimit`. Nothing else about the account can be changed through the Atlas API: the email and password belong to Firebase, and the role is set only in the database. Errors: 400, 401, and 429 when the write limit is reached.

## What does DELETE /api/me do?

`DELETE /api/me` deletes the logged-in user's Atlas account and everything in it. Only logged-in users can call it, and only with a recent login: the token's `auth_time` must be at most 5 minutes old. Otherwise the reply is 401 `For your safety, log in again, then delete your account within 5 minutes.` The chain is `requireAuth`, `writeLimiter`, `deleteMe`, and there is no body.

The API first reads the stored file names of the user's study reviewers, then deletes the `users` row. The database deletes the rest with it (`ON DELETE CASCADE`): the user's study reviewers, upvotes, views, saved items with notes, flashcards, and reports. Then the files are deleted from disk. Other people's saved copies of the user's study reviewers stay, marked as removed. The reply is `{ "deleted": true }`. The Firebase login itself is deleted afterwards by the website, not by the API. Errors: 401 and 429.

## What does GET /api/me/reviewers do?

`GET /api/me/reviewers` lists every study reviewer the logged-in user uploaded, newest first. Only logged-in users can call it. The chain is `requireAuth`, `listMyReviewers`, and only the general limit applies. There is no paging: the reply is `{ "items": [...] }` with all of them, normally at most `MAX_UPLOADS_PER_USER` (50 by default). Each item is a study reviewer object. Unlike the feed, this list includes study reviewers hidden by reports, with `isHidden: true`, so the uploader can see which ones are hidden and edit or delete them. Error: 401 when not logged in.

## What does GET /api/me/recently-viewed do?

`GET /api/me/recently-viewed` lists the study reviewers the logged-in user opened most recently, newest view first, at most 20. Only logged-in users can call it. The chain is `requireAuth`, `listMyRecentlyViewed`, and only the general limit applies. The reply is `{ "items": [...] }`, where each item is a study reviewer object. Views are recorded by `POST /api/reviewers/:id/view`. Study reviewers hidden by reports are left out of this list, even for their own uploader, and deleted ones disappear because their views are deleted with them. Error: 401 when not logged in.

## What does GET /api/me/saved do?

`GET /api/me/saved` lists the logged-in user's saved study reviewers, most recently saved first. Only logged-in users can call it. The chain is `requireAuth`, `listMySaved`, and only the general limit applies. There is no paging: the reply is `{ "items": [...] }` with every saved item. Each item is a saved item object with `isRemoved`, `hasNotes`, `flashcardCount`, and the study reviewer's current details in `reviewer`, or `reviewer: null` when the original was deleted. The notes themselves are not included; they come from `GET /api/saved/:savedId`. Saved items stay in this list even when reports hide the original study reviewer. Error: 401 when not logged in.

## What does GET /api/saved/:savedId do?

`GET /api/saved/:savedId` returns one of the logged-in user's saved items together with its notes. Only the owner of the saved item can get it. The chain is `requireAuth`, `loadSavedItem`, `getSavedItem`, and only the general limit applies. The reply is a saved item object plus `notes` and `notesFormat`: `html` for formatted notes, or `text` for plain-text notes written before formatting existed. Errors: 401 when not logged in, 400 `That saved item id is not valid.`, and 404 `That saved item could not be found.`, which is also the answer for someone else's saved item, so nobody can find out what other people saved.

## What does DELETE /api/saved/:savedId do?

`DELETE /api/saved/:savedId` removes one of the logged-in user's saved items, together with its notes and flashcards. Only the owner of the saved item can call it. The chain is `requireAuth`, `writeLimiter`, `loadSavedItem`, `deleteSavedItem`. There is no body. This is the way to remove a saved item whose original study reviewer was deleted, because `DELETE /api/reviewers/:id/save` needs the study reviewer to exist. The reply is `{ "deleted": true, "id": 7 }`. Errors: 400 `That saved item id is not valid.`, 401, 404 `That saved item could not be found.` (also for someone else's), and 429 when the write limit is reached.

## What does PUT /api/saved/:savedId/notes do?

`PUT /api/saved/:savedId/notes` saves the logged-in user's notes for one saved item, replacing the old notes. Only the owner of the saved item can call it. The chain is `requireAuth`, `studyLimiter`, `loadSavedItem`, `updateNotes`; the study limit (600 per 15 minutes) is roomy because the website autosaves while the student types. The body is JSON: `{ "notes": "..." }`, and empty notes are allowed. Notes must be simple HTML with only these tags and no attributes: p, h1, h2, h3, strong, em, ul, li, blockquote, and br, plus span with one class from `tc-red`, `tc-orange`, `tc-green`, `tc-blue`, `tc-purple` and mark with one class from `hl-yellow`, `hl-green`, `hl-blue`, `hl-pink`, `hl-orange`. Errors, all 400 with `fields.notes`:

- `Notes must be text.`
- `These notes are too long to save. Make them shorter.` (over 100,000 characters, tags included)
- `These notes contain formatting that is not allowed.`
- `Notes can be at most 20000 characters.` (visible text)

The reply is `{ "notes": "...", "notesFormat": "html", "notesUpdatedAt": "..." }`. Other errors: 400 bad id, 401, 404, and 429.

## What does GET /api/saved/:savedId/flashcards do?

`GET /api/saved/:savedId/flashcards` lists the flashcards of one saved item, in the order they were made. Only the owner of the saved item can call it. The chain is `requireAuth`, `loadSavedItem`, `listFlashcards`, and only the general limit applies. The reply is `{ "cards": [ { "id": 31, "front": "...", "back": "...", "status": "new" } ] }`, where `status` is `new`, `learning`, or `learned`. A saved item without flashcards returns an empty list. Flashcards keep working after the original study reviewer is deleted. Errors: 400 `That saved item id is not valid.`, 401, and 404 `That saved item could not be found.` (also for someone else's).

## What does POST /api/saved/:savedId/flashcards do?

`POST /api/saved/:savedId/flashcards` asks Google Gemini to write a new set of flashcards from the saved study reviewer's file, replacing the old set. Only the owner of the saved item can call it. The chain is `requireAuth`, `writeLimiter`, `loadSavedItem`, `flashcardLimiter` (10 sets per account per 24 hours; failed attempts do not count), `createFlashcards`. The body is JSON `{ "count": 20 }`: a whole number from 5 to 100, and 20 when it is left out. Short material can give fewer cards. The new set replaces the old one in one transaction, and every card starts as `new`. The reply is 201 `{ "cards": [...] }`. Errors:

- 400 `Choose a whole number of flashcards from 5 to 100.`
- 409 `The original study reviewer was removed, so new flashcards cannot be made from it.`
- 415 for old `.doc` or `.ppt` files, and 404 `The file for this study reviewer is missing.`
- 422 `This file could not be read. It may be damaged.`, `There is no readable text in this file to make flashcards from.`, or `Flashcards could not be made from this material.`
- 503 `Flashcards are not set up on this server yet.` or `The flashcard service is busy right now. Please try again later.`
- 502 `The flashcard service did not answer. Please try again in a moment.` or `No flashcards came back for this material. Please try again.`
- 429 `You have made flashcards 10 times today. Please try again tomorrow.`

More detail: [AI flashcards in Atlas](flashcards.md).

## What does DELETE /api/saved/:savedId/flashcards do?

`DELETE /api/saved/:savedId/flashcards` deletes every flashcard of one saved item; the saved item and its notes stay. Only the owner of the saved item can call it. The chain is `requireAuth`, `writeLimiter`, `loadSavedItem`, `deleteFlashcards`. There is no body, and it is safe to repeat: with no flashcards, nothing happens. The reply is `{ "deleted": true }`. Deleting flashcards does not give back a turn of the daily flashcard limit. Errors: 400 `That saved item id is not valid.`, 401, 404 `That saved item could not be found.` (also for someone else's), and 429 when the write limit is reached.

## What does PUT /api/saved/:savedId/flashcards/:cardId do?

`PUT /api/saved/:savedId/flashcards/:cardId` marks how well the logged-in user knows one flashcard. Only the owner of the saved item can call it. The chain is `requireAuth`, `studyLimiter`, `loadSavedItem`, `updateFlashcardStatus`; it uses the roomy study limit (600 per 15 minutes) because students mark cards quickly while studying. The body is JSON: `{ "status": "learned" }`, where `status` is `new`, `learning`, or `learned`. The card must belong to that saved item. The reply is the updated card, for example `{ "id": 31, "front": "...", "back": "...", "status": "learned" }`. Errors: 400 `That flashcard id is not valid.`, 400 `"status" must be new, learning, or learned.`, 404 `That flashcard could not be found.` when the card is not part of that saved item, 400 or 404 for a bad or foreign saved item id, 401, and 429.

## What does GET /api/admin/reports do?

`GET /api/admin/reports` lists every study reviewer that has open reports, for the admins' Reports page. Only admins can call it. The chain is `requireAuth`, `requireAdmin`, `listReports`, and only the general limit applies. The order is: hidden study reviewers first, then the most reported, then the most recently reported. The reply is `{ "items": [...] }`, where each item has `id`, `title`, `strand`, `grade`, `quarter`, `subject`, `materialType`, `fileName`, `fileMime`, `authorName`, `isHidden`, `createdAt`, `reportCount`, `lastReportedAt`, and `reports`, a list of `{ reason, details, createdAt }`, newest first. Reporters' names and ids are never included: admins judge the file, not the people. Resolved reports stay in the database but are not listed. Errors: 401 when not logged in, and 403 `Only admins can do that.`

## What does POST /api/admin/reviewers/:id/restore do?

`POST /api/admin/reviewers/:id/restore` is the admin's Restore choice: the reports were wrong, so the study reviewer is shown again. Only admins can call it. The chain is `requireAuth`, `requireAdmin`, `writeLimiter`, `loadReviewer`, `restoreReviewer`. There is no body. It marks every open report on the study reviewer as resolved, keeping the reports as a record, and sets `is_hidden` back to false. The reply is `{ "restored": true, "id": 42 }`. The same people may report it again later, because only an open report blocks a second report. Errors: 400 `That study reviewer id is not valid.`, 401, 403 `Only admins can do that.`, 404 `That study reviewer could not be found.`, and 429 when the write limit is reached.

## What does PUT /api/admin/reviewers/:id/category do?

`PUT /api/admin/reviewers/:id/category` is the admin's Fix category choice: the study reviewer is fine but filed in the wrong place. Only admins can call it. The chain is `requireAuth`, `requireAdmin`, `writeLimiter`, `loadReviewer`, `updateCategory`. The body is JSON, for example `{ "strand": "STEM", "grade": "11", "quarter": "1st", "subject": "Basic Calculus", "materialType": "Reviewer" }`, with values from `backend/src/utils/categories.js`; the subject must belong to the strand. The API changes the category without touching `updated_at` (the uploader did not edit it), updates the subject and strand of saved copies, resolves the open reports, and shows the study reviewer again. The reply is `{ "updated": true, "id": 42 }`. Errors: 400 `Some details need fixing. Check the highlighted fields.` with `fields`, 400 bad id, 401, 403 `Only admins can do that.`, 404, and 429.

## What does DELETE /api/admin/reviewers/:id do?

`DELETE /api/admin/reviewers/:id` is the admin's Delete choice: the reports were right, so the study reviewer is removed for everyone. Only admins can call it. The chain is `requireAuth`, `requireAdmin`, `writeLimiter`, `loadReviewer`, `deleteReviewer`. There is no body. Like the uploader's own delete, it deletes the database row first and the file second. The study reviewer's upvotes, views, and reports, resolved ones included, are deleted with it. Other people's saved copies stay with their notes and flashcards and show as removed. The server log records which admin deleted which study reviewer. The reply is `{ "deleted": true, "id": 42 }`. Errors: 400 bad id, 401, 403 `Only admins can do that.`, 404 `That study reviewer could not be found.`, and 429 when the write limit is reached.
