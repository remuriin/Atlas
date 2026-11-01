// Quick look at one diagram while drawing it: writes a static page per zoom level
// into docs/dist/preview and prints any layout problems.
// Usage: node docs/preview-view.js <view-id> [light|dark]   (also ep.<endpoint> and page.<Page>)
const path = require('path');
const loadCore = require('./lib/load-core');
const snapshot = require('./lib/snapshot');

const viewId = process.argv[2] || 'system';
const themeName = process.argv[3] || 'light';
const AX = loadCore.loadCore(true);
let spec = AX.views[viewId];
if (!spec && (viewId.indexOf('ep.') === 0 || viewId.indexOf('page.') === 0)) {
  // a diagram the build draws from the code
  const generated = require('./lib/generated-views').all(AX, require('./lib/extract').extractAll());
  for (let i = 0; i < generated.length; i++) {
    if (generated[i].id === viewId) {
      spec = generated[i];
    }
  }
}
if (!spec) {
  console.error('No view named ' + viewId + '. Views: ' + AX.viewOrder.join(', '));
  process.exit(1);
}
const outDir = path.join(__dirname, 'dist', 'preview');
for (let zoom = 1; zoom <= 3; zoom++) {
  const result = snapshot.writeSnapshot(AX, spec, zoom, themeName, outDir);
  if (zoom === 1) {
    console.log(viewId + ': ' + result.scene.w + ' x ' + result.scene.h);
    for (let i = 0; i < result.scene.problems.length; i++) {
      console.log('  problem: ' + result.scene.problems[i]);
    }
  }
  console.log('  ' + result.file);
}
