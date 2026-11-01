// The Atlas docs in docs/knowledge: reading them, checking them against the rules that
// make them work well in Rem (RAG), and reading the glossary into term cards.
//
// Rem splits a file at #, ## and ### headings into chunks of at most 1800 characters,
// indexes YAML front matter and HTML comments as text, and mistakes a line starting
// with # inside a code block for a heading. Hence the rules checked here.
const fs = require('fs');
const path = require('path');
const loadCore = require('./load-core');

const MAX_SECTION = 1800;
const SOFT_SECTION = 1700;
const MIN_SECTION = 120;

let mdCore = null;
function md() {
  if (!mdCore) {
    mdCore = loadCore.loadCore(false).md;
  }
  return mdCore;
}

function listFiles(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs.readdirSync(dir).filter(function (name) {
    return name.endsWith('.md') && name.toLowerCase() !== 'readme.md';
  }).sort();
}

function readFile(dir, name) {
  return fs.readFileSync(path.join(dir, name), 'utf8').split('\r\n').join('\n');
}

// Splits a doc the way Rem does: one section per #, ## or ### heading.
function sections(text) {
  const lines = text.split('\n');
  const out = [];
  let current = { heading: '(top)', level: 0, lines: [] };
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^```/.test(line)) {
      inFence = !inFence;
    }
    const match = !inFence && line.match(/^(#{1,3})\s+(.*)$/);
    if (match) {
      out.push(current);
      current = { heading: match[2].trim(), level: match[1].length, lines: [line] };
    } else {
      current.lines.push(line);
    }
  }
  out.push(current);
  return out.filter(function (section) {
    return section.lines.join('\n').trim() !== '';
  });
}

// All the heading anchors in a doc (for checking links).
function anchors(text) {
  const blocks = md().parseBlocks(text);
  const list = {};
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i].type === 'h') {
      list[blocks[i].id] = true;
    }
  }
  return list;
}

// Checks every file; returns { errors, warnings }.
function lint(dir) {
  const errors = [];
  const warnings = [];
  const files = listFiles(dir);
  const texts = {};
  const anchorMap = {};
  for (let i = 0; i < files.length; i++) {
    texts[files[i]] = readFile(dir, files[i]);
    anchorMap[files[i]] = anchors(texts[files[i]]);
  }
  for (let f = 0; f < files.length; f++) {
    const name = files[f];
    const text = texts[name];
    const where = 'docs/knowledge/' + name;
    if (!/^[a-z0-9][a-z0-9-]{1,95}\.md$/.test(name)) {
      errors.push(where + ': file names use lowercase letters, digits and hyphens only');
    }
    if (!/^# \S/.test(text)) {
      errors.push(where + ': the first line must be the "# Title" (H1)');
    }
    if (/^---\s*$/m.test(text.split('\n')[0])) {
      errors.push(where + ': no front matter (Rem would index it as text)');
    }
    if (text.indexOf('<!--') !== -1) {
      errors.push(where + ': no HTML comments (Rem would index them as text)');
    }
    if (text.indexOf('~~~') !== -1) {
      errors.push(where + ': use ``` for code blocks, not ~~~');
    }
    if (Buffer.byteLength(text) > 500 * 1024) {
      errors.push(where + ': larger than 500 KB');
    }
    const lines = text.split('\n');
    let inFence = false;
    for (let l = 0; l < lines.length; l++) {
      if (/^```/.test(lines[l])) {
        inFence = !inFence;
        continue;
      }
      if (inFence && /^#/.test(lines[l])) {
        errors.push(where + ':' + (l + 1) + ': a line inside a code block starts with # (Rem reads it as a heading)');
      }
      if (!inFence && /^####/.test(lines[l])) {
        errors.push(where + ':' + (l + 1) + ': use at most ### headings');
      }
      if (!inFence && /<\/?[a-zA-Z][^>]*>/.test(lines[l].replace(/`[^`]*`/g, ''))) {
        errors.push(where + ':' + (l + 1) + ': no HTML tags in docs');
      }
    }
    const list = sections(text);
    for (let s = 0; s < list.length; s++) {
      const body = list[s].lines.join('\n').trim();
      if (body.length > MAX_SECTION) {
        errors.push(where + ': section "' + list[s].heading + '" is ' + body.length + ' characters (Rem cuts at ' + MAX_SECTION + ')');
      } else if (body.length > SOFT_SECTION) {
        warnings.push(where + ': section "' + list[s].heading + '" is ' + body.length + ' characters (keep under ' + SOFT_SECTION + ')');
      }
      if (body.length < MIN_SECTION && list[s].level > 1) {
        warnings.push(where + ': section "' + list[s].heading + '" is only ' + body.length + ' characters (Rem merges it into the one before)');
      }
    }
    // links to other docs must point at a file and a heading that exist
    const linkPattern = /\]\(([a-z0-9-]+\.md)(#[\w-]+)?\)/g;
    let match = linkPattern.exec(text);
    while (match) {
      if (!texts[match[1]]) {
        errors.push(where + ': links to ' + match[1] + ', which does not exist');
      } else if (match[2] && !anchorMap[match[1]][match[2].slice(1)]) {
        errors.push(where + ': links to ' + match[1] + match[2] + ', but that heading does not exist');
      }
      match = linkPattern.exec(text);
    }
  }
  return { errors: errors, warnings: warnings, files: files };
}

function termKey(name) {
  return md().slug(name);
}

// Reads glossary.md: "## Term", then "Technical: ...", "In plain words: ..." and an
// optional "Also called: a, b" paragraph.
function readGlossary(dir) {
  const file = path.join(dir, 'glossary.md');
  if (!fs.existsSync(file)) {
    return { terms: {}, problems: [], missing: true };
  }
  const text = readFile(dir, 'glossary.md');
  const parts = text.split(/\n(?=## )/);
  const terms = {};
  const problems = [];
  for (let i = 1; i < parts.length; i++) {
    const lines = parts[i].split('\n');
    const name = lines[0].replace(/^##\s+/, '').trim();
    const body = lines.slice(1).join('\n');
    const tech = body.match(/(?:^|\n)Technical:\s*([\s\S]*?)(?=\n\s*\n|$)/);
    const plain = body.match(/(?:^|\n)In plain words:\s*([\s\S]*?)(?=\n\s*\n|$)/);
    const also = body.match(/(?:^|\n)Also called:\s*([^\n]*)/);
    if (!tech || !plain) {
      problems.push('glossary.md: "' + name + '" needs both a "Technical:" and an "In plain words:" paragraph');
      continue;
    }
    const key = termKey(name);
    if (terms[key]) {
      problems.push('glossary.md: "' + name + '" appears twice');
    }
    terms[key] = {
      term: name,
      tech: tech[1].replace(/\s+/g, ' ').trim(),
      plain: plain[1].replace(/\s+/g, ' ').trim(),
      aliases: also ? also[1].split(',').map(function (a) {
        return a.trim().replace(/\.$/, '');
      }).filter(Boolean) : [],
    };
  }
  return { terms: terms, problems: problems };
}

module.exports = {
  listFiles: listFiles,
  readFile: readFile,
  sections: sections,
  lint: lint,
  readGlossary: readGlossary,
  termKey: termKey,
};
