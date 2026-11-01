// Hand-written words for the diagrams the build draws on its own (lib/generated-views.js).
// "checks": what the endpoint diagrams (ep.*) say about each check in a route's chain: the
// question it answers, the replies it sends instead of letting the request through (from
// backend/src/middleware), and a few details. The chains themselves are read from the
// routers by lib/extract.js. "related" and "pages": the bigger diagrams an endpoint or a
// page (page.*) belongs to.
module.exports = {
  checks: {
    optionalAuth: {
      ask: 'Who is asking?', piece: 'mw:optionalAuth', term: 'id-token', exits: [],
      lines: ['A valid token adds the user', 'Anything else: a visitor'],
    },
    requireAuth: {
      ask: 'Logged in?', piece: 'mw:requireAuth', term: 'id-token',
      exits: [['401', 'not logged in or session expired']],
      lines: ['Checks the Firebase ID token', 'Adds the users row on first use'],
    },
    requireAdmin: {
      ask: 'An admin?', piece: 'mw:requireAdmin', term: 'admin',
      exits: [['403', 'only admins']],
      lines: ['users.role must be admin'],
    },
    writeLimiter: {
      ask: 'Under the change limit?', piece: 'mw:writeLimiter', term: 'rate-limit',
      exits: [['429', 'too many changes']],
      lines: ['120 per 15 min per IP', 'Counted in Postgres'],
    },
    studyLimiter: {
      ask: 'Under the study limit?', piece: 'mw:studyLimiter', term: 'rate-limit',
      exits: [['429', 'saving too quickly']],
      lines: ['600 per 15 min per IP', 'Counted in memory'],
    },
    flashcardLimiter: {
      ask: 'Flashcards left today?', piece: 'mw:flashcardLimiter', term: 'rate-limit',
      exits: [['429', '10 sets a day used']],
      lines: ['10 per 24 h per account', 'Failed tries are given back'],
    },
    askLimiter: {
      ask: 'Questions left?', piece: 'mw:askLimiter', term: 'rate-limit',
      exits: [['429', '30 in 15 min used']],
      lines: ['30 per 15 min per IP'],
    },
    loadReviewer: {
      ask: 'Reviewer exists?', piece: 'mw:loadReviewer', term: 'study-reviewer',
      exits: [['400', 'bad id'], ['404', 'not found']],
      lines: ['Reads the reviewers row'],
    },
    hideIfHidden: {
      ask: 'Visible to you?', piece: 'mw:hideIfHidden', term: 'hidden-reviewer',
      exits: [['404', 'hidden by reports']],
      lines: ['Owner and admins still see it'],
    },
    requireOwner: {
      ask: 'Your upload?', piece: 'mw:requireOwner', exits: [['403', 'only the uploader']],
      lines: ['author_id must be you'],
    },
    checkUploadQuota: {
      ask: 'Under 50 uploads?', piece: 'mw:checkUploadQuota', exits: [['403', 'upload limit reached']],
      lines: ['MAX_UPLOADS_PER_USER, default 50', 'Checked before the file arrives'],
    },
    'upload.single': {
      ask: 'Allowed type and size?', piece: 'mwfile:upload', term: 'multer',
      exits: [['415', 'type not allowed'], ['413', 'over 10 MB']],
      lines: ['Extension and MIME on the allowlist', 'Saved under a random hex name'],
    },
    checkUpload: {
      ask: 'File safe inside?', piece: 'mw:checkUpload', term: 'magic-bytes',
      exits: [['415', 'content refused'], ['422', 'virus found'], ['503', 'scanner down']],
      lines: ['Signature, macros, PDF scripts', 'Virus scan when it is on'],
    },
    loadSavedItem: {
      ask: 'Your saved item?', piece: 'mw:loadSavedItem', term: 'saved-item',
      exits: [['400', 'bad id'], ['404', 'not found or not yours']],
      lines: ['Reads the saved_items row'],
    },
  },
  related: {
    'ep:get-reviewers': ['l-search'],
    'ep:get-reviewers-id-file': ['f-file'],
    'ep:post-reviewers': ['p-upload', 'l-upload-checks'],
    'ep:put-reviewers-id': ['p-upload', 'l-upload-checks'],
    'ep:delete-reviewers-id': ['f-file', 's-reviewer'],
    'ep:post-reviewers-id-report': ['p-report', 's-reviewer'],
    'ep:get-me': ['p-signin'],
    'ep:delete-me': ['p-delete-account', 'f-personal'],
    'ep:put-saved-savedId-notes': ['p-notes'],
    'ep:post-saved-savedId-flashcards': ['p-flashcards', 'l-flashcards'],
    'ep:get-admin-reports': ['p-report'],
    'ep:post-admin-reviewers-id-restore': ['p-report', 's-reviewer'],
    'ep:put-admin-reviewers-id-category': ['p-report', 's-reviewer'],
    'ep:delete-admin-reviewers-id': ['p-report', 's-reviewer'],
    'ep:post-ask': ['f-docs'],
  },
  pages: {
    HomePage: ['l-search'],
    LoginPage: ['p-signin'],
    RegisterPage: ['p-signin'],
    ReviewerPage: ['p-report', 'f-file'],
    UploadPage: ['p-upload', 'l-upload-checks'],
    EditReviewerPage: ['p-upload'],
    StudyPage: ['p-flashcards', 'p-notes'],
    SavedPage: ['f-personal'],
    ProfilePage: ['p-delete-account', 'f-personal'],
    AdminPage: ['p-report', 's-reviewer'],
  },
};
