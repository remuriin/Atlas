# Troubleshooting Atlas

This page lists the problems people most often meet when running, deploying or using Atlas, with one problem per section. Each section quotes the message you see, explains the cause found in the Atlas code, and gives the fix. The quoted messages are copied from the code, so searching for their words finds the right section.

## What does "Atlas backend cannot start yet" mean?

The Atlas API, `npm run db:migrate` and `npm run db:seed` all read `backend/.env` through `backend/src/config/env.js`, and they stop on purpose when a setting is unusable. The line after the dashes names the problem:

- "DATABASE_URL is missing or is still the placeholder." `backend/.env` has no DATABASE_URL, or it is still `postgres://USER:PASSWORD@HOST:5432/DBNAME`. Put a real PostgreSQL URL there, run `npm run db:migrate` once, and start again.
- "FIREBASE_PROJECT_ID is empty." Set it to the Firebase project id: `demo-atlas` with the emulator started as `--project demo-atlas`, or `learnhub-ea4291` for real logins.
- "FIREBASE_AUTH_EMULATOR_HOST is set while NODE_ENV=production." The development emulator line was copied to the server. Delete it: emulator tokens are not signed, so anyone could forge a login.
- 'CLAMAV_MODE is "VALUE", which is not one of: off, daemon, command.' Fix the spelling.

If every value looks right, check the file name: it must be exactly `backend/.env`. The backend does not read `backend/.env.local`, and Windows can hide a `.txt` ending that makes the file `.env.txt`.

## What should I do when an Atlas port is already in use?

The three Atlas development servers each print their own message when their port is taken:

- API: "Port 4000 is already in use. Stop the other program or change PORT in backend/.env."
- Website: Vite stops with "Port 5173 is already in use". It never moves to another port (strictPort), because the API only accepts browser requests from FRONTEND_ORIGIN.
- Auth emulator: "Port 9099 is not open on 127.0.0.1, could not start Authentication Emulator." The Emulator UI uses port 4001.

The usual cause is an older copy still running in another terminal, or a crashed run that left its process behind. Stop it with Ctrl+C in its terminal. On Windows, `netstat -ano | findstr :4000` shows the process number in the last column, and `taskkill /PID 12345 /F` ends it (use your number). On macOS or Linux, `lsof -i :4000` shows the process. To move the API instead, change PORT and VITE_API_URL together; moving the website means changing the port in `frontend/vite.config.js` and FRONTEND_ORIGIN together.

## Why does npm run db:migrate fail to connect?

`backend/db/migrate.js` prints "Migration failed:", the error message, the code in brackets, and a hint. The connection codes:

- ECONNREFUSED: "The server was reached, but nothing is listening on that address and port." PostgreSQL is not running, listens on another address, or the port in the URL is wrong. Locally, start PostgreSQL, or run `docker start atlas-db` for the Docker database. On a database server, `listen_addresses` in postgresql.conf decides where it listens.
- ETIMEDOUT, or a message with "timeout": "No answer from the server." Nothing answered within 10 seconds, so something drops the traffic or the host cannot be reached from this computer. The live Atlas database is only reachable through the server's private network (a VPN), never from the open internet, so connect to that network first or run the migration on the server.
- ENOTFOUND: "The host name in DATABASE_URL could not be found." Correct the host name.

The hints always say DATABASE_URL, but migrations connect with MIGRATION_DATABASE_URL whenever it is set, so check that one too. A failed migration changes nothing, because all of `backend/db/schema.sql` runs as one transaction; run it again after the fix.

## Why does npm run db:migrate say the login or permission is wrong?

These `npm run db:migrate` error codes mean the database answered but refused:

- 28000: "Postgres refused this computer or user." The database server's pg_hba.conf has no line that lets this user connect from this computer. Whoever runs the database server adds a matching line and reloads PostgreSQL.
- 28P01: "The user name or password in DATABASE_URL is not correct." Check both. Special characters in the password must be percent-encoded in the URL: `@` becomes `%40`, `:` becomes `%3A`, `/` becomes `%2F`, `#` becomes `%23` and `?` becomes `%3F`.
- 3D000: "That database does not exist yet." Create it with CREATE DATABASE, or fix the name at the end of the URL.
- 42501: "This user is not allowed to create or change tables." The migration ran as a user without the right to change the tables, such as the limited API user. Set MIGRATION_DATABASE_URL in `backend/.env` to the user that owns the tables (`learnhub_app` on the live server) and run it again.

Any other code prints "Check that DATABASE_URL in backend/.env is correct and that Postgres is running."

## Why does the Atlas website say "Could not reach Atlas"?

The full message is "Could not reach Atlas. Check your internet connection and try again." (`frontend/src/services/api.js`). The website shows it when the browser got no usable answer from the Atlas API at all. The common causes:

1. The API is not running or has crashed. Look at its terminal, or open the API address followed by `/api/health`, which answers `{"status":"ok"}` when the API is up.
2. VITE_API_URL points at the wrong address. Vite reads `frontend/.env` only when it starts, so restart `npm run dev` after changing it; the live site takes it from `frontend/.env.production` when it is built.
3. CORS, the browser rule that lets a page read answers only from APIs that allow its address: the page's address is not exactly FRONTEND_ORIGIN. `http://127.0.0.1:5173` is not `http://localhost:5173`, and a trailing slash in FRONTEND_ORIGIN also breaks the match. The API prints "Accepting browser requests from" and its FRONTEND_ORIGIN at start, and the browser console shows a CORS error. A website running on your computer cannot use the live API, which only accepts the live site's address.
4. The computer is offline, or a network filter blocks the API address.
5. On the live site, a request that runs longer than the front door allows ends the same way; see [What timeouts and size limits apply on the way to the Atlas API?](hosting-and-traffic-path.md#what-timeouts-and-size-limits-apply-on-the-way-to-the-atlas-api).

Fix the cause, then reload the page.

## Why is an Atlas upload refused with 403, 409 or 413?

- 403: "You have 50 study reviewers, the most one person can share. Delete one from your profile to upload another." Each person may have MAX_UPLOADS_PER_USER study reviewers at a time, 50 by default. The check runs before the file is sent, and the Upload page shows "You have shared 12 of 50". Deleting one frees a place; replacing a file while editing does not use one. Editing someone else's study reviewer also gets a 403: "Only the person who uploaded this study reviewer can change it."
- 409: "This exact file is already on Atlas as" followed by the existing title, then "Search for it instead of posting it again." Every file's SHA-256 fingerprint is stored, and a unique index refuses a second copy, also from another person. Open the existing study reviewer instead. Your own study reviewer may take its same file again when you edit it. Files uploaded before fingerprints existed are not caught.
- 413: "That file is too large. The limit is 10 MB." The number is MAX_FILE_SIZE_MB. The browser checks VITE_MAX_FILE_SIZE_MB first, so the two should match. Make the file smaller, for example by saving a PDF with compressed pictures. If a proxy in front of the API has a smaller request limit, it refuses big uploads before the API sees them, so its limit must be above MAX_FILE_SIZE_MB.

## Why is an Atlas upload refused with 415, 422 or 503?

- 415, wrong type: "That file type is not allowed. Upload a PDF, Word, PowerPoint, text, PNG, or JPG file." The extension and the browser's content type must both match the allowlist: .pdf, .docx, .pptx, .txt, .png, .jpg or .jpeg. Old .doc and .ppt are refused because they can carry macros. Some computers without Office report an unusual type for Office files; save those as PDF.
- 415, wrong contents (`backend/src/utils/fileContents.js`): "This file is empty.", "This file is not a real PDF.", "This PDF contains scripts or attached files, which are not allowed. Print it to a new PDF and upload that one.", "This file is not a real Word or PowerPoint file.", "This file contains macros, which are not allowed.", "This file is not a real PNG image." (or JPG), and "This file is not plain text. If it is text, save it as UTF-8 and try again."
- 422: "The virus scan flagged this file as unsafe, so it was not uploaded." ClamAV found a threat, and the API log names it after "Virus scan blocked an upload from user".
- 503: "Uploads are paused because the virus scan is not working. Try again in a few minutes." The scan could not run: the ClamAV service is stopped, CLAMAV_SOCKET is wrong, `clamscan` is missing, or no answer came in time. Atlas refuses rather than accept unscanned files, and the log shows "Virus scan failed:". Start or install ClamAV, or in development set CLAMAV_MODE=off.

A refused file is deleted from the server at once.

## Why can the live Atlas site behave differently from my local copy?

The live Atlas API runs the code deployed on 2026-10-29, while a developer's computer runs whatever code is checked out. On 2026-11-01 these differences are known:

- Search: the new search ranking, with word-start matching and titles that start with the search ranked first, is not merged or deployed yet, so live search results can differ from a local copy that has it.
- Sample files: the PDFs of the 16 sample study reviewers are not on the live server yet, so their files answer 404 "The file for this study reviewer is missing." until they are copied. Locally, `npm run db:seed` copies them into the local uploads folder.
- Virus scan: the live server has ClamAV set to daemon mode, while local development usually runs with `CLAMAV_MODE=off`, so a file that uploads locally can still be refused on the live site.

The live state is in [What is live for Atlas on 2026-11-01?](deployment.md#what-is-live-for-atlas-on-2026-11-01), and the work still to do in [What are the remaining steps for the live Atlas server?](deployment.md#what-are-the-remaining-steps-for-the-live-atlas-server).

## Why does making flashcards fail with 503, 502 or 429?

- 503 "Flashcards are not set up on this server yet.": GEMINI_API_KEY is empty in `backend/.env`. Add a key from Google AI Studio and restart the API. This is normal in local development.
- 503 "The flashcard service is busy right now. Please try again later.": Google Gemini answered 429, so the key's quota or rate limit is used up for now. Wait, or check the key's limits in Google AI Studio. The API log shows "Gemini answered 429:".
- 502 "The flashcard service did not answer. Please try again in a moment.": Gemini could not be reached, took longer than 120 seconds, or answered with another error, for example for a wrong GEMINI_MODEL or an invalid key. The API log shows "Gemini answered" with the status, or "Gemini request failed:".
- 502 "No flashcards came back for this material. Please try again.": Gemini answered without any usable cards.
- 429 "You have made flashcards 10 times today. Please try again tomorrow.": each account may make 10 sets in 24 hours. The window starts with the first set and is kept in the `rate_limits` table, so restarting the API does not reset it. Failed attempts do not count. Other 429 messages, such as "You are making changes too quickly", come from the general request limits.

## Why does making flashcards fail with 422, 415, 409 or 404?

- 422 "Flashcards could not be made from this material.": Gemini refused the material and gave a block reason, for example for safety.
- 422 "This file could not be read. It may be damaged.": a Word or PowerPoint file could not be opened.
- 422 "There is no readable text in this file to make flashcards from.": for example a text file with only spaces, or a Word file that holds only pictures. A PDF version helps, because Gemini reads PDF and image files directly.
- 415 "Flashcards cannot be made from old .doc or .ppt files. Ask the uploader for a PDF, DOCX, or PPTX version.": only files uploaded before .doc and .ppt were refused can cause this.
- 409 "The original study reviewer was removed, so new flashcards cannot be made from it.": the uploader deleted it. Existing flashcards and notes stay usable.
- 404 "The file for this study reviewer is missing.": the study reviewer exists, but its file is not in the uploads folder; see [Why does a study reviewer say its file is missing?](troubleshooting.md#why-does-a-study-reviewer-say-its-file-is-missing).
- 404 "That saved item could not be found.": it was removed, or it belongs to someone else. 404 "That flashcard could not be found.": a newer set replaced the card, for example in another tab; reload the page.
- 400 "Choose a whole number of flashcards from 5 to 100."

## Why does Google sign-in not work on Atlas?

- The browser blocked the pop-up: Atlas then sends the whole tab to Google and comes back to the same page afterwards. The page to return to is kept in sessionStorage as `atlas-return-path`; when storage is blocked, it returns to the home page. Firebase documents that this redirect way can fail in browsers that block third-party storage when the sign-in domain differs from the site's address, which is the case for Atlas (`learnhub-ea4291.firebaseapp.com` versus `atlas-f2757.web.app`). If you come back still logged out, allow pop-ups for the site and try again.
- Closing the pop-up yourself shows no error, on purpose.
- "Google sign-in is not turned on yet. Use your email and password for now.": the Google provider is off in the Firebase console under Authentication, Sign-in method.
- "Google sign-in is not allowed on this web address yet. Use your email and password for now.": the site's domain is missing from Authentication, Settings, Authorized domains.
- "An account with this email already exists. Log in with your email and password instead.": log in with the password.
- "Could not reach the login service. Check your internet connection and try again.": no connection, or in development the Auth emulator is not running.
- Google's own page "Error 400: redirect_uri_mismatch": see [What does redirect_uri_mismatch mean during Google sign-in?](troubleshooting.md#what-does-redirect_uri_mismatch-mean-during-google-sign-in).

## What does redirect_uri_mismatch mean during Google sign-in?

"Error 400: redirect_uri_mismatch" is Google's own error page. It means the Atlas sign-in asked Google to return to an address that is not listed on the Firebase project's Google OAuth client. Firebase runs the Google sign-in pages on the auth domain, VITE_FIREBASE_AUTH_DOMAIN, and Google sends the person back there. Atlas once changed the auth domain to the new site address, `atlas-f2757.web.app`, and Google sign-in broke, because that address is not listed on the OAuth client, while `learnhub-ea4291.firebaseapp.com` is. The fix, kept in `frontend/.env.production`, was to go back to `learnhub-ea4291.firebaseapp.com`. That is why Google's sign-in window still shows the old LearnHub address. To use another auth domain in future, first add that address's sign-in handler, `https://DOMAIN/__/auth/handler`, to the OAuth client's authorized redirect URIs in the Google Cloud console, then change VITE_FIREBASE_AUTH_DOMAIN and build and deploy the website again.

## Why does a study reviewer say its file is missing?

"The file for this study reviewer is missing." (404) means the study reviewer's row exists, but no file with its `stored_name` is in the uploads folder (UPLOAD_DIR). The study page shows the message in red, the file link on the reviewer's page opens it as a short error, and making flashcards fails with the same words. Causes:

- The sample data was seeded from another computer: the 16 sample PDFs went into that computer's uploads folder, not the server's. Copy every PDF from `backend/db/seed-files/` into the server's uploads folder, keeping the names.
- A database backup was restored without the uploads archive from the same night.
- UPLOAD_DIR changed, or the backend was moved to another folder while the files stayed behind. A relative UPLOAD_DIR counts from the `backend/` folder.
- Someone deleted the file by hand.

The first cause applies to the live site after the 2026-10-31 reset: on 2026-11-01 the sample PDFs are not on the server yet, and copying them is the first of [the remaining server steps](deployment.md#what-are-the-remaining-steps-for-the-live-atlas-server). A study reviewer is always a database row plus a file, so the two must be backed up, restored and moved together. A file that is truly lost cannot be rebuilt; its uploader can edit the study reviewer and upload the file again.

## Why does Atlas say "Your session has expired"?

The Atlas API answers 401 "Your session has expired. Please log in again." when the login token sent with a request cannot be verified (`backend/src/middleware/auth.js`), and 401 "Please log in to do that." when no token was sent at all. Firebase renews login tokens by itself, so for a normal user the fix is to log out and log in again. If it happens right after every login, the setup is wrong:

- The token comes from a different Firebase project than FIREBASE_PROJECT_ID. In development the Auth emulator uses the project from `--project`, or `learnhub-ea4291` from `.firebaserc` without that flag, and it must equal FIREBASE_PROJECT_ID.
- Only one side uses the emulator: VITE_USE_AUTH_EMULATOR=true needs FIREBASE_AUTH_EMULATOR_HOST in `backend/.env`, and real logins need that line absent.
- On the server, FIREBASE_PROJECT_ID is not the live project id, `learnhub-ea4291`.

Browsing still works with a bad token, because public pages treat the person as a visitor. The API does not write 401 answers to its log.

## Why does deleting my Atlas account ask me to log in again?

Deleting an Atlas account needs a login from the last 5 minutes. The API compares the token's `auth_time`, the moment the password was typed or the Google account was chosen, with the clock. When it is older, the answer is 401 "For your safety, log in again, then delete your account within 5 minutes.", so someone who finds a phone left logged in cannot delete the account. The Profile page then shows "Log in again", which logs out and returns to the Profile page after the new login; delete the account within 5 minutes. Firebase has the same rule for deleting the login itself. The order is: Atlas data first (the users row, everything that cascades from it, and the uploaded files), then the Firebase login. If Firebase still refuses, the browser logs out; the Atlas data is already gone, and logging in again later starts a new, empty profile.

## Why does Atlas say "Too many requests" or "You are making changes too quickly"?

Atlas limits how many requests one visitor can make (`backend/src/middleware/rateLimit.js`). Every limit answers 429:

| Limit | Message |
| --- | --- |
| 600 requests per 15 minutes, any request | "Too many requests. Please wait a few minutes and try again." |
| 120 changes per 15 minutes: uploads, edits, deletes, upvotes, saves, reports, views | "You are making changes too quickly. Please wait a few minutes and try again." |
| 600 study saves per 15 minutes: notes autosave and marking cards | "You are saving too quickly. Please wait a few minutes and try again." |
| 10 flashcard sets per account per 24 hours | "You have made flashcards 10 times today. Please try again tomorrow." |

The first and third limits are counted in memory and reset when the API restarts; the change and flashcard limits are kept in the `rate_limits` table and survive restarts. Limits count per IP address, except the flashcard limit, which counts per account. If many different people hit a limit at once on the live site, check TRUST_PROXY=true in `backend/.env`: without it every visitor seems to come from the proxy and all share one count, and the API log shows ERR_ERL_UNEXPECTED_X_FORWARDED_FOR.

## Why does the Atlas Explorer chat say it is busy or offline?

The chat in the Atlas Explorer page is called Rem (`docs/explorer/ui/chat.js`). It sends each question to the Atlas API's `POST /api/ask`, which passes it to the Rem RaaS service with the RAAS_KEY in the server's `backend/.env`, and the service has Google Gemini answer from the Atlas docs. Its messages:

- "You have asked a lot of questions. Please wait a few minutes and try again.": the Atlas API's limit of 30 questions per 15 minutes per IP address (`askLimiter`) was reached.
- "The docs chat is not set up on this server yet.": RAAS_URL or RAAS_KEY is empty in the server's `backend/.env`; fill both in and restart the API.
- "Rem is busy right now. Please try again in a moment.": the Rem service answered 429 or 503.
- "Rem could not answer just now (error 502). Try again in a moment.": the Rem service failed in another way, for example a wrong RAAS_URL or an old RAAS_KEY on the server; the API log shows Rem's status.
- "Could not reach Rem. It may be busy (too many questions at once) or offline. Try again in a moment.": no answer arrived although the computer is online, so the Atlas API is down or the API address was wrong when the page was built.
- "You are offline. The diagrams and docs still work; the chat needs the internet."
- "Rem took too long to answer. Try a shorter question.": no answer within 60 seconds.

A page built without an Atlas API address shows "The chat is not set up in this copy of the explorer." The answer "The Atlas docs do not cover this." means the docs have nothing on it; after changing `docs/knowledge/`, run `node docs/ingest-docs.js`.
