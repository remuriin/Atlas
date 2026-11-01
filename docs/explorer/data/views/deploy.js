// Where each part of Atlas runs: Firebase, the Oracle Cloud server, and the public
// services in between (name lookup, certificates, flashcards).
AX.addView({
  id: 'deploy',
  parent: 'system',
  group: 'Where it runs',
  related: ['vps', 'path', 'frontend'],
  type: 'deployment',
  title: 'Where Atlas runs',
  eyebrow: 'DEPLOYMENT',
  purpose: 'Atlas runs in two places: the website on Google Firebase, and the API with its database and files on one Oracle Cloud server. Zoom in to see what runs where; click the server to look inside it.',
  desc: 'Deployment of Atlas: the browser loads the website from Firebase Hosting, signs in with Firebase Authentication, looks up the API name at sslip.io and calls the front door on the Oracle Cloud VPS, which forwards to the Atlas API. The API uses PostgreSQL and the uploads folder and calls Google Gemini, and cert-manager gets the certificate from Let’s Encrypt.',
  grid: { x: 40, y: 92, col: 200, row: 96, gapX: 96, gapY: 48 },
  zones: [
    { id: 'z-firebase', label: 'GOOGLE FIREBASE', around: ['hosting', 'auth'], pad: 20, piece: 'infra:firebase', term: 'firebase' },
    { id: 'z-vps', label: 'ORACLE CLOUD VPS', around: ['door', 'api', 'data'], pad: 20, opens: 'vps', term: 'vps' },
    { id: 'z-public', label: 'PUBLIC SERVICES', around: ['sslip', 'le', 'gemini'], pad: 32 },
  ],
  nodes: [
    {
      id: 'browser', at: [1, 0], nudge: [0, 72], size: [200, 96], tag: 'USER', treat: 'input',
      name: 'Student browser', sub: 'phone or computer', piece: 'concept:browser', opens: 'p-signin', term: 'web-browser',
      lines: ['Loads atlas-f2757.web.app', 'Calls api.140-245-60-8.sslip.io'],
    },
    {
      id: 'hosting', at: [0, 0], size: [200, 140], tag: 'HOSTING', treat: 'external',
      name: 'Firebase Hosting', sub: '2 sites: the app + old name',
      piece: 'infra:firebase', opens: 'frontend', term: 'firebase-hosting',
      kids: {
        cols: 1, h: 44,
        items: [
          {
            id: 'site-old', name: 'learnhub-ea4291.web.app', sub: 'old name: 301 to the app', subLod: 2,
            treat: 'external', piece: 'infra:firebase', term: 'firebase-hosting',
            lines: ['Keeps the path and query'],
          },
          {
            id: 'site-app', name: 'atlas-f2757.web.app', sub: 'the app: frontend/dist', subLod: 2,
            treat: 'external', piece: 'app:frontend', opens: 'frontend', term: 'single-page-app',
            lines: ['Any path gets /index.html'],
          },
        ],
      },
    },
    {
      id: 'auth', at: [0, 1], size: [200, 96], tag: 'AUTH', treat: 'external',
      name: 'Firebase Authentication', sub: 'email + Google sign-in', piece: 'ext:firebase-auth', opens: 'p-signin', term: 'firebase-authentication',
      lines: ['Issues ID tokens (JWT)', 'Passwords never reach Atlas'],
    },
    {
      id: 'door', at: [2, 0], nudge: [0, 72], size: [200, 96], tag: 'FRONT DOOR', treat: 'security',
      name: 'Front door', sub: 'Envoy Gateway in k3s', piece: 'infra:envoy', opens: 'path', term: 'envoy-gateway',
      lines: ['cert-manager keeps the certificate', 'Ends HTTPS; 60 s timeout', 'Port 80 answers 301 to HTTPS'],
    },
    {
      id: 'api', at: [3, 0], nudge: [0, 72], size: [200, 104], tag: 'API', treat: 'focal',
      name: 'Atlas API', sub: 'pm2 process learnhub-api', piece: 'app:backend', opens: 'backend', term: 'pm2',
      lines: ['Express 5 on Node 20+', 'Runs on the host, not in k3s', 'Checks sign-in tokens itself', 'Scans uploads with ClamAV'],
    },
    {
      id: 'data', at: [4, 0], nudge: [0, 72], size: [200, 140], tag: 'DATA', treat: 'store',
      name: 'Stored data', sub: 'database + files on the disk', piece: 'store:postgres', opens: 'data', term: 'postgresql',
      kids: {
        cols: 1, h: 44,
        items: [
          { id: 'pg', name: 'PostgreSQL 14', sub: '8 tables, outside k3s', subLod: 2, treat: 'store', piece: 'store:postgres', opens: 'data', term: 'postgresql', lines: ['Not reachable from the internet'] },
          { id: 'files', name: 'Uploads folder', sub: 'UPLOAD_DIR on the disk', subLod: 2, treat: 'store', piece: 'store:uploads', opens: 'f-file', term: 'uploads-folder', lines: ['Random hex names, 10 MB each'] },
        ],
      },
    },
    {
      id: 'sslip', at: [1, 2], nudge: [0, 16], size: [200, 96], tag: 'DNS', treat: 'external',
      name: 'sslip.io', sub: 'free public name lookup', opens: 'path', term: 'sslipio',
      lines: ['Answers the server address', 'for the name with it in dashes'],
    },
    {
      id: 'le', at: [2, 2], nudge: [0, 16], size: [200, 96], tag: 'CERTIFICATES', treat: 'external',
      name: 'Let’s Encrypt', sub: 'free certificate authority', opens: 'vps', term: 'lets-encrypt',
      lines: ['HTTP-01 check on port 80', 'About 90 days, renewed early'],
    },
    {
      id: 'gemini', at: [3, 2], nudge: [0, 16], size: [200, 96], tag: 'AI', treat: 'external',
      name: 'Google Gemini', sub: 'makes flashcards', piece: 'ext:gemini', opens: 'p-flashcards', term: 'gemini',
      lines: ['gemini-3.5-flash-lite', 'Key only on the server'],
    },
  ],
  edges: [
    { from: 'browser', to: 'hosting', label: 'HTTPS', style: 'link' },
    { from: 'browser', to: 'auth', label: 'SIGN IN', style: 'link' },
    { from: 'browser', to: 'door', label: 'HTTPS 443', style: 'link' },
    { from: 'browser', to: 'sslip', label: 'DNS LOOKUP', dash: true },
    { from: 'door', to: 'api', style: 'accent' },
    { from: 'api', to: 'data', label: 'SQL + FILES', style: 'muted', max: 1 },
    { from: 'api', to: 'pg', label: 'SQL', style: 'muted', lod: 2 },
    { from: 'api', to: 'files', label: 'READ/WRITE', style: 'muted', lod: 2 },
    { from: 'door', to: 'le', label: 'CERTIFICATE', style: 'link' },
    { from: 'api', to: 'gemini', label: 'FLASHCARDS', style: 'link' },
  ],
  notes: [
    { at: [0, 2], w: 200, lod: 3, text: 'The old learnhub-ea4291 site answers every path with a 301 to the same path on atlas-f2757. Cache: /assets/ files 1 year, /index.html no-cache, other page addresses Firebase’s default 1 hour.' },
    { at: [4, 2], w: 200, lod: 3, text: 'The live API runs the code deployed on 2026-10-29. Only the newest search ranking on main is not live yet.' },
  ],
});
