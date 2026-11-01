// The search box (press / or Ctrl+K): finds diagrams, parts of Atlas, glossary terms
// and doc sections. Arrow keys move through the results, Enter opens one.
(function () {
  var entries = null;
  var results = [];
  var active = -1;
  var returnFocus = null;

  function buildIndex() {
    var list = [];
    for (var v = 0; v < AX.viewOrder.length; v++) {
      var spec = AX.views[AX.viewOrder[v]];
      list.push({ title: spec.title, code: '', kind: 'Diagram ' + (spec.eyebrow || spec.type), text: spec.purpose || '', href: '#/v/' + spec.id, group: 'Diagram' });
    }
    var ids = Object.keys(AX.DATA.pieces);
    for (var p = 0; p < ids.length; p++) {
      var piece = AX.DATA.pieces[ids[p]];
      list.push({
        title: piece.title || piece.name, code: piece.name, kind: AX.sheet.kindName(piece.kind),
        text: (piece.plain || '') + ' ' + (piece.path || ''), href: '#/p/' + encodeURIComponent(ids[p]), group: AX.sheet.kindName(piece.kind),
      });
    }
    var keys = Object.keys(AX.DATA.terms);
    for (var t = 0; t < keys.length; t++) {
      var term = AX.DATA.terms[keys[t]];
      list.push({ title: term.term, code: (term.aliases || []).join(' '), kind: 'Glossary term', text: term.plain, href: '#/terms/' + encodeURIComponent(keys[t]), group: 'Term' });
    }
    for (var d = 0; d < AX.DATA.docs.length; d++) {
      var doc = AX.DATA.docs[d];
      list.push({ title: doc.title, code: doc.stem, kind: 'Doc', text: doc.intro || '', href: '#/doc/' + doc.stem, group: 'Doc' });
      for (var o = 0; o < doc.outline.length; o++) {
        list.push({ title: doc.outline[o].text, code: '', kind: 'Doc section ' + doc.title, text: '', href: '#/doc/' + doc.stem + '/' + doc.outline[o].id, group: doc.title });
      }
    }
    return list;
  }

  function render() {
    var box = document.getElementById('find-list');
    AX.clear(box);
    for (var i = 0; i < results.length; i++) {
      var entry = results[i].entry;
      var option = AX.h('li', {
        role: 'option', id: 'find-' + i, class: 'find-item', 'aria-selected': i === active ? 'true' : 'false',
        'data-href': entry.href,
      }, [
        AX.h('span', { class: 'find-kind', text: entry.group }),
        AX.h('span', { class: 'find-title', text: entry.title }),
      ]);
      box.appendChild(option);
    }
    var input = document.getElementById('find-input');
    if (active >= 0) {
      input.setAttribute('aria-activedescendant', 'find-' + active);
      var current = document.getElementById('find-' + active);
      if (current) {
        current.scrollIntoView({ block: 'nearest' });
      }
    } else {
      input.removeAttribute('aria-activedescendant');
    }
    var status = document.getElementById('find-status');
    var query = input.value.trim();
    status.textContent = query === '' ? 'Type to search diagrams, parts, terms and docs.' : (results.length === 0 ? 'Nothing found for "' + query + '".' : results.length + ' results');
  }

  function update() {
    if (!entries) {
      entries = buildIndex();
    }
    results = AX.find.search(entries, document.getElementById('find-input').value);
    active = results.length > 0 ? 0 : -1;
    render();
  }

  function choose(index) {
    if (index < 0 || index >= results.length) {
      return;
    }
    var href = results[index].entry.href;
    close(false);
    AX.router.go(href);
  }

  function open(query) {
    var overlay = document.getElementById('find');
    if (overlay.hidden) {
      returnFocus = document.activeElement;
    }
    overlay.hidden = false;
    var input = document.getElementById('find-input');
    input.value = query || '';
    update();
    input.focus();
    input.select();
  }

  function close(restore) {
    var overlay = document.getElementById('find');
    if (overlay.hidden) {
      return false;
    }
    overlay.hidden = true;
    if (restore !== false && returnFocus && returnFocus.focus) {
      returnFocus.focus({ preventScroll: true });
    }
    return true;
  }

  function init() {
    var input = document.getElementById('find-input');
    input.addEventListener('input', update);
    input.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        active = Math.min(results.length - 1, active + 1);
        render();
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        active = Math.max(0, active - 1);
        render();
      } else if (event.key === 'Enter') {
        event.preventDefault();
        choose(active);
      }
    });
    document.getElementById('find-list').addEventListener('click', function (event) {
      var item = event.target.closest('.find-item');
      if (item) {
        choose(parseInt(item.id.replace('find-', ''), 10));
      }
    });
    document.getElementById('find-btn').addEventListener('click', function () {
      open('');
    });
    document.getElementById('find').addEventListener('click', function (event) {
      if (event.target.id === 'find') {
        close();
      }
    });
  }

  AX.findUi = {
    init: init,
    open: open,
    close: close,
  };
})();
