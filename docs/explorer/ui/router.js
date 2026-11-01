// Every place in the explorer has an address after the #, so the browser's Back and
// Forward buttons work and any view can be shared as a link:
//   #/                      the overview diagram
//   #/v/<view>?p=&n=&z=&d=  a diagram (p: open a part's sheet, n: focus a box,
//                           z: zoom, d=1: show every detail)
//   #/p/<part>              a part, shown in its home diagram
//   #/docs, #/doc/<file>/<section>   the docs reader
//   #/terms, #/terms/<term>          the glossary
//   #/find?q=               search
(function () {
  var PAGES = ['view-page', 'doc-page', 'terms-page', 'hub-page'];
  var first = true;

  function parse() {
    var raw = window.location.hash.replace(/^#/, '') || '/';
    var queryAt = raw.indexOf('?');
    var path = queryAt === -1 ? raw : raw.slice(0, queryAt);
    var params = {};
    if (queryAt !== -1) {
      var pairs = raw.slice(queryAt + 1).split('&');
      for (var i = 0; i < pairs.length; i++) {
        if (pairs[i] === '') {
          continue;
        }
        var eq = pairs[i].indexOf('=');
        var key = eq === -1 ? pairs[i] : pairs[i].slice(0, eq);
        var value = eq === -1 ? '' : pairs[i].slice(eq + 1);
        params[decodeURIComponent(key)] = decodeURIComponent(value.replace(/\+/g, ' '));
      }
    }
    var parts = [];
    var segments = path.split('/');
    for (var s = 0; s < segments.length; s++) {
      if (segments[s] !== '') {
        parts.push(decodeURIComponent(segments[s]));
      }
    }
    return { parts: parts, params: params };
  }

  function showPage(id) {
    for (var i = 0; i < PAGES.length; i++) {
      var page = document.getElementById(PAGES[i]);
      if (page) {
        page.hidden = PAGES[i] !== id;
      }
    }
    document.body.setAttribute('data-page', id);
  }

  function route() {
    var where = parse();
    var kind = where.parts[0] || '';
    var params = where.params;
    var isFirst = first;
    first = false;
    AX.tip.hide();
    if (kind === '' || kind === 'v') {
      var viewId = where.parts[1] || 'system';
      var spec = AX.views[viewId];
      if (spec && (spec.type === 'hub' || spec.type === 'catalogue')) {
        showPage('hub-page');
        AX.hub.show(spec, params);
      } else {
        showPage('view-page');
        AX.canvas.show(viewId, params, isFirst);
      }
    } else if (kind === 'p') {
      var piece = AX.DATA.pieces[where.parts[1]];
      var home = piece && piece.home && AX.views[piece.home] ? piece.home : 'system';
      window.location.replace('#/v/' + home + '?p=' + encodeURIComponent(where.parts[1]) + (piece && piece.node ? '&n=' + encodeURIComponent(piece.node) : ''));
      return;
    } else if (kind === 'docs' || kind === 'doc') {
      showPage('doc-page');
      AX.reader.show(where.parts[1] || '', where.parts[2] || '', isFirst);
    } else if (kind === 'terms') {
      showPage('doc-page');
      AX.glossary.show(where.parts[1] || '', isFirst);
    } else if (kind === 'find') {
      AX.findUi.open(params.q || '');
      return;
    } else {
      showPage('view-page');
      AX.canvas.show('system', {}, isFirst);
    }
    if (params.theme === 'light' || params.theme === 'dark') {
      AX.shell.setTheme(params.theme, false);
    }
  }

  // Moves keyboard focus to the new page's heading, like Atlas does on page changes.
  function focusHeading(id, isFirst) {
    if (isFirst) {
      return;
    }
    var heading = document.getElementById(id);
    if (heading) {
      heading.focus({ preventScroll: true });
    }
  }

  function go(hash) {
    if (window.location.hash === hash) {
      route();
    } else {
      window.location.hash = hash;
    }
  }

  // Back returns to the previous place in the explorer; on the first page it goes up.
  function back() {
    if (AX.router.steps > 0) {
      AX.router.steps -= 2;
      window.history.back();
    } else {
      AX.shell.up();
    }
  }

  AX.router = {
    parse: parse,
    route: route,
    go: go,
    back: back,
    focusHeading: focusHeading,
    steps: 0,
  };

  window.addEventListener('hashchange', function () {
    AX.router.steps += 1;
    route();
  });
})();
