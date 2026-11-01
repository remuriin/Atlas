// Text helpers: how wide a label is (an estimate, so it also works in Node where
// there is no browser to measure with), and how to wrap it into lines.
(function () {
  // Average advance per character as a share of the font size.
  // JetBrains Mono is monospaced at 0.6em; Schibsted Grotesk averages about 0.56em.
  var SANS_EM = 0.56;
  var MONO_EM = 0.6;
  // Bold sans is a little wider.
  var BOLD_EXTRA = 0.03;

  // tracking: extra letter spacing in em (eyebrows and tags use 0.12em).
  function textWidth(text, size, isMono, isBold, tracking) {
    var extra = tracking ? String(text).length * tracking * size : 0;
    return measure(text, size, isMono, isBold) + extra;
  }

  function measure(text, size, isMono, isBold) {
    var em = SANS_EM;
    if (isMono) {
      em = MONO_EM;
    } else if (isBold) {
      em = SANS_EM + BOLD_EXTRA;
    }
    var count = 0;
    var value = String(text);
    for (var i = 0; i < value.length; i++) {
      var code = value.charCodeAt(i);
      // Narrow letters and spaces count as a little less, wide capitals a little more.
      if (!isMono && 'iljtf.,:;!|\' '.indexOf(value.charAt(i)) !== -1) {
        count += 0.55;
      } else if (!isMono && code >= 65 && code <= 90 && 'MW'.indexOf(value.charAt(i)) !== -1) {
        count += 1.45;
      } else if (!isMono && code >= 65 && code <= 90) {
        count += 1.15;
      } else {
        count += 1;
      }
    }
    return count * em * size;
  }

  // Splits text into lines no wider than maxWidth, breaking at spaces.
  // A single word that is too long stays on its own line.
  function wrapText(text, size, maxWidth, isMono, isBold) {
    var words = String(text).split(' ');
    var lines = [];
    var current = '';
    for (var i = 0; i < words.length; i++) {
      var trial = current === '' ? words[i] : current + ' ' + words[i];
      if (current !== '' && textWidth(trial, size, isMono, isBold) > maxWidth) {
        lines.push(current);
        current = words[i];
      } else {
        current = trial;
      }
    }
    if (current !== '') {
      lines.push(current);
    }
    return lines;
  }

  // Rounds to the 4px grid every coordinate in a diagram sits on.
  function snap(value) {
    return Math.round(value / 4) * 4;
  }

  function snapUp(value) {
    return Math.ceil(value / 4) * 4;
  }

  AX.textWidth = textWidth;
  AX.wrapText = wrapText;
  AX.snap = snap;
  AX.snapUp = snapUp;
})();
