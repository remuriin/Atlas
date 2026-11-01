// The frame around every page: the header (Explore menu, Docs, Glossary, Search,
// theme, help), the root track (where you are, with Up and Back) and the heading
// of the current diagram.
(function () {
  var trackUp = '';

  // ---------- root track ----------

  // items: [{ label, href }]; the last one is the current page.
  function setTrack(items, upHref) {
    var list = document.getElementById('crumbs');
    AX.clear(list);
    for (var i = 0; i < items.length; i++) {
      var isLast = i === items.length - 1;
      var item = items[i];
      var inner = isLast ?
        AX.h('span', { 'aria-current': 'page', text: item.label }) :
        AX.h('a', { href: item.href, text: item.label });
      list.appendChild(AX.h('li', null, inner));
    }
    trackUp = upHref || '';
    document.getElementById('up-btn').disabled = trackUp === '';
  }

  function chainOf(spec) {
    var chain = [];
    var seen = {};
    while (spec && !seen[spec.id]) {
      seen[spec.id] = true;
      chain.unshift(spec);
      spec = spec.parent ? AX.views[spec.parent] : null;
    }
    return chain;
  }

  function up() {
    if (trackUp) {
      AX.router.go(trackUp);
    }
  }

  // ---------- diagram heading ----------

  function showView(spec) {
    var chain = chainOf(spec);
    var items = [];
    for (var i = 0; i < chain.length; i++) {
      items.push({ label: i === 0 ? 'Atlas' : chain[i].title, href: '#/v/' + chain[i].id });
    }
    if (chain.length === 1) {
      items[0].label = 'Atlas: ' + spec.title;
    }
    setTrack(items, spec.parent ? '#/v/' + spec.parent : '');
    document.getElementById('view-eyebrow').textContent = spec.eyebrow || spec.type.toUpperCase();
    document.getElementById('view-title').textContent = spec.title;
    document.getElementById('view-purpose').textContent = spec.purpose || '';
    document.title = spec.title + ' · Atlas Explorer';
    var actions = document.getElementById('view-actions');
    AX.clear(actions);
    if (spec.piece && AX.DATA.pieces[spec.piece]) {
      actions.appendChild(AX.h('a', { class: 'pill', href: '#/v/' + spec.id + '?p=' + encodeURIComponent(spec.piece), text: 'About this part' }));
    }
    actions.appendChild(AX.h('button', {
      class: 'pill', type: 'button', text: 'Ask Rem about this diagram',
      onclick: function () {
        AX.chat.ask('Walk me through "' + spec.title + '" in Atlas: what are its parts and how do they connect?');
      },
    }));
    var related = relatedViews(spec);
    for (var r = 0; r < related.length; r++) {
      actions.appendChild(AX.h('a', { class: 'pill quiet', href: '#/v/' + related[r].id, text: related[r].title }));
    }
  }

  // Other diagrams with the same parent, plus the diagrams this one points to.
  function relatedViews(spec) {
    var out = [];
    var ids = spec.related || [];
    for (var i = 0; i < ids.length; i++) {
      if (AX.views[ids[i]]) {
        out.push(AX.views[ids[i]]);
      }
    }
    return out.slice(0, 4);
  }

  function notFound(message) {
    setTrack([{ label: 'Atlas', href: '#/' }, { label: 'Not found', href: '' }], '#/');
    document.getElementById('view-eyebrow').textContent = 'NOT FOUND';
    document.getElementById('view-title').textContent = 'Nothing here';
    document.getElementById('view-purpose').textContent = message + ' Use the Explore menu or search to find it.';
    AX.clear(document.getElementById('view-actions'));
  }

  // ---------- explore menu ----------

  function buildMenu() {
    var menu = document.getElementById('explore-menu');
    var groups = {};
    var order = [];
    for (var i = 0; i < AX.viewOrder.length; i++) {
      var spec = AX.views[AX.viewOrder[i]];
      if (spec.generated) {
        continue;
      }
      var group = spec.group || 'More';
      if (!groups[group]) {
        groups[group] = [];
        order.push(group);
      }
      groups[group].push(spec);
    }
    for (var g = 0; g < order.length; g++) {
      var list = AX.h('ul', { class: 'menu-list' });
      for (var v = 0; v < groups[order[g]].length; v++) {
        var item = groups[order[g]][v];
        list.appendChild(AX.h('li', null, AX.h('a', { href: '#/v/' + item.id, class: 'menu-link' }, [
          AX.h('span', { class: 'menu-type', text: item.eyebrow || item.type.toUpperCase() }),
          AX.h('span', { text: item.title }),
        ])));
      }
      menu.appendChild(AX.h('section', { class: 'menu-group' }, [AX.h('h2', { class: 'menu-title', text: order[g] }), list]));
    }
    menu.addEventListener('click', function (event) {
      if (event.target.closest('a')) {
        closeMenu();
      }
    });
  }

  function toggleMenu() {
    var button = document.getElementById('explore-btn');
    var menu = document.getElementById('explore-menu');
    var open = menu.hidden;
    menu.hidden = !open;
    button.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      var firstLink = menu.querySelector('a');
      if (firstLink) {
        firstLink.focus();
      }
    }
  }

  function closeMenu() {
    var menu = document.getElementById('explore-menu');
    if (!menu.hidden) {
      menu.hidden = true;
      document.getElementById('explore-btn').setAttribute('aria-expanded', 'false');
      return true;
    }
    return false;
  }

  // ---------- theme ----------

  function setTheme(theme, save) {
    document.documentElement.setAttribute('data-theme', theme);
    var button = document.getElementById('theme-btn');
    button.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
    document.getElementById('theme-state').textContent = theme === 'dark' ? 'On' : 'Off';
    if (save) {
      AX.store.set('atlas-theme', theme);
    }
  }

  function toggleTheme() {
    var now = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    setTheme(now, true);
  }

  function init() {
    document.getElementById('explore-btn').addEventListener('click', toggleMenu);
    document.getElementById('theme-btn').addEventListener('click', toggleTheme);
    document.getElementById('up-btn').addEventListener('click', up);
    document.getElementById('back-btn').addEventListener('click', function () {
      AX.router.back();
    });
    document.addEventListener('click', function (event) {
      var menu = document.getElementById('explore-menu');
      if (!menu.hidden && !event.target.closest('#explore-menu') && !event.target.closest('#explore-btn')) {
        closeMenu();
      }
    });
    setTheme(document.documentElement.getAttribute('data-theme') || 'light', false);
    buildMenu();
  }

  AX.shell = {
    init: init,
    setTrack: setTrack,
    showView: showView,
    notFound: notFound,
    up: up,
    setTheme: setTheme,
    toggleTheme: toggleTheme,
    closeMenu: closeMenu,
    chainOf: chainOf,
  };
})();
