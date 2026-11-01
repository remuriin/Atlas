// Pages that list other diagrams (Processes, Flows, Logic) and the endpoint catalogue.
(function () {
  function card(spec) {
    return AX.h('li', null, AX.h('a', { class: 'hub-card', href: '#/v/' + spec.id }, [
      AX.h('span', { class: 'menu-type', text: spec.eyebrow || spec.type.toUpperCase() }),
      AX.h('strong', { class: 'hub-name', text: spec.title }),
      AX.h('span', { class: 'hub-text', text: spec.purpose || '' }),
    ]));
  }

  function showHub(spec) {
    var page = document.getElementById('hub-body');
    AX.clear(page);
    var list = AX.h('ul', { class: 'hub-list' });
    var items = spec.items || [];
    for (var i = 0; i < items.length; i++) {
      if (AX.views[items[i]]) {
        list.appendChild(card(AX.views[items[i]]));
      }
    }
    page.appendChild(list);
  }

  function showCatalogue(spec, params) {
    var page = document.getElementById('hub-body');
    AX.clear(page);
    var rows = AX.DATA.endpoints || [];
    var filter = AX.h('input', {
      class: 'field-input', type: 'search', id: 'endpoint-filter', placeholder: 'Filter by path, method or who can call it',
      'aria-label': 'Filter endpoints', value: params.q || '',
    });
    var table = AX.h('table', { class: 'catalogue' });
    table.appendChild(AX.h('thead', null, AX.h('tr', null, [
      AX.h('th', { scope: 'col', text: 'Method' }),
      AX.h('th', { scope: 'col', text: 'Path' }),
      AX.h('th', { scope: 'col', text: 'Who' }),
      AX.h('th', { scope: 'col', text: 'Checks, in order' }),
      AX.h('th', { scope: 'col', text: 'What it does' }),
    ])));
    var body = AX.h('tbody');
    table.appendChild(body);
    function fill(query) {
      AX.clear(body);
      var words = AX.find.words(query);
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        var hay = (row.method + ' ' + row.path + ' ' + row.who + ' ' + row.chain.join(' ') + ' ' + row.summary).toLowerCase();
        var ok = true;
        for (var w = 0; w < words.length; w++) {
          if (hay.indexOf(words[w]) === -1) {
            ok = false;
          }
        }
        if (!ok) {
          continue;
        }
        var link = AX.views[row.view] ? AX.h('a', { href: '#/v/' + row.view, class: 'code', text: row.path }) : AX.h('span', { class: 'code', text: row.path });
        body.appendChild(AX.h('tr', null, [
          AX.h('td', null, AX.h('span', { class: 'method ' + row.method.toLowerCase(), text: row.method })),
          AX.h('td', null, link),
          AX.h('td', { text: row.who }),
          AX.h('td', { class: 'code small', text: row.chain.join(' → ') }),
          AX.h('td', { text: row.summary }),
        ]));
      }
    }
    filter.addEventListener('input', function () {
      fill(filter.value);
    });
    fill(params.q || '');
    page.appendChild(filter);
    page.appendChild(AX.h('div', { class: 'table-wrap' }, table));
  }

  function show(spec, params) {
    AX.shell.setTrack(trackItems(spec), spec.parent ? '#/v/' + spec.parent : '#/');
    document.getElementById('hub-eyebrow').textContent = spec.eyebrow || 'DIAGRAMS';
    document.getElementById('hub-title').textContent = spec.title;
    document.getElementById('hub-purpose').textContent = spec.purpose || '';
    document.title = spec.title + ' · Atlas Explorer';
    if (spec.type === 'catalogue') {
      showCatalogue(spec, params);
    } else {
      showHub(spec);
    }
    AX.router.focusHeading('hub-title', false);
  }

  function trackItems(spec) {
    var chain = AX.shell.chainOf(spec);
    var items = [];
    for (var i = 0; i < chain.length; i++) {
      items.push({ label: i === 0 ? 'Atlas' : chain[i].title, href: '#/v/' + chain[i].id });
    }
    return items;
  }

  AX.hub = {
    show: show,
  };
})();
