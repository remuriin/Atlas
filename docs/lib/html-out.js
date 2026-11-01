// Turns one Atlas doc (Markdown) into the HTML the explorer's docs reader shows:
// heading anchors, "Ask Rem about this section" buttons, links that stay inside the
// explorer, and glossary terms marked for their hover card.
const path = require('path');

function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const REPO_BLOB = 'https://github.com/remuriin/Atlas/blob/main/';

// Where a link in a doc should go inside the page.
function linkTarget(href) {
  const doc = href.match(/^([a-z0-9-]+)\.md(?:#([\w-]+))?$/i);
  if (doc) {
    return { href: '#/doc/' + doc[1] + (doc[2] ? '/' + doc[2] : ''), external: false };
  }
  if (/^https?:\/\//i.test(href)) {
    return { href: href, external: true };
  }
  if (href.charAt(0) === '#') {
    return { href: href, external: false };
  }
  // a path in the repo, relative to docs/knowledge
  const repoPath = path.posix.normalize(path.posix.join('docs/knowledge', href));
  return { href: REPO_BLOB + repoPath, external: true };
}

function inlineHtml(pieces, ctx) {
  let out = '';
  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i];
    if (piece.t === 'text') {
      if (ctx.noTerms) {
        out += escapeHtml(piece.v);
        continue;
      }
      const marked = ctx.AX.terms.markTerms(piece.v, ctx.matcher, ctx.used, 6);
      for (let m = 0; m < marked.length; m++) {
        if (marked[m].t === 'term') {
          out += '<button type="button" class="term" data-term="' + escapeHtml(marked[m].key) + '">' + escapeHtml(marked[m].v) + '</button>';
        } else {
          out += escapeHtml(marked[m].v);
        }
      }
    } else if (piece.t === 'code') {
      out += '<code>' + escapeHtml(piece.v) + '</code>';
    } else if (piece.t === 'strong') {
      out += '<strong>' + inlineHtml(piece.kids, ctx) + '</strong>';
    } else if (piece.t === 'em') {
      out += '<em>' + inlineHtml(piece.kids, ctx) + '</em>';
    } else if (piece.t === 'link') {
      const target = linkTarget(piece.href);
      const extra = target.external ? ' target="_blank" rel="noopener noreferrer"' : '';
      const inner = inlineHtml(piece.kids, { AX: ctx.AX, matcher: ctx.matcher, used: ctx.used, noTerms: true });
      out += '<a href="' + escapeHtml(target.href) + '"' + extra + '>' + inner + '</a>';
    }
  }
  return out;
}

// doc: { stem, text, group }. Returns { html, title, outline, intro, sections }.
function docToHtml(AX, doc, matcher, isPrivate) {
  const blocks = AX.md.parseBlocks(doc.text);
  let html = '';
  let title = doc.stem;
  let intro = '';
  const outline = [];
  let used = {};
  let currentSection = '';
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const ctx = { AX: AX, matcher: matcher, used: used };
    if (block.type === 'h') {
      const text = AX.md.plainText(AX.md.parseInline(block.text));
      if (block.level === 1) {
        title = text;
        html += '<p class="doc-eyebrow">' + escapeHtml(doc.group.toUpperCase()) + (isPrivate ? ' · PRIVATE, NOT KNOWN TO REM' : '') + '</p>';
        html += '<h1 id="doc-title" tabindex="-1">' + escapeHtml(text) + '</h1>';
        continue;
      }
      // a new section: each term may be marked once again
      used = {};
      currentSection = text;
      const tag = block.level === 2 ? 'h2' : 'h3';
      html += '<' + tag + ' id="s-' + escapeHtml(block.id) + '" tabindex="-1">' + inlineHtml(AX.md.parseInline(block.text), { AX: AX, matcher: matcher, used: {}, noTerms: true }) + '</' + tag + '>';
      outline.push({ id: block.id, text: text, level: block.level });
      if (block.level === 2 && !isPrivate) {
        const question = 'Explain this part of the Atlas docs: "' + text + '" (from ' + title + ').';
        html += '<div class="section-tools"><button type="button" class="pill" data-ask="' + escapeHtml(question) + '">Ask Rem about this</button></div>';
      }
      continue;
    }
    if (block.type === 'p') {
      if (intro === '' && currentSection === '') {
        intro = AX.md.plainText(AX.md.parseInline(block.text));
      }
      html += '<p>' + inlineHtml(AX.md.parseInline(block.text), ctx) + '</p>';
    } else if (block.type === 'ul' || block.type === 'ol') {
      html += '<' + block.type + '>';
      for (let j = 0; j < block.items.length; j++) {
        html += '<li>' + inlineHtml(AX.md.parseInline(block.items[j]), ctx) + '</li>';
      }
      html += '</' + block.type + '>';
    } else if (block.type === 'code') {
      html += '<pre><code>' + escapeHtml(block.text) + '</code></pre>';
    } else if (block.type === 'quote') {
      html += '<blockquote><p>' + inlineHtml(AX.md.parseInline(block.text), ctx) + '</p></blockquote>';
    } else if (block.type === 'table') {
      html += '<div class="table-wrap"><table class="doc-table"><thead><tr>';
      for (let h = 0; h < block.head.length; h++) {
        html += '<th scope="col">' + inlineHtml(AX.md.parseInline(block.head[h]), { AX: AX, matcher: matcher, used: used, noTerms: true }) + '</th>';
      }
      html += '</tr></thead><tbody>';
      for (let r = 0; r < block.rows.length; r++) {
        html += '<tr>';
        for (let c = 0; c < block.rows[r].length; c++) {
          html += '<td>' + inlineHtml(AX.md.parseInline(block.rows[r][c]), ctx) + '</td>';
        }
        html += '</tr>';
      }
      html += '</tbody></table></div>';
    }
  }
  return { html: html, title: title, outline: outline, intro: intro.slice(0, 300) };
}

module.exports = {
  docToHtml: docToHtml,
  escapeHtml: escapeHtml,
};
