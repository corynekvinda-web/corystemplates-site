/* Cory's Templates — iPad / touch behaviour layer (no network, no analytics).
   Loaded at the END of index.html, after the app's own script has defined its
   globals (applyCanvasZoom, selectPage, addWidget, ...). */
(function () {
  'use strict';
  var root = document.documentElement;
  var qs = location.search;
  var coarse = false;
  try { coarse = window.matchMedia('(pointer: coarse)').matches; } catch (_) {}
  var isTouch = coarse || /[?&]touch=1\b/.test(qs) || root.classList.contains('ios-app') ||
                (navigator.maxTouchPoints > 1 && /iPad|Macintosh/.test(navigator.userAgent));
  if (!isTouch) return;                      // desktop / mouse: nothing changes
  root.classList.add('touch-ui');

  var $ = function (id) { return document.getElementById(id); };
  var NARROW_PX = 1000;

  /* ---------- layout classes + header height variable ---------- */
  function relayout() {
    root.classList.toggle('narrow', window.innerWidth < NARROW_PX);
    var h = document.querySelector('header');
    if (h) root.style.setProperty('--hdr-bottom', Math.round(h.getBoundingClientRect().bottom) + 'px');
    if (window.innerWidth >= NARROW_PX) closeDrawers();
  }

  /* ---------- slide-over drawers for portrait iPads ---------- */
  function closeDrawers() { root.classList.remove('drawer-left', 'drawer-right'); }
  function toggleDrawer(side) {
    relayout();
    var cls = 'drawer-' + side, other = 'drawer-' + (side === 'left' ? 'right' : 'left');
    root.classList.remove(other);
    root.classList.toggle(cls);
  }
  function addDrawerUI() {
    var bar = document.querySelector('main > div:first-child');
    if (!bar || $('drawerLeftBtn')) return;
    var left = document.createElement('button');
    left.id = 'drawerLeftBtn'; left.type = 'button';
    left.className = 'drawer-btn shrink-0 mr-2 px-3 rounded bg-sky-600 text-white font-semibold text-sm';
    left.innerHTML = '<span style="font-size:18px;line-height:1">＋</span><span>Add</span>';
    left.addEventListener('click', function () { toggleDrawer('left'); });
    bar.insertBefore(left, bar.firstChild);
    var right = document.createElement('button');
    right.id = 'drawerRightBtn'; right.type = 'button';
    right.className = 'drawer-btn shrink-0 ml-2 px-3 rounded bg-slate-700 text-slate-100 font-semibold text-sm border border-slate-600';
    right.innerHTML = '<span>Properties</span>';
    right.addEventListener('click', function () { toggleDrawer('right'); });
    bar.appendChild(right);
    var scrim = document.createElement('div');
    scrim.id = 'drawerScrim';
    scrim.addEventListener('click', closeDrawers);
    document.body.appendChild(scrim);
  }
  // After adding a box or opening a page from the left drawer, get out of the way.
  ['addWidget', 'selectPage', 'insertTypedPage', 'addSticker'].forEach(function (fn) {
    var orig = window[fn];
    if (typeof orig !== 'function') return;
    window[fn] = function () {
      var r = orig.apply(this, arguments);
      if (root.classList.contains('narrow') && root.classList.contains('drawer-left')) closeDrawers();
      return r;
    };
  });

  /* ---------- zoom + pan (translate based, so every edge of the page can be reached) ---------- */
  var pan = { x: 0, y: 0 };
  function clampPan() {
    var vp = $('canvasViewport'); if (!vp || typeof appState === 'undefined') return;
    var z = appState.zoom, sw = appState.width * z, sh = appState.height * z;
    var mx = Math.max(0, (sw + vp.clientWidth) / 2 - 90), my = Math.max(0, (sh + vp.clientHeight) / 2 - 90);
    pan.x = Math.max(-mx, Math.min(mx, pan.x)); pan.y = Math.max(-my, Math.min(my, pan.y));
  }
  window.applyCanvasZoom = function () {
    var wrapper = $('canvasScaleWrapper'), label = $('zoomLevelLabel');
    clampPan();
    if (wrapper) wrapper.style.transform = 'translate(' + pan.x.toFixed(1) + 'px,' + pan.y.toFixed(1) + 'px) scale(' + appState.zoom + ')';
    if (label) label.textContent = Math.round(appState.zoom * 100) + '%';
    root.style.setProperty('--inv-zoom', (1 / appState.zoom).toFixed(4));
  };
  var origFit = window.fitCanvasToScreen;
  window.fitCanvasToScreen = function () {
    pan.x = 0; pan.y = 0;
    var vp = $('canvasViewport'); if (!vp) return;
    // use the real free area (padding is only 24-40px on iPad)
    var availW = Math.max(300, vp.clientWidth - 32), availH = Math.max(300, vp.clientHeight - 32);
    appState.zoom = Math.max(0.35, +Math.min(availW / appState.width, availH / appState.height, 1.0).toFixed(2));
    window.applyCanvasZoom();
  };
  function canvasFits() {
    var vp = $('canvasViewport'), z = appState.zoom;
    return appState.width * z <= vp.clientWidth + 2 && appState.height * z <= vp.clientHeight + 2;
  }

  /* ---------- selection guard ----------
     The selected box may only be cleared on purpose: a real TAP on empty page, changing
     page, deleting it, undo/redo/load, Test Links. Any other attempt is ignored (and counted
     in window.__selectionBlocked so tests / devs can see it). */
  window.__iosTouchUI = true;
  window.__selectionBlocked = 0;
  (function guardSelection() {
    var sel = appState.selectedWidgetId;
    try {
      Object.defineProperty(appState, 'selectedWidgetId', {
        enumerable: true, configurable: true,
        get: function () { return sel; },
        set: function (v) {
          if ((v === null || v === undefined || v === '') && sel && !window.__allowDeselect) {
            window.__selectionBlocked++;
            try { console.warn('selection clear blocked', new Error().stack.split('\n').slice(2, 5).join(' | ')); } catch (_) {}
            return;
          }
          sel = v;
        }
      });
    } catch (_) {}
    function allowing(fn) {
      var orig = window[fn]; if (typeof orig !== 'function') return;
      window[fn] = function () {
        var prev = window.__allowDeselect; window.__allowDeselect = true;
        try { return orig.apply(this, arguments); } finally { window.__allowDeselect = prev; }
      };
    }
    // async loaders: once they finish, drop a selection that points at a widget that no longer exists
    function afterLoad(fn) {
      var orig = window[fn]; if (typeof orig !== 'function') return;
      window[fn] = function () {
        var r = orig.apply(this, arguments);
        Promise.resolve(r).then(function () {
          var id = appState.selectedWidgetId;
          if (id && !appState.pages.some(function (p) { return p.widgets.some(function (w) { return w.id === id; }); })) {
            window.__allowDeselect = true;
            try { appState.selectedWidgetId = null; } finally { window.__allowDeselect = false; }
            try { renderInspector(); } catch (_) {}
          }
        });
        return r;
      };
    }
    ['openStarterTemplate', 'loadProjectFromText', 'loadMyPlannerStarter', 'loadNamedStarter', 'loadProjectWorkbookStarter',
     'openEditableTemplate', 'insertTemplateItem', 'openShelfProject'].forEach(afterLoad);
    ['selectPage', 'restoreStateSnapshot', 'deleteSelectedWidget', 'deletePage', 'deleteCurrentPage', 'startBlankProject', 'replacePlannerWith'].forEach(allowing);
  })();
  function deselectOnPurpose() {
    if (!appState.selectedWidgetId) return;
    window.__allowDeselect = true;
    try { appState.selectedWidgetId = null; } finally { window.__allowDeselect = false; }
    renderCanvas(); renderInspector();
  }

  /* ---------- "Delete Page" / page-list × next to the page arrows: ask first (a fat-finger tap used to delete a page, and
     deleting clears the selected box) ---------- */
  (function confirmDeletePage() {
    var orig = window.deletePage; if (typeof orig !== 'function' || typeof window.appDialog !== 'function') return;
    var asking = false;
    window.deletePage = function (id) {
      if (window.__noDeleteConfirm || asking) return orig.apply(this, arguments);
      var args = arguments, self = this;
      var pg = (appState.pages || []).filter(function (p) { return p.id === id; })[0];
      asking = true;
      window.appDialog({
        title: 'Delete this page?',
        message: '“' + (pg ? pg.name : 'This page') + '” and everything on it will be removed. You can undo it right after.',
        buttons: [{ label: 'Cancel', value: 'cancel', cancel: true }, { label: 'Delete page', value: 'delete', danger: true }]
      }).then(function (v) { asking = false; if (v === 'delete') orig.apply(self, args); }, function () { asking = false; });
    };
  })();

  /* ---------- re-draw throttle while a box is being dragged (Apple Pencil sends 240 events/s) ---------- */
  var activeBoxPointer = null;       // pointer that is dragging a box / handle / divider
  var rafPending = false, origRenderCanvas = window.renderCanvas;
  window.renderCanvas = function () {
    if (activeBoxPointer !== null) {
      if (!rafPending) { rafPending = true; requestAnimationFrame(function () { if (rafPending) { rafPending = false; origRenderCanvas(); } }); }
      return;
    }
    rafPending = false;
    return origRenderCanvas.apply(this, arguments);
  };
  function flushRender() { if (rafPending) { rafPending = false; origRenderCanvas(); } }

  /* ---------- gestures on the page area ---------- */
  var touches = new Map();           // pointerId -> {x,y}
  var pinch = null, panning = null, tapRec = null;
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function endBoxDragNow() {
    // widget drags listen for pointerup on window -> finish them cleanly
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: -1, bubbles: true }));
  }
  // iOS can lose the pointerup of a gesture whose element was re-drawn. A touchstart that is the
  // ONLY finger on the screen proves every older touch is over (touchstart comes right AFTER the
  // pointerdown of the same finger, so that newest pointer is kept).
  function dropStaleTouches() {
    var keys = Array.from(touches.keys()); if (keys.length < 2) return;
    var newest = keys[keys.length - 1];
    var stale = keys.slice(0, -1);
    stale.forEach(function (k) { touches.delete(k); });
    if (pinch) pinch = null;
    if (panning && panning.id !== newest) panning = null;
    if (tapRec && tapRec.id !== newest) tapRec = null;
    if (activeBoxPointer !== null && activeBoxPointer !== newest) { activeBoxPointer = null; endBoxDragNow(); flushRender(); }
    window._suppressSwipe = false;
  }

  function setupGestures() {
    var vp = $('canvasViewport'); if (!vp) return;
    var BOX = '[data-widget-id], [data-resize-dir], [data-split-col], [data-split-row]';

    document.addEventListener('touchstart', function (e) {
      if (e.touches && e.touches.length === 1) dropStaleTouches();
    }, { capture: true, passive: true });

    // Any NEW finger/pen anywhere (inspector, drawers, buttons too) ends a box drag whose pointerup iOS lost
    // (it is not delivered when the touched box was re-drawn). Otherwise the half-finished drag keeps listening on
    // window and the next little finger drift in the Properties panel flies the selected box around.
    window.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse') return;
      var now = Date.now();
      touches.forEach(function (v, k) { if (k !== e.pointerId && now - (v.seen || 0) > 1200) touches.delete(k); });
      if (!vp.contains(e.target)) { touches.clear(); pinch = null; panning = null; tapRec = null; window._suppressSwipe = false; }   // a finger in a panel ends every canvas gesture
      if (activeBoxPointer !== null && (activeBoxPointer === e.pointerId || !vp.contains(e.target))) {   // same id again = the old touch is over
        activeBoxPointer = null; endBoxDragNow(); flushRender();
      }
    }, true);
    // moves of any pointer other than the one that owns a box drag must not drive that drag
    window.addEventListener('pointermove', function (e) {
      if (activeBoxPointer !== null && e.pointerType !== 'mouse' && e.pointerId !== activeBoxPointer && !(pinch || touches.size >= 2)) e.stopImmediatePropagation();
    }, true);

    vp.addEventListener('pointerdown', function (e) {
      var isTouch = e.pointerType === 'touch';
      if (isTouch) touches.set(e.pointerId, { x: e.clientX, y: e.clientY, seen: Date.now() });
      if (isTouch && touches.size === 2) {
        // second finger: stop any box drag, start pinch
        if (activeBoxPointer !== null) { endBoxDragNow(); activeBoxPointer = null; flushRender(); }
        var pts = Array.from(touches.values());
        pinch = { d: dist(pts[0], pts[1]) || 1, zoom: appState.zoom, mx: (pts[0].x + pts[1].x) / 2, my: (pts[0].y + pts[1].y) / 2, px: pan.x, py: pan.y };
        panning = null; tapRec = null; window._suppressSwipe = true;
        e.stopPropagation();                 // the second finger must not start a second box drag
        return;
      }
      if (isTouch && touches.size > 2) { e.stopPropagation(); return; }
      var onBox = e.target.closest && e.target.closest(BOX);
      if (onBox) {
        tapRec = null;
        if (!appState.previewLinks) {
          activeBoxPointer = e.pointerId;
          // Bind this pointer to the page element (never re-drawn) so a re-draw of the touched box
          // can't strand the move/up events (WebKit sends them to the detached node otherwise).
          try { var pc = $('plannerCanvas'); if (pc && e.pointerType !== 'mouse') pc.setPointerCapture(e.pointerId); } catch (_) {}
        }
        return;
      }
      tapRec = { id: e.pointerId, x: e.clientX, y: e.clientY, t: Date.now(), moved: false, startedSelected: !!appState.selectedWidgetId };
      if (isTouch) panning = { id: e.pointerId, x: e.clientX, y: e.clientY, px: pan.x, py: pan.y, moved: false };
    }, true);

    window.addEventListener('pointermove', function (e) {
      if (tapRec && tapRec.id === e.pointerId && Math.hypot(e.clientX - tapRec.x, e.clientY - tapRec.y) > 10) tapRec.moved = true;
      if (e.pointerType !== 'touch' || !touches.has(e.pointerId)) return;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY, seen: Date.now() });
      if (pinch && touches.size >= 2) {
        var pts = Array.from(touches.values()).slice(0, 2);
        var z = Math.max(0.35, Math.min(1.6, pinch.zoom * dist(pts[0], pts[1]) / pinch.d));
        var r = z / pinch.zoom, vr = vp.getBoundingClientRect();
        var cx = vr.left + vr.width / 2, cy = vr.top + vr.height / 2;
        var mx = (pts[0].x + pts[1].x) / 2, my = (pts[0].y + pts[1].y) / 2;
        // keep the page point that was under the fingers under the fingers
        pan.x = (mx - cx) - r * (pinch.mx - cx - pinch.px);
        pan.y = (my - cy) - r * (pinch.my - cy - pinch.py);
        appState.zoom = +z.toFixed(3);
        window.applyCanvasZoom();
        e.preventDefault();
        return;
      }
      if (panning && panning.id === e.pointerId) {
        var dx = e.clientX - panning.x, dy = e.clientY - panning.y;
        if (!panning.moved && Math.hypot(dx, dy) > 8) panning.moved = !canvasFits();
        if (panning.moved) {
          pan.x = panning.px + dx; pan.y = panning.py + dy;
          window.applyCanvasZoom(); window._suppressSwipe = true;
        }
      }
    }, true);

    function up(e) {
      var rec = tapRec;
      if (rec && rec.id === e.pointerId) {
        tapRec = null;
        var dx = e.clientX - rec.x, dy = e.clientY - rec.y;
        var inside = e.type === 'pointerup' && vp.contains(document.elementFromPoint(e.clientX, e.clientY) || document.body);
        if (inside && !rec.moved && Date.now() - rec.t < 600 && touches.size <= 1 && !window._suppressSwipe) {
          deselectOnPurpose();                                   // a real tap on empty page
        } else if (inside && !appState.selectedWidgetId && !rec.startedSelected && !window._suppressSwipe && touches.size <= 1 &&
                   Math.abs(dx) > 90 && Math.abs(dx) > Math.abs(dy) * 1.8 && canvasFits()) {
          stepPage(dx < 0 ? 1 : -1);                             // swipe flips pages (only when nothing is selected)
        }
      }
      if (e.pointerType === 'touch') {
        touches.delete(e.pointerId);
        if (touches.size < 2) pinch = null;
        if (panning && panning.id === e.pointerId) panning = null;
        if (touches.size === 0) setTimeout(function () { window._suppressSwipe = false; }, 0);
      }
      if (activeBoxPointer === e.pointerId) { activeBoxPointer = null; flushRender(); }
    }
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', function (e) { tapRec = null; up(e); }, true);

    // trackpad / Magic Keyboard: two-finger scroll pans, pinch (ctrl+wheel) zooms
    vp.addEventListener('wheel', function (e) {
      e.preventDefault();
      if (e.ctrlKey) {
        appState.zoom = Math.max(0.35, Math.min(1.6, +(appState.zoom * Math.exp(-e.deltaY * 0.01)).toFixed(3)));
      } else { pan.x -= e.deltaX; pan.y -= e.deltaY; }
      window.applyCanvasZoom();
    }, { passive: false });
  }

  /* ---------- Inspector: update in place instead of rebuilding ----------
     The inspector used to be rebuilt (innerHTML) after almost every edit. On iOS that destroyed the
     control under the finger: sliders stopped mid-drag (Image Opacity), tapping a second field after
     typing in the first lost the tap, the keyboard closed. Now we render into a scratch element and,
     when the layout is the same, patch only what changed and never touch the focused control. */
  (function inspectorMorph() {
    var orig = window.renderInspector; if (typeof orig !== 'function') return;
    var LIVE_ID = 'inspectorContent';
    function sig(root) {
      var out = [], all = root.getElementsByTagName('*');
      for (var i = 0; i < all.length; i++) {
        var e = all[i];
        out.push(e.tagName + (e.type ? ':' + e.type : '') + (e.getAttribute('oninput') || '') + (e.getAttribute('onchange') || '') + (e.getAttribute('onclick') || ''));
      }
      return out.join('|');
    }
    function patch(real, fresh) {
      var active = document.activeElement;
      var rs = real.getElementsByTagName('*'), fs = fresh.getElementsByTagName('*');
      for (var i = 0; i < fs.length; i++) {
        var r = rs[i], f = fs[i];
        if (r === active || (active && r.contains && r.contains(active) && r !== real)) {
          // never touch the control being used, but do refresh text elsewhere
          if (r === active) continue;
        }
        // attributes (class, disabled, hidden, title, style ...)
        if (r.className !== f.className) r.className = f.className;
        var tag = r.tagName;
        if (tag === 'INPUT') {
          var t = r.type;
          if (t === 'checkbox' || t === 'radio') { if (r.checked !== f.hasAttribute('checked')) r.checked = f.hasAttribute('checked'); }
          else if (t !== 'file') { var v = f.getAttribute('value') || ''; if (r.value !== v) r.value = v; }
          ['min', 'max', 'step', 'disabled'].forEach(function (a) { var fv = f.getAttribute(a), rv = r.getAttribute(a); if (fv !== rv) { if (fv === null) r.removeAttribute(a); else r.setAttribute(a, fv); } });
        } else if (tag === 'SELECT') {
          var idx = -1; for (var k = 0; k < f.options.length; k++) if (f.options[k].hasAttribute('selected')) idx = k;
          if (r.options.length === f.options.length && idx >= 0 && r.selectedIndex !== idx) r.selectedIndex = idx;
        } else if (tag === 'TEXTAREA') {
          if (r.value !== f.textContent) r.value = f.textContent;
        } else if (f.children.length === 0 && r.textContent !== f.textContent) {
          r.textContent = f.textContent;
        }
        if (tag === 'IMG' || tag === 'SPAN' || tag === 'DIV' || tag === 'P' || tag === 'BUTTON') {
          var st = f.getAttribute('style') || ''; if ((r.getAttribute('style') || '') !== st) { if (st) r.setAttribute('style', st); else r.removeAttribute('style'); }
          if (tag === 'IMG' && r.getAttribute('src') !== f.getAttribute('src')) r.setAttribute('src', f.getAttribute('src') || '');
        }
      }
    }
    window.renderInspector = function () {
      var live = document.getElementById(LIVE_ID);
      if (!live) return orig.apply(this, arguments);
      var active = document.activeElement, activeInside = active && live.contains(active) ? active : null;
      // render into a scratch element that temporarily owns the id
      live.id = LIVE_ID + '__live';
      var scratch = document.createElement('div'); scratch.id = LIVE_ID; scratch.style.display = 'none'; document.body.appendChild(scratch);
      try { orig.apply(this, arguments); } finally { scratch.id = LIVE_ID + '__scratch'; live.id = LIVE_ID; }
      var same = false;
      try { same = sig(live) === sig(scratch) && live.getElementsByTagName('*').length > 0; } catch (_) {}
      if (same) { patch(live, scratch); scratch.remove(); return; }
      // layout changed (different widget / option) -> full rebuild, keeping scroll + focus where possible
      var sc = live.closest('aside'); var top = sc ? sc.scrollTop : 0;
      var idx = -1;
      if (activeInside) idx = Array.prototype.indexOf.call(live.querySelectorAll('input,select,textarea,button'), activeInside);
      var caret = null; try { if (activeInside && activeInside.selectionStart != null) caret = [activeInside.selectionStart, activeInside.selectionEnd]; } catch (_) {}
      live.innerHTML = scratch.innerHTML; scratch.remove();
      if (sc) sc.scrollTop = top;
      if (idx >= 0 && !window.__inspectorNoRefocus) {
        var el = live.querySelectorAll('input,select,textarea,button')[idx];
        if (el && el.tagName !== 'BUTTON') { try { el.focus({ preventScroll: true }); if (caret) el.setSelectionRange(caret[0], caret[1]); } catch (_) {} }
      }
    };
  })();

  /* ---------- keyboard: don't treat the on-screen keyboard as a window resize ---------- */
  (function keyboard() {
    var vv = window.visualViewport;
    function typing() { var a = document.activeElement; return a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && !/^(checkbox|radio|range|color|button|file)$/.test(a.type || ''); }
    var origFit = window.fitCanvasToScreen;
    window.fitCanvasToScreen = function () {
      // keep the user's zoom/pan while the keyboard is up (resize fires when it opens/closes)
      if (window.__kbOpen && !window.__forceFit) return;
      return origFit.apply(this, arguments);
    };
    function check() {
      var shrunk = vv ? (window.innerHeight - vv.height) > 120 : false;
      var open = shrunk || (typing() && vv && vv.height < screen.height * 0.75);
      if (open !== !!window.__kbOpen) {
        window.__kbOpen = open; root.classList.toggle('kb-open', open);
        if (!open) { window.scrollTo(0, 0); setTimeout(function () { window.__forceFit = false; }, 0); }
      }
    }
    if (vv) { vv.addEventListener('resize', check); vv.addEventListener('scroll', function () { if (window.__kbOpen) window.scrollTo(0, 0); }); }
    document.addEventListener('focusout', function () { setTimeout(check, 350); });
    document.addEventListener('focusin', function () { setTimeout(check, 350); });
  })();

  /* ---------- Test Links reminder ----------
     While "Test Links" is on, boxes cannot be selected and the Properties panel shows the PAGE. In portrait the header
     only shows an unlabeled link icon, so this looked exactly like "the app forgot my selection". Say so, loudly. */
  (function testLinksBanner() {
    var btn = $('togglePreviewModeBtn'); if (!btn) return;
    var ban = document.createElement('button');
    ban.id = 'testLinksBanner'; ban.type = 'button';
    ban.textContent = 'Test Links is ON — boxes can\u2019t be edited. Tap to turn it off.';
    ban.addEventListener('click', function () { btn.click(); });
    document.body.appendChild(ban);
    function sync() { root.classList.toggle('links-test-on', !!appState.previewLinks); }
    try { new MutationObserver(sync).observe(btn, { attributes: true, attributeFilter: ['class'] }); } catch (_) {}
    btn.addEventListener('click', function () { setTimeout(sync, 0); });
    sync();
  })();

  /* ---------- no sticky :hover on touch screens ---------- */
  (function stripHover() {
    function strip(sheet) {
      var rules; try { rules = sheet.cssRules; } catch (_) { return; }
      for (var i = rules.length - 1; i >= 0; i--) {
        var r = rules[i];
        if (r.type === 1 && /:hover/.test(r.selectorText || '')) { try { sheet.deleteRule(i); } catch (_) {} }
        else if (r.cssRules && r.type === 4 && !/hover:\s*hover/.test(r.conditionText || '')) { try { for (var j = r.cssRules.length - 1; j >= 0; j--) if (/:hover/.test(r.cssRules[j].selectorText || '')) r.deleteRule(j); } catch (_) {} }
      }
    }
    function run() { for (var i = 0; i < document.styleSheets.length; i++) strip(document.styleSheets[i]); }
    var t = null;
    function later() { clearTimeout(t); t = setTimeout(run, 150); }
    try { new MutationObserver(later).observe(document.head, { childList: true, subtree: true, characterData: true }); } catch (_) {}
    run(); later();
  })();

  /* ---------- save work when the app goes to the background (iOS has no "close") ---------- */
  function flush() { try { if (typeof flushAutosaveNow === 'function') flushAutosaveNow(); } catch (_) {} }
  document.addEventListener('visibilitychange', function () { if (document.hidden) flush(); });
  window.addEventListener('pagehide', flush);

  /* ---------- go ---------- */
  addDrawerUI();
  setupGestures();
  relayout();
  window.addEventListener('resize', function () { relayout(); });
  try { new ResizeObserver(function () { relayout(); }).observe(document.querySelector('header')); } catch (_) {}
  window.addEventListener('orientationchange', function () { setTimeout(function () { relayout(); window.fitCanvasToScreen(); }, 200); });
  setTimeout(function () { relayout(); window.fitCanvasToScreen(); }, 50);
})();
