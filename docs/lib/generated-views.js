// The diagrams the build draws on its own, straight from the facts in lib/extract.js:
//   ep.<endpoint>  one per API endpoint, left to right: the request, its checks in order
//                  (with what each answers instead, below it), the handler with the model
//                  functions it calls, the reply; above the handler the tables, files and
//                  services it touches
//   page.<Page>    one per page of the web app, with its components and helpers on the left
//                  and the API and sign-in calls it makes (itself or through a component) on
//                  the right
// They are laid out with exact boxes instead of a grid, so every connector stays straight,
// and wider than tall, like the screen they are shown on.
const fs = require('fs');
const path = require('path');
const words = require('../explorer/data/generated');

const KNOWLEDGE = path.join(__dirname, '..', 'knowledge');
const STATUS_TEXT = { 200: 'OK', 201: 'Created', 204: 'No content' };

// The opening sentences of each "What does METHOD /path do?" section in api-endpoints.md,
// by 'METHOD /path': the plain summary of every endpoint.
function endpointSummaries() {
  const out = {};
  const file = path.join(KNOWLEDGE, 'api-endpoints.md');
  if (!fs.existsSync(file)) {
    return out;
  }
  const text = fs.readFileSync(file, 'utf8').split('\r\n').join('\n');
  const pattern = /^## What does (GET|POST|PUT|DELETE) (\S+) do\?\n\n([^\n]+)/gm;
  let match = pattern.exec(text);
  while (match) {
    const sentences = match[3].replace(/`/g, '').split('. ');
    let summary = '';
    let count = 0;
    for (let i = 0; i < sentences.length && count < 2; i++) {
      const sentence = i < sentences.length - 1 ? sentences[i] + '.' : sentences[i];
      if (sentence.indexOf('The chain is') !== 0) {
        summary += (summary === '' ? '' : ' ') + sentence;
        count += 1;
      }
    }
    out[match[1] + ' ' + match[2]] = summary;
    match = pattern.exec(text);
  }
  return out;
}

// The reply in words: an object shows its fields, a single value says what it is.
function replyText(ep, reply) {
  if (reply.body === 'the file itself') {
    return reply.body;
  }
  if (reply.body.charAt(0) === '{') {
    return 'JSON ' + reply.body;
  }
  if (/card/i.test(reply.body)) {
    return 'JSON: the card';
  }
  if (/profile|user/i.test(reply.body)) {
    return 'JSON: the profile';
  }
  if (ep.path.indexOf('/api/saved') === 0) {
    return 'JSON: the saved item';
  }
  return 'JSON: the study reviewer';
}

const SCHEMA_VIEW = {
  users: 'schema-content', reviewers: 'schema-content', upvotes: 'schema-content', reports: 'schema-content',
  saved_items: 'schema-study', flashcards: 'schema-study', recently_viewed: 'schema-study', rate_limits: 'l-rate',
};

// Services that only help in the browser (no API, no sign-in).
const HELPER_SERVICES = ['categories', 'feedMemory', 'fileRules', 'format', 'noteHtml'];

function unique(list) {
  return list.filter(function (value, index) {
    return list.indexOf(value) === index;
  });
}

function snap(value) {
  return Math.round(value / 4) * 4;
}

// 'SELECT reviewers, SELECT users' -> 'SELECT reviewers, users'
function sqlSummary(sql) {
  const byVerb = {};
  const verbs = [];
  for (let i = 0; i < sql.length; i++) {
    const parts = sql[i].split(' ');
    if (!byVerb[parts[0]]) {
      byVerb[parts[0]] = [];
      verbs.push(parts[0]);
    }
    byVerb[parts[0]].push(parts[1]);
  }
  return verbs.map(function (verb) {
    return verb + ' ' + byVerb[verb].join(', ');
  }).join('; ');
}

// The SQL verbs a list of model functions runs on one table: 'INSERT, SELECT'.
function verbsOn(table, fns) {
  const verbs = [];
  for (let i = 0; i < fns.length; i++) {
    for (let s = 0; s < fns[i].sql.length; s++) {
      const parts = fns[i].sql[s].split(' ');
      if (parts[1] === table && verbs.indexOf(parts[0]) === -1) {
        verbs.push(parts[0]);
      }
    }
  }
  return verbs.join(', ');
}

// A container: its face shows at level 1, its parts from level 2.
function containerHeight(AX, items, cols, kidW) {
  let kidH = 32;
  for (let i = 0; i < items.length; i++) {
    kidH = Math.max(kidH, AX.nodeHeight(items[i], kidW, true));
  }
  const rows = Math.ceil(items.length / cols);
  return { h: 30 + rows * kidH + (rows - 1) * 8 + 12, kidH: kidH };
}

// ---------- one diagram per endpoint ----------

function endpointView(AX, ep, fnById, summaries) {
  const suffix = ep.id.replace(/^ep:/, '');
  const handler = fnById[ep.handlerFn] || null;
  const nodes = [];
  const edges = [];
  const LEFT = 40;
  const TOP = 72;
  const CHECK_W = 176;
  const HANDLER_W = 216;
  const DEP_W = 200;
  const REPLY_W = 176;
  const GAP_X = 56;
  const GAP_Y = 56;

  // what the handler uses: model functions (also through same-file helpers), their
  // tables, the uploaded files and Gemini
  let calls = handler ? handler.calls.slice() : [];
  if (handler) {
    for (let l = 0; l < handler.localUses.length; l++) {
      const helper = fnById['fn:' + path.posix.basename(handler.file, '.js') + '.' + handler.localUses[l]];
      if (helper) {
        calls = calls.concat(helper.calls);
      }
    }
  }
  calls = unique(calls);
  const modelFns = [];
  let tables = [];
  for (let c = 0; c < calls.length; c++) {
    const fn = fnById[calls[c]];
    if (fn && fn.kind === 'mfile') {
      modelFns.push(fn);
      for (let t = 0; t < fn.calls.length; t++) {
        if (fn.calls[t].startsWith('table:')) {
          tables.push(fn.calls[t].replace('table:', ''));
        }
      }
    }
  }
  tables = unique(tables);
  const fileUses = [];
  if (ep.chain.indexOf('upload.single') !== -1) {
    fileUses.push('saves the new file');
  }
  if (calls.indexOf('mw:getStoredFilePath') !== -1) {
    fileUses.push('reads the file');
  }
  if (calls.indexOf('util:materialContent') !== -1) {
    fileUses.push('reads the saved copy');
  }
  if (calls.indexOf('mw:removeStoredFile') !== -1) {
    fileUses.push('deletes old files');
  }

  // the boxes above the handler: files (left), database (middle), Gemini (right)
  const deps = [];
  if (fileUses.length > 0) {
    deps.push({
      place: 'left', label: 'FILE',
      node: {
        id: 'files', tag: 'FILES', name: 'Uploaded files', sub: fileUses.join(', '), treat: 'store',
        piece: 'store:uploads', term: 'uploads-folder', opens: 'f-file',
      },
    });
  }
  if (tables.length > 0) {
    const tableItems = tables.map(function (table) {
      return { id: 't-' + table, name: table, sub: verbsOn(table, modelFns), piece: 'table:' + table, opens: SCHEMA_VIEW[table] || 'data' };
    });
    const size = containerHeight(AX, tableItems, 1, DEP_W - 24);
    deps.push({
      place: 'middle', label: 'SQL', minH: size.h,
      node: {
        id: 'db', tag: 'DB', name: 'PostgreSQL', sub: tables.length + (tables.length === 1 ? ' table' : ' tables'),
        treat: 'store', piece: 'store:postgres', term: 'postgresql', opens: 'data',
        kids: { cols: 1, h: size.kidH, label: 'TABLES IT USES', hint: 'Zoom in for the tables', items: tableItems },
      },
    });
  }
  if (calls.indexOf('util:gemini') !== -1) {
    deps.push({
      place: 'right', label: 'MAKE CARDS', style: 'link',
      node: {
        id: 'gemini', tag: 'EXT', name: 'Google Gemini', sub: 'writes the flashcards', treat: 'external',
        piece: 'ext:gemini', term: 'gemini', opens: 'p-flashcards',
      },
    });
  }
  if (calls.indexOf('util:rem') !== -1) {
    deps.push({
      place: 'right', label: 'ASK REM', style: 'link',
      node: {
        id: 'rem', tag: 'EXT', name: 'Rem RaaS', sub: 'answers from the Atlas docs', treat: 'external',
        piece: 'ext:rem', term: 'rem-raas', opens: 'f-docs',
      },
    });
  }
  // at most 9 boxes at level 1: when the chain is long, the files box and then the
  // database appear from level 2 (Gemini or Rem, when used, stays: it is why the endpoint exists)
  let room = 9 - (ep.chain.length + 3);
  const keepOrder = ['gemini', 'rem', 'db', 'files'];
  for (let k = 0; k < keepOrder.length; k++) {
    for (let d = 0; d < deps.length; d++) {
      if (deps[d].node.id === keepOrder[k]) {
        if (room > 0) {
          room -= 1;
        } else {
          deps[d].node.lod = 2;
        }
      }
    }
  }
  let depsH = 0;
  for (let d = 0; d < deps.length; d++) {
    deps[d].h = Math.max(72, deps[d].minH || 0, AX.nodeHeight(deps[d].node, DEP_W));
    depsH = Math.max(depsH, deps[d].h);
  }

  // the main row: request, checks, handler, reply, all centred on one line
  const request = {
    id: 'req', tag: ep.method, name: ep.path, sub: 'Who can call it: ' + ep.who, treat: 'input',
    piece: ep.id, opens: 'pipeline', term: 'endpoint',
    lines: ['Passed the shared checks first:', 'helmet, CORS, general limit, JSON'],
  };
  const requestW = Math.max(CHECK_W, AX.snapUp(AX.textWidth(ep.path, AX.FONT.name, false, true) + 28));
  const requestH = Math.max(72, AX.nodeHeight(request, requestW));
  const checks = [];
  for (let i = 0; i < ep.chain.length; i++) {
    const step = ep.chain[i];
    const about = words.checks[step] || { ask: step, exits: [] };
    const check = {
      id: 'c' + i, tag: 'CHECK', name: about.ask, sub: step, piece: about.piece || '', term: about.term || '',
      lines: about.lines || [],
    };
    checks.push({ node: check, about: about, h: Math.max(72, AX.nodeHeight(check, CHECK_W)) });
  }
  const handlerNode = {
    id: 'h', tag: 'HANDLER', treat: 'focal',
    name: handler ? handler.name : 'Health check',
    sub: handler ? path.posix.basename(handler.file) : 'app.js',
    piece: handler ? handler.id : 'file:app.js',
    term: 'controller',
  };
  let handlerH = Math.max(88, AX.nodeHeight(handlerNode, HANDLER_W));
  if (modelFns.length > 0) {
    const fnItems = modelFns.map(function (fn, index) {
      return { id: 'm' + index, name: fn.name, sub: sqlSummary(fn.sql), piece: fn.id, term: 'model' };
    });
    const size = containerHeight(AX, fnItems, 1, HANDLER_W - 24);
    handlerNode.kids = { cols: 1, h: size.kidH, label: handler.name + '() calls', hint: 'Zoom in for what it calls', items: fnItems };
    handlerH = Math.max(handlerH, size.h);
  }
  let tallest = Math.max(requestH, handlerH, 52);
  for (let i = 0; i < checks.length; i++) {
    tallest = Math.max(tallest, checks[i].h);
  }
  const rowTop = TOP + (deps.length > 0 ? depsH + GAP_Y : 0);
  const middle = rowTop + tallest / 2;

  let x = LEFT;
  request.box = [x, snap(middle - requestH / 2), requestW, requestH];
  nodes.push(request);
  let previous = 'req';
  let previousMiddle = x + requestW / 2;
  x += requestW + GAP_X;
  for (let i = 0; i < checks.length; i++) {
    const check = checks[i].node;
    const about = checks[i].about;
    const top = snap(middle - checks[i].h / 2);
    check.box = [x, top, CHECK_W, checks[i].h];
    nodes.push(check);
    edges.push({ from: previous, to: check.id });
    if (about.exits.length > 0) {
      const exit = {
        id: 'x' + i, lod: 2, treat: 'stop', piece: about.piece || '',
        name: about.exits.map(function (pair) {
          return pair[0];
        }).join(' / '),
        sub: about.exits.map(function (pair) {
          return pair[1];
        }).join(', '),
        subLod: 2,
      };
      const exitH = Math.max(48, AX.nodeHeight(exit, CHECK_W));
      exit.box = [x, top + checks[i].h + 48, CHECK_W, exitH];
      nodes.push(exit);
      edges.push({ from: check.id + ':bottom', to: exit.id + ':top', label: 'NO' });
    }
    previous = check.id;
    previousMiddle = x + CHECK_W / 2;
    x += CHECK_W + GAP_X;
  }
  const handlerX = x;
  const handlerTop = snap(middle - handlerH / 2);
  handlerNode.box = [handlerX, handlerTop, HANDLER_W, handlerH];
  nodes.push(handlerNode);
  edges.push({ from: previous, to: 'h' });
  x += HANDLER_W + GAP_X;

  const reply = handler && handler.reply ? handler.reply : { status: 200, body: '{ status }' };
  const replyNode = {
    id: 'res', shape: 'oval', name: reply.status + ' ' + (STATUS_TEXT[reply.status] || ''),
    sub: replyText(ep, reply), piece: ep.id,
  };
  replyNode.box = [x, snap(middle - 26), REPLY_W, 52];
  nodes.push(replyNode);
  edges.push({ from: 'h', to: 'res', style: 'accent' });

  // the dependencies sit above the handler, bottoms on one line
  const centres = { left: previousMiddle, middle: handlerX + HANDLER_W / 2, right: x + REPLY_W / 2 };
  const depBottom = handlerTop - GAP_Y;
  for (let d = 0; d < deps.length; d++) {
    deps[d].node.box = [snap(centres[deps[d].place] - DEP_W / 2), depBottom - deps[d].h, DEP_W, deps[d].h];
    nodes.push(deps[d].node);
    const edge = { from: 'h:top', to: deps[d].node.id + ':bottom', label: deps[d].label };
    if (deps[d].style) {
      edge.style = deps[d].style;
    }
    edges.push(edge);
  }

  const related = ['pipeline'].concat(words.related[ep.id] || []);
  const checkCount = ep.chain.length;
  return {
    id: 'ep.' + suffix,
    parent: 'endpoints',
    group: 'Backend',
    generated: true,
    type: 'flowchart',
    title: ep.method + ' ' + ep.path,
    eyebrow: 'API ENDPOINT',
    purpose: (summaries[ep.method + ' ' + ep.path] || (handler && handler.comment ? handler.comment : '')) + ' ' +
      (checkCount > 0 ? 'The request passes ' + checkCount + (checkCount === 1 ? ' check' : ' checks') + ' in order; zoom in to see what each one answers instead, and what the handler reads and writes.' : 'Zoom in to see what it answers.'),
    desc: ep.method + ' ' + ep.path + ': ' + (checkCount > 0 ? 'checks ' + ep.chain.join(', ') + ', then ' : '') +
      'the handler ' + handlerNode.name + (tables.length > 0 ? ', which uses the tables ' + tables.join(', ') : '') +
      ', and the reply ' + replyNode.name + '.',
    piece: ep.id,
    related: related.slice(0, 4),
    grid: { x: LEFT, y: TOP, col: CHECK_W, row: 88, gapX: GAP_X, gapY: GAP_Y },
    nodes: nodes,
    edges: edges,
  };
}

// ---------- one diagram per page ----------

function pageView(AX, route, file, fnById, fileByRel, fileById, endpointById) {
  const pageName = file.name.replace(/\.jsx$/, '');
  const nodes = [];
  const edges = [];
  const TOP = 72;
  const SIDE_W = 304;
  const PAGE_W = 200;
  const OUT_W = 200;
  const GAP_X = 96;
  const GAP_Y = 32;
  const LEFT_X = 40;
  const PAGE_X = LEFT_X + SIDE_W + GAP_X;
  const RIGHT_X = PAGE_X + PAGE_W + GAP_X;
  const OUT_X = RIGHT_X + SIDE_W + GAP_X;

  // the components it shows, and every component inside those
  const direct = [];
  for (let i = 0; i < file.imports.length; i++) {
    const inner = fileByRel[file.imports[i]];
    if (inner && inner.kind === 'comp') {
      direct.push(inner);
    }
  }
  const all = direct.slice();
  for (let i = 0; i < all.length; i++) {
    for (let m = 0; m < all[i].imports.length; m++) {
      const inner = fileByRel[all[i].imports[m]];
      if (inner && inner.kind === 'comp' && all.indexOf(inner) === -1) {
        all.push(inner);
      }
    }
  }

  // API calls, sign-in calls and helpers, from the page itself and from its components
  const calls = [];
  const signIn = [];
  const helpers = [];
  const sources = [file].concat(all);
  for (let s = 0; s < sources.length; s++) {
    const source = sources[s];
    const who = source === file ? '' : source.name.replace(/\.jsx$/, '') + ': ';
    for (let f = 0; f < source.fnImports.length; f++) {
      const fn = fnById[source.fnImports[f]];
      if (!fn) {
        continue;
      }
      const module = path.posix.basename(fn.file).replace(/\.js$/, '');
      for (let c = 0; c < fn.calls.length; c++) {
        if (endpointById[fn.calls[c]]) {
          calls.push({ ep: fn.calls[c], via: who + fn.name + '()' });
        }
      }
      if (module === 'authService' && signIn.indexOf(fn.id) === -1) {
        signIn.push(fn.id);
      }
      if (HELPER_SERVICES.indexOf(module) !== -1 && source === file && helpers.indexOf('svc:' + module) === -1) {
        helpers.push('svc:' + module);
      }
    }
    for (let a = 0; a < source.apiCalls.length; a++) {
      calls.push({ ep: source.apiCalls[a], via: who + 'direct request' });
    }
  }
  for (let i = 0; i < file.imports.length; i++) {
    const inner = fileByRel[file.imports[i]];
    if (inner && inner.kind === 'ctx' && helpers.indexOf(inner.id) === -1) {
      helpers.push(inner.id);
    }
  }
  const seen = {};
  const apiItems = [];
  for (let i = 0; i < calls.length; i++) {
    if (seen[calls[i].ep]) {
      continue;
    }
    seen[calls[i].ep] = true;
    const ep = endpointById[calls[i].ep];
    apiItems.push({
      id: 'e' + apiItems.length, name: ep.method + ' ' + ep.path, sub: calls[i].via,
      piece: ep.id, opens: 'ep.' + ep.id.replace(/^ep:/, ''), term: 'endpoint',
    });
  }

  // left of the page: what it is made of; right of it: what it talks to
  const left = [];
  const right = [];
  if (direct.length > 0) {
    left.push({
      label: 'SHOWS',
      node: {
        id: 'comps', tag: 'UI', name: 'Components', sub: direct.length + (direct.length === 1 ? ' part' : ' parts') + ' on this page',
        piece: 'layer:components', opens: 'frontend', term: 'react',
        kids: {
          cols: 2, label: 'COMPONENTS', hint: 'Zoom in for the parts',
          items: direct.map(function (comp, index) {
            return { id: 'k' + index, name: comp.name.replace(/\.jsx$/, ''), piece: comp.id };
          }),
        },
      },
    });
  }
  if (helpers.length > 0) {
    left.push({
      label: 'USES',
      node: {
        id: 'helpers', tag: 'HELPERS', name: 'Helpers and shared state', sub: 'run in the browser',
        piece: 'layer:services', opens: 'client-data',
        kids: {
          cols: 2, label: 'HELPERS', hint: 'Zoom in for the helpers',
          items: helpers.map(function (id, index) {
            const helper = fileById[id];
            return { id: 'u' + index, name: helper ? helper.name.replace(/\.(jsx|js)$/, '') : id, piece: id };
          }),
        },
      },
    });
  }
  if (apiItems.length > 0) {
    right.push({
      label: 'CALLS',
      node: {
        id: 'calls', tag: 'API CALLS', name: 'Asks the Atlas API', sub: apiItems.length + (apiItems.length === 1 ? ' endpoint' : ' endpoints'),
        piece: 'layer:services', opens: 'client-data', term: 'rest-api',
        kids: { cols: 1, label: 'ENDPOINTS IT CALLS', hint: 'Zoom in for each request', items: apiItems },
      },
      out: {
        label: 'HTTPS + TOKEN',
        node: {
          id: 'api', tag: 'API', name: 'Atlas API', sub: 'on the VPS', treat: 'external',
          piece: 'app:backend', opens: 'endpoints', term: 'rest-api',
        },
      },
    });
  }
  if (signIn.length > 0) {
    right.push({
      label: 'SIGNS IN',
      node: {
        id: 'signin', tag: 'SIGN-IN', name: 'Sign-in calls', sub: 'authService.js', piece: 'svc:authService', term: 'firebase-authentication',
        kids: {
          cols: 2, label: 'SIGN-IN CALLS', hint: 'Zoom in for the calls',
          items: signIn.map(function (id, index) {
            return { id: 's' + index, name: fnById[id].name, piece: id };
          }),
        },
      },
      out: {
        label: 'SIGN IN',
        node: {
          id: 'firebase', tag: 'EXT', name: 'Firebase Authentication', sub: 'Google', treat: 'external',
          piece: 'ext:firebase-auth', opens: 'p-signin', term: 'firebase-authentication',
        },
      },
    });
  }

  // stacks one side's containers from the top; returns how tall the stack is
  function stack(list, x) {
    let y = TOP;
    for (let s = 0; s < list.length; s++) {
      const node = list[s].node;
      const kidW = (SIDE_W - 24 - (node.kids.cols - 1) * 8) / node.kids.cols;
      const size = containerHeight(AX, node.kids.items, node.kids.cols, kidW);
      node.kids.h = size.kidH;
      const h = Math.max(88, size.h, AX.nodeHeight(node, SIDE_W) + 24);
      node.box = [x, y, SIDE_W, h];
      nodes.push(node);
      edges.push({ from: 'page', to: node.id, label: list[s].label });
      if (list[s].out) {
        const out = list[s].out.node;
        const outH = Math.max(72, AX.nodeHeight(out, OUT_W));
        out.box = [OUT_X, snap(y + (h - outH) / 2), OUT_W, outH];
        nodes.push(out);
        edges.push({ from: node.id, to: out.id, label: list[s].out.label, style: 'link' });
      }
      y += h + GAP_Y;
    }
    return list.length > 0 ? y - GAP_Y - TOP : 0;
  }
  const leftH = stack(left, LEFT_X);
  const rightH = stack(right, RIGHT_X);

  const header = file.header ? file.header : '';
  const pageNode = {
    id: 'page', tag: 'PAGE', name: pageName, sub: route ? route.path : '', subLod: 1, treat: 'focal',
    piece: 'page:' + pageName, term: 'single-page-app',
    lines: [route && route.protected ? 'Login needed' : 'Open to everyone'],
  };
  pageNode.box = [PAGE_X, TOP, PAGE_W, Math.max(120, leftH, rightH, AX.nodeHeight(pageNode, PAGE_W))];
  nodes.unshift(pageNode);

  const related = ['frontend', 'client-data'].concat(words.pages[pageName] || []);
  return {
    id: 'page.' + pageName,
    parent: 'frontend',
    group: 'Frontend',
    generated: true,
    type: 'architecture',
    title: pageName + (route ? ' (' + route.path + ')' : ''),
    eyebrow: 'PAGE',
    purpose: (header ? header + ' ' : '') + 'Zoom in to see its components and every request it sends.',
    desc: 'The page ' + pageName + ' with ' + direct.length + ' components, ' + apiItems.length + ' API endpoints it calls' +
      (signIn.length > 0 ? ', sign-in calls to Firebase' : '') + (helpers.length > 0 ? ', and ' + helpers.length + ' helpers' : '') + '.',
    piece: 'page:' + pageName,
    related: related.slice(0, 4),
    grid: { x: LEFT_X, y: TOP, col: SIDE_W, row: 88, gapX: GAP_X, gapY: GAP_Y },
    nodes: nodes,
    edges: edges,
  };
}

// Every generated diagram, in a stable order.
function all(AX, facts) {
  const fnById = {};
  for (let i = 0; i < facts.functions.length; i++) {
    fnById[facts.functions[i].id] = facts.functions[i];
  }
  const fileByRel = {};
  const fileById = {};
  for (let i = 0; i < facts.files.length; i++) {
    fileByRel[facts.files[i].rel] = facts.files[i];
    fileById[facts.files[i].id] = facts.files[i];
  }
  const endpointById = {};
  for (let i = 0; i < facts.endpoints.length; i++) {
    endpointById[facts.endpoints[i].id] = facts.endpoints[i];
  }
  const summaries = endpointSummaries();
  const views = [];
  for (let i = 0; i < facts.endpoints.length; i++) {
    views.push(endpointView(AX, facts.endpoints[i], fnById, summaries));
  }
  for (let i = 0; i < facts.files.length; i++) {
    const file = facts.files[i];
    if (file.kind !== 'page') {
      continue;
    }
    let route = null;
    for (let r = 0; r < facts.routes.length; r++) {
      if (facts.routes[r].page + '.jsx' === file.name) {
        route = facts.routes[r];
      }
    }
    views.push(pageView(AX, route, file, fnById, fileByRel, fileById, endpointById));
  }
  return views;
}

module.exports = {
  all: all,
  endpointSummaries: endpointSummaries,
};
