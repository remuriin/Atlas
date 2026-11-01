// Takes screenshots of the built Explorer with headless Microsoft Edge, for reviewing the
// diagrams: every hand-drawn diagram, zoomed to fit, at 1.5x (detail level 2) and at
// 2.6x (level 3), in the light and the dark theme.
//
//   node docs/shoot-explorer.js                    every diagram
//   node docs/shoot-explorer.js system pipeline    only these diagrams
//   node docs/shoot-explorer.js --generated        also the ep.* and page.* diagrams
//   node docs/shoot-explorer.js --light            only the light theme
//
// Run node docs/build-explorer.js first. The pictures go to docs/dist/shots. Set EDGE to
// the path of msedge.exe if it is not in the usual place.
const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');
const loadCore = require('./lib/load-core');

const DIST = path.join(__dirname, 'dist');
const PAGE = path.join(DIST, 'atlas-explorer.html');
const OUT = path.join(DIST, 'shots');
const EDGE = process.env.EDGE || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ZOOMS = ['fit', '1.5', '2.6'];

const args = process.argv.slice(2);
const withGenerated = args.indexOf('--generated') !== -1;
const themes = args.indexOf('--light') !== -1 ? ['light'] : ['light', 'dark'];
const picked = args.filter(function (arg) {
  return arg.indexOf('--') !== 0;
});

function viewIds() {
  if (picked.length > 0) {
    return picked;
  }
  const AX = loadCore.loadCore(true);
  const ids = AX.viewOrder.filter(function (id) {
    const spec = AX.views[id];
    return spec.type !== 'hub' && spec.type !== 'catalogue';
  });
  if (withGenerated) {
    const generated = require('./lib/generated-views').all(AX, require('./lib/extract').extractAll());
    for (let i = 0; i < generated.length; i++) {
      ids.push(generated[i].id);
    }
  }
  return ids;
}

function main() {
  if (!fs.existsSync(PAGE)) {
    console.error('Build the page first: node docs/build-explorer.js');
    process.exit(1);
  }
  if (!fs.existsSync(EDGE)) {
    console.error('Microsoft Edge was not found at ' + EDGE + '. Set EDGE to the path of msedge.exe.');
    process.exit(1);
  }
  fs.mkdirSync(OUT, { recursive: true });
  const base = 'file:///' + PAGE.split(path.sep).join('/');
  const ids = viewIds();
  let count = 0;
  for (let v = 0; v < ids.length; v++) {
    for (let t = 0; t < themes.length; t++) {
      for (let z = 0; z < ZOOMS.length; z++) {
        const file = path.join(OUT, ids[v] + '-' + ZOOMS[z].replace('.', '_') + '-' + themes[t] + '.png');
        const url = base + '#/v/' + encodeURIComponent(ids[v]) + '?z=' + ZOOMS[z] + '&theme=' + themes[t];
        childProcess.execFileSync(EDGE, [
          '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
          '--window-size=1440,900', '--virtual-time-budget=3000', '--screenshot=' + file, url,
        ], { stdio: 'ignore' });
        count += 1;
      }
    }
    console.log(ids[v]);
  }
  console.log('Wrote ' + count + ' screenshots to ' + path.relative(path.join(__dirname, '..'), OUT));
}

main();
