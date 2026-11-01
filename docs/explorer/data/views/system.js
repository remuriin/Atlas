// The root view: every big part of Atlas and how they talk to each other.
AX.addView({
  id: 'system',
  parent: null,
  group: 'Overview',
  related: ['deploy', 'frontend', 'backend', 'data'],
  type: 'architecture',
  title: 'Atlas at a glance',
  eyebrow: 'ARCHITECTURE',
  purpose: 'Every big part of Atlas, where it runs, and what talks to what. Zoom in to open the web app and the API; click any part for its full picture.',
  desc: 'Architecture of Atlas: a student browser loads the web app from Firebase Hosting, signs in with Firebase Authentication, and calls the Atlas API through the front door on an Oracle Cloud server, which uses PostgreSQL, a files folder, ClamAV and Google Gemini.',
  grid: { x: 40, y: 72, col: 200, row: 96, gapX: 96, gapY: 48 },
  zones: [
    { id: 'z-firebase', label: 'GOOGLE FIREBASE', around: ['web', 'auth'], pad: 20, piece: 'infra:firebase', term: 'firebase' },
    { id: 'z-vps', label: 'ORACLE CLOUD SERVER (VPS)', around: ['door', 'api', 'db', 'files', 'clam'], pad: 20, opens: 'deploy', term: 'vps' },
  ],
  nodes: [
    {
      id: 'browser', at: [0, 1], size: [180, 92], tag: 'USER', treat: 'input',
      name: 'Student browser', sub: 'phone or computer', piece: 'concept:browser', term: 'web-browser', opens: 'p-signin',
      lines: ['Opens atlas-f2757.web.app', 'Runs the web app it downloads'],
    },
    {
      id: 'web', at: [1, 0], span: [1, 2], size: [200, 240], tag: 'WEB APP', treat: 'backend',
      name: 'Atlas web app', sub: 'React 19 + Vite, served by Firebase Hosting', subLod: 1,
      piece: 'app:frontend', opens: 'frontend', term: 'single-page-app',
      kids: {
        cols: 1,
        items: [
          { id: 'w-pages', name: 'Pages (13)', sub: 'routes like /browse', piece: 'layer:pages', opens: 'frontend', term: 'react' },
          { id: 'w-components', name: 'Components (32)', sub: 'cards, forms, dialogs', piece: 'layer:components', opens: 'frontend' },
          { id: 'w-contexts', name: 'Contexts (2)', sub: 'login + theme', piece: 'layer:contexts', opens: 'shell', term: 'react-context' },
          { id: 'w-services', name: 'Services (11)', sub: 'API calls, sign-in', piece: 'layer:services', opens: 'client-data' },
          { id: 'w-styles', name: 'Styles (30 CSS files)', sub: 'tokens, light + dark', piece: 'layer:styles', opens: 'frontend', term: 'design-tokens' },
        ],
      },
    },
    {
      id: 'auth', at: [1, 2], size: [200, 84], tag: 'EXT', treat: 'external',
      name: 'Firebase Authentication', sub: 'email + Google sign-in', piece: 'ext:firebase-auth', opens: 'p-signin', term: 'firebase-authentication',
      lines: ['Issues ID tokens (JWT)', 'Passwords never reach Atlas'],
    },
    {
      id: 'door', at: [2, 1], size: [184, 84], tag: 'FRONT DOOR', treat: 'security',
      name: 'Front door', sub: 'Envoy Gateway in k3s', piece: 'infra:envoy', opens: 'path', term: 'envoy-gateway',
      lines: ['HTTPS with Let’s Encrypt', '60 s request timeout'],
    },
    {
      id: 'api', at: [3, 0], span: [1, 3], size: [200, 384], tag: 'API', treat: 'focal',
      name: 'Atlas API', sub: 'Express 5 on Node 20+, kept running by pm2', subLod: 1,
      piece: 'app:backend', opens: 'backend', term: 'rest-api',
      kids: {
        cols: 1,
        items: [
          { id: 'a-routes', name: 'Routes (5 routers)', sub: '31 endpoints', piece: 'layer:routes', opens: 'endpoints', term: 'endpoint' },
          { id: 'a-middleware', name: 'Middleware (7)', sub: 'login, limits, file checks', piece: 'layer:middleware', opens: 'pipeline', term: 'middleware' },
          { id: 'a-controllers', name: 'Controllers (4)', sub: 'one per router', piece: 'layer:controllers', opens: 'backend', term: 'controller' },
          { id: 'a-models', name: 'Models (7)', sub: 'all the SQL', piece: 'layer:models', opens: 'data', term: 'model' },
          { id: 'a-utils', name: 'Utils (10)', sub: 'validation, Gemini, scans', piece: 'layer:utils', opens: 'backend' },
          { id: 'a-config', name: 'Config (4)', sub: 'settings + database pool', piece: 'layer:config', opens: 'backend', term: 'environment-variable' },
        ],
      },
    },
    {
      id: 'db', at: [4, 0], size: [184, 84], tag: 'DB', treat: 'store',
      name: 'PostgreSQL', sub: '8 tables', piece: 'store:postgres', opens: 'data', term: 'postgresql',
      lines: ['PostgreSQL 14 on the server', 'Private: VPN only'],
    },
    {
      id: 'files', at: [4, 1], size: [184, 84], tag: 'FILES', treat: 'store',
      name: 'Uploaded files', sub: 'one file per reviewer', piece: 'store:uploads', opens: 'f-file', term: 'uploads-folder',
      lines: ['Random hex file names', '10 MB per file'],
    },
    {
      id: 'clam', at: [4, 2], size: [184, 84], tag: 'SCAN', treat: 'security',
      name: 'ClamAV virus scan', sub: 'checks every upload', piece: 'ext:clamav', opens: 'l-upload-checks', term: 'clamav',
      lines: ['Runs as a daemon on the server', 'CLAMAV_MODE=daemon'],
    },
    {
      id: 'gemini', at: [3, 3], size: [200, 84], tag: 'EXT', treat: 'external',
      name: 'Google Gemini', sub: 'makes flashcards', piece: 'ext:gemini', opens: 'p-flashcards', term: 'gemini',
      lines: ['gemini-3.5-flash-lite'],
    },
  ],
  edges: [
    { from: 'browser', to: 'web', label: 'LOADS APP', style: 'muted' },
    { from: 'web', to: 'auth', label: 'SIGN IN', style: 'link' },
    { from: 'web', to: 'door', label: 'HTTPS + TOKEN', style: 'link', max: 1 },
    { from: 'door', to: 'api', style: 'accent' },
    { from: 'api', to: 'auth:right', label: 'CHECK TOKEN', style: 'link', dash: true },
    { from: 'api', to: 'db', label: 'SQL', style: 'muted' },
    { from: 'api', to: 'files', label: 'READ/WRITE', style: 'muted' },
    { from: 'api', to: 'clam', label: 'SCAN', style: 'muted' },
    { from: 'api', to: 'gemini', label: 'FLASHCARDS', style: 'link' },
    { from: 'w-services', to: 'door', label: 'FETCH /API', style: 'link', lod: 2 },
  ],
});
