# Atlas overview

This document gives the big picture of Atlas: what it is and who it is for, what it offers and what it leaves out, its main parts in plain words, where each part runs, why it used to be called LearnHub, and how the project grew from its first version.

## What is Atlas?

Atlas is a website where Filipino Senior High School (SHS) students in Grade 11 and Grade 12 share and find study reviewers: notes, study guides, practice tests and formula sheets that students made themselves. Students upvote the study reviewers that helped them, so the most useful ones rise to the top of the feed. Atlas is a school project. The live website is https://atlas-f2757.web.app. Atlas used to be called LearnHub and was renamed on 2026-10-23.

In the Atlas code a study reviewer is called a `reviewer` (the database table, the API routes and the React components), but the website always writes "study reviewer".

## Who is Atlas for?

Atlas is made for Senior High School students in the Philippines, Grade 11 and Grade 12, who follow the K to 12 curriculum. Every study reviewer on Atlas is filed by strand (for example STEM or ABM), grade, quarter, subject and material type, so a student can find material for their own classes. See [Study reviewer categories](categories-and-curriculum.md#how-does-atlas-file-a-study-reviewer).

Anyone can browse Atlas without an account: the feed, the study reviewer pages and the files are public. A free account is needed to share, upvote, save, study with notes and flashcards, and report. Admins are accounts with the admin role; they look at study reviewers that people reported.

## What can you do on Atlas?

This is the complete list of what the Atlas website offers:

- Browse the feed of study reviewers, sorted by Top (most upvotes) or New, with filters for strand, grade, quarter and subject, and a search box.
- Open a study reviewer's page and open or download its file (PDF, Word, PowerPoint, text, PNG or JPG).
- Share your own study reviewers (up to 50 at a time, up to 10 MB per file), and edit or delete them.
- Upvote the study reviewers that helped you (one upvote per person).
- Save study reviewers to a private Saved list.
- Study a saved study reviewer: read the file next to your own formatted notes, which save by themselves.
- Turn a saved study reviewer into 5 to 100 flashcards written by Google Gemini, and track which cards you know.
- Report a study reviewer that is offensive, spam, irrelevant, in the wrong category, or copied.
- See your Recently viewed list, change your display name, switch dark mode, and delete your account.
- As an admin: look at reported study reviewers and restore, re-file or delete them.

Step-by-step help for each of these is in [Using Atlas](user-guide.md#how-do-i-find-study-reviewers-on-atlas).

## What does Atlas not do?

Atlas keeps its scope small on purpose. Upvotes are the only social feature: Atlas has no comments, threads, chat, direct messages, star ratings, written reviews, downvotes, followers or friend lists.

- Atlas has no mobile app. It is a website that works in phone and computer browsers.
- Atlas cannot show Word or PowerPoint files inside the page; they can only be downloaded.
- Atlas does not search inside the files themselves, only their details.
- Atlas does not accept textbooks, modules, paid review-center files, or other people's work without permission.
- Atlas sends no email notifications. The only emails are Firebase's password reset emails.
- Atlas uses Google Gemini only to write flashcards. The Atlas website has no AI chat; the Rem chat lives in the Atlas Explorer instead.
- Atlas does not yet follow the newer Strengthened SHS curriculum.
- Atlas does not use Firestore or Firebase Storage.

## What are the main parts of Atlas?

Atlas has six main parts:

| Part | What it is | In plain words |
| --- | --- | --- |
| Website | React 19 app built with Vite, in `frontend/` | The pages you see in the browser |
| API | Express 5 app on Node.js 20 or newer, in `backend/` | The program that answers the website, checks who you are and applies every rule |
| Database | PostgreSQL 14 | Tables that hold accounts, study reviewer details, upvotes, notes and flashcards |
| File storage | An `uploads` folder on the server's disk | Where the uploaded files themselves are kept |
| Firebase Authentication | Google's sign-in service | Keeps logins and passwords, and proves to the API who you are |
| Google Gemini | Google's AI model, called only by the API | Writes flashcards from a saved study reviewer |

A study reviewer on Atlas is always two things: a row in the database and a file in the uploads folder. Backups therefore need both.

## How do the parts of Atlas work together?

A typical visit to Atlas goes like this:

1. The browser loads the website from Firebase Hosting.
2. You sign in with Firebase Authentication, which gives the browser an ID token: a signed pass that proves which account you are.
3. The website calls the Atlas API and sends that token in the `Authorization` header.
4. The API checks the token with `firebase-admin`, then reads and writes the PostgreSQL database with plain SQL, and saves or sends files from the uploads folder.
5. Only for flashcards, the API sends the saved file's content to Google Gemini and stores the cards it gets back.

Passwords never reach the Atlas API or its database. Upvote counts are not stored as numbers; the API counts the upvotes each time, so the total is always right. More detail: [How does Atlas know who I am?](accounts-and-sign-in.md#how-does-atlas-know-who-i-am)

## Where does Atlas run?

- Website: Firebase Hosting site `atlas-f2757` (https://atlas-f2757.web.app) in the Firebase project `learnhub-ea4291`. The old address https://learnhub-ea4291.web.app sends every page to the same page on the new address with a permanent (301) redirect.
- API: the author's VPS (a rented virtual server, on Oracle Cloud's free tier, shared with other projects), at https://api.140-245-60-8.sslip.io. sslip.io is a free name service that turns that name into the server's address. Requests reach the API through Envoy Gateway, the front door of a small Kubernetes (k3s) cluster, which holds an HTTPS certificate from Let's Encrypt managed by cert-manager. The API program itself runs on the server under the process manager pm2, as `learnhub-api`.
- Database: PostgreSQL 14 on the same server. It cannot be reached from the public internet, only through the server's own VPN.
- Uploaded files: a folder on the same server's disk.
- Sign-in: Firebase Authentication, run by Google. Flashcards: Google Gemini.

The README still calls the API's front door nginx. That wording is from before 2026-10-16, when Envoy Gateway took over. The full path of a request is in [How does a request reach the Atlas API?](hosting-and-traffic-path.md#how-does-a-request-reach-the-atlas-api)

## What is still planned for the live Atlas server?

As of 2026-11-01, the live Atlas API runs the code deployed on 2026-10-29, and some work for the live site is not done yet:

- Improved search: the new search ranking, with word-start matching and titles that start with the search ranked first, is not merged or deployed yet, so it is not live. See [How does search work on Atlas?](user-guide.md#how-does-search-work-on-atlas)
- Sample files: the PDF files of the 16 sample study reviewers (`backend/db/seed-files/`) are not on the server yet, so opening or downloading them on the live site answers 404 "The file for this study reviewer is missing." until they are copied.
- Virus scan test: ClamAV is installed and set to daemon mode on the live server (checked 2026-10-31). The test upload of the harmless EICAR file, which confirms the scan end to end, is still to do.
- Nightly backups: `backend/scripts/backup.sh` exists, but the nightly job (cron) that runs it is not set up yet, and no copy is kept on another machine.

Already in place: the least-privilege database user `learnhub_api`, which may only read and change rows, exists on the live server (checked 2026-10-31). The steps still to do are in [the remaining server steps](deployment.md#what-are-the-remaining-steps-for-the-live-atlas-server).

## Why is it called Atlas, and what was LearnHub?

Atlas began on 2026-10-08 under the name LearnHub. On 2026-10-23 it was renamed Atlas (pull request #6): every visible "LearnHub" was replaced, a new Firebase Hosting site `atlas-f2757` was made for the new address, and the old address became a redirect. Firebase cannot delete a project's default site, so `learnhub-ea4291.web.app` stays as a redirect site, built from the `hosting-redirect/` folder, which also holds a fallback page saying "LearnHub is now Atlas". A dark-mode choice saved in the browser under the old LearnHub name still works. A new Atlas logo came later, in pull request #19.

## Which old LearnHub names does Atlas keep on purpose?

Some names still say "learnhub" on purpose, because they cannot change or because changing them adds risk without any benefit. Visitors never see them, except the Google sign-in window. The complete list:

- The Firebase project id `learnhub-ea4291`. A project id can never be changed.
- The Google sign-in domain `learnhub-ea4291.firebaseapp.com`. See [Why does Google sign-in use learnhub-ea4291.firebaseapp.com?](accounts-and-sign-in.md#why-does-google-sign-in-use-learnhub-ea4291firebaseappcom)
- The old website address learnhub-ea4291.web.app, kept as a redirect.
- The backend's folder on the server, still named learnhub.
- The pm2 process name `learnhub-api`.
- The PostgreSQL database `learnhub`, its owner role `learnhub_app`, and the limited API role `learnhub_api`.

## How did Atlas grow?

These milestones come from the merged pull requests (numbers 5 and 21 are not in the main history):

- 2026-10-08, first version (LearnHub): feed with Top and New, search, uploads, upvotes, email and password accounts, and a profile with uploads and Recently viewed. Subjects were general (Mathematics, Science and so on), not yet SHS.
- 2026-10-23 (#1 to #7): Saved list with notes and Gemini flashcards (#1); formatted notes and 5 to 100 cards (#2); Google sign-in with profile pictures (#3); a "Log out?" question (#4); the rename to Atlas with the new site and redirect (#6); Google sign-in moved back to the firebaseapp.com domain (#7).
- 2026-10-29 (#8 to #17): SHS categories and strand colors (#8); safe uploads with real file-type checks, no .doc or .ppt, and ClamAV support (#9); reports that hide a study reviewer after 3, and the admin Reports page (#10); the rights checkbox and Terms page (#11, #12); an intro for visitors (#13); 50 uploads per person and no duplicate files (#14); limits kept in PostgreSQL, Delete my account, and a backup script (#15); the least-privilege database user design (#16); a landing page at / with the feed moved to /browse (#17).
- 2026-10-31 (#18 to #24): landing page redesign (#18); CSS split, new logo and panel style (#19); class-name cleanups and one palette everywhere (#20, #22); new sample data of 6 students and 16 original PDF study reviewers, with a reset that saves a backup first (#23); a card border fix (#24).
- Next: the improved search and the Atlas Explorer with these docs.

## What technology does Atlas use?

- Website: React 19 built with Vite, react-router-dom v6, plain JavaScript and plain CSS, and the Firebase JavaScript SDK for sign-in only. The fonts Schibsted Grotesk and JetBrains Mono are bundled with the site.
- API: Express 5 on Node.js 20 or newer, written as CommonJS. It uses `pg` for PostgreSQL, `multer` for uploads, `helmet` for safety headers, `cors`, `express-rate-limit`, and `firebase-admin` to check sign-in tokens. Gemini is called with plain `fetch`, without an extra package.
- Database: PostgreSQL 14 with plain SQL and `$1, $2` placeholders. There is no ORM (a library that writes SQL for you).
- Code style: simple on purpose. React uses only function components with `useState`, `useEffect` and `useContext`, and the code avoids "advanced" syntax such as optional chaining, spread or classes. `npm run lint` in `frontend/` checks the syntax rules and accessibility rules.
- Accessibility target: WCAG 2.2 AA, checked with axe and by keyboard-only use.

## Where is the Atlas code?

The Atlas code is public on GitHub as remuriin/Atlas. The main folders and files:

- `frontend/`: the React website.
- `backend/`: the Express API. `backend/db/` holds the schema (`schema.sql`), the sample data (`seed.js`) and the script for the limited database user (`api-user.sql`).
- `hosting-redirect/`: the page for the old LearnHub address.
- `docs/`: the Atlas Explorer and these knowledge documents (`docs/knowledge/`).
- `firebase.json` and `.firebaserc`: the two Hosting sites and the Auth emulator settings.
- `README.md`: setup, environment variables, deployment notes and an API summary.

## What are the Atlas Explorer and Rem?

The Atlas Explorer is one standalone HTML file with zoomable diagrams of the whole Atlas project, these documents, and a glossary. Rem is the chat bubble inside the Explorer that answers questions from these documents. Neither is part of the Atlas website. See [The Atlas Explorer and Rem](atlas-explorer-and-rem.md#what-is-the-atlas-explorer).
