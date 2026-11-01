// Starts the explorer: reads the data the build put in the page, sets up every part,
// then shows the place named in the address (the overview if there is none).
(function () {
  function start() {
    AX.DATA = JSON.parse(document.getElementById('atlas-data').textContent);
    // the diagrams the build drew from the code (one per endpoint and per page)
    var generated = AX.DATA.views || [];
    for (var i = 0; i < generated.length; i++) {
      AX.addView(generated[i]);
    }
    AX.shell.init();
    AX.canvas.init();
    AX.sheet.init();
    AX.tip.init();
    AX.reader.init();
    AX.chat.init();
    AX.findUi.init();
    AX.keys.init();
    var hint = document.getElementById('hint');
    if (hint && !AX.store.get('atlas-explorer-hint')) {
      hint.hidden = false;
      document.getElementById('hint-close').addEventListener('click', function () {
        hint.hidden = true;
        AX.store.set('atlas-explorer-hint', 'seen');
      });
    }
    AX.router.route();
    // the stage size changes when the window does: keep the diagram in view
    var resizeTimer = 0;
    window.addEventListener('resize', function () {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(function () {
        if (document.body.getAttribute('data-page') === 'view-page' && AX.camera.state.svg) {
          AX.camera.fit();
        }
      }, 200);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
