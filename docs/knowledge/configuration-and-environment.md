# Atlas settings and environment variables

Atlas is configured with environment variables kept in small `.env` files: `backend/.env` for the API, `frontend/.env` and `frontend/.env.production` for the website, and `docs/.env` for the Atlas Explorer tools. This page lists every variable with what it controls, its default, whether production needs it and whether it is secret, plus the start-up checks that refuse bad values. No real secret values appear on this page, only public defaults and placeholders.

## Where do Atlas settings live and which files are loaded?

- Backend: `backend/src/config/env.js` loads only `backend/.env` (with the dotenv package) and checks it once at start. `backend/.env.local` is NOT loaded, so values put there have no effect. A variable already set in the process environment wins over the file, because dotenv does not overwrite it. Template: `backend/.env.example`.
- Frontend: Vite reads `frontend/.env` for `npm run dev` and `npm run build`, and `npm run build` also reads `frontend/.env.production`, whose values win. Vite also reads `.env.local` files in `frontend/`. Only names that start with `VITE_` reach the website's code. Template: `frontend/.env.example`.
- Atlas Explorer and docs ingest: `docs/.env` holds `RAAS_URL` and `RAAS_KEY`.

Git ignores `.env`, `.env.local` and `.env.*.local` files in every folder. The `.env.example` templates are committed with placeholders only, and `frontend/.env.production` is committed on purpose because everything in it is public. After changing a backend value, restart the API; after changing a frontend value, restart `npm run dev` or build again, because Vite reads the files only when it starts.

## Which database settings does the Atlas backend read?

| Variable | What it controls | Default | Production | Secret |
| --- | --- | --- | --- | --- |
| `DATABASE_URL` | The PostgreSQL URL the API uses, in the form `postgres://USER:PASSWORD@HOST:5432/DBNAME` | none | Required | Yes, it holds a password |
| `MIGRATION_DATABASE_URL` | The URL of the user that owns the tables, used by `npm run db:migrate`, `npm run db:seed` and the backup script | empty, which means "use DATABASE_URL" | The owner, `learnhub_app`, when the API uses the limited user; set on the live server | Yes |
| `DATABASE_SSL` | `true` turns on SSL that encrypts the connection without verifying the certificate | `false` | Only when PostgreSQL is on another machine and requires SSL | No |

The API refuses to start when DATABASE_URL is empty or still exactly the placeholder from the template. If the password contains characters such as `@ : / # ?`, they must be percent-encoded, for example `@` becomes `%40`. When the API runs on the same server as PostgreSQL, the host is `localhost`. In production, DATABASE_URL is meant for the limited user `learnhub_api` and MIGRATION_DATABASE_URL for the owner `learnhub_app`. On the live server the limited user exists and MIGRATION_DATABASE_URL is set for the owner (checked 2026-10-31); see [Which database users does Atlas have?](database-operations.md#which-database-users-does-atlas-have).

## Which Firebase and mode settings does the Atlas backend read?

| Variable | What it controls | Default | Production | Secret |
| --- | --- | --- | --- | --- |
| `FIREBASE_PROJECT_ID` | The Firebase project whose login tokens are accepted | none (`demo-atlas` in the template) | Required: the real project id | No, it is a public id |
| `FIREBASE_AUTH_EMULATOR_HOST` | Makes the API accept tokens from the local Auth emulator (`127.0.0.1:9099` in the template) | empty, meaning off | Must be absent or empty | No |
| `NODE_ENV` | `production` hides internal error details, refuses the emulator setting and warns when virus scanning is off | not set, meaning development | Required: `production` | No |

FIREBASE_PROJECT_ID must equal the frontend's VITE_FIREBASE_PROJECT_ID, and in development also the project the Auth emulator runs with. The API needs only the project id to check tokens, because Google's public keys do the rest, so no service-account key file is kept on the server. Emulator tokens are not signed and anyone could forge one, which is why the API refuses to start when FIREBASE_AUTH_EMULATOR_HOST is set while NODE_ENV=production. An empty FIREBASE_AUTH_EMULATOR_HOST counts as not set. NODE_ENV is not in `backend/.env.example`; it is usually given by the process manager that starts the API, but a line in `backend/.env` works too.

## Which server and upload settings does the Atlas backend read?

| Variable | What it controls | Default | Production |
| --- | --- | --- | --- |
| `PORT` | Port the API listens on | `4000`, also when the value is not a number | Optional |
| `FRONTEND_ORIGIN` | The one website address allowed to call the API from a browser (CORS) | `http://localhost:5173` | Required: the site's exact address |
| `UPLOAD_DIR` | Folder for uploaded files; a relative path counts from `backend/` | `./uploads` | Optional |
| `MAX_FILE_SIZE_MB` | Largest upload in MB | `10`, also for 0, negative or non-numbers | Optional |
| `MAX_UPLOADS_PER_USER` | How many study reviewers one person may have at a time | `50` | Optional |
| `TRUST_PROXY` | `true` trusts exactly one proxy, so rate limits see each visitor's real IP | `false` | `true` behind the gateway (reverse proxy) |

None of these is secret. FRONTEND_ORIGIN must match the browser's address exactly, with scheme, host and port and no trailing slash: `http://localhost:5173` and `http://127.0.0.1:5173` are different origins, and only one origin is allowed. UPLOAD_DIR is created if missing, and the user that runs the API needs write access to it. Keep VITE_MAX_FILE_SIZE_MB equal to MAX_FILE_SIZE_MB, and keep any request size limit of a proxy in front of the API above it. Deleting a study reviewer frees an upload place; replacing its file uses none. Without TRUST_PROXY=true behind a proxy, every visitor seems to come from the proxy and all share one rate limit.

## Which flashcard and virus scan settings does the Atlas backend read?

| Variable | What it controls | Default | Production | Secret |
| --- | --- | --- | --- | --- |
| `GEMINI_API_KEY` | Google Gemini key that makes flashcards, used only by the server | empty: flashcards off | Needed for flashcards | Yes |
| `GEMINI_MODEL` | The Gemini model that writes flashcards | `gemini-3.5-flash-lite` | Optional | No |
| `CLAMAV_MODE` | Virus scan for uploads: `off`, `daemon` or `command` | `off` | `daemon`, or `command` on a small server | No |
| `CLAMAV_SOCKET` | `daemon` mode only: the ClamAV service's socket | `/var/run/clamav/clamd.ctl`, the Ubuntu and Debian default | Only if different | No |

Without GEMINI_API_KEY everything else keeps working, and making flashcards answers 503 "Flashcards are not set up on this server yet." The key is a secret: never put it in `frontend/.env` and never commit it. `daemon` asks the running ClamAV service, which is fast but keeps about 1 to 1.5 GB of RAM in use; `command` runs `clamscan` once per upload, which uses little RAM but takes 10 to 30 seconds per upload. Any other CLAMAV_MODE value stops the API at start. In production, `off` starts with the warning "Warning: CLAMAV_MODE is off, so uploads are not virus-scanned." When a scan cannot run, the upload is refused rather than let through unscanned.

## Which settings does the Atlas frontend read?

| Variable | What it controls | When empty |
| --- | --- | --- |
| `VITE_API_URL` | Address of the API; a trailing slash is removed | `http://localhost:4000` |
| `VITE_USE_AUTH_EMULATOR` | `true` sends logins to the emulator at `http://127.0.0.1:9099` | real Firebase |
| `VITE_MAX_FILE_SIZE_MB` | Size limit the browser checks before sending a file | `10` |
| `VITE_TAKEDOWN_EMAIL` | Inbox shown on the Terms page for copyright removal requests | the page says to use Report, then Copyright |
| `VITE_FIREBASE_API_KEY` | Firebase web API key | a stand-in that only the emulator accepts |
| `VITE_FIREBASE_AUTH_DOMAIN` | Domain of the Google sign-in pages | none |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project id (`demo-atlas` in the template) | none |
| `VITE_FIREBASE_APP_ID` | Firebase web app id | none |

None of the Atlas frontend settings is secret, because all of them are built into the public website. The live values in `frontend/.env.production` are `VITE_API_URL=https://api.140-245-60-8.sslip.io`, `VITE_USE_AUTH_EMULATOR=false` and `VITE_FIREBASE_AUTH_DOMAIN=learnhub-ea4291.firebaseapp.com`. The four VITE_FIREBASE_ values come from `firebase apps:sdkconfig WEB APP_ID --project PROJECT_ID`. VITE_TAKEDOWN_EMAIL should name an inbox someone reads before the site goes live.

## Why are the VITE_ settings public, and where does the live build get them?

Vite copies every `VITE_` value into the JavaScript files it builds, so anyone can read them with the browser's developer tools. That is fine for Atlas because none of them is a secret: the Firebase web config values are public identifiers, not passwords. Never put a secret such as GEMINI_API_KEY, a database URL or RAAS_KEY into a `VITE_` variable. `npm run build`, which makes the version deployed to Firebase Hosting, reads `frontend/.env` and then `frontend/.env.production`, whose three values win: the live API address, VITE_USE_AUTH_EMULATOR=false and the sign-in domain. Every other value of the live site, such as the Firebase API key, project id and app id, VITE_TAKEDOWN_EMAIL and VITE_MAX_FILE_SIZE_MB, comes from `frontend/.env` at build time, so that file must hold the real project's values when building. VITE_FIREBASE_AUTH_DOMAIN stays `learnhub-ea4291.firebaseapp.com` because Google only accepts sign-ins from addresses listed on the project's OAuth client.

## What must be set for Atlas in production?

A checklist for the server's `backend/.env` and the live build:

- `NODE_ENV=production` for the API process.
- `DATABASE_URL` with the limited API user `learnhub_api`; the host is `localhost` when the API and PostgreSQL share the server. `MIGRATION_DATABASE_URL` set to the table owner, `learnhub_app`.
- `FIREBASE_PROJECT_ID` set to the real project id, `learnhub-ea4291`, not `demo-atlas`.
- No `FIREBASE_AUTH_EMULATOR_HOST` line; the API refuses to start with one.
- `FRONTEND_ORIGIN=https://atlas-f2757.web.app`, the site URL exactly, with no trailing slash.
- `TRUST_PROXY=true`, because the API sits behind the gateway, a reverse proxy that handles HTTPS and passes each visitor's address on.
- `CLAMAV_MODE=daemon`, or `command` on a server with less than 2 GB of RAM, with ClamAV installed; `off` only logs a warning.
- `GEMINI_API_KEY` set if flashcards should work.
- `MAX_FILE_SIZE_MB` equal to VITE_MAX_FILE_SIZE_MB, and below any request size limit of the proxy in front of the API.
- The website built with `VITE_USE_AUTH_EMULATOR=false`, the live `VITE_API_URL`, the real Firebase values and `VITE_TAKEDOWN_EMAIL`.
- The site's domain listed in Firebase Authentication's authorized domains.

## What does the Atlas backend print when a setting is wrong?

`backend/src/config/env.js` checks the settings before anything else runs. A problem prints "Atlas backend cannot start yet." with a line of dashes, the reason and numbered steps, then stops with exit code 1. The reasons, checked in this order:

- "DATABASE_URL is missing or is still the placeholder." Put a real PostgreSQL URL in `backend/.env`, run `npm run db:migrate` once, and start again.
- "FIREBASE_PROJECT_ID is empty." Set it to the Firebase project id, the same value as VITE_FIREBASE_PROJECT_ID.
- "FIREBASE_AUTH_EMULATOR_HOST is set while NODE_ENV=production." Remove that line from `backend/.env` on the server.
- 'CLAMAV_MODE is "VALUE", which is not one of: off, daemon, command.' Fix the spelling.

Only the first failing check is reported, so fix it and start again until the API runs. The same checks run for `npm run db:migrate` and `npm run db:seed`, which load the same settings. A healthy start prints "Atlas API is running on http://localhost:4000", "Accepting browser requests from" followed by FRONTEND_ORIGIN, and, with the emulator, "Using the Firebase Auth EMULATOR (development only)." A busy port prints "Port 4000 is already in use. Stop the other program or change PORT in backend/.env."

## Which settings do the Atlas Explorer and docs ingest scripts read?

The Atlas Explorer tools in `docs/` read `docs/.env`:

| Variable | What it holds | Secret |
| --- | --- | --- |
| `RAAS_URL` | Address of the Rem RaaS service, which answers the Explorer chat from the ingested docs | No |
| `RAAS_KEY` | The key for that service | Yes |

`node docs/build-explorer.js` builds `docs/dist/atlas-explorer.html` and writes the key into that page, so the built page is as secret as the key: `docs/dist/` is ignored by git, and the page should only be shared with people who may use the key. `node docs/ingest-docs.js` sends the Markdown files in `docs/knowledge/` to the service. `docs/.env` is ignored by git, because the `.env` rule covers every folder; never commit it or paste the key anywhere public. After the key changes, update `docs/.env` and build the page again, because an older page still holds the old key. The pages in `docs/knowledge/` are public in the repository, so they must never contain secrets or private server details.

## Which settings does the Atlas backup script read?

`backend/scripts/backup.sh` (planned, not yet installed on the live server) does not use `env.js`. It reads three values straight from `backend/.env` with grep: MIGRATION_DATABASE_URL, falling back to DATABASE_URL when that is empty, and UPLOAD_DIR, where an empty value means `./uploads` inside `backend/`. It takes the last line that starts with each name, so lines must be written as `NAME=value` at the very start of the line; surrounding double quotes are removed. Two more settings come from the script's own environment, not from `backend/.env`: `BACKUP_DIR`, the backup folder on the server, which the script creates and limits to its owner, and `KEEP_DAYS`, how many nights of backups to keep, 14 by default. When no database URL is found, it prints "backup failed: DATABASE_URL is not set" and stops.

## Which Atlas settings are secrets and where are they kept?

The Atlas secrets are DATABASE_URL and MIGRATION_DATABASE_URL (they hold database passwords), GEMINI_API_KEY and RAAS_KEY, plus the psql variable `api_password`, which is typed once when `api-user.sql` runs and never stored in a file. They live only in the server's `backend/.env` and in each developer's own `backend/.env` and `docs/.env`; never in git, chat messages, screenshots or these docs. The `.env.example` templates hold placeholders only. `backend/.env.local` is not loaded by the backend, so it is not a place for settings. Not secret: every `VITE_` value, FIREBASE_PROJECT_ID, the Firebase web config, FRONTEND_ORIGIN and the API address, which are public by design. Private notes about the server belong in `docs/private/`, which git ignores, and never in `docs/knowledge/`, which is public. If a secret leaks, replace it at its source (a new Gemini key, a new database password, a new RaaS key), update the `.env` file, then restart the API or rebuild the page.
