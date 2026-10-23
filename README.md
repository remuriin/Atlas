# LearnHub

A hub where anyone can share and discover **study reviewers**: notes, study guides, and review
files that people made themselves. The community curates quality with upvotes. That is the only
social feature: there are no comments, threads, chat, ratings, or written reviews.

In the code a study reviewer is called a `reviewer` (table, routes, components). In the UI it is
always written "study reviewer".

People can sign up with an email and password, or with **"Continue with Google"**. Google
accounts bring their name and profile picture; the picture shows beside "Logged in as …" and on
the Profile page. Everyone else (and anyone whose picture fails to load) gets a circle with their
initials. A Google sign-in with the same email as an existing account opens that same account.

Logged-in users also get private study tools:

- **Subject colors.** Every subject has its own color, shown as a stripe on each card and on its
  subject pill. "Subject colors" above the feed opens the key, and each entry filters the feed.
- **Saved.** "Save" on any study reviewer keeps it on the Saved page (only you see it). Opening
  one shows the file inside the app (PDF, images, and text; Word and PowerPoint are download
  only) next to **your notes**, which save to your account a moment after you stop typing.
  "Download file" and "Download notes" keep copies on your device for offline use.
- **Formatted notes.** Notes are formatted while you type: bold, italic, three heading sizes,
  bullets, indents, 5 text colors, and 5 highlights (all readable in both themes). Shortcuts:
  Ctrl/Cmd+B and +I, Ctrl/Cmd+Alt+1/2/3 for headings, Ctrl/Cmd+Shift+8 for bullets, Ctrl/Cmd+]
  and +[ to indent. Pasted text arrives as plain text. "Download notes" gives a `.txt` with `#`
  headings, `-` bullets, and `**bold**`.
- **Flashcards.** A saved study reviewer can be turned into 5 to 100 flashcards by Google
  Gemini (`gemini-3.5-flash-lite`, called only from the API). Short material makes fewer
  good cards (about 1 card per 50 to 100 words works well); if the material is too short for
  the number asked, Gemini writes fewer instead of padding, and the page says so. Study them
  with flip, next and previous, "Still learning" / "Got it", shuffle, and a "not learned yet"
  filter. Progress is saved per card.
- If an uploader deletes a study reviewer, people who saved it keep their notes and flashcards;
  only the file is gone.

## Architecture

Everything runs on Firebase (project `learnhub-ea4291`, **Blaze** plan, kept inside the free
allowances).

```
 Browser
 ┌───────────────────────────────────────────────┐
 │ React app (Vite build, plain JS + CSS)        │
 │  - react-router-dom v6 (<BrowserRouter>)      │
 │  - Firebase client SDK: Auth + Storage upload │
 └───┬──────────────┬────────────────────┬───────┘
     │ log in       │ 1. put the file in │ 2. fetch, Authorization: Bearer <ID token>
     │              │ pending/<uid>/     │    JSON with the file's path
     ▼              ▼                    ▼
 ┌──────────┐  ┌───────────────┐  ┌─────────────────────────────────────────┐
 │ Firebase │  │ Cloud Storage │◄─┤ Cloud Function "api" (Express, Node 22) │
 │ Auth     │  │ pending/      │  │  routes → middleware → controllers      │
 │          │  │ reviewers/    │  │  → models (ALL the database code)       │
 └──────────┘  └───────┬───────┘  │  firebase-admin: tokens, Firestore,     │
                       │          │  Storage; Gemini key in Secret Manager  │
     3. short-lived    │          └──────────────────┬──────────────────────┘
        file links     ▼                             ▼
                    browser                    ┌───────────┐
                                               │ Firestore │
                                               └───────────┘
```

- **The whole Express app is one Cloud Function** called `api` (`backend/src/index.js`), in
  `us-central1`, with at most **one** instance. One instance keeps the in-memory rate limits
  correct and caps the cost.
- **Browsers never read or write the database directly.** `firestore.rules` denies everything;
  only the function (with admin access) uses Firestore, after checking logins, owners, and input.
- **Uploads go to Cloud Storage first.** The browser may only create a file in its own inbox,
  `pending/<uid>/` (`storage.rules`: allowed types, up to 10 MB). The API then checks the file
  again and moves it to `reviewers/<random name>`. Inbox files that are never used are removed
  after a day by a lifecycle rule on the bucket.
- **Files are read through short-lived links** (signed URLs, 10 minutes) that the API makes, so
  downloads come straight from Cloud Storage.
- **Passwords never touch the database.** Firebase Authentication owns accounts. A user document
  only stores a number id, a display name, and the email.
- **Ids are numbers** (`/reviewers/12`, `/saved/7`), handed out by counter documents
  (`counters/reviewers` and so on), like the old Postgres ids.

```
learnhub/
  frontend/               React app
  backend/                Express API, deployed as the "api" Cloud Function
  firebase.json           Hosting, Functions, Firestore, Storage, and emulator settings
  firestore.rules         database rules (deny all browser access)
  firestore.indexes.json  the one composite index (recently viewed)
  storage.rules           upload rules (own inbox only)
  .firebaserc             default project id
  README.md
```

### Firestore collections

| Collection | Document name | Holds |
| --- | --- | --- |
| `users` | Firebase uid | `id`, `displayName`, `email`, `createdAt` |
| `reviewers` | the reviewer's number | details, file info, `authorId`, `authorName` (copied in), `upvoteCount` |
| `upvotes` | `<reviewer id>_<user id>` | one per upvote, so a second upvote is impossible |
| `recentlyViewed` | `<user id>_<reviewer id>` | `viewedAt` |
| `savedItems` | the saved item's number | `userId`, `reviewerId` (null once the original is deleted), copied `title` and `subject`, `notes`, `notesFormat`, `flashcardCount` |
| `flashcards` | the card's number | `savedItemId`, `position`, `front`, `back`, `status` |
| `flashcardUsage` | user id | the 24-hour flashcard allowance |
| `counters` | `users`, `reviewers`, `savedItems`, `flashcards` | the last number handed out |

Firestore cannot join collections, so the author's name and the upvote total are kept on each
reviewer and updated together with the change that affects them. Firestore cannot search inside
text either, so the API keeps a copy of all reviewers in memory for up to a minute (cleared on
every change) and filters, sorts, and pages them in JavaScript, exactly like the old SQL did.

## Prerequisites

- Node.js 22 (LTS)
- Firebase CLI: `npm install -g firebase-tools` (the Firestore and Storage emulators need Java 11+)

## Run it locally

Local development uses the **Firebase emulators** (Auth, Firestore, Storage, and Functions), so no
real Firebase project or internet connection is needed. You need two terminals.

**1. Install dependencies and settings (once)**

```bash
cd backend && npm install
cp .env.example .env.local
cd ../frontend && npm install
cp .env.example .env
```

Use `backend/.env.local`, **never** a plain `backend/.env`: Firebase uploads a plain `.env` to
the live function when deploying.

**2. Start everything**

```bash
# terminal 1: the emulators (the API runs at http://127.0.0.1:5001/demo-learnhub/us-central1/api)
cd backend && npm run serve

# terminal 2: the website on http://localhost:5173
cd frontend && npm run dev
```

Optional, while the emulators run: `cd backend && npm run seed` adds 20 sample study reviewers.

Open http://localhost:5173 and create an account. Emulator data lives only in memory and vanishes
when the emulators stop. The emulator UI is at http://127.0.0.1:4001.

For flashcards locally, put `GEMINI_API_KEY=your-key` in `backend/.secret.local` (ignored by git).

## Environment variables

### Backend

| File | Used by |
| --- | --- |
| `backend/.env.learnhub-ea4291` | The live function (committed: it holds no secrets) |
| `backend/.env.local` | The emulators only (template: `backend/.env.example`) |
| Secret Manager `GEMINI_API_KEY` | The live function. Set with `firebase functions:secrets:set GEMINI_API_KEY` |
| `backend/.secret.local` | The emulators' Gemini key (ignored by git) |

| Key | Meaning |
| --- | --- |
| `FRONTEND_ORIGIN` | Exact address of the website. Only this origin may call the API from a browser. |
| `STORAGE_BUCKET` | The bucket for uploaded files (live: `learnhub-ea4291.firebasestorage.app`). Empty = the project's default bucket. |
| `MAX_FILE_SIZE_MB` | Largest upload allowed. Default `10`. Keep equal to `storage.rules` and the frontend. |
| `TRUST_PROXY` | `true` on the live function, so rate limiting sees each visitor's real IP. |
| `GEMINI_MODEL` | The Gemini model that writes flashcards. Default `gemini-3.5-flash-lite`. |
| `GEMINI_API_KEY` | **Secret.** Only from Secret Manager or `.secret.local`, never in a `.env` file or the frontend. Without it, flashcards say they are not set up; everything else works. |

Never add a `*_EMULATOR_HOST` setting to the live file: the API refuses to start on Google's
servers if one is set, because emulator logins are not signed.

### `frontend/.env` (template: `frontend/.env.example`) and `frontend/.env.production`

These values are built into the public website, so they must never be secrets. Firebase web config
values are public identifiers, not passwords. `.env.production` (committed) overrides `.env` for
`npm run build`.

| Key | Meaning |
| --- | --- |
| `VITE_API_URL` | Address of the API, no trailing slash. Live: `https://us-central1-learnhub-ea4291.cloudfunctions.net/api`. |
| `VITE_USE_EMULATORS` | `true` for local development, `false` for real Firebase. |
| `VITE_MAX_FILE_SIZE_MB` | Keep equal to the backend's `MAX_FILE_SIZE_MB`. |
| `VITE_FIREBASE_STORAGE_BUCKET` | The upload bucket (emulators: `demo-learnhub.appspot.com`). |
| `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` | From `firebase apps:sdkconfig WEB <appId> --project <id>`. |

After changing `frontend/.env`, restart `npm run dev` (or rebuild) so Vite picks the values up.

## Firebase setup for production (one time)

In the [Firebase console](https://console.firebase.google.com):

1. **Plan:** upgrade to **Blaze** and add a **budget alert** (Google Cloud console → Billing →
   Budgets & alerts) of $1 with emails at 50%, 90%, and 100%. Blaze has no hard spending cap; the
   free allowances keep normal use at $0.
2. **Authentication** → Sign-in method: turn on **Email/Password** and **Google**. Settings →
   Authorized domains: add any custom domain the site is served from.
3. **Firestore Database** → Create database → Standard edition, **Native mode**, location
   **`us-central1`** (cannot be changed later).
4. **Storage** → Get started → location **`us-central1`** (free Storage exists only in
   `us-central1`, `us-east1`, and `us-west1`; cannot be changed later).
5. In **Google Cloud Shell** (console.cloud.google.com, the `>_` button):
   - `gcloud services enable iamcredentials.googleapis.com --project learnhub-ea4291`
   - allow the function to sign file links:
     `gcloud iam service-accounts add-iam-policy-binding 520424815416-compute@developer.gserviceaccount.com --member=serviceAccount:520424815416-compute@developer.gserviceaccount.com --role=roles/iam.serviceAccountTokenCreator --project learnhub-ea4291`
   - let the website fetch files: a `cors.json` with
     `[{"origin":["https://learnhub-ea4291.web.app","https://learnhub-ea4291.firebaseapp.com","http://localhost:5173"],"method":["GET"],"maxAgeSeconds":3600}]`, then
     `gcloud storage buckets update gs://learnhub-ea4291.firebasestorage.app --cors-file=cors.json`
   - remove unused inbox files after a day: a `lifecycle.json` with
     `{"rule":[{"action":{"type":"Delete"},"condition":{"age":1,"matchesPrefix":["pending/"]}}]}`, then
     `gcloud storage buckets update gs://learnhub-ea4291.firebasestorage.app --lifecycle-file=lifecycle.json`
6. **Gemini key:** the key must belong to a Google project **without billing** (check at
   https://aistudio.google.com/apikey), or Gemini is charged. Then, from the project root:
   `firebase functions:secrets:set GEMINI_API_KEY` and type the key when asked.

## Deploying

Merging a pull request deploys nothing. From the project root in Git Bash:

```bash
# Rules, indexes, and the API
firebase deploy --only firestore,storage,functions

# The website
cd frontend && npm ci && npm run build && cd .. && firebase deploy --only hosting
```

After the first functions deploy, run `firebase functions:artifacts:setpolicy` once, so old
function images are cleaned up and do not cost storage.

- **Website:** https://learnhub-ea4291.web.app (Firebase Hosting serves `frontend/dist`).
- **API:** https://us-central1-learnhub-ea4291.cloudfunctions.net/api (for example
  `/api/health` at the end).

### Copying data from the old Postgres server

`backend/scripts/import-postgres-export.js` copies an export of the old Postgres tables and the
old `uploads` folder into Firestore and Cloud Storage, keeping every id. Run it with
`--dry-run` first; running it twice is safe. See the comments at the top of the script.

## API summary

All responses are JSON. Errors always look like `{ "error": { "message": "..." } }`; form errors
add `"fields": { "title": "..." }`.

| Method and path | Login | What it does |
| --- | --- | --- |
| `GET /api/health` | no | Health check |
| `GET /api/reviewers?sort=top\|new&subject=&q=&page=1&limit=12` | optional | Feed: `{ items, page, hasMore }` |
| `GET /api/reviewers/:id` | optional | One reviewer |
| `GET /api/reviewers/:id/file` | no | Redirects to a 10-minute link to the file (inline for PDF and images, download otherwise). The emulators send the file itself |
| `GET /api/reviewers/:id/file-link` | no | The same link as JSON `{ url }` (`null` with the emulators), so the page can fetch the file |
| `POST /api/reviewers` | yes | Create (JSON: title, description, subject, tags, `file: { path, name }` where `path` is the uploaded file in `pending/<uid>/`) |
| `PUT /api/reviewers/:id` | owner | Update details; add `file` to replace the file |
| `DELETE /api/reviewers/:id` | owner | Delete the reviewer and its file |
| `PUT` / `DELETE /api/reviewers/:id/upvote` | yes | Add / remove my upvote (both safe to repeat) |
| `POST /api/reviewers/:id/view` | yes | Record in my recently viewed |
| `GET` / `PUT /api/me` | yes | Find-or-create my profile / change my display name |
| `GET /api/me/reviewers` | yes | My uploads |
| `GET /api/me/recently-viewed` | yes | My last 20 viewed |
| `PUT` / `DELETE /api/reviewers/:id/save` | yes | Save to / remove from my Saved list (both safe to repeat). Removing also deletes my notes and flashcards for it |
| `GET /api/reviewers/:id/file?download=1` | no | The file, always as a download |
| `GET /api/me/saved` | yes | My saved study reviewers |
| `GET` / `DELETE /api/saved/:savedId` | mine | One saved item with my notes / remove it |
| `PUT /api/saved/:savedId/notes` | mine | Save my notes (JSON `{ notes }`): simple HTML using only `p h1 h2 h3 strong em ul li br blockquote`, `<span class="tc-…">` and `<mark class="hl-…">`, with no other attributes. Up to 20,000 visible characters |
| `GET` / `DELETE /api/saved/:savedId/flashcards` | mine | My flashcards for it / delete them |
| `POST /api/saved/:savedId/flashcards` | mine | Make a new set with Gemini (JSON `{ count: 5 to 100 }`; fewer come back for short material), replacing the old one. 10 sets per user per day |
| `PUT /api/saved/:savedId/flashcards/:cardId` | mine | Mark a card (JSON `{ status: "new", "learning" or "learned" }`) |

"mine" means logged in, and the saved item must be yours: anyone else's gets the same 404 as a
missing one.

## Code rules this project follows

- **Frontend:** plain JavaScript and JSX, function components, only `useState`, `useEffect`, and
  `useContext`, two contexts (`AuthContext`, `ThemeContext`), classic react-router-dom v6
  components and hooks (`useNavigate`, `useParams`, `useLocation`, `useSearchParams`), plain CSS
  with custom properties. Runtime dependencies: `react`, `react-dom`, `react-router-dom`,
  `firebase`.
- **Backend:** plain JavaScript, CommonJS. All database code is in `backend/src/models/` and
  uses only the plain `firebase-admin` Firestore calls (get, set, update, delete, simple
  `where` queries, transactions). Each model returns the same row shape the old SQL did, so the
  controllers did not change much. Runtime dependencies: `express`, `cors`, `helmet`,
  `express-rate-limit`, `firebase-admin`, `firebase-functions`.
- **No "advanced" syntax:** no optional chaining, nullish coalescing, spread/rest, classes, custom
  hooks, `useReducer`, `useMemo`, or `useCallback`. `npm run lint` in `frontend/` enforces the
  syntax rules together with the accessibility rules.

## How the feed behaves

- **The header stays at the top** while you scroll (it is `position: sticky`). On very short
  screens, such as a phone on its side or a page zoomed to 400%, it scrolls away instead so it
  does not cover the content.
- **Filters are in the address.** The tab, subject, and search words are stored as
  `/?sort=new&subject=Science&q=cells`, so a filtered list can be bookmarked or shared and the
  browser's Back button steps through filter changes.
- **Back returns you to the same place.** Opening a study reviewer and coming back (with the
  page's "Back" link or the browser's Back button) shows the same loaded cards at the same scroll
  position, with focus on the card you opened, and without asking the server again. This is kept
  in memory (`frontend/src/services/feedMemory.js`) for up to 10 minutes; a page reload, or
  opening the feed fresh from the menu, loads a new list from the top.
- **The whole upper part of a card opens it**, not only the title. Subject and tag pills are
  links that filter the feed.
- **Grey placeholder cards** hold the space while the feed loads, so the page does not jump.

## Accessibility

Target: WCAG 2.2 AA. What was checked, and how:

**Automated**

- `npm run lint` (ESLint with `eslint-plugin-jsx-a11y`, strict rule set): zero errors, zero warnings.
- axe-core (WCAG 2.0/2.1/2.2 A and AA rules plus best practices) run in Chrome against every page
  in both themes, including pages showing form errors, empty states, the open delete dialog, and
  the open mobile menu: zero violations.
- Contrast of every token pair computed with the WCAG formula. Lowest text pairs: white on the
  light primary button 4.52:1, white on the dark primary button 4.63:1. Input and button outlines:
  3.4:1 (light) and 3.6:1 (dark). Focus ring: 5.2:1 (light) and 6.1:1 (dark).

  The dark theme's header and footer use GitHub's darkest shade (`--color-inset`, `#010409`);
  on it, body text is 17.4:1, muted text 7.1:1, links 6.6:1, and control outlines 3.9:1.

  Subject colors (`--subject-*` tokens): every card stripe and legend swatch is at least 4.6:1
  on the page (light) and 5.6:1 (dark); every subject pill's text is at least 6.1:1 (light) and
  9.4:1 (dark) on its own background. The subject name is always written out, so the color is
  never the only clue.

  Adjustments made to the starting palette so every pair passes: a darker control-outline color was
  added for inputs and buttons (the card border color is only 1.4:1 and is used just for decorative
  dividers); the dark theme's primary button darkens on hover (the lighter hover green would drop
  white text to 4.1:1); the outline "Delete" button sits on the page background (red text on the
  dark button grey was 4.44:1).

**Keyboard only (no mouse), end to end**

- "Skip to main content" is the first Tab stop on every page and moves focus into `<main>`.
- Tab order follows the visual order: skip link, logo, menu links, theme switch, account buttons,
  search, subject filter, tabs, then each card. Every stop shows a 2px focus ring.
- The sticky header never covers the focused control: the page keeps a strip clear beneath it
  (`scroll-padding-top`). Checked by pressing Shift+Tab 60 times upwards from the bottom of a long
  feed.
- Tabs: Tab lands on the selected tab only; Left/Right move and wrap; Home/End jump to the ends.
- Registered, logged in, uploaded, edited, upvoted, renamed, deleted, and logged out using only
  the keyboard.
- Failed form submit: focus moves to the first field with a problem; the summary at the top lists
  every problem as a link to its field; each field's message is tied to it with `aria-describedby`.
- Delete dialog: focus starts on Cancel, Tab cannot leave the dialog, Esc closes it, and focus
  returns to the Delete button. After a confirmed delete, focus moves to the section heading
  instead of being lost.
- Mobile menu: a button with `aria-expanded` and `aria-controls`; Esc closes it and returns focus
  to the button; it closes after choosing a link.
- "Load more": focus moves to the first newly loaded card.
- Page changes: the tab title updates, the new page starts at the top, and focus moves to the
  page's `<h1>`. Choosing a tab, a subject, or searching is not a page change, so focus stays on
  the control that was used.
- Back to the feed: focus returns to the card that had been opened.
- Messages with a close button (and the "Remove" button for a chosen file) send focus to a
  sensible place when they disappear, so it is never left on nothing.

**Announcements (live regions)**

Upvote changes, upload progress (in 25% steps), "Loading" and result counts on the feed, "Load more"
results, the chosen file, save success, and delete success are announced politely. Errors use
`role="alert"`. The grey loading placeholders are hidden from screen readers.

**Other**

- Meaning never depends on color alone: errors have an icon and the word "Error", the selected tab
  has a bar and bold text, an upvoted button changes its word ("Upvoted") and its icon from outline
  to solid.
- Touch targets are at least 44×44 px, measured at every test width. Subject and tag pills look
  small but sit inside 44 px tall links.
- No horizontal scrolling at 320, 360, 768, 1024, and 1440 px, or with text at 200%. A 320 px
  viewport is what 400% zoom on a 1280 px screen produces.
- `prefers-reduced-motion` turns transitions and the spinner animation off; `prefers-contrast: more`
  strengthens borders and secondary text; Windows High Contrast (`forced-colors`) keeps control
  borders and focus rings.
- Not checked: a real screen reader (NVDA, JAWS, VoiceOver, TalkBack). Roles, names, and live
  regions were verified in the accessibility tree and by axe, but nobody listened to it.

## Known limitations

- Word and PowerPoint files cannot be shown inside the app, only downloaded. The upload form
  recommends PDF, image, or text files for that reason. Old `.doc` and `.ppt` files also cannot
  be turned into flashcards.
- Some phone browsers show only the first page of a PDF (or a link) inside the study page.
  "Open in new tab" there always shows the whole file.
- Flashcards are written by AI and can contain mistakes; the page says so. The daily limit of 10
  sets per user is kept in Firestore, so it survives restarts.
- Large Word or PowerPoint files are cut to about 200,000 characters of text before Gemini sees
  them, which is far more than 100 cards need. Their text is read by a small built-in ZIP reader
  (`backend/src/utils/zipReader.js`, Node's own `zlib`), not by an extra package.
- The notes editor uses the browser's built-in editing commands (`document.execCommand`), which
  are old but work in every current browser. Underline is not offered; Ctrl+U does nothing.
- Scrollbars follow the theme everywhere except inside the browser's own PDF viewer, which
  cannot be styled from the page.

- The file-type check trusts the file extension; it does not inspect file contents. Files are
  never executed, are stored under random names, and are served from Google's own storage
  address (never from the website's) with their allowlisted content type, so a disguised file
  cannot run as a web page, but it could still be a mislabelled download.
- The 15-minute rate limits are kept in memory: they reset when the function restarts (for
  example after a quiet period). The function runs as one instance, so they still count every
  visitor.
- The first request after a quiet period is slower (about 2 to 5 seconds) while the function
  starts. Everything after that is quick.
- The feed, search, and "top" sorting work on an in-memory copy of all reviewers, which is fine
  for a few thousand reviewers. Far beyond that, a search service would be needed.
- A logged-in user could fill their own upload inbox with files they never share; those are
  deleted after a day, and each is at most 10 MB.
- The remembered feed (for the Back button) lives in the page's memory only. After a reload the
  filters are still restored from the address, but the list starts again from page 1 at the top.
- Text inside the clickable part of a card cannot be selected by dragging; it can on the
  reviewer's own page.
- Choosing a tag searches titles, descriptions, and tags for that word, so it can also match
  reviewers that mention the word without having the tag.
- Deleting a Firebase account does not delete its document in `users` (there is no
  account-deletion feature yet).
