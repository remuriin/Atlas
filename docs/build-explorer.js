// Builds the Atlas Explorer: one standalone HTML file with every diagram, the docs,
// the glossary, the fonts and the Rem chat inside it.
//
//   node docs/build-explorer.js              -> docs/dist/atlas-explorer.html
//   node docs/build-explorer.js --private    -> also docs/dist/atlas-explorer-private.html
//                                               (adds docs/private/*.md, never for sharing)
//   node docs/build-explorer.js --snapshots  -> also one static page per diagram and zoom
//                                               level in docs/dist/snapshots (for self_check.py)
//   node docs/build-explorer.js --no-chat    -> leaves the chat out
//
// The chat asks the Atlas API (POST /api/ask), which passes the question on to Rem with a
// key that stays on the server. The page holds no secret, so it can be shared freely.
// The API address is VITE_API_URL from frontend/.env.production, or ATLAS_API_URL in docs/.env.
const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');
const loadCore = require('./lib/load-core');
const knowledge = require('./lib/knowledge');
const htmlOut = require('./lib/html-out');
const safety = require('./lib/safety');
const theme = require('./lib/theme');
const extract = require('./lib/extract');
const generatedViews = require('./lib/generated-views');
const snapshot = require('./lib/snapshot');
const envFile = require('./lib/env-file');

const DOCS = __dirname;
const ROOT = path.join(DOCS, '..');
const EXPLORER = path.join(DOCS, 'explorer');
const DIST = path.join(DOCS, 'dist');
const KNOWLEDGE = path.join(DOCS, 'knowledge');
const PRIVATE = path.join(DOCS, 'private');

const args = process.argv.slice(2);
const wantsPrivate = args.indexOf('--private') !== -1;
const wantsSnapshots = args.indexOf('--snapshots') !== -1;
const noChat = args.indexOf('--no-chat') !== -1;

const UI_FILES = [
  'dom.js', 'store.js', 'camera.js', 'router.js', 'shell.js', 'outline.js', 'canvas.js', 'sheet.js',
  'tip.js', 'reader.js', 'glossary.js', 'hub.js', 'chat.js', 'find-ui.js', 'keys.js', 'boot.js',
];
const STYLE_FILES = ['roles.css', 'canvas.css', 'shell.css'];

const errors = [];
const warnings = [];

function fail(message) {
  errors.push(message);
}

function warn(message) {
  warnings.push(message);
}

// ---------- the chat setting ----------

function chatConfig() {
  if (noChat) {
    return null;
  }
  const settings = envFile.read(path.join(DOCS, '.env'));
  const site = envFile.read(path.join(ROOT, 'frontend', '.env.production'));
  const url = (settings.ATLAS_API_URL || site.VITE_API_URL || '').replace(/\/+$/, '');
  if (url === '') {
    warn('no Atlas API address (VITE_API_URL in frontend/.env.production): the chat is off in this build');
    return null;
  }
  if (!/^https?:\/\/[^/]+$/.test(url)) {
    fail('the Atlas API address must look like https://api.example.com, not ' + url);
  }
  return { url: url };
}

// ---------- docs and glossary ----------

function loadDocs(AX, terms, termSkip, includePrivate) {
  const lint = knowledge.lint(KNOWLEDGE);
  for (let i = 0; i < lint.errors.length; i++) {
    fail(lint.errors[i]);
  }
  for (let i = 0; i < lint.warnings.length; i++) {
    warn(lint.warnings[i]);
  }
  const groups = require('./explorer/data/docs-index');
  const listed = {};
  for (let g = 0; g < groups.length; g++) {
    for (let s = 0; s < groups[g].stems.length; s++) {
      if (listed[groups[g].stems[s]]) {
        fail('explorer/data/docs-index.js lists ' + groups[g].stems[s] + ' twice');
      }
      listed[groups[g].stems[s]] = groups[g].title;
    }
  }
  const termList = [];
  const keys = Object.keys(terms);
  for (let k = 0; k < keys.length; k++) {
    termList.push({ key: keys[k], term: terms[keys[k]].term, aliases: terms[keys[k]].aliases });
  }
  const matcher = AX.terms.buildMatcher(termList, termSkip);
  const extra = safety.privateStrings(DOCS);
  const docs = [];
  for (let i = 0; i < lint.files.length; i++) {
    const name = lint.files[i];
    const stem = name.replace(/\.md$/, '');
    if (!listed[stem]) {
      fail('docs/knowledge/' + name + ' is not listed in explorer/data/docs-index.js');
    }
    const text = knowledge.readFile(KNOWLEDGE, name);
    const problems = safety.scan(text, 'docs/knowledge/' + name, extra);
    for (let p = 0; p < problems.length; p++) {
      fail(problems[p]);
    }
    const out = htmlOut.docToHtml(AX, { stem: stem, text: text, group: listed[stem] || 'Docs' }, matcher, false);
    docs.push({ stem: stem, title: out.title, group: listed[stem] || 'Docs', html: out.html, outline: out.outline, intro: out.intro });
  }
  const stems = Object.keys(listed);
  for (let s = 0; s < stems.length; s++) {
    if (lint.files.indexOf(stems[s] + '.md') === -1) {
      fail('explorer/data/docs-index.js lists ' + stems[s] + ', but docs/knowledge/' + stems[s] + '.md does not exist');
    }
  }
  const docGroups = groups.map(function (group) {
    return { title: group.title, stems: group.stems.slice() };
  });
  if (includePrivate && fs.existsSync(PRIVATE)) {
    const privateFiles = knowledge.listFiles(PRIVATE);
    const privateStems = [];
    for (let i = 0; i < privateFiles.length; i++) {
      const stem = 'private-' + privateFiles[i].replace(/\.md$/, '');
      const text = knowledge.readFile(PRIVATE, privateFiles[i]);
      const out = htmlOut.docToHtml(AX, { stem: stem, text: text, group: 'Private' }, matcher, true);
      docs.push({ stem: stem, title: out.title, group: 'Private', html: out.html, outline: out.outline, intro: out.intro });
      privateStems.push(stem);
    }
    if (privateStems.length > 0) {
      docGroups.push({ title: 'Private (not known to Rem)', stems: privateStems });
    }
  }
  return { docs: docs, docGroups: docGroups };
}

// Finds doc sections whose heading names a piece (for "Read more").
function docRefs(docs, name, limit) {
  const out = [];
  if (!name || name.length < 3) {
    return out;
  }
  const pattern = new RegExp('(^|[^\\w])' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^\\w])');
  for (let d = 0; d < docs.length && out.length < limit; d++) {
    for (let o = 0; o < docs[d].outline.length && out.length < limit; o++) {
      if (pattern.test(docs[d].outline[o].text)) {
        out.push({ file: docs[d].stem, slug: docs[d].outline[o].id, title: docs[d].title + ' › ' + docs[d].outline[o].text });
      }
    }
  }
  return out;
}

function docLinksFromStems(docs, stems) {
  const out = [];
  for (let i = 0; i < stems.length; i++) {
    const parts = stems[i].split('#');
    for (let d = 0; d < docs.length; d++) {
      if (docs[d].stem === parts[0]) {
        let title = docs[d].title;
        if (parts[1]) {
          for (let o = 0; o < docs[d].outline.length; o++) {
            if (docs[d].outline[o].id === parts[1]) {
              title += ' › ' + docs[d].outline[o].text;
            }
          }
        }
        out.push({ file: parts[0], slug: parts[1] || '', title: title });
      }
    }
  }
  return out;
}

// ---------- pieces (everything clickable) ----------

function buildPieces(facts, docs) {
  const pieces = {};
  const byPath = {};
  function add(piece) {
    if (pieces[piece.id]) {
      // later entries (hand data) add to earlier ones
      const old = pieces[piece.id];
      const names = Object.keys(piece);
      for (let i = 0; i < names.length; i++) {
        if (Array.isArray(piece[names[i]]) && Array.isArray(old[names[i]])) {
          old[names[i]] = old[names[i]].concat(piece[names[i]]);
        } else if (piece[names[i]] !== undefined && piece[names[i]] !== '') {
          old[names[i]] = piece[names[i]];
        }
      }
      return;
    }
    pieces[piece.id] = Object.assign({ uses: [], usedBy: [], facts: [], docs: [], appearsIn: [] }, piece);
  }
  // source files
  for (let i = 0; i < facts.files.length; i++) {
    const file = facts.files[i];
    byPath[file.rel] = file.id;
    add({
      id: file.id, kind: file.kind, name: file.name, title: file.name.replace(/\.(jsx|js)$/, ''),
      header: file.header, path: file.rel, facts: [['File', '`' + file.rel + '`'], ['Lines', file.lines]],
    });
  }
  for (let i = 0; i < facts.files.length; i++) {
    const file = facts.files[i];
    for (let m = 0; m < file.imports.length; m++) {
      const target = byPath[file.imports[m]];
      if (target && target !== file.id) {
        pieces[file.id].uses.push(target);
        pieces[target].usedBy.push(file.id);
      }
    }
  }
  // functions in models, controllers, middleware and frontend services
  for (let i = 0; i < facts.functions.length; i++) {
    const fn = facts.functions[i];
    let id = fn.id;
    let kind = 'fn';
    if (fn.kind === 'mw') {
      id = 'mw:' + fn.name;
      kind = 'mw';
    } else if (fn.kind === 'mfile') {
      kind = 'model';
    } else if (fn.kind === 'ctl') {
      kind = 'handler';
    }
    add({
      id: id, kind: kind, name: fn.name, title: fn.name, plain: fn.comment,
      path: fn.file + '#L' + fn.line, facts: [['In', '`' + fn.file + '`']],
    });
    pieces[fn.fileId].uses.push(id);
    pieces[id].usedBy.push(fn.fileId);
  }
  // endpoints, with the success reply their handler sends
  const replies = {};
  for (let i = 0; i < facts.functions.length; i++) {
    if (facts.functions[i].reply) {
      replies[facts.functions[i].id] = facts.functions[i].reply;
    }
  }
  const endpointRows = [];
  for (let i = 0; i < facts.endpoints.length; i++) {
    const ep = facts.endpoints[i];
    const handler = pieces[ep.handlerFn];
    const uses = [];
    for (let c = 0; c < ep.chain.length; c++) {
      if (pieces['mw:' + ep.chain[c]]) {
        uses.push('mw:' + ep.chain[c]);
      }
    }
    if (handler) {
      uses.push(ep.handlerFn);
    }
    add({
      id: ep.id, kind: 'ep', name: ep.method + ' ' + ep.path, title: ep.method + ' ' + ep.path,
      plain: handler && handler.plain ? handler.plain : '', path: ep.file,
      facts: [['Who can call it', ep.who], ['Checks, in order', ep.chain.length ? ep.chain.join(' → ') : 'none'], ['Handler', '`' + ep.handler + '`']].concat(
        replies[ep.handlerFn] ? [['Reply', replies[ep.handlerFn].status + ', `' + replies[ep.handlerFn].body + '`']] : []
      ),
      uses: uses, opens: 'ep.' + ep.id.replace(/^ep:/, ''),
    });
    for (let u = 0; u < uses.length; u++) {
      if (pieces[uses[u]]) {
        pieces[uses[u]].usedBy.push(ep.id);
      }
    }
    endpointRows.push({
      id: ep.id, method: ep.method, path: ep.path, who: ep.who, chain: ep.chain,
      summary: handler && handler.plain ? handler.plain : '', view: 'ep.' + ep.id.replace(/^ep:/, ''),
    });
  }
  // tables, columns and indexes
  const order = facts.schema.order;
  for (let t = 0; t < order.length; t++) {
    const table = facts.schema.tables[order[t]];
    const columnIds = [];
    for (let c = 0; c < table.columns.length; c++) {
      const col = table.columns[c];
      const colFacts = [['Type', '`' + col.type + '`']];
      if (col.chips.length > 0) {
        colFacts.push(['Rules', col.chips.join(', ')]);
      }
      if (col.references) {
        colFacts.push(['Points at', '`' + col.references.table + '.' + col.references.column + '`, ON DELETE ' + col.references.onDelete]);
      }
      if (col.default) {
        colFacts.push(['Default', '`' + col.default + '`']);
      }
      if (col.check) {
        colFacts.push(['Check', '`' + col.check + '`']);
      }
      const colId = 'col:' + table.name + '.' + col.name;
      columnIds.push(colId);
      add({ id: colId, kind: 'col', name: table.name + '.' + col.name, title: col.name, path: 'backend/db/schema.sql', facts: colFacts, uses: col.references ? ['table:' + col.references.table] : [] });
    }
    const indexIds = [];
    for (let x = 0; x < table.indexes.length; x++) {
      const index = table.indexes[x];
      const indexId = 'idx:' + index.name;
      indexIds.push(indexId);
      add({
        id: indexId, kind: 'idx', name: index.name, path: 'backend/db/schema.sql',
        facts: [['Table', table.name], ['Columns', '`' + index.columns + '`'], ['Unique', index.unique ? 'yes' : 'no']].concat(index.where ? [['Only rows', '`' + index.where + '`']] : []),
      });
    }
    add({
      id: 'table:' + table.name, kind: 'table', name: table.name, plain: table.note, path: 'backend/db/schema.sql',
      facts: [['Columns', table.columns.length], ['Indexes', table.indexes.length]].concat(table.constraints.map(function (rule) {
        return ['Table rule', '`' + rule + '`'];
      })),
      uses: columnIds.concat(indexIds), opens: 'data',
    });
  }
  // settings
  for (let e = 0; e < facts.env.length; e++) {
    const setting = facts.env[e];
    add({
      id: 'env:' + setting.name, kind: 'env', name: setting.name, plain: setting.note,
      path: setting.side + '/.env.example',
      facts: [['Where', setting.side === 'backend' ? 'Server (`backend/.env`), never public' : 'Website build (`frontend/.env`), public by design']],
    });
  }
  // frontend routes
  for (let r = 0; r < facts.routes.length; r++) {
    const route = facts.routes[r];
    const page = pieces['page:' + route.page];
    if (page) {
      page.facts.unshift(['Address', '`' + route.path + '`'], ['Login needed', route.protected ? 'yes' : 'no']);
    }
  }
  // what each function calls (model functions, tables, utils, endpoints), and the service
  // functions and endpoints each page or component uses
  function link(from, targets) {
    for (let t = 0; t < targets.length; t++) {
      if (pieces[from] && pieces[targets[t]] && targets[t] !== from) {
        pieces[from].uses.push(targets[t]);
        pieces[targets[t]].usedBy.push(from);
      }
    }
  }
  for (let i = 0; i < facts.functions.length; i++) {
    const fn = facts.functions[i];
    link(fn.kind === 'mw' ? 'mw:' + fn.name : fn.id, fn.calls);
  }
  for (let i = 0; i < facts.files.length; i++) {
    link(facts.files[i].id, facts.files[i].fnImports.concat(facts.files[i].apiCalls));
  }
  // hand-written parts and enrichment (their ids are remembered for the safety scan)
  const handIds = [];
  const handDir = path.join(EXPLORER, 'data', 'pieces');
  const handFiles = fs.readdirSync(handDir).filter(function (name) {
    return name.endsWith('.js');
  }).sort();
  for (let h = 0; h < handFiles.length; h++) {
    const list = require(path.join(handDir, handFiles[h]));
    for (let i = 0; i < list.length; i++) {
      const entry = Object.assign({}, list[i]);
      handIds.push(entry.id);
      if (entry.docs) {
        entry.docs = docLinksFromStems(docs, entry.docs);
      }
      add(entry);
    }
  }
  // each endpoint's checks again, in chain order, now that hand-written middleware (the
  // rate limiters) exists too; unique() below drops the repeats
  for (let i = 0; i < facts.endpoints.length; i++) {
    const ep = facts.endpoints[i];
    const ordered = [];
    for (let c = 0; c < ep.chain.length; c++) {
      const id = 'mw:' + ep.chain[c];
      if (pieces[id]) {
        ordered.push(id);
        pieces[id].usedBy.push(ep.id);
      }
    }
    pieces[ep.id].uses = ordered.concat(pieces[ep.id].uses);
  }
  // "Read more": doc sections that name the piece, when none were given by hand
  const ids = Object.keys(pieces);
  for (let i = 0; i < ids.length; i++) {
    const piece = pieces[ids[i]];
    if (piece.docs.length === 0) {
      piece.docs = docRefs(docs, piece.kind === 'col' || piece.kind === 'ep' ? piece.name : (piece.title || piece.name), 3);
    }
    piece.uses = unique(piece.uses);
    piece.usedBy = unique(piece.usedBy);
  }
  return { pieces: pieces, endpoints: endpointRows, handIds: handIds };
}

function unique(list) {
  return list.filter(function (value, index) {
    return list.indexOf(value) === index;
  });
}

// ---------- diagrams ----------

function checkViews(AX, pieces, terms) {
  const ids = AX.viewOrder;
  for (let i = 0; i < ids.length; i++) {
    const spec = AX.views[ids[i]];
    if (spec.parent && !AX.views[spec.parent]) {
      fail('view ' + spec.id + ': parent "' + spec.parent + '" does not exist');
    }
    if (spec.type === 'hub' || spec.type === 'catalogue') {
      continue;
    }
    let scene;
    try {
      scene = AX.buildScene(spec);
    } catch (err) {
      fail('view ' + spec.id + ': could not be drawn (' + err.message + ')');
      continue;
    }
    for (let p = 0; p < scene.problems.length; p++) {
      fail('view ' + scene.problems[p]);
    }
    let focal = 0;
    for (let n = 0; n < scene.items.length; n++) {
      const item = scene.items[n];
      if (item.k === 'node' && item.treat === 'focal') {
        focal += 1;
      }
      if ((item.k === 'node' || item.k === 'zone' || item.k === 'frame') && item.piece) {
        if (!pieces[item.piece]) {
          warn('view ' + spec.id + ': "' + (item.name || item.label) + '" points at part ' + item.piece + ', which does not exist yet');
        } else {
          pieces[item.piece].appearsIn.push({ view: spec.id, node: item.id || '' });
        }
      }
      if (item.term && !terms[item.term]) {
        warn('view ' + spec.id + ': term "' + item.term + '" is not in glossary.md');
      }
      if (item.opens && !AX.views[item.opens]) {
        warn('view ' + spec.id + ': "' + (item.name || item.label) + '" opens ' + item.opens + ', which does not exist yet');
      }
    }
    if (focal > 2) {
      fail('view ' + spec.id + ': ' + focal + ' focal boxes (the rule is at most 2)');
    }
  }
  // every piece's home: the first diagram it appears in
  const pieceIds = Object.keys(pieces);
  for (let i = 0; i < pieceIds.length; i++) {
    const piece = pieces[pieceIds[i]];
    if (piece.appearsIn.length > 0) {
      piece.home = piece.appearsIn[0].view;
      piece.node = piece.appearsIn[0].node;
    }
  }
  // every term's diagram: the first box that carries it
  for (let i = 0; i < ids.length; i++) {
    const spec = AX.views[ids[i]];
    const all = (spec.nodes || []).concat(spec.actors || []);
    for (let n = 0; n < all.length; n++) {
      const node = all[n];
      const kids = node.kids ? node.kids.items : [];
      const list = [node].concat(kids);
      for (let k = 0; k < list.length; k++) {
        if (list[k].term && terms[list[k].term] && !terms[list[k].term].view) {
          terms[list[k].term].view = spec.id;
          terms[list[k].term].node = list[k].id;
        }
      }
    }
  }
}

// ---------- assembling the page ----------

function fontFace(family, file) {
  const data = fs.readFileSync(file).toString('base64');
  return '@font-face {\n  font-family: "' + family + '";\n  font-style: normal;\n  font-display: swap;\n  font-weight: 100 900;\n' +
    '  src: url(data:font/woff2;base64,' + data + ') format("woff2");\n}\n';
}

function styles() {
  const fonts = path.join(ROOT, 'frontend', 'node_modules', '@fontsource-variable');
  let css = '';
  const sans = path.join(fonts, 'schibsted-grotesk', 'files', 'schibsted-grotesk-latin-wght-normal.woff2');
  const mono = path.join(fonts, 'jetbrains-mono', 'files', 'jetbrains-mono-latin-wght-normal.woff2');
  if (fs.existsSync(sans) && fs.existsSync(mono)) {
    css += fontFace('Schibsted Grotesk Variable', sans) + fontFace('JetBrains Mono Variable', mono);
  } else {
    warn('fonts not found (run npm ci in frontend): the page falls back to system fonts');
  }
  css += theme.readTokensCss() + '\n';
  for (let i = 0; i < STYLE_FILES.length; i++) {
    css += fs.readFileSync(path.join(EXPLORER, 'styles', STYLE_FILES[i]), 'utf8') + '\n';
  }
  return css;
}

function scripts() {
  const files = loadCore.coreFilePaths().concat(loadCore.listViewFiles());
  for (let i = 0; i < UI_FILES.length; i++) {
    files.push(path.join(EXPLORER, 'ui', UI_FILES[i]));
  }
  let code = '';
  for (let i = 0; i < files.length; i++) {
    code += '\n/* ' + path.relative(EXPLORER, files[i]).split(path.sep).join('/') + ' */\n' + fs.readFileSync(files[i], 'utf8');
  }
  // one function around everything, so nothing leaks into the page's global scope
  return '(function () {\n' + code + '\n})();';
}

function commitInfo() {
  try {
    const hash = childProcess.execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim();
    const dirty = childProcess.execSync('git status --porcelain', { cwd: ROOT }).toString().trim() !== '';
    return hash + (dirty ? ' (with uncommitted changes)' : '');
  } catch (err) {
    return 'unknown';
  }
}

function jsonForScript(value) {
  // <, U+2028 and U+2029 become \u escapes: < could end the script tag early, and the two
  // separators break some older parsers. JSON.parse turns the escapes back into the same text.
  return JSON.stringify(value).replace(/[<\u2028\u2029]/g, function (char) {
    return '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0');
  });
}

function build(includePrivate) {
  const AX = loadCore.loadCore(true);
  const glossary = knowledge.readGlossary(KNOWLEDGE);
  for (let i = 0; i < glossary.problems.length; i++) {
    fail(glossary.problems[i]);
  }
  if (glossary.missing) {
    fail('docs/knowledge/glossary.md is missing: the term cards need it');
  }
  const terms = glossary.terms;
  const termSkip = require('./explorer/data/terms-config').skip;
  const docSet = loadDocs(AX, terms, termSkip, includePrivate);
  const facts = extract.extractAll();
  const built = buildPieces(facts, docSet.docs);
  // the diagrams drawn from the code: one per endpoint and one per page
  const generated = generatedViews.all(AX, facts);
  for (let i = 0; i < generated.length; i++) {
    AX.addView(generated[i]);
    const pageId = generated[i].id.indexOf('page.') === 0 ? 'page:' + generated[i].id.slice(5) : '';
    if (pageId && built.pieces[pageId] && !built.pieces[pageId].opens) {
      built.pieces[pageId].opens = generated[i].id;
    }
  }
  checkViews(AX, built.pieces, terms);
  const chat = chatConfig();
  const data = {
    pieces: built.pieces,
    endpoints: built.endpoints,
    terms: terms,
    termSkip: termSkip,
    docs: docSet.docs,
    docGroups: docSet.docGroups,
    chat: chat,
    views: generated,
  };
  const template = fs.readFileSync(path.join(EXPLORER, 'template.html'), 'utf8');
  const icon = 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, 'frontend', 'public', 'favicon.png')).toString('base64');
  const builtAt = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
  const html = template
    .split('{{STYLES}}').join(styles())
    .split('{{ICON}}').join(icon)
    .split('{{BUILT}}').join(builtAt)
    .split('{{COMMIT}}').join(commitInfo())
    .split('{{DATA}}').join(jsonForScript(data))
    .split('{{SCRIPTS}}').join(scripts());
  // the same page without the facts read from the (already public) code, for the safety scan
  const handOnly = {};
  for (let i = 0; i < built.handIds.length; i++) {
    handOnly[built.handIds[i]] = built.pieces[built.handIds[i]];
  }
  const scanData = Object.assign({}, data, { pieces: handOnly, endpoints: [], views: [] });
  const scanHtml = html.split(jsonForScript(data)).join(jsonForScript(scanData));
  return { html: html, scanHtml: scanHtml, AX: AX, data: data };
}

function main() {
  fs.mkdirSync(DIST, { recursive: true });
  const result = build(false);
  // a plain list of every part id, for people writing diagrams
  const index = Object.keys(result.data.pieces).sort().map(function (id) {
    const piece = result.data.pieces[id];
    return id + '  |  ' + piece.kind + '  |  ' + (piece.title || piece.name);
  });
  fs.writeFileSync(path.join(DIST, 'pieces-index.txt'), index.join(String.fromCharCode(10)) + String.fromCharCode(10));
  // the public page must not carry private server details or a key
  let scanned = result.scanHtml;
  // the fonts and the icon are base64 data, where short strings turn up by chance
  scanned = scanned.replace(/data:[\w/+.-]+;base64,[A-Za-z0-9+/=]+/g, 'data:,');
  const leaks = safety.scan(scanned, 'built page', safety.privateStrings(DOCS));
  for (let i = 0; i < leaks.length; i++) {
    fail(leaks[i]);
  }
  const contrast = theme.checkContrast();
  for (let i = 0; i < contrast.problems.length; i++) {
    fail('contrast: ' + contrast.problems[i]);
  }
  for (let i = 0; i < warnings.length; i++) {
    console.log('warning: ' + warnings[i]);
  }
  if (errors.length > 0) {
    for (let i = 0; i < errors.length; i++) {
      console.log('error: ' + errors[i]);
    }
    console.log('\nThe explorer was not written: ' + errors.length + ' errors.');
    process.exitCode = 1;
    return;
  }
  const out = path.join(DIST, 'atlas-explorer.html');
  fs.writeFileSync(out, result.html);
  const size = Buffer.byteLength(result.html);
  console.log('Wrote ' + path.relative(ROOT, out) + ' (' + (size / 1024).toFixed(0) + ' KB, ' +
    result.AX.viewOrder.length + ' diagrams, ' + Object.keys(result.data.pieces).length + ' parts, ' +
    result.data.docs.length + ' docs, ' + Object.keys(result.data.terms).length + ' terms, chat ' + (result.data.chat ? 'on' : 'off') + ')');
  if (size > 3 * 1024 * 1024) {
    console.log('warning: the page is over 3 MB');
  }
  if (wantsPrivate) {
    const full = build(true);
    const privateOut = path.join(DIST, 'atlas-explorer-private.html');
    fs.writeFileSync(privateOut, full.html);
    console.log('Wrote ' + path.relative(ROOT, privateOut) + ' (private: keep it on your own computer)');
  }
  if (wantsSnapshots) {
    const snapDir = path.join(DIST, 'snapshots');
    let count = 0;
    for (let i = 0; i < result.AX.viewOrder.length; i++) {
      const spec = result.AX.views[result.AX.viewOrder[i]];
      if (spec.type === 'hub' || spec.type === 'catalogue' || spec.generated) {
        continue;
      }
      for (let zoom = 1; zoom <= 3; zoom++) {
        snapshot.writeSnapshot(result.AX, spec, zoom, 'light', snapDir);
        count += 1;
      }
    }
    console.log('Wrote ' + count + ' snapshots to ' + path.relative(ROOT, snapDir));
  }
}

main();
