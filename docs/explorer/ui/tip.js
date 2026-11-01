// Term popovers. Rest the pointer on a dotted term (or tab to it) for about a second
// and a half, and a card explains it twice: in plain words and technically. The card
// can ask Rem about the term, show it in a diagram, or open its glossary entry.
// Enter, Space or a tap opens it at once; Esc closes it.
(function () {
  var DELAY = 1500;
  var HIDE_DELAY = 300;
  var timer = 0;
  var hideTimer = 0;
  var anchor = null;
  var interactive = false;

  function termFor(element) {
    var key = element.getAttribute('data-term');
    return key ? AX.DATA.terms[key] : null;
  }

  function build(term, key) {
    var card = document.getElementById('tip');
    AX.clear(card);
    card.appendChild(AX.h('p', { class: 'tip-term', id: 'tip-title', text: term.term }));
    card.appendChild(AX.h('p', { class: 'tip-label', text: 'In plain words' }));
    var plain = AX.reader.richText(term.plain, false, true);
    plain.className = 'tip-text';
    plain.id = 'tip-plain';
    card.appendChild(plain);
    card.appendChild(AX.h('p', { class: 'tip-label', text: 'Technical' }));
    var tech = AX.reader.richText(term.tech, false, true);
    tech.className = 'tip-text';
    card.appendChild(tech);
    var actions = AX.h('div', { class: 'tip-actions' });
    actions.appendChild(AX.h('button', {
      class: 'button-green', type: 'button', text: 'Ask Rem about this',
      onclick: function () {
        hide();
        AX.chat.ask('What does "' + term.term + '" mean in Atlas, and where is it used?');
      },
    }));
    if (term.view && AX.views[term.view]) {
      actions.appendChild(AX.h('a', {
        class: 'button', href: '#/v/' + term.view + (term.node ? '?n=' + encodeURIComponent(term.node) : ''),
        text: 'Show in diagram', onclick: hideSoon,
      }));
    }
    actions.appendChild(AX.h('a', { class: 'button-plain', href: '#/terms/' + encodeURIComponent(key), text: 'Glossary entry', onclick: hideSoon }));
    card.appendChild(actions);
  }

  function hideSoon() {
    window.setTimeout(hide, 0);
  }

  // Places the card under the term, or above it near the bottom of the screen.
  function place(element) {
    var card = document.getElementById('tip');
    var rect = element.getBoundingClientRect();
    var width = card.offsetWidth;
    var height = card.offsetHeight;
    var left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
    var top = rect.bottom + 8;
    if (top + height > window.innerHeight - 8) {
      top = Math.max(8, rect.top - height - 8);
    }
    card.style.left = Math.round(left) + 'px';
    card.style.top = Math.round(top) + 'px';
  }

  function show(element, asDialog) {
    var term = termFor(element);
    if (!term) {
      return;
    }
    window.clearTimeout(hideTimer);
    if (anchor && anchor !== element) {
      anchor.removeAttribute('aria-describedby');
    }
    anchor = element;
    interactive = asDialog;
    build(term, element.getAttribute('data-term'));
    var card = document.getElementById('tip');
    card.hidden = false;
    card.setAttribute('aria-labelledby', 'tip-title');
    element.setAttribute('aria-describedby', 'tip-plain');
    place(element);
    if (asDialog) {
      var first = card.querySelector('button, a');
      if (first) {
        first.focus();
      }
    }
  }

  function hide() {
    window.clearTimeout(timer);
    window.clearTimeout(hideTimer);
    var card = document.getElementById('tip');
    if (!card || card.hidden) {
      return false;
    }
    card.hidden = true;
    var back = anchor;
    if (anchor) {
      anchor.removeAttribute('aria-describedby');
    }
    anchor = null;
    if (interactive && back && back.focus) {
      back.focus({ preventScroll: true });
    }
    interactive = false;
    return true;
  }

  function termElement(target) {
    if (!target || !target.closest) {
      return null;
    }
    return target.closest('[data-term]');
  }

  function onOver(event) {
    if (event.pointerType === 'touch') {
      return;
    }
    var element = termElement(event.target);
    if (element) {
      window.clearTimeout(hideTimer);
      if (element !== anchor) {
        window.clearTimeout(timer);
        timer = window.setTimeout(function () {
          show(element, false);
        }, DELAY);
      }
      return;
    }
    if (event.target.closest && event.target.closest('#tip')) {
      window.clearTimeout(hideTimer);
    }
  }

  function onOut(event) {
    var element = termElement(event.target);
    var leavingCard = event.target.closest && event.target.closest('#tip');
    if (element || leavingCard) {
      window.clearTimeout(timer);
      if (!interactive) {
        hideTimer = window.setTimeout(hide, HIDE_DELAY);
      }
    }
  }

  function onFocus(event) {
    var element = termElement(event.target);
    if (element && element !== anchor) {
      window.clearTimeout(timer);
      timer = window.setTimeout(function () {
        if (document.activeElement === element || element.contains(document.activeElement)) {
          show(element, false);
        }
      }, DELAY);
    }
  }

  function onBlur(event) {
    var element = termElement(event.target);
    if (element && !interactive) {
      window.clearTimeout(timer);
      hideTimer = window.setTimeout(hide, HIDE_DELAY);
    }
  }

  // Clicking a term in text opens the card right away (diagram boxes keep their own link).
  function onClick(event) {
    var element = termElement(event.target);
    if (element && element.classList.contains('term')) {
      event.preventDefault();
      show(element, true);
    }
  }

  function init() {
    document.addEventListener('pointerover', onOver);
    document.addEventListener('pointerout', onOut);
    document.addEventListener('focusin', onFocus);
    document.addEventListener('focusout', onBlur);
    document.addEventListener('click', onClick);
    window.addEventListener('scroll', function () {
      if (!interactive) {
        hide();
      }
    }, true);
  }

  AX.tip = {
    init: init,
    show: show,
    hide: hide,
  };
})();
