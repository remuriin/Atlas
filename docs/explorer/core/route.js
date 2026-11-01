// Draws the connectors between boxes, following the diagram rules:
//   - only straight lines and right angles, with rounded corners (radius 8)
//   - each connector gets its own attach point on a shared box edge
//   - where two connectors cross, the less important one hops over the other
//   - a label sits beside its line on a small mask, never on top of the line
(function () {
  var RADIUS = 8;
  var HOP = 6;
  var LABEL_GAP = 8;
  var MIN_OVERLAP = 16;

  // How important a connector is: the less important one hops at a crossing.
  function priority(edge) {
    if (edge.dash) {
      return 0;
    }
    if (edge.style === 'accent') {
      return 3;
    }
    if (edge.style === 'link') {
      return 2;
    }
    return 1;
  }

  // "api:left" means the left edge of node api; "api" lets the router choose.
  function parseEnd(text) {
    var parts = String(text).split(':');
    return { id: parts[0], side: parts.length > 1 ? parts[1] : '' };
  }

  function centerX(box) {
    return box.x + box.w / 2;
  }

  function centerY(box) {
    return box.y + box.h / 2;
  }

  // Picks which edges of the two boxes the connector leaves and enters by.
  function chooseSides(a, b) {
    // table rows (database schema) always connect from the side: right to left
    // when the tables stand side by side, out and back on the right when stacked
    if (a.row || b.row) {
      var apart = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) < 0;
      if (!apart) {
        return ['right', 'right'];
      }
      return centerX(b) >= centerX(a) ? ['right', 'left'] : ['left', 'right'];
    }
    var overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    var overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    if (overlapY >= MIN_OVERLAP) {
      if (centerX(b) >= centerX(a)) {
        return ['right', 'left'];
      }
      return ['left', 'right'];
    }
    if (overlapX >= MIN_OVERLAP) {
      if (centerY(b) >= centerY(a)) {
        return ['bottom', 'top'];
      }
      return ['top', 'bottom'];
    }
    // Off-axis: leave by the side facing the other box, enter from above or below (one bend).
    var fromSide = centerX(b) >= centerX(a) ? 'right' : 'left';
    var toSide = centerY(b) >= centerY(a) ? 'top' : 'bottom';
    return [fromSide, toSide];
  }

  function isVertical(side) {
    return side === 'top' || side === 'bottom';
  }

  // The point on a box edge at a given distance along that edge.
  function sidePoint(box, side, along) {
    if (side === 'left') {
      return [box.x, box.y + along];
    }
    if (side === 'right') {
      return [box.x + box.w, box.y + along];
    }
    if (side === 'top') {
      return [box.x + along, box.y];
    }
    return [box.x + along, box.y + box.h];
  }

  function edgeLength(box, side) {
    return isVertical(side) ? box.w : box.h;
  }

  // Two connectors can collide only if some zoom level shows both.
  function visibleTogether(a, b) {
    var aMax = a.max || 3;
    var bMax = b.max || 3;
    var aMin = a.lod || 1;
    var bMin = b.lod || 1;
    return aMin <= bMax && bMin <= aMax;
  }

  // Where a connector would like to attach so it can run straight: the middle of
  // the stretch the two boxes share, when they face each other. null if they don't.
  function straightWish(route, a, b) {
    var horizontalPair = (route.fromSide === 'right' && route.toSide === 'left') ||
      (route.fromSide === 'left' && route.toSide === 'right');
    var verticalPair = (route.fromSide === 'bottom' && route.toSide === 'top') ||
      (route.fromSide === 'top' && route.toSide === 'bottom');
    if (route.edge.via) {
      return null;
    }
    if (horizontalPair) {
      var top = Math.max(a.y, b.y) + 8;
      var bottom = Math.min(a.y + a.h, b.y + b.h) - 8;
      if (bottom - top >= 0) {
        return AX.snap((top + bottom) / 2);
      }
    }
    if (verticalPair) {
      var left = Math.max(a.x, b.x) + 8;
      var right = Math.min(a.x + a.w, b.x + b.w) - 8;
      if (right - left >= 0) {
        return AX.snap((left + right) / 2);
      }
    }
    return null;
  }

  function isTaken(taken, value) {
    for (var i = 0; i < taken.length; i++) {
      if (Math.abs(taken[i] - value) < 12) {
        return true;
      }
    }
    return false;
  }

  // Gives every connector its own attach point on each box edge. A connector that
  // can run straight gets that spot first; the rest spread at L*k/(N+1), sorted by
  // where their other end is, so they do not cross right at the box.
  function assignPorts(routes, boxes) {
    var groups = {};
    var keys = [];
    for (var i = 0; i < routes.length; i++) {
      var r = routes[i];
      r.wish = straightWish(r, boxes[r.fromId], boxes[r.toId]);
      var ends = [['from', r.fromId, r.fromSide, r.toId], ['to', r.toId, r.toSide, r.fromId]];
      for (var j = 0; j < ends.length; j++) {
        var band = r.edge.max === 1 ? 'low' : 'high';
        var key = ends[j][1] + '|' + ends[j][2] + '|' + band;
        if (!groups[key]) {
          groups[key] = [];
          keys.push(key);
        }
        groups[key].push({ route: r, end: ends[j][0], other: boxes[ends[j][3]], done: false });
      }
    }
    for (var k = 0; k < keys.length; k++) {
      placeGroup(groups[keys[k]], boxes);
    }
  }

  function placeGroup(group, boxes) {
    var first = group[0];
    var box = boxes[first.end === 'from' ? first.route.fromId : first.route.toId];
    var side = first.end === 'from' ? first.route.fromSide : first.route.toSide;
    var start = isVertical(side) ? box.x : box.y;
    var length = edgeLength(box, side);
    var taken = [];
    group.sort(function (a, b) {
      if (isVertical(side)) {
        return centerX(a.other) - centerX(b.other);
      }
      return centerY(a.other) - centerY(b.other);
    });
    // 1. connectors that can run straight take their spot first
    for (var i = 0; i < group.length; i++) {
      var wish = group[i].route.wish;
      if (wish !== null && wish - start >= 8 && wish - start <= length - 8 && !isTaken(taken, wish)) {
        setAlong(group[i], wish - start, group.length);
        taken.push(wish);
        group[i].done = true;
      }
    }
    // 2. the rest spread evenly, stepping aside from spots already taken
    var rest = [];
    for (var j = 0; j < group.length; j++) {
      if (!group[j].done) {
        rest.push(group[j]);
      }
    }
    for (var n = 0; n < rest.length; n++) {
      var target = start + AX.snap(length * (n + 1) / (rest.length + 1));
      var chosen = target;
      for (var step = 0; step <= length; step += 4) {
        var up = target - step;
        var down = target + step;
        if (up >= start + 8 && !isTaken(taken, up)) {
          chosen = up;
          break;
        }
        if (down <= start + length - 8 && !isTaken(taken, down)) {
          chosen = down;
          break;
        }
      }
      setAlong(rest[n], chosen - start, group.length);
      taken.push(chosen);
    }
  }

  function setAlong(member, along, count) {
    if (member.end === 'from') {
      member.route.fromAlong = along;
      member.route.fromCount = count;
    } else {
      member.route.toAlong = along;
      member.route.toCount = count;
    }
  }

  // The corner points of one connector, from start to end.
  function buildPoints(route, a, b) {
    var p0 = sidePoint(a, route.fromSide, route.fromAlong);
    var p3 = sidePoint(b, route.toSide, route.toAlong);
    var via = route.edge.via;
    if (via && via.length > 0) {
      var points = [p0];
      for (var i = 0; i < via.length; i++) {
        points.push([via[i][0], via[i][1]]);
      }
      points.push(p3);
      return orthogonalize(points, route.fromSide);
    }
    var fromV = isVertical(route.fromSide);
    var toV = isVertical(route.toSide);
    // out and back on the same side: a C shape that clears both boxes by 24
    if (route.fromSide === route.toSide) {
      if (!fromV) {
        var outX = route.fromSide === 'right' ? Math.max(a.x + a.w, b.x + b.w) + 24 : Math.min(a.x, b.x) - 24;
        if (route.edge.outX) {
          outX = route.edge.outX;
        }
        return [p0, [outX, p0[1]], [outX, p3[1]], p3];
      }
      var outY = route.fromSide === 'bottom' ? Math.max(a.y + a.h, b.y + b.h) + 24 : Math.min(a.y, b.y) - 24;
      if (route.edge.outY) {
        outY = route.edge.outY;
      }
      return [p0, [p0[0], outY], [p3[0], outY], p3];
    }
    if (!fromV && !toV) {
      if (p0[1] === p3[1]) {
        return [p0, p3];
      }
      var midX = route.edge.midX ? route.edge.midX : AX.snap((p0[0] + p3[0]) / 2);
      return [p0, [midX, p0[1]], [midX, p3[1]], p3];
    }
    if (fromV && toV) {
      if (p0[0] === p3[0]) {
        return [p0, p3];
      }
      var midY = route.edge.midY ? route.edge.midY : AX.snap((p0[1] + p3[1]) / 2);
      return [p0, [p0[0], midY], [p3[0], midY], p3];
    }
    if (!fromV && toV) {
      // one bend: along, then down (or up) into the target
      return [p0, [p3[0], p0[1]], p3];
    }
    // leaves from top or bottom, enters from a side: down (or up), then along
    return [p0, [p0[0], p3[1]], p3];
  }

  // Makes a hand-given list of points right-angled: every pair of neighbours must
  // share x or y; if not, a corner is added (first along the start direction).
  function orthogonalize(points, firstSide) {
    var out = [points[0]];
    var horizontalFirst = !isVertical(firstSide);
    for (var i = 1; i < points.length; i++) {
      var prev = out[out.length - 1];
      var next = points[i];
      if (prev[0] !== next[0] && prev[1] !== next[1]) {
        if (horizontalFirst) {
          out.push([next[0], prev[1]]);
        } else {
          out.push([prev[0], next[1]]);
        }
      }
      out.push(next);
      horizontalFirst = !horizontalFirst;
    }
    return out;
  }

  function segmentsOf(points) {
    var list = [];
    for (var i = 0; i < points.length - 1; i++) {
      var a = points[i];
      var b = points[i + 1];
      list.push({
        index: i,
        x1: a[0], y1: a[1], x2: b[0], y2: b[1],
        horizontal: a[1] === b[1],
        length: Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]),
      });
    }
    return list;
  }

  // Finds the crossings where this connector must hop over a more important one.
  function findHops(route, others) {
    var hops = {};
    var mine = route.segments;
    for (var i = 0; i < others.length; i++) {
      var other = others[i];
      if (other === route || !visibleTogether(route.edge, other.edge)) {
        continue;
      }
      var mineLower = priority(route.edge) < priority(other.edge) ||
        (priority(route.edge) === priority(other.edge) && route.order > other.order);
      if (!mineLower) {
        continue;
      }
      for (var s = 0; s < mine.length; s++) {
        var seg = mine[s];
        for (var t = 0; t < other.segments.length; t++) {
          var o = other.segments[t];
          if (seg.horizontal === o.horizontal) {
            continue;
          }
          var h = seg.horizontal ? seg : o;
          var v = seg.horizontal ? o : seg;
          var hx1 = Math.min(h.x1, h.x2);
          var hx2 = Math.max(h.x1, h.x2);
          var vy1 = Math.min(v.y1, v.y2);
          var vy2 = Math.max(v.y1, v.y2);
          var margin = RADIUS + HOP + 2;
          if (v.x1 > hx1 + margin && v.x1 < hx2 - margin && h.y1 > vy1 + margin && h.y1 < vy2 - margin) {
            if (!hops[seg.index]) {
              hops[seg.index] = [];
            }
            hops[seg.index].push(seg.horizontal ? v.x1 : h.y1);
          }
        }
      }
    }
    return hops;
  }

  // Turns the corner points into an SVG path: rounded corners, and hops where needed.
  function pathData(points, hops) {
    var d = 'M' + points[0][0] + ',' + points[0][1];
    for (var i = 0; i < points.length - 1; i++) {
      var a = points[i];
      var b = points[i + 1];
      var dx = b[0] - a[0];
      var dy = b[1] - a[1];
      var length = Math.abs(dx) + Math.abs(dy);
      var dirX = dx === 0 ? 0 : (dx > 0 ? 1 : -1);
      var dirY = dy === 0 ? 0 : (dy > 0 ? 1 : -1);
      // how much of this segment the corner at its far end takes
      var endCut = i === points.length - 2 ? 0 : cornerRadius(points, i + 1, length);
      var segmentHops = hops[i] ? hops[i].slice() : [];
      segmentHops.sort(function (p, q) {
        return dirX !== 0 ? (p - q) * dirX : (p - q) * dirY;
      });
      for (var h = 0; h < segmentHops.length; h++) {
        var at = segmentHops[h];
        if (dirX !== 0) {
          d += ' L' + (at - HOP * dirX) + ',' + a[1];
          d += ' A' + HOP + ',' + HOP + ' 0 0,' + (dirX > 0 ? 1 : 0) + ' ' + (at + HOP * dirX) + ',' + a[1];
        } else {
          d += ' L' + a[0] + ',' + (at - HOP * dirY);
          d += ' A' + HOP + ',' + HOP + ' 0 0,' + (dirY > 0 ? 1 : 0) + ' ' + a[0] + ',' + (at + HOP * dirY);
        }
      }
      var endX = b[0] - dirX * endCut;
      var endY = b[1] - dirY * endCut;
      d += ' L' + endX + ',' + endY;
      if (i < points.length - 2) {
        var c = points[i + 2];
        var nx = c[0] - b[0];
        var ny = c[1] - b[1];
        var nDirX = nx === 0 ? 0 : (nx > 0 ? 1 : -1);
        var nDirY = ny === 0 ? 0 : (ny > 0 ? 1 : -1);
        d += ' Q' + b[0] + ',' + b[1] + ' ' + (b[0] + nDirX * endCut) + ',' + (b[1] + nDirY * endCut);
      }
    }
    return d;
  }

  // The radius used at corner point i: 8, or less when a neighbouring segment is short.
  function cornerRadius(points, i, length) {
    var before = points[i - 1];
    var at = points[i];
    var after = points[i + 1];
    var lengthBefore = Math.abs(at[0] - before[0]) + Math.abs(at[1] - before[1]);
    var lengthAfter = Math.abs(after[0] - at[0]) + Math.abs(after[1] - at[1]);
    return Math.min(RADIUS, lengthBefore / 2, lengthAfter / 2, length / 2);
  }

  function overlaps(a, b, margin) {
    return a.x < b.x + b.w + margin && a.x + a.w + margin > b.x &&
      a.y < b.y + b.h + margin && a.y + a.h + margin > b.y;
  }

  // Places the label beside a segment: beside a vertical one, or above or below a
  // horizontal one, always with a gap from the line. It tries every segment and both
  // sides, and takes the first spot that touches no box and no other label.
  function placeLabel(route, sizes, boxes, placed) {
    var text = route.edge.label;
    if (!text) {
      return null;
    }
    var fontSize = sizes.label;
    var width = AX.snapUp(AX.textWidth(text, fontSize, true, false, 0.06) + 8);
    var height = AX.snapUp(fontSize + 6);
    var order = route.segments.slice();
    order.sort(function (a, b) {
      return b.length - a.length;
    });
    // a three-segment connector prefers its middle segment
    if (route.segments.length === 3) {
      order.splice(order.indexOf(route.segments[1]), 1);
      order.unshift(route.segments[1]);
    }
    var candidates = [];
    for (var i = 0; i < order.length; i++) {
      var seg = order[i];
      if (seg.horizontal) {
        if (seg.length < width + 8) {
          continue;
        }
        var cx = AX.snap((seg.x1 + seg.x2) / 2 - width / 2);
        var above = { x: cx, y: AX.snap(seg.y1 - LABEL_GAP - height) };
        var below = { x: cx, y: AX.snap(seg.y1 + LABEL_GAP) };
        if (route.edge.labelBelow) {
          candidates.push(below, above);
        } else {
          candidates.push(above, below);
        }
      } else {
        if (seg.length < height + 12) {
          continue;
        }
        var cy = AX.snap((seg.y1 + seg.y2) / 2 - height / 2);
        var right = { x: AX.snap(seg.x1 + LABEL_GAP), y: cy };
        var left = { x: AX.snap(seg.x1 - LABEL_GAP - width), y: cy };
        if (route.edge.labelLeft) {
          candidates.push(left, right);
        } else {
          candidates.push(right, left);
        }
      }
    }
    var ids = Object.keys(boxes);
    for (var c = 0; c < candidates.length; c++) {
      var spot = { x: candidates[c].x, y: candidates[c].y, w: width, h: height };
      var clear = true;
      // only things that can be on screen at the same zoom level get in the way
      for (var b = 0; b < ids.length && clear; b++) {
        if (visibleTogether(route.edge, boxes[ids[b]]) && overlaps(spot, boxes[ids[b]], 2)) {
          clear = false;
        }
      }
      for (var p = 0; p < placed.length && clear; p++) {
        if (visibleTogether(route.edge, placed[p]) && overlaps(spot, placed[p], 2)) {
          clear = false;
        }
      }
      if (clear) {
        var label = { x: spot.x, y: spot.y, w: width, h: height, text: text, size: fontSize, lod: route.edge.lod || 1, max: route.edge.max || 0 };
        placed.push(label);
        return label;
      }
    }
    // nowhere clean: keep the first choice and let the build report it
    var fallback = candidates.length > 0 ? candidates[0] : { x: route.points[0][0], y: route.points[0][1] - 20 };
    route.labelProblem = true;
    return { x: fallback.x, y: fallback.y, w: width, h: height, text: text, size: fontSize };
  }

  function contains(outer, inner) {
    return inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;
  }

  // The connector rules the build enforces:
  //   1. right angles only (no diagonal segments)
  //   3. no two connectors drawn on top of each other
  //   5. no connector running behind a box that is not one of its ends
  function lintRoutes(routes, boxes, problems) {
    var ids = Object.keys(boxes);
    for (var r = 0; r < routes.length; r++) {
      var route = routes[r];
      var name = route.edge.from + ' -> ' + route.edge.to;
      var a = boxes[route.fromId];
      var b = boxes[route.toId];
      for (var s = 0; s < route.segments.length; s++) {
        var seg = route.segments[s];
        if (seg.x1 !== seg.x2 && seg.y1 !== seg.y2) {
          problems.push('connector ' + name + ' has a diagonal segment');
        }
        if (route.edge.transit) {
          continue;
        }
        // a thin box around the segment, a little shorter than the segment itself
        var span = {
          x: Math.min(seg.x1, seg.x2) + (seg.horizontal ? 2 : -0.5),
          y: Math.min(seg.y1, seg.y2) + (seg.horizontal ? -0.5 : 2),
          w: Math.max(1, Math.abs(seg.x2 - seg.x1) - (seg.horizontal ? 4 : 0)),
          h: Math.max(1, Math.abs(seg.y2 - seg.y1) - (seg.horizontal ? 0 : 4)),
        };
        for (var i = 0; i < ids.length; i++) {
          var box = boxes[ids[i]];
          if (ids[i] === route.fromId || ids[i] === route.toId || box.row) {
            continue;
          }
          // a container of either end is crossed on purpose (its frame)
          if (contains(box, a) || contains(box, b)) {
            continue;
          }
          // the rows of a table that is an end of this connector
          if (ids[i].indexOf(route.fromId.split('.')[0] + '.') === 0 || ids[i].indexOf(route.toId.split('.')[0] + '.') === 0) {
            continue;
          }
          if (visibleTogether(route.edge, box) && overlaps(span, box, 0)) {
            problems.push('connector ' + name + ' runs behind "' + ids[i] + '" (move a box, add via points, or set transit: true and dash it)');
            break;
          }
        }
      }
    }
    // rule 3: collinear overlap between two connectors that show together
    for (var p = 0; p < routes.length; p++) {
      for (var q = p + 1; q < routes.length; q++) {
        if (!visibleTogether(routes[p].edge, routes[q].edge)) {
          continue;
        }
        if (sharesStroke(routes[p].segments, routes[q].segments)) {
          problems.push('connectors ' + routes[p].edge.from + ' -> ' + routes[p].edge.to + ' and ' + routes[q].edge.from + ' -> ' + routes[q].edge.to + ' overlap');
        }
      }
    }
  }

  function sharesStroke(listA, listB) {
    for (var i = 0; i < listA.length; i++) {
      for (var j = 0; j < listB.length; j++) {
        var a = listA[i];
        var b = listB[j];
        if (a.horizontal && b.horizontal && Math.abs(a.y1 - b.y1) < 4) {
          var overlap = Math.min(Math.max(a.x1, a.x2), Math.max(b.x1, b.x2)) - Math.max(Math.min(a.x1, a.x2), Math.min(b.x1, b.x2));
          if (overlap > 12) {
            return true;
          }
        }
        if (!a.horizontal && !b.horizontal && Math.abs(a.x1 - b.x1) < 4) {
          var overlapY = Math.min(Math.max(a.y1, a.y2), Math.max(b.y1, b.y2)) - Math.max(Math.min(a.y1, a.y2), Math.min(b.y1, b.y2));
          if (overlapY > 12) {
            return true;
          }
        }
      }
    }
    return false;
  }

  // Routes every connector of a diagram. boxes: id -> {x, y, w, h}.
  function routeAll(edges, boxes, sizes) {
    var routes = [];
    var problems = [];
    for (var i = 0; i < edges.length; i++) {
      var edge = edges[i];
      var from = parseEnd(edge.from);
      var to = parseEnd(edge.to);
      var a = boxes[from.id];
      var b = boxes[to.id];
      if (!a || !b) {
        problems.push('connector ' + edge.from + ' -> ' + edge.to + ' names a box that does not exist');
        continue;
      }
      var sides = chooseSides(a, b);
      routes.push({
        edge: edge,
        order: i,
        fromId: from.id,
        toId: to.id,
        fromSide: from.side || sides[0],
        toSide: to.side || sides[1],
        fromAlong: 0,
        toAlong: 0,
        fromCount: 1,
        toCount: 1,
      });
    }
    assignPorts(routes, boxes);
    for (var r = 0; r < routes.length; r++) {
      var route = routes[r];
      route.points = buildPoints(route, boxes[route.fromId], boxes[route.toId]);
      route.segments = segmentsOf(route.points);
    }
    lintRoutes(routes, boxes, problems);
    var placed = [];
    for (var h = 0; h < routes.length; h++) {
      routes[h].hops = findHops(routes[h], routes);
      routes[h].d = pathData(routes[h].points, routes[h].hops);
      routes[h].labelBox = placeLabel(routes[h], sizes, boxes, placed);
      if (routes[h].labelProblem) {
        problems.push('the label "' + routes[h].edge.label + '" on ' + routes[h].edge.from + ' -> ' + routes[h].edge.to + ' has no clear spot');
      }
    }
    return { routes: routes, problems: problems };
  }

  AX.routeAll = routeAll;
  AX.chooseSides = chooseSides;
  AX.segmentsOf = segmentsOf;
})();
