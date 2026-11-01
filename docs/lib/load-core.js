// Loads the explorer's shared scripts (explorer/core) and the diagram data
// (explorer/data/views) into one sandbox, the same way the page loads them, and
// returns the AX object they fill. The build uses it to check every diagram.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const EXPLORER = path.join(__dirname, '..', 'explorer');

// The core files, in the order they must run (later ones use earlier ones).
const CORE_FILES = ['ns.js', 'text.js', 'route.js', 'scene.js', 'draw.js', 'md.js', 'terms.js', 'find.js'];

function listViewFiles() {
  const dir = path.join(EXPLORER, 'data', 'views');
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs.readdirSync(dir).filter(function (name) {
    return name.endsWith('.js');
  }).sort().map(function (name) {
    return path.join(dir, name);
  });
}

function coreFilePaths() {
  return CORE_FILES.map(function (name) {
    return path.join(EXPLORER, 'core', name);
  }).filter(function (file) {
    return fs.existsSync(file);
  });
}

function loadCore(withViews) {
  const sandbox = { console: console };
  vm.createContext(sandbox);
  const files = coreFilePaths();
  if (withViews) {
    const views = listViewFiles();
    for (let i = 0; i < views.length; i++) {
      files.push(views[i]);
    }
  }
  for (let i = 0; i < files.length; i++) {
    const code = fs.readFileSync(files[i], 'utf8');
    vm.runInContext(code, sandbox, { filename: files[i] });
  }
  return sandbox.AX;
}

module.exports = {
  loadCore: loadCore,
  coreFilePaths: coreFilePaths,
  listViewFiles: listViewFiles,
  EXPLORER: EXPLORER,
};
