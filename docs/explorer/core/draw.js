// Turns a scene into a tree of plain SVG element descriptions:
//   { tag: 'rect', attrs: { ... }, text: '...', kids: [ ... ], link: { ... } }
// The page turns the tree into real SVG elements; the build turns the same tree
// into text for the static snapshots. So both always draw the same thing.
// Colours come from CSS classes (one short class, plus a second word for a variant).
(function () {
  var F = AX.FONT;

  function el(tag, attrs, kids, text) {
    return { tag: tag, attrs: attrs || {}, kids: kids || [], text: text === undefined ? null : text };
  }

  // Zoom-level attributes: data-lod is the first level that shows it, data-max the last.
  function levels(attrs, item) {
    if (item.lod && item.lod > 1) {
      attrs['data-lod'] = String(item.lod);
    }
    if (item.max) {
      attrs['data-max'] = String(item.max);
    }
    return attrs;
  }

  function textEl(cls, x, y, value, size, anchor) {
    var attrs = { class: cls, x: round(x), y: round(y) };
    if (size) {
      attrs['font-size'] = String(size);
    }
    if (anchor) {
      attrs['text-anchor'] = anchor;
    }
    return el('text', attrs, [], value);
  }

  function round(value) {
    return String(Math.round(value * 10) / 10);
  }

  function markers() {
    var list = [['arrow', 'arrowhead'], ['arrow-accent', 'arrowhead accent'], ['arrow-link', 'arrowhead link']];
    var out = [];
    for (var i = 0; i < list.length; i++) {
      out.push(el('marker', {
        id: list[i][0], viewBox: '0 0 10 10', refX: '9', refY: '5',
        markerWidth: '7', markerHeight: '7', orient: 'auto-start-reverse',
      }, [el('path', { d: 'M0,1 L9,5 L0,9 Z', class: list[i][1] })]));
    }
    return el('defs', {}, out);
  }

  function drawZone(item) {
    var labelWidth = AX.snapUp(AX.textWidth(item.label, F.zone, true, false, 0.12) + 12);
    var g = el('g', levels({ class: item.dash ? 'zone dash' : 'zone' }, item), [
      el('rect', { class: 'zone-box', x: item.x, y: item.y, width: item.w, height: item.h, rx: 8 }),
      el('rect', { class: 'mask', x: item.x + 12, y: item.y - 7, width: labelWidth, height: 14, rx: 2 }),
      textEl('eyebrow', item.x + 18, item.y + 3.5, item.label, F.zone),
    ]);
    return linkWrap(g, item, item.label);
  }

  function drawFrame(item) {
    var labelWidth = AX.snapUp(AX.textWidth(item.label, F.zone, true, false, 0.12) + 12);
    return linkWrap(el('g', levels({ class: 'frame' }, item), [
      el('rect', { class: 'frame-box ' + item.treat, x: item.x, y: item.y, width: item.w, height: item.h, rx: 8 }),
      el('rect', { class: 'mask', x: item.x + 10, y: item.y + 6, width: labelWidth, height: 14, rx: 2 }),
      textEl('eyebrow', item.x + 16, item.y + 16.5, item.label, F.zone),
    ]), item, item.label);
  }

  function drawEdge(item) {
    var cls = 'edge ' + (item.dash ? 'dash' : item.style);
    var marker = 'url(#arrow)';
    if (item.style === 'accent') {
      marker = 'url(#arrow-accent)';
    } else if (item.style === 'link') {
      marker = 'url(#arrow-link)';
    }
    var attrs = levels({ class: cls, d: item.d, 'marker-end': marker }, item);
    if (item.term) {
      attrs['data-term'] = item.term;
    }
    return el('path', attrs);
  }

  function drawMask(item) {
    return el('g', levels({ class: 'label-g' }, item), [
      el('rect', { class: 'mask', x: item.x, y: item.y, width: item.w, height: item.h, rx: 2 }),
      textEl('label', item.x + item.w / 2, item.y + item.h / 2 + item.size * 0.36, item.text, item.size, 'middle'),
    ]);
  }

  function drawCard(item) {
    return textEl('card', item.x, item.y, item.text, F.label + 1, 'middle');
  }

  function drawNote(item) {
    var lines = AX.wrapText(item.text, F.detail + 1, item.w, false);
    var kids = [el('rect', { class: 'note-bar', x: item.x, y: item.y, width: 2, height: lines.length * 10 + 2 })];
    for (var i = 0; i < lines.length; i++) {
      kids.push(textEl('note', item.x + 8, item.y + 9 + i * 10, lines[i], F.detail + 1));
    }
    return el('g', levels({ class: 'note-g' }, item), kids);
  }

  function drawParts(parts) {
    var out = [];
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i];
      var attrs;
      if (part.role === 'tag') {
        var width = AX.snapUp(AX.textWidth(part.text, F.tag, true, false, 0.12) + 8);
        out.push(el('g', levels({ class: 'tag-g' }, part), [
          el('rect', { class: 'tag', x: part.x, y: part.y, width: width, height: 12, rx: 2 }),
          textEl('tag-text', part.x + 4, part.y + 8.6, part.text, F.tag),
        ]));
        continue;
      }
      var cls = part.role;
      var anchor = null;
      if (part.role === 'center' || part.role === 'center-sub' || part.role === 'face-hint') {
        anchor = 'middle';
      }
      attrs = levels({}, part);
      var node = textEl(cls, part.x, part.y, part.text, part.size, anchor);
      if (attrs['data-lod']) {
        node.attrs['data-lod'] = attrs['data-lod'];
      }
      if (attrs['data-max']) {
        node.attrs['data-max'] = attrs['data-max'];
      }
      out.push(node);
    }
    return out;
  }

  function shapeFor(item) {
    var cls = 'node ' + item.treat;
    if (item.shape === 'oval') {
      return el('rect', { class: cls, x: item.x, y: item.y, width: item.w, height: item.h, rx: item.h / 2 });
    }
    if (item.shape === 'diamond') {
      var cx = item.x + item.w / 2;
      var cy = item.y + item.h / 2;
      return el('polygon', { class: cls, points: cx + ',' + item.y + ' ' + (item.x + item.w) + ',' + cy + ' ' + cx + ',' + (item.y + item.h) + ' ' + item.x + ',' + cy });
    }
    if (item.shape === 'dot') {
      return el('circle', { class: 'dot', cx: item.x + item.w / 2, cy: item.y + item.h / 2, r: 5 });
    }
    var radius = item.shape === 'state' ? 14 : 6;
    return el('rect', { class: cls, x: item.x, y: item.y, width: item.w, height: item.h, rx: radius });
  }

  function drawNode(item) {
    var kids = [];
    // an opaque backing so connectors never show through a translucent fill
    if (item.shape !== 'dot' && item.shape !== 'diamond') {
      kids.push(el('rect', { class: 'backing', x: item.x, y: item.y, width: item.w, height: item.h, rx: item.shape === 'oval' ? item.h / 2 : 6 }));
    }
    kids.push(shapeFor(item));
    if (item.shape === 'table') {
      kids = kids.concat(drawTableBody(item));
    }
    kids = kids.concat(drawParts(item.parts));
    var cls = item.kid ? 'item kid' : 'item';
    var g = el('g', levels({ class: cls, 'data-node': item.id }, item), kids);
    return linkWrap(g, item, item.name);
  }

  function drawTableBody(item) {
    var out = [];
    var headCls = item.headFocal ? 'head focal' : 'head';
    out.push(el('rect', { class: headCls, x: item.x + 1, y: item.y + 1, width: item.w - 2, height: 28, rx: 5 }));
    out.push(el('line', { class: 'rule', x1: item.x, y1: item.y + 30, x2: item.x + item.w, y2: item.y + 30 }));
    for (var i = 0; i < item.rows.length; i++) {
      var row = item.rows[i];
      var g = [];
      if (row.stripe) {
        g.push(el('rect', { class: 'stripe', x: item.x + 1, y: row.y, width: item.w - 2, height: row.h }));
      }
      g.push(textEl('row-name', item.x + 10, row.y + 15, row.name, 10));
      if (row.type) {
        var typeText = textEl('row-type', item.x + item.w - 10, row.y + 15, row.type, 8, 'end');
        typeText.attrs['data-lod'] = '2';
        g.push(typeText);
      }
      var chipX = item.x + 10 + AX.textWidth(row.name, 10, false) + 8;
      for (var c = 0; c < row.chips.length; c++) {
        var chipWidth = AX.snapUp(AX.textWidth(row.chips[c], 6.5, true) + 6);
        g.push(el('g', { class: 'chip-g', 'data-lod': '2' }, [
          el('rect', { class: 'chip', x: chipX, y: row.y + 6, width: chipWidth, height: 10, rx: 2 }),
          textEl('chip-text', chipX + 3, row.y + 13.4, row.chips[c], 6.5),
        ]));
        chipX += chipWidth + 4;
      }
      var rowAttrs = levels({ class: 'row', 'data-row': row.name }, row);
      var rowGroup = el('g', rowAttrs, g);
      if (row.piece) {
        rowGroup.link = { piece: row.piece, name: item.name + '.' + row.name };
      }
      out.push(rowGroup);
    }
    if (item.more) {
      out.push(textEl('more', item.x + 10, item.more.y + 15, item.more.text, 9));
    }
    if (item.indexes) {
      var y = item.indexes.y;
      var list = [el('line', { class: 'rule', x1: item.x, y1: y + 4, x2: item.x + item.w, y2: y + 4 }),
        textEl('eyebrow', item.x + 10, y + 15, 'INDEXES', 7)];
      for (var k = 0; k < item.indexes.list.length; k++) {
        list.push(textEl('detail', item.x + 10, y + 26 + k * 11, item.indexes.list[k], 7));
      }
      out.push(el('g', { class: 'index-g', 'data-lod': '3' }, list));
    }
    return out;
  }

  function drawLane(item) {
    var kids = [];
    if (item.stripe) {
      kids.push(el('rect', { class: 'lane-band', x: item.x, y: item.y, width: item.w, height: item.h }));
    }
    kids.push(el('line', { class: 'rule', x1: item.x, y1: item.y, x2: item.x + item.w, y2: item.y }));
    var lines = AX.wrapText(item.label.toUpperCase(), F.zone, 132, true);
    for (var i = 0; i < lines.length; i++) {
      kids.push(textEl('eyebrow', item.x + 12, item.y + item.h / 2 - (lines.length - 1) * 6 + i * 12 + 3, lines[i], F.zone));
    }
    return el('g', { class: 'lane' }, kids);
  }

  function drawStep(item) {
    var cls = item.focal ? 'step focal' : 'step';
    return el('g', { class: 'step-g' }, [
      el('rect', { class: cls, x: item.x, y: item.y, width: item.w, height: item.h, rx: 4 }),
      textEl('step-text', item.x + item.w / 2, item.y + 18, item.number + '  ' + item.label.toUpperCase(), F.zone, 'middle'),
    ]);
  }

  function drawFrag(item) {
    var labelWidth = AX.snapUp(AX.textWidth(item.label, F.zone, true, false, 0.12) + 12);
    return el('g', levels({ class: 'frag' }, item), [
      el('rect', { class: 'frag-box', x: item.x, y: item.y, width: item.w, height: item.h, rx: 6 }),
      el('rect', { class: 'frag-tab', x: item.x, y: item.y, width: labelWidth, height: 16, rx: 2 }),
      textEl('eyebrow', item.x + 6, item.y + 11.5, item.label, F.zone),
    ]);
  }

  function drawLegend(item) {
    var kids = [el('line', { class: 'rule', x1: item.x, y1: item.y, x2: item.x + item.w, y2: item.y })];
    var x = item.x;
    var y = item.y + 22;
    for (var i = 0; i < item.entries.length; i++) {
      var entry = item.entries[i];
      if (entry.kind === 'box') {
        kids.push(el('rect', { class: 'node ' + entry.treat, x: x, y: y - 9, width: 16, height: 12, rx: 3 }));
      } else {
        var cls = 'edge ' + entry.style;
        kids.push(el('line', { class: cls, x1: x, y1: y - 3, x2: x + 18, y2: y - 3 }));
      }
      kids.push(textEl('legend-text', x + 24, y + 1, entry.text, 9));
      x += 24 + AX.textWidth(entry.text, 9, false) + 24;
    }
    return el('g', { class: 'legend' }, kids);
  }

  function drawLifeline(item) {
    return el('line', levels({ class: 'life', x1: item.x, y1: item.y1, x2: item.x, y2: item.y2 }, item));
  }

  // Wraps a drawn element in a link when it opens something (a view, a detail sheet).
  function linkWrap(group, item, name) {
    if (item.opens || item.piece || item.term) {
      group.link = { opens: item.opens || '', piece: item.piece || '', term: item.term || '', name: name, id: item.id || '' };
    }
    return group;
  }

  var DRAWERS = {
    zone: drawZone,
    frame: drawFrame,
    edge: drawEdge,
    mask: drawMask,
    card: drawCard,
    note: drawNote,
    node: drawNode,
    lane: drawLane,
    step: drawStep,
    frag: drawFrag,
    legend: drawLegend,
    lifeline: drawLifeline,
  };

  // The whole diagram as one element tree, layer by layer.
  function drawScene(scene) {
    var layers = [markers()];
    for (var i = 0; i < scene.items.length; i++) {
      var item = scene.items[i];
      var drawer = DRAWERS[item.k];
      if (drawer) {
        layers.push(drawer(item));
      }
    }
    return layers;
  }

  AX.drawScene = drawScene;
  AX.el = el;
})();
