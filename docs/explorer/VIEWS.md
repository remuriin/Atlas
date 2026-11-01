# Writing a diagram for the Atlas Explorer

Each diagram is one file in `docs/explorer/data/views/<id>.js` that calls `AX.addView({...})`.
The engine (`docs/explorer/core/scene.js`, `route.js`, `draw.js`) lays it out, routes the
connectors and draws it. Look at `views/system.js` for a complete example.

## Check your work

- `node docs/preview-view.js <id>` prints every layout problem and writes
  `docs/dist/preview/<id>-lod1.html`, `-lod2.html`, `-lod3.html` (one page per detail level).
- Screenshot one with Edge, for example:
  `"/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1.5 --window-size=1600,1000 --screenshot="C:/.../docs/dist/preview/<id>-1.png" "file:///C:/.../docs/dist/preview/<id>-lod1.html"`
  then look at the PNG. Fix overlaps, cramped text and crossing lines.
- `node docs/build-explorer.js` builds the whole page and lists every error. A view must have
  zero problems.
- `docs/dist/pieces-index.txt` lists every part id you can point at (after one build).

## The rules (from the diagram-design skill)

- At detail level 1 (zoomed out): at most 9 boxes and 12 connectors. More detail goes to level
  2 and 3 (`lod: 2`, `lod: 3`) or into the boxes of a container (`kids`).
- At most 2 `treat: 'focal'` boxes per diagram (green): the one or two things that matter most.
- Connector labels: 14 characters at most, UPPERCASE, only when the line is not obvious.
- Every box should do something when clicked: `opens: '<view id>'` (another diagram) and/or
  `piece: '<part id>'` (its detail sheet). Use real ids from `pieces-index.txt`, or one of the
  view ids in the plan. Give boxes a glossary `term` key where a term fits (see below).
- Facts must be true: read the code in `backend/` and `frontend/` and the docs in
  `docs/knowledge/` before writing a sublabel or a detail line.
- Plain words first: names a student understands ("Check the file"), technical names in
  `sub` and `lines` (`checkUpload.js`, `415`).

## Spec fields

```js
AX.addView({
  id: 'p-upload',                 // unique, used in links: #/v/p-upload
  parent: 'processes',            // the view above this one (the root track uses it)
  group: 'Processes',             // Explore menu group
  type: 'process',                // architecture | deployment | sequence | process | data-flow
                                  // | flowchart | er | db-schema | state | layers | nested
  engine: 'lanes',                // placed (default) | seq | lanes
  title: 'Sharing a study reviewer',
  eyebrow: 'PROCESS',             // shown above the title, also in the Explore menu
  purpose: 'One or two plain sentences: what this diagram shows and why it matters.',
  desc: 'One sentence for screen readers describing the content.',
  piece: 'app:backend',           // optional: the part "About this part" opens
  related: ['l-upload-checks'],   // optional: up to 4 related views shown as buttons
  ...engine fields below
});
```

### placed engine (architecture, deployment, nested, flowchart, ER, schema, state, layers)

```js
grid: { x: 40, y: 72, col: 200, row: 96, gapX: 96, gapY: 48 },   // all multiples of 4
zones: [ { id, label: 'UPPERCASE', around: ['nodeId', ...], pad: 20, opens, piece, term, dash } ],
nodes: [
  { id, at: [col, row], span: [cols, rows], size: [w, h], nudge: [dx, dy],
    shape: 'box' | 'oval' | 'diamond' | 'dot' | 'state' | 'table' | 'entity',
    treat: 'focal' | 'backend' | 'store' | 'external' | 'input' | 'optional' | 'security',
    tag: 'API', name: 'Atlas API', sub: 'Express 5', subLod: 2,
    lines: ['detail line', { text: 'only at level 2', lod: 2 }],   // default level 3
    lod: 1, max: 0, opens, piece, term,
    kids: { cols: 1, h: 32, hint: 'Zoom in to look inside', items: [ { id, name, sub, piece, opens, term, lines } ] },
  },
  // database table (shape 'table'): rows are columns; FK connectors go row to row
  { id: 'users', shape: 'table', name: 'users', at: [0, 0], size: [232, 236], focalHeader: false,
    rows: [ { name: 'id', type: 'serial', chips: ['PK'], piece: 'col:users.id' } ], show: 8,
    indexes: ['idx_x (col)'] },
  // ER entity (shape 'entity'): fields appear at level 2
  { id: 'e-user', shape: 'entity', name: 'User', at: [0, 0], size: [180, 120],
    fields: ['# id', 'firebase uid', { text: 'role', lod: 3 }] },
],
edges: [
  { from: 'a', to: 'b', label: 'SQL', style: 'muted' | 'link' | 'accent', dash: true,
    lod: 2, max: 1, via: [[x, y], ...], midX: 400, midY: 300, labelBelow, labelLeft,
    ends: ['1', 'N'],          // ER cardinality marks
    transit: true },          // only when a line truly must pass behind a box (then dash it)
  // table rows: from: 'reviewers.author_id', to: 'users.id', label: 'ON DELETE CASCADE'
  // force a side: from: 'api:left', to: 'auth:right'
],
notes: [ { at: [col, row], text: 'short editorial note', w: 180, lod: 2 } ],
```

Boxes default to the size of their grid cell and are centred in it. A container (`kids`)
shows one box at level 1 and opens into a frame with its parts at level 2.

More fields, for when the grid is not enough:

- `box: [x, y, w, h]` on a node or on a container's part places it exactly (all multiples of 4).
- `faceMax: 2` on a container keeps its closed face up to level 2; the parts then show at level 3.
- `kids.label` names the open frame (default: the name in capitals); `kids.hint` replaces
  "Zoom in to look inside".
- `xy: [x, y]` on a note places it exactly instead of in a grid cell.
- `treat: 'stop'` (dotted outline, legend "Refused: the request ends") is for the replies that end
  a request early, such as 401 or 429. `treat: 'optional'` means planned or optional, so use it
  only for things that are not running yet or may be left out.

### seq engine (sequence diagrams)

```js
engine: 'seq', gapX: 200, step: 44,
actors: [ { id, name, tag, treat, sub, piece, opens, term } ],      // 2 to 6 actors
msgs: [ { from, to, label: 'POST /API/ME', dash: true /* reply */, accent: true, link: true,
          note: 'side note', lod: 1 } ],                               // up to ~14 messages
frags: [ { label: 'ALT [POPUP BLOCKED]', from: 3, to: 5, extra: 40 } ], // message index range;
                                                                       // extra widens the box
```

### lanes engine (process and data-flow)

```js
engine: 'lanes', laneH: 112, nodeH: 76,
lanes: [ { id, name: 'Student' } ],                     // up to 6
steps: [ { label: 'Choose', focal: false } ],           // up to 6-8 columns
nodes: [ { id, lane, step: 0, name, sub, tag, treat, lines, piece, opens, term } ],
edges: [ { from, to, label, style, dash } ],
```

## Diagrams the build draws itself

One diagram per API endpoint (`ep.<method>-<path>`, for example `ep.post-reviewers`) and one per
page (`page.<Page>`, for example `page.StudyPage`) are drawn by `docs/lib/generated-views.js` from
the code, so they never go out of date. Their words come from `explorer/data/generated.js` (each
check's question and refusal codes) and from the endpoint sections of
`knowledge/api-endpoints.md`. Point at them with `opens: 'ep.post-reviewers'`; preview them like
any other diagram with `node docs/preview-view.js ep.post-reviewers`.

## Glossary term keys

A `term` is the glossary heading turned into a slug: lowercase, spaces to hyphens, other
punctuation removed. Examples: `firebase-authentication`, `id-token`, `rest-api`, `middleware`,
`magic-bytes`, `sha-256-hash`, `rate-limit`, `postgresql`, `foreign-key`, `on-delete-cascade`,
`envoy-gateway`, `cert-manager`, `pm2`, `vps`, `k3s`, `gemini`, `flashcard`, `study-reviewer`,
`hidden-reviewer`, `saved-item`, `upvote`, `strand`, `rag`, `embedding`, `chunk`, `rem-raas`.
The full list of names is in `docs/knowledge/glossary.md`; the build warns about keys that do
not exist.
