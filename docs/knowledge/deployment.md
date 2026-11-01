# Deploying Atlas

Atlas has two parts that are deployed separately and by hand: the website goes to Firebase Hosting with the Firebase CLI, and the API is copied to the author's server and restarted with pm2. The front door in front of the API is a third piece, deployed through the author's private Fleet repo. This page gives the steps for each part, the checks to run afterwards, how to undo a bad deploy, what is live on 2026-11-01, and the server work still to do.

## Does merging a pull request deploy Atlas?

No. The Atlas repository has no GitHub Actions workflows and no Firebase GitHub integration, so merging a pull request into `main` changes only the code on GitHub. Nothing is built, tested or uploaded automatically.

Both Atlas deploys are run by hand by the maintainer:

- The website: build on the maintainer's computer, then `firebase deploy --only hosting:app` (see [deploying the website](#how-do-i-deploy-the-atlas-website)).
- The API: copy the backend to the server and restart pm2 (see [deploying the API](#how-do-i-deploy-the-atlas-api)).

So `main` and the live site can differ. Check what is live before assuming that a merged fix is out (see [what is live](#what-is-live-for-atlas-on-2026-11-01)).

The front door is different: it lives in the Fleet repo, where Flux applies every merge to Fleet's `main` branch within seconds. A merge there is a live change.

## How do I deploy the Atlas website?

The Atlas website is deployed from the maintainer's computer with the Firebase CLI, logged in with an account that can manage the Firebase project `learnhub-ea4291` (the default project in `.firebaserc`):

```
cd frontend
npm ci
npm run build
cd ..
firebase deploy --only hosting:app
```

`npm ci` is needed only on a fresh copy or when `frontend/package-lock.json` changed. `npm run build` runs Vite, which writes the finished site to `frontend/dist` with the production settings. `firebase deploy --only hosting:app` uploads `frontend/dist` to the site `atlas-f2757` and makes it live at https://atlas-f2757.web.app within seconds. `--only hosting:app` leaves the old LearnHub site alone.

When a change touches both parts, deploy the API first, because a new website may call API routes that the old API does not have yet. After the deploy, open the site and press reload once: browsers may keep the previous version of a page for up to an hour (see [browser caching](hosting-and-traffic-path.md#how-does-browser-caching-work-for-the-atlas-website)).

## Which settings are built into the Atlas website?

Vite copies every `VITE_` setting into the built JavaScript, so these values are public and fixed until the next build. `npm run build` reads `frontend/.env` first and then `frontend/.env.production`, whose values win. `frontend/.env.production` is committed and holds the three live-only values:

- `VITE_API_URL=https://api.140-245-60-8.sslip.io`, the live API
- `VITE_USE_AUTH_EMULATOR=false`, so real Firebase logins are used
- `VITE_FIREBASE_AUTH_DOMAIN=learnhub-ea4291.firebaseapp.com`, the sign-in domain that Google accepts

The rest comes from `frontend/.env`, which is not committed: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_PROJECT_ID` and `VITE_FIREBASE_APP_ID` (public Firebase identifiers, not passwords), `VITE_MAX_FILE_SIZE_MB` (keep it equal to the server's `MAX_FILE_SIZE_MB`) and `VITE_TAKEDOWN_EMAIL`.

Never put a secret in a `VITE_` setting: the Gemini key and the database addresses belong only in the server's `backend/.env`. The live website was built with `VITE_TAKEDOWN_EMAIL` empty. Set it to an inbox someone reads before the next build; until then the Terms page tells copyright owners to log in and use Report, then Copyright.

## When does the old LearnHub site need deploying?

The old address, https://learnhub-ea4291.web.app, is the Firebase target `old`. It only redirects to the new site, so it needs deploying again only when `hosting-redirect/` or the `old` block in `firebase.json` changes:

```
firebase deploy --only hosting:old
```

A plain `firebase deploy`, or `firebase deploy --only hosting`, deploys both targets, so it also needs the `hosting-redirect` folder. On 2026-11-01 that folder, which holds only the fallback page `hosting-redirect/index.html`, was deleted in the maintainer's local working copy, although it is still in the repository. Before any deploy that includes the old site, restore it (for example with `git restore hosting-redirect`) or remove the `old` target from `firebase.json` and `.firebaserc`.

Removing the target would not take the old site down: Firebase keeps serving its last deployed redirect, and a project's default site cannot be deleted. `firebase deploy --only hosting:app` works in either case.

## How do I deploy the Atlas API?

The Atlas API is deployed by hand on the server, in the API folder that still carries the LearnHub name:

1. Copy the changed files from `backend/` to the server over the maintainer's SSH access. One way is a bundle named `atlas-backend.tar.gz`, which git ignores. Do not copy `backend/.env`, `backend/uploads/` or `node_modules`: the server has its own production settings and the live uploaded files.
2. If `backend/package.json` or `backend/package-lock.json` changed, install the dependencies on the server.
3. If `backend/db/schema.sql` changed, run the migration (see [migrations](#how-do-database-migrations-fit-into-an-atlas-deploy)).
4. Restart the API with pm2.
5. Check it (see [checking the API](#how-do-i-check-the-atlas-api-after-a-deploy)).

Steps 2 to 4, run on the server in the backend folder:

```
npm ci --omit=dev
npm run db:migrate
pm2 restart learnhub-api
```

A restart interrupts the API for a moment, during which the front door answers 503, and it resets the in-memory rate limits. `pm2 restart` keeps the environment the process was started with, including `NODE_ENV=production`. The API is not deployed by Flux and has no container image.

## How do database migrations fit into an Atlas deploy?

`npm run db:migrate` runs `backend/db/migrate.js`, which applies `backend/db/schema.sql`. Every statement in that file is written to be safe to repeat (`IF NOT EXISTS` or a check first), so running it again changes nothing. It never deletes rows: it adds tables, columns and indexes, and its only data changes are the one-time updates that filed older study reviewers and saved copies under the SHS categories.

Rules for the live Atlas database:

- Run the migration before `pm2 restart learnhub-api`, so the new code finds its tables and columns. The changes are additive, so the old code that is still running keeps working against the newer schema.
- Migrations connect as the owner of the tables (`learnhub_app`) through `MIGRATION_DATABASE_URL` in `backend/.env`, and the API connects through `DATABASE_URL`, which is meant for the limited role `learnhub_api`. On the live server that role exists and `MIGRATION_DATABASE_URL` is set for the owner (checked 2026-10-31). A server without the limited role can use the owner for both and leave `MIGRATION_DATABASE_URL` empty.
- The database is reachable only from the server and over the maintainer's VPN, so migrations run on the server or from the maintainer's computer while it is on the VPN.
- `npm run db:seed` never runs by itself. `npm run db:seed -- --reset --backup file.json` saves every table to a JSON file, deletes all data except admin accounts, and adds the sample data.

On 2026-11-01 the live database already has the current schema.

## How do I check the Atlas API after a deploy?

After `pm2 restart learnhub-api`, check from any computer:

```
curl https://api.140-245-60-8.sslip.io/api/health
```

The answer must be `{"status":"ok"}`. That proves the process runs and that the front door, the certificate and the name work, but not that the database works, so also load the feed on the website.

On the server, `pm2 status` must show `learnhub-api` as online without a climbing restart count. `pm2 logs learnhub-api` should show the two start lines: "Atlas API is running" and "Accepting browser requests from https://atlas-f2757.web.app". A different address in the second line means `FRONTEND_ORIGIN` is wrong and browsers will be blocked. If the API refuses to start, the log says "Atlas backend cannot start yet" and names the setting to fix. With `CLAMAV_MODE` set to `daemon`, as on the live server, the warning "CLAMAV_MODE is off, so uploads are not virus-scanned" must not appear. Errors with status 500 are logged with details, while visitors only see "Something went wrong on our side."

The front door's own state (route and certificate) lives in the k3s cluster, is checked there by the maintainer, and does not change during an API deploy.

## How do I undo a bad Atlas deploy?

Each part of Atlas is rolled back on its own:

- Website: the Firebase console keeps every Hosting release. Open Hosting for the site `atlas-f2757`, find the previous release in the release history, and roll back to it. Building an older commit and deploying it again also works.
- API: there is no automatic rollback. Keep the previous backend bundle, copy it back to the server, run `npm ci --omit=dev` if the dependencies differ, and run `pm2 restart learnhub-api`. Migrations do not need undoing: they only add tables, columns and indexes, and older code ignores them.
- Data: restore from a backup made by `backend/scripts/backup.sh`. The database dump is loaded into an empty database with `psql`, and the uploads archive is unpacked back into the backend folder; the README's "Backups" section has the commands. Until the nightly backup job runs, the only fallback is a backup taken by hand, such as the JSON file from `npm run db:seed -- --reset --backup`.
- Front door: a `git revert` of the change in the Fleet repo, which Flux applies like any other change.

## How are changes to the Atlas front door deployed?

The front door for the Atlas API is not in the Atlas repository. Its files are in the author's private Fleet repo under `infrastructure/configs/`: `learnhub-route.yaml` (the route and its 60-second timeout), `gateway.yaml` (the listener for the API name), `certificate-sslip.yaml` (the certificate) and `client-traffic.yaml` (how visitor addresses are read).

To change them, edit the file in Fleet and merge it into Fleet's `main` branch. Flux, running in the k3s cluster, checks `main` every minute and also gets a webhook on each push, so the change is live within seconds to a minute. There is no separate deploy step: merging in Fleet is deploying. A bad change is undone with a `git revert` in Fleet. If a change breaks the route that carries Flux's own webhook, the maintainer can make Flux apply the repo by hand on the server.

Typical reasons to touch these files: a new API name (a real domain), a different timeout, or a size limit or rate limit at the front door. The Atlas API itself is not deployed by Flux and stays on pm2, so backend code changes never go through Fleet.

## What must happen after the sample data is reseeded?

`npm run db:seed` writes the 16 sample PDFs from `backend/db/seed-files/` into the `UPLOAD_DIR` of the computer that runs it, and inserts their rows into the database it connects to. When the seed runs on the maintainer's computer against the live database over the VPN, the rows reach the server but the files do not. The files must then be copied by hand into the server's uploads folder, keeping their names (for example `seed-rock-cycle.pdf`).

`--reset` deletes rows, not files. The files of the study reviewers it removed stay on the server's disk until someone deletes them.

The live database was reset to the sample data on 2026-10-31 (6 sample students and 16 study reviewers; admin accounts kept). On 2026-11-01 the files had not been copied yet: opening or downloading a sample study reviewer's file on the live site answers 404 "The file for this study reviewer is missing." The pending steps:

1. Copy `backend/db/seed-files/*.pdf` into the server's uploads folder.
2. Delete the old files in that folder that no study reviewer uses any more.

For step 2, list the `stored_name` values of the `reviewers` table first, and keep every file that is still listed.

## What should be checked after every Atlas deploy?

Run through this list on https://atlas-f2757.web.app after any Atlas deploy:

1. The landing page loads, and the feed at `/browse` shows study reviewer cards.
2. Opening a study reviewer shows its file (PDF or image) or offers the download.
3. Signing up or logging in with email and password works, and "Continue with Google" works too.
4. Uploading a small PDF works, with the "I made this file, or I have the right to share it" box ticked. The harmless EICAR test file must be refused with 422, which shows that the virus scan works.
5. Upvote, Save, notes and Recently viewed work.
6. Making flashcards from a saved study reviewer works, which checks the Gemini key.
7. The Terms page shows the takedown inbox, once `VITE_TAKEDOWN_EMAIL` is set.
8. https://learnhub-ea4291.web.app still redirects to the new address.
9. https://api.140-245-60-8.sslip.io/api/health answers `{"status":"ok"}`.

If every API call fails in the browser and the developer console shows a CORS error, the server's `FRONTEND_ORIGIN` does not exactly match `https://atlas-f2757.web.app` (no trailing slash). Each API answer names the allowed website in its `access-control-allow-origin` header.

## What is live for Atlas on 2026-11-01?

Checked from outside on 2026-11-01, and on the server on 2026-10-31:

- Website: https://atlas-f2757.web.app serves a recent build that already has the landing page at `/`, the upload limit and "Delete my account". It was built with `VITE_TAKEDOWN_EMAIL` empty, so the Terms page asks copyright owners to log in and use Report.
- Old address: https://learnhub-ea4291.web.app redirects with a 301 and keeps the path.
- API: https://api.140-245-60-8.sslip.io answers and allows the origin https://atlas-f2757.web.app. It runs the code deployed on 2026-10-29, with the reports and admin routes, the input checks and the Senior High School categories. The new search ranking (word-start matching, and titles that start with the search ranked first) is not merged or deployed yet, so it is not live.
- Virus scan: ClamAV is installed and `CLAMAV_MODE` is `daemon`. The EICAR test upload that confirms it end to end is still to do.
- Database: has the current schema, the sample data from the 2026-10-31 reset, and the limited role `learnhub_api`.
- Sample files: not on the server yet, so opening or downloading a sample study reviewer's file answers 404 "The file for this study reviewer is missing."

Still to do on the server: copying the sample files, the EICAR test upload, and the nightly backup job with an off-machine copy. The steps are in [the remaining server steps](#what-are-the-remaining-steps-for-the-live-atlas-server).

## What are the remaining steps for the live Atlas server?

The Atlas server work still to do on 2026-11-01, in this order:

1. Copy the 16 sample PDFs from `backend/db/seed-files/` into the server's uploads folder, keeping their names. Until then, opening or downloading a sample study reviewer's file on the live site answers 404 "The file for this study reviewer is missing." Then delete only the old files that no row of the `reviewers` table names (see [reseeding](#what-must-happen-after-the-sample-data-is-reseeded)).
2. Upload the harmless EICAR test file on the live site. It must be refused with 422, which confirms the virus scan end to end. If it is accepted, restart the API with `pm2 restart learnhub-api`, so it reads `CLAMAV_MODE` again, and repeat the test.
3. Add the nightly backup cron line for `backend/scripts/backup.sh` from the README's "Backups" section (it needs `pg_dump` from `postgresql-client`, version 14), and a second job that copies the backups to another machine.
4. On the maintainer's computer: set `VITE_TAKEDOWN_EMAIL`, build, and run `firebase deploy --only hosting:app`. Restore `hosting-redirect` first if a full deploy is planned.
5. Once the new search ranking is merged, deploy the API (see [deploying the API](#how-do-i-deploy-the-atlas-api)).
6. Work through the [post-deploy checklist](#what-should-be-checked-after-every-atlas-deploy).

ClamAV and the limited database role are already set up on the live server (checked 2026-10-31).

## How are ClamAV and the limited database role set up on an Atlas server?

Both are already set up on the live Atlas server (checked 2026-10-31): ClamAV is installed, its service runs, and `CLAMAV_MODE` is `daemon`; the limited role `learnhub_api` exists next to the table owner `learnhub_app`. To set them up on a new server, or again after a rebuild, work on the server:

1. Install ClamAV and set `CLAMAV_MODE` in `backend/.env`. `daemon` is fast but keeps about 1 to 1.5 GB of RAM in use on a shared server; `command` uses little RAM but adds 10 to 30 seconds per upload. Check the free memory first.
2. Create the limited role with `backend/db/api-user.sql` (this needs the database superuser on the server). Then set `DATABASE_URL` to a URL for `learnhub_api` and `MIGRATION_DATABASE_URL` to the table owner.
3. Run `pm2 restart learnhub-api`, then check `/api/health`, the logs, and an EICAR upload, which must be refused with 422.

The README's "Deploying to a VPS" and "A limited database user for the API" sections have the full commands.
