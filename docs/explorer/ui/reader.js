// The docs reader: all the Atlas docs inside the file, with an index on the left,
// the document in the middle and "On this page" on the right. The HTML of each doc
// is made by the build from the Markdown files in docs/knowledge.
(function () {
  var cachedMatcher = null;

  function docByStem(stem) {
    var docs = AX.DATA.docs;
    for (var i = 0; i < docs.length; i++) {
      if (docs[i].stem === stem) {
        return docs[i];
      }
    }
    return null;
  }

  // The term finder built from the glossary (shared with the chat and the sheet).
  function matcher() {
    if (!cachedMatcher) {
      var list = [];
      var keys = Object.keys(AX.DATA.terms);
      for (var i = 0; i < keys.length; i++) {
        var term = AX.DATA.terms[keys[i]];
        list.push({ key: keys[i], term: term.term, aliases: term.aliases || [] });
      }
      cachedMatcher = AX.terms.buildMatcher(list, AX.DATA.termSkip || []);
    }
    return cachedMatcher;
  }

  // A short text with Markdown bits (`code`, **bold**, links) and term marks, as a <p>.
  // noTerms leaves the terms unmarked (inside a term's own card).
  function richText(text, asSpan, noTerms) {
    var node = AX.h(asSpan ? 'span' : 'p');
    var blocks = AX.md.parseInline(text);
    appendInline(node, blocks, noTerms ? null : {});
    return node;
  }

  // used: the terms marked so far, or null to mark none.
  function appendInline(parent, pieces, used) {
    for (var i = 0; i < pieces.length; i++) {
      var piece = pieces[i];
      if (piece.t === 'text' && used === null) {
        parent.appendChild(document.createTextNode(piece.v));
      } else if (piece.t === 'text') {
        var marked = AX.terms.markTerms(piece.v, matcher(), used, 3);
        for (var m = 0; m < marked.length; m++) {
          if (marked[m].t === 'term') {
            parent.appendChild(AX.h('button', { type: 'button', class: 'term', 'data-term': marked[m].key, text: marked[m].v }));
          } else {
            parent.appendChild(document.createTextNode(marked[m].v));
          }
        }
      } else if (piece.t === 'code') {
        parent.appendChild(AX.h('code', { text: piece.v }));
      } else if (piece.t === 'link') {
        var link = AX.h('a', { href: piece.href });
        appendInline(link, piece.kids, used);
        parent.appendChild(link);
      } else {
        var wrap = AX.h(piece.t === 'strong' ? 'strong' : 'em');
        appendInline(wrap, piece.kids, used);
        parent.appendChild(wrap);
      }
    }
  }

  function renderIndex(currentStem) {
    var nav = document.getElementById('doc-index');
    AX.clear(nav);
    nav.appendChild(AX.h('h2', { class: 'index-title', text: 'Docs' }));
    var groups = AX.DATA.docGroups;
    for (var g = 0; g < groups.length; g++) {
      nav.appendChild(AX.h('p', { class: 'index-group', text: groups[g].title }));
      var list = AX.h('ul', { class: 'index-list' });
      for (var s = 0; s < groups[g].stems.length; s++) {
        var doc = docByStem(groups[g].stems[s]);
        if (!doc) {
          continue;
        }
        var attrs = { href: '#/doc/' + doc.stem, text: doc.title };
        if (doc.stem === currentStem) {
          attrs['aria-current'] = 'page';
        }
        list.appendChild(AX.h('li', null, AX.h('a', attrs)));
      }
      nav.appendChild(list);
    }
    nav.appendChild(AX.h('p', { class: 'index-group', text: 'Reference' }));
    var extra = AX.h('ul', { class: 'index-list' });
    var glossaryAttrs = { href: '#/terms', text: 'Glossary' };
    if (currentStem === '#terms') {
      glossaryAttrs['aria-current'] = 'page';
    }
    extra.appendChild(AX.h('li', null, AX.h('a', glossaryAttrs)));
    nav.appendChild(extra);
  }

  function renderOutline(doc) {
    var aside = document.getElementById('doc-outline');
    AX.clear(aside);
    if (!doc || doc.outline.length === 0) {
      return;
    }
    aside.appendChild(AX.h('h2', { class: 'index-title', text: 'On this page' }));
    var list = AX.h('ul', { class: 'index-list' });
    for (var i = 0; i < doc.outline.length; i++) {
      var entry = doc.outline[i];
      if (entry.level > 3) {
        continue;
      }
      list.appendChild(AX.h('li', { class: entry.level === 3 ? 'deep' : null }, AX.h('a', { href: '#/doc/' + doc.stem + '/' + entry.id, text: entry.text })));
    }
    aside.appendChild(list);
  }

  function show(stem, slug, isFirst) {
    if (stem === '') {
      stem = AX.DATA.docs.length > 0 ? AX.DATA.docs[0].stem : '';
    }
    var doc = docByStem(stem);
    var body = document.getElementById('doc-body');
    renderIndex(stem);
    if (!doc) {
      AX.clear(body);
      body.appendChild(AX.h('h1', { id: 'doc-title', tabindex: '-1', text: 'No such document' }));
      body.appendChild(AX.h('p', { text: 'There is no doc called "' + stem + '". Pick one from the index.' }));
      renderOutline(null);
      return;
    }
    if (body.getAttribute('data-stem') !== doc.stem) {
      body.innerHTML = doc.html;
      body.setAttribute('data-stem', doc.stem);
      body.scrollTop = 0;
      window.scrollTo(0, 0);
    }
    renderOutline(doc);
    var items = [{ label: 'Atlas', href: '#/' }, { label: 'Docs', href: '#/docs' }, { label: doc.title, href: '#/doc/' + doc.stem }];
    var target = null;
    if (slug) {
      target = document.getElementById('s-' + slug);
      for (var i = 0; i < doc.outline.length; i++) {
        if (doc.outline[i].id === slug) {
          items.push({ label: doc.outline[i].text, href: '' });
        }
      }
    }
    AX.shell.setTrack(items, '#/docs');
    document.title = doc.title + ' · Atlas Explorer';
    if (target) {
      target.scrollIntoView({ block: 'start' });
      if (!isFirst) {
        target.focus({ preventScroll: true });
      }
    } else {
      AX.router.focusHeading('doc-title', isFirst);
    }
  }

  // "Ask Rem about this section" buttons and doc links are handled here.
  function onClick(event) {
    var ask = event.target.closest('[data-ask]');
    if (ask) {
      AX.chat.ask(ask.getAttribute('data-ask'));
    }
  }

  function init() {
    document.getElementById('doc-body').addEventListener('click', onClick);
  }

  AX.reader = {
    init: init,
    show: show,
    docByStem: docByStem,
    matcher: matcher,
    richText: richText,
    renderIndex: renderIndex,
    renderOutline: renderOutline,
  };
})();
