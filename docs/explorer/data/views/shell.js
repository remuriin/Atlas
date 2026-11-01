// How the Atlas website starts in the browser, layer by layer: the theme boot script,
// main.jsx, the router, the two providers and the frame every page shares.
AX.addView({
  id: 'shell',
  parent: 'frontend',
  group: 'Frontend',
  related: ['frontend', 'client-data', 'p-signin'],
  type: 'layers',
  title: 'How the web app starts',
  eyebrow: 'LAYERS',
  purpose: 'What runs, in order, when the Atlas website opens. Each layer wraps the ones below it, so every page can read the address, the colour theme and who is logged in.',
  desc: 'Layers of the Atlas web app at start-up: a script in index.html picks the theme from localStorage, main.jsx renders BrowserRouter, ThemeProvider and AuthProvider around the App frame of SkipLink, Header, Routes and Footer. ThemeProvider saves the theme choice, and AuthProvider listens to Firebase Authentication and loads the profile from the Atlas API.',
  grid: { x: 40, y: 72, col: 200, row: 96, gapX: 64, gapY: 40 },
  nodes: [
    {
      id: 'boot', at: [1, 0], span: [2, 1], size: [464, 96], tag: 'INDEX.HTML',
      name: 'Theme boot script', sub: 'a small script in the page head', piece: 'app:frontend', term: 'design-tokens',
      lines: ['Reads atlas-theme (or the old learnhub-theme key)', 'Without a choice, follows prefers-color-scheme', 'Sets data-theme on html before the first paint'],
    },
    {
      id: 'main', at: [1, 1], span: [2, 1], size: [464, 96], tag: 'MAIN.JSX', treat: 'focal',
      name: 'main.jsx', sub: 'the starting point', piece: 'file:main.jsx', term: 'react',
      lines: ['Imports the 2 fonts and styles/index.css', 'Sets scrollRestoration to manual', 'Renders everything inside StrictMode'],
    },
    {
      id: 'router', at: [1, 2], span: [2, 1], size: [464, 96], tag: 'ROUTER',
      name: 'BrowserRouter', sub: 'react-router-dom 6: reads the address', piece: 'file:main.jsx', term: 'react-router',
      lines: ['Future flag v7_relativeSplatPath on', 'v7_startTransition off on purpose (logout lands on home)'],
    },
    {
      id: 'theme', at: [1, 3], span: [2, 1], size: [464, 96], tag: 'CONTEXT',
      name: 'ThemeProvider', sub: 'ThemeContext: theme + toggleTheme', piece: 'ctx:ThemeContext', term: 'react-context',
      lines: ['Starts from the data-theme the boot script set', 'Keeps data-theme in step with React', 'Only ThemeToggle reads it'],
    },
    {
      id: 'auth', at: [1, 4], span: [2, 1], size: [464, 96], tag: 'CONTEXT',
      name: 'AuthProvider', sub: 'AuthContext: who is logged in', piece: 'ctx:AuthContext', opens: 'p-signin', term: 'react-context',
      lines: ['Runs on page load, login and logout', 'Shares firebaseUser, profile, isLoading, setProfile', 'A failed profile load keeps the person logged in'],
    },
    {
      id: 'app', at: [1, 5], span: [2, 1], size: [464, 96], tag: 'FRAME',
      name: 'App frame', sub: 'App.jsx: the same frame on every page', piece: 'file:App.jsx', opens: 'frontend',
      kids: {
        cols: 4, h: 52,
        items: [
          { id: 'k-skip', name: 'SkipLink', sub: 'first Tab stop', subLod: 2, piece: 'comp:SkipLink', lines: ['Moves focus to main'] },
          { id: 'k-header', name: 'Header', sub: 'logo, menu, theme', subLod: 2, piece: 'comp:Header', lines: ['Reports link: admins'] },
          { id: 'k-routes', name: 'Routes', sub: 'picks the page', subLod: 2, piece: 'file:App.jsx', opens: 'frontend', lines: ['key={userKey}:', 'fresh pages on login'] },
          { id: 'k-footer', name: 'Footer', sub: 'links + Terms', subLod: 2, piece: 'comp:Footer', lines: ['Browse, Share, Terms'] },
        ],
      },
    },
    {
      id: 'storage', at: [0, 0], size: [200, 96], tag: 'BROWSER', treat: 'store',
      name: 'localStorage', sub: 'key atlas-theme', piece: 'ctx:ThemeContext', term: 'web-storage',
      lines: ['Old key: learnhub-theme', 'Saved only after a click'],
    },
    {
      id: 'firebase', at: [3, 4], nudge: [0, -16], size: [200, 96], tag: 'AUTH', treat: 'external',
      name: 'Firebase Authentication', sub: 'onAuthStateChanged', piece: 'ext:firebase-auth', opens: 'p-signin', term: 'firebase-authentication',
      lines: ['Says who is logged in'],
    },
    {
      id: 'api', at: [3, 5], size: [200, 96], tag: 'API', treat: 'external',
      name: 'Atlas API', sub: 'GET /api/me', piece: 'ep:get-me', opens: 'client-data', term: 'rest-api',
      lines: ['Makes the profile row the', 'first time a new account asks'],
    },
  ],
  edges: [
    { from: 'boot', to: 'main', label: 'LOADS', style: 'muted' },
    { from: 'main', to: 'router', label: 'RENDERS', style: 'muted' },
    { from: 'router', to: 'theme', style: 'muted' },
    { from: 'theme', to: 'auth', style: 'muted' },
    { from: 'auth', to: 'app', style: 'muted' },
    { from: 'boot', to: 'storage', label: 'READS', style: 'muted' },
    { from: 'theme', to: 'storage', label: 'SAVES', style: 'muted' },
    { from: 'auth', to: 'firebase', label: 'LISTENS', style: 'link' },
    { from: 'auth:right', to: 'api:left', label: 'GET /API/ME', style: 'link' },
  ],
  notes: [
    { at: [3, 1], w: 200, lod: 2, text: 'Each layer wraps every layer below it, so any page or component can read the address, the theme and the login.' },
  ],
});
