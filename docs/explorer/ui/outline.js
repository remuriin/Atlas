// The outline: the current diagram as a plain list of its boxes and connections, at
// every detail level, for screen readers and for anyone who prefers reading to zooming.
(function () {
  function describeEdge(item, names) {
    var from = names[item.from] || item.from;
    var to = names[item.to] || item.to;
    var kind = item.dash ? 'optional or reply' : (item.style === 'link' ? 'HTTP call' : (item.style === 'accent' ? 'main path' : 'connection'));
    return from + ' to ' + to + ' (' + kind + ')';
  }

  function render(spec, scene) {
    var panel = document.getElementById('outline-body');
    AX.clear(panel);
    var names = {};
    var nodes = [];
    for (var i = 0; i < scene.items.length; i++) {
      var item = scene.items[i];
      if (item.k === 'node') {
        names[item.id] = item.name;
        nodes.push(item);
      }
    }
    var list = AX.h('ul', { class: 'outline-list' });
    for (var n = 0; n < nodes.length; n++) {
      var node = nodes[n];
      var detail = [];
      for (var p = 0; p < node.parts.length; p++) {
        var part = node.parts[p];
        if (part.role !== 'name' && part.role !== 'kid-name' && part.role !== 'tag' && part.role !== 'center' && part.role !== 'face-hint') {
          detail.push(part.text);
        }
      }
      if (node.rows) {
        for (var r = 0; r < node.rows.length; r++) {
          detail.push(node.rows[r].name + (node.rows[r].type ? ' ' + node.rows[r].type : ''));
        }
      }
      var href = node.opens && AX.views[node.opens] ? '#/v/' + node.opens : (node.piece ? '#/v/' + spec.id + '?p=' + encodeURIComponent(node.piece) : '');
      var title = href ? AX.h('a', { href: href, text: node.name }) : AX.h('strong', { text: node.name });
      var label = [title];
      if (node.tag) {
        label.push(' (' + node.tag.toLowerCase() + ')');
      }
      if (node.parent && names[node.parent]) {
        label.push(', inside ' + names[node.parent]);
      }
      if (detail.length > 0) {
        label.push(': ' + detail.join('; '));
      }
      list.appendChild(AX.h('li', null, label));
    }
    var edges = AX.h('ul', { class: 'outline-list' });
    for (var e = 0; e < scene.items.length; e++) {
      var edge = scene.items[e];
      if (edge.k === 'edge' && edge.from) {
        var text = describeEdge(edge, names);
        if (edge.label) {
          text += ': ' + edge.label.toLowerCase();
        }
        edges.appendChild(AX.h('li', { text: text }));
      }
    }
    panel.appendChild(AX.h('h3', { class: 'sheet-title', text: 'Parts' }));
    panel.appendChild(list);
    if (edges.childNodes.length > 0) {
      panel.appendChild(AX.h('h3', { class: 'sheet-title', text: 'Connections' }));
      panel.appendChild(edges);
    }
  }

  function toggle() {
    var panel = document.getElementById('outline');
    var button = document.getElementById('outline-btn');
    panel.hidden = !panel.hidden;
    button.setAttribute('aria-expanded', panel.hidden ? 'false' : 'true');
    if (!panel.hidden) {
      document.getElementById('outline-heading').focus();
    }
  }

  function close() {
    var panel = document.getElementById('outline');
    if (panel.hidden) {
      return false;
    }
    panel.hidden = true;
    document.getElementById('outline-btn').setAttribute('aria-expanded', 'false');
    return true;
  }

  AX.outline = {
    render: render,
    toggle: toggle,
    close: close,
  };
})();
