/* BLOC Planner public website demo (1.0.2). No analytics.
   In-browser save is on. File download, PDF export, and printing are off. */
(function () {
  var STORE_URL = 'https://apps.microsoft.com/detail/9PJZWFSBTDR9';
  var SUPPORT_EMAIL = 'corystemplatecreations@gmail.com';
  window.CT_BETA = {
    enabled: true,
    storeUrl: STORE_URL,
    supportEmail: SUPPORT_EMAIL,
    unlockedStarterId: 'one-week-journal-v3',
    museDemo: true
  };
  window.CT_DEMO = window.CT_BETA;

  function $(id) { return document.getElementById(id); }

  var EXPORT_NOTE_TITLE = 'Exporting is available in the full app';
  var EXPORT_NOTE_BODY = 'This is a demo of BLOC Planner so you can try the builder. PDF export, file download, and printing are turned off here. Your work still saves in this browser. The full app is a one-time purchase on the Microsoft Store.';
  var TEMPLATE_NOTE_TITLE = 'This template comes with BLOC Planner';
  var TEMPLATE_NOTE_BODY = 'You can look at the preview here. Opening the template is available in the full app.';

  function showStoreNote(title, body, toast) {
    var heading = $('ctBetaBlockedTitle');
    var para = $('ctBetaBlockedBody');
    if (heading) heading.textContent = title;
    if (para) para.textContent = body;
    var m = $('ctBetaBlocked');
    if (m) m.classList.add('is-open');
    if (toast && typeof showToast === 'function') showToast(toast);
    return false;
  }
  function showExportBlocked() {
    return showStoreNote(EXPORT_NOTE_TITLE, EXPORT_NOTE_BODY, EXPORT_NOTE_TITLE);
  }
  function showPrintBlocked() {
    return showStoreNote(
      'Printing is available in the full app',
      'Printing is available in BLOC Planner on the Microsoft Store.',
      'Printing is available in the full app'
    );
  }
  function showTemplateLocked() {
    return showStoreNote(TEMPLATE_NOTE_TITLE, TEMPLATE_NOTE_BODY, TEMPLATE_NOTE_TITLE);
  }
  function isStarterUnlocked(id) {
    return !!(id && window.CT_BETA.unlockedStarterId && id === window.CT_BETA.unlockedStarterId);
  }
  window.ctBetaBlockExport = showExportBlocked;
  window.ctBetaBlockTemplate = showTemplateLocked;
  window.ctDemoBlockExport = showExportBlocked;
  window.ctDemoBlockTemplate = showTemplateLocked;

  function saveInBrowser() {
    if (typeof flushAutosaveNow === 'function') flushAutosaveNow();
    if (typeof shelfSaveCurrent === 'function') {
      try { var p = shelfSaveCurrent(false); if (p && typeof p.catch === 'function') p.catch(function () {}); } catch (e) {}
    }
    if (typeof showToast === 'function') showToast('Saved in this browser');
    return true;
  }
  window.ctDemoSaveInBrowser = saveInBrowser;

  function openSavedProjects() {
    if (typeof openProjectsShelf === 'function') {
      openProjectsShelf();
      return true;
    }
    return false;
  }

  function buildMailto(doing, suggestion, email) {
    var subject = 'Suggestion for BLOC Planner';
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
    lines.push('', '— Sent from the BLOC Planner demo');
    return 'mailto:' + SUPPORT_EMAIL +
      '?subject=' + encodeURIComponent(subject) +
      '&body=' + encodeURIComponent(lines.join('\n'));
  }
  window.ctBetaBuildMailto = buildMailto;

  function closeModals() {
    ['ctBetaBlocked', 'ctBetaFeedback'].forEach(function (id) {
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
    el.classList.add('ct-beta-blocked');
    if (el.tagName === 'A') {
      el.removeAttribute('download');
      el.setAttribute('href', '#');
    }
    if (el.tagName === 'BUTTON' || el.tagName === 'A') {
      el.setAttribute('title', label || 'Exporting is available in the full app');
    }
    el.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      showExportBlocked();
    }, true);
  }

  function mountChrome() {
    var ipadNote = document.createElement('div');
    ipadNote.id = 'ctIpadNote';
    ipadNote.textContent = 'This demo is the iPad version — try it on an iPad. On a computer it looks exactly like the regular website version.';
    document.body.insertBefore(ipadNote, document.body.firstChild);

    var banner = document.createElement('div');
    banner.id = 'ctBetaBanner';
    banner.innerHTML =
      '<div class="ct-beta-banner-text"><strong>Demo:</strong> this is the new BLOC Planner builder (1.0.2). Your work saves in this browser. Exporting, file download, and printing are turned off. Made by a one-person shop.</div>' +
      '<div class="ct-beta-banner-actions">' +
        '<a class="ct-beta-store-btn" id="ctBetaBannerStore" target="_blank" rel="noopener noreferrer">Get BLOC Planner</a>' +
        '<button type="button" id="ctBetaSuggestBtn">Suggest an improvement</button>' +
      '</div>';
    document.body.insertBefore(banner, document.body.firstChild);
    $('ctBetaBannerStore').href = STORE_URL;

    var blocked = document.createElement('div');
    blocked.id = 'ctBetaBlocked';
    blocked.innerHTML =
      '<div class="ct-beta-card" role="dialog" aria-labelledby="ctBetaBlockedTitle">' +
        '<h2 id="ctBetaBlockedTitle">Exporting is available in the full app</h2>' +
        '<p id="ctBetaBlockedBody">This is a demo of BLOC Planner so you can try the builder. PDF export, file download, and printing are turned off here. Your work still saves in this browser. The full app is a one-time purchase on the Microsoft Store.</p>' +
        '<div class="ct-beta-actions">' +
          '<a class="ct-beta-store-btn ct-beta-primary" id="ctBetaStoreLink" target="_blank" rel="noopener noreferrer">Get BLOC Planner on the Microsoft Store</a>' +
          '<button type="button" class="ct-beta-secondary" data-ct-beta-close>Close</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(blocked);
    $('ctBetaStoreLink').href = STORE_URL;

    var feedback = document.createElement('div');
    feedback.id = 'ctBetaFeedback';
    feedback.innerHTML =
      '<form class="ct-beta-card" id="ctBetaFeedbackForm" role="dialog" aria-labelledby="ctBetaFeedbackTitle">' +
        '<h2 id="ctBetaFeedbackTitle">Suggest an improvement</h2>' +
        '<p>This opens an email to Cory. Nothing is stored on this site.</p>' +
        '<label for="ctBetaDoing">What you were doing</label>' +
        '<textarea id="ctBetaDoing" name="doing" required placeholder="e.g. Adding a table on a weekly page"></textarea>' +
        '<label for="ctBetaSuggestion">Your suggestion</label>' +
        '<textarea id="ctBetaSuggestion" name="suggestion" required placeholder="What would you change or add?"></textarea>' +
        '<label for="ctBetaEmail">Email (optional)</label>' +
        '<input id="ctBetaEmail" name="email" type="email" autocomplete="email" placeholder="If you would like a reply">' +
        '<div class="ct-beta-actions">' +
          '<button type="submit" class="ct-beta-primary">Open email</button>' +
          '<button type="button" class="ct-beta-secondary" data-ct-beta-close>Cancel</button>' +
        '</div>' +
      '</form>';
    document.body.appendChild(feedback);

    var printNotice = document.createElement('div');
    printNotice.id = 'ctBetaPrintNotice';
    printNotice.setAttribute('hidden', '');
    printNotice.textContent = 'Printing is available in BLOC Planner on the Microsoft Store.';
    document.body.appendChild(printNotice);

    $('ctBetaSuggestBtn').addEventListener('click', function () {
      $('ctBetaFeedback').classList.add('is-open');
      var field = $('ctBetaDoing');
      if (field) setTimeout(function () { field.focus(); }, 20);
    });
    $('ctBetaFeedbackForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var href = buildMailto(
        $('ctBetaDoing').value.trim(),
        $('ctBetaSuggestion').value.trim(),
        $('ctBetaEmail').value.trim()
      );
      window.ctBetaLastMailto = href;
      window.location.href = href;
    });
    document.addEventListener('click', function (e) {
      if (e.target && e.target.getAttribute && e.target.getAttribute('data-ct-beta-close') != null) {
        closeModals();
      }
      if (e.target === $('ctBetaBlocked') || e.target === $('ctBetaFeedback')) closeModals();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeModals();
    });
  }

  function installGuards() {
    ['exportHyperlinkedPdf', 'openExportModal',
     'buildHyperlinkedPdfBytes', 'buildNativeFallbackPdfBytes',
     'openPartialExportModal', 'exportPartialPdf', 'embedBgPdfPagesForExport'].forEach(guardFn);

    window.saveProjectToFile = saveInBrowser;
    window.saveProjectJson = saveInBrowser;

    window.openProjectFile = function () {
      if (!openSavedProjects()) showExportBlocked();
      return false;
    };
    window.loadProjectJson = function () { return false; };

    window.print = function () { showPrintBlocked(); };
    window.addEventListener('beforeprint', function (e) {
      e.preventDefault();
      showPrintBlocked();
    });
    window.addEventListener('keydown', function (e) {
      var key = (e.key || '').toLowerCase();
      if (!(e.metaKey || e.ctrlKey)) return;
      if (key === 's') {
        e.preventDefault();
        e.stopPropagation();
        saveInBrowser();
        return;
      }
      if (key === 'p') {
        e.preventDefault();
        e.stopPropagation();
        showPrintBlocked();
        return;
      }
      if (key === 'e') {
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
    var saveBtn = $('saveJsonBtn');
    if (saveBtn) {
      saveBtn.setAttribute('title', 'Save in this browser (not as a file)');
      saveBtn.classList.remove('ct-beta-blocked');
    }
    var loadBtn = $('loadJsonBtn');
    if (loadBtn) {
      loadBtn.setAttribute('title', 'Open a planner saved in this browser');
      loadBtn.removeAttribute('onclick');
      loadBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        openSavedProjects();
      }, true);
    }
    disableControl($('exportDirectDownloadLink'));
    disableControl($('exportOpenTabBtn'));
    disableControl($('exportCopyJsonBtn'));

    if (window.coryDesktop && typeof window.coryDesktop.onAppCommand === 'function') {
      window.coryDesktop.onAppCommand = function () {};
    }
  }

  function decorateStarterCards() {
    var cards = document.querySelectorAll('#startersGrid .starter-card');
    cards.forEach(function (card) {
      if (card.classList.contains('editable-card')) return;
      var sel = card.querySelector('[data-starter-variant]');
      var group = card.getAttribute('data-starter-group') || '';
      var id = sel ? sel.value : ((typeof starterCatalog === 'function' && starterCatalog().find(function (e) { return e.group === group; })) || {}).id;
      var unlocked = isStarterUnlocked(id);
      card.classList.toggle('ct-beta-starter-locked', !unlocked);
      card.classList.toggle('ct-beta-starter-free', !!unlocked);
      card.style.position = 'relative';
      var lock = card.querySelector('.ct-beta-lock-badge');
      var free = card.querySelector('.ct-beta-free-badge');
      if (unlocked) {
        if (lock) lock.remove();
        if (!free) {
          free = document.createElement('span');
          free.className = 'ct-beta-free-badge';
          free.textContent = 'Free to try';
          card.appendChild(free);
        }
      } else {
        if (free) free.remove();
        if (!lock) {
          lock = document.createElement('span');
          lock.className = 'ct-beta-lock-badge';
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

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function () {
    mountChrome();
    installGuards();
    installStarterLocks();
  });
})();
