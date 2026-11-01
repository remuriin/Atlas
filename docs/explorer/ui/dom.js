// Small helpers for building the page: h() makes an HTML element, mountTree() turns a
// drawn diagram (from core/draw.js) into real SVG elements, links included.
(function () {
  var SVG_NS = 'http://www.w3.org/2000/svg';

  // h('button', { class: 'pill', type: 'button', onclick: fn, text: 'Go' }, [kids])
  function h(tag, attrs, kids) {
    var node = document.createElement(tag);
    setAttrs(node, attrs);
    append(node, kids);
    return node;
  }

  function setAttrs(node, attrs) {
    if (!attrs) {
      return;
    }
    var names = Object.keys(attrs);
    for (var i = 0; i < names.length; i++) {
      var name = names[i];
      var value = attrs[name];
      if (value === null || value === undefined || value === false) {
        continue;
      }
      if (name === 'text') {
        node.textContent = value;
      } else if (name.indexOf('on') === 0) {
        node.addEventListener(name.slice(2), value);
      } else if (value === true) {
        node.setAttribute(name, '');
      } else {
        node.setAttribute(name, String(value));
      }
    }
  }

  function append(node, kids) {
    if (kids === null || kids === undefined) {
      return;
    }
    var list = Array.isArray(kids) ? kids : [kids];
    for (var i = 0; i < list.length; i++) {
      var kid = list[i];
      if (kid === null || kid === undefined || kid === false) {
        continue;
      }
      if (typeof kid === 'string') {
        node.appendChild(document.createTextNode(kid));
      } else {
        node.appendChild(kid);
      }
    }
  }

  function clear(node) {
    while (node.firstChild) {
      node.removeChild(node.firstChild);
    }
  }

  function svg(tag, attrs) {
    var node = document.createElementNS(SVG_NS, tag);
    if (attrs) {
      var names = Object.keys(attrs);
      for (var i = 0; i < names.length; i++) {
        node.setAttribute(names[i], String(attrs[names[i]]));
      }
    }
    return node;
  }

  // linkFor(link) returns { href, label, term } for a drawn element that opens something.
  function mountTree(parent, tree, linkFor) {
    for (var i = 0; i < tree.length; i++) {
      parent.appendChild(build(tree[i], linkFor));
    }
  }

  function build(desc, linkFor) {
    var node = svg(desc.tag, desc.attrs);
    if (desc.text !== null) {
      node.textContent = desc.text;
    }
    for (var i = 0; i < desc.kids.length; i++) {
      node.appendChild(build(desc.kids[i], linkFor));
    }
    if (!desc.link) {
      return node;
    }
    var target = linkFor(desc.link);
    var anchor = svg('a', { href: target.href });
    anchor.setAttribute('aria-label', target.label);
    if (target.term) {
      anchor.setAttribute('data-term', target.term);
    }
    if (desc.link.id) {
      anchor.setAttribute('data-id', desc.link.id);
    }
    if (desc.link.piece) {
      anchor.setAttribute('data-piece', desc.link.piece);
    }
    // the zoom-level attributes move to the link so it hides with its content
    var levels = ['data-lod', 'data-max'];
    for (var l = 0; l < levels.length; l++) {
      var value = node.getAttribute(levels[l]);
      if (value) {
        anchor.setAttribute(levels[l], value);
        node.removeAttribute(levels[l]);
      }
    }
    anchor.appendChild(node);
    return anchor;
  }

  // Announces a short message to screen readers.
  function announce(message) {
    var region = document.getElementById('announce');
    if (!region) {
      return;
    }
    region.textContent = '';
    window.setTimeout(function () {
      region.textContent = message;
    }, 30);
  }

  AX.h = h;
  AX.svg = svg;
  AX.clear = clear;
  AX.mountTree = mountTree;
  AX.announce = announce;
})();
