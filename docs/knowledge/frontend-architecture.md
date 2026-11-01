# Atlas frontend architecture

The Atlas frontend is the website that students use. It is a React single-page app in the `frontend/` folder of the Atlas repository, and it runs entirely in the browser. This page explains what the Atlas frontend is built with, how it starts, how its routes work, what its two contexts share, how it talks to the Atlas API, and how its styles are organised.

## What is the Atlas frontend built with?

The Atlas frontend is a React 19 single-page app. Vite 8 builds it and serves it during development. It is written in plain JavaScript and JSX; there is no TypeScript. The package is called `atlas-frontend`, and its settings live in `frontend/package.json`.

| Runtime package | Version | What it is for |
| --- | --- | --- |
| `react`, `react-dom` | ^19.3.0 | Drawing the pages |
| `react-router-dom` | ^6.30.6 | Page addresses (routing), with the classic v6 components and hooks |
| `firebase` | ^13.0.0 | Sign-in only (Firebase Authentication) |
| `@fontsource-variable/schibsted-grotesk` | ^5.3.0 | The main font, bundled with the app |
| `@fontsource-variable/jetbrains-mono` | ^5.3.0 | The monospace font for data, bundled with the app |

The development tools are `vite` (^8.3.3), `@vitejs/plugin-react` (^6.1.2), `eslint` (^9.39.5), and `eslint-plugin-jsx-a11y` (^6.10.2). The Atlas frontend has no state library (such as Redux), no CSS framework or preprocessor, no UI kit, no data-fetching library, and no test framework. Styling is plain CSS with custom properties (CSS variables).

## Which settings does the Atlas frontend read at build time?

Vite gives the browser code every variable whose name starts with `VITE_` (through `import.meta.env`) and writes the values into the built files. They end up in public files, so they must never be secrets. Firebase web config values are public identifiers, not passwords. Local development reads `frontend/.env` (template: `frontend/.env.example`). `npm run build` also reads `frontend/.env.production`, which overrides `.env` with the live values.

| Variable | Read in | Meaning |
| --- | --- | --- |
| `VITE_API_URL` | `services/api.js` | Address of the Atlas API, no trailing slash. The live value is `https://api.140-245-60-8.sslip.io`. |
| `VITE_USE_AUTH_EMULATOR` | `firebase.js` | `true` uses the local Firebase Auth emulator; `false` uses real Firebase. |
| `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` | `firebase.js` | The Firebase web app config. |
| `VITE_MAX_FILE_SIZE_MB` | `services/fileRules.js` | Largest upload in MB (default 10). Keep it equal to the backend's `MAX_FILE_SIZE_MB`. |
| `VITE_TAKEDOWN_EMAIL` | `pages/TermsPage.jsx` | Inbox for copyright takedown requests. When empty, the Terms page says to use Report, then Copyright. |

After changing `frontend/.env`, restart `npm run dev` or build again so Vite picks up the new values.

## How does the Atlas frontend start in the browser?

1. The browser loads `frontend/index.html`. A small inline script in its head runs before anything is drawn. It reads the saved theme from the `localStorage` key `atlas-theme` (or the old `learnhub-theme` key from before the rename). Without a saved choice it follows the device's `prefers-color-scheme` setting. It writes the result to the `data-theme` attribute of the html element, so the first frame already has the right colors. A noscript message tells people that Atlas needs JavaScript.
2. `frontend/src/main.jsx` imports the two bundled fonts and `styles/index.css`, which pulls in every stylesheet.
3. `main.jsx` sets `window.history.scrollRestoration = 'manual'`. The app decides where each page starts (the top of a new page, or the remembered spot in the feed after Back), so the browser's own guess is switched off.
4. `main.jsx` renders the providers around the app, outermost first: `StrictMode`, then `BrowserRouter`, then `ThemeProvider`, then `AuthProvider`, then `App`.

`BrowserRouter` gets two future flags: `v7_relativeSplatPath: true` and `v7_startTransition: false`. Answering both stops React Router's upgrade notices in the console. The start-transition flag stays off on purpose: with it on, page changes are delayed slightly, and logging out of a protected page could land on the login page instead of the home page. Both providers sit inside the router, so any component can read the theme, the login, and the current address.

## What frame does every Atlas page share?

`frontend/src/App.jsx` draws the frame that every Atlas page shares, in this order:

1. `SkipLink`: the "Skip to main content" link, the first Tab stop.
2. `Header`: the logo, the main menu, the theme switch, and the account buttons.
3. A main element with the id `main-content` and `tabIndex="-1"`. The negative tab index lets the skip link move focus there without adding a Tab stop. Its class is `main-wide` on the landing page (`/`), whose bands run edge to edge, and `main` on every other page.
4. Inside the main element, the `Routes` list picks the page for the current address.
5. `Footer`: a short description and links to Browse, Share a reviewer, and the Terms page.

`App.jsx` also reads `AuthContext` to build the user key that some pages receive (see [Why are some Atlas pages given a key?](#why-are-some-atlas-pages-given-a-key)).

## Which Atlas routes are open to everyone?

Seven routes in `frontend/src/App.jsx` need no login. Visitors can browse, read, and download study reviewers without an account.

| Path | Page component | Notes |
| --- | --- | --- |
| `/` | `LandingPage` | Logged-in users are sent to `/browse`. Old feed links such as `/?strand=STEM` are forwarded to `/browse?strand=STEM`. |
| `/browse` | `HomePage` | The feed. Gets a user key. |
| `/reviewers/:id` | `ReviewerPage` | One study reviewer. Upvote, Save, and Report send visitors to log in. |
| `/login` | `LoginPage` | `/login?mode=reset` shows the password reset form. |
| `/register` | `RegisterPage` | Create an account. |
| `/terms` | `TermsPage` | Terms of use and copyright. |
| `*` | `NotFoundPage` | Any address that matches no other route. |

Each page is described in [Atlas pages and components](frontend-pages-and-components.md#how-are-atlas-pages-and-components-organised).

## Which Atlas routes need a login?

Six routes in `frontend/src/App.jsx` are wrapped in `ProtectedRoute` (`frontend/src/components/ProtectedRoute.jsx`).

| Path | Page component | Extra check |
| --- | --- | --- |
| `/upload` | `UploadPage` | Checks the upload limit before showing the form. |
| `/reviewers/:id/edit` | `EditReviewerPage` | Only the uploader (`isOwner`) gets the form. |
| `/profile` | `ProfilePage` | Gets a user key. |
| `/saved` | `SavedPage` | Gets a user key. |
| `/saved/:savedId` | `StudyPage` | Gets a user key. `?tab=flashcards` opens the Flashcards tab. |
| `/admin` | `AdminPage` | Gets a user key. Only a profile whose `role` is `admin` sees the reports. |

While Firebase restores the session after a reload, `ProtectedRoute` shows the spinner "Checking your login…" instead of bouncing the person away. A visitor without a login is redirected to `/login` with the message "Log in to continue." and the path they wanted, and the login page brings them back there afterwards. The admin check runs inside `AdminPage`, which shows "Only admins can see this page." to everyone else, and the Header shows the Reports link only to admins. These browser checks are for convenience: the Atlas API refuses non-owners and non-admins on its own.

## Why are some Atlas pages given a key?

In `frontend/src/App.jsx`, five pages get `key={userKey}`: `HomePage`, `ProfilePage`, `SavedPage`, `StudyPage`, and `AdminPage`. The user key is the Firebase user id when someone is logged in, and the word `visitor` otherwise. When a person logs in or out, the key changes. React then throws the old page away and builds a fresh one, so lists never keep "Upvoted" marks, saved items, or reports that belonged to the previous user.

`ReviewerPage` has no key. Its loading effect depends on the user id instead, so it loads the study reviewer again after a login or logout, with the right "Upvoted", "Saved", and owner buttons. The other pages (landing, login, register, terms, upload, edit, and not found) are not keyed.

## What does AuthContext share in the Atlas frontend?

`frontend/src/context/AuthContext.jsx` tells the whole Atlas frontend who is logged in. Components read it with `useContext(AuthContext)`. It shares four values:

- `firebaseUser`: the Firebase account object, or `null` when logged out. Pages use its `uid`, its `photoURL`, and its `providerData` (to tell Google accounts from email accounts).
- `profile`: the Atlas profile from `GET /api/me`: `id`, `displayName`, `email`, `role` (`member` or `admin`), and `createdAt`, plus `uploadCount` and `uploadLimit`. It is `null` when logged out or when loading the profile failed.
- `isLoading`: `true` until Firebase has said whether someone is logged in and the profile request has finished.
- `setProfile`: lets the register and profile pages put an updated profile (for example a new display name) into the app at once.

The provider listens with Firebase's `onAuthStateChanged`, which fires on page load, on login, and on logout. For a logged-in user it calls `GET /api/me`, which also creates the Atlas profile row the first time a new account calls it. If that request fails, the person stays logged in, and pages that need the profile show their own error.

## What does ThemeContext share in the Atlas frontend?

`frontend/src/context/ThemeContext.jsx` shares the color theme with the whole Atlas frontend. It has two values:

- `theme`: `light` or `dark`. It starts from the `data-theme` attribute that the boot script in `index.html` already set, so React and the page agree from the first frame.
- `toggleTheme`: switches to the other theme and saves the new choice in `localStorage` under `atlas-theme`. Only a choice the visitor made is saved; until then the device setting decides. If storage is blocked (for example in private browsing), the theme still changes for the current visit.

An effect keeps the `data-theme` attribute on the html element in step with the React state, and the CSS reads that attribute. The only component that uses this context is `ThemeToggle`, the "Dark mode" button in the header. More on themes is in [How does Atlas choose the light or dark theme?](accessibility-and-design-system.md#how-does-atlas-choose-the-light-or-dark-theme).

## How does the Atlas frontend call the API?

All Atlas data comes from the Atlas API, an Express server, through `frontend/src/services/api.js`. It is the only file in the Atlas frontend that calls `fetch` or `XMLHttpRequest`.

- `API_URL` comes from `VITE_API_URL`, with any trailing slash removed. Without the variable it falls back to a local development address.
- When someone is logged in, every request carries the header `Authorization: Bearer` followed by the Firebase ID token. The token comes from `auth.currentUser.getIdToken()`, and Firebase renews it by itself when it is close to expiring.
- `apiRequest(path, options)` sends a request and returns the parsed JSON reply. `options` may hold `method` (default `GET`) and `json` (an object sent as a JSON body with `Content-Type: application/json`).
- `apiRequestBlob(path)` fetches a file as a Blob, with the login attached. `FileViewer` uses it to show files inside the study page. Admins and uploaders use it to open a study reviewer that reports have hidden, because a plain link cannot carry the login.
- `uploadWithProgress(method, path, formData, onProgress)` sends a form that holds a file. It uses `XMLHttpRequest`, because `fetch` cannot report upload progress. `onProgress` receives a whole number from 0 to 100.

Plain file links (`getFileUrl` in `services/reviewersService.js`) need no token, because reading the file of a visible study reviewer is public.

## How does the Atlas frontend handle API errors?

The Atlas API answers errors as JSON shaped like `{ "error": { "message": "...", "fields": { "title": "..." } } }`. `frontend/src/services/api.js` turns every failed request into a normal JavaScript `Error` with three useful properties:

- `message`: text that is safe to show to people. If the reply has no message, it is "Something went wrong. Please try again."
- `status`: the HTTP status code. Pages use it to choose what to show: 404 or 400 means "not found", 409 on a report means "you already reported this", and 401 when deleting an account means "log in again first".
- `fields`: an object with one message per form field, or `null`. Forms such as `ReviewerForm` show each message next to its field.

When a request gets no answer at all (offline, or the server is down), the error has `status` 0 and the message "Could not reach Atlas. Check your internet connection and try again." `apiRequest`, `apiRequestBlob`, and `uploadWithProgress` all produce the same error shape, so every Atlas page handles errors the same way: it shows `err.message` in an `Alert` and offers "Try again" where that helps.

## Which service files does the Atlas frontend have?

Pages and components in the Atlas frontend never call `fetch` or Firebase themselves. They call small service modules in `frontend/src/services/`. There are eleven:

| File | What it covers |
| --- | --- |
| `api.js` | The fetch wrapper: API address, login token, errors, files as Blobs, uploads with progress |
| `authService.js` | Firebase Authentication: register, log in, Google sign-in, log out, delete account, password reset, plain-language error text |
| `profileService.js` | `/api/me` (read, rename, delete), my uploads, recently viewed |
| `reviewersService.js` | The feed, one study reviewer, file links, create and update with progress, delete, upvote, save, record a view |
| `savedService.js` | Saved list, one saved item, remove, notes, and flashcards (list, make, delete, mark) |
| `reportsService.js` | Report reasons, sending a report, and the admin actions (list, restore, fix category, delete, open a hidden file) |
| `categories.js` | Strands, grades, quarters, material types, subjects per strand, strand slugs |
| `fileRules.js` | Allowed file types, the size limit, and quick checks before an upload |
| `format.js` | File sizes, dates, file type names, and count labels such as "5 upvotes" |
| `noteHtml.js` | Cleaning formatted notes and converting them for the editor, the server, and "Download notes" |
| `feedMemory.js` | Remembering the feed for the Back button |

Outside this folder, `frontend/src/firebase.js` sets up Firebase Authentication and uses the local Auth emulator when `VITE_USE_AUTH_EMULATOR` is `true`. The lists in `categories.js` must match `backend/src/utils/categories.js`.

## How does the Atlas feed remember its place for the Back button?

`frontend/src/services/feedMemory.js` keeps the Atlas feed in plain JavaScript memory while a person looks at a study reviewer. When they come back with the page's Back link or the browser's Back button, `HomePage` shows the same loaded cards at the same scroll position, puts focus on the card they opened, and does not ask the server again.

- `saveFeed` stores the history entry key, the address query, the user id, the loaded cards, the page number, and whether more pages exist. `HomePage` calls it whenever the list changes.
- `readFeed` returns the stored list only when the history entry key and the query match (React Router gives each history entry its own key, so a match means "came back", not "opened the feed again"), the user id is the same, and the list is less than 10 minutes old.
- `rememberScroll` and `rememberOpenedReviewer` record the scroll position and the card that was opened.
- `updateRememberedUpvote` and `updateRememberedSave` keep the stored copy right after an upvote or save on a study reviewer's own page.
- `clearFeed` throws the stored list away. Atlas calls it after an upload, an edit, a delete, a removal from Saved, an admin action, or an account deletion.

The memory is never written anywhere, so a page reload empties it: the filters come back from the address, but the list starts again from page 1. What students see is in [How does the Atlas feed remember my place when I press Back?](search-and-feed.md#how-does-the-atlas-feed-remember-my-place-when-i-press-back).

## How are the Atlas frontend styles organised?

All Atlas styles are plain CSS files in `frontend/src/styles/`. `main.jsx` imports `styles/index.css` once, and `index.css` imports the other files in this exact order. When two rules match an element equally, the later file wins, so a new file must be added to `index.css` in the right place.

1. `tokens.css`: design tokens (colors for both themes, type, spacing, shape, motion)
2. `base.css`: page defaults, headings, links, the focus ring, scrollbars, and layout helpers
3. `components/`: `skip-link`, `icons`, `buttons`, `header`, `footer`, `page-heading`, `cards`, `upvote`, `tabs`
4. `pages/`: `browse`, `landing`
5. `components/`: `forms`, `alerts`, `loading`, `empty-state`, `dialogs`
6. `pages/`: `admin`, `reviewer`, `profile`
7. `components/`: `avatar`, `google-sign-in`, `strands`, `save-button`
8. `pages/`: `saved`, `study`, `flashcards`
9. `high-contrast.css`: last, so it overrides everything above in Windows High Contrast mode

Files in `components/` style pieces used on more than one page; files in `pages/` style one page only. The CSS is mobile first: the base rules are for phones, and `min-width` media queries (mainly 40rem and 64rem) add to them for tablets and desktops. The naming rules are in [How are CSS classes named in Atlas?](accessibility-and-design-system.md#how-are-css-classes-named-in-atlas).

## How do you run, lint, and build the Atlas frontend?

Run these commands from the `frontend/` folder of Atlas:

```
npm install
npm run dev
npm run lint
npm run build
npm run preview
```

- `npm run dev` starts the Vite development server. Its port is fixed in `vite.config.js` with `strictPort`, so Vite fails loudly instead of moving to another port, because the backend accepts browser requests only from its configured `FRONTEND_ORIGIN`.
- `npm run lint` runs `eslint . --max-warnings 0`, so any accessibility or house-style problem fails the check.
- `npm run build` runs `vite build` and writes the static site to `frontend/dist`, using the live values in `.env.production`.
- `npm run preview` serves the built `dist` folder locally for a last look.

The website needs the Atlas API and the Firebase Auth emulator running too; see [How do I start the Atlas emulator, API and website?](local-development.md#how-do-i-start-the-atlas-emulator-api-and-website).

The built site is published with `firebase deploy --only hosting:app` from the project root, to the Firebase Hosting site `atlas-f2757` (https://atlas-f2757.web.app). `firebase.json` rewrites every path to `/index.html`, so React Router can handle deep links. Files under `/assets/` are cached for a year (their names change with each build), and `index.html` is checked again on every visit (`no-cache`). Nothing deploys automatically; see [Does merging an Atlas pull request deploy anything?](development-workflow-and-code-rules.md#does-merging-an-atlas-pull-request-deploy-anything).

## What does the Atlas frontend store in the browser?

The Atlas frontend keeps very little in the browser:

- The `localStorage` key `atlas-theme` holds the light or dark choice, and only after the visitor presses the theme switch. The boot script also reads the old `learnhub-theme` key.
- The `sessionStorage` key `atlas-return-path` holds the page to return to after a Google sign-in that had to leave the page because the pop-up was blocked. It is cleared once the login is seen.
- The Firebase Auth SDK keeps the login session by itself, with its default settings. Atlas code does not configure this.
- The remembered feed (`feedMemory.js`) lives only in memory and disappears on reload.

Atlas code sets no cookies of its own, registers no service worker, and loads no analytics or tracking scripts. Notes, saved items, flashcards, upvotes, and reports are stored by the Atlas API in its database, never in the browser.

## What does the Atlas frontend not do?

- No server rendering. Vite builds static files, Firebase Hosting serves the same `index.html` for every address, and React draws each page in the browser. Without JavaScript, people only see a message asking them to turn it on.
- No direct database access. The browser never talks to PostgreSQL. Every read and write goes through the Atlas API at `VITE_API_URL`, which checks the Firebase ID token and runs all SQL on the server.
- Firebase only for sign-in. The Atlas frontend uses Firebase Authentication for accounts, logins, Google sign-in, and password reset emails. It does not use Firestore, Firebase Storage, or Firebase Analytics. Files come from the Atlas API.
- No secrets. Every `VITE_` value is public. The Gemini API key and the database login exist only on the server.
- No AI calls from the browser. The backend asks Google Gemini to write flashcards; the frontend only sends the number of cards wanted.
- No state library, no TypeScript, no CSS framework, no React refs (`useRef`), and no automated tests. Focus is moved with element ids and `document.getElementById`.

The server side is described in [How is the Atlas backend code organised into layers?](backend-architecture.md#how-is-the-atlas-backend-code-organised-into-layers).
