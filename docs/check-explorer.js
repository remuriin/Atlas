// Tests the built Atlas Explorer in headless Microsoft Edge, the way a visitor uses it:
// every diagram draws, the root track shows the way back, the keys work (+ D O T / Enter
// Esc), part sheets open, doc links scroll to their section, a term card appears after a
// 1.5 s hover (and not before), the glossary renders, the chat pane opens and gives focus
// back, and no script error happens anywhere.
//
//   node docs/build-explorer.js && node docs/check-explorer.js
//
// Needs Node 22 or newer (for its built-in WebSocket). Screenshots of the checked screens go
// to docs/dist/check. Set EDGE to the path of msedge.exe if it is not in the usual place.
const fs = require('fs');
const os = require('os');
const path = require('path');
const childProcess = require('child_process');

const PAGE = path.join(__dirname, 'dist', 'atlas-explorer.html');
const OUT = path.join(__dirname, 'dist', 'check');
const EDGE = process.env.EDGE || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9333;
const base = 'file:///' + PAGE.split(path.sep).join('/');

const results = [];
function check(name, ok, detail) {
  results.push({ name: name, ok: ok, detail: detail || '' });
  console.log((ok ? 'ok   ' : 'FAIL ') + name + (detail ? '  (' + detail + ')' : ''));
}

function sleep(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

async function main() {
  if (!fs.existsSync(PAGE)) {
    console.error('Build the page first: node docs/build-explorer.js');
    process.exit(1);
  }
  if (typeof WebSocket === 'undefined') {
    console.error('This check needs Node 22 or newer.');
    process.exit(1);
  }
  fs.mkdirSync(OUT, { recursive: true });
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'axcheck-'));
  const edge = childProcess.spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--remote-debugging-port=' + PORT, '--user-data-dir=' + profile,
    '--window-size=1440,900', '--no-first-run', 'about:blank',
  ], { stdio: 'ignore' });
  let targets = null;
  for (let i = 0; i < 50 && !targets; i++) {
    try {
      const response = await fetch('http://127.0.0.1:' + PORT + '/json/list');
      targets = await response.json();
    } catch (err) {
      await sleep(200);
    }
  }
  const pageTarget = targets.filter(function (t) {
    return t.type === 'page';
  })[0];
  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise(function (resolve) {
    ws.onopen = resolve;
  });
  let nextId = 1;
  const pending = {};
  const errors = [];
  const listeners = {};
  ws.onmessage = function (event) {
    const message = JSON.parse(event.data);
    if (message.id && pending[message.id]) {
      pending[message.id](message);
      delete pending[message.id];
      return;
    }
    if (message.method === 'Runtime.exceptionThrown') {
      errors.push(message.params.exceptionDetails.exception ? message.params.exceptionDetails.exception.description : message.params.exceptionDetails.text);
    }
    if (message.method === 'Runtime.consoleAPICalled' && (message.params.type === 'error' || message.params.type === 'warning')) {
      errors.push('console.' + message.params.type + ': ' + message.params.args.map(function (a) {
        return a.value || a.description || '';
      }).join(' '));
    }
    if (listeners[message.method]) {
      listeners[message.method](message.params);
    }
  };
  function send(method, params) {
    return new Promise(function (resolve) {
      const id = nextId++;
      pending[id] = resolve;
      ws.send(JSON.stringify({ id: id, method: method, params: params || {} }));
    });
  }
  async function evaluate(expression) {
    const reply = await send('Runtime.evaluate', { expression: expression, returnByValue: true, awaitPromise: true });
    if (reply.result.exceptionDetails) {
      return { error: reply.result.exceptionDetails.text + ' ' + (reply.result.exceptionDetails.exception ? reply.result.exceptionDetails.exception.description : '') };
    }
    return reply.result.result.value;
  }
  async function shot(name) {
    const reply = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(reply.result.data, 'base64'));
  }
  async function key(keyName, code, text, modifiers) {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: keyName, code: code, text: text, unmodifiedText: text, windowsVirtualKeyCode: keyCodeFor(keyName), modifiers: modifiers || 0 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: keyName, code: code, windowsVirtualKeyCode: keyCodeFor(keyName), modifiers: modifiers || 0 });
  }
  function keyCodeFor(name) {
    const map = { Enter: 13, Escape: 27, Tab: 9, '+': 187, '-': 189, '0': 48, d: 68, o: 79, i: 73, t: 84, c: 67, '/': 191, '?': 191, ArrowRight: 39 };
    return map[name] || 0;
  }

  await send('Page.enable');
  await send('Runtime.enable');
  const loaded = new Promise(function (resolve) {
    listeners['Page.loadEventFired'] = resolve;
  });
  await send('Page.navigate', { url: base + '#/v/system' });
  await loaded;
  await sleep(800);

  // 1. every view draws
  const AXN = require('./lib/load-core').loadCore(true);
  const generated = require('./lib/generated-views').all(AXN, require('./lib/extract').extractAll());
  const types = {};
  AXN.viewOrder.forEach(function (id) { types[id] = AXN.views[id].type; });
  generated.forEach(function (spec) { types[spec.id] = spec.type; });
  const ids = Object.keys(types);
  check('views registered', ids.length > 40, ids.length + ' views');
  let broken = [];
  for (let i = 0; i < ids.length; i++) {
    const info = await evaluate("(function(){location.hash='#/v/" + ids[i] + "';return new Promise(function(r){setTimeout(function(){var spec={type:'" + types[ids[i]] + "'};var stage=document.getElementById('stage');var hub=document.getElementById('hub-page');var n=stage?stage.querySelectorAll('.node').length:0;r({type:spec.type,nodes:n,page:document.body.getAttribute('data-page'),title:(document.getElementById(spec.type==='hub'||spec.type==='catalogue'?'hub-title':'view-title')||{}).textContent,crumbs:document.getElementById('crumbs').textContent.replace(/\\s+/g,' ').trim()});},120);});})()");
    const isHub = info.type === 'hub' || info.type === 'catalogue';
    if (info.error || (!isHub && info.nodes === 0)) {
      broken.push(ids[i] + ' ' + JSON.stringify(info));
    }
  }
  check('every view renders', broken.length === 0, broken.length ? broken.slice(0, 5).join('; ') : ids.length + ' views');

  // 2. root track: a deep view shows its parents
  await evaluate("location.hash='#/v/ep.post-reviewers'");
  await sleep(300);
  const crumbs = await evaluate("document.getElementById('crumbs').textContent.replace(/\\s+/g,' ').trim()");
  check('root track for ep.post-reviewers', /^Atlas/.test(crumbs) && /Backend structure/.test(crumbs) && /Every API endpoint/.test(crumbs), crumbs);
  await shot('ep-post-reviewers');

  // 3. keyboard: zoom, details, outline, theme, find, help, Escape
  await evaluate("location.hash='#/v/system?z=fit'");
  await sleep(400);
  await evaluate("document.activeElement && document.activeElement.blur(); document.body.focus()");
  const zoomBefore = await evaluate("document.getElementById('zoom-text').textContent");
  await key('+', 'Equal', '+');
  await sleep(300);
  const zoomAfter = await evaluate("document.getElementById('zoom-text').textContent");
  check('+ zooms in', zoomBefore !== zoomAfter, zoomBefore + ' -> ' + zoomAfter);
  await key('d', 'KeyD', 'd');
  await sleep(200);
  check('D shows every detail', (await evaluate("document.querySelector('#stage svg').getAttribute('data-zoom')")) === '3');
  await key('d', 'KeyD', 'd');
  await key('o', 'KeyO', 'o');
  await sleep(200);
  check('O opens the outline', (await evaluate("!document.getElementById('outline').hidden")) === true);
  await key('Escape', 'Escape', '');
  await sleep(200);
  check('Esc closes the outline', (await evaluate("document.getElementById('outline').hidden")) === true);
  const themeBefore = await evaluate("document.documentElement.getAttribute('data-theme')");
  await key('t', 'KeyT', 't');
  await sleep(200);
  const themeAfter = await evaluate("document.documentElement.getAttribute('data-theme')");
  check('T switches the theme', themeBefore !== themeAfter, themeBefore + ' -> ' + themeAfter);
  await key('t', 'KeyT', 't');
  await key('/', 'Slash', '/');
  await sleep(200);
  check('/ opens search', (await evaluate("!document.getElementById('find').hidden && document.activeElement && document.activeElement.id === 'find-input'")) === true);
  await evaluate("var f=document.getElementById('find-input');f.value='flashcard';f.dispatchEvent(new Event('input',{bubbles:true}))");
  await sleep(300);
  const found = await evaluate("document.getElementById('find-list').children.length");
  check('search finds "flashcard"', found > 0, found + ' results');
  await key('Escape', 'Escape', '');
  await sleep(200);

  // 4. Enter on a diagram part opens it; Esc goes back up
  await evaluate("location.hash='#/v/system'");
  await sleep(400);
  await evaluate("document.querySelector('#stage a[data-id=\"api\"]').focus()");
  await key('Enter', 'Enter', '\r');
  await sleep(400);
  const afterEnter = await evaluate('location.hash');
  check('Enter on the API box opens a view or its sheet', afterEnter !== '#/v/system', afterEnter);
  await key('Escape', 'Escape', '');
  await sleep(400);
  await key('Escape', 'Escape', '');
  await sleep(400);
  check('Esc goes back up', /#\/v\/system/.test(await evaluate('location.hash')), await evaluate('location.hash'));

  // 5. a part's sheet
  await evaluate("location.hash='#/p/' + encodeURIComponent('mw:writeLimiter')");
  await sleep(400);
  const sheet = await evaluate("({open:!document.getElementById('sheet').hidden,name:document.getElementById('sheet-name').textContent,text:document.getElementById('sheet-body').textContent.slice(0,200)})");
  check('sheet for mw:writeLimiter', sheet.open && /writeLimiter/.test(sheet.name), JSON.stringify(sheet).slice(0, 160));
  await shot('sheet-writeLimiter');
  await key('Escape', 'Escape', '');

  // 6. docs and anchors
  await evaluate("location.hash='#/doc/rate-limits/how-does-the-atlas-flashcard-limit-work'");
  await sleep(800);
  const anchor = await evaluate("(function(){var h=document.getElementById('s-how-does-the-atlas-flashcard-limit-work');if(!h){return 'missing';}var r=h.getBoundingClientRect();return Math.round(r.top)+' of '+window.innerHeight;})()");
  check('doc anchor scrolls into view', /^\d+ of/.test(anchor) && parseInt(anchor, 10) < 400 && parseInt(anchor, 10) >= 0, anchor);
  await shot('doc-anchor');

  // 7. term card after a 1.5 s hover
  await evaluate("location.hash='#/doc/uploads-and-file-safety'");
  await sleep(600);
  const termBox = await evaluate("(function(){var t=document.querySelector('#doc-body .term');if(!t){return null;}t.scrollIntoView({block:'center'});var r=t.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2,key:t.getAttribute('data-term')};})()");
  if (termBox) {
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: termBox.x, y: termBox.y });
    await sleep(700);
    const early = await evaluate("document.getElementById('tip').hidden");
    await sleep(1200);
    const tip = await evaluate("({hidden:document.getElementById('tip').hidden,text:document.getElementById('tip').textContent})");
    check('term card waits before showing', early === true);
    check('term card shows after 1.5 s (' + termBox.key + ')', tip.hidden === false && /In plain words/.test(tip.text) && /Ask Rem/.test(tip.text), tip.text.slice(0, 100));
    await shot('term-card');
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 5 });
    await sleep(600);
  } else {
    check('a term is marked in the uploads doc', false);
  }

  // 8. glossary page renders code
  await evaluate("location.hash='#/terms'");
  await sleep(500);
  const glossary = await evaluate("({entries:document.querySelectorAll('.term-entry').length,code:document.querySelectorAll('.term-entry code').length})");
  check('glossary page', glossary.entries > 100 && glossary.code > 0, JSON.stringify(glossary));

  // 9. chat bubble
  await evaluate("document.getElementById('bubble').click()");
  await sleep(300);
  const chat = await evaluate("({open:!document.getElementById('chat').hidden,note:document.getElementById('chat-note').textContent.slice(0,120),focus:document.activeElement?document.activeElement.id:''})");
  check('chat pane opens from the bubble, focus inside', chat.open && (chat.focus === 'chat-input' || chat.focus === 'chat-close'), JSON.stringify(chat));
  await shot('chat');
  await key('Escape', 'Escape', '');
  await sleep(200);
  check('Esc closes the chat and focus returns', (await evaluate("document.getElementById('chat').hidden && document.activeElement && document.activeElement.id === 'bubble'")) === true);

  // 10. generated page view
  await evaluate("location.hash='#/v/page.StudyPage?z=1.6'");
  await sleep(500);
  await shot('page-study');

  check('no script errors', errors.length === 0, errors.slice(0, 5).join(' | '));
  ws.close();
  edge.kill();
  const failed = results.filter(function (r) {
    return !r.ok;
  }).length;
  console.log('\n' + (results.length - failed) + ' passed, ' + failed + ' failed. Screenshots in ' + OUT);
  process.exit(failed ? 1 : 0);
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
