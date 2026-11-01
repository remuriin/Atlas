// Writes a static page for one diagram at one zoom level, in the shape the
// diagram-design skill expects (eyebrow, heading, one accessible SVG, no script).
// Used for the snapshots the skill's self_check.py reads, and for quick previews.
const fs = require('fs');
const path = require('path');
const sceneSvg = require('./scene-svg');
const theme = require('./theme');

function snapshotHtml(AX, spec, zoom, themeName) {
  const scene = AX.buildScene(spec);
  const tree = AX.drawScene(scene);
  const slug = spec.id + '-lod' + zoom + (themeName === 'dark' ? '-dark' : '');
  const svg = sceneSvg.sceneToSvg(tree, scene, {
    slug: slug,
    zoom: zoom,
    title: spec.title,
    desc: spec.desc || spec.purpose,
  });
  const css = theme.snapshotCss(themeName);
  const html = '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    '<title>' + sceneSvg.escapeText(spec.title) + ' · Atlas Explorer</title>\n' +
    '<style>\n' + css + '\n</style>\n</head>\n<body>\n<main class="sheet-page">\n' +
    '<p class="eyebrow-text">' + sceneSvg.escapeText(spec.eyebrow || spec.type.toUpperCase()) + ' · ZOOM LEVEL ' + zoom + '</p>\n' +
    '<h1>' + sceneSvg.escapeText(spec.title) + '</h1>\n' +
    '<p class="purpose">' + sceneSvg.escapeText(spec.purpose || '') + '</p>\n' +
    '<div class="scroll" style="overflow-x:auto">\n<div style="min-width:' + scene.w + 'px">\n' + svg + '</div>\n</div>\n' +
    '</main>\n</body>\n</html>\n';
  return { html: html, scene: scene };
}

function writeSnapshot(AX, spec, zoom, themeName, outDir) {
  const result = snapshotHtml(AX, spec, zoom, themeName);
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, spec.id + '-lod' + zoom + (themeName === 'dark' ? '-dark' : '') + '.html');
  fs.writeFileSync(file, result.html);
  return { file: file, scene: result.scene };
}

module.exports = {
  snapshotHtml: snapshotHtml,
  writeSnapshot: writeSnapshot,
};
