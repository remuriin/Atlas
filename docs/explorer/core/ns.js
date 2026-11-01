// The one shared object every explorer script adds to. Each file wraps its own
// helpers in a function and puts only what others need on AX. The same files run
// in the browser (the built page) and in Node (the build checks every diagram).
var AX = {
  // Detail levels: what the diagram shows at each zoom. Level 2 appears at
  // 1.35x and level 3 at 2.3x; going back down waits a little longer (hysteresis)
  // so the picture does not flicker at the edge.
  LOD_UP: [0, 0, 1.35, 2.3],
  LOD_DOWN: [0, 0, 1.25, 2.1],

  // World font sizes per role. Small text only appears at the zoom that makes it readable.
  FONT: {
    name: 13,
    tag: 8,
    sub: 9,
    zone: 9,
    label: 8.5,
    kidName: 10,
    kidSub: 7.5,
    detail: 6.5,
    title: 18,
  },

  SANS: '"Schibsted Grotesk Variable", -apple-system, "Segoe UI", sans-serif',
  MONO: '"JetBrains Mono Variable", ui-monospace, Consolas, monospace',

  // Filled by the data files (views) and by the build (pieces, docs, terms).
  views: {},
  viewOrder: [],
};

// Data files call AX.addView({ id: ..., ... }) once per diagram.
AX.addView = function (spec) {
  if (AX.views[spec.id]) {
    throw new Error('Two views share the id "' + spec.id + '"');
  }
  AX.views[spec.id] = spec;
  AX.viewOrder.push(spec.id);
};
