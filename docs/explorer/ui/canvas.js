// Shows one diagram: builds its scene once, draws it as SVG, connects the camera,
// and handles focus, the detail sheet and the outline (the same diagram as a list).
(function () {
  var scenes = {};
  var cameras = {};
  var current = '';

  function sceneFor(id) {
    if (!scenes[id]) {
      scenes[id] = AX.buildScene(AX.views[id]);
    }
    return scenes[id];
  }

  // Where a clicked box leads: its own diagram if it has one, else its detail sheet.
  function linkFor(link) {
    if (link.opens && AX.views[link.opens]) {
      return { href: '#/v/' + link.opens, label: link.name + '. Opens ' + AX.views[link.opens].title + '.', term: link.term };
    }
    if (link.piece) {
      return {
        href: '#/v/' + current + '?p=' + encodeURIComponent(link.piece) + (link.id ? '&n=' + encodeURIComponent(link.id) : ''),
        label: link.name + '. Shows its details.',
        term: link.term,
      };
    }
    if (link.term) {
      return { href: '#/terms/' + encodeURIComponent(link.term), label: link.name + '. Opens its glossary entry.', term: link.term };
    }
    return { href: '#/v/' + current, label: link.name, term: '' };
  }

  function updateZoomUi(state) {
    var text = document.getElementById('zoom-text');
    if (text) {
      text.textContent = Math.round(state.scale * 100) + '%';
    }
    var level = document.getElementById('level-text');
    if (level) {
      level.textContent = state.showAll ? 'All details' : 'Detail ' + state.level + ' of 3';
    }
    var details = document.getElementById('details-btn');
    if (details) {
      details.setAttribute('aria-pressed', state.showAll ? 'true' : 'false');
    }
  }

  function remember() {
    if (current) {
      var state = AX.camera.state;
      cameras[current] = { scale: state.scale, tx: state.tx, ty: state.ty };
    }
  }

  function show(id, params, isFirst) {
    var spec = AX.views[id];
    if (!spec) {
      AX.shell.notFound('There is no diagram named "' + id + '".');
      return;
    }
    var changed = current !== id;
    if (changed) {
      remember();
    }
    current = id;
    var scene = sceneFor(id);
    var stage = document.getElementById('stage');
    if (changed || !stage.firstChild) {
      draw(spec, scene, stage);
    }
    if (params.z) {
      var size = stage.getBoundingClientRect();
      var scale = parseFloat(params.z);
      if (params.z === 'fit' || isNaN(scale)) {
        AX.camera.fit();
      } else {
        AX.camera.setView(scale, (size.width - scene.w * scale) / 2, (size.height - scene.h * scale) / 2);
      }
    }
    if (params.d === '1' && !AX.camera.state.showAll) {
      AX.camera.toggleAll();
    }
    if (params.n && scene.boxes[params.n]) {
      var box = scene.boxes[params.n];
      AX.camera.focusBox(box, box.lod || 1);
      mark(params.n);
    }
    AX.shell.showView(spec);
    if (params.p) {
      AX.sheet.open(params.p);
    } else {
      AX.sheet.close(true);
    }
    if (changed) {
      AX.router.focusHeading('view-title', isFirst);
      AX.announce('Opened ' + spec.title);
    }
  }

  function draw(spec, scene, stage) {
    var svgElement = AX.svg('svg', {
      class: 'canvas', role: 'group', 'data-zoom': '1',
      'aria-labelledby': 'canvas-title canvas-desc',
    });
    var title = AX.svg('title', { id: 'canvas-title' });
    title.textContent = spec.title;
    var desc = AX.svg('desc', { id: 'canvas-desc' });
    desc.textContent = spec.desc || spec.purpose || '';
    svgElement.appendChild(title);
    svgElement.appendChild(desc);
    var world = AX.svg('g', { class: 'world' });
    AX.mountTree(world, AX.drawScene(scene), linkFor);
    svgElement.appendChild(world);
    AX.clear(stage);
    stage.appendChild(svgElement);
    AX.camera.attach(stage, svgElement, world, scene.w, scene.h, updateZoomUi);
    AX.camera.state.showAll = false;
    var saved = cameras[spec.id];
    if (saved) {
      AX.camera.setView(saved.scale, saved.tx, saved.ty);
    } else {
      AX.camera.fit();
    }
    AX.outline.render(spec, scene);
  }

  // Briefly outlines a box that a link pointed at.
  function mark(nodeId) {
    var stage = document.getElementById('stage');
    var target = stage.querySelector('[data-id="' + cssEscape(nodeId) + '"]');
    if (!target) {
      return;
    }
    target.setAttribute('data-hit', 'on');
    window.setTimeout(function () {
      target.removeAttribute('data-hit');
    }, 2400);
  }

  function cssEscape(value) {
    return String(value).replace(/["\\]/g, '\\$&');
  }

  // Keyboard focus on a box that is off screen pans it into view.
  function onFocusIn(event) {
    var link = event.target.closest ? event.target.closest('a[data-id]') : null;
    if (!link || !current) {
      return;
    }
    var box = sceneFor(current).boxes[link.getAttribute('data-id')];
    if (box) {
      AX.camera.reveal(box);
    }
  }

  // The part a focused box stands for (for the I key).
  function focusedPiece() {
    var active = document.activeElement;
    if (!active || !active.closest) {
      return '';
    }
    var link = active.closest('a[data-piece]');
    return link ? link.getAttribute('data-piece') : '';
  }

  function init() {
    document.getElementById('stage').addEventListener('focusin', onFocusIn);
  }

  AX.canvas = {
    init: init,
    show: show,
    sceneFor: sceneFor,
    focusedPiece: focusedPiece,
    current: function () {
      return current;
    },
  };
})();
