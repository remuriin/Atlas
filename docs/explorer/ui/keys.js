// Keyboard shortcuts for the whole explorer (press ? to see them):
//   + - 0   zoom in, out, fit        arrows   move around (Shift: faster)
//   D       all details              O        outline (the diagram as a list)
//   I       details of the focused box
//   / Ctrl+K search    T theme    C chat    ? help    Esc close or go up a level
(function () {
  function isTyping(target) {
    if (!target) {
      return false;
    }
    var tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
  }

  function onView() {
    return document.body.getAttribute('data-page') === 'view-page';
  }

  // Esc closes the topmost thing that is open; with nothing open it goes up a level.
  function escape() {
    if (AX.tip.hide()) {
      return;
    }
    if (AX.findUi.close()) {
      return;
    }
    var help = document.getElementById('help');
    if (help.open) {
      help.close();
      return;
    }
    if (AX.chat.close()) {
      return;
    }
    if (AX.shell.closeMenu()) {
      return;
    }
    if (AX.outline.close()) {
      return;
    }
    if (AX.sheet.close(false)) {
      return;
    }
    AX.shell.up();
  }

  function onKeyDown(event) {
    if (event.key === 'Escape') {
      escape();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      AX.findUi.open('');
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey || isTyping(event.target)) {
      return;
    }
    var key = event.key;
    var step = event.shiftKey ? 240 : 60;
    if (key === '/') {
      event.preventDefault();
      AX.findUi.open('');
    } else if (key === '?') {
      event.preventDefault();
      document.getElementById('help').showModal();
    } else if (key === 't' || key === 'T') {
      AX.shell.toggleTheme();
    } else if (key === 'c' || key === 'C') {
      AX.chat.toggle();
    } else if (!onView()) {
      return;
    } else if (key === '+' || key === '=') {
      AX.camera.zoomBy(1.25);
    } else if (key === '-' || key === '_') {
      AX.camera.zoomBy(0.8);
    } else if (key === '0') {
      AX.camera.fit();
    } else if (key === 'd' || key === 'D') {
      AX.camera.toggleAll();
    } else if (key === 'o' || key === 'O') {
      AX.outline.toggle();
    } else if (key === 'i' || key === 'I') {
      var piece = AX.canvas.focusedPiece();
      if (piece) {
        AX.router.go('#/v/' + AX.canvas.current() + '?p=' + encodeURIComponent(piece));
      }
    } else if (key === 'ArrowLeft') {
      event.preventDefault();
      AX.camera.panBy(step, 0);
    } else if (key === 'ArrowRight') {
      event.preventDefault();
      AX.camera.panBy(-step, 0);
    } else if (key === 'ArrowUp') {
      event.preventDefault();
      AX.camera.panBy(0, step);
    } else if (key === 'ArrowDown') {
      event.preventDefault();
      AX.camera.panBy(0, -step);
    }
  }

  function init() {
    document.addEventListener('keydown', onKeyDown);
    document.getElementById('help-btn').addEventListener('click', function () {
      document.getElementById('help').showModal();
    });
    document.getElementById('help-close').addEventListener('click', function () {
      document.getElementById('help').close();
    });
    document.getElementById('zoom-in').addEventListener('click', function () {
      AX.camera.zoomBy(1.25);
    });
    document.getElementById('zoom-out').addEventListener('click', function () {
      AX.camera.zoomBy(0.8);
    });
    document.getElementById('zoom-fit').addEventListener('click', function () {
      AX.camera.fit();
    });
    document.getElementById('details-btn').addEventListener('click', function () {
      AX.camera.toggleAll();
    });
    document.getElementById('outline-btn').addEventListener('click', function () {
      AX.outline.toggle();
    });
    document.getElementById('outline-close').addEventListener('click', function () {
      AX.outline.close();
    });
  }

  AX.keys = {
    init: init,
  };
})();
