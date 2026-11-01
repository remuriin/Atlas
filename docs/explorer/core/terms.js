// Finds glossary terms in a piece of text, so they can get a hover explanation.
// The longest name wins ("Firebase ID token" before "Firebase"), only whole words
// count, and each term is marked once per section so a page doesn't turn into a
// field of underlines.
(function () {
  function escapeRegex(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // terms: [{ key, term, aliases: [...] }]; skip: names never marked on their own.
  function buildMatcher(terms, skip) {
    var names = [];
    var lookup = {};
    var skipped = {};
    for (var s = 0; s < (skip || []).length; s++) {
      skipped[skip[s].toLowerCase()] = true;
    }
    for (var i = 0; i < terms.length; i++) {
      var all = [terms[i].term].concat(terms[i].aliases || []);
      for (var j = 0; j < all.length; j++) {
        var name = all[j].trim();
        var lower = name.toLowerCase();
        if (name.length < 2 || skipped[lower] || lookup[lower]) {
          continue;
        }
        lookup[lower] = terms[i].key;
        names.push(name);
      }
    }
    names.sort(function (a, b) {
      return b.length - a.length;
    });
    if (names.length === 0) {
      return null;
    }
    var parts = [];
    for (var n = 0; n < names.length; n++) {
      parts.push(escapeRegex(names[n]));
    }
    // whole words only: no letter, digit, hyphen or underscore right before or after
    var regex = new RegExp('(?<![\\p{L}\\p{N}_-])(' + parts.join('|') + ')(?![\\p{L}\\p{N}_-])', 'giu');
    return { regex: regex, lookup: lookup };
  }

  // Splits text into plain parts and term parts. used: the term keys already marked
  // in this section (shared across calls), limit: the most marks per section.
  function markTerms(text, matcher, used, limit) {
    var out = [];
    if (!matcher) {
      return [{ t: 'text', v: text }];
    }
    var regex = new RegExp(matcher.regex.source, matcher.regex.flags);
    var last = 0;
    var count = Object.keys(used).length;
    var match = regex.exec(text);
    while (match) {
      var key = matcher.lookup[match[1].toLowerCase()];
      if (key && !used[key] && count < limit) {
        if (match.index > last) {
          out.push({ t: 'text', v: text.slice(last, match.index) });
        }
        out.push({ t: 'term', v: match[1], key: key });
        used[key] = true;
        count += 1;
        last = match.index + match[1].length;
      }
      match = regex.exec(text);
    }
    if (last < text.length) {
      out.push({ t: 'text', v: text.slice(last) });
    }
    return out;
  }

  AX.terms = {
    buildMatcher: buildMatcher,
    markTerms: markTerms,
  };
})();
