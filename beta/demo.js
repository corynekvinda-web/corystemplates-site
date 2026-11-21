/* Beta demo wrapper. Same rules as the public demo: no analytics. Export, save, and print are blocked. */
(function () {
  var STORE_URL = 'https://apps.microsoft.com/detail/9PJZWFSBTDR9';
  var SUPPORT_EMAIL = 'corystemplatecreations@gmail.com';
  /* One-Week Journal is the catalog starter Cory chose to unlock in the demo. */
  window.CT_DEMO = {
    enabled: true,
    storeUrl: STORE_URL,
    supportEmail: SUPPORT_EMAIL,
    unlockedStarterId: 'one-week-journal-v3'
  };

  function $(id) { return document.getElementById(id); }

  var EXPORT_NOTE_TITLE = 'Exporting is available in the full app';
  var EXPORT_NOTE_BODY = 'This is a demo so you can try the planner builder. Saving, PDF export, and printing are turned off here. The full app is a one-time purchase on the Microsoft Store.';
  var TEMPLATE_NOTE_TITLE = 'This template comes with BLOC Planner';
  var TEMPLATE_NOTE_BODY = 'You can look at the preview here. Opening the template is available in the full app.';

  function showStoreNote(title, body, toast) {
    var heading = $('ctDemoBlockedTitle');
    var para = $('ctDemoBlockedBody');
    if (heading) heading.textContent = title;
    if (para) para.textContent = body;
    var m = $('ctDemoBlocked');
    if (m) m.classList.add('is-open');
    if (toast && typeof showToast === 'function') showToast(toast);
    return false;
  }
  function showExportBlocked() {
    return showStoreNote(EXPORT_NOTE_TITLE, EXPORT_NOTE_BODY, EXPORT_NOTE_TITLE);
  }
  function showTemplateLocked() {
    return showStoreNote(TEMPLATE_NOTE_TITLE, TEMPLATE_NOTE_BODY, TEMPLATE_NOTE_TITLE);
  }
  function isStarterUnlocked(id) {
    return !!(id && window.CT_DEMO.unlockedStarterId && id === window.CT_DEMO.unlockedStarterId);
  }
  window.ctDemoBlockExport = showExportBlocked;
  window.ctDemoBlockTemplate = showTemplateLocked;

  function buildMailto(doing, suggestion, email) {
    var subject = "Suggestion for BLOC Planner";
    var lines = [
      'What I was doing:',
      doing || '(not provided)',
      '',
      'Suggestion:',
      suggestion || '(not provided)'
    ];
    if (email) {
      lines.push('', 'Email:', email);
    }
    lines.push('', '— Sent from the BLOC Planner public demo');
    return 'mailto:' + SUPPORT_EMAIL +
      '?subject=' + encodeURIComponent(subject) +
      '&body=' + encodeURIComponent(lines.join('\n'));
  }
  window.ctDemoBuildMailto = buildMailto;

  function closeModals() {
    ['ctDemoBlocked', 'ctDemoFeedback'].forEach(function (id) {
      var el = $(id);
      if (el) el.classList.remove('is-open');
    });
  }

  function guardFn(name) {
    var orig = window[name];
    if (typeof orig !== 'function') return;
    window[name] = function () {
      showExportBlocked();
      return false;
    };
  }

  function disableControl(el, label) {
    if (!el) return;
    el.classList.add('ct-demo-blocked');
    if (el.tagName === 'A') {
      el.removeAttribute('download');
      el.setAttribute('href', '#');
    }
    if (el.tagName === 'BUTTON' || el.tagName === 'A') {
      el.setAttribute('title', 'Exporting is available in the full app');
    }
    // Wrap the control so the note sits under icon buttons in the header.
    if (el.id === 'exportPdfBtn' || el.id === 'saveJsonBtn') {
      var wrap = document.createElement('div');
      wrap.className = 'ct-demo-export-note';
      el.parentNode.insertBefore(wrap, el);
      wrap.appendChild(el);
      var note = document.createElement('div');
      note.className = 'ct-demo-note-text';
      note.textContent = label || 'Exporting is available in the full app';
      wrap.appendChild(note);
    }
    el.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      showExportBlocked();
    }, true);
  }

  function mountChrome() {
    var banner = document.createElement('div');
    banner.id = 'ctDemoBanner';
    banner.innerHTML =
      '<div class="ct-demo-banner-text"><strong>Beta demo:</strong> try the new features coming in the next BLOC Planner update. Exporting is turned off in the demo. ' +
      'Made by a one-person shop.</div>' +
      '<button type="button" id="ctDemoSuggestBtn">Suggest an improvement</button>';
    document.body.insertBefore(banner, document.body.firstChild);

    var blocked = document.createElement('div');
    blocked.id = 'ctDemoBlocked';
    blocked.innerHTML =
      '<div class="ct-demo-card" role="dialog" aria-labelledby="ctDemoBlockedTitle">' +
        '<h2 id="ctDemoBlockedTitle">Exporting is available in the full app</h2>' +
        '<p id="ctDemoBlockedBody">This is a demo so you can try the planner builder. Saving, PDF export, and printing are turned off here. The full app is a one-time purchase on the Microsoft Store.</p>' +
        '<div class="ct-demo-actions">' +
          '<a class="ct-demo-store-btn ct-demo-primary" id="ctDemoStoreLink" target="_blank" rel="noopener noreferrer">Get BLOC Planner on the Microsoft Store</a>' +
          '<button type="button" class="ct-demo-secondary" data-ct-demo-close>Close</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(blocked);
    $('ctDemoStoreLink').href = STORE_URL;

    var feedback = document.createElement('div');
    feedback.id = 'ctDemoFeedback';
    feedback.innerHTML =
      '<form class="ct-demo-card" id="ctDemoFeedbackForm" role="dialog" aria-labelledby="ctDemoFeedbackTitle">' +
        '<h2 id="ctDemoFeedbackTitle">Suggest an improvement</h2>' +
        '<p>This opens an email to Cory. Nothing is stored on this site.</p>' +
        '<label for="ctDemoDoing">What you were doing</label>' +
        '<textarea id="ctDemoDoing" name="doing" required placeholder="e.g. Adding a table on a weekly page"></textarea>' +
        '<label for="ctDemoSuggestion">Your suggestion</label>' +
        '<textarea id="ctDemoSuggestion" name="suggestion" required placeholder="What would you change or add?"></textarea>' +
        '<label for="ctDemoEmail">Email (optional)</label>' +
        '<input id="ctDemoEmail" name="email" type="email" autocomplete="email" placeholder="If you would like a reply">' +
        '<div class="ct-demo-actions">' +
          '<button type="submit" class="ct-demo-primary">Open email</button>' +
          '<button type="button" class="ct-demo-secondary" data-ct-demo-close>Cancel</button>' +
        '</div>' +
      '</form>';
    document.body.appendChild(feedback);

    $('ctDemoSuggestBtn').addEventListener('click', function () {
      $('ctDemoFeedback').classList.add('is-open');
      var field = $('ctDemoDoing');
      if (field) setTimeout(function () { field.focus(); }, 20);
    });
    $('ctDemoFeedbackForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var href = buildMailto(
        $('ctDemoDoing').value.trim(),
        $('ctDemoSuggestion').value.trim(),
        $('ctDemoEmail').value.trim()
      );
      window.ctDemoLastMailto = href;
      window.location.href = href;
    });
    document.addEventListener('click', function (e) {
      if (e.target && e.target.getAttribute && e.target.getAttribute('data-ct-demo-close') != null) {
        closeModals();
      }
      if (e.target === $('ctDemoBlocked') || e.target === $('ctDemoFeedback')) closeModals();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeModals();
    });
  }

  function installGuards() {
    ['saveProjectToFile', 'saveProjectJson', 'exportHyperlinkedPdf', 'openExportModal',
     'buildHyperlinkedPdfBytes', 'buildNativeFallbackPdfBytes'].forEach(guardFn);

    var printFn = window.print.bind(window);
    window.print = function () { showExportBlocked(); };

    window.addEventListener('beforeprint', function (e) {
      e.preventDefault();
      showExportBlocked();
    });
    window.addEventListener('keydown', function (e) {
      var key = (e.key || '').toLowerCase();
      if ((e.metaKey || e.ctrlKey) && (key === 's' || key === 'p' || key === 'e')) {
        e.preventDefault();
        e.stopPropagation();
        showExportBlocked();
      }
    }, true);

    document.addEventListener('click', function (e) {
      var a = e.target && e.target.closest && e.target.closest('a[download], #exportDirectDownloadLink, #exportOpenTabBtn, #exportCopyJsonBtn');
      if (!a) return;
      e.preventDefault();
      e.stopPropagation();
      showExportBlocked();
    }, true);

    disableControl($('exportPdfBtn'), 'Exporting is available in the full app');
    disableControl($('saveJsonBtn'), 'Saving is available in the full app');
    disableControl($('exportDirectDownloadLink'));
    disableControl($('exportOpenTabBtn'));
    disableControl($('exportCopyJsonBtn'));

    // Desktop/Electron menu commands must not save or export either.
    if (window.coryDesktop && typeof window.coryDesktop.onAppCommand === 'function') {
      window.coryDesktop.onAppCommand = function () {};
    }
  }

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  function decorateStarterCards() {
    var cards = document.querySelectorAll('#startersGrid .starter-card');
    cards.forEach(function (card) {
      var sel = card.querySelector('[data-starter-variant]');
      var group = card.getAttribute('data-starter-group') || '';
      var id = sel ? sel.value : ((typeof starterCatalog === 'function' && starterCatalog().find(function (e) { return e.group === group; })) || {}).id;
      var unlocked = isStarterUnlocked(id);
      card.classList.toggle('ct-demo-starter-locked', !unlocked);
      card.classList.toggle('ct-demo-starter-free', !!unlocked);
      card.style.position = 'relative';
      var lock = card.querySelector('.ct-demo-lock-badge');
      var free = card.querySelector('.ct-demo-free-badge');
      if (unlocked) {
        if (lock) lock.remove();
        if (!free) {
          free = document.createElement('span');
          free.className = 'ct-demo-free-badge';
          free.textContent = 'Free to try';
          card.appendChild(free);
        }
      } else {
        if (free) free.remove();
        if (!lock) {
          lock = document.createElement('span');
          lock.className = 'ct-demo-lock-badge';
          lock.textContent = 'Locked';
          card.appendChild(lock);
        }
      }
    });
  }

  function installStarterLocks() {
    if (typeof window.openStarterTemplate === 'function') {
      var origOpen = window.openStarterTemplate;
      window.openStarterTemplate = function (id, mode) {
        if (!isStarterUnlocked(id)) return showTemplateLocked();
        return origOpen.apply(this, arguments);
      };
    }
    if (typeof window.renderStartersGallery === 'function') {
      var origRender = window.renderStartersGallery;
      window.renderStartersGallery = function () {
        origRender.apply(this, arguments);
        decorateStarterCards();
      };
    }
  }

  ready(function () {
    mountChrome();
    installGuards();
    installStarterLocks();
  });
})();
