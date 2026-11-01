// The glossary page: every term from docs/knowledge/glossary.md, A to Z, each in
// plain words and technically, with links to ask Rem or see the term in a diagram.
(function () {
  function sortedKeys() {
    var keys = Object.keys(AX.DATA.terms);
    keys.sort(function (a, b) {
      return AX.DATA.terms[a].term.toLowerCase() < AX.DATA.terms[b].term.toLowerCase() ? -1 : 1;
    });
    return keys;
  }

  function show(key, isFirst) {
    var body = document.getElementById('doc-body');
    AX.reader.renderIndex('#terms');
    AX.reader.renderOutline(null);
    AX.clear(body);
    body.removeAttribute('data-stem');
    body.appendChild(AX.h('p', { class: 'doc-eyebrow', text: 'REFERENCE' }));
    body.appendChild(AX.h('h1', { id: 'doc-title', tabindex: '-1', text: 'Glossary' }));
    body.appendChild(AX.h('p', { class: 'lead', text: 'Every term used in Atlas, explained twice: in plain words, and technically. Hover over a dotted term anywhere in the explorer to see its card.' }));
    var keys = sortedKeys();
    var list = AX.h('div', { class: 'term-list' });
    var target = null;
    for (var i = 0; i < keys.length; i++) {
      var term = AX.DATA.terms[keys[i]];
      var heading = AX.h('h2', { id: 't-' + keys[i], tabindex: '-1', class: 'term-name', text: term.term });
      if (keys[i] === key) {
        target = heading;
      }
      var actions = AX.h('div', { class: 'term-actions' });
      actions.appendChild(AX.h('button', {
        class: 'pill', type: 'button', text: 'Ask Rem', 'data-ask': 'What does "' + term.term + '" mean in Atlas, and where is it used?',
      }));
      if (term.view && AX.views[term.view]) {
        actions.appendChild(AX.h('a', { class: 'pill quiet', href: '#/v/' + term.view + (term.node ? '?n=' + encodeURIComponent(term.node) : ''), text: 'Show in diagram' }));
      }
      list.appendChild(AX.h('section', { class: 'term-entry' }, [
        heading,
        AX.h('p', { class: 'tip-label', text: 'In plain words' }),
        AX.reader.richText(term.plain, false, true),
        AX.h('p', { class: 'tip-label', text: 'Technical' }),
        AX.reader.richText(term.tech, false, true),
        actions,
      ]));
    }
    body.appendChild(list);
    var items = [{ label: 'Atlas', href: '#/' }, { label: 'Glossary', href: '#/terms' }];
    if (target) {
      items.push({ label: AX.DATA.terms[key].term, href: '' });
    }
    AX.shell.setTrack(items, '#/');
    document.title = 'Glossary · Atlas Explorer';
    if (target) {
      target.scrollIntoView({ block: 'start' });
      if (!isFirst) {
        target.focus({ preventScroll: true });
      }
    } else {
      window.scrollTo(0, 0);
      AX.router.focusHeading('doc-title', isFirst);
    }
  }

  AX.glossary = {
    show: show,
  };
})();
