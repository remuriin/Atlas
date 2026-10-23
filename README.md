# LearnHub

A hub where anyone can share and discover **study reviewers**: notes, study guides, and review
files that people made themselves. The community curates quality with upvotes. That is the only
social feature: there are no comments, threads, chat, ratings, or written reviews.

In the code a study reviewer is called a `reviewer` (table, routes, components). In the UI it is
always written "study reviewer".

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
  Gemini (`gemini-3.5-flash-lite`, called only from the backend). Short material makes fewer
  good cards (about 1 card per 50 to 100 words works well); if the material is too short for
  the number asked, Gemini writes fewer instead of padding, and the page says so. Study them
  with flip, next and previous, "Still learning" / "Got it", shuffle, and a "not learned yet"
  filter. Progress is saved per card.
- If an uploader deletes a study reviewer, people who saved it keep their notes and flashcards;
  only the file is gone.

## Architecture

```
 Browser
 ┌──────────────────────────────────────────┐
 │ React app (Vite build, plain JS + CSS)   │
 │  - react-router-dom v6 (<BrowserRouter>) │
 │  - Firebase client SDK: AUTH ONLY        │
 └───────┬─────────────────────┬────────────┘
         │ email + password    │ fetch / XMLHttpRequest
         │                     │ Authorization: Bearer <Firebase ID token>
         ▼                     ▼
 ┌────────────────┐   ┌─────────────────────────────────────────┐
 │ Firebase       │   │ Express API (Node 20+, CommonJS)        │
 │ Authentication │   │  routes → middleware → controllers      │
 │ (accounts,     │   │  → models (ALL the SQL, via pg pool)    │
 │  passwords,    │◄──┤  firebase-admin: verifies ID tokens     │
 │  reset emails) │   │  multer: files saved to UPLOAD_DIR      │
 └────────────────┘   └──────────┬──────────────────┬───────────┘
                                 │ parameterized SQL│ files
                                 ▼                  ▼
                        ┌────────────────┐   ┌─────────────┐
                        │ PostgreSQL     │   │ uploads/    │
                        │ (your VPS)     │   │ (disk)      │
                        └────────────────┘   └─────────────┘
```

- **Passwords never touch Postgres.** Firebase Authentication owns accounts. The `users` table only
  stores the Firebase user id, a display name, and the email.
- **Firestore and Firebase Storage are not used**, so the free Spark plan is enough and no billing
  account is needed.
- **Upvote counts are never stored.** They are counted with `COUNT(*)` each time, so they cannot
  drift out of sync.

```
learnhub/
  frontend/      React app
  backend/       Express + Postgres API
  firebase.json  Auth emulator settings only
  .firebaserc    default project id for the emulator
  README.md
```

## Prerequisites

- Node.js 20 or newer (LTS)
- PostgreSQL 14 or newer (your VPS database, or a local one for development)
- Firebase CLI: `npm install -g firebase-tools` (the Auth emulator also needs Java 11+)

## Run it locally

Local development uses the **Firebase Auth emulator**, so no real Firebase project or internet
connection is needed. You need four terminals.

**1. Install dependencies (once)**

```bash
cd backend && npm install
cd ../frontend && npm install
```

**2. Point the backend at a database (once)**

Open `backend/.env` and replace the `DATABASE_URL` placeholder with a Postgres URL you can use for
development (see [Putting your Postgres URL into backend/.env](#putting-your-postgres-url-into-backendenv)).
Then create the tables:

```bash
cd backend
npm run db:migrate      # safe to run again at any time
npm run db:seed         # optional: adds 20 sample study reviewers
```

Need a throwaway local database? With Docker:

```bash
docker run --name learnhub-db -e POSTGRES_PASSWORD=devpass -e POSTGRES_DB=learnhub -p 5432:5432 -d postgres:16
# then: DATABASE_URL=postgres://postgres:devpass@localhost:5432/learnhub
```

**3. Start everything**

```bash
# terminal 1, from the project root: the Auth emulator on port 9099
firebase emulators:start --only auth

# terminal 2: the API on http://localhost:4000
cd backend && npm run dev

# terminal 3: the website on http://localhost:5173
cd frontend && npm run dev
```

Open http://localhost:5173 and create an account. Emulator accounts live only in memory and vanish
when the emulator stops. The matching rows in your `users` table stay, which is harmless: sign up
again with the same email and a new row is made.

If the backend prints **"LearnHub backend cannot start yet"**, it is telling you exactly which
setting in `backend/.env` still needs a value. That is on purpose: it never starts with a
placeholder database URL.

## Environment variables

### `backend/.env` (template: `backend/.env.example`)

| Key | Meaning |
| --- | --- |
| `PORT` | Port the API listens on. Default `4000`. |
| `DATABASE_URL` | **Replace with your VPS Postgres URL.** `postgres://USER:PASSWORD@HOST:5432/DBNAME` |
| `DATABASE_SSL` | `true` only when Postgres is on another machine and requires SSL. Default `false`. |
| `FIREBASE_PROJECT_ID` | Your Firebase project id. Tokens from any other project are rejected. `demo-learnhub` works only with the emulator. |
| `FIREBASE_AUTH_EMULATOR_HOST` | `127.0.0.1:9099` in development. **Delete this line in production.** The server refuses to start if it is set while `NODE_ENV=production`. |
| `FRONTEND_ORIGIN` | Exact address of the website, for example `https://learnhub.example.com`. Only this origin may call the API from a browser. |
| `UPLOAD_DIR` | Folder for uploaded files. Default `./uploads`. |
| `MAX_FILE_SIZE_MB` | Largest upload allowed. Default `10`. |
| `TRUST_PROXY` | `true` when the API is behind nginx, so rate limiting sees each visitor's real IP. |
| `GEMINI_API_KEY` | Google Gemini key for making flashcards (from https://aistudio.google.com/apikey). **Secret: server only, never in `frontend/.env`.** Leave empty to turn flashcards off; everything else keeps working. |
| `GEMINI_MODEL` | The Gemini model that writes flashcards. Default `gemini-3.5-flash-lite`. |

### `frontend/.env` (template: `frontend/.env.example`)

These values are built into the public website, so they must never be secrets. Firebase web config
values are public identifiers, not passwords.

| Key | Meaning |
| --- | --- |
| `VITE_API_URL` | Address of the API, no trailing slash. `http://localhost:4000` locally. |
| `VITE_USE_AUTH_EMULATOR` | `true` for local development, `false` for real Firebase. |
| `VITE_MAX_FILE_SIZE_MB` | Keep equal to the backend's `MAX_FILE_SIZE_MB`. |
| `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` | From `firebase apps:sdkconfig WEB <appId> --project <id>`. |

After changing `frontend/.env`, restart `npm run dev` (or rebuild) so Vite picks the values up.

## Putting your Postgres URL into `backend/.env`

1. On the VPS, create a database and a user for LearnHub (run as the `postgres` superuser):

   ```sql
   CREATE USER learnhub WITH PASSWORD 'choose-a-long-random-password';
   CREATE DATABASE learnhub OWNER learnhub;
   ```

2. Open `backend/.env` and replace the placeholder line:

   ```
   DATABASE_URL=postgres://learnhub:choose-a-long-random-password@localhost:5432/learnhub
   ```

   If the password contains characters such as `@ : / # ?`, percent-encode them
   (for example `@` becomes `%40`).

3. Create the tables: `npm run db:migrate`

`backend/.env` is listed in `.gitignore`. Never commit it and never paste it anywhere public.

## Migrations

```bash
cd backend
npm run db:migrate   # runs db/schema.sql
npm run db:seed      # optional sample data, never runs automatically
```

`db/schema.sql` uses only `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS`, so running
it again changes nothing. It creates `users`, `reviewers`, `upvotes`, `recently_viewed`,
`saved_items` (a user's saved study reviewers, with their notes), and `flashcards`. Run it again
after pulling changes: new tables are added and existing data is left alone.

## Firebase setup for production

The Firebase CLI can create the project and the web app, but two settings exist only in the
console.

```bash
firebase login
firebase projects:create learnhub-<short-unique-suffix> --display-name "LearnHub"
firebase apps:create WEB "LearnHub Web" --project <project-id>
firebase apps:sdkconfig WEB <app-id> --project <project-id>
```

Copy the printed values into `frontend/.env` (`apiKey` → `VITE_FIREBASE_API_KEY`, `authDomain` →
`VITE_FIREBASE_AUTH_DOMAIN`, `projectId` → `VITE_FIREBASE_PROJECT_ID`, `appId` →
`VITE_FIREBASE_APP_ID`), and put the project id into `FIREBASE_PROJECT_ID` in `backend/.env`.

Then, in the [Firebase console](https://console.firebase.google.com):

1. Open your project → **Build → Authentication** → **Get started** (first time only).
2. **Sign-in method** tab → **Email/Password** → switch **Enable** on → **Save**.
3. **Settings** tab → **Authorized domains** → **Add domain** → enter the domain the website will be
   served from (for example `learnhub.example.com`) → **Add**. `localhost` is already allowed.

The free **Spark** plan is enough.

## Current live deployment

- **Website:** https://learnhub-ea4291.web.app (Firebase Hosting, serves `frontend/dist`).
- **API:** https://api.140-245-60-8.sslip.io (the backend on the VPS under pm2 as `learnhub-api`,
  behind nginx with a Let's Encrypt certificate). `sslip.io` is a free service that turns the
  name into the server's IP address; swap it for a real domain when you have one.
- `frontend/.env.production` holds the live API address and is used only by `npm run build`.
  `frontend/.env` keeps pointing at your local backend for development.

To publish frontend changes:

```bash
cd frontend && npm run build
cd .. && firebase deploy --only hosting
```

To publish backend changes, copy the changed files to `/var/www/learnhub/backend` on the VPS and
run `pm2 restart learnhub-api`. When `package.json` changed, run `npm ci --omit=dev` first; when
`db/schema.sql` changed, run `npm run db:migrate` too. The VPS backend only accepts browser requests from the live
website (`FRONTEND_ORIGIN`), so a frontend running on `localhost` must use a local backend.

## Deploying to a VPS

**Recommended: run the backend on the same VPS as Postgres** and connect through `localhost`. The
database port then never needs to be open to the internet.

1. **Copy the project** to the server and install: `cd backend && npm ci --omit=dev`.
2. **Backend settings** in `backend/.env`:
   - `DATABASE_URL=postgres://learnhub:...@localhost:5432/learnhub`
   - `FIREBASE_PROJECT_ID=<your real project id>`
   - delete the `FIREBASE_AUTH_EMULATOR_HOST` line
   - `FRONTEND_ORIGIN=https://learnhub.example.com` (your real domain, no trailing slash)
   - `TRUST_PROXY=true`
   - `GEMINI_API_KEY=<your key>` (only needed for flashcards)
3. **Create the tables:** `npm run db:migrate`.
4. **Keep the API running** with pm2:

   ```bash
   npm install -g pm2
   cd backend
   NODE_ENV=production pm2 start src/server.js --name learnhub-api
   pm2 save && pm2 startup
   ```

   or with systemd (`/etc/systemd/system/learnhub-api.service`):

   ```ini
   [Unit]
   Description=LearnHub API
   After=network.target postgresql.service

   [Service]
   WorkingDirectory=/var/www/learnhub/backend
   ExecStart=/usr/bin/node src/server.js
   Environment=NODE_ENV=production
   Restart=always
   User=www-data

   [Install]
   WantedBy=multi-user.target
   ```

   `NODE_ENV=production` matters: it hides internal error details from API responses.
   The user that runs the API needs write access to `UPLOAD_DIR`. Back that folder up together
   with the database: a reviewer is a database row **plus** a file.

5. **Build the frontend** with production values in `frontend/.env`
   (`VITE_API_URL=https://learnhub.example.com`, `VITE_USE_AUTH_EMULATOR=false`, the four real
   `VITE_FIREBASE_*` values), then `cd frontend && npm ci && npm run build`. The result is the
   static folder `frontend/dist`.

6. **nginx** serves `dist` and passes `/api` to the backend, with HTTPS (for example from
   Let's Encrypt via `certbot --nginx`):

   ```nginx
   server {
     listen 443 ssl;
     server_name learnhub.example.com;
     # ssl_certificate lines are added by certbot

     # Must be larger than MAX_FILE_SIZE_MB, or nginx rejects uploads before the API sees them.
     client_max_body_size 12m;

     root /var/www/learnhub/frontend/dist;
     index index.html;

     # Every page address is handled by the React app.
     location / {
       try_files $uri /index.html;
     }

     location /api/ {
       proxy_pass http://127.0.0.1:4000;
       proxy_set_header Host $host;
       proxy_set_header X-Forwarded-For $remote_addr;
       proxy_set_header X-Forwarded-Proto $scheme;
     }
   }
   ```

7. **Add the domain to Firebase authorized domains** (console steps above), or logins from the real
   site are refused.

### If the database must be on a different machine

Avoid this if you can. If you cannot:

- `postgresql.conf`: set `listen_addresses` to the server's private address (not `'*'`).
- `pg_hba.conf`: allow only the backend server's IP, with SSL and password hashing:
  `hostssl learnhub learnhub 203.0.113.10/32 scram-sha-256`
- Firewall: open port 5432 only to that one IP (`ufw allow from 203.0.113.10 to any port 5432`).
- Turn on SSL in Postgres (`ssl = on`) and set `DATABASE_SSL=true` in `backend/.env`. That setting
  encrypts the connection but does not verify the server's certificate, which suits a self-signed
  certificate on a private network.
- Reload Postgres after editing either file.

## API summary

All responses are JSON. Errors always look like `{ "error": { "message": "..." } }`; form errors
add `"fields": { "title": "..." }`.

| Method and path | Login | What it does |
| --- | --- | --- |
| `GET /api/health` | no | Health check |
| `GET /api/reviewers?sort=top\|new&subject=&q=&page=1&limit=12` | optional | Feed: `{ items, page, hasMore }` |
| `GET /api/reviewers/:id` | optional | One reviewer |
| `GET /api/reviewers/:id/file` | no | The file (inline for PDF and images, download otherwise) |
| `POST /api/reviewers` | yes | Create (multipart: title, description, subject, tags, file) |
| `PUT /api/reviewers/:id` | owner | Update details, optionally replace the file |
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
- **Backend:** plain JavaScript, CommonJS, no ORM or query builder. Every SQL statement is in
  `backend/src/models/` (plus `backend/db/` for schema and seed), uses `$1, $2` placeholders, and
  sticks to textbook CRUD. "Upserts" are a `SELECT` followed by an `INSERT` or `UPDATE` in
  JavaScript.
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
  sets per user is kept in memory, like the other rate limits.
- Large Word or PowerPoint files are cut to about 200,000 characters of text before Gemini sees
  them, which is far more than 100 cards need. Their text is read by a small built-in ZIP reader
  (`backend/src/utils/zipReader.js`, Node's own `zlib`), not by an extra package.
- The notes editor uses the browser's built-in editing commands (`document.execCommand`), which
  are old but work in every current browser. Underline is not offered; Ctrl+U does nothing.
- Scrollbars follow the theme everywhere except inside the browser's own PDF viewer, which
  cannot be styled from the page.

- The file-type check trusts the file extension and the content type sent by the browser; it does
  not inspect file contents. Files are never executed, are stored under random names, and are
  served with their allowlisted content type plus `nosniff`, so a disguised file cannot run as a
  web page, but it could still be a mislabelled download.
- Some systems report an unusual content type for Office files (for example when Office is not
  installed). Those uploads are rejected with the "file type is not allowed" message.
- Rate limits are kept in memory: they reset when the API restarts and are per process.
- The remembered feed (for the Back button) lives in the page's memory only. After a reload the
  filters are still restored from the address, but the list starts again from page 1 at the top.
- Text inside the clickable part of a card cannot be selected by dragging; it can on the
  reviewer's own page.
- Choosing a tag searches titles, descriptions, and tags for that word, so it can also match
  reviewers that mention the word without having the tag.
- Deleting a Firebase account does not delete its row in `users` (there is no account-deletion
  feature yet).
- Timestamps are stored as `TIMESTAMP` (no time zone) in the database server's local time.
