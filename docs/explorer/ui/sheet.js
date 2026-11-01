// The detail sheet: everything about one part of Atlas, in plain words first, then
// the technical side, the facts from the code, what it uses and what uses it, the
// diagrams it appears in and the docs that explain it.
(function () {
  var KIND_NAMES = {
    page: 'Page', comp: 'Component', ctx: 'Context', svc: 'Frontend service', fn: 'Service function',
    ep: 'API endpoint', mw: 'Middleware', ctl: 'Controller', handler: 'Request handler', model: 'Model function', mfile: 'Model',
    util: 'Utility', cfg: 'Config', table: 'Database table', col: 'Column', idx: 'Index', env: 'Setting',
    ext: 'Outside service', infra: 'Infrastructure', store: 'Storage', script: 'Script', style: 'Stylesheet',
    role: 'Database role', concept: 'Concept', layer: 'Layer', app: 'App', route: 'Router', file: 'File',
  };

  var openId = '';
  var returnFocus = null;

  function kindName(kind) {
    return KIND_NAMES[kind] || kind;
  }

  function pieceLink(id) {
    var piece = AX.DATA.pieces[id];
    if (!piece) {
      return AX.h('span', { class: 'code', text: id });
    }
    return AX.h('a', { href: '#/p/' + encodeURIComponent(id), class: 'chip-link' }, [
      AX.h('span', { class: 'chip-kind', text: kindName(piece.kind) }),
      AX.h('span', { text: piece.name }),
    ]);
  }

  function section(title, body) {
    return AX.h('section', { class: 'sheet-part' }, [AX.h('h3', { class: 'sheet-title', text: title }), body]);
  }

  function list(ids) {
    var ul = AX.h('ul', { class: 'chip-list' });
    for (var i = 0; i < ids.length && i < 40; i++) {
      ul.appendChild(AX.h('li', null, pieceLink(ids[i])));
    }
    if (ids.length > 40) {
      ul.appendChild(AX.h('li', { class: 'muted', text: '+ ' + (ids.length - 40) + ' more' }));
    }
    return ul;
  }

  function open(id) {
    var piece = AX.DATA.pieces[id];
    var sheet = document.getElementById('sheet');
    var body = document.getElementById('sheet-body');
    if (!piece) {
      AX.clear(body);
      body.appendChild(AX.h('p', { text: 'There are no details for "' + id + '" yet.' }));
      sheet.hidden = false;
      return;
    }
    if (sheet.hidden) {
      returnFocus = document.activeElement;
    }
    openId = id;
    AX.clear(body);
    document.getElementById('sheet-kind').textContent = kindName(piece.kind);
    document.getElementById('sheet-name').textContent = piece.title || piece.name;
    var code = document.getElementById('sheet-code');
    code.textContent = piece.title && piece.title !== piece.name ? piece.name : '';
    if (piece.plain) {
      body.appendChild(section('In plain words', AX.reader.richText(piece.plain)));
    }
    if (piece.tech) {
      body.appendChild(section('Technical', AX.reader.richText(piece.tech)));
    }
    if (piece.header && piece.header !== piece.plain) {
      body.appendChild(section('From the code', AX.h('p', { class: 'quote', text: piece.header })));
    }
    if (piece.facts && piece.facts.length > 0) {
      var table = AX.h('dl', { class: 'facts' });
      for (var f = 0; f < piece.facts.length; f++) {
        table.appendChild(AX.h('dt', { text: piece.facts[f][0] }));
        table.appendChild(AX.h('dd', null, AX.reader.richText(String(piece.facts[f][1]), true)));
      }
      body.appendChild(section('Facts', table));
    }
    if (piece.path) {
      body.appendChild(section('Source', AX.h('p', null, AX.h('a', {
        href: 'https://github.com/remuriin/Atlas/blob/main/' + piece.path, target: '_blank', rel: 'noopener noreferrer', class: 'code',
        text: piece.path,
      }))));
    }
    if (piece.uses && piece.uses.length > 0) {
      body.appendChild(section('Uses', list(piece.uses)));
    }
    if (piece.usedBy && piece.usedBy.length > 0) {
      body.appendChild(section('Used by', list(piece.usedBy)));
    }
    if (piece.appearsIn && piece.appearsIn.length > 0) {
      var where = AX.h('ul', { class: 'chip-list' });
      for (var a = 0; a < piece.appearsIn.length; a++) {
        var place = piece.appearsIn[a];
        if (!AX.views[place.view]) {
          continue;
        }
        where.appendChild(AX.h('li', null, AX.h('a', {
          class: 'chip-link', href: '#/v/' + place.view + '?n=' + encodeURIComponent(place.node) + '&p=' + encodeURIComponent(id),
          text: AX.views[place.view].title,
        })));
      }
      body.appendChild(section('Appears in', where));
    }
    if (piece.docs && piece.docs.length > 0) {
      var docs = AX.h('ul', { class: 'link-list' });
      for (var d = 0; d < piece.docs.length; d++) {
        var doc = piece.docs[d];
        docs.appendChild(AX.h('li', null, AX.h('a', { href: '#/doc/' + doc.file + (doc.slug ? '/' + doc.slug : ''), text: doc.title })));
      }
      body.appendChild(section('Read more', docs));
    }
    var actions = AX.h('div', { class: 'sheet-actions' });
    if (piece.opens && AX.views[piece.opens] && AX.canvas.current() !== piece.opens) {
      actions.appendChild(AX.h('a', { class: 'button-green', href: '#/v/' + piece.opens, text: 'Open its full picture' }));
    }
    actions.appendChild(AX.h('button', {
      class: 'button', type: 'button', text: 'Ask Rem about this',
      onclick: function () {
        AX.chat.ask('Explain ' + (piece.title || piece.name) + ' in Atlas: what it does and what it connects to.');
      },
    }));
    body.appendChild(actions);
    sheet.hidden = false;
    document.body.setAttribute('data-sheet', 'open');
    document.getElementById('sheet-name').focus({ preventScroll: true });
  }

  // fromRoute: the address no longer names a part, so just hide without changing it.
  function close(fromRoute) {
    var sheet = document.getElementById('sheet');
    if (sheet.hidden) {
      return false;
    }
    sheet.hidden = true;
    openId = '';
    document.body.removeAttribute('data-sheet');
    if (!fromRoute) {
      var where = AX.router.parse();
      if (where.params.p) {
        var view = where.parts[1] || 'system';
        window.history.replaceState(null, '', '#/v/' + view);
      }
      if (returnFocus && returnFocus.focus) {
        returnFocus.focus({ preventScroll: true });
      }
    }
    return true;
  }

  function init() {
    document.getElementById('sheet-close').addEventListener('click', function () {
      close(false);
    });
  }

  AX.sheet = {
    init: init,
    open: open,
    close: close,
    isOpen: function () {
      return openId !== '';
    },
    kindName: kindName,
  };
})();
