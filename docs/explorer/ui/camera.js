// Moving around a diagram: drag to pan, wheel or pinch to zoom, buttons and keys too.
// The zoom also sets the detail level (1, 2 or 3) that decides which details show.
(function () {
  var MIN_SCALE = 0.15;
  var MAX_SCALE = 8;

  var state = {
    svg: null,
    world: null,
    stage: null,
    width: 0,
    height: 0,
    scale: 1,
    tx: 0,
    ty: 0,
    level: 1,
    showAll: false,
    pointers: {},
    dragFrom: null,
    moved: false,
    pinchFrom: 0,
    pinchScale: 1,
    frame: 0,
    onChange: null,
  };

  function clamp(value, low, high) {
    return Math.max(low, Math.min(high, value));
  }

  function stageSize() {
    var rect = state.stage.getBoundingClientRect();
    return { w: rect.width, h: rect.height, left: rect.left, top: rect.top };
  }

  // Room kept free at the bottom of the stage for the zoom toolbar.
  var TOOLBAR_ROOM = 60;

  // The scale that shows the whole diagram.
  function fitScale() {
    var size = stageSize();
    return Math.min((size.w - 48) / state.width, (size.h - 32 - TOOLBAR_ROOM) / state.height);
  }

  function apply() {
    if (state.frame) {
      return;
    }
    state.frame = window.requestAnimationFrame(function () {
      state.frame = 0;
      state.world.setAttribute('transform', 'translate(' + state.tx.toFixed(1) + ',' + state.ty.toFixed(1) + ') scale(' + state.scale.toFixed(4) + ')');
      updateLevel();
      if (state.onChange) {
        state.onChange(state);
      }
    });
  }

  // Level 2 shows from 1.35x, level 3 from 2.3x; going down waits a little longer.
  function updateLevel() {
    var level = state.level;
    while (level < 3 && state.scale >= AX.LOD_UP[level + 1]) {
      level += 1;
    }
    while (level > 1 && state.scale < AX.LOD_DOWN[level]) {
      level -= 1;
    }
    var shown = state.showAll ? 3 : level;
    if (state.svg.getAttribute('data-zoom') !== String(shown)) {
      state.svg.setAttribute('data-zoom', String(shown));
      if (level !== state.level) {
        AX.announce('Detail level ' + shown);
      }
    }
    state.level = level;
  }

  function setView(scale, tx, ty) {
    state.scale = clamp(scale, MIN_SCALE, MAX_SCALE);
    state.tx = tx;
    state.ty = ty;
    apply();
  }

  // Zooms by a factor, keeping the point (x, y) of the stage where it is.
  function zoomAt(factor, x, y) {
    var next = clamp(state.scale * factor, MIN_SCALE, MAX_SCALE);
    var real = next / state.scale;
    state.tx = x - (x - state.tx) * real;
    state.ty = y - (y - state.ty) * real;
    state.scale = next;
    apply();
  }

  function zoomBy(factor) {
    var size = stageSize();
    zoomAt(factor, size.w / 2, size.h / 2);
  }

  function panBy(dx, dy) {
    state.tx += dx;
    state.ty += dy;
    apply();
  }

  function fit() {
    var size = stageSize();
    var scale = clamp(Math.min(fitScale(), 1.25), MIN_SCALE, MAX_SCALE);
    var free = size.h - TOOLBAR_ROOM;
    setView(scale, (size.w - state.width * scale) / 2, Math.max(16, (free - state.height * scale) / 2));
  }

  // Centres a box of the diagram at a scale where the given level shows.
  function focusBox(box, level) {
    var size = stageSize();
    var scale = Math.max(state.scale, AX.LOD_UP[level] ? AX.LOD_UP[level] + 0.05 : state.scale);
    scale = clamp(scale, MIN_SCALE, MAX_SCALE);
    setView(scale, size.w / 2 - (box.x + box.w / 2) * scale, size.h / 2 - (box.y + box.h / 2) * scale);
  }

  // Pans just enough to bring a box on screen (for keyboard focus).
  function reveal(box) {
    var size = stageSize();
    var left = box.x * state.scale + state.tx;
    var top = box.y * state.scale + state.ty;
    var right = left + box.w * state.scale;
    var bottom = top + box.h * state.scale;
    var dx = 0;
    var dy = 0;
    if (left < 24) {
      dx = 24 - left;
    } else if (right > size.w - 24) {
      dx = size.w - 24 - right;
    }
    if (top < 24) {
      dy = 24 - top;
    } else if (bottom > size.h - 24) {
      dy = size.h - 24 - bottom;
    }
    if (dx !== 0 || dy !== 0) {
      panBy(dx, dy);
    }
  }

  function toggleAll() {
    state.showAll = !state.showAll;
    state.svg.setAttribute('data-zoom', String(state.showAll ? 3 : state.level));
    if (state.onChange) {
      state.onChange(state);
    }
    AX.announce(state.showAll ? 'Showing every detail' : 'Details follow the zoom again');
  }

  // ---------- pointer and wheel ----------

  function onWheel(event) {
    event.preventDefault();
    var size = stageSize();
    var delta = event.deltaY;
    if (event.deltaMode === 1) {
      delta *= 16;
    }
    var speed = event.ctrlKey ? 0.01 : 0.0015;
    zoomAt(Math.exp(-delta * speed), event.clientX - size.left, event.clientY - size.top);
  }

  function onPointerDown(event) {
    if (event.button !== 0 && event.pointerType === 'mouse') {
      return;
    }
    state.pointers[event.pointerId] = { x: event.clientX, y: event.clientY };
    var ids = Object.keys(state.pointers);
    if (ids.length === 1) {
      state.dragFrom = { x: event.clientX, y: event.clientY, tx: state.tx, ty: state.ty };
      state.moved = false;
    } else if (ids.length === 2) {
      var a = state.pointers[ids[0]];
      var b = state.pointers[ids[1]];
      state.pinchFrom = Math.hypot(a.x - b.x, a.y - b.y);
      state.pinchScale = state.scale;
      state.moved = true;
    }
  }

  function onPointerMove(event) {
    if (!state.pointers[event.pointerId]) {
      return;
    }
    state.pointers[event.pointerId] = { x: event.clientX, y: event.clientY };
    var ids = Object.keys(state.pointers);
    if (ids.length === 2 && state.pinchFrom > 0) {
      var a = state.pointers[ids[0]];
      var b = state.pointers[ids[1]];
      var distance = Math.hypot(a.x - b.x, a.y - b.y);
      var size = stageSize();
      var target = state.pinchScale * distance / state.pinchFrom;
      zoomAt(target / state.scale, (a.x + b.x) / 2 - size.left, (a.y + b.y) / 2 - size.top);
      return;
    }
    if (!state.dragFrom) {
      return;
    }
    var dx = event.clientX - state.dragFrom.x;
    var dy = event.clientY - state.dragFrom.y;
    if (!state.moved && Math.abs(dx) + Math.abs(dy) > 4) {
      state.moved = true;
      state.stage.setAttribute('data-drag', 'on');
      if (state.stage.setPointerCapture) {
        state.stage.setPointerCapture(event.pointerId);
      }
    }
    if (state.moved) {
      state.tx = state.dragFrom.tx + dx;
      state.ty = state.dragFrom.ty + dy;
      apply();
    }
  }

  function onPointerUp(event) {
    delete state.pointers[event.pointerId];
    if (Object.keys(state.pointers).length === 0) {
      state.dragFrom = null;
      state.pinchFrom = 0;
      state.stage.removeAttribute('data-drag');
    }
  }

  // A drag must never also count as a click on the box under the pointer.
  function onClickCapture(event) {
    if (state.moved) {
      event.preventDefault();
      event.stopPropagation();
      state.moved = false;
    }
  }

  function onDoubleClick(event) {
    if (event.target.closest('a')) {
      return;
    }
    var size = stageSize();
    zoomAt(2, event.clientX - size.left, event.clientY - size.top);
  }

  // Connects the camera to a stage. The listeners are added once per stage element.
  function attach(stage, svgElement, world, width, height, onChange) {
    state.svg = svgElement;
    state.world = world;
    state.width = width;
    state.height = height;
    state.level = 1;
    state.onChange = onChange;
    if (state.stage !== stage) {
      state.stage = stage;
      stage.addEventListener('wheel', onWheel, { passive: false });
      stage.addEventListener('pointerdown', onPointerDown);
      stage.addEventListener('pointermove', onPointerMove);
      stage.addEventListener('pointerup', onPointerUp);
      stage.addEventListener('pointercancel', onPointerUp);
      stage.addEventListener('click', onClickCapture, true);
      stage.addEventListener('dblclick', onDoubleClick);
    }
  }

  AX.camera = {
    state: state,
    attach: attach,
    fit: fit,
    setView: setView,
    zoomBy: zoomBy,
    panBy: panBy,
    focusBox: focusBox,
    reveal: reveal,
    toggleAll: toggleAll,
  };
})();
