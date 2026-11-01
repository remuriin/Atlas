// Reads the Atlas design tokens (frontend/src/styles/tokens.css) so the explorer
// uses the same colours as the app, and checks the colour contrast of the roles.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const TOKENS = path.join(ROOT, 'frontend', 'src', 'styles', 'tokens.css');
const STYLES = path.join(__dirname, '..', 'explorer', 'styles');

// Each diagram role and the Atlas token it takes its colour from.
const ROLE_TOKENS = {
  paper: 'color-canvas',
  'paper-2': 'color-subtle',
  frame: 'color-inset',
  ink: 'color-text',
  muted: 'color-text-muted',
  rule: 'color-border',
  'rule-solid': 'color-border-control',
  accent: 'color-success-text',
  'accent-tint': 'color-success-subtle',
  'accent-fill': 'color-success',
  link: 'color-accent',
  'link-tint': 'color-accent-subtle',
  danger: 'color-danger',
};

function readTokensCss() {
  // the repo may check files out with Windows line endings
  return fs.readFileSync(TOKENS, 'utf8').split('\r\n').join('\n');
}

// The hex colours of one theme block in tokens.css.
function blockColours(css, startMarker) {
  const start = css.indexOf(startMarker);
  if (start === -1) {
    throw new Error('tokens.css: cannot find ' + startMarker);
  }
  const open = css.indexOf('{', start);
  const close = css.indexOf('\n}', open);
  const body = css.slice(open + 1, close);
  const colours = {};
  const pattern = /--([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g;
  let match = pattern.exec(body);
  while (match) {
    colours[match[1]] = match[2].toLowerCase();
    match = pattern.exec(body);
  }
  return colours;
}

function themeColours() {
  const css = readTokensCss();
  const light = blockColours(css, ':root,\n:root[data-theme="light"]');
  const dark = Object.assign({}, light, blockColours(css, ':root[data-theme="dark"]'));
  return { light: light, dark: dark };
}

function roleColours(themeName) {
  const all = themeColours()[themeName];
  const roles = {};
  const names = Object.keys(ROLE_TOKENS);
  for (let i = 0; i < names.length; i++) {
    const value = all[ROLE_TOKENS[names[i]]];
    if (!value) {
      throw new Error('tokens.css has no --' + ROLE_TOKENS[names[i]]);
    }
    roles[names[i]] = value;
  }
  return roles;
}

// ---------- contrast (WCAG 2.x) ----------

function luminance(hex) {
  let value = hex.replace('#', '');
  if (value.length === 3) {
    value = value[0] + value[0] + value[1] + value[1] + value[2] + value[2];
  }
  const channels = [0, 2, 4].map(function (i) {
    const c = parseInt(value.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a, b) {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

// Text roles need 4.5:1 and outline roles 3:1 on every surface they sit on.
function checkContrast() {
  const problems = [];
  const report = [];
  const themes = ['light', 'dark'];
  const textRoles = ['ink', 'muted', 'link', 'accent'];
  const surfaces = ['paper', 'paper-2', 'accent-tint'];
  for (let t = 0; t < themes.length; t++) {
    const roles = roleColours(themes[t]);
    for (let s = 0; s < surfaces.length; s++) {
      for (let r = 0; r < textRoles.length; r++) {
        const ratio = contrast(roles[textRoles[r]], roles[surfaces[s]]);
        report.push(themes[t] + ' ' + textRoles[r] + ' on ' + surfaces[s] + ' ' + ratio.toFixed(2));
        if (ratio < 4.5) {
          problems.push(themes[t] + ': ' + textRoles[r] + ' on ' + surfaces[s] + ' is ' + ratio.toFixed(2) + ':1 (needs 4.5)');
        }
      }
      // outlines sit on paper and paper-2 (focal boxes on accent-tint use the accent stroke)
      const outline = contrast(roles['rule-solid'], roles[surfaces[s]]);
      if (surfaces[s] !== 'accent-tint' && outline < 3) {
        problems.push(themes[t] + ': rule-solid on ' + surfaces[s] + ' is ' + outline.toFixed(2) + ':1 (needs 3)');
      }
    }
    const onButton = contrast('#ffffff', roles['accent-fill']);
    if (onButton < 4.5) {
      problems.push(themes[t] + ': white on the green chat bubble is ' + onButton.toFixed(2) + ':1');
    }
  }
  return { problems: problems, report: report };
}

// CSS for a static snapshot: the roles as plain colours, then the diagram styles.
function snapshotCss(themeName) {
  const roles = roleColours(themeName);
  let css = ':root {\n';
  const names = Object.keys(roles);
  for (let i = 0; i < names.length; i++) {
    css += '  --' + names[i] + ': ' + roles[names[i]] + ';\n';
  }
  css += '  --sans: "Schibsted Grotesk Variable", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;\n';
  css += '  --mono: "JetBrains Mono Variable", ui-monospace, SFMono-Regular, Consolas, monospace;\n}\n';
  css += 'body { margin: 0; background: var(--paper); color: var(--ink); font-family: var(--sans); }\n';
  css += '.sheet-page { padding: 32px 40px; }\n';
  css += '.eyebrow-text { font-family: var(--mono); font-size: 12px; letter-spacing: 0.14em; color: var(--muted); margin: 0 0 8px; }\n';
  css += 'h1 { font-size: 1.75rem; letter-spacing: -0.02em; margin: 0 0 8px; }\n';
  css += '.purpose { color: var(--muted); max-width: 45rem; margin: 0 0 24px; }\n';
  css += '@media print { .sheet-page { padding: 0; } }\n';
  css += fs.readFileSync(path.join(STYLES, 'canvas.css'), 'utf8');
  return css;
}

module.exports = {
  TOKENS: TOKENS,
  readTokensCss: readTokensCss,
  themeColours: themeColours,
  roleColours: roleColours,
  contrast: contrast,
  checkContrast: checkContrast,
  snapshotCss: snapshotCss,
};
