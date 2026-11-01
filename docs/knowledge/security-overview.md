# Security in Atlas

Atlas is a public website where students upload files and keep private study notes, so it has to protect accounts, files, and personal data. This page summarises how Atlas handles logins, permissions, input checks, uploads, HTTP headers, CORS, rate limits, secrets, and the database, and it lists the security work that is planned or still missing. Each section names the code that does the work.

## How do logins work in Atlas?

Atlas never sees or stores passwords. Firebase Authentication owns every account: students sign up and log in with an email and password, or with "Continue with Google", directly with Firebase from the browser, and password resets also happen in Firebase. The `users` table in Postgres stores only the Firebase user id, a display name, the email, the role, and the creation time.

After login, the Firebase client in the browser holds a short-lived ID token, a signed proof of who the user is. The website sends it with each API call in the header `Authorization: Bearer` followed by the token (`frontend/src/services/api.js`). The API checks it with `firebase-admin` (`backend/src/config/firebaseAdmin.js`): the token must be signed by Google, made for this Firebase project (`FIREBASE_PROJECT_ID`), and not expired. Atlas uses no cookies and no server sessions. What Atlas does not do:

- It does not check whether a token was revoked, so a token keeps working until it expires, about one hour after it was issued, even after the user logs out.
- It does not require a verified email address.
- It never accepts Auth emulator tokens in production: the server refuses to start when `FIREBASE_AUTH_EMULATOR_HOST` is set together with `NODE_ENV=production`.

More about accounts: [Accounts and sign-in](accounts-and-sign-in.md).

## Who may do what in Atlas?

Atlas has four levels of access, checked on the server for every request in `backend/src/middleware/auth.js`, `reviewerAccess.js`, and `savedAccess.js`:

- **Anyone**, even without a login, can browse and search the feed, open a study reviewer, and view or download its file.
- **A logged-in user** can upload, upvote, save, report other people's study reviewers, write notes, make flashcards, and manage their own profile and account.
- **The uploader** of a study reviewer is the only one who can edit or delete it through `/api/reviewers/:id`. Anyone else gets 403 `Only the person who uploaded this study reviewer can change it.`
- **An admin** (`users.role` is `admin`, set by hand in the database) can list reported study reviewers and restore, re-file, or delete any study reviewer through `/api/admin`. Anyone else gets 403 `Only admins can do that.`

Two rules hide things instead of refusing them. A study reviewer hidden by 3 open reports answers 404 `That study reviewer could not be found.` to everyone except its uploader and the admins. A saved item that belongs to someone else answers 404 `That saved item could not be found.`, exactly like a missing one, so nobody can learn what others saved by trying ids. Notes, flashcards, saved lists, views, and email addresses are only ever sent to their owner, and reporters' names are never shown to anyone.

## How does Atlas check what users send?

Atlas never relies on the website's own checks: `backend/src/utils/validate.js` checks every value again on the server. Its limits:

- Title 3 to 120 characters; description 10 to 2000; at most 8 tags of at most 30 characters each.
- Strand, grade, quarter, subject, and material type must come from the lists in `backend/src/utils/categories.js`, and the subject must belong to the strand.
- Display name 2 to 50 characters.
- Report reason from a fixed list of 5; report details at most 500 characters.
- Notes at most 20,000 visible characters and 100,000 characters in total.
- Flashcard count a whole number from 5 to 100; card status `new`, `learning`, or `learned`.
- Ids: digits only, from 1 to 2147483647. Page and limit: whole numbers of 1 or more. Search text: cut to 100 characters and 8 words.

Bad values get a 400 with a plain message and, for forms, `fields` naming each problem. Every SQL statement lives in `backend/src/models/` and passes values only through `$1`, `$2` placeholders, never by pasting text into SQL, so input cannot change a query (the attack called SQL injection). Search words are escaped before they become Postgres patterns. The database repeats some rules as `CHECK` constraints, such as the title length and the notes size.

## How does Atlas keep formatted notes safe?

Study notes in Atlas are stored as simple HTML, which could carry scripts if any HTML were allowed, so Atlas guards notes on both sides:

- **On the server**, `validateNotes` in `backend/src/utils/validate.js` accepts only these tags, written exactly, with no other attributes: p, h1, h2, h3, strong, em, ul, li, blockquote, br, span with one of five `tc-` colour classes, and mark with one of five `hl-` highlight classes. Any other tag, any attribute such as `onclick` or `style`, and any stray less-than sign that does not start an allowed tag are refused with 400 `These notes contain formatting that is not allowed.`
- **In the browser**, `frontend/src/services/noteHtml.js` rebuilds the notes from scratch with the same allowlist when it loads them into the editor and again before it saves them. Stored notes are parsed with `DOMParser`, which never runs scripts or loads images while it parses.

The website inserts no raw HTML anywhere else: there is no `dangerouslySetInnerHTML` in the frontend, and React escapes all other text. Notes are only ever sent to their owner, so even a bad note could only reach the person who wrote it. More: [Which HTML does the Atlas server accept in notes?](saved-notes-and-study.md#which-html-does-the-atlas-server-accept-in-notes)

## How does Atlas keep uploaded files safe?

Every Atlas upload passes several checks before anything about it is saved (`backend/src/middleware/upload.js` and `backend/src/middleware/checkUpload.js`):

- **Checks first**: the login, the upload limit (50 per person by default), and the owner check run before the file is read.
- **Allowlist**: only PDF, DOCX, PPTX, TXT, PNG, and JPG, with matching extension and content type. Old `.doc` and `.ppt` are refused because they can carry macros.
- **Real contents**: the first bytes must match the type, for example `%PDF-` for a PDF; Word and PowerPoint files must be real Office archives; text files must hold no binary bytes.
- **No active content**: PDFs with scripts, launch actions, or attached files (`/JavaScript`, `/JS`, `/Launch`, `/EmbeddedFile`) are refused, and so are Office files with macros (`vbaProject.bin`).
- **Virus scan**: ClamAV scans the file unless `CLAMAV_MODE` is `off`, and a scanner failure refuses the upload. The live server is set to `daemon` (checked 2026-10-31); the EICAR test upload is still to do.
- **Size and count**: one file per request, at most `MAX_FILE_SIZE_MB` (10 MB by default), and the same file (same SHA-256 fingerprint) cannot be posted twice.
- **Safe storage**: files get random names on disk, so a crafted file name cannot escape the uploads folder.
- **Safe serving**: files are sent with their stored type and `X-Content-Type-Options: nosniff`; only PDF, PNG, and JPG open in the browser (`inline`), and everything else downloads (`attachment`).

A refused file is deleted at once. Details: [Uploads and file safety in Atlas](uploads-and-file-safety.md#how-does-atlas-check-an-uploaded-file).

## Which security headers does the Atlas API send?

The Atlas API runs `helmet()` with its default settings on every reply (`backend/src/app.js`) and turns off Express's `X-Powered-By` header, so it does not advertise its framework. The helmet headers are:

- `Strict-Transport-Security`: browsers must use only HTTPS for the API, for a year.
- `Content-Security-Policy` with helmet's default policy, which allows scripts only from the API's own address and blocks plugins and framing by other sites.
- `X-Content-Type-Options: nosniff`: browsers must not guess file types, which stops a disguised file from running as a web page.
- `X-Frame-Options: SAMEORIGIN`: other sites cannot show API replies inside a frame.
- `Cross-Origin-Resource-Policy: same-origin`: other sites cannot embed API replies directly. `Cross-Origin-Opener-Policy: same-origin` separates API pages from windows of other sites.
- `Referrer-Policy: no-referrer`, `Origin-Agent-Cluster`, `X-DNS-Prefetch-Control`, `X-Download-Options`, `X-Permitted-Cross-Domain-Policies`, and `X-XSS-Protection: 0`.

These headers cover the API only. The website on Firebase Hosting (`firebase.json`) sets only caching headers and sends no Content-Security-Policy of its own.

## How does CORS protect the Atlas API?

CORS (cross-origin resource sharing) is the browser rule about which websites may read replies from an API. The Atlas API allows exactly one origin, `FRONTEND_ORIGIN` from `backend/.env`, which on the live server is the Atlas website. It allows the methods GET, POST, PUT, and DELETE and the headers Authorization and Content-Type. A page on any other website cannot read Atlas API replies in a visitor's browser.

The one exception is `POST /api/ask`, the chat of the Atlas Explorer, which any origin may call (POST only, header Content-Type), because the Explorer is a file opened from disk or shared around. That is safe: it needs no login and receives none, changes no data, is limited to 30 questions per 15 minutes per IP address, and the Rem key stays on the server.

CORS is not a lock, though. Only browsers enforce it, so a script, an app, or a tool such as curl can still call the API directly. Because Atlas sends the login as a token in the `Authorization` header and not as a cookie, another website cannot make a student's browser send their login along (the attack called CSRF, cross-site request forgery). The real protection is the server-side login, owner, and admin checks on each route.

## How do rate limits protect Atlas?

Rate limits stop one visitor from flooding Atlas. The Atlas API has five limiters in `backend/src/middleware/rateLimit.js`: 600 requests per 15 minutes for everything, 120 changes per 15 minutes, 600 study saves per 15 minutes, 30 Explorer chat questions per 15 minutes, and 10 Gemini flashcard sets per account per 24 hours. A request over a limit gets 429 with a plain message. The change and flashcard counts are kept in Postgres, so restarting the API does not reset them; the other three are kept in memory. Behind its proxy the API trusts exactly one hop (`TRUST_PROXY=true`), so it counts each visitor's real address, and a visitor cannot fake an address with their own `X-Forwarded-For` header. If the database is down, the Postgres-backed limits let requests through rather than block everyone. Details, side effects, and headers: [Rate limits in Atlas](rate-limits.md#which-rate-limits-does-atlas-use).

## Where does Atlas keep its secrets?

The Atlas API keeps its secrets only in `backend/.env` on the server, which `.gitignore` keeps out of the repository; `backend/.env.example` holds placeholders only. The secret values are the database passwords inside `DATABASE_URL` and `MIGRATION_DATABASE_URL`, `GEMINI_API_KEY`, which only the server sends to Google, and `RAAS_KEY`, which only the server sends to Rem RaaS for the Explorer chat, so neither key reaches a browser. No Firebase service-account key is stored on the server or in the repository, because the API only verifies tokens.

The `VITE_` values in `frontend/.env` and in the committed `frontend/.env.production` are built into the public website, so they are public by design: the API address, the Firebase web config (`VITE_FIREBASE_API_KEY` is a public identifier, not a password), and the takedown email. Error replies never leak internals in production: a 500 reply carries only a plain message, and the details go to the server log. Gemini's own error details are logged, never sent to the visitor.

## How is the Atlas database protected?

The Postgres database that holds all Atlas data has no public port. It runs on the same server as the API, which connects to it locally, and the maintainer reaches it from outside only through the server's own private VPN. Every query from the API uses placeholders, so input cannot change the SQL.

Atlas has a least-privilege database role: `backend/db/api-user.sql` creates `learnhub_api` (the prefix is the project's old name), a user for the API's `DATABASE_URL` that can only read and change rows (SELECT, INSERT, UPDATE, DELETE, and the id counters). It cannot drop or alter tables, create users, or read other apps' tables on the server. Migrations and backups use the table owner, `learnhub_app`, through `MIGRATION_DATABASE_URL`. If the API were ever broken into, an attacker acting as `learnhub_api` would hold only row rights. The role exists on the live server, and `MIGRATION_DATABASE_URL` is set for the owner (checked 2026-10-31). Database connections can be encrypted with `DATABASE_SSL=true`, which encrypts but does not verify the server's certificate. More: [Why is the Atlas database not reachable from the internet?](hosting-and-traffic-path.md#why-is-the-atlas-database-not-reachable-from-the-internet)

## Why does deleting an Atlas account need a recent login?

`DELETE /api/me` deletes a student's Atlas account and everything in it, so it asks for proof that the real owner is present. `deleteMe` in `backend/src/controllers/meController.js` reads `auth_time` from the Firebase ID token, the moment the person last typed their password or chose their Google account, and allows the deletion only within 5 minutes of it (`RECENT_LOGIN_SECONDS = 5 * 60`). Otherwise it answers 401 `For your safety, log in again, then delete your account within 5 minutes.` This stops someone who picks up a phone that was left logged in from deleting the owner's account. Firebase asks for the same recent login before it deletes the login itself, which the website does right after the API has deleted the Atlas data, so the check also makes that second step work.

## What personal data does Atlas keep and log?

Atlas keeps as little personal data as it can:

- The `users` table holds the Firebase user id, display name, email, role, and creation time. The email is only ever sent to its owner through `/api/me`; other people see only the display name.
- Reports store who reported, but reporters' names are never shown, not even to admins.
- Views, upvotes, saved items, notes, and flashcards are linked to the user and are deleted with the account.
- The `rate_limits` table holds visitors' IP addresses as keys for the write limit, for a short time, until their 15-minute window ends and the hourly clean-up runs.

Besides start-up messages and technical problems (for example a failed Gemini call or a file that could not be deleted), the API's own log records only a few events: unexpected 500 errors with their details, a blocked upload with the user id and the threat name, an account deletion with the user id and the number of files, and an admin deletion with both ids. The API keeps no log of individual requests.

## What security work is still pending for Atlas?

As of 2026-11-01, two pieces of Atlas security work are not finished on the live server:

- **Nightly backups with an off-machine copy**: `backend/scripts/backup.sh` dumps the database and packs the uploads folder, keeping 14 nights, but it is not scheduled on the server yet, and no copy is kept on another machine yet. Until then a lost disk would lose the live data and files.
- **The EICAR test upload**: ClamAV is installed on the live server and `CLAMAV_MODE` is `daemon` (checked 2026-10-31). Uploading the harmless EICAR test file, which must be refused with 422, would confirm the virus scan end to end; that test is still to do.

Already in place on the live server (checked 2026-10-31): ClamAV in daemon mode, and the least-privilege database role `learnhub_api`. The server-side steps are listed in [What server work is still pending for Atlas?](vps-and-shared-infrastructure.md#what-server-work-is-still-pending-for-atlas)

## What are the known security gaps in Atlas?

Known gaps in Atlas, besides the pending nightly backups and the EICAR test upload:

- **No automated tests.** Neither `backend/package.json` nor `frontend/package.json` has a test script, so security rules are checked by hand.
- **In-memory limits reset on restart.** The general and study limits start fresh whenever the API restarts.
- **Token revocation is not checked.** A stolen ID token works until it expires, about an hour.
- **Timestamps have no time zone.** Most tables use `TIMESTAMP` without a time zone, in the database server's local time, so upload, rights-confirmation, and report times carry no zone of their own and depend on the server's time zone setting.
- **The PDF check reads the raw file.** A script hidden inside a compressed part of a PDF is not seen by the name check; ClamAV and the Report button are the next lines of defence.
- **ClamAV knows only listed malware.** A brand-new threat can pass the scan.
- **The website sends no Content-Security-Policy.** Firebase Hosting serves the frontend with caching headers only.
- **Hidden study reviewers stay in Saved lists.** People who saved one before it was hidden still see its details and can still make flashcards from it.
- **The duplicate-file message names the other study reviewer's title,** even when that one is hidden.
- **Email addresses are not verified** before someone can upload.
