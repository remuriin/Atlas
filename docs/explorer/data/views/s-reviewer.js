// State diagram: the life of one study reviewer, from upload to deletion
// (reviewersController.js, adminController.js, reviewerAccess.js, db/schema.sql).
AX.addView({
  id: 's-reviewer',
  parent: 'logic',
  group: 'Logic',
  related: ['p-report', 'f-file', 'l-search', 'p-upload'],
  type: 'state',
  title: 'Life of a study reviewer',
  eyebrow: 'STATE MACHINE',
  purpose: 'A study reviewer is visible from the moment it is uploaded. The third open report hides it until an admin restores it or fixes its category, and any delete ends its life; saved copies outlive it.',
  desc: 'State diagram of a study reviewer: an upload makes it Visible; editing or replacing the file keeps it Visible; the third open report makes it Hidden; an admin Restore or Fix category makes it Visible again; a delete by the uploader, an admin or an account deletion moves it from Visible or Hidden to Deleted, while saved copies stay with reviewer_id NULL.',
  piece: 'table:reviewers',
  grid: { x: 40, y: 72, col: 200, row: 104, gapX: 120, gapY: 72 },
  // room under the bottom notes, so the legend never touches them
  size: [1240, 496],
  nodes: [
    {
      id: 'start', at: [0, 1], size: [16, 16], shape: 'dot', nudge: [112, 0],
      name: 'Uploaded', piece: 'ep:post-reviewers', opens: 'p-upload',
    },
    {
      id: 'visible', at: [1, 1], size: [200, 104], shape: 'state', treat: 'focal',
      name: 'Visible', sub: 'is_hidden = false',
      piece: 'col:reviewers.is_hidden', opens: 'f-file', term: 'study-reviewer',
      lines: ['Anyone can open it and its file', 'In the feed and in search results', '1 or 2 open reports change nothing', 'Admin restore or fix closes them'],
    },
    {
      id: 'hidden', at: [2, 1], size: [200, 104], shape: 'state',
      name: 'Hidden', sub: 'is_hidden = true',
      piece: 'mw:hideIfHidden', opens: 'p-report', term: 'hidden-reviewer',
      lines: ['404 for all but uploader + admins', 'Not in the feed or search', 'Waits on the admin Reports page', 'Savers keep it; its file won’t load'],
    },
    {
      id: 'deleted', at: [3, 1], size: [168, 56], shape: 'oval',
      name: 'Deleted', sub: 'row first, then the file',
      piece: 'fn:reviewersModel.deleteReviewer', opens: 'f-file', term: 'on-delete-cascade',
    },
  ],
  edges: [
    { from: 'start', to: 'visible', label: 'UPLOADED', style: 'accent' },
    { from: 'visible:top', to: 'visible:top', label: 'EDIT, NEW FILE', outY: 200, labelLeft: true },
    { from: 'visible:top', to: 'deleted:top', label: 'DELETE', outY: 160 },
    { from: 'visible', to: 'hidden', label: '3 OPEN REPORTS', piece: 'table:reports' },
    { from: 'hidden:bottom', to: 'visible:bottom', label: 'RESTORE OR FIX', outY: 392 },
    { from: 'hidden', to: 'deleted', label: 'DELETE' },
  ],
  notes: [
    { xy: [680, 96], w: 200, lod: 2, text: 'Hidden only at the 3rd open report, which always comes from 3 different people. Only an admin shows it again.' },
    { xy: [360, 424], w: 200, lod: 2, text: 'Editing it, or replacing its file, keeps its state: a hidden one stays hidden.' },
    { xy: [680, 424], w: 200, lod: 3, text: 'Restore and Fix category close every open report; it hides again only after 3 new ones.' },
    { xy: [1000, 360], w: 200, lod: 2, text: 'Deleted by its uploader, an admin, or with the uploader’s account; upvotes, views and reports go too.' },
    { xy: [1000, 412], w: 200, lod: 2, text: 'Saved copies stay with reviewer_id NULL: their notes and flashcards are kept.' },
  ],
});
