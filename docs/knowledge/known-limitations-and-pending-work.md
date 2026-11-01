# Known limitations and pending work

This page lists what Atlas does not do well yet, what is limited on purpose, and the work that is still waiting, as of 2026-11-01. It combines the README's "Known limitations" section, with each point checked against the code, with further limitations found in the code and on the live site, the pending server and deploy work, the old LearnHub names kept on purpose, outdated wording, and the curriculum change expected next school year.

## What are the limits of the Atlas upload safety checks?

Every upload to Atlas goes through `backend/src/middleware/upload.js` and `backend/src/middleware/checkUpload.js`, and these checks have known gaps:

- The PDF check looks for risky names (`/JavaScript`, `/JS`, `/Launch`, `/EmbeddedFile`) in the file as it is stored. A script hidden inside a compressed part of the PDF is not seen. ClamAV is the second line of defense there, and the Report button the third.
- ClamAV only recognizes malware that is already on its list, so a brand-new threat can pass it.
- On the live server ClamAV is installed and `CLAMAV_MODE` is `daemon` (checked 2026-10-31), but the test upload of the harmless EICAR file that confirms the scan end to end is still to do.
- Old `.doc` and `.ppt` files are refused, because they can carry macros. Old files of these types that were uploaded before still download.
- Some systems report an unusual content type for Word or PowerPoint files, for example when Office is not installed. The extension and the content type must both match the allowlist, so those uploads are refused with "That file type is not allowed."
- Copies of files uploaded before fingerprints existed are not caught as duplicates, because those older files have no SHA-256 fingerprint.

## What are the limits of viewing files inside Atlas?

Atlas shows some files inside the page and only offers others as downloads:

- PDF files, PNG and JPG images, and text files are shown inside Atlas. Word (`.docx`) and PowerPoint (`.pptx`) files can only be downloaded, and the upload form recommends PDF, image or text files for that reason.
- Some phone browsers show only the first page of a PDF, or just a link, inside the study page. The "Open in new tab" link always shows the whole file.
- Scrollbars follow the light or dark theme everywhere except inside the browser's own PDF viewer, which a web page cannot style.
- When a study reviewer's file is missing on the server, opening or downloading it answers 404 "The file for this study reviewer is missing." On 2026-11-01 this is the case for all 16 sample study reviewers on the live site, until their PDFs from `backend/db/seed-files/` are copied to the server.

## What are the limits of AI flashcards in Atlas?

Atlas flashcards are written by Google Gemini from a saved study reviewer, and they have these limits:

- AI can make mistakes, and the flashcards page says so. Students should check cards against the material.
- Large Word or PowerPoint files are cut to about 200,000 characters of text before Gemini sees them (`backend/src/utils/materialContent.js`). That is far more than 100 cards need.
- Old `.doc` and `.ppt` files cannot be turned into flashcards.
- Short material gives fewer cards than asked for, because Gemini is told not to pad.
- Each account may make 10 flashcard sets per day. Failed attempts do not count.
- The API waits up to 120 seconds for Gemini, but the front door gives every request only 60 seconds. A set that took longer than 60 seconds would show an error even if Gemini finished. Whether real requests come close has not been measured.
- Without `GEMINI_API_KEY` on the server, flashcards are off, and everything else keeps working.

## What are the limits of notes, the feed and search in Atlas?

Smaller limits in everyday use of Atlas:

- The notes editor uses the browser's built-in editing commands (`document.execCommand`). They are old but work in every current browser. Underline is not offered, and Ctrl+U does nothing.
- The remembered feed for the Back button (`frontend/src/services/feedMemory.js`) lives only in the page's memory, for up to 10 minutes. After a reload the filters come back from the address, but the list starts again from page 1 at the top.
- Text inside the clickable upper part of a feed card cannot be selected by dragging. It can on the study reviewer's own page.
- Choosing a tag runs a normal search for that word, not an exact tag filter, so it can also match study reviewers that only mention the word.
- Search has no search index, no typo tolerance and no synonyms. The full list of search and feed limits is in [Search and the feed in Atlas](search-and-feed.md).

## How do the Atlas rate limits behave on restarts and outages?

`backend/src/middleware/rateLimit.js` defines five limits, kept in two places:

- In memory: the general limit (600 requests per 15 minutes, on every request), the study limit (600 saves per 15 minutes, for notes autosave and marking flashcards), and the ask limit (30 Atlas Explorer chat questions per 15 minutes). These reset whenever the API restarts, and they are counted per API process. They only smooth out bursts.
- In PostgreSQL (the `rate_limits` table, through `backend/src/utils/rateLimitStore.js`): the write limit (120 changes per 15 minutes, for example uploads, edits, deletes, upvotes, saves, reports and recorded views) and the daily flashcard limit (10 sets per account). These survive restarts. Rows whose window ended are deleted every hour.

Both database-backed limits use `passOnStoreError: true`: if PostgreSQL cannot be reached, the limiter lets the request through instead of failing it. During a database outage most of those requests fail anyway, but the limits themselves are off. A restart of the API, for example during a deploy, gives everyone a fresh general, study and ask allowance.

## Why do students on one network share the Atlas rate limits?

The general, study, write and ask limits in `backend/src/middleware/rateLimit.js` count per visitor address (`req.ip`), not per account. On the study reviewer routes the write limit even runs before the login check. Only the daily flashcard limit counts per account.

Students in the same school, on the same home Wi-Fi or on the same mobile network often reach the internet through one shared public address. All of them then share one allowance: 600 requests and 120 changes per 15 minutes. A full classroom browsing and opening study reviewers at the same time could reach the write limit and see "You are making changes too quickly. Please wait a few minutes and try again." A limit keyed by account for logged-in users would avoid this; it has not been built.

The address itself is read correctly through the front door (see [visitor addresses](hosting-and-traffic-path.md#how-does-the-atlas-api-know-each-visitors-address)).

## Why does opening a study reviewer use up a write?

When a logged-in student opens a study reviewer, the website calls `POST /api/reviewers/:id/view` to update Recently viewed. That route sits behind the write limiter in `backend/src/routes/reviewersRoutes.js`, so every opened study reviewer uses one of the 120 changes allowed per 15 minutes for that visitor address.

A student who studies quickly, opening many study reviewers, uses the allowance faster than their real changes suggest. Together with a shared school address (see [shared limits](#why-do-students-on-one-network-share-the-atlas-rate-limits)), recorded views can block real changes such as uploads and upvotes. The website ignores a failed view on purpose, so reading still works, but the changes that follow can be refused. Counting views under the roomier study limit, or not counting them at all, would fix this; neither has been done.

## Which Atlas data grows without being cleaned up?

Some Atlas tables and folders only grow:

- `recently_viewed` keeps one row for every study reviewer each student ever opened. Only the newest 20 are shown, but older rows are never deleted. Rows go only when the account or the study reviewer is deleted.
- `reports` keeps closed reports as a record after an admin restores, moves or deletes a study reviewer.
- Files of study reviewers removed by `npm run db:seed -- --reset` stay in the uploads folder, because the reset deletes rows, not files.
- Backups, once the nightly job runs, are kept for 14 nights and then deleted (`KEEP_DAYS` in `backend/scripts/backup.sh`).

The `rate_limits` table does not grow without end: rows whose window ended are deleted every hour. For a school-sized site none of this is urgent, but `recently_viewed` would be the first table to prune.

## Why can the Atlas feed be slower for logged-in users?

For a logged-in student, every card on an Atlas feed page needs two extra database queries: one checks whether the student upvoted it, and one checks whether they saved it (`buildReviewerItems` in `backend/src/utils/reviewerItems.js`). The queries run one after another. A default page of 12 cards therefore costs 24 extra queries, and the largest page of 50 cards costs 100. Visitors who are not logged in skip them.

This keeps the SQL simple, which is a rule of this codebase (plain textbook CRUD, no advanced queries), and each query is small and uses an index. With the database on the same machine the cost is low. Fetching both answers for a whole page with one query each would remove the extra round trips; it has not been done.

## How does Atlas store times?

Most timestamp columns in `backend/db/schema.sql` are `TIMESTAMP` without a time zone, filled with `NOW()` in the database server's local time. The only exception is `rate_limits.reset_at`, which is `TIMESTAMPTZ` because the API compares it with its own clock.

This works while the database server keeps one time zone. Moving the database to a server set to another time zone, or changing the server's time zone, would shift every stored time by the difference, and the website would show wrong dates for uploads, notes and views. Converting the columns to `TIMESTAMPTZ` would remove the risk; it has not been done.

## Does Atlas have automated tests?

No. The Atlas repository has no test files, no test script in `backend/package.json` or `frontend/package.json`, and no GitHub Actions workflow that could run tests on a pull request. The only automated check is `npm run lint` in `frontend/`, which runs ESLint with the accessibility rules and the project's syntax rules, and it is run by hand.

Everything else is checked manually: the API with real requests, the website by clicking through it, accessibility with axe-core and keyboard-only runs (described in the README's "Accessibility" section), and deploys with the [post-deploy checklist](deployment.md#what-should-be-checked-after-every-atlas-deploy). A change can therefore break a part of Atlas that nobody clicks through, and nothing catches it before it goes live.

## Can the Atlas sample students log in?

No. `npm run db:seed` adds six sample students with made-up names and example email addresses (`backend/db/seed.js`). They exist only as rows in the `users` table, with no Firebase account, so nobody can log in as them. They own the 16 sample study reviewers and upvote each other's, so the feed has content and an order.

To try Atlas as a logged-in student, sign up with an email address or with Google, or use the Firebase Auth emulator in local development. To test admin features, make your own account an admin with the SQL update in the README's "Making an admin" paragraph.

## What happened to study reviewers from before the SHS categories?

`npm run db:migrate` moved every study reviewer that existed before the Senior High School categories to strand "All strands", Grade 11, 1st quarter, material type "Reviewer" and subject "Other". Its old subject, for example "Mathematics", was added to its tags so it stays searchable. Uploaders should edit such study reviewers to the right category.

A study reviewer that already had 8 tags then has 9. The limit is 8, so it cannot be saved again until one tag is removed.

On the live Atlas site this no longer matters: the database was reset to the sample data on 2026-10-31, and every sample study reviewer has a proper category. It still applies to any older copy of the database, such as a restored backup or a developer's local database.

## What are the hosting and server limitations of Atlas?

Limits that come from how Atlas is hosted (details in [where Atlas runs](hosting-and-traffic-path.md#where-do-the-atlas-website-and-the-atlas-api-run) and [sharing one server](vps-and-shared-infrastructure.md#why-does-sharing-one-server-matter-for-atlas)):

- One server is a single point of failure: no second server, no standby database, no automatic failover.
- The server's CPU, RAM, disk and PostgreSQL server are shared with the author's other projects.
- The front door runs in k3s, so a k3s failure takes the Atlas API offline even while pm2 keeps it running.
- The API's name depends on the free sslip.io DNS service.
- On 2026-11-01 no backups run, and none are copied off the machine.
- The front door adds no size limit and no rate limit for Atlas; only the API's own limits apply.
- Page addresses such as `/` and `/browse` are cached by browsers for up to an hour (Firebase's default), so a visitor may see the previous website for up to an hour after a deploy. The `no-cache` rule in `firebase.json` only matches `/index.html`.
- `GET /api/health` does not check the database.
- Deploys are manual; merging to `main` deploys nothing.

## What server and deploy work is still pending for Atlas?

Pending on 2026-11-01, with what each item fixes:

1. Copy the 16 sample PDFs from `backend/db/seed-files/` to the server's uploads folder and remove the old files: until then, opening or downloading a sample study reviewer's file on the live site answers 404 "The file for this study reviewer is missing."
2. Upload the harmless EICAR test file to the live site, which must be refused with 422: until then nobody has confirmed the virus scan end to end. ClamAV is installed and set to daemon mode (checked 2026-10-31).
3. Add the nightly cron job for `backend/scripts/backup.sh`, and copy the backups to another machine: until then a disk failure would lose the live data and files.
4. Merge and deploy the new search ranking: until then live search has no word-start matching and does not rank titles that start with the search first. The live API runs the code deployed on 2026-10-29.
5. Set `VITE_TAKEDOWN_EMAIL` and rebuild the website: until then copyright owners must create an account and use Report.
6. Restore `hosting-redirect/` in the maintainer's working copy, or remove the `old` target: until then a full `firebase deploy` would fail.

Already done (checked 2026-10-31): ClamAV in daemon mode, and the limited database role `learnhub_api`. The order and commands are in [the remaining server steps](deployment.md#what-are-the-remaining-steps-for-the-live-atlas-server).

## Which old LearnHub names are kept on purpose?

Atlas was called LearnHub until 2026-10-23. Every name that visitors normally see now says Atlas, but some names stay on purpose, because they cannot change or because changing them gains nothing:

- The Firebase project id `learnhub-ea4291`, and with it the old site learnhub-ea4291.web.app. A project id can never change, and a default site cannot be deleted.
- The sign-in domain `learnhub-ea4291.firebaseapp.com` in `frontend/.env.production`. Google sign-in broke with `redirect_uri_mismatch` when it was changed.
- On the server: the API folder, the pm2 process `learnhub-api`, and the PostgreSQL database `learnhub` with its owner role `learnhub_app` and the limited API role `learnhub_api`.
- In the Fleet repo: `learnhub-route.yaml`, and the front-door objects named after LearnHub (the route, the Service, the EndpointSlice and the certificate).
- The fallback page `hosting-redirect/index.html`, which says "LearnHub is now Atlas".

Do not rename these without a plan: each one is used by live settings, and a rename needs matching changes on the server, in Fleet or in Firebase.

## Which outdated wording about nginx still needs fixing?

Since 2026-10-16 the Atlas API is reached through Envoy Gateway in k3s, not nginx, but some text still says nginx:

- The README's "Current live deployment" section says the API is "behind nginx with a Let's Encrypt certificate". It should say behind Envoy Gateway in k3s, with a Let's Encrypt certificate from cert-manager.
- The `TRUST_PROXY` row in the README's settings table says "when the API is behind nginx". It should say behind one reverse proxy.
- `backend/.env.example` says "Set to true when the API runs behind nginx".
- `backend/src/app.js` has the comment "Behind nginx, the visitor's real address arrives in a header."

The mechanism these lines describe is unchanged: one trusted proxy adds the visitor's address to `X-Forwarded-For`. The README's "Deploying to a VPS" guide, which sets up nginx and certbot on a fresh server, is still a valid way to host Atlas elsewhere and does not need changing, but it is not how the live API is served. Fixing the wording is a documentation change only.

## What changes if the curriculum changes next school year?

Atlas files every study reviewer under the K to 12 Senior High School curriculum that Grade 12 follows in SY 2026-2027: 8 strand values, Grades 11 and 12, four quarters, and fixed subject lists. Grade 11 already moved to the Strengthened SHS curriculum (tracks and elective clusters) in SY 2026-2027, so these lists will need replacing once this year's Grade 12 finishes.

The lists live in two files that must stay identical: `backend/src/utils/categories.js` (the API refuses upload values that are not in it) and `frontend/src/services/categories.js` (the forms, filters and strand colors). Changing one without the other breaks uploads or filtering. A curriculum change would also need:

- a migration in `backend/db/schema.sql` that moves existing study reviewers to the new values, like the one used when the SHS categories were introduced
- new strand colors and a new strand legend on the website
- new sample data in `backend/db/seed.js`, whose 16 study reviewers use the current strands and subjects

The API ignores filter values that are no longer on its lists, so old bookmarks still load.
