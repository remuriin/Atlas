// Parts of Atlas that are not a single source file: the apps, their layers, the
// stores, the outside services and the infrastructure. The build adds every file,
// function, endpoint, table, column and setting on its own (lib/extract.js); these
// entries give the big parts their plain-words and technical text.
module.exports = [
  {
    id: 'concept:browser', kind: 'concept', name: 'Student browser',
    plain: 'The phone or computer a student uses to open Atlas. It downloads the Atlas web app once and then runs it, so the pages feel quick.',
    tech: 'Any modern browser. It loads the static build from Firebase Hosting, keeps the Firebase sign-in session, and calls the Atlas API over HTTPS with the Firebase ID token in the Authorization header.',
    docs: ['user-guide'], opens: 'p-signin', term: 'web-browser',
  },
  {
    id: 'app:frontend', kind: 'app', name: 'Atlas web app',
    plain: 'Everything you see and click in Atlas. It is downloaded from Firebase Hosting and runs inside your browser.',
    tech: 'A React 19 single-page app built with Vite 8, using react-router-dom 6 for its 13 pages and the Firebase client SDK for sign-in only. All data comes from the Atlas API.',
    facts: [['Code', '`frontend/src`'], ['Hosted at', 'https://atlas-f2757.web.app'], ['Build', '`npm run build` makes `frontend/dist`']],
    docs: ['frontend-architecture'], opens: 'frontend', term: 'single-page-app',
  },
  {
    id: 'app:backend', kind: 'app', name: 'Atlas API',
    plain: 'The part of Atlas that runs on the server. It checks who you are, stores and reads study reviewers, and guards every upload.',
    tech: 'An Express 5 app on Node 20+ (CommonJS) with raw SQL through pg, firebase-admin for token checks, multer for uploads and express-rate-limit. pm2 keeps it running on the VPS; Envoy Gateway forwards HTTPS traffic to it.',
    facts: [['Code', '`backend/src`'], ['Address', 'https://api.140-245-60-8.sslip.io'], ['Endpoints', '30, counting GET /api/health']],
    docs: ['backend-architecture'], opens: 'backend', term: 'rest-api',
  },
  {
    id: 'layer:pages', kind: 'layer', name: 'Pages',
    plain: 'The 13 screens of Atlas, such as the feed, a study reviewer, the study page and the admin page.',
    tech: 'React components in `frontend/src/pages`, one per route in `App.jsx`. Some are wrapped in ProtectedRoute and some are re-mounted on login (key={userKey}).',
    docs: ['frontend-pages-and-components'], opens: 'frontend',
  },
  {
    id: 'layer:components', kind: 'layer', name: 'Components',
    plain: 'The 32 reusable building blocks the pages are made of: cards, buttons, forms, dialogs and study tools.',
    tech: 'React function components in `frontend/src/components`, plain CSS classes, no UI library.',
    docs: ['frontend-pages-and-components'], opens: 'frontend',
  },
  {
    id: 'layer:contexts', kind: 'layer', name: 'Contexts',
    plain: 'Two shared memories every page can read: who is logged in, and whether the dark theme is on.',
    tech: '`AuthContext` (firebaseUser, profile, isLoading) and `ThemeContext` (theme, toggleTheme) in `frontend/src/context`.',
    docs: ['frontend-architecture'], opens: 'shell', term: 'react-context',
  },
  {
    id: 'layer:services', kind: 'layer', name: 'Services',
    plain: 'The helpers that talk to the outside: the Atlas API, Firebase sign-in, and shared lists like the categories.',
    tech: 'Plain JS modules in `frontend/src/services`. `api.js` adds the Bearer token and turns errors into messages; the others group the calls by topic.',
    docs: ['frontend-architecture'], opens: 'client-data',
  },
  {
    id: 'layer:styles', kind: 'layer', name: 'Styles',
    plain: 'The look of Atlas: colours, fonts, spacing and the light and dark themes.',
    tech: '30 plain CSS files in `frontend/src/styles`: tokens.css (design tokens), base.css, components/*, pages/*, high-contrast.css, imported in order by index.css.',
    docs: ['accessibility-and-design-system'], opens: 'frontend', term: 'design-tokens',
  },
  {
    id: 'layer:routes', kind: 'layer', name: 'Routes',
    plain: 'The list of addresses the API answers, and which checks each one runs, in order.',
    tech: 'Four Express routers in `backend/src/routes`, mounted under /api/reviewers, /api/me, /api/saved and /api/admin.',
    docs: ['api-endpoints'], opens: 'endpoints', term: 'endpoint',
  },
  {
    id: 'layer:middleware', kind: 'layer', name: 'Middleware',
    plain: 'The checks a request passes before it is handled: login, limits, ownership and file safety.',
    tech: 'Seven files in `backend/src/middleware`: auth, upload, checkUpload, reviewerAccess, savedAccess, rateLimit and errorHandler.',
    docs: ['request-pipeline-and-middleware'], opens: 'pipeline', term: 'middleware',
  },
  {
    id: 'layer:controllers', kind: 'layer', name: 'Controllers',
    plain: 'The code that does the actual work of each address once every check has passed.',
    tech: 'Four files in `backend/src/controllers`, one per router; they validate input, call models and shape the JSON reply.',
    docs: ['backend-architecture'], opens: 'backend', term: 'controller',
  },
  {
    id: 'layer:models', kind: 'layer', name: 'Models',
    plain: 'The only place that talks to the database. Every question and change to stored data is written here.',
    tech: 'Seven files in `backend/src/models` with parameterised SQL through the shared pg pool; no ORM.',
    docs: ['database-schema-and-data-model'], opens: 'data', term: 'model',
  },
  {
    id: 'layer:utils', kind: 'layer', name: 'Utils',
    plain: 'Helpers used by the rest of the API: checking input, reading files, scanning for viruses and making flashcards.',
    tech: 'Ten files in `backend/src/utils`: validate, categories, gemini, materialContent, fileContents, virusScan, zipReader, rateLimitStore, reviewerItems and httpError.',
    docs: ['backend-architecture'], opens: 'backend',
  },
  {
    id: 'layer:config', kind: 'layer', name: 'Config',
    plain: 'The settings the API reads when it starts, and the connection to the database.',
    tech: 'Four files in `backend/src/config`: env.js (every setting, with start-up checks), db.js and createPool.js (the pg pool, 10 connections) and firebaseAdmin.js.',
    docs: ['configuration-and-environment'], opens: 'backend', term: 'environment-variable',
  },
  {
    id: 'store:postgres', kind: 'store', name: 'PostgreSQL',
    plain: 'The database where Atlas keeps its records: accounts, study reviewers, upvotes, saved items, notes, flashcards and reports.',
    tech: 'PostgreSQL 14 on the VPS, outside the k3s cluster, reachable only from the server, the cluster network and the maintainer VPN. Eight tables from `backend/db/schema.sql`.',
    docs: ['database-schema-and-data-model', 'database-operations'], opens: 'data', term: 'postgresql',
  },
  {
    id: 'store:uploads', kind: 'store', name: 'Uploaded files',
    plain: 'The folder on the server that holds the actual files people share. The database only stores their names.',
    tech: 'UPLOAD_DIR on the VPS. Files get random hex names with an allowlisted extension; the original name is kept in the reviewers row.',
    docs: ['uploads-and-file-safety'], opens: 'f-file', term: 'uploads-folder',
  },
  {
    id: 'ext:firebase-auth', kind: 'ext', name: 'Firebase Authentication',
    plain: 'Google’s sign-in service. It checks passwords and Google accounts so Atlas never sees a password.',
    tech: 'Email/password and Google providers on project learnhub-ea4291, auth domain learnhub-ea4291.firebaseapp.com. The browser gets an ID token (a signed JWT); the API verifies it with firebase-admin.',
    docs: ['accounts-and-sign-in'], opens: 'p-signin', term: 'firebase-authentication',
  },
  {
    id: 'ext:gemini', kind: 'ext', name: 'Google Gemini',
    plain: 'Google’s AI. Atlas sends it a saved study reviewer and asks for flashcards.',
    tech: 'The Gemini REST API (GEMINI_MODEL, default gemini-3.5-flash-lite) called from `backend/src/utils/gemini.js` with a JSON schema for the cards, a 120 s timeout, and the key GEMINI_API_KEY kept on the server.',
    docs: ['flashcards'], opens: 'p-flashcards', term: 'gemini',
  },
  {
    id: 'ext:clamav', kind: 'ext', name: 'ClamAV virus scan',
    plain: 'A free virus scanner that checks every uploaded file before Atlas keeps it. On the live server it runs all the time in the background.',
    tech: 'CLAMAV_MODE off (the default, for development), daemon (clamd over a unix socket, INSTREAM) or command (clamscan). The live server runs ClamAV 1.5 as a daemon with CLAMAV_MODE=daemon (checked 2026-10-31). A scanner failure refuses the upload (503); a threat answers 422.',
    docs: ['uploads-and-file-safety'], opens: 'l-upload-checks', term: 'clamav',
  },
  {
    id: 'infra:firebase', kind: 'infra', name: 'Google Firebase',
    plain: 'Google’s app platform. Atlas uses two parts of it: Hosting for the website and Authentication for sign-in.',
    tech: 'Project learnhub-ea4291 on the free Spark plan. Hosting targets: app (atlas-f2757, the site) and old (learnhub-ea4291, a 301 redirect).',
    docs: ['hosting-and-traffic-path'], opens: 'deploy', term: 'firebase',
  },
  {
    id: 'infra:envoy', kind: 'infra', name: 'Front door (Envoy Gateway)',
    plain: 'The guard at the server’s door: it handles the secure HTTPS connection and passes each request on to the Atlas API.',
    tech: 'Envoy Gateway in the k3s cluster: listener for api.140-245-60-8.sslip.io with a Let’s Encrypt certificate from cert-manager, HTTPRoute learnhub-api with a 60 s timeout, and a Service plus EndpointSlice pointing at the API process on the host.',
    docs: ['hosting-and-traffic-path'], opens: 'path', term: 'envoy-gateway',
  },
];
