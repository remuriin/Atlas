// Rem, the chat bubble in the corner of every page. It sends your question to the
// Atlas docs service on Rem RaaS, which finds the matching parts of the Atlas docs and
// has Google Gemini write the answer from them. Answers list the doc sections they
// came from; click one to read it here.
(function () {
  var STORE_KEY = 'atlas-explorer-chat';
  var MAX_STORED = 40;
  var MAX_QUESTION = 2000;
  var TIMEOUT = 60000;
  var messages = [];
  var busy = false;
  var lastSent = 0;
  var matcher = null;

  function config() {
    return AX.DATA.chat;
  }

  function save() {
    AX.store.setSession(STORE_KEY, JSON.stringify(messages.slice(-MAX_STORED)));
  }

  function load() {
    var raw = AX.store.getSession(STORE_KEY);
    if (!raw) {
      return;
    }
    try {
      var list = JSON.parse(raw);
      if (Array.isArray(list)) {
        messages = list;
      }
    } catch (err) {
      messages = [];
    }
  }

  // ---------- turning an answer into page elements (never innerHTML) ----------

  function inline(pieces, parent, used) {
    for (var i = 0; i < pieces.length; i++) {
      var piece = pieces[i];
      if (piece.t === 'text') {
        var marked = AX.terms.markTerms(piece.v, matcher, used, 4);
        for (var m = 0; m < marked.length; m++) {
          if (marked[m].t === 'term') {
            parent.appendChild(AX.h('button', { type: 'button', class: 'term', 'data-term': marked[m].key, text: marked[m].v }));
          } else {
            parent.appendChild(document.createTextNode(marked[m].v));
          }
        }
      } else if (piece.t === 'code') {
        parent.appendChild(AX.h('code', { text: piece.v }));
      } else if (piece.t === 'strong' || piece.t === 'em') {
        var wrap = AX.h(piece.t === 'strong' ? 'strong' : 'em');
        inline(piece.kids, wrap, used);
        parent.appendChild(wrap);
      } else if (piece.t === 'link') {
        var href = linkTarget(piece.href);
        if (href) {
          var link = AX.h('a', { href: href });
          if (href.indexOf('http') === 0) {
            link.setAttribute('target', '_blank');
            link.setAttribute('rel', 'noopener noreferrer');
          }
          inline(piece.kids, link, used);
          parent.appendChild(link);
        } else {
          inline(piece.kids, parent, used);
        }
      }
    }
  }

  // Only web links and links to Atlas docs are kept.
  function linkTarget(href) {
    if (/^https?:\/\//i.test(href)) {
      return href;
    }
    var doc = href.match(/^([a-z0-9-]+)\.md(?:#([\w-]+))?$/i);
    if (doc) {
      return '#/doc/' + doc[1] + (doc[2] ? '/' + doc[2] : '');
    }
    return '';
  }

  function renderMarkdown(text, parent) {
    var blocks = AX.md.parseBlocks(text);
    var used = {};
    for (var i = 0; i < blocks.length; i++) {
      var block = blocks[i];
      var node;
      if (block.type === 'h') {
        node = AX.h('p', { class: 'chat-head' });
        inline(AX.md.parseInline(block.text), node, used);
      } else if (block.type === 'ul' || block.type === 'ol') {
        node = AX.h(block.type);
        for (var j = 0; j < block.items.length; j++) {
          var li = AX.h('li');
          inline(AX.md.parseInline(block.items[j]), li, used);
          node.appendChild(li);
        }
      } else if (block.type === 'code') {
        node = AX.h('pre', null, AX.h('code', { text: block.text }));
      } else {
        node = AX.h('p');
        inline(AX.md.parseInline(block.text || ''), node, used);
      }
      parent.appendChild(node);
    }
  }

  // ---------- sources ----------

  // Finds the doc section a source points at: "Doc title > Section" in file.md.
  function sourceTarget(source) {
    var stem = String(source.source || '').replace(/\.md$/i, '');
    var doc = AX.reader.docByStem(stem);
    if (!doc) {
      return null;
    }
    var parts = String(source.heading || '').split(' > ');
    var last = parts[parts.length - 1];
    var id = '';
    for (var i = 0; i < doc.outline.length; i++) {
      if (doc.outline[i].text === last) {
        id = doc.outline[i].id;
        break;
      }
    }
    return { href: '#/doc/' + stem + (id ? '/' + id : ''), label: doc.title + (id && last !== doc.title ? ' › ' + last : '') };
  }

  function sourceList(sources) {
    var seen = {};
    var list = AX.h('ul', { class: 'source-list' });
    for (var i = 0; i < sources.length; i++) {
      var key = sources[i].source + '|' + sources[i].heading;
      if (seen[key]) {
        continue;
      }
      seen[key] = true;
      var target = sourceTarget(sources[i]);
      if (target) {
        list.appendChild(AX.h('li', null, AX.h('a', { class: 'source', href: target.href, text: target.label })));
      }
    }
    return list.childNodes.length > 0 ? list : null;
  }

  // ---------- the conversation ----------

  function render() {
    var log = document.getElementById('chat-log');
    AX.clear(log);
    if (messages.length === 0) {
      log.appendChild(AX.h('div', { class: 'chat-empty' }, [
        AX.h('p', { text: 'Ask anything about Atlas: how sign-in works, what happens to an upload, why flashcards can come out fewer than you asked for.' }),
        AX.h('p', { class: 'muted', text: 'Rem answers only from the Atlas docs. Your question goes to the Rem service and Google Gemini.' }),
      ]));
    }
    for (var i = 0; i < messages.length; i++) {
      var message = messages[i];
      var bubble = AX.h('div', { class: message.role === 'user' ? 'msg you' : 'msg rem' });
      bubble.appendChild(AX.h('p', { class: 'msg-who', text: message.role === 'user' ? 'You' : 'Rem' }));
      if (message.role === 'user') {
        bubble.appendChild(AX.h('p', { text: message.content }));
      } else if (message.error) {
        bubble.appendChild(AX.h('p', { class: 'msg-error', text: message.content }));
      } else {
        renderMarkdown(message.content, bubble);
        if (message.answered === false) {
          bubble.appendChild(AX.h('p', { class: 'muted small', text: 'The Atlas docs do not cover this.' }));
        }
        var sources = sourceList(message.sources || []);
        if (sources) {
          bubble.appendChild(AX.h('p', { class: 'msg-who', text: 'From the docs' }));
          bubble.appendChild(sources);
        }
      }
      log.appendChild(bubble);
    }
    if (busy) {
      log.appendChild(AX.h('div', { class: 'msg rem' }, [AX.h('p', { class: 'msg-who', text: 'Rem' }), AX.h('p', { class: 'typing', text: 'Looking in the docs…' })]));
    }
    log.scrollTop = log.scrollHeight;
  }

  function history() {
    var turns = [];
    for (var i = 0; i < messages.length; i++) {
      if (!messages[i].error) {
        turns.push({ role: messages[i].role, content: String(messages[i].content).slice(0, 500) });
      }
    }
    return turns.slice(-6);
  }

  function errorFor(status, body) {
    if (status === 400 && body && body.error) {
      return body.error;
    }
    if (status === 401) {
      return 'This copy of the explorer has an old chat key. Ask whoever gave you the file for a fresh one.';
    }
    if (status === 429) {
      return 'Rem is busy answering others. Wait a few seconds and ask again.';
    }
    if (status === 503) {
      return 'Rem is restarting or the AI is busy. Try again in a moment.';
    }
    return 'Rem could not answer just now (error ' + status + '). Try again in a moment.';
  }

  function send(question) {
    var text = String(question).trim().slice(0, MAX_QUESTION);
    var cfg = config();
    if (text === '' || busy) {
      return;
    }
    if (!cfg) {
      return;
    }
    var wait = 2000 - (Date.now() - lastSent);
    if (wait > 0) {
      window.setTimeout(function () {
        send(text);
      }, wait);
      return;
    }
    lastSent = Date.now();
    var past = history();
    messages.push({ role: 'user', content: text });
    busy = true;
    render();
    save();
    var controller = new AbortController();
    var timeout = window.setTimeout(function () {
      controller.abort();
    }, TIMEOUT);
    fetch(cfg.url + '/query', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + cfg.key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: text, topK: 6, markdown: true, history: past }),
      signal: controller.signal,
    }).then(function (response) {
      return response.json().catch(function () {
        return null;
      }).then(function (body) {
        if (!response.ok) {
          throw { status: response.status, body: body };
        }
        messages.push({ role: 'assistant', content: body.answer || '', sources: body.sources || [], answered: body.answered !== false });
      });
    }).catch(function (err) {
      var message;
      if (err && err.status) {
        message = errorFor(err.status, err.body);
      } else if (err && err.name === 'AbortError') {
        message = 'Rem took too long to answer. Try a shorter question.';
      } else if (!navigator.onLine) {
        message = 'You are offline. The diagrams and docs still work; the chat needs the internet.';
      } else {
        message = 'Could not reach Rem. It may be busy (too many questions at once) or offline. Try again in a moment.';
      }
      messages.push({ role: 'assistant', content: message, error: true });
    }).then(function () {
      window.clearTimeout(timeout);
      busy = false;
      render();
      save();
      AX.announce('Rem answered');
    });
  }

  // ---------- opening and closing ----------

  function open() {
    var pane = document.getElementById('chat');
    pane.hidden = false;
    document.getElementById('bubble').setAttribute('aria-expanded', 'true');
    render();
    // focus moves into the pane: the question box, or the close button when the chat is off
    var input = document.getElementById('chat-input');
    if (!input.disabled) {
      input.focus();
    } else {
      document.getElementById('chat-close').focus();
    }
  }

  function close() {
    var pane = document.getElementById('chat');
    if (pane.hidden) {
      return false;
    }
    pane.hidden = true;
    var bubble = document.getElementById('bubble');
    bubble.setAttribute('aria-expanded', 'false');
    bubble.focus();
    return true;
  }

  function toggle() {
    if (document.getElementById('chat').hidden) {
      open();
    } else {
      close();
    }
  }

  // Opens the chat and asks a question straight away (from a term card, a sheet, a doc).
  function ask(question) {
    open();
    if (!config()) {
      return;
    }
    send(question);
  }

  function init() {
    matcher = AX.reader.matcher();
    load();
    var input = document.getElementById('chat-input');
    var counter = document.getElementById('chat-count');
    document.getElementById('bubble').addEventListener('click', toggle);
    document.getElementById('chat-close').addEventListener('click', close);
    document.getElementById('chat-new').addEventListener('click', function () {
      messages = [];
      save();
      render();
      input.focus();
    });
    document.getElementById('chat-form').addEventListener('submit', function (event) {
      event.preventDefault();
      var value = input.value;
      input.value = '';
      counter.textContent = '0 / ' + MAX_QUESTION;
      send(value);
    });
    input.addEventListener('input', function () {
      counter.textContent = input.value.length + ' / ' + MAX_QUESTION;
    });
    input.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        document.getElementById('chat-send').click();
      }
    });
    if (!config()) {
      input.disabled = true;
      document.getElementById('chat-send').disabled = true;
      document.getElementById('chat-note').textContent = 'The chat is not set up in this copy of the explorer. The diagrams, docs and glossary all work offline.';
    }
  }

  AX.chat = {
    init: init,
    ask: ask,
    open: open,
    close: close,
    toggle: toggle,
    renderMarkdown: renderMarkdown,
  };
})();
