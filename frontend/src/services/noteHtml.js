// Keeps formatted notes clean and safe.
//
// The notes editor is a browser "contentEditable" box. Browsers fill such a box
// with whatever HTML they like (<b> or <strong>, <div> or <p>, inline styles...).
// Everything here rebuilds that HTML from scratch using an allowlist, so only a
// few simple tags are ever saved, and nothing pasted or stored can run code.
//
// Two forms of the same notes exist:
//   stored:  what the server keeps. Colors are classes: <span class="tc-red">,
//            <mark class="hl-yellow">. The server accepts nothing else
//            (backend/src/utils/validate.js keeps the same lists).
//   editing: what sits inside the editor while typing. Colors are written the way
//            the browser's own editing commands understand them (<font color> and a
//            background-color style), using fixed "marker" color values that CSS
//            swaps for the real, theme-aware colors (see .note-editor in components.css).

// The marker values never show on screen; CSS replaces each with its real color.
// "default" and "none" remove the color.
export const TEXT_COLORS = [
  { id: 'default', label: 'Default', marker: '#fe0000' },
  { id: 'red', label: 'Red', marker: '#fe0001' },
  { id: 'orange', label: 'Orange', marker: '#fe0002' },
  { id: 'green', label: 'Green', marker: '#fe0003' },
  { id: 'blue', label: 'Blue', marker: '#fe0004' },
  { id: 'purple', label: 'Purple', marker: '#fe0005' },
];

export const HIGHLIGHTS = [
  { id: 'none', label: 'None', marker: '#fd0000' },
  { id: 'yellow', label: 'Yellow', marker: '#fd0001' },
  { id: 'green', label: 'Green', marker: '#fd0002' },
  { id: 'blue', label: 'Blue', marker: '#fd0003' },
  { id: 'pink', label: 'Pink', marker: '#fd0004' },
  { id: 'orange', label: 'Orange', marker: '#fd0005' },
];

// Elements whose content is never kept (they hold code, media, or form controls).
const SKIPPED_TAGS = [
  'SCRIPT', 'STYLE', 'TEMPLATE', 'IFRAME', 'OBJECT', 'EMBED', 'HEAD', 'TITLE', 'META',
  'LINK', 'SVG', 'MATH', 'IMG', 'VIDEO', 'AUDIO', 'CANVAS', 'TEXTAREA', 'INPUT',
  'SELECT', 'BUTTON', 'NOSCRIPT',
];
const TEXT_BLOCK_TAGS = ['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'PRE'];
const LIST_TAGS = ['UL', 'OL'];

// Which clean tag each kind of text block becomes.
const blockTagFor = (tagName) => {
  if (tagName === 'H1' || tagName === 'H2' || tagName === 'H3') {
    return tagName.toLowerCase();
  }
  if (tagName === 'H4' || tagName === 'H5' || tagName === 'H6') {
    return 'h3';
  }
  return 'p';
};

// "#FE0001" or "rgb(254, 0, 1)" -> "#fe0001". Anything else -> "".
const toHex = (value) => {
  if (!value) {
    return '';
  }
  const text = value.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(text)) {
    return text;
  }
  const match = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(text);
  if (!match) {
    return '';
  }
  return `#${[match[1], match[2], match[3]]
    .map((part) => Number(part).toString(16).padStart(2, '0'))
    .join('')}`;
};

// Finds the color for a marker value. Returns its id, '' for default/none,
// or null when the value is not one of ours (it is then ignored).
const idForMarker = (list, value) => {
  const hex = toHex(value);
  const found = list.find((item) => item.marker === hex);
  if (!found) {
    return null;
  }
  if (found.id === 'default' || found.id === 'none') {
    return '';
  }
  return found.id;
};

const isKnownId = (list, id) => {
  return list.some((item) => item.id === id && item.id !== 'default' && item.id !== 'none');
};

const markerFor = (list, id) => {
  return list.find((item) => item.id === id).marker;
};

// Works out the formatting inside an element from the formatting around it.
// The innermost setting wins, just like on screen.
const formatInside = (element, outer) => {
  const format = {
    bold: outer.bold,
    italic: outer.italic,
    color: outer.color,
    highlight: outer.highlight,
  };
  const tag = element.tagName;

  if (tag === 'B' || tag === 'STRONG') {
    format.bold = true;
  }
  if (tag === 'I' || tag === 'EM') {
    format.italic = true;
  }
  if (tag === 'FONT') {
    const fontColor = idForMarker(TEXT_COLORS, element.getAttribute('color'));
    if (fontColor !== null) {
      format.color = fontColor;
    }
  }

  // Stored notes use classes.
  element.classList.forEach((className) => {
    if (className.startsWith('tc-') && isKnownId(TEXT_COLORS, className.slice(3))) {
      format.color = className.slice(3);
    }
    if (className.startsWith('hl-') && isKnownId(HIGHLIGHTS, className.slice(3))) {
      format.highlight = className.slice(3);
    }
  });

  // Browsers sometimes write formatting as inline styles instead.
  const style = element.style;
  if (style) {
    if (style.fontWeight === 'bold' || Number(style.fontWeight) >= 600) {
      format.bold = true;
    } else if (style.fontWeight === 'normal' || style.fontWeight === '400') {
      format.bold = false;
    }
    if (style.fontStyle === 'italic') {
      format.italic = true;
    } else if (style.fontStyle === 'normal') {
      format.italic = false;
    }
    const styleColor = idForMarker(TEXT_COLORS, style.color);
    if (styleColor !== null) {
      format.color = styleColor;
    }
    const styleHighlight = idForMarker(HIGHLIGHTS, style.backgroundColor);
    if (styleHighlight !== null) {
      format.highlight = styleHighlight;
    }
  }
  return format;
};

const PLAIN_FORMAT = { bold: false, italic: false, color: '', highlight: '' };

const sameFormat = (a, b) => {
  return a.bold === b.bold && a.italic === b.italic && a.color === b.color && a.highlight === b.highlight;
};

// While the editor is tidied up (see tidyEditor), two empty marker elements stand
// in for the start and end of the selection, so the cursor can be put back after.
const CARET_ATTRIBUTE = 'data-caret';

const isCaretMarker = (node) => {
  return node.nodeType === 1 && node.hasAttribute(CARET_ATTRIBUTE);
};

// Collects the text inside a block as "runs": pieces of text (or line breaks)
// that each know their formatting.
const collectRuns = (node, format, runs) => {
  node.childNodes.forEach((child) => {
    if (child.nodeType === 3) {
      if (child.nodeValue !== '') {
        runs.push({ text: child.nodeValue, format: format });
      }
      return;
    }
    if (child.nodeType !== 1 || SKIPPED_TAGS.indexOf(child.tagName) !== -1) {
      return;
    }
    if (isCaretMarker(child)) {
      runs.push({ caret: child.getAttribute(CARET_ATTRIBUTE), format: format });
      return;
    }
    if (child.tagName === 'BR') {
      runs.push({ isBreak: true, format: format });
      return;
    }
    // A block inside a block (rare, but browsers do it): keep its text on a new line.
    const isNestedBlock =
      TEXT_BLOCK_TAGS.indexOf(child.tagName) !== -1 ||
      LIST_TAGS.indexOf(child.tagName) !== -1 ||
      child.tagName === 'LI' ||
      child.tagName === 'BLOCKQUOTE';
    if (isNestedBlock && runs.length > 0 && !runs[runs.length - 1].isBreak) {
      runs.push({ isBreak: true, format: format });
    }
    collectRuns(child, formatInside(child, format), runs);
  });
};

// Wraps one piece of text in the tags its formatting needs.
// mode 'stored' uses classes; mode 'editing' uses the browser's own color markup.
const wrapRun = (doc, content, format, mode) => {
  let node = content;
  if (format.italic) {
    const em = doc.createElement('em');
    em.appendChild(node);
    node = em;
  }
  if (format.bold) {
    const strong = doc.createElement('strong');
    strong.appendChild(node);
    node = strong;
  }
  if (format.color !== '') {
    let colorElement;
    if (mode === 'stored') {
      colorElement = doc.createElement('span');
      colorElement.className = `tc-${format.color}`;
    } else {
      colorElement = doc.createElement('font');
      colorElement.setAttribute('color', markerFor(TEXT_COLORS, format.color));
    }
    colorElement.appendChild(node);
    node = colorElement;
  }
  if (format.highlight !== '') {
    let highlightElement;
    if (mode === 'stored') {
      highlightElement = doc.createElement('mark');
      highlightElement.className = `hl-${format.highlight}`;
    } else {
      highlightElement = doc.createElement('span');
      highlightElement.style.backgroundColor = markerFor(HIGHLIGHTS, format.highlight);
    }
    highlightElement.appendChild(node);
    node = highlightElement;
  }
  return node;
};

// Writes runs into a block. Neighbouring runs with the same formatting share one
// set of tags, so "<strong>a</strong><strong>b</strong>" becomes "<strong>ab</strong>".
const writeRuns = (doc, block, runs, mode) => {
  let index = 0;
  while (index < runs.length) {
    const format = runs[index].format;
    const group = doc.createDocumentFragment();
    while (index < runs.length && sameFormat(runs[index].format, format)) {
      if (runs[index].isBreak) {
        group.appendChild(doc.createElement('br'));
      } else if (runs[index].caret) {
        // Selection markers only survive while editing; stored notes never get them.
        if (mode === 'editing') {
          const marker = doc.createElement('span');
          marker.setAttribute(CARET_ATTRIBUTE, runs[index].caret);
          group.appendChild(marker);
        }
      } else {
        group.appendChild(doc.createTextNode(runs[index].text));
      }
      index += 1;
    }
    if (format.bold || format.italic || format.color !== '' || format.highlight !== '') {
      block.appendChild(wrapRun(doc, group, format, mode));
    } else {
      block.appendChild(group);
    }
  }
  // An empty line still needs something inside, or it collapses to nothing.
  // (A selection marker takes up no room, so it does not count.)
  const hasContent = Array.prototype.some.call(block.childNodes, (node) => !isCaretMarker(node));
  if (!hasContent) {
    block.appendChild(doc.createElement('br'));
  }
};

const hasBlockChild = (element) => {
  return Array.prototype.some.call(element.children, (child) => {
    return (
      TEXT_BLOCK_TAGS.indexOf(child.tagName) !== -1 ||
      LIST_TAGS.indexOf(child.tagName) !== -1 ||
      child.tagName === 'BLOCKQUOTE' ||
      child.tagName === 'LI'
    );
  });
};

// Fills a list item: its own text, then any lists nested inside it.
const buildItem = (doc, source, mode) => {
  const item = doc.createElement('li');
  let runs = [];
  const flushRuns = () => {
    if (runs.length > 0) {
      writeRuns(doc, item, runs, mode);
      runs = [];
    }
  };
  source.childNodes.forEach((child) => {
    if (child.nodeType === 1 && LIST_TAGS.indexOf(child.tagName) !== -1) {
      flushRuns();
      if (item.childNodes.length === 0) {
        item.appendChild(doc.createElement('br'));
      }
      item.appendChild(buildList(doc, child, mode));
      return;
    }
    const holder = doc.createElement('div');
    holder.appendChild(child.cloneNode(true));
    collectRuns(holder, formatInside(source, PLAIN_FORMAT), runs);
  });
  flushRuns();
  if (item.childNodes.length === 0) {
    item.appendChild(doc.createElement('br'));
  }
  return item;
};

// A bulleted list. Numbered lists become bulleted, and loose text becomes an item.
// (buildItem above calls this too; that works because it only runs after both exist.)
const buildList = (doc, source, mode) => {
  const list = doc.createElement('ul');
  source.childNodes.forEach((child) => {
    if (child.nodeType === 1 && child.tagName === 'LI') {
      list.appendChild(buildItem(doc, child, mode));
    } else if (child.nodeType === 1 && LIST_TAGS.indexOf(child.tagName) !== -1) {
      // Some browsers indent a bullet by putting a list straight inside a list.
      // It belongs inside the bullet before it.
      let previous = list.lastElementChild;
      if (!previous) {
        previous = doc.createElement('li');
        previous.appendChild(doc.createElement('br'));
        list.appendChild(previous);
      }
      previous.appendChild(buildList(doc, child, mode));
    } else if (child.nodeType === 3 && child.nodeValue.trim() === '') {
      // Spaces between items mean nothing.
    } else if (isCaretMarker(child)) {
      // A selection marker between items: keep it at the end of the item before.
      if (list.lastElementChild) {
        list.lastElementChild.appendChild(child.cloneNode(true));
      }
    } else {
      const holder = doc.createElement('li');
      holder.appendChild(child.cloneNode(true));
      list.appendChild(buildItem(doc, holder, mode));
    }
  });
  return list;
};

let buildFlow = null;

// Splits a text block that has lists or other blocks inside it: the loose text
// keeps the block's own kind (paragraph or heading), the inner blocks are built
// as usual, all in their original order.
const buildMixedBlock = (doc, source, target, mode) => {
  const outerFormat = formatInside(source, PLAIN_FORMAT);
  let runs = [];
  const flushRuns = () => {
    if (runs.length > 0) {
      const block = doc.createElement(blockTagFor(source.tagName));
      writeRuns(doc, block, runs, mode);
      target.appendChild(block);
      runs = [];
    }
  };
  source.childNodes.forEach((child) => {
    const isBlock =
      child.nodeType === 1 &&
      (TEXT_BLOCK_TAGS.indexOf(child.tagName) !== -1 ||
        LIST_TAGS.indexOf(child.tagName) !== -1 ||
        child.tagName === 'BLOCKQUOTE' ||
        child.tagName === 'LI');
    if (isBlock) {
      flushRuns();
      const holder = doc.createElement('div');
      holder.appendChild(child.cloneNode(true));
      buildFlow(doc, holder, target, mode);
    } else if (!(child.nodeType === 3 && child.nodeValue.trim() === '' && runs.length === 0)) {
      const holder = doc.createElement('div');
      holder.appendChild(child.cloneNode(true));
      collectRuns(holder, outerFormat, runs);
    }
  });
  flushRuns();
};

// Rebuilds a run of blocks (the whole notes, or the inside of an indent).
// (buildMixedBlock above calls this too; that works because it only runs after both exist.)
buildFlow = (doc, source, target, mode) => {
  let runs = [];
  const flushRuns = () => {
    if (runs.length > 0) {
      const paragraph = doc.createElement('p');
      writeRuns(doc, paragraph, runs, mode);
      target.appendChild(paragraph);
      runs = [];
    }
  };

  source.childNodes.forEach((child) => {
    if (child.nodeType === 1 && SKIPPED_TAGS.indexOf(child.tagName) !== -1) {
      return;
    }
    if (child.nodeType !== 1) {
      if (child.nodeType === 3 && child.nodeValue.trim() === '' && runs.length === 0) {
        return;
      }
      const holder = doc.createElement('div');
      holder.appendChild(child.cloneNode(true));
      collectRuns(holder, PLAIN_FORMAT, runs);
      return;
    }

    const tag = child.tagName;
    if (TEXT_BLOCK_TAGS.indexOf(tag) !== -1) {
      flushRuns();
      // A paragraph holding a list (browsers make these when a list is started
      // mid-paragraph): its text becomes paragraphs of its own around the list.
      if (hasBlockChild(child)) {
        buildMixedBlock(doc, child, target, mode);
        return;
      }
      const block = doc.createElement(blockTagFor(tag));
      const blockRuns = [];
      collectRuns(child, formatInside(child, PLAIN_FORMAT), blockRuns);
      writeRuns(doc, block, blockRuns, mode);
      target.appendChild(block);
    } else if (LIST_TAGS.indexOf(tag) !== -1) {
      flushRuns();
      target.appendChild(buildList(doc, child, mode));
    } else if (tag === 'LI') {
      flushRuns();
      const list = doc.createElement('ul');
      list.appendChild(buildItem(doc, child, mode));
      target.appendChild(list);
    } else if (tag === 'BLOCKQUOTE') {
      flushRuns();
      const indent = doc.createElement('blockquote');
      buildFlow(doc, child, indent, mode);
      if (indent.childNodes.length > 0) {
        target.appendChild(indent);
      }
    } else {
      // Inline formatting (bold, colors...) sitting directly in the notes.
      const holder = doc.createElement('div');
      holder.appendChild(child.cloneNode(true));
      collectRuns(holder, PLAIN_FORMAT, runs);
    }
  });
  flushRuns();
};

// Turns old plain-text notes into paragraphs, one per line.
const plainTextToBody = (text) => {
  const doc = document.implementation.createHTMLDocument('');
  text.split('\n').forEach((line) => {
    const paragraph = doc.createElement('p');
    paragraph.textContent = line;
    doc.body.appendChild(paragraph);
  });
  return doc.body;
};

// Parses stored notes without running anything in them: a DOMParser document is
// inert, so scripts never run and images never load.
const parseStored = (html, format) => {
  if (format === 'text') {
    return plainTextToBody(html);
  }
  return new DOMParser().parseFromString(html, 'text/html').body;
};

// Puts stored notes into the editor. format is 'html' or 'text' (old notes).
export const fillEditor = (editor, storedNotes, format) => {
  const source = parseStored(storedNotes || '', format);
  const fragment = document.createDocumentFragment();
  buildFlow(document, source, fragment, 'editing');
  if (fragment.childNodes.length === 0) {
    const paragraph = document.createElement('p');
    paragraph.appendChild(document.createElement('br'));
    fragment.appendChild(paragraph);
  }
  editor.replaceChildren(fragment);
};

// Moves a collapsed range out of the gaps between blocks (directly inside the
// editor, a list, or an indent) and into the nearest block, where a marker can sit.
const moveIntoBlock = (editor, range) => {
  let container = range.startContainer;
  let offset = range.startOffset;
  while (
    container.nodeType === 1 &&
    (container === editor || LIST_TAGS.indexOf(container.tagName) !== -1 || container.tagName === 'BLOCKQUOTE')
  ) {
    const children = container.childNodes;
    if (children.length === 0) {
      return;
    }
    if (offset < children.length) {
      container = children[offset];
      offset = 0;
    } else {
      container = children[children.length - 1];
      if (container.nodeType === 3) {
        offset = container.nodeValue.length;
      } else {
        offset = container.childNodes.length;
      }
    }
  }
  range.setStart(container, offset);
  range.collapse(true);
};

// Tidies the editor in place after a formatting command: browsers sometimes
// leave odd structures (a list inside a paragraph, a list straight inside a list)
// that screen readers and later commands handle badly. The selection is kept by
// dropping marker elements at its ends, rebuilding, then putting it back.
export const tidyEditor = (editor) => {
  const selection = window.getSelection();
  const hasSelection =
    selection && selection.rangeCount > 0 && editor.contains(selection.getRangeAt(0).startContainer);

  if (hasSelection) {
    const range = selection.getRangeAt(0);
    const endRange = range.cloneRange();
    endRange.collapse(false);
    const startRange = range.cloneRange();
    startRange.collapse(true);
    // The end goes in first: putting the start in first could split the text the end points into.
    const endMarker = document.createElement('span');
    endMarker.setAttribute(CARET_ATTRIBUTE, 'end');
    moveIntoBlock(editor, endRange);
    endRange.insertNode(endMarker);
    const startMarker = document.createElement('span');
    startMarker.setAttribute(CARET_ATTRIBUTE, 'start');
    moveIntoBlock(editor, startRange);
    startRange.insertNode(startMarker);
  }

  const fragment = document.createDocumentFragment();
  buildFlow(document, editor, fragment, 'editing');
  if (fragment.childNodes.length === 0) {
    const paragraph = document.createElement('p');
    paragraph.appendChild(document.createElement('br'));
    fragment.appendChild(paragraph);
  }
  editor.replaceChildren(fragment);

  if (hasSelection) {
    const start = editor.querySelector(`[${CARET_ATTRIBUTE}="start"]`);
    const end = editor.querySelector(`[${CARET_ATTRIBUTE}="end"]`);
    const restored = document.createRange();
    restored.selectNodeContents(editor);
    restored.collapse(false);
    if (start) {
      restored.setStartBefore(start);
      restored.collapse(true);
    }
    if (end) {
      restored.setEndBefore(end);
    }
    // Ranges follow the document as it changes, so removing the markers and
    // joining the split text back together keeps the selection in place.
    if (start) {
      start.remove();
    }
    if (end) {
      end.remove();
    }
    editor.normalize();
    selection.removeAllRanges();
    selection.addRange(restored);
  }
};

// Reads the editor and returns the clean, stored form ('' when there is no text).
export const readEditor = (editor) => {
  const container = document.createElement('div');
  buildFlow(document, editor, container, 'stored');
  if (container.textContent.trim() === '') {
    return '';
  }
  return container.innerHTML;
};

// The text a person sees, counted the same way the server counts it.
export const visibleText = (html) => {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
};

// Plain-text version for "Download notes": # for headings, - for bullets,
// two spaces per indent, **bold** and *italic*. Readable in any text editor.
const inlineText = (node) => {
  let text = '';
  node.childNodes.forEach((child) => {
    if (child.nodeType === 3) {
      text += child.nodeValue;
    } else if (child.nodeType === 1 && child.tagName === 'BR') {
      text += '\n';
    } else if (child.nodeType === 1 && LIST_TAGS.indexOf(child.tagName) === -1) {
      let inner = inlineText(child);
      if (child.tagName === 'STRONG' && inner.trim() !== '') {
        inner = `**${inner}**`;
      } else if (child.tagName === 'EM' && inner.trim() !== '') {
        inner = `*${inner}*`;
      }
      text += inner;
    }
  });
  return text;
};

const plainLines = (node, indent, lines) => {
  node.childNodes.forEach((child) => {
    if (child.nodeType !== 1) {
      return;
    }
    const pad = '  '.repeat(indent);
    const tag = child.tagName;
    if (tag === 'H1' || tag === 'H2' || tag === 'H3') {
      const hashes = '#'.repeat(Number(tag.charAt(1)));
      lines.push(`${pad}${hashes} ${inlineText(child).trim()}`);
    } else if (tag === 'P') {
      inlineText(child)
        .replace(/\n$/, '')
        .split('\n')
        .forEach((line) => lines.push(`${pad}${line}`));
    } else if (tag === 'UL') {
      Array.prototype.forEach.call(child.children, (item) => {
        if (item.tagName === 'LI') {
          lines.push(`${pad}- ${inlineText(item).replace(/\n$/, '').replace(/\n/g, ' ')}`);
          plainLines(item, indent + 1, lines);
        }
      });
    } else if (tag === 'BLOCKQUOTE') {
      plainLines(child, indent + 1, lines);
    }
  });
};

export const toPlainText = (storedNotes) => {
  const body = parseStored(storedNotes || '', 'html');
  const lines = [];
  plainLines(body, 0, lines);
  return lines.join('\n');
};
