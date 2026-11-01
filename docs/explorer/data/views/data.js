// The eight tables of the Atlas database as things and links (an ER diagram).
AX.addView({
  id: 'data',
  parent: 'system',
  group: 'Data',
  related: ['schema-content', 'schema-study', 'db-ops', 'backend'],
  type: 'er',
  title: 'Data model',
  eyebrow: 'DATA MODEL',
  purpose: 'What Atlas stores and how the records point at each other. Every link is a foreign key: one person owns many study reviewers, votes on many, saves many. Zoom in for the fields: # marks a key, → points at another table.',
  desc: 'Entity-relationship diagram of the Atlas database: a User owns many Study reviewers and has many Upvotes, Recently viewed rows, Reports and Saved items; each of those four also points at one Study reviewer (a Saved item may keep pointing at none after the reviewer is deleted). A Saved item has many Flashcards. Rate limit stands alone.',
  piece: 'store:postgres',
  grid: { x: 40, y: 72, col: 176, row: 124, gapX: 104, gapY: 72 },
  nodes: [
    {
      id: 'e-user', shape: 'entity', at: [1, 0], span: [2, 1], size: [208, 124], treat: 'store',
      name: 'User', piece: 'table:users', opens: 'schema-content',
      fields: ['# id', 'firebase_uid (unique)', 'display_name', 'email', 'role: member or admin', { text: 'created_at', lod: 3 }],
    },
    {
      id: 'e-reviewer', shape: 'entity', at: [1, 2], span: [2, 1], size: [208, 160], nudge: [0, 16], treat: 'focal',
      name: 'Study reviewer', piece: 'table:reviewers', opens: 'schema-content', term: 'study-reviewer',
      fields: [
        '# id', '→ author_id', 'title, description', 'strand, grade, quarter', 'subject, material_type, tags', 'file_name, stored_name',
        { text: 'is_hidden (3 open reports)', lod: 3 },
        { text: 'file_hash (SHA-256, unique)', lod: 3 },
        { text: 'created_at, updated_at', lod: 3 },
      ],
    },
    {
      id: 'e-upvote', shape: 'entity', at: [0, 1], treat: 'store',
      name: 'Upvote', piece: 'table:upvotes', opens: 'schema-content', term: 'upvote',
      fields: ['# → reviewer_id', '# → user_id', { text: 'created_at', lod: 3 }],
    },
    {
      id: 'e-viewed', shape: 'entity', at: [1, 1], treat: 'store',
      name: 'Recently viewed', piece: 'table:recently_viewed', opens: 'schema-study',
      fields: ['# → user_id', '# → reviewer_id', 'viewed_at'],
    },
    {
      id: 'e-report', shape: 'entity', at: [2, 1], treat: 'store',
      name: 'Report', piece: 'table:reports', opens: 'schema-content',
      fields: ['# id', '→ reviewer_id', '→ user_id (the reporter)', 'reason', { text: 'details (up to 500)', lod: 3 }, { text: 'resolved_at (empty = open)', lod: 3 }],
    },
    {
      id: 'e-saved', shape: 'entity', at: [3, 1], treat: 'store',
      name: 'Saved item', piece: 'table:saved_items', opens: 'schema-study', term: 'saved-item',
      fields: ['# id', '→ user_id', '→ reviewer_id (or empty)', 'title, subject, strand', 'notes', { text: 'notes_format: text or html', lod: 3 }],
    },
    {
      id: 'e-flashcard', shape: 'entity', at: [4, 1], treat: 'store',
      name: 'Flashcard', piece: 'table:flashcards', opens: 'schema-study', term: 'flashcard',
      fields: ['# id', '→ saved_item_id', 'position', 'front, back', { text: 'status: new, learning, learned', lod: 3 }, { text: 'created_at', lod: 3 }],
    },
    {
      id: 'e-rate', shape: 'entity', at: [4, 2], nudge: [0, 16],
      name: 'Rate limit', piece: 'table:rate_limits', opens: 'l-rate', term: 'rate-limit',
      fields: ['# key (which limit, who)', 'hits', 'reset_at (with time zone)'],
    },
  ],
  edges: [
    { from: 'e-user', to: 'e-reviewer', label: 'OWNS', ends: ['1', 'N'], style: 'accent' },
    { from: 'e-user', to: 'e-upvote', label: 'VOTES', ends: ['1', 'N'] },
    { from: 'e-user', to: 'e-viewed', label: 'VIEWED', ends: ['1', 'N'] },
    { from: 'e-user', to: 'e-report', label: 'REPORTS', ends: ['1', 'N'] },
    { from: 'e-user', to: 'e-saved', label: 'SAVES', ends: ['1', 'N'] },
    { from: 'e-reviewer', to: 'e-upvote', ends: ['1', 'N'] },
    { from: 'e-reviewer', to: 'e-viewed', ends: ['1', 'N'] },
    { from: 'e-reviewer', to: 'e-report', ends: ['1', 'N'] },
    { from: 'e-reviewer', to: 'e-saved', ends: ['0..1', 'N'], dash: true },
    { from: 'e-saved', to: 'e-flashcard', label: 'HAS', ends: ['1', 'N'] },
  ],
  notes: [
    { xy: [1160, 616], w: 176, lod: 1, text: 'Stands alone: no links to the other tables.' },
  ],
});
