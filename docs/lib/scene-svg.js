// Writes a drawn scene (the element tree from explorer/core/draw.js) as SVG text,
// for the static snapshots and quick previews.

function escapeText(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(value) {
  return escapeText(value).replace(/"/g, '&quot;');
}

function nodeToSvg(node, indent) {
  const pad = '  '.repeat(indent);
  let attrs = '';
  const names = Object.keys(node.attrs);
  for (let i = 0; i < names.length; i++) {
    attrs += ' ' + names[i] + '="' + escapeAttr(node.attrs[names[i]]) + '"';
  }
  if (node.text !== null) {
    return pad + '<' + node.tag + attrs + '>' + escapeText(node.text) + '</' + node.tag + '>\n';
  }
  if (node.kids.length === 0) {
    return pad + '<' + node.tag + attrs + '/>\n';
  }
  let out = pad + '<' + node.tag + attrs + '>\n';
  for (let i = 0; i < node.kids.length; i++) {
    out += nodeToSvg(node.kids[i], indent + 1);
  }
  out += pad + '</' + node.tag + '>\n';
  return out;
}

// A complete <svg> element. ids: { title, desc } for the accessible name.
function sceneToSvg(tree, scene, options) {
  const titleId = options.slug + '-title';
  const descId = options.slug + '-desc';
  let out = '<svg class="canvas" data-zoom="' + (options.zoom || 1) + '" xmlns="http://www.w3.org/2000/svg"' +
    ' viewBox="0 0 ' + scene.w + ' ' + scene.h + '" width="' + scene.w + '" height="' + scene.h + '"' +
    ' role="img" aria-labelledby="' + titleId + ' ' + descId + '">\n';
  out += '  <title id="' + titleId + '">' + escapeText(options.title) + '</title>\n';
  out += '  <desc id="' + descId + '">' + escapeText(options.desc) + '</desc>\n';
  for (let i = 0; i < tree.length; i++) {
    out += nodeToSvg(tree[i], 1);
  }
  out += '</svg>\n';
  return out;
}

module.exports = {
  sceneToSvg: sceneToSvg,
  escapeText: escapeText,
  escapeAttr: escapeAttr,
};
