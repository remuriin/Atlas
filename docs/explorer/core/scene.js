// Turns a view spec (the data of one diagram) into a scene: a flat list of things
// to draw, each with its position and the zoom levels it shows at. The page draws
// the scene as SVG; the build uses it to check the diagram rules and to write
// static snapshots. Three layout engines:
//   placed  boxes on a grid (architecture, deployment, flowchart, ER, schema, state)
//   seq     a sequence diagram (actors, lifelines, messages in time order)
//   lanes   a process or data flow (swimlanes by step)
(function () {
  var F = AX.FONT;
  var LEGEND_HEIGHT = 44;
  var MARGIN = 40;

  function defaults(value, fallback) {
    return value === undefined || value === null ? fallback : value;
  }

  // ---------- node content ----------

  // Works out the text lines inside a box, each with its zoom level.
  function nodeText(node, x, y, w, h, isKid) {
    var nameSize = isKid ? F.kidName : F.name;
    var subSize = isKid ? F.kidSub : F.sub;
    var padX = isKid ? 8 : 10;
    var parts = [];
    var cursor = y + (isKid ? 4 : 8);
    if (node.tag && !isKid) {
      parts.push({ role: 'tag', text: node.tag, x: x + padX, y: cursor, lod: defaults(node.lod, 1) });
      cursor += 12 + 5;
    }
    var maxWidth = w - padX * 2;
    var nameLines = AX.wrapText(node.name, nameSize, maxWidth, false, true);
    var lineHeight = nameSize * 1.18;
    for (var i = 0; i < nameLines.length; i++) {
      cursor += lineHeight;
      parts.push({ role: isKid ? 'kid-name' : 'name', text: nameLines[i], x: x + padX, y: cursor - lineHeight * 0.22, size: nameSize, lod: defaults(node.lod, 1) });
    }
    if (node.sub) {
      var subLines = AX.wrapText(node.sub, subSize, maxWidth, true);
      cursor += isKid ? 1 : 3;
      for (var s = 0; s < subLines.length; s++) {
        cursor += subSize * 1.25;
        parts.push({ role: isKid ? 'kid-sub' : 'sub', text: subLines[s], x: x + padX, y: cursor - subSize * 0.3, size: subSize, lod: defaults(node.subLod, isKid ? 3 : 2) });
      }
    }
    if (node.lines) {
      cursor += 3;
      for (var l = 0; l < node.lines.length; l++) {
        var line = node.lines[l];
        var text = typeof line === 'string' ? line : line.text;
        var lod = typeof line === 'string' ? 3 : defaults(line.lod, 3);
        var wrapped = AX.wrapText(text, F.detail, maxWidth, true);
        for (var k = 0; k < wrapped.length; k++) {
          cursor += F.detail * 1.35;
          parts.push({ role: 'detail', text: wrapped[k], x: x + padX, y: cursor - F.detail * 0.3, size: F.detail, lod: lod });
        }
      }
    }
    return { parts: parts, needed: cursor - y + (isKid ? 4 : 6) };
  }

  // The height a box (or a container's part) of width w needs for its text, on the 4px
  // grid. Used by the diagrams the build lays out on its own.
  AX.nodeHeight = function (node, w, isKid) {
    return AX.snapUp(nodeText(node, 0, 0, w, 0, isKid === true).needed);
  };

  function makeNode(node, box, isKid, problems, viewId) {
    var shape = node.shape || 'box';
    var item = {
      k: 'node',
      id: node.id,
      shape: shape,
      treat: node.treat || (isKid ? 'kid' : 'backend'),
      x: box.x,
      y: box.y,
      w: box.w,
      h: box.h,
      name: node.name,
      tag: node.tag || '',
      lod: defaults(node.lod, isKid ? 2 : 1),
      max: node.max || 0,
      piece: node.piece || '',
      opens: node.opens || '',
      term: node.term || '',
      focal: node.treat === 'focal',
      parts: [],
    };
    if (shape === 'box' || shape === 'state' || shape === 'container') {
      var text = nodeText(node, box.x, box.y, box.w, box.h, isKid);
      item.parts = text.parts;
      if (text.needed > box.h + 1) {
        problems.push(viewId + ': the text in "' + node.name + '" needs ' + Math.ceil(text.needed) + 'px but the box is ' + box.h + 'px tall');
      }
    } else if (shape === 'oval' || shape === 'diamond') {
      var size = shape === 'diamond' ? F.kidName + 1 : F.name - 1;
      var maxWidth = shape === 'diamond' ? box.w * 0.62 : box.w - 24;
      var lines = AX.wrapText(node.name, size, maxWidth, false, true);
      var lineHeight = size * 1.2;
      var top = box.y + box.h / 2 - (lines.length * lineHeight) / 2;
      for (var i = 0; i < lines.length; i++) {
        item.parts.push({ role: 'center', text: lines[i], x: box.x + box.w / 2, y: top + lineHeight * (i + 1) - lineHeight * 0.25, size: size, lod: item.lod });
      }
      if (node.sub) {
        item.parts.push({ role: 'center-sub', text: node.sub, x: box.x + box.w / 2, y: box.y + box.h + 12, size: F.kidSub, lod: defaults(node.subLod, 2) });
      }
    }
    return item;
  }

  // A database table: a header band, one row per column, then optional indexes.
  function makeTable(node, box, items, boxes, problems, viewId) {
    var ROW = 22;
    var HEAD = 30;
    var rows = node.rows || [];
    var shown = node.show || rows.length;
    var item = makeNode({ id: node.id, name: node.name, tag: 'TABLE', treat: node.treat, lod: node.lod, piece: node.piece, opens: node.opens, term: node.term, shape: 'table' }, box, false, problems, viewId);
    item.shape = 'table';
    item.headFocal = node.focalHeader === true;
    item.parts.push({ role: 'table-name', text: node.name, x: box.x + 10, y: box.y + 19, size: 11.5, lod: item.lod });
    item.parts.push({ role: 'tag', text: 'TABLE', x: box.x + box.w - 10 - AX.snapUp(AX.textWidth('TABLE', F.tag, true) + 8), y: box.y + 8, lod: item.lod });
    item.rows = [];
    var y = box.y + HEAD;
    for (var i = 0; i < Math.min(shown, rows.length); i++) {
      var row = rows[i];
      item.rows.push({ y: y, h: ROW, stripe: i % 2 === 1, name: row.name, type: row.type || '', chips: row.chips || [], piece: row.piece || '', lod: defaults(row.lod, 1) });
      boxes[node.id + '.' + row.name] = { x: box.x, y: y, w: box.w, h: ROW, row: true };
      y += ROW;
    }
    if (rows.length > shown) {
      item.more = { y: y, h: ROW, text: '+ ' + (rows.length - shown) + ' more columns' };
      y += ROW;
    }
    if (node.indexes && node.indexes.length > 0) {
      item.indexes = { y: y, list: node.indexes, lod: 3 };
      y += 18 + node.indexes.length * 11;
    }
    var needed = y - box.y + 4;
    if (needed > box.h + 1) {
      problems.push(viewId + ': table "' + node.name + '" needs ' + needed + 'px but is ' + box.h + 'px tall');
    }
    items.push(item);
    return item;
  }

  // An ER entity: a header with the name, then key fields (zoom level 2) and more (level 3).
  function makeEntity(node, box, items, problems, viewId) {
    var item = makeNode({ id: node.id, name: node.name, tag: 'ENTITY', treat: node.treat, lod: node.lod, piece: node.piece, opens: node.opens, term: node.term, shape: 'entity' }, box, false, problems, viewId);
    item.shape = 'entity';
    item.parts.push({ role: 'tag', text: 'ENTITY', x: box.x + 10, y: box.y + 8, lod: item.lod });
    item.parts.push({ role: 'name', text: node.name, x: box.x + 10, y: box.y + 36, size: F.name, lod: item.lod });
    var y = box.y + 50;
    var fields = node.fields || [];
    for (var i = 0; i < fields.length; i++) {
      var field = typeof fields[i] === 'string' ? { text: fields[i], lod: 2 } : fields[i];
      y += 11;
      item.parts.push({ role: 'field', text: field.text, x: box.x + 10, y: y, size: 8, lod: defaults(field.lod, 2) });
    }
    if (y - box.y + 8 > box.h + 1) {
      problems.push(viewId + ': entity "' + node.name + '" needs ' + (y - box.y + 8) + 'px but is ' + box.h + 'px tall');
    }
    items.push(item);
    return item;
  }

  // ---------- placed engine ----------

  function cellBox(grid, node) {
    var col = node.at[0];
    var row = node.at[1];
    var span = node.span || [1, 1];
    var cellX = grid.x + col * (grid.col + grid.gapX);
    var cellY = grid.y + row * (grid.row + grid.gapY);
    var cellW = span[0] * grid.col + (span[0] - 1) * grid.gapX;
    var cellH = span[1] * grid.row + (span[1] - 1) * grid.gapY;
    var w = node.size ? node.size[0] : cellW;
    var h = node.size ? node.size[1] : cellH;
    var x = cellX + AX.snap((cellW - w) / 2);
    var y = cellY + AX.snap((cellH - h) / 2);
    if (node.nudge) {
      x += node.nudge[0];
      y += node.nudge[1];
    }
    return { x: x, y: y, w: w, h: h };
  }

  function layoutPlaced(spec, scene) {
    var grid = spec.grid;
    var boxes = scene.boxes;
    var items = scene.items;
    var problems = scene.problems;
    var nodes = spec.nodes || [];

    // where every box goes
    var placed = [];
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      var box = node.box ? { x: node.box[0], y: node.box[1], w: node.box[2], h: node.box[3] } : cellBox(grid, node);
      box.lod = defaults(node.lod, 1);
      box.max = node.max || 0;
      boxes[node.id] = box;
      placed.push({ node: node, box: box });
    }

    // zones are drawn first, around their cells or around named nodes
    var zones = spec.zones || [];
    for (var z = 0; z < zones.length; z++) {
      var zone = zones[z];
      var zoneBox;
      if (zone.box) {
        zoneBox = { x: zone.box[0], y: zone.box[1], w: zone.box[2], h: zone.box[3] };
      } else if (zone.around) {
        var minX = 1e9;
        var minY = 1e9;
        var maxX = -1e9;
        var maxY = -1e9;
        for (var a = 0; a < zone.around.length; a++) {
          var b = boxes[zone.around[a]];
          if (!b) {
            problems.push(spec.id + ': zone "' + zone.label + '" names a missing node ' + zone.around[a]);
            continue;
          }
          minX = Math.min(minX, b.x);
          minY = Math.min(minY, b.y);
          maxX = Math.max(maxX, b.x + b.w);
          maxY = Math.max(maxY, b.y + b.h);
        }
        var pad = defaults(zone.pad, 20);
        zoneBox = { x: minX - pad, y: minY - pad - 16, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 + 16 };
      } else {
        zoneBox = cellBox(grid, { at: [zone.cells[0], zone.cells[1]], span: [zone.cells[2], zone.cells[3]] });
      }
      items.push({
        k: 'zone', id: zone.id || 'zone' + z, x: zoneBox.x, y: zoneBox.y, w: zoneBox.w, h: zoneBox.h,
        label: zone.label, lod: defaults(zone.lod, 1), max: zone.max || 0,
        opens: zone.opens || '', piece: zone.piece || '', term: zone.term || '', dash: zone.dash === true,
      });
    }

    // nodes, containers and their children
    for (var p = 0; p < placed.length; p++) {
      var entry = placed[p];
      var n = entry.node;
      var bx = entry.box;
      if (n.shape === 'table') {
        makeTable(n, bx, items, boxes, problems, spec.id);
        continue;
      }
      if (n.shape === 'entity') {
        makeEntity(n, bx, items, problems, spec.id);
        continue;
      }
      if (n.kids) {
        layoutContainer(n, bx, scene, spec.id);
        continue;
      }
      items.push(makeNode(n, bx, false, problems, spec.id));
    }

    // free notes
    var notes = spec.notes || [];
    for (var t = 0; t < notes.length; t++) {
      var note = notes[t];
      var at = note.xy ? { x: note.xy[0], y: note.xy[1] } : cellBox(grid, { at: note.at, size: [note.w || grid.col, 12] });
      items.push({ k: 'note', x: at.x, y: at.y, w: note.w || grid.col, text: note.text, lod: defaults(note.lod, 2), max: note.max || 0 });
    }
  }

  // A container shows its name as one box when zoomed out (level 1), and opens into a
  // labelled frame with its parts inside when zoomed in (level 2).
  function layoutContainer(node, box, scene, viewId) {
    var kids = node.kids;
    var faceMax = defaults(node.faceMax, 1);
    var face = makeNode({
      id: node.id, name: node.name, tag: node.tag, sub: node.sub, subLod: defaults(node.subLod, 1),
      lines: node.lines, treat: node.treat, lod: node.lod, piece: node.piece, opens: node.opens, term: node.term,
    }, box, false, scene.problems, viewId);
    face.max = faceMax;
    face.container = true;
    // a quiet hint in the middle of the closed container
    face.parts.push({
      role: 'face-hint', text: kids.hint || 'Zoom in to look inside', x: box.x + box.w / 2,
      y: box.y + box.h / 2 + 12, size: 9, lod: 1,
    });
    scene.items.push(face);
    scene.items.push({
      k: 'frame', id: node.id + '-frame', x: box.x, y: box.y, w: box.w, h: box.h,
      label: kids.label || node.name.toUpperCase(), lod: faceMax + 1, max: 0,
      opens: node.opens || '', piece: node.piece || '', term: node.term || '', treat: node.treat || 'backend',
    });
    var list = kids.items;
    var padX = 12;
    var top = 30;
    var gap = 8;
    var cols = kids.cols || Math.max(1, Math.floor((box.w - padX * 2 + gap) / 128));
    var kidH = kids.h || 32;
    var innerW = box.w - padX * 2;
    var kidW = AX.snap((innerW - (cols - 1) * gap) / cols);
    var rowsNeeded = Math.ceil(list.length / cols);
    var needed = top + rowsNeeded * kidH + (rowsNeeded - 1) * gap + 12;
    if (needed > box.h + 1) {
      scene.problems.push(viewId + ': container "' + node.name + '" needs ' + needed + 'px for its ' + list.length + ' parts but is ' + box.h + 'px tall');
    }
    for (var i = 0; i < list.length; i++) {
      var kid = list[i];
      var col = i % cols;
      var row = Math.floor(i / cols);
      var kidBox = {
        x: box.x + padX + col * (kidW + gap),
        y: box.y + top + row * (kidH + gap),
        w: kidW,
        h: kidH,
      };
      if (kid.box) {
        kidBox = { x: kid.box[0], y: kid.box[1], w: kid.box[2], h: kid.box[3] };
      }
      // children only exist from the level the container opens at
      kidBox.lod = defaults(kid.lod, faceMax + 1);
      scene.boxes[kid.id] = kidBox;
      var kidItem = makeNode({
        id: kid.id, name: kid.name, sub: kid.sub, subLod: kid.subLod, lines: kid.lines,
        treat: kid.treat || 'kid', lod: defaults(kid.lod, faceMax + 1), piece: kid.piece, opens: kid.opens, term: kid.term,
      }, kidBox, true, scene.problems, viewId);
      kidItem.kid = true;
      kidItem.parent = node.id;
      scene.items.push(kidItem);
    }
  }

  // ---------- sequence engine ----------

  function layoutSequence(spec, scene) {
    var actors = spec.actors;
    var msgs = spec.msgs;
    var gapX = spec.gapX || 200;
    var actorW = spec.actorW || 152;
    var actorH = 52;
    var top = 32;
    var step = spec.step || 44;
    var firstMsg = top + actorH + 40;
    var xs = {};
    for (var i = 0; i < actors.length; i++) {
      var actor = actors[i];
      var x = MARGIN + i * gapX;
      var box = { x: x, y: top, w: actorW, h: actorH };
      scene.boxes[actor.id] = box;
      xs[actor.id] = x + actorW / 2;
      scene.items.push(makeNode({
        id: actor.id, name: actor.name, tag: actor.tag, sub: actor.sub, subLod: defaults(actor.subLod, 2),
        treat: actor.treat, lod: 1, piece: actor.piece, opens: actor.opens, term: actor.term,
      }, box, false, scene.problems, spec.id));
    }
    var bottom = firstMsg + msgs.length * step + 8;
    // fragments (alt / opt boxes) behind the messages
    var frags = spec.frags || [];
    for (var f = 0; f < frags.length; f++) {
      var frag = frags[f];
      var fromY = firstMsg + frag.from * step - 26;
      var toY = firstMsg + frag.to * step + 14;
      var left = 1e9;
      var right = -1e9;
      for (var m = frag.from; m <= frag.to; m++) {
        left = Math.min(left, xs[msgs[m].from], xs[msgs[m].to]);
        right = Math.max(right, xs[msgs[m].from], xs[msgs[m].to]);
      }
      scene.items.push({
        k: 'frag', x: left - 24, y: fromY, w: right - left + 48 + (frag.extra || 0), h: toY - fromY,
        label: frag.label, lod: defaults(frag.lod, 1), max: frag.max || 0,
      });
    }
    for (var a = 0; a < actors.length; a++) {
      scene.items.push({ k: 'lifeline', x: xs[actors[a].id], y1: top + actorH, y2: bottom, lod: 1, max: 0 });
    }
    for (var n = 0; n < msgs.length; n++) {
      var msg = msgs[n];
      var y = firstMsg + n * step;
      var x1 = xs[msg.from];
      var x2 = xs[msg.to];
      var style = msg.accent ? 'accent' : (msg.link ? 'link' : 'muted');
      var lod = defaults(msg.lod, 1);
      var d;
      var labelX;
      if (x1 === x2) {
        d = 'M' + x1 + ',' + y + ' H' + (x1 + 28) + ' Q' + (x1 + 36) + ',' + y + ' ' + (x1 + 36) + ',' + (y + 8) +
          ' V' + (y + 12) + ' Q' + (x1 + 36) + ',' + (y + 20) + ' ' + (x1 + 28) + ',' + (y + 20) + ' H' + (x1 + 2);
        labelX = x1 + 44;
      } else {
        var direction = x2 > x1 ? 1 : -1;
        d = 'M' + (x1 + direction * 3) + ',' + y + ' H' + (x2 - direction * 3);
        labelX = (x1 + x2) / 2;
      }
      scene.items.push({ k: 'edge', d: d, style: style, dash: msg.dash === true, lod: lod, max: msg.max || 0, from: msg.from, to: msg.to });
      if (msg.label) {
        var size = F.label;
        var width = AX.snapUp(AX.textWidth(msg.label, size, true) + 8);
        var lx = x1 === x2 ? AX.snap(labelX) : AX.snap(labelX - width / 2);
        scene.items.push({ k: 'mask', x: lx, y: AX.snap(y - 8 - 14), w: width, h: AX.snapUp(size + 6), text: msg.label, size: size, lod: lod, max: msg.max || 0 });
      }
      if (msg.note) {
        scene.items.push({ k: 'note', x: Math.max(x1, x2) + 16, y: y + 10, w: 160, text: msg.note, lod: defaults(msg.noteLod, 3), max: 0 });
      }
    }
  }

  // ---------- lanes engine (process and data flow) ----------

  function layoutLanes(spec, scene) {
    var LABEL_W = 156;
    var STEP_W = 188;
    var HEADER_H = 48;
    var LANE_H = spec.laneH || 112;
    var NODE_W = 156;
    var NODE_H = spec.nodeH || 76;
    var left = MARGIN;
    var top = MARGIN;
    var lanes = spec.lanes;
    var steps = spec.steps;
    var width = LABEL_W + steps.length * STEP_W;
    // step headers
    for (var s = 0; s < steps.length; s++) {
      var stepX = left + LABEL_W + s * STEP_W;
      scene.items.push({
        k: 'step', x: stepX + 16, y: top, w: STEP_W - 32, h: 28,
        number: steps[s].number || String(s + 1).padStart(2, '0'), label: steps[s].label,
        focal: steps[s].focal === true, lod: 1, max: 0,
      });
    }
    // lane bands and labels
    for (var l = 0; l < lanes.length; l++) {
      var laneY = top + HEADER_H + l * LANE_H;
      scene.items.push({
        k: 'lane', x: left, y: laneY, w: width, h: LANE_H, label: lanes[l].name, stripe: l % 2 === 0,
        lod: 1, max: 0, piece: lanes[l].piece || '', term: lanes[l].term || '',
      });
    }
    var laneIndex = {};
    for (var li = 0; li < lanes.length; li++) {
      laneIndex[lanes[li].id] = li;
    }
    var nodes = spec.nodes;
    for (var n = 0; n < nodes.length; n++) {
      var node = nodes[n];
      var row = laneIndex[node.lane];
      if (row === undefined) {
        scene.problems.push(spec.id + ': node "' + node.name + '" names a missing lane ' + node.lane);
        continue;
      }
      var box = {
        x: left + LABEL_W + node.step * STEP_W + (STEP_W - NODE_W) / 2,
        y: top + HEADER_H + row * LANE_H + (LANE_H - NODE_H) / 2,
        w: NODE_W,
        h: NODE_H,
      };
      scene.boxes[node.id] = box;
      scene.items.push(makeNode(node, box, false, scene.problems, spec.id));
    }
  }

  // ---------- connectors, legend, bounds ----------

  function addEdges(spec, scene) {
    var edges = spec.edges || [];
    if (edges.length === 0) {
      return;
    }
    var routed = AX.routeAll(edges, scene.boxes, { label: F.label });
    for (var p = 0; p < routed.problems.length; p++) {
      scene.problems.push(spec.id + ': ' + routed.problems[p]);
    }
    for (var i = 0; i < routed.routes.length; i++) {
      var route = routed.routes[i];
      var edge = route.edge;
      var lod = edge.lod;
      if (!lod) {
        // a connector shows from the level where both its ends show
        lod = Math.max(levelOf(scene, route.fromId), levelOf(scene, route.toId));
      }
      scene.items.push({
        k: 'edge', d: route.d, style: edge.style || 'muted', dash: edge.dash === true,
        lod: lod, max: edge.max || 0, points: route.points, from: route.fromId, to: route.toId,
        term: edge.term || '', piece: edge.piece || '', title: edge.title || '', label: edge.label || '',
      });
      if (route.labelBox) {
        var lb = route.labelBox;
        scene.items.push({ k: 'mask', x: lb.x, y: lb.y, w: lb.w, h: lb.h, text: lb.text, size: lb.size, lod: lod, max: edge.max || 0 });
      }
      if (edge.ends) {
        addEnds(scene, route, edge, lod);
      }
    }
  }

  // Cardinality marks (1, N, 0..1) near each end of an ER relationship.
  function addEnds(scene, route, edge, lod) {
    var points = route.points;
    var marks = [[points[0], points[1], edge.ends[0]], [points[points.length - 1], points[points.length - 2], edge.ends[1]]];
    for (var i = 0; i < marks.length; i++) {
      if (!marks[i][2]) {
        continue;
      }
      var at = marks[i][0];
      var toward = marks[i][1];
      var dx = toward[0] === at[0] ? 0 : (toward[0] > at[0] ? 1 : -1);
      var dy = toward[1] === at[1] ? 0 : (toward[1] > at[1] ? 1 : -1);
      var x = at[0] + dx * 14 + (dy !== 0 ? 6 : 0);
      var y = at[1] + dy * 16 + (dx !== 0 ? -6 : 4);
      scene.items.push({ k: 'card', x: x, y: y, text: marks[i][2], lod: lod, max: edge.max || 0 });
    }
  }

  function levelOf(scene, id) {
    var base = id.split('.')[0];
    for (var i = 0; i < scene.items.length; i++) {
      var item = scene.items[i];
      if (item.k === 'node' && item.id === base) {
        return item.lod || 1;
      }
    }
    return 1;
  }

  var LEGEND_LABELS = {
    focal: 'Main part',
    backend: 'Atlas code',
    store: 'Stored data',
    external: 'Outside service',
    input: 'Person or request',
    optional: 'Planned or optional',
    security: 'Security boundary',
    stop: 'Refused: the request ends',
  };

  // The legend strip under the diagram: only the kinds this diagram actually uses.
  function addLegend(scene, width, top) {
    var used = {};
    var order = [];
    var styles = {};
    for (var i = 0; i < scene.items.length; i++) {
      var item = scene.items[i];
      if (item.k === 'node' && !item.kid && LEGEND_LABELS[item.treat] && !used[item.treat]) {
        used[item.treat] = true;
        order.push(item.treat);
      }
      if (item.k === 'edge') {
        styles[item.dash ? 'dash' : item.style] = true;
      }
    }
    var entries = [];
    for (var o = 0; o < order.length; o++) {
      entries.push({ kind: 'box', treat: order[o], text: LEGEND_LABELS[order[o]] });
    }
    if (styles.muted) {
      entries.push({ kind: 'line', style: 'muted', text: 'Data or call' });
    }
    if (styles.link) {
      entries.push({ kind: 'line', style: 'link', text: 'HTTP / API call' });
    }
    if (styles.accent) {
      entries.push({ kind: 'line', style: 'accent', text: 'Main path' });
    }
    if (styles.dash) {
      entries.push({ kind: 'line', style: 'dash', text: 'Optional, reply or async' });
    }
    scene.items.push({ k: 'legend', x: MARGIN, y: top, w: width - MARGIN * 2, h: LEGEND_HEIGHT - 8, entries: entries, lod: 1, max: 0 });
  }

  function bounds(scene) {
    var maxX = 0;
    var maxY = 0;
    for (var i = 0; i < scene.items.length; i++) {
      var item = scene.items[i];
      if (item.k === 'lifeline') {
        maxX = Math.max(maxX, item.x);
        maxY = Math.max(maxY, item.y2);
        continue;
      }
      if (item.k === 'edge') {
        var pts = item.points || [];
        for (var p = 0; p < pts.length; p++) {
          maxX = Math.max(maxX, pts[p][0]);
          maxY = Math.max(maxY, pts[p][1]);
        }
        continue;
      }
      if (item.w !== undefined) {
        maxX = Math.max(maxX, item.x + item.w);
      }
      if (item.h !== undefined) {
        maxY = Math.max(maxY, item.y + item.h);
      } else if (item.y !== undefined) {
        maxY = Math.max(maxY, item.y + 12);
      }
    }
    return { w: AX.snapUp(maxX + MARGIN), h: AX.snapUp(maxY + MARGIN) };
  }

  // Builds the scene for one view spec.
  function buildScene(spec) {
    var scene = { id: spec.id, items: [], boxes: {}, problems: [] };
    var engine = spec.engine || 'placed';
    if (engine === 'seq') {
      layoutSequence(spec, scene);
    } else if (engine === 'lanes') {
      layoutLanes(spec, scene);
    } else {
      layoutPlaced(spec, scene);
    }
    addEdges(spec, scene);
    var size = bounds(scene);
    if (spec.size) {
      size.w = Math.max(size.w, spec.size[0]);
      size.h = Math.max(size.h, spec.size[1]);
    }
    if (spec.legend !== false) {
      addLegend(scene, size.w, size.h - MARGIN + 16);
      size.h += LEGEND_HEIGHT;
    }
    scene.w = size.w;
    scene.h = size.h;
    // paint order: zones and lanes, frames, lifelines, ALT boxes (so their label tabs
    // cover the lifelines), connectors, labels, nodes, notes, legend
    var rank = { lane: 0, step: 1, zone: 2, frame: 3, lifeline: 4, frag: 5, edge: 6, mask: 7, card: 7, node: 8, note: 9, legend: 10 };
    scene.items.sort(function (a, b) {
      var difference = rank[a.k] - rank[b.k];
      if (difference !== 0) {
        return difference;
      }
      // children paint after their containers
      return (a.kid ? 1 : 0) - (b.kid ? 1 : 0);
    });
    return scene;
  }

  AX.buildScene = buildScene;
})();
