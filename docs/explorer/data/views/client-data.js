// How the website gets its data: pages and components call the service modules,
// every API call goes through api.js, and sign-in goes through authService and the
// Firebase set-up in firebase.js.
AX.addView({
  id: 'client-data',
  parent: 'frontend',
  group: 'Frontend',
  related: ['frontend', 'path', 'shell', 'p-signin'],
  type: 'architecture',
  title: 'Frontend data layer',
  eyebrow: 'ARCHITECTURE',
  purpose: 'Where the website’s data comes from. Pages and components ask small service modules; every call to the Atlas API goes through api.js, which adds the login token and turns failures into readable messages. Signing in goes to Firebase through authService.',
  desc: 'Frontend data layer: pages, AuthContext and some components call four API service modules, which all use api.js to reach the Atlas API over HTTPS with the Firebase ID token; api.js gets that token from firebase.js. authService uses firebase.js to sign in with Firebase Authentication. Five helper modules make no network calls.',
  grid: { x: 40, y: 72, col: 200, row: 96, gapX: 64, gapY: 48 },
  nodes: [
    {
      id: 'callers', at: [0, 0], span: [1, 4], nudge: [0, -24], size: [200, 484], tag: 'CALLERS',
      name: 'Pages and components', sub: 'never call fetch or Firebase', piece: 'layer:pages', opens: 'frontend', term: 'react',
      kids: {
        cols: 1, h: 56,
        items: [
          { id: 'c-pages', name: '13 pages', sub: 'load and save data', subLod: 2, piece: 'layer:pages', opens: 'frontend', lines: ['Each page calls its services', 'in a loading effect'] },
          { id: 'c-auth', name: 'AuthContext', sub: 'GET /api/me at login', subLod: 2, piece: 'ctx:AuthContext', opens: 'shell', lines: ['profileService.getMyProfile'] },
          { id: 'c-buttons', name: 'Upvote + Save buttons', sub: 'reviewersService', subLod: 2, piece: 'comp:UpvoteButton', lines: ['UpvoteButton, SaveButton'] },
          { id: 'c-form', name: 'ReviewerForm', sub: 'upload with progress', subLod: 2, piece: 'comp:ReviewerForm', opens: 'p-upload', lines: ['createReviewer, updateReviewer'] },
          { id: 'c-study', name: 'Notes + Flashcards', sub: 'savedService', subLod: 2, piece: 'comp:NotesPanel', opens: 'p-notes', lines: ['NotesPanel, FlashcardsPanel'] },
          { id: 'c-viewer', name: 'FileViewer', sub: 'api.js directly', subLod: 2, piece: 'comp:FileViewer', lines: ['apiRequestBlob for the file'] },
          { id: 'c-header', name: 'Header + Google button', sub: 'authService', subLod: 2, piece: 'comp:Header', opens: 'p-signin', lines: ['Log out, Continue with Google'] },
        ],
      },
    },
    {
      id: 'services', at: [1, 0], span: [2, 2], nudge: [4, -24], size: [472, 196], tag: 'SERVICES',
      name: 'API services', sub: '4 modules, one per topic', piece: 'layer:services', term: 'rest-api',
      kids: {
        cols: 2, h: 72,
        items: [
          {
            id: 's-reviewers', name: 'reviewersService', sub: 'feed, upload, upvote, save', subLod: 2, piece: 'svc:reviewersService',
            lines: ['listReviewers, getReviewer, getFileUrl, createReviewer, updateReviewer, deleteReviewer, addUpvote, removeUpvote, saveReviewer, unsaveReviewer, recordView'],
          },
          {
            id: 's-saved', name: 'savedService', sub: 'saved items, notes, flashcards', subLod: 2, piece: 'svc:savedService', opens: 'p-notes',
            lines: ['listMySaved, getSavedItem, deleteSavedItem, saveNotes, listFlashcards, createFlashcards, deleteFlashcards, setFlashcardStatus'],
          },
          {
            id: 's-profile', name: 'profileService', sub: '/api/me and my lists', subLod: 2, piece: 'svc:profileService',
            lines: ['getMyProfile, updateMyProfile, deleteMyAccount, listMyReviewers, listMyRecentlyViewed'],
          },
          {
            id: 's-reports', name: 'reportsService', sub: 'reports + admin actions', subLod: 2, piece: 'svc:reportsService', opens: 'p-report',
            lines: ['reportReviewer, listReports, restoreReviewer, updateReviewerCategory, deleteReportedReviewer, fetchReviewerFile, openFileInNewTab'],
          },
        ],
      },
    },
    {
      id: 'apijs', at: [3, 0], span: [1, 2], nudge: [28, -4], size: [240, 236], tag: 'FETCH', treat: 'focal',
      name: 'api.js', sub: 'the only file that calls fetch', piece: 'svc:api', term: 'id-token',
      lines: [{ text: 'Adds the login token to every call', lod: 2 }, { text: 'One error shape for every page', lod: 2 }],
      faceMax: 2,
      kids: {
        cols: 1, h: 32,
        items: [
          { id: 'f-request', name: 'apiRequest', sub: 'JSON calls: method + json', piece: 'fn:api.apiRequest' },
          { id: 'f-blob', name: 'apiRequestBlob', sub: 'a file as a Blob, with login', piece: 'fn:api.apiRequestBlob' },
          { id: 'f-upload', name: 'uploadWithProgress', sub: 'XMLHttpRequest, progress 0-100', piece: 'fn:api.uploadWithProgress', opens: 'p-upload' },
          { id: 'f-error', name: 'buildApiError', sub: 'message, status, fields', piece: 'fn:api.buildApiError' },
          { id: 'f-token', name: 'getToken', sub: 'Bearer from getIdToken()', piece: 'fn:api.getToken', term: 'id-token' },
        ],
      },
    },
    {
      id: 'atlasapi', at: [4, 0], nudge: [96, 48], size: [200, 96], tag: 'API', treat: 'external',
      name: 'Atlas API', sub: 'VITE_API_URL', piece: 'app:backend', opens: 'path', term: 'rest-api',
      lines: ['api.140-245-60-8.sslip.io', 'Answers JSON, or an error object'],
    },
    {
      id: 'authsvc', at: [1, 2], span: [2, 1], nudge: [4, 0], size: [472, 96], tag: 'SIGN-IN',
      name: 'authService', sub: 'everything Firebase sign-in', piece: 'svc:authService', opens: 'p-signin', term: 'firebase-authentication',
      lines: ['register, login, loginWithGoogle, logout, deleteAccount, sendPasswordReset', 'describeAuthError turns Firebase codes into plain sentences', 'Popup blocked: redirect, return path kept in sessionStorage'],
    },
    {
      id: 'firebasejs', at: [3, 2], nudge: [28, 0], size: [240, 96], tag: 'CONFIG',
      name: 'firebase.js', sub: 'sets up Firebase Auth', piece: 'file:firebase.js', term: 'firebase',
      lines: ['Exports auth for authService and api.js', 'Local emulator when VITE_USE_AUTH_EMULATOR'],
    },
    {
      id: 'fbauth', at: [4, 2], nudge: [96, 0], size: [200, 96], tag: 'AUTH', treat: 'external',
      name: 'Firebase Authentication', sub: 'Google’s sign-in service', piece: 'ext:firebase-auth', opens: 'p-signin', term: 'firebase-authentication',
      lines: ['Passwords never reach Atlas'],
    },
    {
      id: 'helpers', at: [1, 3], span: [2, 1], nudge: [4, -12], size: [472, 76], tag: 'HELPERS',
      name: 'Helpers', sub: 'no network calls', piece: 'layer:services',
      kids: {
        cols: 5, h: 32,
        items: [
          { id: 'h-categories', name: 'categories', sub: 'strand lists', piece: 'svc:categories', term: 'strand' },
          { id: 'h-filerules', name: 'fileRules', sub: 'upload checks', piece: 'svc:fileRules' },
          { id: 'h-format', name: 'format', sub: 'sizes, dates', piece: 'svc:format' },
          { id: 'h-notehtml', name: 'noteHtml', sub: 'clean notes', piece: 'svc:noteHtml', opens: 'p-notes' },
          { id: 'h-feed', name: 'feedMemory', sub: 'Back button', piece: 'svc:feedMemory' },
        ],
      },
    },
  ],
  edges: [
    { from: 'callers', to: 'services', label: 'CALL', style: 'muted' },
    { from: 'callers', to: 'authsvc', label: 'LOG IN', style: 'muted' },
    { from: 'callers', to: 'helpers', label: 'USE', dash: true },
    { from: 'services', to: 'apijs', label: 'CALLS', style: 'muted' },
    { from: 'apijs', to: 'atlasapi', label: 'HTTPS + TOKEN', style: 'link' },
    { from: 'apijs', to: 'firebasejs', label: 'ID TOKEN', style: 'muted' },
    { from: 'authsvc', to: 'firebasejs', style: 'muted' },
    { from: 'firebasejs', to: 'fbauth', label: 'SIGN IN', style: 'link' },
    { from: 'authsvc', to: 's-profile', label: 'PROFILE', style: 'muted', lod: 2 },
  ],
  notes: [
    { xy: [1192, 232], w: 200, lod: 3, text: 'Every failure becomes an Error with message, status and fields. Status 0 means no answer at all: “Could not reach Atlas. Check your internet connection and try again.”' },
  ],
});
