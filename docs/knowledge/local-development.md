# Running Atlas locally

This page walks a new developer through running Atlas on their own computer: the tools to install, the settings files, a local PostgreSQL database, the Firebase Auth emulator, the API, the website, test accounts, the Atlas Explorer build, and the start-up errors people meet most often. It follows the README section "Run it locally" and adds the details behind each step, checked against the code.

## What do I need installed to run Atlas locally?

- Node.js 20 or newer (an LTS version). `backend/package.json` asks for Node 20 or newer; the backend relies on Node's built-in `fetch` for Gemini and on `node --watch` for `npm run dev`.
- PostgreSQL 14 or newer, either installed on the computer or run in Docker with the `postgres:16` image.
- The Firebase CLI, installed with `npm install -g firebase-tools`. It runs the Auth emulator, a fake login service on your computer, so local development needs no real Firebase project for logins.
- Java: the README asks for Java 11 or newer for the emulator. With firebase-tools 15, `firebase emulators:start --only auth` does not use Java at all, because only the Firestore, Realtime Database and Storage emulators run on Java and Atlas uses none of them. If your firebase-tools version asks for Java anyway, install a current Java; firebase-tools 15 wants Java 21 or newer for its Java emulators.
- Git, to clone the repository.

A Gemini key and ClamAV are not needed locally: without a key, making flashcards answers "Flashcards are not set up on this server yet.", and with `CLAMAV_MODE=off` uploads are not virus-scanned.

## How do I get the Atlas code and install its packages?

```
git clone https://github.com/remuriin/Atlas.git
cd Atlas/backend
npm install
cd ../frontend
npm install
```

The Atlas backend (an Express 5 API) and frontend (React built with Vite) are two separate Node projects, each with its own `package.json` and `node_modules` folder, so `npm install` runs once in each folder. Run it again after pulling changes that touch a `package.json`. The repository root holds `firebase.json` and `.firebaserc`, which the Firebase CLI reads, so the emulator is started from the root folder.

## How do I create the settings files for local Atlas development?

Copy each template to `.env`. In Git Bash, macOS or Linux, from the repository root:

```
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

In PowerShell on Windows:

```
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

The templates already hold working development values: `PORT=4000`, `FIREBASE_PROJECT_ID=demo-atlas`, `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`, `FRONTEND_ORIGIN=http://localhost:5173` and `CLAMAV_MODE=off` in `backend/.env`, and `VITE_API_URL=http://localhost:4000`, `VITE_USE_AUTH_EMULATOR=true` and `VITE_FIREBASE_PROJECT_ID=demo-atlas` in `frontend/.env`. The one value you must change is DATABASE_URL: the backend refuses to start while it is still the placeholder. The `.env` files are ignored by git; never commit them. `backend/.env.local` is not read by the backend, so backend settings always go in `backend/.env`.

## How do I get a PostgreSQL database for local Atlas development?

The quickest way is a throwaway database in Docker:

```
docker run --name atlas-db -e POSTGRES_PASSWORD=LOCAL_PASSWORD -e POSTGRES_DB=atlas -p 127.0.0.1:5432:5432 -d postgres:16
```

Then put this line in `backend/.env`, with your own password in place of LOCAL_PASSWORD in both commands:

```
DATABASE_URL=postgres://postgres:LOCAL_PASSWORD@localhost:5432/atlas
```

The `127.0.0.1:` part makes the database reachable only from your own computer. Later, `docker start atlas-db` starts it again. With PostgreSQL installed on your computer instead, create a user and a database as the `postgres` superuser (`CREATE USER atlas WITH PASSWORD '...';` then `CREATE DATABASE atlas OWNER atlas;`) and use that user in DATABASE_URL. Percent-encode special characters in the password, for example `@` becomes `%40`. Leave MIGRATION_DATABASE_URL empty: locally one user does everything. Never point local development at the live database.

## How do I create the Atlas tables and sample data locally?

From the `backend/` folder:

```
npm run db:migrate
npm run db:seed
```

`npm run db:migrate` runs `backend/db/schema.sql` and prints "Database is ready: all tables and indexes exist." It is safe to run again at any time; run it after every pull that changes schema.sql. `npm run db:seed` is optional: it adds six sample students and sixteen PDF study reviewers, copies the PDFs into `backend/uploads`, and does nothing if the samples are already there. The sample students cannot log in. To start over with only the sample data, run `npm run db:seed -- --reset --backup ../../atlas-reset-backup.json`, which first saves every table to that JSON file (outside the repository, so git never sees it), then deletes everything except admin accounts. If the migration fails, it prints an error code and a next step; see [Why does npm run db:migrate fail to connect?](troubleshooting.md#why-does-npm-run-dbmigrate-fail-to-connect).

## How do I start the Atlas emulator, API and website?

Use three terminals and start them in this order. Terminal 1, from the repository root, starts the Auth emulator (port 9099) and its web UI (port 4001):

```
firebase emulators:start --only auth --project demo-atlas
```

Terminal 2 starts the API on http://localhost:4000, and `node --watch` restarts it when a backend file changes:

```
cd backend
npm run dev
```

Terminal 3 starts the website on http://localhost:5173:

```
cd frontend
npm run dev
```

Open http://localhost:5173. The API should print "Atlas API is running on http://localhost:4000", "Accepting browser requests from http://localhost:5173" and "Using the Firebase Auth EMULATOR (development only)." Opening http://localhost:4000/api/health shows `{"status":"ok"}`. The README's command has no `--project`; the emulator then uses `learnhub-ea4291` from `.firebaserc`, and FIREBASE_PROJECT_ID must be that id instead. See [Why must the emulator project match FIREBASE_PROJECT_ID?](local-development.md#why-must-the-emulator-project-match-firebase_project_id).

## Which ports does Atlas use on a developer's computer?

| Port | What runs there | Where it is set |
| --- | --- | --- |
| 9099 | Firebase Auth emulator, on 127.0.0.1 | `firebase.json`, FIREBASE_AUTH_EMULATOR_HOST, and written into `frontend/src/firebase.js` |
| 4001 | Emulator UI, with an Authentication tab | `firebase.json` |
| 4000 | Atlas API | PORT in `backend/.env`, and VITE_API_URL |
| 5173 | Vite dev server for the website | `frontend/vite.config.js` (strictPort), and FRONTEND_ORIGIN |
| 5432 | Local PostgreSQL | DATABASE_URL |

Vite uses strictPort: if 5173 is taken it stops with "Port 5173 is already in use" instead of moving to another port, because the API only accepts browser requests from exactly FRONTEND_ORIGIN. Changing a port means changing every setting in its row, for example PORT=4100 together with VITE_API_URL=http://localhost:4100. The emulator address `http://127.0.0.1:9099` is written in the frontend code, so the emulator should stay on port 9099.

## How do I create test accounts in the Atlas emulator?

While the emulator runs and `VITE_USE_AUTH_EMULATOR=true`, every account is a fake one inside the emulator; nothing touches a real Firebase project.

- Email and password: on http://localhost:5173 choose Create account. Any made-up email works, and no email is sent.
- Google: "Continue with Google" opens the emulator's own sign-in window, where you add a made-up Google account.
- Emulator UI: http://127.0.0.1:4001 has an Authentication tab to see, add and delete test accounts.

The first API call after a login creates the account's row in the `users` table. Emulator accounts live only in memory and vanish when the emulator stops, while their rows in `users` stay, which is harmless: signing up again with the same email makes a new row. To keep accounts between runs, add `--export-on-exit=emulator-data` and stop the emulator with Ctrl+C; from then on also add `--import=emulator-data`. Git ignores the `emulator-data` folder. To try the admin Reports page, log in once, then run this in psql on your local database: `UPDATE users SET role = 'admin' WHERE email = 'you@example.com';`

## Why must the emulator project match FIREBASE_PROJECT_ID?

The Firebase Auth emulator writes its own project id into every login token it issues: the id given with `--project`, or, without that flag, the default project in `.firebaserc`, which is `learnhub-ea4291`. The Atlas API checks that each token's project (its "aud" claim) equals FIREBASE_PROJECT_ID, and firebase-admin makes that check even in emulator mode. If the two differ, logging in seems to work in the browser, but every API call that needs a login answers 401 "Your session has expired. Please log in again." Two setups work:

- `firebase emulators:start --only auth --project demo-atlas` with FIREBASE_PROJECT_ID=demo-atlas, which matches the `.env.example` templates. Project ids that start with `demo-` are demo projects that never touch real Firebase resources.
- `firebase emulators:start --only auth` with FIREBASE_PROJECT_ID=learnhub-ea4291 in `backend/.env`.

While the emulator is on, the frontend's VITE_FIREBASE_PROJECT_ID does not change the token, but keep it equal to FIREBASE_PROJECT_ID to avoid confusion. Both sides must also agree on the emulator: FIREBASE_AUTH_EMULATOR_HOST in `backend/.env` together with VITE_USE_AUTH_EMULATOR=true in `frontend/.env`, or neither.

## How do I build the Atlas Explorer and ingest the docs?

The Atlas Explorer is a single HTML page with zoomable diagrams of the Atlas system, the pages of `docs/knowledge/` to read, a glossary, and Rem, a chat that answers questions from those pages. Its tools live in `docs/` and need Node.js. The build needs no secret; only the ingest script needs a `docs/.env` file with two values, which you get from the project owner. Never commit that file:

```
RAAS_URL=ADDRESS-OF-THE-REM-RAAS-SERVICE
RAAS_KEY=YOUR-RAAS-KEY
```

Then, from the repository root:

```
node docs/build-explorer.js
node docs/ingest-docs.js
```

`build-explorer.js` writes `docs/dist/atlas-explorer.html`, which you open in a browser. Its chat asks the Atlas API at VITE_API_URL from `frontend/.env.production` (or `ATLAS_API_URL` in `docs/.env`), and the API keeps the Rem key, so the page holds no key and can be shared freely. `docs/dist/` is ignored by git because it is build output. `ingest-docs.js` sends the Markdown files in `docs/knowledge/` to the Rem RaaS service, which splits them at their headings so the chat can answer from them. Run it again after changing a page in `docs/knowledge/`.

## What do common Atlas start-up errors mean in local development?

- "Atlas backend cannot start yet.": a setting in `backend/.env` is missing or wrong, and the next lines name it; most often DATABASE_URL is still the placeholder.
- "Port 4000 is already in use", Vite's "Port 5173 is already in use", or "Port 9099 is not open on 127.0.0.1, could not start Authentication Emulator.": an older copy is still running in another terminal; stop it.
- "Migration failed: ... [code: ECONNREFUSED]": PostgreSQL is not running; with Docker, run `docker start atlas-db`.
- "[code: 28P01]": wrong user name or password in DATABASE_URL. "[code: 3D000]": the database name does not exist.
- "Seeding failed, nothing was changed": usually the tables do not exist yet; run `npm run db:migrate` first.
- "Could not reach Atlas." in the browser: the API is not running, VITE_API_URL is wrong, or the site was opened at an address other than FRONTEND_ORIGIN, such as 127.0.0.1 instead of localhost.
- "Could not reach the login service." on the login page: the emulator is not running while VITE_USE_AUTH_EMULATOR=true.
- 401 "Your session has expired." right after logging in: the emulator project and FIREBASE_PROJECT_ID differ.

Every message is explained in [Troubleshooting Atlas](troubleshooting.md).
