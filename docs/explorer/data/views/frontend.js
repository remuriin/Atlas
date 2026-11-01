// How the Atlas web app is put together: the start-up code and the page frame, the
// 13 pages, the 32 components in 7 groups, the service modules that talk to the
// outside, and the styles.
AX.addView({
  id: 'frontend',
  parent: 'system',
  group: 'Frontend',
  related: ['shell', 'client-data', 'system'],
  type: 'architecture',
  title: 'Frontend structure',
  eyebrow: 'ARCHITECTURE',
  purpose: 'The parts of the Atlas website and how they depend on each other. Pages are built from components and get their data only through the service modules, which call the Atlas API and Firebase. Zoom in to see every page, component group and service.',
  desc: 'Architecture of the Atlas frontend: main.jsx and the providers render the App shell, which routes to 13 pages; pages use 32 components in 7 groups and call 11 service modules, and some components call services too. The services call the Atlas API over HTTPS with the login token and Firebase Authentication for sign-in. Components use the classes from 30 CSS files.',
  grid: { x: 40, y: 72, col: 200, row: 96, gapX: 64, gapY: 48 },
  zones: [
    { id: 'z-web', label: 'ATLAS WEB APP, IN THE BROWSER', around: ['entry', 'shell', 'styles', 'pages', 'components', 'services'], pad: 20, piece: 'app:frontend', term: 'single-page-app' },
  ],
  nodes: [
    {
      id: 'entry', at: [0, 0], size: [200, 96], tag: 'ENTRY',
      name: 'Entry & providers', sub: 'index.html + main.jsx', piece: 'file:main.jsx', opens: 'shell', term: 'react-context',
      lines: ['Theme set before the first paint', 'Router, theme and login providers'],
    },
    {
      id: 'shell', at: [0, 1], size: [200, 96], tag: 'FRAME',
      name: 'App shell', sub: 'App.jsx', piece: 'file:App.jsx', opens: 'shell', term: 'react',
      lines: ['SkipLink, Header, Routes, Footer', '13 routes; 6 need a login'],
    },
    {
      id: 'styles', at: [0, 2], size: [200, 96], tag: 'CSS',
      name: 'Styles', sub: '30 plain CSS files', piece: 'layer:styles', term: 'design-tokens',
      lines: ['tokens.css: light + dark colours', 'index.css imports them in order'],
    },
    {
      id: 'pages', at: [1, 0], span: [2, 2], size: [464, 240], tag: 'PAGES', treat: 'focal',
      name: 'Pages', sub: '13 screens, one per route', piece: 'layer:pages', term: 'react',
      kids: {
        cols: 3, h: 32,
        items: [
          { id: 'pg-landing', name: 'LandingPage', sub: '/', subLod: 2, piece: 'page:LandingPage' },
          { id: 'pg-home', name: 'HomePage', sub: '/browse', subLod: 2, piece: 'page:HomePage' },
          { id: 'pg-reviewer', name: 'ReviewerPage', sub: '/reviewers/:id', subLod: 2, piece: 'page:ReviewerPage' },
          { id: 'pg-login', name: 'LoginPage', sub: '/login', subLod: 2, piece: 'page:LoginPage' },
          { id: 'pg-register', name: 'RegisterPage', sub: '/register', subLod: 2, piece: 'page:RegisterPage' },
          { id: 'pg-terms', name: 'TermsPage', sub: '/terms', subLod: 2, piece: 'page:TermsPage' },
          { id: 'pg-upload', name: 'UploadPage', sub: '/upload · login', subLod: 2, piece: 'page:UploadPage' },
          { id: 'pg-edit', name: 'EditReviewerPage', sub: '/reviewers/:id/edit · login', subLod: 2, piece: 'page:EditReviewerPage' },
          { id: 'pg-profile', name: 'ProfilePage', sub: '/profile · login', subLod: 2, piece: 'page:ProfilePage' },
          { id: 'pg-saved', name: 'SavedPage', sub: '/saved · login', subLod: 2, piece: 'page:SavedPage' },
          { id: 'pg-study', name: 'StudyPage', sub: '/saved/:savedId · login', subLod: 2, piece: 'page:StudyPage' },
          { id: 'pg-admin', name: 'AdminPage', sub: '/admin · admins', subLod: 2, piece: 'page:AdminPage' },
          { id: 'pg-notfound', name: 'NotFoundPage', sub: '* any other address', subLod: 2, piece: 'page:NotFoundPage' },
        ],
      },
    },
    {
      id: 'components', at: [1, 2], span: [2, 2], size: [464, 232], tag: 'UI',
      name: 'Components', sub: '32 building blocks in 7 groups', piece: 'layer:components', term: 'react',
      kids: {
        cols: 2, h: 40,
        items: [
          { id: 'cg-layout', name: 'Layout and navigation (8)', sub: 'Header, Footer, SkipLink, PageHeading, ProtectedRoute, TabBar, ThemeToggle, Avatar', subLod: 2, piece: 'comp:Header', opens: 'shell' },
          { id: 'cg-cards', name: 'Cards and lists (6)', sub: 'ReviewerCard, ReviewerList, SkeletonList, StrandLink, StrandLegend, TagList', subLod: 2, piece: 'comp:ReviewerCard' },
          { id: 'cg-actions', name: 'Upvote, save, report (4)', sub: 'UpvoteButton, SaveButton, ReportDialog, ConfirmDialog', subLod: 2, piece: 'comp:UpvoteButton' },
          { id: 'cg-forms', name: 'Forms and sign-in (4)', sub: 'FormField, ErrorSummary, ReviewerForm, GoogleSignInButton', subLod: 2, piece: 'comp:ReviewerForm' },
          { id: 'cg-messages', name: 'Messages and loading (5)', sub: 'Alert, FlashMessage, EmptyState, Spinner, Icon', subLod: 2, piece: 'comp:Alert' },
          { id: 'cg-notes', name: 'File and notes (3)', sub: 'FileViewer, NotesPanel, NoteEditor', subLod: 2, piece: 'comp:NotesPanel', opens: 'p-notes' },
          { id: 'cg-cards2', name: 'Flashcards (2)', sub: 'FlashcardsPanel, Flashcard', subLod: 2, piece: 'comp:FlashcardsPanel', opens: 'p-flashcards', term: 'flashcard' },
        ],
      },
    },
    {
      id: 'services', at: [3, 0], span: [1, 3], size: [296, 384], nudge: [48, 0], tag: 'DATA',
      name: 'Services', sub: '11 modules: API calls and sign-in', piece: 'layer:services', opens: 'client-data',
      kids: {
        cols: 2, h: 48,
        items: [
          { id: 'sv-api', name: 'api', sub: 'fetch + token + errors', subLod: 2, piece: 'svc:api', opens: 'client-data', lines: ['Only file that calls fetch'] },
          { id: 'sv-auth', name: 'authService', sub: 'Firebase sign-in', subLod: 2, piece: 'svc:authService', opens: 'p-signin', lines: ['Login, Google, reset, delete'] },
          { id: 'sv-profile', name: 'profileService', sub: 'my profile + lists', subLod: 2, piece: 'svc:profileService', lines: ['GET, PUT, DELETE /api/me'] },
          { id: 'sv-reviewers', name: 'reviewersService', sub: 'study reviewers', subLod: 2, piece: 'svc:reviewersService', lines: ['Uploads with progress (XHR)'] },
          { id: 'sv-saved', name: 'savedService', sub: 'saved, notes, flashcards', subLod: 2, piece: 'svc:savedService', lines: ['/api/me/saved and /api/saved'] },
          { id: 'sv-reports', name: 'reportsService', sub: 'reports + admin', subLod: 2, piece: 'svc:reportsService', lines: ['Opens hidden files as a Blob'] },
          { id: 'sv-categories', name: 'categories', sub: 'strands, grades, subjects', subLod: 2, piece: 'svc:categories', term: 'strand', lines: ['Must match the backend list'] },
          { id: 'sv-filerules', name: 'fileRules', sub: 'checks before upload', subLod: 2, piece: 'svc:fileRules', lines: ['Type, size limit, empty file'] },
          { id: 'sv-format', name: 'format', sub: 'sizes, dates, labels', subLod: 2, piece: 'svc:format', lines: ['For example 5 upvotes'] },
          { id: 'sv-notehtml', name: 'noteHtml', sub: 'clean note HTML', subLod: 2, piece: 'svc:noteHtml', opens: 'p-notes', lines: ['Editor, server, .txt export'] },
          { id: 'sv-feed', name: 'feedMemory', sub: 'feed for the Back button', subLod: 2, piece: 'svc:feedMemory', lines: ['In memory, 10 minutes max'] },
        ],
      },
    },
    {
      id: 'api', at: [4, 0], nudge: [168, 48], size: [200, 96], tag: 'API', treat: 'external',
      name: 'Atlas API', sub: 'api.140-245-60-8.sslip.io', piece: 'app:backend', opens: 'backend', term: 'rest-api',
      lines: ['Express 5 on the VPS', 'Checks the token on every call'],
    },
    {
      id: 'firebase', at: [4, 2], nudge: [168, -48], size: [200, 96], tag: 'AUTH', treat: 'external',
      name: 'Firebase Authentication', sub: 'accounts and passwords', piece: 'ext:firebase-auth', opens: 'p-signin', term: 'firebase-authentication',
      lines: ['Gives the browser an ID token', 'Used for sign-in only'],
    },
  ],
  edges: [
    { from: 'entry', to: 'shell', label: 'RENDERS', style: 'muted' },
    { from: 'shell', to: 'pages', label: 'ROUTES', style: 'muted' },
    { from: 'pages', to: 'components', label: 'USE', style: 'muted' },
    { from: 'pages', to: 'services', label: 'CALL', style: 'muted' },
    { from: 'components', to: 'services', label: 'CALL', dash: true },
    { from: 'components', to: 'styles', label: 'CLASSES', style: 'muted' },
    { from: 'services', to: 'api', label: 'HTTPS + TOKEN', style: 'link' },
    { from: 'services', to: 'firebase', label: 'SIGN IN', style: 'link' },
  ],
  notes: [
    { xy: [1264, 520], w: 200, lod: 2, text: 'Pages and components never call fetch or Firebase themselves: only the service modules do.' },
  ],
});
