// Reads facts straight from the Atlas code, so the explorer cannot drift from it:
// every source file (with its plain-words header comment), the functions in models,
// controllers, middleware and frontend services, every API endpoint with its exact
// chain of checks, every database table, column and index, every setting, and the
// frontend routes. Hand-written data in explorer/data/pieces only adds prose.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8').split('\r\n').join('\n');
}

function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

function walk(relDir, pattern) {
  const out = [];
  const full = path.join(ROOT, relDir);
  if (!fs.existsSync(full)) {
    return out;
  }
  const names = fs.readdirSync(full).sort();
  for (let i = 0; i < names.length; i++) {
    const rel = relDir + '/' + names[i];
    if (fs.statSync(path.join(ROOT, rel)).isDirectory()) {
      const inner = walk(rel, pattern);
      for (let j = 0; j < inner.length; j++) {
        out.push(inner[j]);
      }
    } else if (pattern.test(names[i])) {
      out.push(rel);
    }
  }
  return out;
}

// The comment block at the top of a file, as one plain sentence block.
function headerComment(text) {
  const lines = text.split('\n');
  const out = [];
  let inBlock = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (i === 0 && line.startsWith('#!')) {
      continue;
    }
    if (inBlock) {
      const end = line.indexOf('*/');
      out.push(line.replace('*/', '').replace(/^\*\s?/, '').trim());
      if (end !== -1) {
        break;
      }
      continue;
    }
    if (line.startsWith('/*')) {
      inBlock = !line.includes('*/');
      out.push(line.replace('/*', '').replace('*/', '').trim());
      if (!inBlock) {
        break;
      }
      continue;
    }
    if (line.startsWith('//') || (line.startsWith('#') && !line.startsWith('#!')) || line.startsWith('--')) {
      out.push(line.replace(/^(\/\/|#|--)\s?/, ''));
      continue;
    }
    if (line === '' && out.length === 0) {
      continue;
    }
    break;
  }
  return out.join(' ').replace(/\s+/g, ' ').trim();
}

function base(rel) {
  return path.posix.basename(rel).replace(/\.(jsx|js|css|sql|sh)$/, '');
}

// The piece id and kind of a source file.
function fileIdentity(rel) {
  const name = base(rel);
  if (rel.startsWith('frontend/src/pages/')) {
    return { id: 'page:' + name, kind: 'page' };
  }
  if (rel.startsWith('frontend/src/components/')) {
    return { id: 'comp:' + name, kind: 'comp' };
  }
  if (rel.startsWith('frontend/src/context/')) {
    return { id: 'ctx:' + name, kind: 'ctx' };
  }
  if (rel.startsWith('frontend/src/services/')) {
    return { id: 'svc:' + name, kind: 'svc' };
  }
  if (rel.startsWith('frontend/src/styles/')) {
    return { id: 'style:' + rel.replace('frontend/src/styles/', ''), kind: 'style' };
  }
  if (rel.startsWith('backend/src/routes/')) {
    return { id: 'route:' + name, kind: 'route' };
  }
  if (rel.startsWith('backend/src/controllers/')) {
    return { id: 'ctl:' + name, kind: 'ctl' };
  }
  if (rel.startsWith('backend/src/middleware/')) {
    return { id: 'mwfile:' + name, kind: 'mw' };
  }
  if (rel.startsWith('backend/src/models/')) {
    return { id: 'mfile:' + name, kind: 'mfile' };
  }
  if (rel.startsWith('backend/src/utils/')) {
    return { id: 'util:' + name, kind: 'util' };
  }
  if (rel.startsWith('backend/src/config/')) {
    return { id: 'cfg:' + name, kind: 'cfg' };
  }
  if (rel.startsWith('backend/db/') || rel.startsWith('backend/scripts/')) {
    return { id: 'script:' + path.posix.basename(rel), kind: 'script' };
  }
  return { id: 'file:' + rel.replace(/^(frontend|backend)\/(src\/)?/, ''), kind: 'file' };
}

// Functions defined in a file, each with the comment right above it or on its first line.
// "end" is the line before the next top-level function, so the body can be searched.
function functionsIn(text) {
  const lines = text.split('\n');
  const found = [];
  const pattern = /^(?:export\s+)?(?:const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>|(?:default\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\()/;
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(pattern);
    if (!match) {
      continue;
    }
    const name = match[1] || match[2];
    const comments = [];
    let j = i - 1;
    while (j >= 0 && lines[j].trim().startsWith('//')) {
      comments.unshift(lines[j].trim().replace(/^\/\/\s?/, ''));
      j -= 1;
    }
    if (comments.length === 0 && i + 1 < lines.length && lines[i + 1].trim().startsWith('//')) {
      comments.push(lines[i + 1].trim().replace(/^\/\/\s?/, ''));
    }
    found.push({ name: name, line: i + 1, comment: comments.join(' ').trim() });
  }
  for (let k = 0; k < found.length; k++) {
    found[k].end = k + 1 < found.length ? found[k + 1].line - 1 : lines.length;
  }
  return found;
}

// The repo path of a local import like '../models/usersModel', or '' when there is none.
function resolveLocal(rel, spec) {
  if (!spec.startsWith('.')) {
    return '';
  }
  const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(rel), spec));
  const tries = [resolved, resolved + '.js', resolved + '.jsx', resolved + '/index.js'];
  for (let i = 0; i < tries.length; i++) {
    if (exists(tries[i]) && fs.statSync(path.join(ROOT, tries[i])).isFile()) {
      return tries[i];
    }
  }
  return '';
}

// Local files a file imports or requires, as repo paths.
function importsOf(rel, text) {
  const out = [];
  const pattern = /(?:require\(\s*'([^']+)'\s*\)|from\s+'([^']+)'|import\s+'([^']+)')/g;
  let match = pattern.exec(text);
  while (match) {
    const found = resolveLocal(rel, match[1] || match[2] || match[3]);
    if (found !== '') {
      out.push(found);
    }
    match = pattern.exec(text);
  }
  return out;
}

// The names a backend file gives the local files it requires:
// { reviewersModel: 'backend/src/models/reviewersModel.js', ... }
function requireNames(rel, text) {
  const out = {};
  const pattern = /const\s+(\w+)\s*=\s*require\('([^']+)'\)/g;
  let match = pattern.exec(text);
  while (match) {
    const found = resolveLocal(rel, match[2]);
    if (found !== '') {
      out[match[1]] = found;
    }
    match = pattern.exec(text);
  }
  return out;
}

// The service functions a frontend file imports by name: ['fn:savedService.getSavedItem', ...]
function serviceImports(rel, text) {
  const out = [];
  const pattern = /import\s*\{([^}]+)\}\s*from\s*'([^']+)'/g;
  let match = pattern.exec(text);
  while (match) {
    const found = resolveLocal(rel, match[2]);
    if (found.startsWith('frontend/src/services/')) {
      const names = match[1].split(',');
      for (let i = 0; i < names.length; i++) {
        const name = names[i].trim().split(/\s+as\s+/)[0];
        if (name !== '') {
          out.push('fn:' + base(found) + '.' + name);
        }
      }
    }
    match = pattern.exec(text);
  }
  return out;
}

// What a backend function body uses: functions of the models and middleware it requires
// (fn:usersModel.findUserById, mw:removeStoredFile), the utils it calls (util:gemini) and
// the tables its SQL names (table:reviewers).
function backendCallsIn(body, names, tableNames) {
  const out = [];
  const callPattern = /\b(\w+)\.(\w+)\(/g;
  let match = callPattern.exec(body);
  while (match) {
    const target = names[match[1]];
    if (target) {
      const identity = fileIdentity(target);
      if (identity.kind === 'mfile') {
        out.push('fn:' + base(target) + '.' + match[2]);
      } else if (identity.kind === 'mw') {
        out.push('mw:' + match[2]);
      } else if (identity.kind === 'util') {
        out.push(identity.id);
      }
    }
    match = callPattern.exec(body);
  }
  const sqlPattern = /\b(?:FROM|JOIN|INTO|UPDATE)\s+([a-z_]+)/g;
  let sql = sqlPattern.exec(body);
  while (sql) {
    if (tableNames.indexOf(sql[1]) !== -1) {
      out.push('table:' + sql[1]);
    }
    sql = sqlPattern.exec(body);
  }
  return out;
}

// The SQL a model function runs, per table: ['INSERT reviewers', 'SELECT users'].
function sqlIn(body, tableNames) {
  const out = [];
  const pattern = /\b(INSERT INTO|UPDATE|DELETE FROM|FROM|JOIN)\s+([a-z_]+)/g;
  let match = pattern.exec(body);
  while (match) {
    if (tableNames.indexOf(match[2]) !== -1) {
      const verb = match[1] === 'FROM' || match[1] === 'JOIN' ? 'SELECT' : match[1].split(' ')[0];
      const entry = verb + ' ' + match[2];
      if (out.indexOf(entry) === -1) {
        out.push(entry);
      }
    }
    match = pattern.exec(body);
  }
  return out;
}

// The success reply of a controller function: { status: 201, body: '{ cards }' }, or null
// when the function sends none itself.
function replyIn(body) {
  if (/\.pipe\(res\)/.test(body)) {
    return { status: 200, body: 'the file itself' };
  }
  const match = body.match(/res\.(?:status\((\d{3})\)\.)?json\(\s*([\s\S]*?)\);/);
  if (!match) {
    return null;
  }
  let shape = match[2].replace(/\s+/g, ' ').trim();
  if (shape.startsWith('{')) {
    const keys = [];
    const keyPattern = /(\w+)\s*:/g;
    let key = keyPattern.exec(shape);
    while (key) {
      keys.push(key[1]);
      key = keyPattern.exec(shape);
    }
    shape = '{ ' + keys.join(', ') + ' }';
  }
  return { status: match[1] ? Number(match[1]) : 200, body: shape };
}

// The other functions of the same file that a body calls (not x.name(), which belongs
// to another file).
function localUsesIn(body, fns, self) {
  const out = [];
  for (let i = 0; i < fns.length; i++) {
    if (fns[i].name !== self && new RegExp('(^|[^.\\w])' + fns[i].name + '\\(').test(body)) {
      out.push(fns[i].name);
    }
  }
  return out;
}

// The functions of the same file that a body hands res to, to find the reply
// a controller sends through a helper.
function localCallsIn(body, fns) {
  const out = [];
  for (let i = 0; i < fns.length; i++) {
    if (new RegExp('(^|[^.\\w])' + fns[i].name + '\\([^)]*\\bres\\b').test(body)) {
      out.push(fns[i].name);
    }
  }
  return out;
}

// The API addresses a frontend service function asks for, as { method, path } with each
// ${...} part of the path turned into ':'.
function apiCallsIn(body) {
  const out = [];
  function clean(address) {
    return address.split('?')[0].replace(/\$\{[^}]+\}/g, ':');
  }
  const request = /apiRequest(?:Blob)?\(\s*[`'"]([^`'"]+)[`'"]\s*(,\s*\{[^}]*)?/g;
  let match = request.exec(body);
  while (match) {
    const method = match[2] ? match[2].match(/method:\s*'(\w+)'/) : null;
    out.push({ method: method ? method[1] : 'GET', path: clean(match[1]) });
    match = request.exec(body);
  }
  const upload = /uploadWithProgress\(\s*'(\w+)'\s*,\s*[`'"]([^`'"]+)[`'"]/g;
  match = upload.exec(body);
  while (match) {
    out.push({ method: match[1], path: clean(match[2]) });
    match = upload.exec(body);
  }
  const link = /\$\{API_URL\}(\/api\/[^`'"?]*)/g;
  match = link.exec(body);
  while (match) {
    out.push({ method: 'GET', path: clean(match[1]) });
    match = link.exec(body);
  }
  return out;
}

// The endpoint ids a piece of frontend code asks for.
function endpointsCalledIn(code, list) {
  const asked = apiCallsIn(code);
  const out = [];
  for (let i = 0; i < asked.length; i++) {
    const id = endpointFor(asked[i], list);
    if (id !== '' && out.indexOf(id) === -1) {
      out.push(id);
    }
  }
  return out;
}

// The endpoint id that answers a call from apiCallsIn, or ''.
function endpointFor(call, list) {
  const parts = call.path.replace(/\/$/, '').split('/');
  for (let i = 0; i < list.length; i++) {
    const segments = list[i].path.split('/');
    if (list[i].method !== call.method || segments.length !== parts.length) {
      continue;
    }
    let same = true;
    for (let s = 0; s < segments.length; s++) {
      if (segments[s] !== parts[s] && !(segments[s].startsWith(':') && parts[s] === ':')) {
        same = false;
      }
    }
    if (same) {
      return list[i].id;
    }
  }
  return '';
}

// ---------- endpoints ----------

function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

// The calls router.get(...), router.use(...) etc. with their top-level arguments.
function routerCalls(text) {
  const clean = stripComments(text);
  const calls = [];
  const pattern = /router\.(get|post|put|delete|use)\s*\(/g;
  let match = pattern.exec(clean);
  while (match) {
    let depth = 1;
    let i = pattern.lastIndex;
    let current = '';
    const args = [];
    while (i < clean.length && depth > 0) {
      const ch = clean[i];
      if (ch === '(') {
        depth += 1;
      } else if (ch === ')') {
        depth -= 1;
        if (depth === 0) {
          break;
        }
      }
      if (ch === ',' && depth === 1) {
        args.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
      i += 1;
    }
    if (current.trim() !== '') {
      args.push(current.trim());
    }
    calls.push({ method: match[1], args: args });
    match = pattern.exec(clean);
  }
  return calls;
}

function stepName(arg) {
  const call = arg.match(/^([\w.]+)\(/);
  const ref = call ? call[1] : arg;
  const parts = ref.split('.');
  if (parts[0] === 'upload') {
    return 'upload.' + parts[parts.length - 1];
  }
  return parts[parts.length - 1];
}

function whoCanCall(chain) {
  if (chain.indexOf('requireAdmin') !== -1) {
    return 'Admins';
  }
  if (chain.indexOf('requireOwner') !== -1) {
    return 'The owner';
  }
  if (chain.indexOf('requireAuth') !== -1) {
    return 'Logged in';
  }
  if (chain.indexOf('optionalAuth') !== -1) {
    return 'Anyone (login optional)';
  }
  return 'Anyone';
}

function endpoints() {
  const app = read('backend/src/app.js');
  const list = [];
  // routers mounted in app.js: app.use('/api/x', xRoutes)
  const requires = {};
  const requirePattern = /const\s+(\w+)\s*=\s*require\('(\.\/routes\/[^']+)'\)/g;
  let req = requirePattern.exec(app);
  while (req) {
    requires[req[1]] = 'backend/src/' + req[2].replace('./', '') + '.js';
    req = requirePattern.exec(app);
  }
  const mountPattern = /app\.use\(\s*'([^']+)'\s*,\s*(\w+)\s*\)/g;
  let mount = mountPattern.exec(app);
  while (mount) {
    const file = requires[mount[2]];
    if (file && exists(file)) {
      const calls = routerCalls(read(file));
      let prefixChain = [];
      for (let i = 0; i < calls.length; i++) {
        const call = calls[i];
        if (call.method === 'use') {
          for (let a = 0; a < call.args.length; a++) {
            prefixChain.push(stepName(call.args[a]));
          }
          continue;
        }
        const route = call.args[0].replace(/^'|'$/g, '');
        const steps = prefixChain.slice();
        for (let s = 1; s < call.args.length; s++) {
          steps.push(stepName(call.args[s]));
        }
        const handler = call.args[call.args.length - 1];
        const fullPath = (mount[1] + (route === '/' ? '' : route)).replace(/\/$/, '') || mount[1];
        const method = call.method.toUpperCase();
        const controller = handler.split('.')[0];
        list.push({
          id: 'ep:' + call.method + '-' + fullPath.replace(/^\/api\/?/, '').replace(/[/:]+/g, '-').replace(/^-|-$/g, '') || 'root',
          method: method,
          path: fullPath,
          chain: steps.slice(0, -1),
          handler: handler,
          handlerFn: 'fn:' + controller + '.' + handler.split('.').pop(),
          file: file,
          who: whoCanCall(steps),
        });
      }
    }
    mount = mountPattern.exec(app);
  }
  if (/app\.get\(\s*'\/api\/health'/.test(app)) {
    list.unshift({ id: 'ep:get-health', method: 'GET', path: '/api/health', chain: [], handler: 'health check in app.js', handlerFn: '', file: 'backend/src/app.js', who: 'Anyone' });
  }
  return list;
}

// ---------- database ----------

function schema() {
  const text = read('backend/db/schema.sql');
  const tables = {};
  const order = [];
  const createPattern = /CREATE TABLE IF NOT EXISTS (\w+)\s*\(([\s\S]*?)\n\);/g;
  let match = createPattern.exec(text);
  while (match) {
    const name = match[1];
    const before = text.slice(0, match.index).split('\n');
    const notes = [];
    for (let i = before.length - 2; i >= 0 && before[i].trim().startsWith('--'); i--) {
      notes.unshift(before[i].trim().replace(/^--\s?/, ''));
    }
    tables[name] = { name: name, columns: [], constraints: [], indexes: [], note: notes.join(' ') };
    order.push(name);
    const body = match[2].split('\n');
    for (let b = 0; b < body.length; b++) {
      const line = body[b].trim().replace(/,$/, '');
      if (line === '' || line.startsWith('--')) {
        continue;
      }
      if (/^(PRIMARY KEY|UNIQUE|CONSTRAINT|CHECK|FOREIGN KEY)/i.test(line)) {
        tables[name].constraints.push(line);
        continue;
      }
      addColumn(tables[name], line);
    }
    match = createPattern.exec(text);
  }
  const alterPattern = /ALTER TABLE (\w+)\s+ADD COLUMN IF NOT EXISTS (\w+ [^;]+);/g;
  let alter = alterPattern.exec(text);
  while (alter) {
    if (tables[alter[1]]) {
      addColumn(tables[alter[1]], alter[2].replace(/\s+/g, ' ').trim());
    }
    alter = alterPattern.exec(text);
  }
  const notNullPattern = /ALTER TABLE (\w+)\s+ALTER COLUMN (\w+) SET NOT NULL/g;
  let notNull = notNullPattern.exec(text);
  while (notNull) {
    const table = tables[notNull[1]];
    if (table) {
      for (let c = 0; c < table.columns.length; c++) {
        if (table.columns[c].name === notNull[2] && table.columns[c].chips.indexOf('NN') === -1) {
          table.columns[c].chips.push('NN');
        }
      }
    }
    notNull = notNullPattern.exec(text);
  }
  const indexPattern = /CREATE (UNIQUE )?INDEX IF NOT EXISTS (\w+)\s+ON (\w+)\s*\(([^)]*)\)(\s+WHERE [^;]+)?;/g;
  let index = indexPattern.exec(text);
  while (index) {
    if (tables[index[3]]) {
      tables[index[3]].indexes.push({ name: index[2], unique: index[1] === 'UNIQUE ', columns: index[4].trim(), where: (index[5] || '').trim() });
    }
    index = indexPattern.exec(text);
  }
  return { tables: tables, order: order };
}

function addColumn(table, line) {
  const match = line.match(/^(\w+)\s+([A-Z]+(?:\s*\(\s*\d+(?:\s*,\s*\d+)?\s*\))?(?:\s+WITH(?:OUT)? TIME ZONE)?)(.*)$/i);
  if (!match) {
    table.constraints.push(line);
    return;
  }
  const rest = match[3];
  const chips = [];
  if (/PRIMARY KEY/i.test(rest)) {
    chips.push('PK');
  }
  const ref = rest.match(/REFERENCES (\w+)\s*\((\w+)\)(?:\s+ON DELETE (CASCADE|SET NULL|RESTRICT|NO ACTION))?/i);
  if (ref) {
    chips.push('FK');
  }
  if (/\bUNIQUE\b/i.test(rest)) {
    chips.push('UQ');
  }
  if (/NOT NULL/i.test(rest) || /PRIMARY KEY/i.test(rest)) {
    chips.push('NN');
  }
  const def = rest.match(/DEFAULT\s+('[^']*'|[\w()]+)/i);
  const check = rest.match(/CHECK\s*\((.*)\)/i);
  table.columns.push({
    name: match[1],
    type: match[2].toLowerCase().replace(/\s+/g, ' '),
    chips: chips,
    references: ref ? { table: ref[1], column: ref[2], onDelete: (ref[3] || 'NO ACTION').toUpperCase() } : null,
    default: def ? def[1] : '',
    check: check ? check[1] : '',
  });
}

// ---------- settings ----------

function envFile(rel, side) {
  if (!exists(rel)) {
    return [];
  }
  const lines = read(rel).split('\n');
  const list = [];
  let comments = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('#')) {
      const text = line.replace(/^#\s?/, '');
      if (!/^>>>|<<<$/.test(text)) {
        comments.push(text);
      }
      continue;
    }
    const match = line.match(/^([A-Z][A-Z0-9_]*)=/);
    if (match) {
      list.push({ name: match[1], side: side, note: comments.join(' ').replace(/\s+/g, ' ').trim() });
    }
    if (line === '' || match) {
      comments = [];
    }
  }
  return list;
}

// ---------- frontend routes ----------

function frontendRoutes() {
  const text = read('frontend/src/App.jsx');
  const routes = [];
  const pattern = /<Route\s+path="([^"]+)"([\s\S]*?)\/>\s*\n/g;
  let match = pattern.exec(text);
  while (match) {
    const element = match[2];
    const page = element.match(/<(\w+Page)\b/);
    routes.push({ path: match[1], page: page ? page[1] : '', protected: /ProtectedRoute/.test(element) });
    match = pattern.exec(text);
  }
  return routes;
}

// ---------- everything ----------

function extractAll() {
  const files = []
    .concat(walk('frontend/src', /\.(jsx|js|css)$/))
    .concat(walk('backend/src', /\.js$/))
    .concat(walk('backend/db', /\.(js|sql)$/))
    .concat(walk('backend/scripts', /\.sh$/));
  const out = { files: [], functions: [], endpoints: endpoints(), schema: schema(), env: [], routes: frontendRoutes() };
  const tableNames = out.schema.order;
  for (let i = 0; i < files.length; i++) {
    const rel = files[i];
    const text = read(rel);
    const identity = fileIdentity(rel);
    const info = {
      rel: rel,
      id: identity.id,
      kind: identity.kind,
      name: path.posix.basename(rel),
      header: headerComment(text),
      lines: text.split('\n').length,
      imports: /\.(jsx|js)$/.test(rel) ? importsOf(rel, text) : [],
      fnImports: rel.startsWith('frontend/src/') && /\.(jsx|js)$/.test(rel) ? serviceImports(rel, text) : [],
      apiCalls: identity.kind === 'page' || identity.kind === 'comp' ? endpointsCalledIn(text, out.endpoints) : [],
    };
    out.files.push(info);
    const wantsFunctions = identity.kind === 'mfile' || identity.kind === 'ctl' || identity.kind === 'mw' || identity.kind === 'svc';
    if (wantsFunctions) {
      const fns = functionsIn(text);
      const fileBase = base(rel);
      const lines = text.split('\n');
      const names = rel.startsWith('backend/') ? requireNames(rel, text) : {};
      // SQL kept in a constant (const SELECT_REVIEWERS = `...`) counts where ${SELECT_REVIEWERS} is used
      const constants = {};
      const constantPattern = /^const ([A-Z_]+) = `([^`]*)`;/gm;
      let constant = constantPattern.exec(text);
      while (constant) {
        constants[constant[1]] = constant[2];
        constant = constantPattern.exec(text);
      }
      for (let f = 0; f < fns.length; f++) {
        const body = lines.slice(fns[f].line - 1, fns[f].end).join('\n').replace(/\$\{([A-Z_]+)\}/g, function (whole, name) {
          return constants[name] === undefined ? whole : constants[name];
        });
        let calls = [];
        if (identity.kind === 'svc') {
          const asked = apiCallsIn(body);
          for (let a = 0; a < asked.length; a++) {
            const id = endpointFor(asked[a], out.endpoints);
            if (id !== '') {
              calls.push(id);
            }
          }
        } else {
          calls = backendCallsIn(body, names, tableNames);
        }
        out.functions.push({
          id: 'fn:' + fileBase + '.' + fns[f].name, file: rel, fileId: identity.id, name: fns[f].name,
          line: fns[f].line, comment: fns[f].comment, kind: identity.kind,
          sql: identity.kind === 'mfile' ? sqlIn(body, tableNames) : [],
          reply: identity.kind === 'ctl' ? replyIn(body) : null,
          localCalls: identity.kind === 'ctl' ? localCallsIn(body, fns) : [],
          localUses: identity.kind === 'ctl' ? localUsesIn(body, fns, fns[f].name) : [],
          calls: calls.filter(function (value, index) {
            return calls.indexOf(value) === index;
          }),
        });
      }
    }
  }
  for (let i = 0; i < out.functions.length; i++) {
    const fn = out.functions[i];
    for (let c = 0; c < fn.localCalls.length && fn.kind === 'ctl' && !fn.reply; c++) {
      for (let j = 0; j < out.functions.length; j++) {
        if (out.functions[j].file === fn.file && out.functions[j].name === fn.localCalls[c] && out.functions[j].reply) {
          fn.reply = out.functions[j].reply;
        }
      }
    }
  }
  out.env = envFile('backend/.env.example', 'backend').concat(envFile('frontend/.env.example', 'frontend'));
  return out;
}

module.exports = {
  extractAll: extractAll,
  ROOT: ROOT,
};
