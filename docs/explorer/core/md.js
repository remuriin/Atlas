// A small Markdown reader for the subset the Atlas docs use: # to ### headings,
// paragraphs, - and 1. lists, pipe tables, ``` code blocks, > quotes, and inside
// text `code`, **bold**, *italic* and [links](url). It returns plain data (blocks and
// inline pieces); the build turns that into HTML and the chat turns it into DOM.
(function () {
  // GitHub's heading anchors: lowercase, everything but letters, digits, spaces,
  // hyphens and underscores removed, spaces to hyphens.
  function slug(text) {
    return String(text).toLowerCase()
      .replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, '')
      .trim()
      .replace(/ /g, '-');
  }

  function isTableLine(line) {
    return /^\s*\|.*\|\s*$/.test(line);
  }

  function splitRow(line) {
    var inner = line.trim().replace(/^\|/, '').replace(/\|$/, '');
    var cells = inner.split('|');
    var out = [];
    for (var i = 0; i < cells.length; i++) {
      out.push(cells[i].trim());
    }
    return out;
  }

  // Splits Markdown text into blocks.
  function parseBlocks(text) {
    var lines = String(text).split('\r\n').join('\n').split('\n');
    var blocks = [];
    var i = 0;
    var used = {};
    while (i < lines.length) {
      var line = lines[i];
      if (/^\s*$/.test(line)) {
        i++;
        continue;
      }
      var fence = line.match(/^```\s*([\w-]*)\s*$/);
      if (fence) {
        var code = [];
        i++;
        while (i < lines.length && !/^```\s*$/.test(lines[i])) {
          code.push(lines[i]);
          i++;
        }
        i++;
        blocks.push({ type: 'code', lang: fence[1] || '', text: code.join('\n') });
        continue;
      }
      var heading = line.match(/^(#{1,6})\s+(.*)$/);
      if (heading) {
        var base = slug(heading[2]);
        var id = base;
        // repeated headings get -1, -2 like GitHub
        if (used[base] !== undefined) {
          used[base] += 1;
          id = base + '-' + used[base];
        } else {
          used[base] = 0;
        }
        blocks.push({ type: 'h', level: heading[1].length, text: heading[2].trim(), id: id });
        i++;
        continue;
      }
      if (isTableLine(line) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
        var head = splitRow(line);
        var rows = [];
        i += 2;
        while (i < lines.length && isTableLine(lines[i])) {
          rows.push(splitRow(lines[i]));
          i++;
        }
        blocks.push({ type: 'table', head: head, rows: rows });
        continue;
      }
      if (/^\s*[-*]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
        var ordered = /^\s*\d+\.\s+/.test(line);
        var items = [];
        while (i < lines.length && (/^\s*[-*]\s+/.test(lines[i]) || /^\s*\d+\.\s+/.test(lines[i]) || (/^\s{2,}\S/.test(lines[i]) && items.length > 0))) {
          if (/^\s{2,}\S/.test(lines[i]) && !/^\s*[-*]\s+/.test(lines[i]) && !/^\s*\d+\.\s+/.test(lines[i])) {
            // a continuation line belongs to the item above
            items[items.length - 1] += ' ' + lines[i].trim();
          } else {
            items.push(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, ''));
          }
          i++;
        }
        blocks.push({ type: ordered ? 'ol' : 'ul', items: items });
        continue;
      }
      if (/^>\s?/.test(line)) {
        var quote = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) {
          quote.push(lines[i].replace(/^>\s?/, ''));
          i++;
        }
        blocks.push({ type: 'quote', text: quote.join(' ') });
        continue;
      }
      var para = [line.trim()];
      i++;
      while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^(#{1,6})\s/.test(lines[i]) &&
        !/^```/.test(lines[i]) && !/^\s*[-*]\s+/.test(lines[i]) && !/^\s*\d+\.\s+/.test(lines[i]) &&
        !isTableLine(lines[i]) && !/^>\s?/.test(lines[i])) {
        para.push(lines[i].trim());
        i++;
      }
      blocks.push({ type: 'p', text: para.join(' ') });
    }
    return blocks;
  }

  // Splits a line of text into inline pieces.
  function parseInline(text) {
    var out = [];
    var rest = String(text);
    var pattern = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\s][^*]*\*)|(\[[^\]]+\]\([^)\s]+\))/;
    while (rest.length > 0) {
      var match = rest.match(pattern);
      if (!match) {
        out.push({ t: 'text', v: rest });
        break;
      }
      if (match.index > 0) {
        out.push({ t: 'text', v: rest.slice(0, match.index) });
      }
      var token = match[0];
      if (match[1]) {
        out.push({ t: 'code', v: token.slice(1, -1) });
      } else if (match[2]) {
        out.push({ t: 'strong', kids: parseInline(token.slice(2, -2)) });
      } else if (match[3]) {
        out.push({ t: 'em', kids: parseInline(token.slice(1, -1)) });
      } else {
        var close = token.indexOf('](');
        out.push({ t: 'link', href: token.slice(close + 2, -1), kids: parseInline(token.slice(1, close)) });
      }
      rest = rest.slice(match.index + token.length);
    }
    return out;
  }

  // The plain text of inline pieces (for search and for heading paths).
  function plainText(pieces) {
    var out = '';
    for (var i = 0; i < pieces.length; i++) {
      var piece = pieces[i];
      if (piece.t === 'text' || piece.t === 'code') {
        out += piece.v;
      } else {
        out += plainText(piece.kids);
      }
    }
    return out;
  }

  AX.md = {
    slug: slug,
    parseBlocks: parseBlocks,
    parseInline: parseInline,
    plainText: plainText,
  };
})();
