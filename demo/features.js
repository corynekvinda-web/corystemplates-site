/* BLOC Planner — app-only features (1.0.2)
 * Heading fonts, US holidays + longer wizard spans, repeat format / copy to
 * every daily page, My Templates (folders), editable templates, restyle,
 * partial export, widget packs and the My Projects shelf.
 * Everything runs offline. Library + shelf live in IndexedDB in the app's
 * own storage, so they survive app updates.
 */
'use strict';

/* ---------------------------------------------------------------- fonts */
const HEADING_FONTS = {
  playfair: { label: 'Playfair Display (serif)', family: 'BLOC Playfair', file: 'PlayfairDisplay-Bold.ttf' },
  merriweather: { label: 'Merriweather (book serif)', family: 'BLOC Merriweather', file: 'Merriweather-Bold.ttf' },
  oswald: { label: 'Oswald (tall, condensed)', family: 'BLOC Oswald', file: 'Oswald-SemiBold.ttf' },
  caveat: { label: 'Caveat (handwritten)', family: 'BLOC Caveat', file: 'Caveat-Bold.ttf' }
};
(function injectHeadingFontFaces() {
  const css = Object.values(HEADING_FONTS).map(f =>
    `@font-face{font-family:'${f.family}';src:url(vendor/heading-fonts/${f.file}) format('truetype');font-weight:100 900;font-display:swap;}`).join('');
  const st = document.createElement('style');
  st.id = 'blocHeadingFonts';
  st.textContent = css + '.touch-only{display:none}html.touch-ui .touch-only{display:block}html.touch-ui #toolsMenuWrap{display:none}';
  document.head.appendChild(st);
})();
function headingFontCss(w) {
  const f = w && w.headingFont && HEADING_FONTS[w.headingFont];
  return f ? `font-family:'${f.family}', Inter, sans-serif;` : '';
}
const _headingFontBytes = {};
async function embedHeadingFontsForPdf() {
  return {};
}

/* ------------------------------------------------------------- holidays */
function isMultiMonthKind(kind) { return ['year', 'school', 'months18', 'fiscal', 'custom'].includes(kind); }
function _iso(y, m, d) { return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`; }
function _nthWeekday(y, m, dow, n) { // n = 1..5, or -1 for last
  if (n > 0) { const first = new Date(y, m, 1).getDay(); return 1 + ((dow - first + 7) % 7) + (n - 1) * 7; }
  const lastD = new Date(y, m + 1, 0).getDate(); const lastDow = new Date(y, m, lastD).getDay();
  return lastD - ((lastDow - dow + 7) % 7);
}
function _easter(y) { // Anonymous Gregorian algorithm
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1, day = ((h + l - 7 * m + 114) % 31) + 1;
  return [month, day];
}
function usHolidaysForYear(y) {
  const H = {};
  const add = (m, d, name) => { const k = _iso(y, m, d); H[k] = H[k] ? H[k] + ' · ' + name : name; };
  add(0, 1, "New Year's Day");
  add(0, _nthWeekday(y, 0, 1, 3), 'Martin Luther King Jr. Day');
  add(1, 14, "Valentine's Day");
  add(1, _nthWeekday(y, 1, 1, 3), "Presidents' Day");
  const [em, ed] = _easter(y); add(em, ed, 'Easter');
  add(4, _nthWeekday(y, 4, 0, 2), "Mother's Day");
  add(4, _nthWeekday(y, 4, 1, -1), 'Memorial Day');
  add(5, _nthWeekday(y, 5, 0, 3), "Father's Day");
  add(5, 19, 'Juneteenth');
  add(6, 4, 'Independence Day');
  add(8, _nthWeekday(y, 8, 1, 1), 'Labor Day');
  add(9, _nthWeekday(y, 9, 1, 2), "Columbus / Indigenous Peoples' Day");
  add(9, 31, 'Halloween');
  add(10, 11, 'Veterans Day');
  add(10, _nthWeekday(y, 10, 4, 4), 'Thanksgiving');
  add(11, 24, 'Christmas Eve');
  add(11, 25, 'Christmas Day');
  add(11, 31, "New Year's Eve");
  return H;
}
function usHolidaysForRange(startISO, endISO) {
  const out = {};
  const y0 = Number(startISO.slice(0, 4)), y1 = Number(endISO.slice(0, 4));
  for (let y = y0; y <= y1; y++) Object.entries(usHolidaysForYear(y)).forEach(([k, v]) => { if (k >= startISO && k <= endISO) out[k] = v; });
  return out;
}
function holidaysForMonth(HOL, y, m) {
  const pre = _iso(y, m, 1).slice(0, 7);
  const out = {};
  Object.entries(HOL || {}).forEach(([k, v]) => { if (k.startsWith(pre)) out[k] = v; });
  return out;
}

/* ------------------------------------------------------------ utilities */
function deepClone(o) { return JSON.parse(JSON.stringify(o)); }
function isDailyPage(p) { return /^daily$/i.test(p.section || '') || p.templateType === 'daily'; }
function sameHex(a, b) { return String(a || '').toLowerCase() === String(b || '').toLowerCase(); }
function el(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }

/** Fresh ids for a set of pages + their boxes; links inside the set follow the new
 *  ids, links to pages that aren't in the set (or in this planner) are cleared. */
function remapPagesForInsert(srcPages, pinIndexes = false) {
  const pages = deepClone(srcPages);
  const map = new Map(pages.map(p => [p.id, uid('page')]));
  const keep = (v) => {
    if (typeof v !== 'string' || !v) return v;
    if (map.has(v)) return map.get(v);
    if (/^NAV_/.test(v)) return v;
    if (appState.pages.some(p => p.id === v)) return v;
    return '';
  };
  const LINK_KEYS = ['targetPageId', 'headerTargetPageId'];
  pages.forEach(p => {
    p.id = map.get(p.id);
    (p.widgets || []).forEach(w => {
      w.id = uid('w');
      LINK_KEYS.forEach(k => { if (k in w) w[k] = keep(w[k]); });
      if (Array.isArray(w.selectedPageIds)) w.selectedPageIds = w.selectedPageIds.map(keep).filter(Boolean);
      Object.keys(w).forEach(k => { if (!LINK_KEYS.includes(k) && typeof w[k] === 'string' && map.has(w[k])) w[k] = map.get(w[k]); });
      delete w.stampGroup;
      normalizeLineWidgetModel(w);
    });
    if (p.bgPdf && Array.isArray(p.bgPdf.links)) p.bgPdf.links = p.bgPdf.links.map(l => [l[0], l[1], l[2], l[3], keep(l[4])]).filter(l => l[4]);
  });
  if (pinIndexes) {
    // Going into an existing planner: a contents box that listed "the pages after it"
    // would suddenly list the whole planner. Pin it to the pages it came with.
    pages.forEach((p, i) => (p.widgets || []).forEach(w => {
      if (w.type !== 'index' || !['after', 'all'].includes(w.scopeMode || 'after')) return;
      const list = (w.scopeMode === 'all') ? pages.filter(q => q !== p) : pages.slice(i + 1);
      if (!list.length) return;
      w.scopeMode = 'manual';
      w.selectedPageIds = list.map(q => q.id);
    }));
  }
  migrateNeighborNavTargets(pages);
  return pages;
}
/** Scale boxes designed on srcW×srcH to the current page size. */
function fitPagesFrom(pages, srcW, srcH) {
  srcW = srcW || DESIGN_W; srcH = srcH || DESIGN_H;
  if (srcW === appState.width && srcH === appState.height) return pages;
  const sx = appState.width / srcW, sy = appState.height / srcH;
  pages.forEach(p => (p.widgets || []).forEach(w => scaleWidgetGeometry(w, sx, sy, appState.width, appState.height)));
  return pages;
}
function insertPagesAfterCurrent(pages) {
  const cur = appState.pages.findIndex(p => p.id === appState.activePageId);
  appState.pages.splice(cur >= 0 ? cur + 1 : appState.pages.length, 0, ...pages);
  renderPagesList();
  selectPage(pages[0].id);
  scheduleAutosave();
}
function replacePlannerWith(title, pages) {
  appState.title = title || 'My Planner';
  appState.pages = pages;
  appState.selectedWidgetId = null;
  const t = document.getElementById('docTitleInput'); if (t) t.value = appState.title;
  renderPagesList();
  selectPage(pages[0].id);
  fitCanvasToScreen();
  flushAutosaveNow();
}

/* ------------------------------------------------------ modal scaffold */
function blocModal(id, title, subtitle) {
  let m = document.getElementById(id);
  if (!m) {
    m = el(`<div id="${id}" class="bloc-modal fixed inset-0 bg-slate-950/85 backdrop-blur-sm hidden items-center justify-center p-4 z-[67]">
      <div class="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col text-[13px] text-slate-200">
        <div class="flex items-center justify-between gap-3 px-5 pt-4 pb-3 border-b border-slate-800">
          <div><h2 class="text-lg font-semibold text-white" data-m-title></h2><p class="text-[11px] text-slate-400" data-m-sub></p></div>
          <button data-m-close class="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300" title="Close (Esc)">✕</button>
        </div>
        <div data-m-body class="overflow-y-auto px-5 py-4 flex-1 min-h-0"></div>
      </div></div>`);
    document.body.appendChild(m);
    m.querySelector('[data-m-close]').addEventListener('click', () => closeBlocModal(id));
    m.addEventListener('click', (e) => { if (e.target === m) closeBlocModal(id); });
  }
  m.querySelector('[data-m-title]').textContent = title;
  m.querySelector('[data-m-sub]').textContent = subtitle || '';
  return m;
}
function showBlocModal(m) { m.classList.remove('hidden'); m.classList.add('flex'); }
function closeBlocModal(id) { const m = document.getElementById(id); if (m) { m.classList.add('hidden'); m.classList.remove('flex'); } }
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!document.getElementById('appDialogModal')?.classList.contains('hidden')) return;
  document.querySelectorAll('.bloc-modal.flex').forEach(m => closeBlocModal(m.id));
});
const _origAnyModalOpen = typeof anyModalOpen === 'function' ? anyModalOpen : null;
if (_origAnyModalOpen) {
  // keyboard shortcuts (Delete, arrows…) must not act on the page behind our dialogs
  anyModalOpen = function () { return _origAnyModalOpen() || Boolean(document.querySelector('.bloc-modal.flex')); }; // eslint-disable-line no-global-assign
}

/* ---------------------------------------------- inspector: new controls */
const FORMAT_KEYS = ['bgColor', 'bgColorOpacity', 'accentColor', 'borderColor', 'borderWidth', 'cornerRadius', 'opacity', 'fontSize', 'width', 'height', 'textColor', 'headingFont'];
function renderFeatureControls(w) {
  const page = getActivePage();
  if (!page) return '';
  const fontSel = w.type === 'sticker' ? '' : `
    <div class="bg-slate-800/50 p-2.5 rounded-lg border border-slate-700/70">
      <label class="block text-slate-300 font-medium mb-1">Heading font</label>
      <select id="headingFontSelect" onchange="updateWidgetProp('headingFont', this.value)" class="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-100">
        <option value="" ${!w.headingFont ? 'selected' : ''}>Inter (standard)</option>
        ${Object.entries(HEADING_FONTS).map(([k, f]) => `<option value="${k}" ${w.headingFont === k ? 'selected' : ''} style="font-family:'${f.family}'">${f.label}</option>`).join('')}
      </select>
      <p class="text-[10px] text-slate-500 mt-1">Used for this box's title. It's embedded in your PDF.</p>
    </div>`;
  const sec = page.section || '';
  const nSec = sec ? appState.pages.filter(p => (p.section || '') === sec).length : 0;
  const nDaily = appState.pages.filter(isDailyPage).length;
  return `${fontSel}
    <div id="repeatControls" class="bg-slate-800/50 p-2.5 rounded-lg border border-slate-700/70 space-y-2">
      <div class="text-slate-300 font-medium">Repeat across pages</div>
      <label class="block text-[11px] text-slate-400">Which pages</label>
      <select id="repeatScope" class="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-100 text-[11px]">
        ${sec ? `<option value="section">Pages tagged “${escapeHtml(sec)}” (${nSec})</option>` : ''}
        <option value="all">Whole planner (${appState.pages.length} pages)</option>
      </select>
      <label class="flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer">
        <input id="repeatSameTitle" type="checkbox" checked class="accent-sky-500" /> Only boxes with the same ${w.type === 'sticker' ? 'symbol' : 'title'}
      </label>
      <button id="applyFormatAllBtn" onclick="applyFormatToMatching(document.getElementById('repeatScope').value, document.getElementById('repeatSameTitle').checked)"
              class="w-full py-1.5 rounded-md bg-sky-700 hover:bg-sky-600 text-white text-[11px] font-semibold">Apply format to all matching</button>
      <button id="copyToDailyBtn" onclick="copyWidgetToEveryDailyPage()" ${nDaily ? '' : 'disabled'}
              class="w-full py-1.5 rounded-md bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-slate-100 text-[11px] font-semibold">Copy this box to every daily page (${nDaily})</button>
      <p class="text-[10px] text-slate-500 leading-snug">Format copies fill, accent, border, opacity, fill opacity, text size, font and size. Copying again replaces the earlier copies instead of stacking them.</p>
    </div>
    <button id="saveWidgetTemplateBtn" onclick="saveSelectedWidgetAsTemplate()" class="w-full py-1.5 rounded-md bg-emerald-800/70 hover:bg-emerald-700 text-emerald-50 text-[11px] font-semibold border border-emerald-700/60">Save this box to My Templates</button>`;
}

function _matches(src, w, sameTitle) {
  if (w === src || w.type !== src.type) return false;
  if (w.role === 'dividerBanner' || src.role === 'dividerBanner') return w.role === src.role;
  if (!sameTitle) return true;
  if (src.type === 'sticker') return w.symbolId === src.symbolId;
  return String(w.title || '').trim().toLowerCase() === String(src.title || '').trim().toLowerCase();
}
function _applySize(w) {
  w.width = Math.min(w.width, appState.width);
  w.height = Math.min(w.height, appState.height);
  w.x = Math.max(0, Math.min(appState.width - w.width, w.x));
  w.y = Math.max(0, Math.min(appState.height - w.height, w.y));
  if (isLineBasedWidget(w)) {
    if (w.type === 'notes') {
      w.lines = Math.max(1, Math.round((w.height - 24) / (Number(w.spacing) || 20)));
    } else {
      const count = getLineWidgetEffectiveCount(w);
      w.rowSpacing = Math.max(8, +((w.height - 24) / Math.max(1, count)).toFixed(2));
    }
  }
}
function applyFormatToMatching(scope, sameTitle = true) {
  const page = getActivePage();
  const src = getSelectedWidget();
  if (!page || !src) return 0;
  const pages = scope === 'section' && page.section ? appState.pages.filter(p => (p.section || '') === page.section) : appState.pages;
  const targets = [];
  pages.forEach(p => (p.widgets || []).forEach(w => { if (_matches(src, w, sameTitle)) targets.push(w); }));
  if (!targets.length) { showToast('No other matching boxes found'); return 0; }
  pushUndoSnapshot();
  targets.forEach(w => {
    FORMAT_KEYS.forEach(k => { if (k in src) w[k] = deepClone(src[k]); else delete w[k]; });
    _applySize(w);
  });
  renderCanvas(); renderInspector(); scheduleAutosave();
  showToast(`Formatted ${targets.length} matching box${targets.length === 1 ? '' : 'es'}`);
  return targets.length;
}
function copyWidgetToEveryDailyPage() {
  const page = getActivePage();
  const src = getSelectedWidget();
  if (!page || !src) return 0;
  const daily = appState.pages.filter(p => isDailyPage(p) && p.id !== page.id);
  if (!daily.length) { showToast('This planner has no other daily pages'); return 0; }
  pushUndoSnapshot();
  if (!src.stampGroup) src.stampGroup = uid('stamp');
  daily.forEach(p => {
    p.widgets = p.widgets.filter(w => w.stampGroup !== src.stampGroup);
    const c = deepClone(src);
    c.id = uid('w');
    delete c.role;
    p.widgets.push(c);
  });
  renderCanvas(); renderInspector(); scheduleAutosave();
  showToast(`Copied to ${daily.length} daily page${daily.length === 1 ? '' : 's'}`);
  return daily.length;
}

/* ------------------------------------------------------------ IndexedDB */
const BLOC_DB = 'bloc_planner_app';
let _dbP = null;
function blocDb() {
  if (!_dbP) {
    _dbP = new Promise((res, rej) => {
      if (!window.indexedDB) return rej(new Error('no IndexedDB'));
      const r = indexedDB.open(BLOC_DB, 1);
      r.onupgradeneeded = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains('folders')) db.createObjectStore('folders', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('templates')) db.createObjectStore('templates', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' });
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    _dbP.catch(() => { _dbP = null; });
    try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (_) {}
  }
  return _dbP;
}
async function dbAll(store) {
  const db = await blocDb();
  return new Promise((res, rej) => { const q = db.transaction(store).objectStore(store).getAll(); q.onsuccess = () => res(q.result || []); q.onerror = () => rej(q.error); });
}
async function dbGet(store, id) {
  const db = await blocDb();
  return new Promise((res, rej) => { const q = db.transaction(store).objectStore(store).get(id); q.onsuccess = () => res(q.result || null); q.onerror = () => rej(q.error); });
}
async function dbPut(store, val) {
  const db = await blocDb();
  return new Promise((res, rej) => { const t = db.transaction(store, 'readwrite'); t.objectStore(store).put(val); t.oncomplete = () => res(val); t.onerror = () => rej(t.error); });
}
async function dbDel(store, id) {
  const db = await blocDb();
  return new Promise((res, rej) => { const t = db.transaction(store, 'readwrite'); t.objectStore(store).delete(id); t.oncomplete = () => res(); t.onerror = () => rej(t.error); });
}

/* ------------------------------------------------------------ thumbnails */
async function renderPageThumb() {
  return '';
}

/* ---------------------------------------------------------- My Templates */
let _libFolder = 'all';
async function saveTemplateItem(item) {
  item.id = item.id || uid('tpl');
  item.createdAt = item.createdAt || new Date().toISOString();
  item.folderId = item.folderId || (_libFolder !== 'all' && _libFolder !== 'none' ? _libFolder : '');
  await dbPut('templates', item);
  if (!item.thumb && item.kind !== 'widget' && item.pages && item.pages[0]) {
    renderPageThumb(item.pages[0]).then(t => { if (t) { item.thumb = t; dbPut('templates', item).then(() => { if (document.getElementById('myTemplatesModal')?.classList.contains('flex')) renderMyTemplates(); }); } });
  }
  return item;
}
async function askName(title, value) {
  const r = await appDialog({ title, input: { label: 'Name', value: value || '', required: true, requiredMessage: 'Type a name first.' }, buttons: [{ label: 'Cancel', value: 'cancel', cancel: true }, { label: 'Save', value: 'ok', primary: true }] });
  if (!r || r.button !== 'ok') return null;
  return (r.text || '').trim() || null;
}
async function saveCurrentPageAsTemplate(name) {
  const page = getActivePage(); if (!page) return null;
  name = name || await askName('Save this page to My Templates', page.name);
  if (!name) return null;
  const pages = [deepClone(page)];
  const item = await saveTemplateItem({ kind: 'page', name, pages, assets: collectUsedAssets(pages), w: appState.width, h: appState.height });
  showToast(`Saved “${name}” to My Templates`);
  if (document.getElementById('myTemplatesModal')?.classList.contains('flex')) renderMyTemplates();
  return item;
}
async function savePlannerAsTemplate(name) {
  name = name || await askName('Save the whole planner to My Templates', appState.title);
  if (!name) return null;
  const pages = deepClone(appState.pages);
  const item = await saveTemplateItem({ kind: 'planner', name, pages, assets: collectUsedAssets(pages), w: appState.width, h: appState.height, preset: appState.preset });
  showToast(`Saved “${name}” (${pages.length} pages) to My Templates`);
  if (document.getElementById('myTemplatesModal')?.classList.contains('flex')) renderMyTemplates();
  return item;
}
async function saveSelectedWidgetAsTemplate(name) {
  const w = getSelectedWidget(); if (!w) return null;
  name = name || await askName('Save this box to My Templates', w.title || 'My box');
  if (!name) return null;
  const c = deepClone(w); delete c.stampGroup; delete c.role;
  const item = await saveTemplateItem({ kind: 'widget', name, widget: c, assets: collectUsedAssets([{ widgets: [c] }]), w: appState.width, h: appState.height });
  showToast(`Saved “${name}” to My Templates`);
  return item;
}
async function insertTemplateItem(id, mode = 'add') {
  const item = await dbGet('templates', id);
  if (!item) return false;
  loadImageAssets(item.assets);
  if (item.kind === 'widget') {
    const page = getActivePage(); if (!page) return false;
    pushUndoSnapshot();
    const w = deepClone(item.widget);
    w.id = uid('w');
    if (w.targetPageId && !/^NAV_/.test(w.targetPageId) && !appState.pages.some(p => p.id === w.targetPageId)) w.targetPageId = '';
    const sx = appState.width / (item.w || appState.width), sy = appState.height / (item.h || appState.height);
    scaleWidgetGeometry(w, sx, sy, appState.width, appState.height);
    normalizeLineWidgetModel(w);
    page.widgets.push(w);
    closeBlocModal('myTemplatesModal');
    selectWidget(w.id);
    scheduleAutosave();
    showToast(`Added “${item.name}”`);
    return true;
  }
  const pages = fitPagesFrom(remapPagesForInsert(item.pages, mode !== 'new'), item.w, item.h);
  internPageImages(pages);
  if (mode === 'new') {
    if (!(await confirmReplaceWork(`Opening “${item.name}”`))) return false;
    if (appState.pages.length) pushUndoSnapshot();
    closeBlocModal('myTemplatesModal');
    replacePlannerWith(item.name, pages);
  } else {
    pushUndoSnapshot();
    closeBlocModal('myTemplatesModal');
    insertPagesAfterCurrent(pages);
  }
  showToast(`Added ${pages.length} page${pages.length === 1 ? '' : 's'} from “${item.name}”`);
  return true;
}
async function createLibFolder(name) {
  name = name || await askName('New folder', '');
  if (!name) return null;
  const f = { id: uid('fld'), name, createdAt: new Date().toISOString() };
  await dbPut('folders', f);
  _libFolder = f.id;
  renderMyTemplates();
  return f;
}
async function renameLibFolder(id, name) {
  const f = await dbGet('folders', id); if (!f) return;
  name = name || await askName('Rename folder', f.name);
  if (!name) return;
  f.name = name; await dbPut('folders', f); renderMyTemplates();
}
async function deleteLibFolder(id, skipConfirm = false) {
  const f = await dbGet('folders', id); if (!f) return;
  const items = (await dbAll('templates')).filter(t => t.folderId === id);
  if (!skipConfirm) {
    const r = await appDialog({ title: `Delete the folder “${f.name}”?`, message: items.length ? `The ${items.length} template${items.length === 1 ? '' : 's'} inside move to “Not in a folder”. Nothing else is deleted.` : 'The folder is empty.', buttons: [{ label: 'Cancel', value: 'cancel', cancel: true }, { label: 'Delete folder', value: 'del', danger: true }] });
    if (r !== 'del') return;
  }
  for (const t of items) { t.folderId = ''; await dbPut('templates', t); }
  await dbDel('folders', id);
  if (_libFolder === id) _libFolder = 'all';
  renderMyTemplates();
}
async function moveTemplateToFolder(id, folderId) {
  const t = await dbGet('templates', id); if (!t) return;
  t.folderId = folderId || ''; await dbPut('templates', t); renderMyTemplates();
}
async function renameTemplate(id, name) {
  const t = await dbGet('templates', id); if (!t) return;
  name = name || await askName('Rename template', t.name);
  if (!name) return;
  t.name = name; await dbPut('templates', t); renderMyTemplates();
}
async function deleteTemplate(id, skipConfirm = false) {
  const t = await dbGet('templates', id); if (!t) return;
  if (!skipConfirm) {
    const r = await appDialog({ title: `Delete “${t.name}”?`, message: 'This removes it from My Templates. Planners you already made with it are not changed.', buttons: [{ label: 'Cancel', value: 'cancel', cancel: true }, { label: 'Delete', value: 'del', danger: true }] });
    if (r !== 'del') return;
  }
  await dbDel('templates', id); renderMyTemplates();
}
function openMyTemplates() {
  const m = blocModal('myTemplatesModal', 'My Templates', 'Pages, whole planners and boxes you saved. They stay in the app between updates and go in as normal, editable pages.');
  showBlocModal(m);
  renderMyTemplates();
}
async function renderMyTemplates() {
  const m = document.getElementById('myTemplatesModal'); if (!m) return;
  const body = m.querySelector('[data-m-body]');
  let folders = [], items = [];
  try { [folders, items] = await Promise.all([dbAll('folders'), dbAll('templates')]); }
  catch (e) { body.innerHTML = '<p class="text-rose-300">My Templates could not open the app storage on this device.</p>'; return; }
  folders.sort((a, b) => a.name.localeCompare(b.name));
  items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  if (_libFolder !== 'all' && _libFolder !== 'none' && !folders.some(f => f.id === _libFolder)) _libFolder = 'all';
  const shown = items.filter(t => _libFolder === 'all' || (_libFolder === 'none' ? !t.folderId || !folders.some(f => f.id === t.folderId) : t.folderId === _libFolder));
  const fbtn = (id, label, n) => `<button data-folder="${id}" onclick="_libFolder='${id}';renderMyTemplates()" class="w-full text-left px-2.5 py-1.5 rounded-md ${_libFolder === id ? 'bg-sky-700 text-white' : 'hover:bg-slate-800 text-slate-200'} flex justify-between"><span class="truncate">${escapeHtml(label)}</span><span class="text-[11px] opacity-70">${n}</span></button>`;
  const curFolder = folders.find(f => f.id === _libFolder);
  const kindLabel = { page: 'Page', planner: 'Planner', widget: 'Box' };
  body.innerHTML = `
    <div class="flex flex-wrap gap-2 mb-4">
      <button id="tplSavePageBtn" onclick="saveCurrentPageAsTemplate()" class="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold">Save this page</button>
      <button id="tplSavePlannerBtn" onclick="savePlannerAsTemplate()" class="px-3 py-1.5 rounded-md bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold">Save the whole planner (${appState.pages.length} pages)</button>
      <span class="text-[11px] text-slate-400 self-center">To save one box, select it and use “Save this box to My Templates” in its properties.</span>
    </div>
    <div class="flex gap-4 min-h-[300px] max-md:flex-col">
      <div class="w-52 max-md:w-full shrink-0 space-y-1">
        ${fbtn('all', 'All templates', items.length)}
        ${fbtn('none', 'Not in a folder', items.filter(t => !t.folderId || !folders.some(f => f.id === t.folderId)).length)}
        <div class="pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 px-1">Folders</div>
        ${folders.map(f => fbtn(f.id, f.name, items.filter(t => t.folderId === f.id).length)).join('') || '<p class="text-[11px] text-slate-500 px-1">No folders yet.</p>'}
        <button id="tplNewFolderBtn" onclick="createLibFolder()" class="w-full mt-2 px-2.5 py-1.5 rounded-md border border-dashed border-slate-600 hover:border-sky-500 text-slate-300 text-xs">+ New folder</button>
        ${curFolder ? `<div class="flex gap-1 pt-1"><button onclick="renameLibFolder('${curFolder.id}')" class="flex-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px]">Rename</button><button onclick="deleteLibFolder('${curFolder.id}')" class="flex-1 px-2 py-1 rounded bg-slate-800 hover:bg-rose-700 text-[11px]">Delete</button></div>` : ''}
      </div>
      <div class="flex-1 min-w-0">
        ${shown.length ? `<div class="grid grid-cols-2 md:grid-cols-3 gap-3">${shown.map(t => `
          <div class="tpl-card rounded-lg border border-slate-700 bg-slate-800/50 p-2 flex flex-col" data-tpl-id="${t.id}">
            <div class="h-32 bg-slate-950/40 rounded flex items-center justify-center overflow-hidden">
              ${t.thumb ? `<img src="${t.thumb}" alt="" class="h-full w-auto bg-white rounded-sm shadow" />` : `<span class="text-slate-500 text-[11px]">${t.kind === 'widget' ? escapeHtml(t.widget?.type || 'box') : 'Making preview…'}</span>`}
            </div>
            <div class="mt-1.5 text-[13px] font-semibold text-white leading-tight truncate">${escapeHtml(t.name)}</div>
            <div class="text-[10px] text-slate-400">${kindLabel[t.kind] || ''}${t.pages ? ` · ${t.pages.length} page${t.pages.length === 1 ? '' : 's'}` : ''}</div>
            <select onchange="moveTemplateToFolder('${t.id}', this.value)" class="tpl-move mt-1.5 w-full bg-slate-800 border border-slate-700 rounded px-1.5 py-1 text-[11px]" title="Move to folder">
              <option value="" ${!t.folderId ? 'selected' : ''}>Not in a folder</option>
              ${folders.map(f => `<option value="${f.id}" ${t.folderId === f.id ? 'selected' : ''}>${escapeHtml(f.name)}</option>`).join('')}
            </select>
            <div class="mt-auto pt-2 flex gap-1">
              <button onclick="insertTemplateItem('${t.id}','add')" class="tpl-insert flex-1 py-1.5 rounded-md bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-semibold">${t.kind === 'widget' ? 'Add to page' : 'Add pages'}</button>
              ${t.kind === 'planner' ? `<button onclick="insertTemplateItem('${t.id}','new')" class="py-1.5 px-2 rounded-md bg-slate-700 hover:bg-slate-600 text-[11px]" title="Start a new planner from it">New</button>` : ''}
              <button onclick="renameTemplate('${t.id}')" class="py-1.5 px-2 rounded-md bg-slate-700 hover:bg-slate-600 text-[11px]" title="Rename">✎</button>
              <button onclick="deleteTemplate('${t.id}')" class="py-1.5 px-2 rounded-md bg-slate-700 hover:bg-rose-700 text-[11px]" title="Delete">✕</button>
            </div>
          </div>`).join('')}</div>` : '<p class="text-slate-400">Nothing here yet. Save a page, a planner, or a box and it shows up here.</p>'}
      </div>
    </div>`;
}

/* --------------------------------------------- editable templates (Muse) */
const EDITABLE_BASE = 'starters/editable/';
const EDITABLE_TEMPLATES = [
  { id: 'area-todo-boards', title: 'Area To-Do Boards', pages: 4, blurb: 'Index plus Work, Home and Personal to-do boards, linked.' },
  { id: 'daily-journal', title: 'Daily Journal', pages: 1, blurb: 'Today in three lines, a ruled journal, wins and gratitude.' },
  { id: 'weekly-review', title: 'Weekly Review', pages: 1, blurb: 'Week strip, wins, loose ends, lessons and next week.' },
  { id: 'meeting-notes', title: 'Meeting Notes', pages: 1, blurb: 'Agenda, decisions, discussion notes and assigned actions.' },
  { id: 'brain-dump', title: 'Brain Dump', pages: 1, blurb: 'A full-page dot grid and a short “keepers” list.' },
  { id: 'monthly-habit-tracker', title: 'Monthly Habit Tracker', pages: 1, blurb: '31-day habit grid, weekly rollup and notes.' },
  { id: 'bills-and-budget', title: 'Bills & Budget', pages: 1, blurb: 'Bills table, spending log and notes.' },
  { id: 'reading-log', title: 'Reading Log', pages: 1, blurb: 'Book table (title, author, dates, rating) and favorite lines.' },
  { id: 'workout-log', title: 'Workout Log', pages: 1, blurb: 'Session table, weekly habit strip and notes.' },
  { id: 'weekly-meal-plan', title: 'Weekly Meal Plan', pages: 1, blurb: '7-day meal grid, shopping list and prep notes.' }
];
function renderEditableTemplatesSection(addHint) {
  const cards = EDITABLE_TEMPLATES.map(e => `
    <div class="starter-card editable-card rounded-lg border border-emerald-700/60 bg-slate-800/50 hover:border-emerald-400 p-2 flex flex-col" data-editable-id="${e.id}">
      <div class="flex gap-1 bg-slate-950/40 rounded p-1 justify-center">
        <img src="${EDITABLE_BASE}thumbs/${e.id}.jpg" alt="" loading="lazy" class="h-36 w-auto rounded-sm bg-white shadow" />
      </div>
      <div class="mt-2 text-[13px] font-semibold text-white leading-tight">${escapeHtml(e.title)}</div>
      <div class="text-[11px] text-slate-400 mt-0.5">${escapeHtml(e.blurb)}</div>
      <div class="text-[10px] text-emerald-400 mt-1">${e.pages} page${e.pages === 1 ? '' : 's'} · every box editable</div>
      <div class="mt-auto pt-2 flex gap-1.5">
        <button onclick="openEditableTemplate('${e.id}','new')" class="flex-1 py-1.5 rounded-md bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-semibold">Use this template</button>
        ${addHint ? `<button onclick="openEditableTemplate('${e.id}','add')" title="Add these pages after the current page of your planner" class="py-1.5 px-2 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-100 text-[11px]">+ Add pages</button>` : ''}
      </div>
    </div>`).join('');
  return `<div class="mb-5" id="editableTemplatesSection"><h3 class="text-xs font-semibold uppercase tracking-wider text-emerald-300 mb-0.5">Editable templates</h3>
    <p class="text-[11px] text-slate-400 mb-2">Made from normal boxes: move, change or delete any part. The other templates below go in as a fixed background you add boxes on top of.</p>
    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">${cards}</div></div>`;
}
const _editableCache = new Map();
function loadEditableTemplate(id) {
  if (!_editableCache.has(id)) {
    const p = fetch(`${EDITABLE_BASE}${id}.json`).then(r => { if (!r.ok) throw new Error('missing'); return r.json(); });
    p.catch(() => _editableCache.delete(id));
    _editableCache.set(id, p);
  }
  return _editableCache.get(id);
}
async function openEditableTemplate(id, mode = 'new') {
  const entry = EDITABLE_TEMPLATES.find(e => e.id === id);
  if (!entry) return false;
  let data;
  try { data = await loadEditableTemplate(id); } catch (e) { showToast('That template could not be opened (its file is missing).'); return false; }
  if (mode === 'new' && !(await confirmReplaceWork(`Opening “${entry.title}”`))) return false;
  closeStartersModal();
  if (appState.pages.length) pushUndoSnapshot();
  const pages = fitPagesFrom(remapPagesForInsert(data.pages, mode === 'add'), data.width || DESIGN_W, data.height || DESIGN_H);
  if (mode === 'add') {
    insertPagesAfterCurrent(pages);
    showToast(`Added ${pages.length} page${pages.length === 1 ? '' : 's'} from “${entry.title}”`);
  } else {
    replacePlannerWith(data.title || entry.title, pages);
    showToast(`Opened “${entry.title}”. Every box can be moved, changed or deleted.`);
  }
  return true;
}

/* ------------------------------------------------------------- restyle */
const RESTYLE_THEMES = [
  { name: 'Navy', accent: '#1E3A5F' }, { name: 'Forest', accent: '#2F5D3A' }, { name: 'Plum', accent: '#5B2A6E' },
  { name: 'Rust', accent: '#9A3B1B' }, { name: 'Rose', accent: '#B03A5B' }, { name: 'Teal', accent: '#0F6E6E' },
  { name: 'Slate', accent: '#334155' }, { name: 'Charcoal', accent: '#1F2937' }, { name: 'Ochre', accent: '#A16207' }
];
function plannerMainAccent() {
  const counts = new Map();
  appState.pages.forEach(p => (p.widgets || []).forEach(w => {
    if (w.type === 'sticker' || w.type === 'navtab' || !w.accentColor) return;
    const k = String(w.accentColor).toLowerCase();
    counts.set(k, (counts.get(k) || 0) + 1);
  }));
  let best = '', n = 0;
  counts.forEach((v, k) => { if (v > n) { n = v; best = k; } });
  return best;
}
function restylePlanner(newAccent, allColors = false) {
  newAccent = normalizeHexColor(newAccent);
  if (!newAccent) return 0;
  const old = plannerMainAccent();
  let changed = 0;
  pushUndoSnapshot();
  appState.pages.forEach(p => (p.widgets || []).forEach(w => {
    let hit = false;
    if (w.accentColor && (allColors ? w.type !== 'navtab' : sameHex(w.accentColor, old))) { w.accentColor = newAccent; hit = true; }
    if (w.type === 'navtab' && w.bgColor && sameHex(w.bgColor, old)) { w.bgColor = newAccent; hit = true; }
    if (hit) changed++;
  }));
  renderCanvas(); renderInspector(); renderPagesList(); scheduleAutosave();
  showToast(`Restyled ${changed} box${changed === 1 ? '' : 'es'} on ${appState.pages.length} page${appState.pages.length === 1 ? '' : 's'}`);
  return changed;
}
function openRestyleModal() {
  const m = blocModal('restyleModal', 'Restyle the whole planner', 'Changes the theme color on every page at once. Boxes keep their place and size. Undo works if you change your mind.');
  const old = plannerMainAccent() || '#1e3a5f';
  m.querySelector('[data-m-body]').innerHTML = `
    <div class="space-y-4 max-w-xl">
      <div class="text-xs text-slate-300">Current theme color: <span class="inline-block w-4 h-4 rounded align-middle border border-slate-600" style="background:${old}"></span> <span class="font-mono-code">${old.toUpperCase()}</span></div>
      <div class="grid grid-cols-3 gap-2">${RESTYLE_THEMES.map(t => `
        <button onclick="document.getElementById('restyleColor').value='${t.accent.toLowerCase()}';document.getElementById('restyleHex').value='${t.accent}'" class="restyle-swatch flex items-center gap-2 px-2.5 py-2 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs"><span class="w-5 h-5 rounded" style="background:${t.accent}"></span>${t.name}</button>`).join('')}</div>
      <div class="flex items-center gap-2 text-xs"><span class="text-slate-400">Or any color</span>
        <input id="restyleColor" type="color" value="${old}" oninput="document.getElementById('restyleHex').value=this.value.toUpperCase()" class="w-8 h-8 rounded bg-slate-800 border border-slate-700" />
        <input id="restyleHex" type="text" maxlength="7" value="${old.toUpperCase()}" class="w-24 bg-slate-800 border border-slate-700 rounded px-2 py-1 font-mono-code" /></div>
      <label class="flex items-start gap-2 text-xs text-slate-300 cursor-pointer"><input id="restyleAll" type="checkbox" class="mt-0.5 accent-sky-500" /> <span>Also change boxes that use a different accent color <span class="text-slate-500">(otherwise only boxes in the current theme color change; Home, Prev and Next buttons keep their own colors)</span></span></label>
      <div class="flex justify-end gap-2"><button onclick="closeBlocModal('restyleModal')" class="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-xs">Cancel</button>
        <button id="restyleApplyBtn" onclick="restylePlanner(document.getElementById('restyleHex').value, document.getElementById('restyleAll').checked); closeBlocModal('restyleModal')" class="px-3 py-1.5 rounded-md bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold">Restyle every page</button></div>
    </div>`;
  showBlocModal(m);
}

/* ------------------------------------------------------ partial export */
function pagesForPartialExport(opts) {
  const P = appState.pages;
  if (opts.mode === 'range') {
    const a = Math.max(1, Math.min(P.length, Number(opts.from) || 1));
    const b = Math.max(a, Math.min(P.length, Number(opts.to) || P.length));
    return P.slice(a - 1, b);
  }
  if (opts.mode === 'month') {
    const mk = String(opts.month || '');
    return P.filter(p => (p.dateISO && p.dateISO.slice(0, 7) === mk) || (p.weekEndISO && p.weekEndISO.slice(0, 7) === mk));
  }
  if (opts.mode === 'section') return P.filter(p => (p.section || 'General') === opts.section);
  return P.slice();
}
async function exportPartialPdf() {
  if (typeof window.ctBetaBlockExport === 'function') return window.ctBetaBlockExport();
  return false;
}
function _partialOpts() {
  const mode = document.querySelector('input[name="pxMode"]:checked')?.value || 'range';
  return { mode, from: document.getElementById('pxFrom').value, to: document.getElementById('pxTo').value, month: document.getElementById('pxMonth').value, section: document.getElementById('pxSection').value };
}
function _updatePartialCount() {
  const n = pagesForPartialExport(_partialOpts()).length;
  const c = document.getElementById('pxCount'); if (c) c.textContent = `${n} page${n === 1 ? '' : 's'}`;
  const b = document.getElementById('pxExportBtn'); if (b) b.disabled = n === 0;
}
function openPartialExportModal() {
  if (typeof window.ctBetaBlockExport === 'function') return window.ctBetaBlockExport();
  return false;
}

/* ---------------------------------------------------------- widget packs */
const WIDGET_PACKS = [
  { name: 'Work', items: [
    { label: 'Project tracker', type: 'logbook', props: { title: 'PROJECT TRACKER', rows: 8, headers: ['Task', 'Owner', 'Due', 'Status'], colWidths: [0.4, 0.2, 0.2, 0.2], width: 672, height: 300 } },
    { label: 'Action items', type: 'checkboxes', props: { title: 'ACTION ITEMS', rows: 6, width: 332, height: 210 } },
    { label: 'Meeting notes', type: 'notes', props: { title: 'MEETING NOTES', pattern: 'ruled', width: 332, height: 320 } },
    { label: 'Time blocks', type: 'hours', props: { title: 'TIME BLOCKS', startHour: 8, endHour: 18, intervalMinutes: 60, width: 320, height: 400 } }
  ] },
  { name: 'School', items: [
    { label: 'Assignments', type: 'logbook', props: { title: 'ASSIGNMENTS', rows: 8, headers: ['Class', 'Assignment', 'Due', 'Done'], colWidths: [0.22, 0.46, 0.18, 0.14], width: 672, height: 300 } },
    { label: 'Class schedule', type: 'logbook', props: { title: 'CLASS SCHEDULE', rows: 7, headers: ['Period', 'Class', 'Room', 'Teacher'], colWidths: [0.16, 0.4, 0.16, 0.28], width: 672, height: 280 } },
    { label: 'Tests & exams', type: 'priorities', props: { title: 'TESTS & EXAMS', count: 5, width: 332, height: 210 } },
    { label: 'Class notes', type: 'notes', props: { title: 'CLASS NOTES', pattern: 'ruled', width: 672, height: 360 } }
  ] },
  { name: 'Family', items: [
    { label: 'Meal plan', type: 'logbook', props: { title: 'MEAL PLAN', rows: 7, headers: ['Day', 'Breakfast', 'Lunch', 'Dinner'], colWidths: [0.16, 0.28, 0.28, 0.28], width: 672, height: 280 } },
    { label: 'Chores', type: 'habit', props: { title: 'CHORES', days: 7, habits: ['Dishes', 'Laundry', 'Trash out', 'Tidy rooms', 'Feed pets'], width: 672, height: 230 } },
    { label: 'Grocery list', type: 'checkboxes', props: { title: 'GROCERY LIST', rows: 12, width: 332, height: 330 } },
    { label: 'Birthdays', type: 'logbook', props: { title: 'BIRTHDAYS', rows: 8, headers: ['Name', 'Date', 'Gift idea'], colWidths: [0.36, 0.22, 0.42], width: 672, height: 300 } }
  ] }
];
function addPackWidget(packIdx, itemIdx) {
  const it = WIDGET_PACKS[packIdx] && WIDGET_PACKS[packIdx].items[itemIdx];
  if (!it) return;
  const props = deepClone(it.props);
  if (props.rows && it.type === 'logbook') props.rowHeights = Array(props.rows).fill(1 / props.rows);
  const sx = appState.width / DESIGN_W, sy = appState.height / DESIGN_H;
  props.width = Math.min(appState.width - 32, Math.round(props.width * sx));
  props.height = Math.min(appState.height - 32, Math.round(props.height * sy));
  addWidget(it.type, props, 'pack-' + it.label);
}
function renderWidgetPacks() {
  const tab = document.getElementById('tab-widgets');
  if (!tab || document.getElementById('widgetPacks')) return;
  const box = el(`<div id="widgetPacks" class="pt-3 mt-1 border-t border-slate-800 space-y-3">
    <div class="text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-1">Widget packs</div>
    ${WIDGET_PACKS.map((p, pi) => `<div data-pack="${p.name}"><div class="text-[10px] font-semibold uppercase tracking-wider text-slate-500 px-1 mb-1">${p.name}</div>
      <div class="grid grid-cols-2 gap-1.5">${p.items.map((it, ii) => `<button onclick="addPackWidget(${pi},${ii})" class="pack-btn text-left px-2 py-1.5 rounded-md bg-slate-800/70 hover:bg-slate-800 border border-slate-700/70 hover:border-sky-500/50 text-[11px] text-slate-200">${escapeHtml(it.label)}</button>`).join('')}</div></div>`).join('')}
  </div>`);
  tab.appendChild(box);
}

/* -------------------------------------------------------- projects shelf */
const SHELF_ID_KEY = 'bloc_shelf_current_id_v1';
let _shelfId = null;
try { _shelfId = localStorage.getItem(SHELF_ID_KEY); } catch (_) {}
let _shelfTimer = null;
let _shelfPending = null;
function _setShelfId(id) { _shelfId = id; try { if (id) localStorage.setItem(SHELF_ID_KEY, id); else localStorage.removeItem(SHELF_ID_KEY); } catch (_) {} }
function shelfNoteAutosave(serialized) {
  _shelfPending = serialized;
  clearTimeout(_shelfTimer);
  _shelfTimer = setTimeout(() => { shelfSaveCurrent(false).catch(() => {}); }, 1500);
}
async function shelfSaveCurrent(withThumb) {
  clearTimeout(_shelfTimer); _shelfTimer = null;
  if (!projectHasWork()) return null;
  const data = _shelfPending || (() => { const s = cloneAppStateSnapshot(); s.selectedWidgetId = null; const a = collectUsedAssets(s.pages); if (Object.keys(a).length) s.assets = a; return s; })();
  _shelfPending = null;
  if (!_shelfId) _setShelfId(uid('proj'));
  const prev = await dbGet('projects', _shelfId);
  const rec = { id: _shelfId, title: appState.title || 'My Planner', pageCount: appState.pages.length, updatedAt: new Date().toISOString(), data, thumb: prev ? prev.thumb : '', thumbAt: prev ? prev.thumbAt : '' };
  if (withThumb || !rec.thumb) {
    const t = await renderPageThumb(appState.pages[0]);
    if (t) { rec.thumb = t; rec.thumbAt = rec.updatedAt; }
  }
  await dbPut('projects', rec);
  return rec;
}
async function shelfBeforeReplace() {
  try { await shelfSaveCurrent(true); } catch (_) {}
  _setShelfId(null);
}
async function openShelfProject(id) {
  if (id === _shelfId) { closeBlocModal('projectsShelfModal'); return true; }
  const rec = await dbGet('projects', id);
  if (!rec || !rec.data) return false;
  try { await shelfSaveCurrent(true); } catch (_) {}
  if (appState.pages.length) pushUndoSnapshot();
  const d = deepClone(rec.data);
  d.pages.forEach(p => { if (Array.isArray(p.widgets)) p.widgets.forEach(normalizeLineWidgetModel); });
  migrateNeighborNavTargets(d.pages);
  restoreStateSnapshot(d);
  appState.selectedWidgetId = null;
  syncPresetSelects();
  _setShelfId(id);
  closeBlocModal('projectsShelfModal');
  flushAutosaveNow();
  fitCanvasToScreen();
  showToast(`Opened “${appState.title}”`);
  return true;
}
async function deleteShelfProject(id, skipConfirm = false) {
  const rec = await dbGet('projects', id); if (!rec) return;
  if (!skipConfirm) {
    const r = await appDialog({ title: `Remove “${rec.title}” from My Projects?`, message: id === _shelfId ? 'This is the planner you have open. It stays open; it just leaves the shelf until you change it again.' : 'This deletes the copy kept in the app. Files you saved with Save are not touched.', buttons: [{ label: 'Cancel', value: 'cancel', cancel: true }, { label: 'Remove', value: 'del', danger: true }] });
    if (r !== 'del') return;
  }
  await dbDel('projects', id);
  renderProjectsShelf();
}
async function newShelfPlanner() {
  closeBlocModal('projectsShelfModal');
  await startBlankProject();
}
function openProjectsShelf() {
  const m = blocModal('projectsShelfModal', 'My Projects', 'Every planner you work on is kept here in the app, with its cover. Open one to keep working on it.');
  showBlocModal(m);
  m.querySelector('[data-m-body]').innerHTML = '<p class="text-slate-400">Loading…</p>';
  (async () => {
    try {
      const cur = _shelfId ? await dbGet('projects', _shelfId) : null;
      const stale = !cur || !cur.thumbAt || (Date.now() - Date.parse(cur.thumbAt) > 20000);
      await shelfSaveCurrent(stale);
    } catch (_) {}
    renderProjectsShelf();
  })();
}
async function renderProjectsShelf() {
  const m = document.getElementById('projectsShelfModal'); if (!m) return;
  const body = m.querySelector('[data-m-body]');
  let list = [];
  try { list = await dbAll('projects'); } catch (e) { body.innerHTML = '<p class="text-rose-300">My Projects could not open the app storage on this device.</p>'; return; }
  list.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  body.innerHTML = `
    <div class="mb-3"><button id="shelfNewBtn" onclick="newShelfPlanner()" class="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold">+ New planner</button></div>
    ${list.length ? `<div class="grid grid-cols-2 md:grid-cols-4 gap-3">${list.map(p => `
      <div class="shelf-card rounded-lg border ${p.id === _shelfId ? 'border-sky-500' : 'border-slate-700'} bg-slate-800/50 p-2 flex flex-col" data-project-id="${p.id}">
        <button onclick="openShelfProject('${p.id}')" class="h-44 bg-slate-950/40 rounded flex items-center justify-center overflow-hidden" title="Open">
          ${p.thumb ? `<img src="${p.thumb}" alt="" class="h-full w-auto bg-white rounded-sm shadow" />` : '<span class="text-slate-500 text-[11px]">No cover yet</span>'}
        </button>
        <div class="mt-1.5 text-[13px] font-semibold text-white leading-tight truncate">${escapeHtml(p.title)}</div>
        <div class="text-[10px] text-slate-400">${p.pageCount} page${p.pageCount === 1 ? '' : 's'} · ${new Date(p.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}${p.id === _shelfId ? ' · <span class="text-sky-400">open now</span>' : ''}</div>
        <div class="mt-auto pt-2 flex gap-1">
          <button onclick="openShelfProject('${p.id}')" class="shelf-open flex-1 py-1.5 rounded-md bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-semibold">${p.id === _shelfId ? 'Keep working' : 'Open'}</button>
          <button onclick="deleteShelfProject('${p.id}')" class="py-1.5 px-2 rounded-md bg-slate-700 hover:bg-rose-700 text-[11px]" title="Remove from My Projects">✕</button>
        </div>
      </div>`).join('')}</div>` : '<p class="text-slate-400">No planners yet. Build or open one and it shows up here.</p>'}`;
}

/* ---------------------------------------------------------------- boot */
(function bootFeatures() {
  const go = () => {
    renderWidgetPacks();
    // iPad: the header has no room for a Tools button, so the same four entries go at the top of New
    const nm = document.getElementById('newProjectMenu');
    if (nm && !document.getElementById('newMenuTools')) {
      const item = (fn, color, title, sub) => `<button onclick="closeAllMenus(); ${fn}()" class="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-slate-800 text-slate-100 flex flex-col"><span class="font-semibold ${color}">${title}</span><span class="text-[11px] text-slate-400">${sub}</span></button>`;
      const sec = el(`<div id="newMenuTools" class="touch-only border-b border-slate-800 mb-1 pb-1">
        <div class="px-2 pt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Tools</div>
        ${item('openProjectsShelf', 'text-sky-300', 'My Projects', 'Your saved planners, with a cover picture of each')}
        ${item('openMyTemplates', 'text-emerald-300', 'My Templates', 'Pages, planners and boxes you saved, in folders')}
        ${item('openRestyleModal', 'text-violet-300', 'Restyle the whole planner', 'Change the color theme of every page at once')}
        ${item('openPartialExportModal', 'text-amber-300', 'Export part of the planner…', 'A page range, one month, or one kind of page')}
      </div>`);
      nm.insertBefore(sec, nm.firstChild);
    }
    // Welcome screen: a way into My Projects
    const skip = document.getElementById('welcomeSkipBtn');
    if (skip && !document.getElementById('welcomeProjectsBtn')) {
      const b = el(`<button id="welcomeProjectsBtn" class="w-full py-2.5 rounded-lg bg-sky-700 hover:bg-sky-600 text-white font-semibold">Open one of my projects</button>`);
      b.addEventListener('click', () => { closeWelcome('skip'); openProjectsShelf(); });
      skip.parentElement.insertBefore(b, skip);
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();
