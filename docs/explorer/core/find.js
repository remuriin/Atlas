// Search across everything in the explorer: diagrams, parts, glossary terms and doc
// sections. It ranks like Atlas's own search: a title that starts with what you
// typed comes first, then words found in titles, then words found anywhere.
(function () {
  function words(text) {
    var list = String(text).toLowerCase().split(/\s+/);
    var out = [];
    for (var i = 0; i < list.length; i++) {
      if (list[i] !== '') {
        out.push(list[i]);
      }
    }
    return out.slice(0, 8);
  }

  // A word counts when some word in the text starts with it.
  function hasWordStart(text, word) {
    var lower = String(text).toLowerCase();
    var at = lower.indexOf(word);
    while (at !== -1) {
      if (at === 0 || !/[\p{L}\p{N}]/u.test(lower.charAt(at - 1))) {
        return true;
      }
      at = lower.indexOf(word, at + 1);
    }
    return false;
  }

  // entries: [{ title, code, kind, text, href }]
  function search(entries, query) {
    var wanted = words(query);
    if (wanted.length === 0) {
      return [];
    }
    var whole = String(query).trim().toLowerCase();
    var results = [];
    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i];
      var all = entry.title + ' ' + (entry.code || '') + ' ' + (entry.kind || '') + ' ' + (entry.text || '');
      var score = 0;
      var missing = false;
      for (var w = 0; w < wanted.length; w++) {
        var word = wanted[w];
        if (hasWordStart(entry.title, word) || hasWordStart(entry.code || '', word)) {
          score += 3;
        } else if (hasWordStart(entry.kind || '', word)) {
          score += 2;
        } else if (hasWordStart(all, word)) {
          score += 1;
        } else {
          missing = true;
          break;
        }
      }
      if (missing) {
        continue;
      }
      if (entry.title.toLowerCase().indexOf(whole) === 0 || String(entry.code || '').toLowerCase().indexOf(whole) === 0) {
        score += 100;
      }
      results.push({ entry: entry, score: score });
    }
    results.sort(function (a, b) {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.entry.title.length - b.entry.title.length;
    });
    return results.slice(0, 50);
  }

  AX.find = {
    search: search,
    words: words,
  };
})();
