/*
 * Copyright (C) 2026 Domestone S.r.l.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */
/* Valesta — editor UI (17 languages). Depends on MCA, DEFAULT_STATE, ASSETS, Charts, I18N, REPORT_I18N, Report, AppCore, UI_I18N. */
(function () {
  'use strict';
  const STORE_KEY = 'valesta-state-v2';
  const UILANG_KEY = 'valesta-ui-lang';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const debounce = (fn, ms) => { let t; return function () { clearTimeout(t); const a = arguments; t = setTimeout(() => fn.apply(null, a), ms); }; };

  let state = null;
  let res = null;
  let step = 'identity';   // current step of the valuation (Workflow.PHASES)
  let screen = 'step';     // 'home' (valuations) | 'start' (new valuation) | 'step'
  let ctxTab = 'preview';  // context panel: 'preview' | 'ai' | 'issues'
  let flow = null;         // Workflow.stepStatus of the last refresh
  let rv = null;           // Review.run of the last refresh
  let wiz = null;          // choices of the start screen
  let homeQ = '';
  let palItems = [];
  let palIdx = 0;
  let selComp = null;
  let lastTotal = null; // value shown in the header, to mark a change (refreshTop)
  // Preview: zoom ('fit' = page width, 'page' = whole page, or a factor) and "follow the step", kept on the device.
  const PV_KEY = 'valesta-preview';
  const pvPrefs = (() => { try { return JSON.parse(localStorage.getItem(PV_KEY) || 'null') || {}; } catch (e) { return {}; } })();
  let zoom = pvPrefs.zoom === 'page' || (typeof pvPrefs.zoom === 'number' && pvPrefs.zoom >= 0.25 && pvPrefs.zoom <= 1.6) ? pvPrefs.zoom : 'fit';
  let pvFollow = pvPrefs.follow !== false;
  const savePv = () => { try { localStorage.setItem(PV_KEY, JSON.stringify({ zoom, follow: pvFollow, top: pvPrefs.top || 0 })); } catch (e) { /* this visit only */ } };
  // Location map, normal or enlarged, kept on the device.
  let mapBig = (() => { try { return localStorage.getItem('valesta-map-big') === '1'; } catch (e) { return false; } })();
  let storageWarned = false;
  let uiLang = 'it';
  let logoTarget = 'logoLight';
  let lastFit = {};
  let robCache = { key: '', value: null };
  let storeOk = false;
  let archiveList = [];
  let mapView = null;            // interactive map of the location card (MapView)
  const geoUi = { panel: null, results: null, target: null, after: null, crs: '', view: null, focusPoi: null };
  const GEO_KEY = 'valesta-geocoder';  // address search service chosen on this device
  const TILES_KEY = 'valesta-maptiles'; // tile address set by the user
  const MAPS_KEY = 'valesta-maps-consent'; // outside map tiles allowed on this device (with the date)
  const GEODATA_KEY = 'valesta-geodata';   // public geodata services for the assistant (with the date)
  const NOTICE_KEY = 'valesta-privacy-notice'; // the privacy window of the first start was answered (date): not shown again
  const hist = { undo: [], redo: [], last: null, timer: null };
  const LIVE = { on: false, version: 0, timer: null, pushTimer: null, pushing: false, failures: 0 };
  const CURRENT_KEY = 'valesta-current';
  const EXAMPLE_ID = 'vexampledemo01';
  const VERSION = '1.0';
  const PROFILE_KEY = 'valesta-profiles';
  const DEFAULT_PROFILE_KEY = 'valesta-default-profile';
  let myProfiles = [];
  // Native shell (Capacitor, Android / iOS): files go through the share sheet, printing through the native print service.
  const CAP = window.Capacitor;
  const NATIVE = !!(CAP && typeof CAP.isNativePlatform === 'function' && CAP.isNativePlatform());
  const nativePlugin = (name) => { if (!CAP) return null; try { return (CAP.Plugins && CAP.Plugins[name]) || (CAP.registerPlugin ? CAP.registerPlugin(name) : null); } catch (e) { return null; } };

  // ---------- i18n ----------
  // A text missing in the language of the app is shown in English.
  const tRaw = (k) => { const v = (UI_I18N[uiLang] || UI_I18N.en)[k]; return v == null ? (UI_I18N.en[k] == null ? k : UI_I18N.en[k]) : v; };
  // ¤ in UI strings stands for the currency of the valuation.
  const curText = (x) => (typeof x === 'string' && x.includes('¤') ? I18N.withCurrency(x) : x);
  const t = (k) => { const v = tRaw(k); return typeof v === 'function' ? (...a) => curText(v(...a)) : curText(v); };
  const RL = () => (state && state.meta && state.meta.reportLang) || 'es';
  const N = (v, d) => I18N.fmt(v, d || 0, uiLang);
  const EUR = (v) => I18N.money(v, uiLang);
  const CURS = () => I18N.sym();
  const ENERGY = [['', '—'], ['A', 'A'], ['B', 'B'], ['C', 'C'], ['D', 'D'], ['E', 'E'], ['F', 'F'], ['G', 'G']];
  const orientOpts = () => ['', 'N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO', 'TODAS'].map((k) => [k, t('orient')[k]]);
  const floorOpts = () => [['', t('nd')], [0, t('floorsGround')]].concat(Array.from({ length: 15 }, (_, i) => [i + 1, t('floorsN')(i + 1)]));
  const conditionOpts = () => Object.keys(MCA.CONDITIONS).map((k) => [k, L3(MCA.CONDITIONS[k])]);
  const sourceOpts = () => Object.keys(MCA.SOURCES).map((k) => [k, L3(MCA.SOURCES[k])]);
  const levelOpts = () => MCA.LEVELS.map((l) => [l.v, `${l.short}  ${L3(l)}`]);
  // Factor names: Italian, English and Spanish are in the factor; the other languages from the report language packs.
  const factorLabel = (f) => {
    const base = MCA.FACTORS.find((x) => x.id === f.id) || {};
    const pack = window.REPORT_I18N && window.REPORT_I18N[uiLang];
    const tr = pack && pack.engine && pack.engine.factors && pack.engine.factors[f.id];
    return f['label_' + uiLang] || base['label_' + uiLang] || (tr && tr[0]) || f.label_en || base.label_en || f.label_it || f.label_es;
  };

  // ---------- storage ----------
  function storage() { try { return window.localStorage; } catch (e) { return null; } }
  const record = () => ({
    id: AppCore.ensureId(state), updated: new Date().toISOString(), title: [state.subject.address, state.subject.floorDoor].filter(Boolean).join(' · ') || t('newDoc'),
    municipality: state.subject.municipality || '', value: res ? res.total : null, reportLang: RL(), brand: state.brand && state.brand.name, ref: state.meta.reportNo || '', country: state.meta.country || '', state,
  });
  function saveNow() {
    AppCore.ensureId(state);
    try { localStorage.setItem(CURRENT_KEY, state.meta.id); } catch (e) { /* ignore */ }
    const archived = storeOk ? ValestaStore.put(record()).then(() => true, () => false) : Promise.resolve(false);
    return archived.then((ok) => {
      const saved = AppCore.saveLocal(storage(), STORE_KEY, ok ? Object.assign({}, state, { photos: [], attachments: [] }) : state);
      if (!ok && !saved && !storageWarned) { storageWarned = true; toast(t('toastStorage')); }
      return ok || saved;
    });
  }
  const scheduleSave = debounce(saveNow, 800);

  // ---------- toast ----------
  let toastTimer;
  function toast(msg, actions, ms) {
    const el = $('#toast');
    el.innerHTML = `<span>${esc(msg)}</span>` + (actions || []).map((a, i) => `<button data-ti="${i}">${esc(a[0])}</button>`).join('');
    (actions || []).forEach((a, i) => { el.querySelector(`[data-ti="${i}"]`).onclick = () => { el.classList.remove('show'); a[1](); }; });
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), ms || (actions && actions.length ? 9000 : 4200));
  }

  // ---------- field builders ----------
  const get = (p) => AppCore.getPath(state, p);
  const fmtIn = (v) => (v == null || v === '' ? '' : typeof v === 'number' ? String(v).replace('.', ',') : String(v));
  const cls = (o) => (o && o.cls ? ' ' + o.cls : '');
  const langTag = () => `<i class="lt" title="${esc(t('langBadge')(RL().toUpperCase()))}">${RL().toUpperCase()}</i>`;
  function fText(p, label, o) {
    o = o || {};
    return `<label class="fld${cls(o)}"><span>${esc(label)}</span><input type="text" data-bind="${p}" data-kind="text" value="${esc(get(p) == null ? '' : get(p))}"${o.ph ? ` placeholder="${esc(o.ph)}"` : ''}${o.type ? ` inputmode="${o.type}"` : ''}></label>`;
  }
  function fLText(p, label, o) {
    o = o || {};
    // o.exact: show only the text of the report language (no fallback to another language), as for the cover texts.
    const raw = get(p);
    const v = o.exact ? (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw[RL()] || raw._ || '' : raw || '') : I18N.loc(raw, RL());
    const kind = o.exact ? 'ltextx' : 'ltext';
    if (o.area) return `<label class="fld${cls(o)}"><span>${esc(label)} ${langTag()}</span><textarea data-bind="${p}" data-kind="${kind}" rows="${o.rows || 3}"${o.ph ? ` placeholder="${esc(o.ph)}"` : ''}>${esc(v)}</textarea></label>`;
    return `<label class="fld${cls(o)}"><span>${esc(label)} ${langTag()}</span><input type="text" data-bind="${p}" data-kind="${kind}" value="${esc(v)}"${o.ph ? ` placeholder="${esc(o.ph)}"` : ''}></label>`;
  }
  function fNum(p, label, o) {
    o = o || {};
    return `<label class="fld${cls(o)}"><span>${esc(label)}</span><span class="unit"><input type="text" inputmode="decimal" data-bind="${p}" data-kind="${o.int ? 'int' : 'num'}" value="${esc(fmtIn(get(p)))}"${o.ph ? ` placeholder="${esc(o.ph)}"` : ''}>${o.unit ? `<em>${esc(o.unit)}</em>` : ''}</span></label>`;
  }
  function fPct(p, label, o) {
    o = o || {};
    const v = get(p);
    return `<label class="fld${cls(o)}"><span>${esc(label)}</span><span class="unit"><input type="text" inputmode="decimal" data-bind="${p}" data-kind="pct" value="${esc(v == null ? '' : fmtIn(Math.round(v * 10000) / 100))}"><em>%</em></span></label>`;
  }
  function fDate(p, label, o) {
    return `<label class="fld${cls(o)}"><span>${esc(label)}</span><input type="date" data-bind="${p}" data-kind="text" value="${esc(get(p) || '')}"></label>`;
  }
  function fSel(p, label, opts, o) {
    o = o || {};
    const v = get(p);
    const numeric = opts.some((x) => typeof x[0] === 'number');
    return `<label class="fld${cls(o)}"><span>${esc(label)}</span><select data-bind="${p}" data-kind="${numeric ? 'seln' : 'text'}">` +
      opts.map((x) => `<option value="${esc(x[0])}"${String(x[0]) === String(v == null ? '' : v) ? ' selected' : ''}>${esc(x[1])}</option>`).join('') + '</select></label>';
  }
  // def: value shown when the field was never set (e.g. cover blocks shown by default)
  const fChk = (p, label, def) => `<label class="chk"><input type="checkbox" data-bind="${p}" data-kind="bool"${(get(p) === undefined ? def : get(p)) ? ' checked' : ''}><span>${esc(label)}</span></label>`;
  function fArea(p, label, o) {
    o = o || {};
    return `<label class="fld${cls(o)}"><span>${esc(label)}</span><textarea data-bind="${p}" data-kind="text" rows="${o.rows || 3}">${esc(get(p) || '')}</textarea></label>`;
  }
  function fColor(p, label) {
    const v = get(p) || '#365C76';
    return `<label class="fld"><span>${esc(label)}</span><span class="color"><input type="color" data-bind="${p}" data-kind="color" value="${esc(v)}"><input type="text" data-bind="${p}" data-kind="hex" value="${esc(v)}" maxlength="7"></span></label>`;
  }
  const card = (title, body, sub, extra) => `<section class="card"><h3>${esc(title)}${sub ? ` <span class="sub">${esc(sub)}</span>` : ''}<span class="grow"></span>${extra || ''}</h3>${body}</section>`;
  const btn = (action, label, o) => `<button type="button" class="btn btn-sm${o && o.cls ? ' ' + o.cls : ''}" data-action="${action}"${o && o.i != null ? ` data-i="${o.i}"` : ''}${o && o.id ? ` data-id="${esc(o.id)}"` : ''}${o && o.key ? ` data-key="${esc(o.key)}"` : ''}${o && o.title ? ` title="${esc(o.title)}" aria-label="${esc(o.title)}"` : ''}>${label}</button>`;

  // ---------- chrome (topbar, menu, tabs) ----------
  // ---------- icons (interface v2) ----------
  const ICONS = {
    home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>',
    store: '<path d="M3 9l1.5-5h15L21 9"/><path d="M4 9v11h16V9"/><path d="M3 9h18"/><path d="M9 20v-6h6v6"/>',
    box: '<path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 7v10l9 4 9-4V7"/><path d="M12 11v10"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2"/><path d="M3 13h18"/>',
    factory: '<path d="M3 20V10l6 4V10l6 4V5h6v15z"/><path d="M7 17h2M12 17h2"/>',
    bed: '<path d="M3 19V7"/><path d="M3 14h18v5"/><path d="M21 14v-2a3 3 0 00-3-3h-7v5"/><circle cx="7" cy="11" r="2"/>',
    land: '<path d="M3 19l6-8 4 5 3-4 5 7z"/><circle cx="17" cy="6.5" r="2"/>',
    car: '<path d="M5 15l1.6-5h10.8L19 15"/><rect x="3" y="15" width="18" height="4" rx="1.5"/><path d="M7 19v1.5M17 19v1.5"/>',
    star: '<path d="M12 3l2.6 5.5 6 .8-4.4 4.2 1.1 6L12 16.6 6.7 19.5l1.1-6L3.4 9.3l6-.8z"/>',
    pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 0114 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    upload: '<path d="M12 16V4"/><path d="M7 9l5-5 5 5"/><path d="M4 16v4h16v-4"/>',
    file: '<path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4"/><path d="M9 12h6M9 16h6"/>',
    play: '<circle cx="12" cy="12" r="9"/><path d="M10 8.5l5 3.5-5 3.5z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7z"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4"/><path d="M12 17.3v.2"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 010 18 14 14 0 010-18z"/>',
    download: '<path d="M12 4v11"/><path d="M7 10.5l5 5 5-5"/><path d="M4 20h16"/>',
    link: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>',
    db: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/><path d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3"/>',
    chev: '<path d="M9 6l6 6-6 6"/>',
    map: '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
    chart: '<path d="M4 20V11M10 20V5M16 20v-6M2 20h20"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    panel: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M14 4v16"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    share: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.3 10.8l7.4-3.6M8.3 13.2l7.4 3.6"/>',
    code: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
    trash: '<path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13"/><path d="M9 7V4h6v3"/>',
    fitw: '<path d="M3 12h18"/><path d="M7 8l-4 4 4 4M17 8l4 4-4 4"/>',
    fitp: '<rect x="6" y="3" width="12" height="18" rx="1.5"/><path d="M9 8h6M9 12h6M9 16h4"/>',
    target: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3"/>',
    expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    shrink: '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>',
  };
  const ic = (n) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`;
  const langName = (l) => (I18N.LANG_NAMES && I18N.LANG_NAMES[l]) || String(l).toUpperCase();
  const drawerMode = () => window.matchMedia('(max-width: 1240px)').matches;
  const phoneMode = () => window.matchMedia('(max-width: 760px)').matches;
  // A label of the modules ({ it, en, es } object) in the language of the app; other languages from the packs.
  const L3 = (o) => (!o ? '' : typeof o === 'string' ? o : UI_I18N.text(o, uiLang));
  // Redrawing a part of the page must not lose the keyboard focus: the element with the same id or data-* keys gets it
  // back, with the caret where it was.
  const FOCUS_KEYS = ['bind', 'action', 'step', 'ctx', 'key', 'i', 'kind', 'f'];
  function focusKey(scope) {
    const el = document.activeElement;
    if (!el || el === document.body || !scope || !scope.contains(el)) return null;
    const ds = el.dataset || {};
    const attrs = FOCUS_KEYS.filter((k) => ds[k] != null).map((k) => `[data-${k}="${CSS.escape(ds[k])}"]`).join('');
    const sel = el.id ? `#${CSS.escape(el.id)}` : attrs ? el.tagName.toLowerCase() + attrs : null;
    if (!sel) return null;
    return { sel, caret: typeof el.selectionStart === 'number' ? [el.selectionStart, el.selectionEnd] : null };
  }
  function restoreFocus(k, scope) {
    if (!k || !scope) return;
    const el = scope.querySelector(k.sel);
    if (!el || el === document.activeElement) return;
    el.focus({ preventScroll: true });
    if (k.caret && typeof el.setSelectionRange === 'function') { try { el.setSelectionRange(k.caret[0], k.caret[1]); } catch (e) { /* not a text field */ } }
  }

  function renderChrome() {
    document.documentElement.lang = uiLang;
    document.title = t('docTitle');
    const labels = { new: ['bNew', 'tNew'], open: ['bOpen', 'tOpen'], save: ['bSave', 'tSave'], 'export-html': ['bHtml', 'tHtml'], print: ['bPdf', 'tPdf'],
      undo: ['bUndo', 'tUndo'], redo: ['bRedo', 'tRedo'], archive: ['bArchive', 'tArchive'], share: ['bShare', 'tShare'],
      privacy: ['bPrivacy', 'tPrivacy'], 'profile-export': ['profileExport', 'profileHint'], 'profile-import': ['profileImport', 'profileHint'], 'zoom-in': ['zoomIn', 'zoomIn'], 'zoom-out': ['zoomOut', 'zoomOut'],
      'layout-reset': ['layoutReset', 'layoutReset'] };
    $$('#menu [data-action], .top [data-action], .pv-toolbar [data-action]').forEach((b) => {
      const l = labels[b.dataset.action];
      if (!l) return;
      $$('.lbl', b).forEach((sp) => { sp.textContent = t(l[0]); });
      b.title = t(l[1]);
      b.setAttribute('aria-label', t(l[0]));
    });
    $('#menu-btn').title = t('bMenu');
    $('#menu-btn').setAttribute('aria-label', t('bMenu'));
    [['#menu-title-file', 'menuFile'], ['#menu-title-profile', 'profileT'], ['#menu-title-lang', 'langBoth'], ['#menu-lang-hint', 'langMenuHint'],
      ['#menu-title-report', 'reportOnly'], ['#menu-title-ui', 'appOnly']]
      .forEach(([sel, k]) => { const el = $(sel); if (el) el.textContent = t(k); });
    if (window.ValestaSupport) window.ValestaSupport.relabel(); // Help: support the project, send feedback
    // Version, with the date of the build and the commit of the code ("+": changes not committed), set by build.py.
    const bi = window.VALESTA_BUILD;
    const ver = $('#menu-version');
    ver.textContent = bi && bi.time ? t('versionBuilt')(VERSION, fmtDate(bi.time)) + (bi.commit ? ` · ${bi.commit}${bi.dirty ? '+' : ''}` : '') : `${t('version')} ${VERSION}`;
    ver.title = bi && bi.dirty ? t('buildDirty') : '';
    $('#live-badge').title = t('liveOn');
    $('#m-share').hidden = !(NATIVE || (navigator.canShare && typeof File === 'function'));
    // Menu: app and report together, the app only, the report only; each button opens the list of the 17 languages.
    [['both', uiLang, 'langBoth'], ['ui', uiLang, 'uiLang'], ['report', RL(), 'reportLang']].forEach(([key, l, k]) => {
      const b = $(`#menu [data-action="pop-lang"][data-key="${key}"]`);
      if (!b) return;
      $('.cc', b).textContent = l.toUpperCase();
      $('.lbl', b).textContent = langName(l) + (key === 'both' && RL() !== uiLang ? ` · ${RL().toUpperCase()}` : '');
      b.setAttribute('aria-label', `${t(k)}: ${langName(l)}`);
    });
    // shell v2
    $('#brand-link').setAttribute('aria-label', `Valesta · ${t('crumbHome')}`);
    $('#crumbs').setAttribute('aria-label', t('crumbHome'));
    $('#cmd-ico').innerHTML = ic('search');
    $('#cmd-ph').textContent = t('cmdPh');
    $('#cmd-btn').setAttribute('aria-label', `${t('cmdPh')} (Ctrl K)`);
    $('#cmd-btn').dataset.tip = `${t('cmdPh')} · Ctrl K`;
    $('#export-ico').innerHTML = ic('download');
    $('#export-lbl').textContent = t('bExport');
    $('#tb-export').title = t('tExport');
    $('#tb-export').setAttribute('aria-label', t('bExport'));
    $('#ctx-toggle').innerHTML = ic('panel');
    $('#ctx-toggle').title = t('tPanel');
    $('#ctx-toggle').setAttribute('aria-label', t('tPanel'));
    // The assistant has its own entry, apart from the search: it opens the AI tab of the panel.
    $('#ai-ico').innerHTML = ic('sparkle');
    $('#ai-lbl').textContent = t('ctxAI');
    $('#tb-ai').setAttribute('aria-label', t('aiBtn'));
    $('#tb-ai').dataset.tip = t('aiBtn');
    $('#ctx-close').setAttribute('aria-label', t('bClose'));
    $('#ctx').setAttribute('aria-label', t('tPanel'));
    $('#side').setAttribute('aria-label', Workflow.PHASES.map((p) => Workflow.phaseLabel(p.id, uiLang)).join(' · '));
    paintFullBtn(document.body.classList.contains('pv-full'));
    // Preview tools: icons with their name (accessible name and tooltip).
    [['#pv-fitw', 'pvFitW', 'fitw'], ['#pv-fitp', 'pvFitP', 'fitp'], ['#pv-chap', 'pvChapters', 'list'], ['#pv-follow', 'pvFollow', 'target']].forEach(([sel, k, icon]) => {
      const b = $(sel);
      if (!b) return;
      b.innerHTML = ic(icon);
      b.setAttribute('aria-label', t(k));
      b.dataset.tip = sel === '#pv-follow' ? `${t(k)} · ${t('pvFollowT')}` : t(k);
    });
    paintPvTools();
    $('#pal-ico').innerHTML = ic('search');
    $('#pal-input').placeholder = t('palPh');
    $('#pal-input').setAttribute('aria-label', t('palPh'));
    $('#pal-dlg').setAttribute('aria-label', t('cmdPh'));
    $('#pal-foot').innerHTML = `<span><kbd>↑</kbd> <kbd>↓</kbd> ${esc(t('palNav'))}</span><span><kbd>↵</kbd> ${esc(t('palRun'))}</span><span><kbd>Esc</kbd> ${esc(t('palEsc'))}</span>`;
    $('#bottomnav').setAttribute('aria-label', $('#side').getAttribute('aria-label'));
    $('#bottomnav').innerHTML = Workflow.PHASES.map((p) => `<button type="button" data-phase="${p.id}">${ic(p.icon)}<span>${esc(Workflow.phaseLabel(p.id, uiLang))}</span></button>`).join('') +
      `<button type="button" class="ai" data-action="assistant">${ic('sparkle')}<span>${esc(t('ctxAI'))}</span></button>`;
    updateUndoButtons();
    renderCtxTabs();
  }

  // ---------- context panel (preview, AI, checks) ----------
  function renderCtxTabs() {
    const n = flow ? flow.issues.length : 0;
    $('#ctx-t-preview').innerHTML = `${ic('eye')}${esc(t('ctxPreview'))}`;
    const nAi = AIReview.counts(state && state.aiLog).open;
    $('#ctx-t-ai').innerHTML = `${ic('sparkle')}${esc(t('ctxAI'))}${nAi ? ` <span class="cnt ai">${nAi}</span>` : ''}`;
    $('#ctx-t-issues').innerHTML = `${ic('alert')}${esc(t('ctxIssues'))}${n ? ` <span class="cnt warn">${n}</span>` : ''}`;
    $$('#ctx-tabs [data-ctx]').forEach((b) => { const on = b.dataset.ctx === ctxTab; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); });
  }
  function setCtx(tab, open) {
    const before = ctxTab;
    ctxTab = ['preview', 'ai', 'issues'].includes(tab) ? tab : 'preview';
    $('#preview-pane').hidden = ctxTab !== 'preview';
    $('#pane-ai').hidden = ctxTab !== 'ai';
    $('#pane-issues').hidden = ctxTab !== 'issues';
    // Another tab of the panel: its content fades in (app.css), the ink of the tabs slides to it (motion.js).
    if (before !== ctxTab) replay($({ preview: '#preview-pane', ai: '#pane-ai', issues: '#pane-issues' }[ctxTab]), 'pane-enter');
    renderCtxTabs();
    if (ctxTab === 'issues') renderIssues();
    if (ctxTab === 'preview') requestAnimationFrame(applyZoom);
    if (open) $('#ctx').classList.add('open');
  }
  function toggleCtx() {
    const c = $('#ctx');
    if (document.body.classList.contains('pv-full')) return setFullPreview(false);
    c.classList.toggle('open');
    if (c.classList.contains('open') && ctxTab === 'preview') requestAnimationFrame(applyZoom);
  }
  function setFullPreview(on) {
    document.body.classList.toggle('pv-full', !!on);
    if (on) setCtx('preview');
    paintFullBtn(on);
    requestAnimationFrame(applyZoom);
  }
  function renderIssues() {
    const el = $('#pane-issues');
    if (!el || !flow) return;
    el.innerHTML = flow.issues.length ? flow.issues.map((x, i) => `<div class="iss ${x.level}">${ic('alert')}<div><b>${esc(L3(x.title))}</b>${L3(x.detail) ? `<p>${esc(L3(x.detail))}</p>` : ''}</div>
      <div class="iss-a"><button type="button" class="link" data-action="iss-go" data-i="${i}">${esc(t('issGo'))} · ${esc(Workflow.stepLabel(x.step, uiLang))}</button>${window.ValestaAI ? `<button type="button" class="link ai" data-action="iss-fix" data-i="${i}">${esc(t('issFix'))}</button>` : ''}</div></div>`).join('')
      : `<div class="iss ok">${ic('check')}<div><b>${esc(t('issNone'))}</b></div></div>`;
  }
  // The preview follows the step, unless "follow the step" is off: it scrolls to the report page linked to it.
  function syncPreview() {
    if (!pvFollow || ctxTab !== 'preview' || screen !== 'step') return;
    const a = Workflow.STEPS[step] && Workflow.STEPS[step].anchor;
    const el = a === 'cover' ? $('#report .page--cover') : a ? $('#sec-' + a) : null;
    const page = el && el.closest('.page');
    if (!page) return;
    const sc = $('#pv-scroll');
    sc.scrollTop += page.getBoundingClientRect().top - sc.getBoundingClientRect().top - 12;
    page.classList.add('hl');
    setTimeout(() => page.classList.remove('hl'), 1200);
  }

  // ---------- popovers: country, property type, language, purpose ----------
  function openPop(kind, anchor, mode) {
    const pop = $('#pop');
    const T = Taxonomy;
    const cur = (state.subject.propertyType || {}).code;
    let html = '';
    if (kind === 'country') {
      html = `<div class="pop-h">${esc(t('tCountry'))}</div>` + T.countries(uiLang).map((c) => `<button type="button" class="pop-i${c.code === state.meta.country ? ' on' : ''}" role="option" data-action="set-country" data-key="${c.code}"><span class="cc">${c.code}</span><span>${esc(T.countryName(c.code, uiLang))}</span><span class="r">${c.currency}</span></button>`).join('');
    } else if (kind === 'lang') {
      // The 17 languages, for app and report together (both), the app only (ui) or the report only (report).
      const m = { both: ['langBoth', 'set-lang', 'data-lang', uiLang], ui: ['uiLang', 'set-ul', 'data-ul', uiLang], report: ['reportLang', 'set-rl', 'data-rl', RL()] }[mode] || [];
      const [title, action, attr, cur] = m.length ? m : ['langBoth', 'set-lang', 'data-lang', uiLang];
      html = `<div class="pop-h">${esc(t(title))}</div>` + AppCore.langsByName(uiLang).map((l) => `<button type="button" class="pop-i${l === cur ? ' on' : ''}" role="option" data-action="${action}" ${attr}="${l}"><span class="cc">${l.toUpperCase()}</span><span>${esc(langName(l))}</span></button>`).join('');
    } else if (kind === 'type') {
      html = T.CATEGORIES.map((c) => `<div class="pop-h">${esc(L3(c.label))}</div>` + T.typesOf(c.id).map((x) => `<button type="button" class="pop-i${x.code === cur ? ' on' : ''}" role="option" data-action="set-type" data-key="${x.code}">${ic(c.icon)}<span>${esc(L3(x.label))}</span></button>`).join('')).join('');
    } else if (kind === 'purpose') {
      html = `<div class="pop-h">${esc(t('purposeLabel'))}</div>` + T.PURPOSES.map((p) => `<button type="button" class="pop-i${p.code === state.meta.purposeCode ? ' on' : ''}" role="option" data-action="set-purpose" data-key="${p.code}"><span>${esc(L3(p.label))}</span></button>`).join('');
    }
    if (kind === 'chapters') {
      // Chapters of the report as drawn in the preview: number and title of each section (continuation pages left out).
      const secs = $$('#report .sec-head[id^="sec-"]');
      html = `<div class="pop-h">${esc(t('pvChapters'))}</div>` + (secs.length ? secs.map((h) => `<button type="button" class="pop-i" role="option" data-action="pv-goto" data-key="${esc(h.id)}"><span class="cc">${esc(((h.querySelector('.sec-num') || {}).textContent || '').trim())}</span><span>${esc(((h.querySelector('.sec-title') || h).textContent || '').trim())}</span></button>`).join('')
        : '<p class="hint" style="margin:6px 10px">—</p>');
    }
    pop.innerHTML = html;
    pop.setAttribute('role', 'listbox');
    const r = anchor.getBoundingClientRect();
    pop.style.left = Math.max(8, Math.min(r.left, window.innerWidth - 308)) + 'px';
    pop.style.top = Math.max(8, Math.min(r.bottom + 6, window.innerHeight - 240)) + 'px';
    pop.style.maxHeight = Math.max(200, window.innerHeight - Math.min(r.bottom + 6, window.innerHeight - 240) - 16) + 'px';
    pop.hidden = false;
    const f = $('.pop-i.on', pop) || $('.pop-i', pop);
    if (f) { f.focus(); f.scrollIntoView({ block: 'nearest' }); }
  }
  const closePop = () => { const p = $('#pop'); if (p && !p.hidden) p.hidden = true; };

  // ---------- command bar ----------
  function openPalette(q) {
    $('#palette').hidden = false;
    const inp = $('#pal-input');
    inp.value = q || '';
    renderPal(inp.value);
    inp.focus();
  }
  function closePalette() { if (!$('#palette').hidden) $('#palette').hidden = true; }
  function renderPal(q) {
    const share = NATIVE || (navigator.canShare && typeof File === 'function');
    palItems = Workflow.commands(q, uiLang).filter((x) => (x.ai ? !!window.ValestaAI : true) && (x.id !== 'act:share' || share));
    palIdx = 0;
    paintPal();
  }
  function paintPal() {
    const G = t('palGroups');
    const groups = Array.from(new Set(palItems.map((x) => x.group)));
    $('#pal-list').innerHTML = palItems.length ? groups.map((g) => `<div class="pg">${esc(G[g] || g)}</div>` + palItems.map((it, i) => (it.group !== g ? '' :
      `<button type="button" class="pi${i === palIdx ? ' on' : ''}${it.ai ? ' is-ai' : ''}" role="option" aria-selected="${i === palIdx}" data-pi="${i}">${ic(it.ai ? 'sparkle' : it.group === 'export' ? 'download' : it.group === 'go' ? 'chev' : 'check')}<span>${esc(it.label)}</span>${it.hint ? `<small>${esc(it.hint)}</small>` : ''}</button>`)).join('')).join('')
      : `<div class="pg">${esc(t('palNone'))}</div>`;
  }
  function runCmd(it) {
    if (!it) return;
    closePalette();
    const [kind, key] = it.id.split(':');
    if (kind === 'go') return key === 'home' ? goHome() : key === 'new' ? goStart() : goStep(key);
    if (kind === 'act') {
      if (key === 'save') return saveProject();
      if (key === 'open') return $('#file-open').click();
      if (key === 'undo') return undo();
      if (key === 'redo') return redo();
      if (key === 'preview') return setFullPreview(true);
      if (key === 'export-pdf') return printPdf();
      if (key === 'export-html') return exportHtml();
      if (key.startsWith('lang-')) return setLangBoth(key.slice(5));
    }
    if (kind === 'ai' && window.ValestaAI) window.ValestaAI.ask(it.text);
  }
  function setLangBoth(l) {
    l = I18N.LANGS.includes(l) ? l : 'en';
    uiLang = l;
    try { localStorage.setItem(UILANG_KEY, uiLang); } catch (e) { /* ignore */ }
    state.meta.reportLang = l;
    renderChrome();
    if (window.ValestaAI) window.ValestaAI.relabel();
    changed(true);
  }

  // ---------- sidebar: phases and steps ----------
  // State of a step for the interface, from Workflow.stepStatus (unchanged): a step with open checks shows them, even when
  // it is optional; "warn" without checks means started, with essentials still missing. Each state has its own shape.
  const ST_SVG = {
    ok: '<circle cx="8" cy="8" r="7" class="f"/><path d="M4.9 8.3l2.1 2.1 4.1-4.5" class="k"/>',
    part: '<circle cx="8" cy="8" r="6.2" class="o"/><path d="M8 1.8a6.2 6.2 0 010 12.4z" class="f"/>',
    warn: '<path d="M8 1.6l6.9 12.3H1.1z" class="f"/><path d="M8 6.3v3.4M8 11.7v.1" class="k"/>',
    todo: '<circle cx="8" cy="8" r="6.2" class="o"/>',
    opt: '<circle cx="8" cy="8" r="6.2" class="o d"/>',
  };
  function stepState(id) {
    const x = flow && flow.byStep[id];
    if (!x) return 'todo';
    if (x.issues > 0) return 'warn';
    return x.status === 'warn' ? 'part' : x.status;
  }
  const stepIcon = (id) => { const s = stepState(id); return `<svg class="st st-${s}" viewBox="0 0 16 16" aria-hidden="true">${ST_SVG[s] || ST_SVG.todo}</svg>`; };
  function renderSide() {
    const f = flow;
    const st = (id) => (f ? f.byStep[id] : { status: 'todo', badge: '', issues: 0 });
    const aiSteps = new Set(Array.from(AIReview.openPaths(state && state.aiLog)).map(Workflow.stepForPath));
    const nIss = f ? f.issues.length : 0;
    const comp = f ? f.completeness : 0;
    const comps = (res && res.comps) || [];
    const keep = focusKey($('#side'));
    $('#side').innerHTML = `<button type="button" class="btn newval" data-action="new">${ic('plus')}${esc(t('newValuation'))}</button>` +
      Workflow.PHASES.map((p, n) => {
        const ph = f && f.phases[p.id];
        // "2/4": steps complete without open checks, out of the steps of the phase.
        const count = ph ? `<span class="phd-c" title="${esc(t('phaseDone')(ph.done, ph.of))}"><span aria-hidden="true">${ph.done}/${ph.of}</span><span class="sr-only">${esc(t('phaseDone')(ph.done, ph.of))}</span></span>` : '';
        return `<div class="phase"><div class="phd"><span class="phd-n">${n + 1}</span><span class="phd-l">${esc(Workflow.phaseLabel(p.id, uiLang))}</span>${count}</div>` +
        p.steps.map((id) => {
          const x = st(id);
          const s = stepState(id);
          const on = screen === 'step' && id === step;
          const used = comps.filter((c) => c && c.include).length;
          const badge = !x.badge ? '' : id === 'comps' && comps.length
            ? `<span class="sbadge" title="${esc(t('compsCount')(comps.length, used))}">${esc(x.badge)}</span>`
            : `<span class="sbadge warn" title="${esc(t('vsOpen')(x.issues))}"><span aria-hidden="true">${esc(x.badge)}</span><span class="sr-only">${esc(t('vsOpen')(x.issues))}</span></span>`;
          return `<button type="button" class="step${on ? ' on' : ''}" data-step="${id}"${on ? ' aria-current="step"' : ''}>${stepIcon(id)}<span class="step-l">${esc(Workflow.stepLabel(id, uiLang))}</span><span class="sr-only"> (${esc(t('stLabel')[s] || '')})</span>${aiSteps.has(id) ? `<span class="sbadge ai" title="${esc(t('aiqToReview'))}">✦</span>` : ''}${badge}</button>`;
        }).join('') + '</div>';
      }).join('') +
      // Completeness counts the essentials filled in; the checks count the problems found: two measures, both always visible.
      `<div class="side-foot"><div class="prog-h${comp >= 100 ? ' full' : ''}"><span>${esc(comp >= 100 ? t('compFull') : t('compLabel'))}</span>${comp >= 100 ? ic('check') : `<b>${comp}%</b>`}</div>` +
      `<div class="prog-bar${comp >= 100 ? ' full' : ''}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${comp}" aria-label="${esc(t('compLabel'))}"><i style="width:${comp}%"></i></div>` +
      `<button type="button" class="side-checks${nIss ? ' has' : ''}" data-ctx="issues">${ic(nIss ? 'alert' : 'check')}<span>${esc(nIss ? t('vsOpen')(nIss) : t('vsClear'))}</span>${ic('chev')}</button></div>`;
    restoreFocus(keep, $('#side'));
    const ph = Workflow.phaseOf(step);
    $$('#bottomnav [data-phase]').forEach((b) => b.classList.toggle('on', screen === 'step' && !!ph && ph.id === b.dataset.phase));
  }
  function renderTabs() { renderSide(); }

  // ---------- AI review queue: the AI proposes, the professional decides ----------
  const PATH_LABELS = { 'subject.yearBuilt': 'year', 'subject.areaBuilt': 'built', 'subject.areaBuiltCommon': 'builtCommon', 'subject.address': 'address',
    'subject.municipality': 'town', 'subject.condition': 'condition', 'subject.bedrooms': 'bedrooms', 'subject.bathrooms': 'bathrooms', 'subject.floor': 'floor',
    'subject.energyCert': 'energy', 'subject.type': 'type', 'subject.zone': 'zone', 'subject.postalCode': 'postal', 'subject.province': 'province', 'subject.lat': 'lat',
    'subject.lon': 'lon', 'subject.cadastralRef': 'cadRef', 'subject.locationDesc': 'locationDesc', 'subject.environmentDesc': 'environmentDesc', 'subject.buildingDesc': 'buildingDesc',
    'subject.rooms': 'cRooms', 'meta.visitDate': 'visitDate', 'meta.valuationDate': 'valDate', 'meta.reportDate': 'reportDate', 'meta.reportNo': 'reportNo',
    'meta.purpose': 'purpose', 'meta.client.name': 'clientName', 'meta.advisor.name': 'advisorName', 'market.cityAvg': 'cityAvg', 'market.source': 'source',
    'market.month': 'month', 'market.yoy': 'yoy', 'market.series': 'cSeries', 'market.districts': 'cDistricts', 'market.references': 'cRefs', 'settings.negotiationDefault': 'negotiation' };
  const clip = (x) => (x.length > 70 ? x.slice(0, 67) + '…' : x);
  function pathLabel(c) {
    if (/^comp-/.test(c.kind)) return `${t('tabs').comparabili} ${c.id}`;
    if (/^texts\./.test(c.path)) return (t('texts') || {})[c.path.slice(6)] || c.path.slice(6);
    const k = PATH_LABELS[c.path];
    const l = k && UI_I18N[uiLang] && UI_I18N[uiLang][k];
    if (typeof l === 'string') return curText(l);
    return c.path.split('.').pop().replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (x) => x.toUpperCase());
  }
  function valueText(v) {
    if (v === undefined || v === null || v === '') return '—';
    if (typeof v === 'boolean') return v ? '✓' : '✗';
    if (typeof v === 'number') return N(v, v % 1 ? 2 : 0);
    if (Array.isArray(v)) return t('aiqItems')(v.length);
    if (typeof v === 'object') return clip(I18N.loc(v, RL()) || '…');
    return clip(String(v));
  }
  function changeLine(c) {
    if (c.kind === 'comp-add') return `${esc(pathLabel(c))}: <b>${esc(t('aiqAdded'))}</b>`;
    if (c.kind === 'comp-remove') return `${esc(pathLabel(c))}: <b>${esc(t('aiqRemoved'))}</b>`;
    if (c.kind === 'comp-replace' || c.big) return `${esc(pathLabel(c))}: <b>${esc(t('aiqChanged'))}</b>`;
    const had = !(c.before === undefined || c.before === null || c.before === '');
    return `${esc(pathLabel(c))}: ${had ? `<s>${esc(valueText(c.before))}</s> → ` : ''}<b>${esc(valueText(c.after))}</b>`;
  }
  // Called by the assistant at the end of a turn that changed the valuation: the changes become a proposal to review.
  function aiProposal(info) {
    if (!info || !info.before) return;
    const changes = AIReview.diff(info.before, JSON.parse(JSON.stringify(Object.assign({}, state, { photos: [] }))));
    if (!changes.length) return;
    if (!Array.isArray(state.aiLog)) state.aiLog = [];
    state.aiLog.push(AIReview.entry({ request: info.request, summary: info.summary, sources: info.sources, provider: info.provider, model: info.model, changes }));
    changed(true);
  }
  function renderAiQueue() {
    const el = $('#ai-queue');
    if (!el) return;
    const log = Array.isArray(state && state.aiLog) ? state.aiLog : [];
    if (!log.length) { el.hidden = true; el.innerHTML = ''; return; }
    const open = log.filter((e) => e.status === 'open');
    const n = AIReview.counts(log);
    el.hidden = false;
    el.innerHTML = `<div class="aiq-h">${ic('sparkle')}<b>${esc(t('aiqTitle'))}</b>${open.length ? `<span class="cnt ai">${open.length}</span>` : ''}<span class="grow"></span>${open.length > 1 ? btn('aiq-accept-all', esc(t('aiqAcceptAll')), { cls: 'btn-primary' }) : ''}</div>` +
      (open.length ? open.slice().reverse().map((e) => {
        const ch = e.changes.filter((x) => x.state === 'open');
        return `<article class="aip"><div class="aip-h"><span>${esc(clip(e.request || e.summary || t('aiqProposal')))}</span><small>${esc(fmtDate(e.at))}</small></div>
          <ul class="aip-ch">${ch.slice(0, 6).map((x) => `<li>${changeLine(x)}</li>`).join('')}${ch.length > 6 ? `<li class="muted">${esc(t('aiqMore')(ch.length - 6))}</li>` : ''}</ul>
          ${e.sources.length ? `<div class="aip-src">${esc(t('aiqSources'))}: ${e.sources.slice(0, 3).map((x) => `<a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${esc(x.title || x.url)}</a>`).join(' · ')}</div>` : ''}
          <div class="aip-a">${btn('aiq-accept', esc(t('aiqAccept')), { id: e.id, cls: 'btn-primary' })}${btn('aiq-edit', esc(t('aiqEdit')), { id: e.id })}${btn('aiq-reject', esc(t('aiqReject')), { id: e.id })}</div></article>`;
      }).join('') : `<p class="hint aiq-none">${esc(t('aiqNone'))}</p>`) +
      `<div class="aiq-log">${esc(t('aiqLog')(n.accepted, n.rejected))}</div>`;
  }
  // Fields filled by the AI and not yet confirmed are marked until the proposal is accepted or the field is edited.
  function markAi() {
    AIReview.openPaths(state.aiLog).forEach((p) => {
      if (p.startsWith('comparables#')) { const d = $(`.comp[data-i="${state.comparables.findIndex((c) => String(c.id) === p.slice(12))}"]`); if (d) d.classList.add('is-ai'); return; }
      if (p.startsWith('texts.')) { const ta = $(`textarea[data-kind="textov"][data-key="${p.slice(6)}"]`); const blk = ta && ta.closest('.txt-block'); if (blk) blk.classList.add('is-ai'); return; }
      $$(`[data-bind="${p}"], [data-bind^="${p}."]`).forEach((el) => {
        const f = el.closest('.fld') || el.closest('td');
        if (!f || f.classList.contains('is-ai')) return;
        f.classList.add('is-ai');
        const lab = f.querySelector(':scope > span');
        if (lab) lab.insertAdjacentHTML('beforeend', `<em class="aitag">✦ ${esc(t('aiqToReview'))}</em>`);
      });
    });
  }
  function aiTouch(path, el) {
    if (!Array.isArray(state.aiLog) || !state.aiLog.length) return;
    const open = AIReview.openPaths(state.aiLog);
    if (!Array.from(open).some((x) => x === path || path.startsWith(x + '.'))) return;
    AIReview.touch(state.aiLog, path);
    const f = el && (el.closest('.fld') || el.closest('td') || el.closest('.txt-block'));
    if (f) { f.classList.remove('is-ai'); const tag = f.querySelector('.aitag'); if (tag) tag.remove(); }
    renderAiQueue();
    renderCtxTabs();
  }

  // ---------- main area: home, start screen or the current step ----------
  // Valesta supports the valuer and does not replace them: said on the Result and Delivery steps, never in the report.
  const toolNote = () => `<p class="tool-note" role="note">${esc(t('toolNote'))}</p>`;
  const STEP_RENDER = {
    identity: () => identityCard() + tabPratica(), features: () => tabImmobile(), areas: () => tabSuperfici(), photos: () => tabFoto(),
    comps: () => tabComparabili(), marketdata: () => tabMercato('data'), sources: () => tabMercato('sources'),
    adjust: () => tabOmog(), methods: () => tabMetodi(), result: () => tabRisultato() + toolNote(), checks: () => tabVerifiche() + qualityCard() + robustnessCard(),
    content: () => tabTesti() + tabDesign('content'), style: () => tabDesign('style') + tabAgenzia(true), deliver: () => tabConsegna() + toolNote(),
  };
  function stepHeader(id) {
    const pos = Workflow.position(id);
    const ph = Workflow.PHASES.find((p) => p.id === pos.phase);
    // Strip of the phase's steps: on phones, and on wider screens when the steps are a drawer (layout.js), whose button comes first.
    const navBtn = `<button type="button" class="strip-nav" data-nav-toggle aria-controls="side" aria-expanded="false" title="${esc(t('navStepsT'))}">${ic('list')}<span>${esc(t('navSteps'))}</span></button>`;
    const strip = `<nav class="step-strip" aria-label="${esc(Workflow.phaseLabel(pos.phase, uiLang))}">${navBtn}${ph.steps.map((x) => `<button type="button" data-step="${x}" class="${x === id ? 'on' : ''}"${x === id ? ' aria-current="step"' : ''}>${stepIcon(x)}${esc(Workflow.stepLabel(x, uiLang))}</button>`).join('')}</nav>`;
    return `${strip}<div class="v-head"><div class="kick">${esc(Workflow.phaseLabel(pos.phase, uiLang))} · ${esc(t('stepOf')(pos.n, pos.of))}</div><h1>${esc(Workflow.stepLabel(id, uiLang))}</h1><p class="vlead">${esc(t('stepLead')[id] || '')}</p></div>`;
  }
  function stepFooter(id) {
    const all = Workflow.PHASES.reduce((acc, p) => acc.concat(p.steps), []);
    const k = all.indexOf(id);
    const prev = all[k - 1];
    const next = all[k + 1];
    return `<div class="step-nav">${prev ? `<button type="button" class="btn" data-step="${prev}">← ${esc(Workflow.stepLabel(prev, uiLang))}</button>` : '<span></span>'}${next ? `<button type="button" class="btn btn-primary" data-step="${next}">${esc(Workflow.stepLabel(next, uiLang))} →</button>` : ''}</div>`;
  }
  function renderTab() {
    if (window.ValestaSupport) window.ValestaSupport.view(screen === 'step' ? step : screen);
    const body = $('#tab-body');
    const main = $('#main');
    const top = main.scrollTop;
    // The width of the workspace follows the task (app.css: forms, comparison and analysis). Not "data-step": that attribute
    // makes a click go to a step.
    body.dataset.view = screen === 'step' ? step : screen;
    if (screen === 'home') { body.innerHTML = homeView(); refreshTop(); loadHome(); return; }
    if (screen === 'start') { body.innerHTML = startView(); main.scrollTop = top; refreshTop(); return; }
    const keep = focusKey(body);
    body.innerHTML = stepHeader(step) + (STEP_RENDER[step] || STEP_RENDER.identity)() + stepFooter(step);
    main.scrollTop = top;
    stripToCurrent(body);
    mountLocationMap();
    refreshLive();
    markAi();
    restoreFocus(keep, body);
  }
  // The strip of the steps (phones, steps in a drawer) scrolls sideways at once, so that the current step shows whole,
  // also beside the "Steps" button, which stays at the start of the strip (app.css).
  function stripToCurrent(root) {
    const strip = root.querySelector('.step-strip');
    const cur = strip && strip.querySelector('[aria-current="step"]');
    if (!cur || strip.scrollWidth <= strip.clientWidth) return;
    const nav = strip.querySelector('.strip-nav');
    const s = strip.getBoundingClientRect(), c = cur.getBoundingClientRect();
    const start = nav && nav.offsetWidth ? nav.getBoundingClientRect().right + 6 : s.left;
    if (c.right > s.right) strip.scrollLeft += c.right - s.right + 16;
    else if (c.left < start) strip.scrollLeft -= start - c.left + 16;
  }
  // ---------- motion of the workspace (app.css: "A step change"; docs/motion-guidelines.md) ----------
  // An animation restarted on an element: the class goes, the element is laid out, the class comes back.
  function replay(el, cls) {
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }
  // The content moves only when the user moves: forward from the right, back from the left, other screens rise a
  // little. A redraw of the same step (typing, a check) never moves.
  function enter(kind) {
    const body = $('#tab-body');
    body.dataset.enter = kind;
    replay(body, 'entering');
  }
  function stepDir(from, to) {
    const all = Workflow.PHASES.reduce((acc, p) => acc.concat(p.steps), []);
    const d = all.indexOf(to) - all.indexOf(from);
    return !from || !d ? 'in' : d > 0 ? 'fwd' : 'back';
  }
  function goStep(id, path) {
    const x = Workflow.stepForTab(id) || 'identity';
    const moved = screen !== 'step' || x !== step;
    const from = screen === 'step' ? step : null;
    screen = 'step';
    step = x;
    closePop();
    renderTab();
    if (moved) {
      $('#main').scrollTop = 0;
      syncPreview();
      enter(stepDir(from, x));
      // The chosen step of the sidebar settles in (its background and bar), once.
      requestAnimationFrame(() => { const s = $('#side .step.on'); if (s) s.classList.add('just'); });
    }
    if (phoneMode() || (drawerMode() && ctxTab !== 'ai')) $('#ctx').classList.remove('open');
    if (path) {
      const f = $(`[data-bind="${path}"]`);
      if (f) { f.scrollIntoView({ block: 'center' }); f.focus(); }
    } else if (moved && (!document.activeElement || document.activeElement === document.body)) {
      // A step opened from inside the page (the buttons at its foot) would leave the focus nowhere: it goes to the title.
      const h = $('.v-head h1');
      if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); }
    }
  }
  function goHome() {
    closePop();
    setFullPreview(false);
    screen = 'home';
    renderTab();
    $('#main').scrollTop = 0;
    enter('in');
  }

  // ---------- home: the valuations on this device ----------
  function homeView() {
    return `<div class="v-head"><div class="kick">Valesta</div><h1>${esc(t('homeT'))}</h1><p class="vlead">${esc(t('homeLead'))}</p></div>
      <div class="home-actions"><button type="button" class="btn btn-primary btn-lg" data-action="new">${ic('plus')}${esc(t('newValuation'))}</button>
      <button type="button" class="btn btn-lg" data-action="open">${ic('upload')}${esc(t('homeOpenFile'))}</button>
      <button type="button" class="btn btn-lg" data-action="home-demo">${ic('play')}${esc(t('homeDemo'))}</button></div>
      <input type="search" class="home-search" id="home-q" value="${esc(homeQ)}" placeholder="${esc(t('archSearch'))}" aria-label="${esc(t('archSearch'))}">
      <ul class="plist" id="home-list"><li class="empty">…</li></ul>`;
  }
  async function loadHome() {
    if (!storeOk) { const el = $('#home-list'); if (el) el.innerHTML = `<li class="empty">${esc(t('archUnavailable'))}</li>`; return; }
    await saveNow();
    try { archiveList = await ValestaStore.list(); } catch (e) { archiveList = []; }
    paintHome();
  }
  function paintHome() {
    const el = $('#home-list');
    if (!el) return;
    const cur = state.meta.id;
    const q = homeQ.trim().toLowerCase();
    const items = archiveList.filter((r) => !q || [r.title, r.municipality, r.ref, r.brand].join(' ').toLowerCase().includes(q));
    el.innerHTML = items.length ? items.map((r) => `<li class="${r.id === cur ? 'cur' : ''}"><div><div class="pt">${esc(r.title)}</div>
      <div class="pm">${r.country ? `<span class="cc">${esc(r.country)}</span>` : ''}<span>${esc([r.municipality, r.ref, (r.reportLang || '').toUpperCase(), t('archUpdated')(fmtDate(r.updated))].filter(Boolean).join(' · '))}${r.id === cur ? ` · <b>${esc(t('archCurrent'))}</b>` : ''}</span></div></div>
      <div class="pv">${esc(EUR(r.value))}</div><div class="pa">${r.id === cur ? btn('home-resume', esc(t('homeResume')), { cls: 'btn-primary' }) : btn('arch-open', esc(t('archOpen')), { id: r.id, cls: 'btn-primary' })}${btn('arch-dup', esc(t('archDup')), { id: r.id })}${r.id !== cur ? btn('arch-del', esc(t('archDel')), { id: r.id, cls: 'btn-danger' }) : ''}</div></li>`).join('')
      : `<li class="empty">${esc(t('archEmpty'))}</li>`;
  }

  // ---------- start screen: source, property type, country, language, purpose ----------
  function packBox(code) {
    const c = Taxonomy.country(code);
    if (!c) return '';
    return `<div class="pack"><div class="pack-h"><span class="cc">${c.code}</span><b>${esc(t('packT')(Taxonomy.countryName(c.code, uiLang)))}</b><span class="tag-draft">${esc(t('packDraft'))}</span></div>
      <div class="pack-g"><span>${esc(t('packStd'))}</span><b>${esc(c.std)}</b><span>${esc(t('packArea'))}</span><b>${esc(c.area)}</b><span>${esc(t('packDocs'))}</span><ul class="pack-docs">${c.docs.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      <span>${esc(t('packCur'))}</span><b>${esc(c.currency === 'EUR' ? 'EUR' : t('packCurNote')(c.currency))}</b></div></div>`;
  }
  const loanNote = (code, purpose) => {
    const c = Taxonomy.country(code);
    return purpose === 'loan_security' && c ? `<p class="note-warn">${esc(t('loanWarn')(Taxonomy.countryName(code, uiLang), L3(c.reserved)))}</p>` : '';
  };
  function guessHtml() {
    const q = String((wiz && wiz.desc) || '').trim();
    if (q.length < 3) return '';
    const g = Taxonomy.classifyType(q);
    if (!g) return `<div class="guess none">${ic('sparkle')}<span>${esc(t('typeUnsure'))}</span></div>`;
    const cat = Taxonomy.categoryOf(g.code);
    return `<div class="guess">${ic('sparkle')}<span>${t('typeGuess')(`<b>${esc(L3(cat.label))} › ${esc(Taxonomy.typeLabel(g.code, uiLang))}</b>`)}</span>${g.code === wiz.code ? '' : `<button type="button" class="btn btn-sm" data-action="wiz-type" data-key="${g.code}">${esc(t('typeUse'))}</button>`}</div>`;
  }
  function startView() {
    const w = wiz;
    const T = Taxonomy;
    const type = w.code ? T.typeByCode(w.code) : null;
    const cat = w.cat || (type && type.category) || null;
    const catObj = cat ? T.CATEGORIES.find((c) => c.id === cat) : null;
    const srcs = [['addr', 'pin', t('srcAddr')], ['docs', 'upload', t('srcDocs')], ['blank', 'file', t('srcBlank')], ['demo', 'play', t('srcDemo')]];
    const docs = w.src === 'docs';
    return `<div class="v-head"><div class="kick">${esc(t('startKick'))}</div><h1>${esc(t('startT'))}</h1><p class="vlead">${esc(t('startLead'))}</p></div>
    <section class="card"><h2 class="c-t"><span class="n">1</span>${esc(t('sSrcT'))}</h2>
      <div class="opts" role="radiogroup" aria-label="${esc(t('sSrcT'))}">${srcs.map(([id, i, l]) => `<button type="button" class="ocard${w.src === id ? ' on' : ''}" role="radio" aria-checked="${w.src === id}" data-action="wiz-src" data-key="${id}">${ic(i)}<b>${esc(l[0])}</b><span>${esc(l[1])}</span></button>`).join('')}</div>
      ${w.src === 'addr' ? `<label class="fld mt"><span>${esc(t('addrLabel'))}</span><input id="wiz-address" value="${esc(w.address)}" autocomplete="street-address"></label>` : ''}</section>
    ${w.src === 'demo' ? '' : `<section class="card" id="wiz-type-card"><h2 class="c-t"><span class="n">2</span>${esc(t('sTypeT'))}</h2>
      <div class="describe">${ic('search')}<input id="wiz-desc" value="${esc(w.desc)}" placeholder="${esc(t('typePh'))}" autocomplete="off" aria-label="${esc(t('sTypeT'))}"></div>
      <div id="wiz-guess" aria-live="polite">${guessHtml()}</div>
      <div class="types" role="radiogroup" aria-label="${esc(t('sTypeT'))}">${T.CATEGORIES.map((c) => `<button type="button" class="tcard${c.id === cat ? ' on' : ''}" role="radio" aria-checked="${c.id === cat}" data-action="wiz-cat" data-key="${c.id}">${ic(c.icon)}<b>${esc(L3(c.label))}</b><span>${esc(L3(c.hint))}</span></button>`).join('')}</div>
      ${catObj ? `<div class="subs"><div class="subs-h">${esc(t('typeSub')(L3(catObj.label)))}</div>${T.typesOf(cat).map((x) => `<button type="button" class="sub-btn${x.code === w.code ? ' on' : ''}" aria-pressed="${x.code === w.code}" data-action="wiz-type" data-key="${x.code}">${esc(L3(x.label))}</button>`).join('')}</div>` : ''}
      ${type ? `<div class="type-sum"><div><span class="muted">${esc(t('typeSel'))}</span><b>${esc(L3(catObj.label))} › ${esc(L3(type.label))}</b></div><div><span class="muted">${esc(t('typeMethods'))}</span><b>${esc(type.approaches.map((x) => T.approachLabel(x, uiLang)).join(' · '))}</b></div></div>${type.approaches[0] !== 'sales_comparison' ? `<p class="note-info">${esc(t('typeNoteMca'))}</p>` : ''}` : ''}</section>
    <section class="card"><h2 class="c-t"><span class="n">3</span>${esc(t('sWhereT'))}</h2><div class="grid grid-3">
      <label class="fld"><span>${esc(t('tCountry'))}</span><select id="wiz-country">${T.countries(uiLang).map((c) => `<option value="${c.code}"${c.code === w.country ? ' selected' : ''}>${esc(T.countryName(c.code, uiLang))} (${c.currency})</option>`).join('')}</select><small>${esc(t('countryHint'))}</small></label>
      <label class="fld"><span>${esc(t('reportLang'))}</span><select id="wiz-lang">${AppCore.langsByName(uiLang).map((l) => `<option value="${l}"${l === w.lang ? ' selected' : ''}>${esc(langName(l))}</option>`).join('')}</select><small>${esc(t('langHint'))}</small></label>
      <label class="fld"><span>${esc(t('purposeLabel'))}</span><select id="wiz-purpose">${T.PURPOSES.map((p) => `<option value="${p.code}"${p.code === w.purpose ? ' selected' : ''}>${esc(L3(p.label))}</option>`).join('')}</select><small>${esc(t('purposeHint'))}</small></label>
    </div>${packBox(w.country)}${loanNote(w.country, w.purpose)}</section>`}
    <div class="actions"><button type="button" class="btn" data-action="wiz-cancel">${esc(t('wizCancel'))}</button><button type="button" class="btn btn-lg ${docs ? 'btn-ai' : 'btn-primary'}" data-action="wiz-create">${ic(docs ? 'sparkle' : 'check')}${esc(docs ? t('wizCreateDocs') : t('wizCreate'))}</button></div>`;
  }
  function goStart() {
    closePop();
    setFullPreview(false);
    wiz = { src: 'addr', address: '', desc: '', cat: null, code: '', country: (state.meta && state.meta.country) || 'ES', lang: uiLang, purpose: 'sale', back: screen === 'step' ? step : 'home' };
    screen = 'start';
    renderTab();
    $('#main').scrollTop = 0;
    enter('in');
    const a = $('#wiz-address');
    if (a && !phoneMode()) a.focus();
  }
  // The example valuation, with the report in the language of the app.
  function freshExample() {
    const ex = AppCore.clone(DEFAULT_STATE);
    ex.meta.id = EXAMPLE_ID;
    ex.meta.reportLang = uiLang;
    return ex;
  }
  function loadExample() {
    screen = 'step';
    step = 'identity';
    loadState(freshExample());
    $('#main').scrollTop = 0;
  }
  async function createFromWizard() {
    const w = wiz;
    if (w.src === 'demo') { await saveNow(); return loadExample(); }
    if (!w.code) { toast(t('wizNeedType')); const d = $('#wiz-desc'); if (d) d.focus(); return; }
    await saveNow();
    let b = AppCore.newValuation(DEFAULT_STATE, state, { country: w.country, purposeCode: w.purpose, reportLang: w.lang,
      propertyType: { code: w.code, description: w.desc || '' }, typeLabel: Taxonomy.typeByCode(w.code).label, address: w.src === 'addr' ? w.address.trim() : '' });
    delete b.meta.id;
    const def = findProfile(defaultProfileId());
    if (def) { const r = AppCore.applyProfile(b, def.profile); if (r.ok) { b = r.state; b.brand.profileId = def.id; } }
    screen = 'step';
    step = 'identity';
    loadState(b, t('toastCreated'));
    $('#main').scrollTop = 0;
    saveNow();
    if (w.src === 'docs' && window.ValestaAI) { window.ValestaAI.open(); $('#file-ai').click(); }
  }
  // Summary of the case: property type, country, report language, purpose, recommended approaches and the rules of the country.
  function identityCard() {
    const T = Taxonomy;
    const code = (state.subject.propertyType || {}).code;
    const type = T.typeByCode(code);
    const cat = T.categoryOf(code);
    const c = state.meta.country || 'ES';
    const ch = (action, key) => `<button type="button" class="link" data-action="${action}"${key ? ` data-key="${key}"` : ''}>${esc(t('idChange'))}</button>`;
    return `<section class="card"><div class="sum-row">
      <div class="sum-item"><span>${esc(t('idType'))}</span><b>${cat ? ic(cat.icon) : ''}${esc(type ? L3(type.label) : '—')}</b>${ch('pop-type')}</div>
      <div class="sum-item"><span>${esc(t('idCountry'))}</span><b><span class="cc">${esc(c)}</span>${esc(T.countryName(c, uiLang))}</b>${ch('pop-country')}</div>
      <div class="sum-item"><span>${esc(t('reportLang'))}</span><b>${esc(langName(RL()))}</b>${ch('pop-lang', 'report')}</div>
      <div class="sum-item"><span>${esc(t('idPurpose'))}</span><b>${esc(T.purposeLabel(state.meta.purposeCode || 'sale', uiLang))}</b>${ch('pop-purpose')}</div>
    </div>${type ? `<div class="method">${ic('chart')}<span>${esc(t('idMethods')(type.approaches.map((x) => T.approachLabel(x, uiLang)).join(' · ')))}</span></div>` : ''}
    ${packBox(c)}${loanNote(c, state.meta.purposeCode)}</section>`;
  }
  // Document checks: status and source of each check; the report writes the positive wording.
  // ---------- technical sheet and attached documents (checks step) ----------
  let attTopic = '';
  const ATT_MAX = 15 * 1024 * 1024;
  const ATT_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
  const KIND_FOR = { energy: 'ape', installations: 'dico', seismic: 'seismic', planning: 'plan', cadastral: 'plan', title: 'deed' };
  const energyClasses = () => (state.meta.country === 'IT' ? ['A4', 'A3', 'A2', 'A1', 'B', 'C', 'D', 'E', 'F', 'G'] : state.meta.country === 'DE' ? ['A+', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] : ['A', 'B', 'C', 'D', 'E', 'F', 'G']);
  const sizeText = (b) => (b >= 1048576 ? N(b / 1048576, 1) + ' MB' : N(Math.max(1, Math.round(b / 1024))) + ' kB');
  async function sha256(buf) {
    try {
      if (!(window.crypto && crypto.subtle)) return '';
      const h = await crypto.subtle.digest('SHA-256', buf);
      return Array.from(new Uint8Array(h)).map((x) => x.toString(16).padStart(2, '0')).join('');
    } catch (e) { return ''; }
  }
  const readAs = (file, how) => new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => ko(r.error); r[how](file); });
  async function addAttachments(files) {
    const list = Array.from(files || []);
    let added = 0;
    for (const f of list) {
      if (!ATT_TYPES.includes(f.type)) { toast(t('attBadType')(f.name)); continue; }
      if (f.size > ATT_MAX) { toast(t('attTooBig')(f.name)); continue; }
      const [dataUrl, buf] = await Promise.all([readAs(f, 'readAsDataURL'), readAs(f, 'readAsArrayBuffer')]);
      state.attachments = state.attachments || [];
      state.attachments.push({ id: 'att' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), topic: attTopic, kind: KIND_FOR[attTopic] || 'other',
        title: f.name.replace(/\.[^.]+$/, ''), name: f.name, mime: f.type, size: f.size, issuer: '', date: '', ref: '', include: true, sha256: await sha256(buf), dataUrl });
      added++;
    }
    if (added) { changed(true); toast(t('attAdded')(added)); }
  }
  function attChips(topic) {
    const items = (state.attachments || []).map((a, i) => (a.topic === topic ? `<span class="att-chip">${ic('file')}<span>${esc(a.title || a.name)}</span><small>${esc(sizeText(a.size || 0))}</small></span>` : '')).join('');
    return `<div class="att-row">${items}${btn('att-add', `${ic('plus')} ${esc(t('attAdd'))}`, { key: topic })}</div>`;
  }
  function techPanel(topic) {
    const T2 = (k) => t('tech')[k];
    if (topic === 'energy') {
      return `<div class="tech-p"><div class="grid grid-3">${fSel('technical.energy.class', T2('eClass'), [['', '—']].concat(energyClasses().map((c) => [c, c])))}
        ${fNum('technical.energy.ep', T2('eIndex'), { unit: 'kWh/m²' })}${fText('technical.energy.code', T2('eCode'))}
        ${fDate('technical.energy.issued', T2('eIssued'))}${fDate('technical.energy.validUntil', T2('eValid'))}${fText('technical.energy.certifier', T2('eBy'))}</div>
        <p class="hint">${esc(T2('eHint'))}</p></div>`;
    }
    if (topic === 'seismic') {
      const st = AppCore.STRUCTURES.map((k) => [k, T2('structures')[k]]);
      return `<div class="tech-p"><div class="grid grid-3">${fSel('technical.seismic.zone', T2('sZone'), [['', '—'], ['1', '1'], ['2', '2'], ['3', '3'], ['4', '4']])}
        ${fSel('technical.seismic.riskClass', T2('sClass'), [['', '—']].concat(AppCore.SEISMIC_CLASSES.map((c) => [c, c])))}${fSel('technical.seismic.structure', T2('sStructure'), [['', '—']].concat(st))}
        ${fNum('technical.seismic.year', T2('sYear'), { int: true })}${fText('technical.seismic.works', T2('sWorks'), { cls: 'span-2' })}
        ${fText('technical.seismic.notes', T2('sNotes'), { cls: 'span-all' })}</div><p class="hint">${esc(T2('sHint'))}</p></div>`;
    }
    if (topic === 'installations') {
      const it = state.meta.country === 'IT';
      const opts = [['', '—'], ['dico', T2('status').dico]].concat(it ? [['diri', T2('status').diri]] : []).concat([['none', T2('status').none], ['na', T2('status').na]]);
      const rows = AppCore.SYSTEMS.map((k) => `<tr><td>${esc(T2('sysNames')[k])}</td><td>${fSel(`technical.systems.${k}.status`, '', opts, { cls: 'bare' })}</td>
        <td>${fDate(`technical.systems.${k}.date`, '', { cls: 'bare' })}</td><td>${fText(`technical.systems.${k}.by`, '', { cls: 'bare', ph: T2('byPh') })}</td></tr>`).join('');
      const ded = ((state.technical || {}).deductions || []).map((d, i) => `<tr><td>${fText(`technical.deductions.${i}.label`, '', { cls: 'bare', ph: T2('dedPh') })}</td>
        <td>${fNum(`technical.deductions.${i}.amount`, '', { cls: 'bare', unit: CURS() })}</td><td class="x">${btn('ded-del', ic('trash'), { i, cls: 'btn-icon btn-del', title: t('del') })}</td></tr>`).join('');
      return `<div class="tech-p"><div class="tscroll"><table class="edt tech-t"><thead><tr><th>${esc(T2('sysCol'))}</th><th>${esc(T2('docCol'))}</th><th>${esc(T2('dateCol'))}</th><th>${esc(T2('byCol'))}</th></tr></thead><tbody>${rows}</tbody></table></div>
        <p class="hint">${esc(it ? T2('sysHintIt') : T2('sysHint'))}</p>
        <h4 class="tech-h">${esc(T2('dedT'))}</h4><p class="hint">${esc(T2('dedHint'))}</p>
        ${ded ? `<div class="tscroll"><table class="edt tech-t"><tbody>${ded}</tbody></table></div>` : ''}<div class="row-actions">${btn('ded-add', esc(T2('dedAdd')))}</div></div>`;
    }
    return '';
  }
  function attCard() {
    const list = state.attachments || [];
    if (!list.length) return '';
    const kinds = AppCore.ATT_KINDS.map((k) => [k, t('attKinds')[k]]);
    const topics = [['', '—']].concat(Checks.CATALOG.map((c) => [c.topic, L3(c.label)]));
    const rows = list.map((a, i) => `<div class="att-item"><div class="att-h">${ic('file')}<b>${esc(a.name)}</b><small>${esc(sizeText(a.size || 0))}${a.sha256 ? ` · SHA-256 ${esc(a.sha256.slice(0, 12))}` : ''}</small>
        <span class="grow"></span>${btn('att-del', ic('trash'), { i, cls: 'btn-icon btn-del', title: t('del') })}</div>
      <div class="grid grid-3">${fText(`attachments.${i}.title`, t('attTitle'), { cls: 'span-2' })}${fSel(`attachments.${i}.kind`, t('attKind'), kinds)}
      ${fSel(`attachments.${i}.topic`, t('attTopic'), topics)}${fText(`attachments.${i}.issuer`, t('attIssuer'))}${fDate(`attachments.${i}.date`, t('attDate'))}
      ${fText(`attachments.${i}.ref`, t('attRef'))}</div>${fChk(`attachments.${i}.include`, t('attInclude'), true)}</div>`).join('');
    return card(t('attT'), `<p class="hint">${esc(t('attHint'))}</p>${rows}`, t('attCount')(list.length));
  }

  // ---------- other approaches (income, cost, residual) and reconciliation ----------
  function apValueHtml(k) {
    const a = res && res.approaches;
    const r = a && a[k];
    const on = state.approaches && state.approaches[k] && state.approaches[k].on;
    if (!on) return '';
    return r ? `<p class="ap-val">${esc(t('apValue'))}: <b>${EUR(Math.round(r.value))}</b></p>` : `<p class="hint">${esc(t('apIncomplete'))}</p>`;
  }
  function apReconHtml() {
    const a = res && res.approaches;
    if (!a || !a.reconciled) return `<p class="hint">${esc(t('apReconNone'))}</p>`;
    const names = { market: t('apMarket'), income: t('apIncomeT'), cost: t('apCostT'), residual: t('apResT') };
    const vals = { market: res.marketGross, income: a.income && a.income.value, cost: a.cost && a.cost.value, residual: a.residual && a.residual.value };
    return `<table class="edt"><tbody>${a.reconciled.used.map((k) => `<tr><td>${esc(names[k])}</td><td class="num">${EUR(Math.round(vals[k]))}</td><td class="num">${N(a.reconciled.weights[k] * 100)}%</td></tr>`).join('')}
      <tr class="tot"><td><b>${esc(t('apReconciled'))}</b></td><td class="num"><b>${EUR(Math.round(a.reconciled.value))}</b></td><td></td></tr></tbody></table>`;
  }
  function tabMetodi() {
    const A = state.approaches || {};
    const pc = { unit: '%' };
    const ref = res && res.refArea ? N(res.refArea) : '';
    const income = card(t('apIncomeT'), `${fChk('approaches.income.on', t('apUse'))}<p class="hint">${esc(t('apIncomeHint'))}</p><div class="grid grid-3">
      ${fNum('approaches.income.rentMonthly', t('apRent'), { unit: t('apPerMonth') })}${fNum('approaches.income.vacancy', t('apVacancy'), pc)}
      ${fNum('approaches.income.opex', t('apOpex'), pc)}${fNum('approaches.income.capRate', t('apCap'), pc)}</div><div data-live="ap" data-k="income">${apValueHtml('income')}</div>`);
    const cost = card(t('apCostT'), `${fChk('approaches.cost.on', t('apUse'))}<p class="hint">${esc(t('apCostHint'))}</p><div class="grid grid-3">
      ${fNum('approaches.cost.landValue', t('apLand'), { unit: CURS() })}${fNum('approaches.cost.unitCost', t('apUnitCost'), { unit: CURS() + '/m²' })}${fNum('approaches.cost.area', t('apArea'), { unit: 'm²', ph: ref })}
      ${fNum('approaches.cost.fees', t('apFees'), pc)}${fNum('approaches.cost.profit', t('apProfit'), pc)}${fNum('approaches.cost.depreciation', t('apDep'), pc)}</div>
      <div data-live="ap" data-k="cost">${apValueHtml('cost')}</div>`);
    const residual = card(t('apResT'), `${fChk('approaches.residual.on', t('apUse'))}<p class="hint">${esc(t('apResHint'))}</p><div class="grid grid-3">
      ${fNum('approaches.residual.sellArea', t('apSellArea'), { unit: 'm²' })}${fNum('approaches.residual.unitPrice', t('apUnitPrice'), { unit: CURS() + '/m²' })}${fNum('approaches.residual.buildCost', t('apBuild'), { unit: CURS() })}
      ${fNum('approaches.residual.fees', t('apFees'), pc)}${fNum('approaches.residual.finance', t('apFinance'), pc)}${fNum('approaches.residual.profit', t('apProfitGdv'), pc)}
      ${fNum('approaches.residual.saleCosts', t('apSale'), pc)}</div><div data-live="ap" data-k="residual">${apValueHtml('residual')}</div>`);
    const w = (k, label) => fNum('approaches.weights.' + k, label, { unit: '%', ph: k === 'market' ? '100' : '0' });
    const recon = card(t('apReconT'), `<p class="hint">${esc(t('apReconHint'))}</p><div class="grid grid-3">${w('market', t('apMarket'))}
      ${A.income && A.income.on ? w('income', t('apIncomeT')) : ''}${A.cost && A.cost.on ? w('cost', t('apCostT')) : ''}${A.residual && A.residual.on ? w('residual', t('apResT')) : ''}</div>
      <div data-live="ap-recon">${apReconHtml()}</div>${fArea('approaches.reason', t('apReason'), { rows: 2 })}`);
    return income + cost + residual + recon;
  }

  function tabVerifiche() {
    const list = Checks.applicable(Checks.categoryOfCode((state.subject.propertyType || {}).code));
    const pack = Taxonomy.country(state.meta.country || 'ES');
    const docs = pack ? pack.checkDocs : [];
    const rec = (topic) => (state.checks || []).find((r) => r.topic === topic) || {};
    const row = (c) => {
      const r = rec(c.topic);
      const st = r.status || '';
      const doc = c.doc != null && docs[c.doc] ? docs[c.doc] : '';
      return `<div class="chk-row"><div class="chk-t"><b>${esc(L3(c.label))}</b>${doc ? `<span class="chk-doc">${esc(doc)}</span>` : ''}<span class="muted">${esc(L3(c.hint))} · ${esc(t('chkWho')(L3(c.who)))}</span></div>
        <div class="seg seg-st" role="radiogroup" aria-label="${esc(L3(c.label))}">${Checks.STATUSES.map((x) => `<button type="button" class="${st === x ? 'on st-' + x : ''}" role="radio" aria-checked="${st === x}" data-action="chk-status" data-key="${c.topic}" data-st="${x}">${esc(L3(Checks.STATUS_LABEL[x]))}</button>`).join('')}</div>
        ${st === 'verified' ? `<div class="chk-src"><label class="fld"><span>${esc(t('chkSource'))}</span><input data-chk="${c.topic}" data-field="source" value="${esc(r.source || '')}" placeholder="${esc(doc)}"></label><label class="fld"><span>${esc(t('chkDate'))}</span><input type="date" data-chk="${c.topic}" data-field="date" value="${esc(r.date || '')}"></label></div>` : ''}${techPanel(c.topic)}${attChips(c.topic)}</div>`;
    };
    const groups = Checks.GROUPS.map((g) => { const rows = list.filter((c) => c.group === g.id); return rows.length ? card(L3(g.label), rows.map(row).join('')) : ''; }).join('');
    const b = Checks.reportBlock(state, RL(), docs);
    const p = Checks.progress(state);
    const preview = b ? `${b.verified.length ? `<h4 class="chk-ph">${esc(b.verifiedTitle)}</h4><ul class="chk-ok">${b.verified.map((v) => `<li>${ic('check')}<span>${esc(v.text)}</span></li>`).join('')}</ul>` : ''}` +
      `${b.advice.length ? `<h4 class="chk-ph">${esc(b.adviceTitle)}</h4>${b.advice.map((a) => `<p class="chk-box">${a.deep ? `<b>${esc(b.deepLabel)}</b> ` : ''}<b>${esc(a.label)}.</b> ${esc(a.text)}</p>`).join('')}` : ''}`
      : `<p class="hint" style="margin:0">${esc(t('chkEmpty'))}</p>`;
    return `<section class="card"><div class="chk-top"><p class="hint">${esc(t('chkLead')(Taxonomy.countryName(state.meta.country || 'ES', uiLang)))}</p><span class="sbadge">${p.done}/${p.total}</span>${p.done < p.total ? btn('chk-all-nv', esc(t('chkAllNv'))) : ''}</div></section>` +
      groups + attCard() + card(t('chkInReport'), preview, langName(RL()));
  }
  // Delivery: formats, final checks and the language of this copy.
  function tabConsegna() {
    const errs = flow ? flow.issues.filter((x) => x.level === 'error').length : 0;
    const warns = flow ? flow.issues.filter((x) => x.level === 'warn').length : 0;
    const c = Taxonomy.country(state.meta.country || 'ES');
    const share = NATIVE || (navigator.canShare && typeof File === 'function');
    const opt = (action, icon, l) => `<button type="button" class="ocard" data-action="${action}">${ic(icon)}<b>${esc(l[0])}</b><span>${esc(l[1])}</span></button>`;
    return `<section class="card"><h2 class="c-t">${esc(t('dlvFormatT'))}</h2><div class="opts">${opt('print', 'file', t('dlvPdf'))}${opt('export-html', 'code', t('dlvHtml'))}${opt('export-dossier', 'download', t('dlvZip'))}${opt('save', 'db', t('dlvJson'))}${share ? opt('share', 'share', t('dlvShare')) : ''}</div>
      <div class="row-actions"><label class="fld"><span>${esc(t('dlvLang'))}</span><select id="dlv-lang">${AppCore.langsByName(uiLang).map((l) => `<option value="${l}"${l === RL() ? ' selected' : ''}>${esc(langName(l))}</option>`).join('')}</select></label></div></section>
      <section class="card"><h2 class="c-t">${esc(t('dlvCheckT'))}</h2><ul class="ql">
      <li class="${errs ? 'err' : 'ok'}">${ic(errs ? 'alert' : 'check')}<span>${esc(t('dlvErrors')(errs))}</span></li>
      <li class="${warns ? 'warn' : 'ok'}">${ic(warns ? 'alert' : 'check')}<span>${esc(t('dlvWarns')(warns))}</span></li>
      ${c ? `<li class="warn">${ic('alert')}<span>${esc(t('dlvDraft')(Taxonomy.countryName(c.code, uiLang)))}</span></li>` : ''}
      ${(() => { const n = AIReview.counts(state.aiLog); return n.open ? `<li class="warn">${ic('alert')}<span>${esc(t('dlvAiOpen')(n.open))}</span></li>` : n.accepted ? `<li class="ok">${ic('check')}<span>${esc(t('dlvAiDecl'))}</span></li>` : ''; })()}</ul>
      ${errs || warns ? `<div class="row-actions"><button type="button" class="btn btn-sm" data-action="ctx-issues">${esc(t('dlvSeeIssues'))}</button></div>` : ''}</section>`;
  }

  // ---------- tabs ----------
  function tabPratica() {
    const guide = `<details class="card guide"${state.meta.reportNo ? '' : ' open'}><summary><b>${esc(t('guideT'))}</b> <span class="sub">${esc(t('guideS'))}</span></summary><ol>${t('guide').map((g) => `<li>${g}</li>`).join('')}</ol></details>`;
    return guide + card(t('cReport'), `<div class="grid">
      ${fText('meta.reportNo', t('reportNo'))}${fText('meta.internalRef', t('internalRef'))}
      ${fDate('meta.visitDate', t('visitDate'))}${fDate('meta.valuationDate', t('valDate'))}
      ${fDate('meta.reportDate', t('reportDate'))}${fNum('meta.validityMonths', t('validity'), { int: true, unit: t('months') })}
      ${fLText('meta.purpose', t('purpose'), { cls: 'span-all', area: true, rows: 3 })}</div>`) +
      card(t('cClient'), `<div class="grid">${fText('meta.client.name', t('clientName'), { ph: t('clientNamePh') })}${fLText('meta.client.role', t('role'))}</div>`) +
      card(t('cAdvisor'), `<div class="grid">${fText('meta.advisor.name', t('advisorName'))}${fLText('meta.advisor.role', t('role'))}</div>`, t('advisorNote'));
  }

  // ---------- location: map, address search, coordinates ----------
  const isNum = (v) => typeof v === 'number' && isFinite(v);
  const hasPos = (o) => !!o && isNum(o.lat) && isNum(o.lon);
  const round6 = (v) => Math.round(v * 1e6) / 1e6;
  function readJson(key) { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { return null; } }
  function writeJson(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* ignore */ } }
  const geocoderCfg = () => readJson(GEO_KEY);
  const mapProvider = () => Maps.resolve(state, readJson(TILES_KEY));
  const viewKey = () => state.meta.id || '';
  const COUNTRY_VIEW = { IT: [42.4, 12.6, 6], ES: [40.2, -3.6, 6], FR: [46.6, 2.4, 6], CH: [46.8, 8.2, 8], DE: [51.1, 10.4, 6], AT: [47.6, 14.1, 7],
    NL: [52.2, 5.3, 7], BE: [50.6, 4.6, 8], PT: [39.6, -8.0, 7], GB: [54.0, -2.5, 6], IE: [53.4, -8.0, 7], PL: [52.0, 19.4, 6], CZ: [49.8, 15.5, 7],
    HU: [47.2, 19.4, 7], RO: [45.9, 24.9, 6], HR: [44.6, 16.4, 7], DK: [56.0, 10.0, 7], SE: [62.0, 15.0, 5], NO: [64.5, 12.0, 5] };
  const FIELD_LABEL = { address: 'address', postalCode: 'postal', municipality: 'town', province: 'province', region: 'region', zone: 'zone' };
  function geoServiceName(cfg) {
    if (!cfg || cfg.provider === 'off') return t('geoOff');
    return cfg.provider === 'nominatim' ? 'OpenStreetMap Nominatim' : String(cfg.url || '').replace(/^https:\/\//i, '').split(/[/?]/)[0];
  }
  function crsNow() {
    const sys = Geo.systemsFor(state.meta.country || 'ES', state.subject.lon);
    return sys.includes(geoUi.crs) ? geoUi.crs : sys[0];
  }
  function mapMarkers() {
    const S = state.subject;
    const list = [{ id: 'subject', kind: 'subject', lat: S.lat, lon: S.lon, draggable: true, title: [S.address, S.municipality].filter(Boolean).join(', ') }];
    (S.pois || []).forEach((p, i) => list.push({ id: 'poi:' + i, kind: 'poi', lat: p.lat, lon: p.lon, label: String(i + 1), draggable: true, title: I18N.loc(p.name, RL()) }));
    (state.comparables || []).forEach((c, i) => { if (hasPos(c)) list.push({ id: 'comp:' + i, kind: 'comp', lat: c.lat, lon: c.lon, label: c.id || 'C' + (i + 1), title: c.address || '' }); });
    return list;
  }
  function syncCoordInputs() {
    const S = state.subject;
    const put = (sel, v) => $$(sel).forEach((el) => { if (document.activeElement !== el) el.value = fmtIn(v); });
    put('[data-bind="subject.lat"]', S.lat);
    put('[data-bind="subject.lon"]', S.lon);
    (S.pois || []).forEach((p, i) => { put(`[data-bind="subject.pois.${i}.lat"]`, p.lat); put(`[data-bind="subject.pois.${i}.lon"]`, p.lon); });
  }
  function setPos(id, lat, lon) {
    const S = state.subject;
    if (id === 'subject') { S.lat = round6(lat); S.lon = round6(lon); }
    else if (id.startsWith('poi:')) { const p = (S.pois || [])[+id.slice(4)]; if (!p) return; p.lat = round6(lat); p.lon = round6(lon); }
    else return;
    syncCoordInputs();
    $$('[data-action="geo-place"]').forEach((b) => { b.textContent = t('geoMove'); });
    changed(false);
  }
  function syncMap() {
    if (mapView && screen === 'step' && step === 'features') mapView.setMarkers(mapMarkers());
    $$('[data-live="coord-now"]').forEach((el) => { el.textContent = hasPos(state.subject) ? Geo.format(crsNow(), state.subject.lat, state.subject.lon) : t('coordNone'); });
  }
  function mountLocationMap() {
    const el = screen === 'step' && step === 'features' ? $('[data-map="location"]') : null;
    if (!el || typeof MapView === 'undefined') { mapView = null; return; }
    const S = state.subject;
    const cv = COUNTRY_VIEW[state.meta.country] || [48, 10, 4];
    const v = geoUi.view && geoUi.view.key === viewKey() ? geoUi.view : null;
    mapView = MapView.mount(el, {
      center: v ? [v.lat, v.lon] : hasPos(S) ? [S.lat, S.lon] : [cv[0], cv[1]], zoom: v ? v.zoom : hasPos(S) ? 18 : cv[2],
      provider: mapProvider(), markers: mapMarkers(), lang: uiLang, ariaLabel: t('mapAria'),
      labels: { zoomIn: t('zoomIn'), zoomOut: t('zoomOut'), recenter: t('recenter'), locate: t('geoMine'), cancel: t('cancel') },
      onMarkerMove: (id, lat, lon) => setPos(id, lat, lon),
      onView: (lat, lon, zoom) => { geoUi.view = { key: viewKey(), lat, lon, zoom }; },
      onLocate: () => locateMe(),
    });
    syncMap();
    if (geoUi.focusPoi != null) {
      const f = $(`[data-bind="subject.pois.${geoUi.focusPoi}.name"]`);
      geoUi.focusPoi = null;
      if (f) { f.scrollIntoView({ block: 'center' }); f.focus(); }
    }
  }
  function startPick(target) {
    if (!mapView) return;
    const S = state.subject;
    const poi = target.kind === 'poi' ? (S.pois || [])[target.i] : null;
    const label = poi ? t('poiPick')(I18N.loc(poi.name, RL()) || '#' + (target.i + 1)) : t('geoPickHint');
    const box = $('[data-map="location"]');
    if (box) box.scrollIntoView({ block: 'center', behavior: 'smooth' });
    mapView.setPicking(label, (lat, lon) => {
      setPos(poi ? 'poi:' + target.i : 'subject', lat, lon);
      if (mapView) mapView.setMarkers(mapMarkers());
    });
  }
  function locateMe() {
    if (!navigator.geolocation) return toast(t('geoMineErr'));
    navigator.geolocation.getCurrentPosition((p) => {
      geoUi.view = { key: viewKey(), lat: p.coords.latitude, lon: p.coords.longitude, zoom: 18 };
      setPos('subject', p.coords.latitude, p.coords.longitude);
      if (mapView) { mapView.setMarkers(mapMarkers()); mapView.setView(state.subject.lat, state.subject.lon, 18); }
      toast(t('geoMineOk')(Math.round(p.coords.accuracy || 0)));
    }, () => toast(t('geoMineErr')), { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  }
  async function geoSearch(target) {
    const S = state.subject;
    target = target || { kind: 'subject' };
    const cfg = geocoderCfg();
    if (!cfg || cfg.provider === 'off' || (cfg.provider === 'custom' && !cfg.url)) { geoUi.panel = 'consent'; geoUi.after = target; return paintGeo(true); }
    const poi = target.kind === 'poi' ? (S.pois || [])[target.i] : null;
    if (poi && !I18N.loc(poi.name, RL())) return toast(t('poiNeedName'));
    if (!poi && !S.address && !S.municipality) return toast(t('geoNeedAddress'));
    const q = poi ? [I18N.loc(poi.name, RL()), S.municipality].filter(Boolean).join(', ') : Geocode.queryFor(S);
    geoUi.panel = 'busy';
    geoUi.target = target;
    paintGeo(true);
    try {
      const list = await Geocode.search(cfg, q, { country: state.meta.country, lang: uiLang, near: poi && hasPos(S) ? { lat: S.lat, lon: S.lon } : null });
      geoUi.results = list;
      geoUi.panel = 'results';
      if (list.length === 1) return useResult(0);
      paintGeo();
    } catch (e) {
      geoUi.panel = 'error';
      paintGeo();
    }
  }
  function useResult(k) {
    const r = (geoUi.results || [])[k];
    if (!r) return;
    const tg = geoUi.target || { kind: 'subject' };
    const id = tg.kind === 'poi' ? 'poi:' + tg.i : 'subject';
    const filled = id === 'subject' ? Geocode.fill(state.subject, r.address) : [];
    geoUi.panel = null;
    geoUi.results = null;
    geoUi.view = { key: viewKey(), lat: r.lat, lon: r.lon, zoom: id === 'subject' ? 18 : 17 };
    setPos(id, r.lat, r.lon);
    if (filled.length) {
      changed(true);
      return toast(t('fieldsFilled')(filled.map((f) => t(FIELD_LABEL[f])).join(', ')));
    }
    paintGeo();
    if (mapView) { mapView.setMarkers(mapMarkers()); mapView.setView(r.lat, r.lon, geoUi.view.zoom); }
    toast(t('geoFound'));
  }
  function applyCoord() {
    const input = $('#geo-coord');
    const sel = crsNow();
    const zone = sel.startsWith('utm') ? +sel.slice(3) : state.meta.country === 'ES' ? 30 : 32;
    const p = Geo.parse(input ? input.value : '', { utmZone: zone });
    if (p && sel.startsWith('utm') && p.crs.startsWith('utm')) p.crs = sel;
    const ll = Geo.toLatLon(p);
    if (!ll) return toast(t('coordBad'));
    geoUi.view = { key: viewKey(), lat: ll.lat, lon: ll.lon, zoom: 18 };
    setPos('subject', ll.lat, ll.lon);
    if (mapView) { mapView.setMarkers(mapMarkers()); mapView.setView(ll.lat, ll.lon, 18); }
    if (input) input.value = '';
    toast(t('coordOk')(Geo.label(p.crs, uiLang)));
  }
  function geoSvcHtml() {
    const cfg = geocoderCfg();
    return `<span class="geo-svc">${esc(t('geoServiceLbl'))}: <b>${esc(geoServiceName(cfg))}</b> <button type="button" class="link" data-action="geo-service">${esc(t('change'))}</button>${cfg && cfg.provider === 'nominatim' ? `<small>${esc(Geocode.ATTRIBUTION)}</small>` : ''}</span>`;
  }
  function geoPanelHtml() {
    const p = geoUi.panel;
    const cfg = geocoderCfg() || {};
    if (p === 'consent' || p === 'custom') {
      return `<div class="geo-consent"><b>${esc(t('geoConsentT'))}</b><p>${esc(t('geoConsent'))}</p>
        <p class="hint">${esc(t('geoPrivacy'))} <a href="${Geocode.POLICY}" target="_blank" rel="noopener">${esc(t('geoPolicy'))}</a></p>
        ${p === 'custom' ? `<div class="geo-custom"><input id="geo-url" type="url" placeholder="${esc(t('geoCustomPh'))}" value="${esc(cfg.url || '')}">${btn('geo-custom-save', esc(t('save')), { cls: 'btn-primary' })}</div>` : ''}
        <div class="row-actions">${btn('geo-use-osm', esc(t('geoUseOsm')), { cls: 'btn-primary' })}${p === 'custom' ? '' : btn('geo-custom', esc(t('geoCustom')))}${btn('geo-off', esc(t('geoNoSearch')))}</div></div>`;
    }
    if (p === 'maps') {
      const [svc, place] = mapSvc();
      return `<div class="geo-consent"><b>${esc(t('mapsConsentT'))}</b><p>${esc(t('mapsConsent')(svc, place))}</p>
        <p class="hint">${esc(t('mapsConsentHint'))}</p>
        <div class="row-actions">${btn('maps-on', esc(t('mapsTurnOn')), { cls: 'btn-primary' })}${btn('maps-stay-off', esc(t('mapsStayOff')))}</div></div>`;
    }
    if (p === 'tiles') {
      const c = readJson(TILES_KEY) || {};
      return `<div class="geo-consent"><b>${esc(t('mapCustom'))}</b><p class="hint">${esc(t('mapCustomHint'))}</p>
        <div class="geo-custom"><input id="map-url" type="url" placeholder="https://…/{z}/{x}/{y}.png" value="${esc(c.url || '')}"><input id="map-attr" type="text" placeholder="${esc(t('mapCustomAttr'))}" value="${esc(c.attribution || '')}">${btn('map-tiles-save', esc(t('save')), { cls: 'btn-primary' })}</div></div>`;
    }
    if (p === 'busy') return `<p class="geo-msg">${esc(t('geoFinding'))}</p>`;
    if (p === 'error') return `<p class="geo-msg warn">${esc(t('geoError'))}</p>`;
    if (p === 'results') {
      const list = geoUi.results || [];
      if (!list.length) return `<p class="geo-msg warn">${esc(t('geoNone'))}</p>`;
      return `<div class="geo-res"><span class="hint">${esc(t('geoResults')(list.length))}</span>${list.map((r, k) => `<button type="button" class="geo-r" data-action="geo-result" data-i="${k}">${esc(r.label)}</button>`).join('')}</div>`;
    }
    return '';
  }
  function paintGeo(show) {
    const el = $('#geo-panel');
    if (el) el.innerHTML = geoPanelHtml();
    const svc = $('.geo-svc');
    if (svc) svc.outerHTML = geoSvcHtml();
    if (show && el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  // The map service that outside tiles would come from, and the country where it is run.
  const regionName = (c) => { try { return new Intl.DisplayNames([uiLang], { type: 'region' }).of(c); } catch (e) { return c; } };
  const placeOf = (seat) => String(seat || '').split(' · ').filter(Boolean).map(regionName).join(', ');
  function mapSvc() {
    const b = state.map && state.map.base;
    const id = b && b !== 'none' && b !== 'custom' && Maps.get(b) ? b : Maps.defaultFor(state.meta.country || 'ES');
    return [Maps.labelOf(id, uiLang), placeOf((Maps.get(id) || {}).seat)];
  }
  function refreshAll() { renderTab(); renderPreview(); }
  function setMapsAllowed(on) {
    if (on) writeJson(MAPS_KEY, { accepted: new Date().toISOString() }); else { try { localStorage.removeItem(MAPS_KEY); } catch (e) { /* ignore */ } }
    Maps.setAllowed(on);
    refreshAll();
  }
  const geocoderOn = (cfg) => !!(cfg && cfg.provider && cfg.provider !== 'off' && (cfg.provider !== 'custom' || cfg.url));
  // Privacy and outside services: what leaves the device, to whom, and the switches (kept on this device). At the first
  // start (first = true) the same window asks for a choice before any service is used: nothing is ticked in advance,
  // "Reject all" weighs as much as "Accept all", and closing the window keeps every service off.
  function openPrivacy(first) {
    const dlg = $('#dlg');
    const [svc, place] = mapSvc();
    const maps = readJson(MAPS_KEY);
    const geo = geocoderCfg();
    const geodata = readJson(GEODATA_KEY);
    const geoOn = geocoderOn(geo);
    const status = (on, when) => `<b class="priv-st${on ? ' on' : ''}">${esc(on ? t('privOn')(when ? fmtDate(when) : '—') : t('privOff'))}</b>`;
    const row = (title, desc, st, actions) => `<section class="priv-row"><div class="priv-h"><h3>${esc(title)}</h3>${st}</div><p>${esc(desc)}</p>${actions ? `<div class="row-actions">${actions}</div>` : ''}</section>`;
    const use = (key, on) => `<label class="chk"><input type="checkbox" data-priv="${key}"${on ? ' checked' : ''}><span>${esc(t('privUse'))}</span></label>`;
    const services = first
      ? row(t('privMaps'), t('privMapsDesc')(svc, place), '', use('maps', !!maps))
        + row(t('privGeo'), t('privGeoDesc'), '', `${use('geo', geoOn)}<a class="hint" href="${Geocode.POLICY}" target="_blank" rel="noopener">${esc(t('geoPolicy'))}</a>`)
        + row(t('privGeodata'), t('privGeodataDesc'), '', use('geodata', !!geodata))
      : row(t('privMaps'), t('privMapsDesc')(svc, place), status(!!maps, maps && maps.accepted), btn('priv-maps', esc(maps ? t('privTurnOff') : t('privTurnOn')), { key: maps ? 'off' : 'on', cls: maps ? '' : 'btn-primary' }))
        + row(t('privGeo'), t('privGeoDesc'), status(geoOn, geo && geo.accepted), geoOn ? btn('priv-geo-off', esc(t('privTurnOff'))) : `<span class="hint">${esc(t('privGeoHow'))}</span>`)
        + row(t('privGeodata'), t('privGeodataDesc'), status(!!geodata, geodata && geodata.accepted), btn('priv-geodata', esc(geodata ? t('privTurnOff') : t('privTurnOn')), { key: geodata ? 'off' : 'on' }));
    if (first) dlg.dataset.first = '1'; else delete dlg.dataset.first;
    dlg.classList.toggle('priv-first', !!first);
    dlg.setAttribute('aria-labelledby', 'dlg-title');
    dlg.innerHTML = `<div class="dlg-head"><h2 id="dlg-title">${esc(t('privT'))}</h2><button type="button" class="btn btn-icon" data-action="dlg-close" aria-label="${esc(t('bClose'))}">✕</button></div>
      <div class="dlg-body priv">${first ? `<p class="priv-lead">${esc(t('privFirstLead'))}</p>` : ''}<p class="hint">${esc(t('privIntro'))}</p>
      ${services}
      ${row(t('privAi'), t('privAiDesc'), '', '')}
      ${row(t('privReports'), t('privReportsDesc'), '', '')}</div>
      ${first ? `<div class="dlg-foot">${btn('priv-save', esc(t('privSaveChoices')))}<span class="grow"></span>${btn('priv-reject-all', esc(t('privRejectAll')), { cls: 'btn-primary' })}${btn('priv-accept-all', esc(t('privAcceptAll')), { cls: 'btn-primary' })}</div>` : ''}`;
    if (!dlg.open) { if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', ''); }
  }
  // The privacy window of the first start was answered or closed: it is not shown again on this device.
  function privacyNoticeDone() {
    const d = $('#dlg');
    if (!d.dataset.first) return;
    delete d.dataset.first;
    d.classList.remove('priv-first');
    writeJson(NOTICE_KEY, { seen: new Date().toISOString() });
  }
  // The choice of the first start: each service on (with the date) or off; services already set the same way stay as they are.
  function applyPrivacy(choice) {
    const now = new Date().toISOString();
    const geo = geocoderCfg();
    if (choice.geo && !geocoderOn(geo)) writeJson(GEO_KEY, { provider: 'nominatim', accepted: now });
    if (!choice.geo && geocoderOn(geo)) writeJson(GEO_KEY, { provider: 'off' });
    if (choice.geodata && !readJson(GEODATA_KEY)) writeJson(GEODATA_KEY, { accepted: now });
    if (!choice.geodata) { try { localStorage.removeItem(GEODATA_KEY); } catch (e) { /* ignore */ } }
    closeDialog();
    if ($('#geo-panel')) paintGeo();
    if (choice.maps !== !!readJson(MAPS_KEY)) setMapsAllowed(choice.maps);
  }
  function mapBaseSelect() {
    const cc = state.meta.country || 'ES';
    const cur = (state.map && state.map.base) || Maps.defaultFor(cc);
    const opts = Maps.forCountry(cc).map((id) => [id, Maps.labelOf(id, uiLang)]).concat([['none', t('mapNone')], ['custom', t('mapCustom')]]);
    return `<label class="loc-base"><span>${esc(t('mapBase'))}</span><select id="map-base">${opts.map(([v, l]) => `<option value="${v}"${v === cur ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;
  }
  function coordRow() {
    const sys = Geo.systemsFor(state.meta.country || 'ES', state.subject.lon);
    const cur = crsNow();
    return `<div class="loc-coords"><label class="fld"><span>${esc(t('coordSys'))}</span><select id="geo-crs">${sys.map((c) => `<option value="${c}"${c === cur ? ' selected' : ''}>${esc(Geo.label(c, uiLang))}</option>`).join('')}</select></label>
      <label class="fld grow"><span>${esc(t('coordIn'))}</span><input id="geo-coord" type="text" autocomplete="off" spellcheck="false" placeholder="${esc(t('coordPh'))}"></label>${btn('coord-apply', esc(t('coordGo')))}
      <div class="loc-now"><span>${esc(t('coordNow'))}</span> <b data-live="coord-now"></b></div></div>`;
  }

  function tabImmobile() {
    const s = 'subject';
    const S = state.subject;
    const resi = ['residential', 'hospitality'].includes((Taxonomy.categoryOf((S.propertyType || {}).code) || { id: 'residential' }).id);
    const pois = (S.pois || []).map((p, i) => `<tr>
      <td class="poi-n"><span class="mv-num">${i + 1}</span></td>
      <td><input data-bind="${s}.pois.${i}.name" data-kind="ltext" value="${esc(I18N.loc(p.name, RL()))}" aria-label="${esc(t('poiName'))}" placeholder="${esc(t('poiNamePh'))}"></td>
      <td class="num"><input data-bind="${s}.pois.${i}.lat" data-kind="num" inputmode="decimal" value="${esc(fmtIn(p.lat))}" aria-label="${esc(t('lat'))}"></td>
      <td class="num"><input data-bind="${s}.pois.${i}.lon" data-kind="num" inputmode="decimal" value="${esc(fmtIn(p.lon))}" aria-label="${esc(t('lon'))}"></td>
      <td class="num"><span data-live="poi-d" data-i="${i}"></span></td>
      <td class="x nowrap">${btn('poi-search', esc(t('poiFind')), { i })}${btn('poi-place', esc(t('poiPlace')), { i })}${btn('poi-del', ic('trash'), { i, cls: 'btn-icon btn-del', title: t('del') })}</td></tr>`).join('');
    // Location in three groups: the address (and the search from it), the position on the map (the map has its own zoom,
    // centre and "my position" controls, so they are not repeated under it), the coordinates for whoever needs them.
    return card(t('cLocation'), `<div class="grid">
      ${fText(s + '.address', t('address'), { cls: 'span-all' })}${fText(s + '.floorDoor', t('floorDoor'), { ph: '3º 1ª' })}${fText(s + '.zone', t('zone'))}
      ${fText(s + '.postalCode', t('postal'), { type: 'numeric' })}${fText(s + '.municipality', t('town'))}${fText(s + '.province', t('province'))}${fText(s + '.region', t('region'))}</div>
      <div class="loc-find">${btn('geo-search', esc(t('geoFind')), { cls: 'btn-primary' })}${geoSvcHtml()}</div>
      <div id="geo-panel" aria-live="polite">${geoPanelHtml()}</div>
      <div class="sec-t">${esc(t('locMapT'))}</div>
      <div class="loc-map${mapBig ? ' big' : ''}" data-map="location"></div>
      <div class="loc-tools">${btn('geo-place', esc(hasPos(S) ? t('geoMove') : t('geoPlace')))}<button type="button" class="btn btn-sm" data-action="map-size" aria-pressed="${mapBig}">${esc(t(mapBig ? 'mapSmaller' : 'mapBigger'))}</button><span class="grow"></span>${Maps.isAllowed() ? mapBaseSelect() : `<span class="loc-base"><span>${esc(t('mapsOffLbl'))}</span>${btn('maps-consent', esc(t('mapsTurnOn')))}</span>`}</div>
      <p class="hint">${esc(t('geoDragHint'))}</p>
      <details class="loc-adv"${geoUi.adv ? ' open' : ''}><summary>${esc(t('locCoordT'))}</summary>${coordRow()}
      <div class="grid">${fNum(s + '.lat', t('lat'), { ph: '45,29750' })}${fNum(s + '.lon', t('lon'), { ph: '12,03670' })}</div></details>
      <div class="sec-t">${esc(t('locDescT'))}</div>
      <div class="grid">${fLText(s + '.locationDesc', t('locationDesc'), { cls: 'span-all', area: true, rows: 5 })}
      ${fLText(s + '.environmentDesc', t('environmentDesc'), { cls: 'span-all', area: true, rows: 4 })}</div>`) +
      card(t('cPois'), `<div class="tscroll"><table class="edt poi-t"><thead><tr><th></th><th>${esc(t('poiName'))} ${langTag()}</th><th class="num">${esc(t('lat'))}</th><th class="num">${esc(t('lon'))}</th><th class="num">${esc(t('dist'))}</th><th></th></tr></thead><tbody>${pois}</tbody></table></div>
      <div class="row-actions">${btn('poi-add', esc(t('addPoi')))}</div>`, t('poisNote')) +
      card(t('cFeatures'), `<div class="grid grid-3">
      ${fLText(s + '.type', t('type'), { ph: 'Piso' })}${fSel(s + '.floor', t('floor'), floorOpts())}${fNum(s + '.yearBuilt', t('year'), { int: true })}
      ${fSel(s + '.condition', t('condition'), conditionOpts())}${fSel(s + '.orientation', t('orientation'), orientOpts())}${fNum(s + '.bedrooms', resi ? t('bedrooms') : t('roomsN'), { int: true })}
      ${fNum(s + '.bathrooms', resi ? t('bathrooms') : t('wcN'), { int: true })}${fNum(s + '.terraceM2', t('terrace'), { unit: 'm²' })}${fNum(s + '.galleryM2', t('gallery'), { unit: 'm²' })}
      ${fNum(s + '.communityFee', t('fees'), { unit: t('feesUnit') })}${fNum(s + '.neighbours', t('neighbours'), { int: true })}${fSel(s + '.energyCert', t('energy'), ENERGY)}
      ${fNum(s + '.energyKwh', t('consumption'), { unit: 'kWh' })}${fText(s + '.electricity', t('electricity'), { ph: '220 V' })}${fText(s + '.gas', t('gas'))}
      ${fLText(s + '.buildingDesc', t('buildingDesc'), { cls: 'span-all', area: true, rows: 2 })}</div>`) +
      card(t('cEquip'), `<div class="checks">${Object.keys(t('eq')).map((k) => fChk(`${s}.${k}`, t('eq')[k])).join('')}</div>
      ${fLText(s + '.annexDesc', t('annexDesc'), { area: true, rows: 2, cls: 'mt' })}`, t('equipNote')) +
      card(t('cNotes'), fArea(s + '.notes', t('notes'), { rows: 2 }));
  }

  function tabSuperfici() {
    const s = 'subject';
    const rooms = (state.subject.rooms || []).map((r, i) => `<tr>
      <td><input data-bind="${s}.rooms.${i}.name" data-kind="ltext" value="${esc(I18N.loc(r.name, RL()))}" aria-label="${esc(t('room'))}"></td>
      <td class="num"><input data-bind="${s}.rooms.${i}.m2" data-kind="num" inputmode="decimal" value="${esc(fmtIn(r.m2))}" aria-label="m²"></td>
      <td class="x">${btn('room-del', ic('trash'), { i, cls: 'btn-icon btn-del', title: t('del') })}</td></tr>`).join('');
    return card(t('cRooms'), `<p class="hint">${esc(t('roomsHint'))}</p>
      <table class="edt"><thead><tr><th>${esc(t('room'))} ${langTag()}</th><th class="num">m²</th><th></th></tr></thead><tbody>${rooms}</tbody>
      <tfoot><tr><td>${esc(t('usefulInt'))}</td><td class="num" data-live="rooms-total"></td><td></td></tr></tfoot></table>
      <div class="row-actions">${btn('room-add', esc(t('addRoom')))}</div>`) +
      card(t('cBuilt'), `<div class="grid">${fNum(s + '.areaBuilt', t('built'), { unit: 'm²' })}${fNum(s + '.areaBuiltCommon', t('builtCommon'), { unit: 'm²' })}</div>
      <p class="hint" style="margin-top:8px">${esc(t('refAreaNote'))} <b data-live="ref-area"></b></p>`) +
      card(t('cCadastre'), `<div class="grid">
      ${fText(s + '.cadastralRef', t('cadRef'))}${fText(s + '.cadastralRefAlt', t('cadAlt'))}${fText(s + '.cadastralParcel', t('parcel'))}${fText(s + '.cadastralAddress', t('cadAddress'))}
      ${fLText(s + '.cadastralUse', t('use'))}${fNum(s + '.cadastralYear', t('cadYear'), { int: true })}${fNum(s + '.cadastralPrivate', t('cadPrivate'), { unit: 'm²' })}
      ${fNum(s + '.cadastralCommon', t('cadCommon'), { unit: 'm²' })}${fNum(s + '.cadastralShare', t('cadShare'), { unit: '%' })}</div>`, 'Catastro');
  }

  function compSummary(c, r) {
    return `<b>${r && r.valid ? N(r.unitHomog) + ' ' + CURS() + '/m²' : '—'}</b><span>${esc(EUR(c.price))} · ${r && r.unitAsk ? N(r.unitAsk) + ' ' + CURS() + '/m²' : '—'}</span>`;
  }

  // Comparison view: the whole sample in one table next to the cards. The values come from the engine (res.comps), nothing
  // is computed here. Asking price → base (after negotiation, date and annexes) → factors → adjusted value, left to right.
  function compTable() {
    const sign = (x) => (x > 0.0005 ? '+' : x < -0.0005 ? '−' : '');
    const rows = state.comparables.map((c, i) => {
      const r = res.comps[i] || {};
      const on = c.include !== false;
      const cond = c.condition ? (conditionOpts().find(([k]) => k === c.condition) || [])[1] : '';
      const src = MCA.SOURCES[c.source] ? L3(MCA.SOURCES[c.source]) : '';
      const gross = r.grossAdj != null ? Math.round(r.grossAdj * 100) : null;
      const net = r.valid && r.kTotal != null ? (r.kTotal - 1) * 100 : null;
      const high = on && gross != null && gross > 35;
      const km = r.distanceKm != null ? `${N(r.distanceKm, r.distanceKm < 1 ? 2 : 1)} km` : '';
      return `<tr class="${on ? '' : 'off'}${c.id === selComp ? ' sel' : ''}">
        <td class="ct-use"><button type="button" class="tgl${on ? ' on' : ''}" role="switch" aria-checked="${on}" data-action="comp-toggle" data-i="${i}" aria-label="${esc(t('ctUseOf')(c.id || '?'))}"><i aria-hidden="true"></i></button></td>
        <th scope="row"><button type="button" class="ct-id" data-action="comp-open" data-i="${i}" aria-label="${esc(t('ctOpen')(c.id || '?'))}">${esc(c.id || '?')}</button></th>
        <td class="ct-2"><span>${esc(c.address || '—')}</span><small>${esc([c.zone, km].filter(Boolean).join(' · '))}</small></td>
        <td class="num ct-2n"><span>${r.price ? EUR(r.price) : '—'}</span>${r.unitAsk ? `<small>${N(r.unitAsk)} ${CURS()}/m²</small>` : ''}</td>
        <td class="num">${r.area ? `${N(r.area, r.area % 1 ? 1 : 0)} m²` : '—'}</td>
        <td class="num">${r.unitBase ? N(r.unitBase) : '—'}</td>
        <td class="num${high ? ' warn' : ''}"${gross != null ? ` title="${esc(t('ctGross')(gross))}"` : ''}>${net != null ? `${sign(net)}${N(Math.abs(net), 1)} %` : '—'}${high ? `<span class="sr-only"> (${esc(t('ctGross')(gross))})</span>` : ''}</td>
        <td class="num ct-key">${r.valid ? N(r.unitHomog) : '—'}</td>
        <td class="ct-2 ct-src"><span>${esc(c.sourceName || src || '—')}</span>${c.sourceName && src ? `<small>${esc(src)}</small>` : ''}</td>
        <td>${esc(cond || '—')}</td></tr>`;
    }).join('');
    // The adjusted value comes right after the asking values; source and condition close the row (they may need a scroll).
    const head = [[t('ctUse'), 'ct-use', true], [t('id'), 'ct-idc'], [t('ctPlace')], [t('ctAsk'), 'num'], [t('ctArea'), 'num'],
      [t('ctUnitBase'), 'num'], [t('ctFactors'), 'num'], [t('ctUnitHomog'), 'num ct-key'], [t('ctSource')], [t('ctCond')]];
    return `<div class="tscroll ct-wrap"><table class="ct"><caption class="sr-only">${esc(t('ctT'))}</caption><thead><tr>${head.map(([l, c, hide]) => `<th scope="col"${c ? ` class="${c}"` : ''}>${hide ? `<span class="sr-only">${esc(l)}</span>` : esc(l)}</th>`).join('')}</tr></thead>
      <tbody>${rows}</tbody></table></div><p class="hint ct-legend">${esc(t('ctLegend'))}</p>`;
  }

  function tabComparabili() {
    const list = state.comparables.map((c, i) => {
      const r = res.comps[i];
      const p = `comparables.${i}`;
      const url = AppCore.safeUrl(c.url);
      return `<details class="comp${r && r.include ? '' : ' excluded'}" data-i="${i}"${c.id === selComp ? ' open' : ''}>
      <summary><span class="cbadge">${esc(c.id || '?')}</span><span class="ct"><b>${esc(c.address || t('newComp'))}</b><span>${esc([c.zone, c.sourceName].filter(Boolean).join(' · '))}</span></span><span class="cr" data-live="comp-sum" data-i="${i}">${compSummary(c, r)}</span></summary>
      <div class="cbody">
        <div class="row-actions comp-actions">
          <button type="button" class="pill-toggle ${c.include !== false ? 'on' : 'off'}" data-action="comp-toggle" data-i="${i}">${esc(c.include !== false ? t('inCalc') : t('refOnly'))}</button>
          <span class="grow"></span>
          ${btn('comp-suggest', esc(t('suggest')), { i })}${btn('comp-up', '↑', { i, cls: 'btn-icon', title: t('moveUp') })}${btn('comp-down', '↓', { i, cls: 'btn-icon', title: t('moveDown') })}
          ${btn('comp-dup', esc(t('duplicate')), { i })}${btn('comp-del', esc(t('del')), { i, cls: 'btn-danger' })}
        </div>
        ${c.include === false ? fLText(p + '.excludeReason', t('excludeReason'), { area: true, rows: 2 }) : ''}
        <div class="sec-t">${esc(t('secPrice'))}</div>
        <div class="grid grid-3">${fNum(p + '.price', t('price'), { unit: CURS() })}${fNum(p + '.areaBuilt', t('builtShort'), { unit: 'm²' })}${fNum(p + '.areaUseful', t('usefulShort'), { unit: 'm²' })}</div>
        <div class="sec-t">${esc(t('secId'))}</div>
        <div class="grid">
          ${fText(p + '.id', t('id'))}${fText(p + '.zone', t('zone'))}${fText(p + '.address', t('address'), { cls: 'span-all' })}
          ${fSel(p + '.source', t('sourceType'), sourceOpts())}${fText(p + '.sourceName', t('sourceName'))}
          ${fText(p + '.url', t('url'), { cls: 'span-all', type: 'url' })}
          ${fDate(p + '.date', t('date'))}${fNum(p + '.negotiation', t('negOpt'), { ph: t('auto') })}
          ${fNum(p + '.lat', t('lat'))}${fNum(p + '.lon', t('lon'))}
        </div>
        <div class="row-actions">${fChk(p + '.approxLocation', t('approx'))}${url ? `<a class="btn btn-sm" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(t('openListing'))}</a>` : ''}</div>
        <div class="sec-t">${esc(t('secChar'))}</div>
        <div class="grid grid-3">
          ${fSel(p + '.floor', t('floor'), floorOpts())}${fNum(p + '.bedrooms', t('bedrooms'), { int: true })}${fNum(p + '.bathrooms', t('bathrooms'), { int: true })}
          ${fNum(p + '.yearBuilt', t('year'), { int: true })}${fSel(p + '.condition', t('condition'), conditionOpts())}${fSel(p + '.orientation', t('orientation'), orientOpts())}
          ${fNum(p + '.terraceM2', t('terraces'), { unit: 'm²' })}${fNum(p + '.gardenM2', t('privGarden'), { unit: 'm²' })}${fSel(p + '.energyCert', t('energy'), ENERGY)}
          ${fNum(p + '.energyKwh', t('consumption'), { unit: 'kWh' })}${fNum(p + '.communityFee', t('feesShort'), { unit: CURS() })}
        </div>
        <div class="checks" style="margin-top:8px">
          ${fChk(p + '.elevator', t('eq').elevator)}${fChk(p + '.parking', t('parkingInc'))}${fChk(p + '.storage', t('storageInc'))}
          ${fChk(p + '.ac', t('eq').ac)}${fChk(p + '.heating', t('eq').heating)}${fChk(p + '.pool', t('eq').pool)}
          ${fChk(p + '.garden', t('eq').garden)}${fChk(p + '.newBuild', t('newBuild'))}
        </div>
        <div class="sec-t">${esc(t('secDesc'))}</div>
        ${fLText(p + '.description', t('description'), { area: true, rows: 2 })}
      </div></details>`;
    }).join('');
    const nIn = state.comparables.filter((c) => c.include !== false).length;
    return `<section class="card"><h3>${esc(t('sampleT'))}<span class="grow"></span>${btn('comp-add', esc(t('addComp')), { cls: 'btn-primary' })}</h3>
      <p class="hint" style="margin:0 0 6px"><b>${esc(t('compsCount')(state.comparables.length, nIn))}</b></p><p class="hint" style="margin:0">${esc(t('sampleHint'))}</p>
      ${state.comparables.length ? compTable() : ''}</section>` +
      (list || `<div class="empty">${esc(t('noComps'))}</div>`);
  }

  function matrixHtml() {
    const cols = state.comparables.map((c, i) => ({ c, r: res.comps[i], i }));
    const sym = { 2: '++', 1: '+', 0: '=', '-1': '−', '-2': '−−' };
    const head = cols.map((x) => `<th class="${x.c.id === selComp ? 'sel' : ''}">${esc(x.c.id)}${x.r.include ? '' : '*'}</th>`).join('');
    const rows = state.factors.map((f) => `<tr><td>${esc(factorLabel(f))}</td>${cols.map((x) => {
      const fr = x.r.factors.find((y) => y.id === f.id) || { level: 0 };
      return `<td class="${x.c.id === selComp ? 'sel' : ''}"><span class="lv lv${fr.level}">${sym[fr.level]}</span></td>`;
    }).join('')}</tr>`).join('');
    const foot = (label, fn) => `<tr><td>${esc(label)}</td>${cols.map((x) => `<td class="${x.c.id === selComp ? 'sel' : ''}">${fn(x)}</td>`).join('')}</tr>`;
    return `<table class="mx"><thead><tr><th>${esc(t('factor'))}</th>${head}</tr></thead><tbody>${rows}</tbody><tfoot>
      ${foot(t('kTot'), (x) => N(x.r.kTotal, 3))}${foot(t('gross'), (x) => N(x.r.grossAdj * 100) + '%')}
      ${foot(t('homog'), (x) => (x.r.valid ? N(x.r.unitHomog) : '—'))}${foot(t('weight'), (x) => N(x.r.weight, 2))}</tfoot></table>
      <p class="hint" style="margin:6px 0 0">${esc(t('matrixNote'))}</p>`;
  }

  function tabOmog() {
    if (!state.comparables.length) return `<div class="empty">${esc(t('needComps'))}</div>`;
    if (!state.comparables.some((c) => c.id === selComp)) selComp = state.comparables[0].id;
    const i = state.comparables.findIndex((c) => c.id === selComp);
    const c = state.comparables[i];
    const uniform = state.settings.scalePreset === 'uniform10';
    const pills = state.comparables.map((x, j) => `<button type="button" class="${x.id === selComp ? 'active' : ''}${res.comps[j].include ? '' : ' ref'}" data-action="omog-sel" data-id="${esc(x.id)}">${esc(x.id)}</button>`).join('');
    const frows = state.factors.map((f) => {
      const lv = (c.ratings || {})[f.id] || 0;
      return `<div class="frow"><div class="fl">${esc(factorLabel(f))}<small>${esc(t('perLevel')(N((uniform ? 0.1 : f.delta) * 100, 1)))}</small></div>
        <select data-bind="comparables.${i}.ratings.${f.id}" data-kind="seln" aria-label="${esc(factorLabel(f))}">${levelOpts().map((o) => `<option value="${o[0]}"${o[0] === lv ? ' selected' : ''}>${esc(o[1])}</option>`).join('')}</select>
        <span class="kval" data-live="k" data-f="${f.id}"></span>
        <input class="rnote" data-bind="comparables.${i}.ratingNotes.${f.id}" aria-label="${esc(factorLabel(f) + ' · ' + t('notePh'))}" data-kind="ltext" value="${esc(I18N.loc((c.ratingNotes || {})[f.id], RL()))}" placeholder="${esc(t('notePh'))} · ${RL().toUpperCase()}"></div>`;
    }).join('');
    const deltas = state.factors.map((f, j) => `<tr><td>${esc(factorLabel(f))}</td><td class="num"><input data-bind="factors.${j}.delta" aria-label="${esc(factorLabel(f) + ' · %')}" data-kind="pct" inputmode="decimal" value="${esc(fmtIn(Math.round(f.delta * 10000) / 100))}"${uniform ? ' disabled' : ''}></td><td class="num">±${N((uniform ? 0.1 : f.delta) * 200, 1)}%</td><td>${esc(MCA.factorOrigin(f) === 'default' ? t('originDefault') : t('originValuer'))}</td><td><input data-bind="factors.${j}.source" aria-label="${esc(factorLabel(f) + ' · ' + t('deltaSource'))}" data-kind="text" value="${esc(f.source || '')}" placeholder="${esc(t('deltaSource'))}"></td></tr>`).join('');
    return card(t('scaleT'), `<div class="grid">
      ${fSel('settings.scalePreset', t('scale'), [['weighted', t('scaleW')], ['uniform10', t('scaleU')]])}
      <div class="fld"><span>${esc(t('autoLevels'))}</span>${btn('suggest-all', esc(t('suggestAll')))}</div></div>
      <p class="hint" style="margin-top:8px">${esc(t('suggestHint'))}</p>`) +
      card(t('matrixT'), `<div id="mx-wrap" class="tscroll">${matrixHtml()}</div>`) +
      card(t('compT')(c.id), `<div class="comp-pills">${pills}</div><p class="hint">${esc(c.address || '')} · ${esc(c.zone || '')} — ${t('rateHint')}</p>
      ${frows}<div class="row-actions">${btn('comp-suggest', esc(t('suggestFor')(c.id)), { i })}</div>`, '', '<span class="sub" data-live="omog-res"></span>') +
      card(t('deltasT'), `<table class="edt"><thead><tr><th>${esc(t('factor'))}</th><th class="num">${esc(t('deltaLevel'))}</th><th class="num">${esc(t('max'))}</th><th>${esc(t('deltaOrigin'))}</th><th>${esc(t('deltaSource'))}</th></tr></thead><tbody>${deltas}</tbody></table>`, uniform ? t('deltasOff') : t('deltasOn'));
  }

  function tabMercato(part) {
    const m = 'market';
    const mk = state.market;
    const ser = (mk.series || []).map((p, i) => `<tr><td><input data-bind="${m}.series.${i}.m" aria-label="${esc(t('monthCol'))}" data-kind="text" value="${esc(p.m)}" placeholder="2026-10"></td><td class="num"><input data-bind="${m}.series.${i}.v" aria-label="${esc(CURS() + '/m² ' + (p.m || ''))}" data-kind="num" inputmode="decimal" value="${esc(fmtIn(p.v))}"></td><td class="x">${btn('ser-del', ic('trash'), { i, cls: 'btn-icon btn-del', title: t('del') })}</td></tr>`).join('');
    const dis = (mk.districts || []).map((d, i) => `<tr><td><input data-bind="${m}.districts.${i}.name" aria-label="${esc(t('district'))}" data-kind="text" value="${esc(d.name)}"></td><td class="num"><input data-bind="${m}.districts.${i}.v" aria-label="${esc(CURS() + '/m² ' + (d.name || ''))}" data-kind="num" inputmode="decimal" value="${esc(fmtIn(d.v))}"></td><td class="num"><input data-bind="${m}.districts.${i}.yoy" aria-label="${esc(t('yoyCol') + ' ' + (d.name || ''))}" data-kind="pct" inputmode="decimal" value="${esc(d.yoy == null ? '' : fmtIn(Math.round(d.yoy * 1000) / 10))}"></td><td class="x">${btn('dis-del', ic('trash'), { i, cls: 'btn-icon btn-del', title: t('del') })}</td></tr>`).join('');
    const refs = (mk.references || []).map((r, i) => `<tr><td><input data-bind="${m}.references.${i}.label" aria-label="${esc(t('refLabel'))}" data-kind="ltext" value="${esc(I18N.loc(r.label, RL()))}"></td><td><input data-bind="${m}.references.${i}.value" aria-label="${esc(t('refValue'))}" data-kind="ltext" value="${esc(I18N.loc(r.value, RL()))}"></td><td class="x">${btn('ref-del', ic('trash'), { i, cls: 'btn-icon btn-del', title: t('del') })}</td></tr>`).join('');
    const all = [card(t('cIndex'), `<div class="grid">
      ${fLText(m + '.source', t('source'), { cls: 'span-all' })}${fText(m + '.sourceUrl', t('sourceUrl'), { cls: 'span-all', type: 'url' })}
      ${fLText(m + '.month', t('month'), { ph: t('monthPh') })}${fNum(m + '.cityAvg', t('cityAvg'), { unit: CURS() + '/m²' })}
      ${fPct(m + '.mom', t('mom'))}${fPct(m + '.qoq', t('qoq'))}${fPct(m + '.yoy', t('yoy'))}</div>`),
      card(t('cSeries'), `<table class="edt"><thead><tr><th>${esc(t('monthCol'))}</th><th class="num">${CURS()}/m²</th><th></th></tr></thead><tbody>${ser}</tbody></table><div class="row-actions">${btn('ser-add', esc(t('addMonth')))}</div>`),
      card(t('cDistricts'), `<div class="tscroll"><table class="edt"><thead><tr><th>${esc(t('district'))}</th><th class="num">${CURS()}/m²</th><th class="num">${esc(t('yoyCol'))}</th><th></th></tr></thead><tbody>${dis}</tbody></table></div><div class="row-actions">${btn('dis-add', esc(t('addDistrict')))}</div>`),
      card(t('cRefs'), `<div class="tscroll"><table class="edt"><thead><tr><th>${esc(t('refLabel'))} ${langTag()}</th><th>${esc(t('refValue'))}</th><th></th></tr></thead><tbody>${refs}</tbody></table></div><div class="row-actions">${btn('ref-add', esc(t('addRef')))}</div>`),
      card(t('cZone'), `${fLText(m + '.zoneNote', t('zoneNote'), { area: true, rows: 3 })}${fLText(m + '.commentary', t('commentary'), { area: true, rows: 3, cls: 'mt' })}`)];
    return part === 'sources' ? all[3] : all.filter((x, k) => k !== 3).join('');
  }

  function resultLive() {
    const st = res.stats;
    const ci = Math.round((st.ciLevel || 0.95) * 100);
    const w = res.warnings.map((x) => `<li>${esc(L3(x))}</li>`).join('');
    const contrib = state.comparables.map((c, i) => ({ c, r: res.comps[i] })).filter((x) => x.r.include);
    const sw = contrib.reduce((s, x) => s + x.r.weight, 0) || 1;
    const S = t('st');
    return `<div class="result-hero"><div class="lbl">${esc(t('resValue'))}</div><div class="val">${EUR(res.total)}</div>
      <div class="words">${res.total ? esc(I18N.currencyWords(res.total, uiLang)) : ''}</div>
      <div class="meta"><div><span>${esc(t('resUnit'))}</span><b>${res.unitValue != null ? `${N(res.unitValue)} ${CURS()}/m²` : '—'}</b></div><div><span>${esc(t('resRange')(ci))}</span><b>${res.rangeLow != null ? EUR(res.rangeLow) + ' – ' + EUR(res.rangeHigh) : '—'}</b></div><div><span>${esc(t('resListing'))}</span><b>${EUR(res.listingPrice)}</b></div></div></div>
      ${w ? `<section class="card"><h3>${esc(t('warnings'))}</h3><ul class="warn-list">${w}</ul></section>` : ''}
      <section class="card"><h3>${esc(t('statsT'))}</h3><div class="kv-live">
        <span>${esc(S.n)}</span><b>${st.n}</b><span>${esc(S.mean)}</span><b>${N(st.mean)} ${CURS()}/m²</b><span>${esc(S.median)}</span><b>${N(st.median)} ${CURS()}/m²</b>
        <span>${esc(S.trimmed)}</span><b>${N(st.trimmed)} ${CURS()}/m²</b><span>${esc(S.weighted)}</span><b>${N(st.weighted)} ${CURS()}/m²</b><span>${esc(S.std)}</span><b>${N(st.std)} ${CURS()}/m²</b>
        <span>${esc(S.cv)}</span><b>${st.cv != null ? N(st.cv * 100, 1) + '%' : '—'}</b><span>${esc(S.minmax)}</span><b>${N(st.min)} – ${N(st.max)} ${CURS()}/m²</b>
        <span>${esc(S.refArea)}</span><b>${res.refArea != null ? N(res.refArea, res.refArea % 1 ? 2 : 0) + ' m²' : '—'}</b><span>${esc(S.split)}</span><b>${EUR(res.dwellingValue == null ? null : Math.round(res.dwellingValue))} + ${EUR(res.annexValue)}</b></div></section>
      <section class="card"><h3>${esc(t('contribT'))}</h3><div class="tscroll"><table class="edt"><thead><tr><th>ID</th><th class="num">${esc(t('base'))}</th><th class="num">K</th><th class="num">${esc(t('homog'))}</th><th class="num">${esc(t('weight'))}</th></tr></thead><tbody>
        ${contrib.map((x) => `<tr><td><b>${esc(x.c.id)}</b> <span class="muted">${esc(x.c.zone || '')}</span></td><td class="num">${N(x.r.unitBase)}</td><td class="num">${N(x.r.kTotal, 3)}</td><td class="num"><b>${N(x.r.unitHomog)}</b></td><td class="num">${N(x.r.weight / sw * 100, 1)}%</td></tr>`).join('')}
      </tbody></table></div></section>`;
  }

  function qualityCard() {
    const rv = Review.run(state, res);
    const cls = { ok: 'ok', info: 'info', warn: 'warn', error: 'err' };
    const order = ['error', 'warn', 'info'];
    const issues = rv.checks.filter((c) => c.level !== 'ok').sort((a, b) => order.indexOf(a.level) - order.indexOf(b.level));
    const oks = rv.checks.filter((c) => c.level === 'ok');
    const L = L3;
    const row = (c) => `<li class="q-${cls[c.level]}"><span class="q-dot"></span><div><b>${esc(L(c.title))}</b><span class="q-area">${esc(t('areas')[c.area])} · ${esc(t('levels')[c.level])}</span>${L(c.detail) ? `<p>${esc(L(c.detail))}</p>` : ''}</div>${c.level !== 'ok' && c.fix ? btn('goto-tab', esc(t('goFix')), { key: c.fix.tab }) : '<span></span>'}</li>`;
    return `<section class="card quality" id="quality"><h3>${esc(t('qualityT'))}<span class="grow"></span>${window.ValestaAI ? btn('ai-review', `<span class="ai-spark">✦</span> ${esc(t('aiReview'))}`) : ''}</h3>
      <div class="q-top"><div class="q-ring g-${rv.grade}" style="--p:${rv.score}"><b>${rv.score}</b><span>${rv.grade}</span></div>
      <div class="q-counts">${['error', 'warn', 'info', 'ok'].map((l) => `<span class="q-${cls[l]}"><i></i>${rv.counts[l]} ${esc(t('levels')[l])}</span>`).join('')}</div></div>
      ${issues.length ? `<ul class="q-list">${issues.map(row).join('')}</ul>` : ''}
      <details class="q-ok"><summary>${esc(t('showOk')(oks.length))}</summary><ul class="q-list">${oks.map(row).join('')}</ul></details></section>`;
  }
  function robustnessCard() {
    const key = JSON.stringify([state.subject, state.comparables, state.settings, state.factors, state.meta.valuationDate]);
    if (robCache.key !== key) robCache = { key, value: res.total ? MCA.robustness(Object.assign({}, state, { photos: [] }), { n: 600 }) : null };
    const rob = robCache.value;
    if (!rob || !rob.mc || !rob.loo.length) return card(t('robT'), `<p class="hint" style="margin:0">${esc(t('robNone'))}</p>`);
    const mc = rob.mc;
    const half = res.total ? (mc.p90 - mc.p10) / 2 / res.total : 0;
    const level = rob.looMaxAbs <= 0.03 && half <= 0.05 ? 'robust' : rob.looMaxAbs <= 0.06 && half <= 0.1 ? 'moderate' : 'sensitive';
    const k = (v) => EUR(Math.round(v / 1000) * 1000);
    const prev = Charts.getLocale();
    Charts.setLocale(uiLang);
    try {
      const hist = Charts.histogram({ bins: mc.hist, band: [mc.p10, mc.p90], markers: [{ v: res.totalRaw, label: t('kValue') }], width: 560, height: 170, title: t('robT') });
      const bars = Charts.divergingBars({ items: rob.loo.map((l) => ({ label: l.id, value: l.delta })), width: 560, labelW: 54, title: t('robLoo') });
      return card(t('robT'), `<div class="rob-kpis"><div><span>P10</span><b>${k(mc.p10)}</b></div><div><span>P50</span><b>${k(mc.p50)}</b></div><div><span>P90</span><b>${k(mc.p90)}</b></div><div><span>${esc(t('robSpread'))}</span><b>±${N(half * 100, 1)}%</b></div></div>
        <span class="rob-badge rob-${level}">${esc(t('robLevel')[level])} · ${esc(t('robLoo'))}: ${N(rob.looMaxAbs * 100, 1)}%</span>
        <div class="rob-chart">${hist}</div><div class="rob-chart">${bars}</div><p class="hint" style="margin:8px 0 0">${esc(t('robHint'))}</p>`);
    } finally { Charts.setLocale(prev); }
  }

  function tabRisultato() {
    const st = 'settings';
    const E = t('est');
    const B = t('basis');
    return `<div data-live="result">${resultLive()}</div>` +
      card(t('paramsT'), `<div class="grid">
      ${fSel(st + '.estimator', t('estimator'), [['weighted', E.weighted], ['mean', E.mean], ['median', E.median], ['trimmed', E.trimmed]])}
      ${fSel(st + '.ciLevel', t('ciLevel'), [[0.8, '80%'], [0.9, '90%'], [0.95, '95%']])}
      ${fSel(st + '.areaBasis', t('areaBasis'), [['built', B.built], ['builtCommon', B.builtCommon], ['useful', B.useful]])}
      ${fNum(st + '.builtToUseful', t('ratio'), { ph: '1,18' })}${fNum(st + '.negotiationDefault', t('negotiation'), { ph: '0,94' })}
      ${fSel(st + '.rounding', t('rounding'), [100, 500, 1000, 5000, 10000, 50000, 100000].map((v) => [v, EUR(v)]))}
      ${fNum(st + '.annex.parking', t('parkingValue'), { unit: CURS() })}${fNum(st + '.annex.storage', t('storageValue'), { unit: CURS() })}
      ${fPct(st + '.trimPct', t('trim'))}${fPct(st + '.timeTrendAnnual', t('trend'))}${fNum(st + '.listingMarginPct', t('margin'), { unit: '%' })}
      <div class="fld"><span>${esc(t('options'))}</span>${fChk(st + '.timeAdjust', t('timeAdjust'))}${fChk(st + '.showListingPrice', t('showListing'))}${fChk(st + '.marketConfirmed', t('marketConfirm'))}</div>
      ${fLText(st + '.negotiationReason', t('negReason'), { area: true, rows: 2, cls: 'span-all' })}</div>`) +
      card(t('weightsT'), `<div class="grid">${Object.keys(MCA.SOURCES).map((k) => fNum(`${st}.sourceWeights.${k}`, L3(MCA.SOURCES[k]))).join('')}</div>`) +
      methodPanel() + sourcesPanel();
  }
  // How each number of the result is computed (src/js/method.js), with the section of the methodology.
  function methodPanel() {
    const MX = t('mx');
    const items = Method.explain(state.settings || {}).map((x) => `<li><span>${esc(MX[x.id])}</span><code class="mx-f">${esc(x.formula)}</code>` +
      `<span class="sub">${esc(t('mxDoc'))} docs/methodology/${esc(x.doc)}</span></li>`).join('');
    return `<details class="card guide mx"><summary><b>${esc(t('mxTitle'))}</b> <span class="sub">${esc(t('mxSub'))}</span></summary><ul class="mx-list">${items}</ul></details>`;
  }
  // Methodological sources of the country of the valuation (src/js/references.js), with their verification status.
  function sourcesPanel() {
    const cc = (state.meta && state.meta.country) || 'ES';
    const V = Method.sources(cc);
    const G = t('srcGroups');
    const S = t('srcStatus');
    const short = (u) => String(u || '').replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
    const group = (title, list) => (list.length ? `<h4>${esc(title)}</h4><ul class="src-list">${list.map((r) => `<li${r.status === 'tbv' ? ' class="tbv"' : ''}><span>${esc(r.text)}</span>` +
      `<span class="sub">${esc(S[r.status] || r.status)}${r.date ? ` ${esc(r.date)}` : ''}${r.url ? ` · <a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(short(r.url))}</a>` : ''}</span></li>`).join('')}</ul>` : '');
    return `<details class="card guide srcv"><summary><b>${esc(t('srcTitle'))}</b> <span class="sub">${esc(t('srcSub')(Taxonomy.countryName(cc, uiLang)))}</span></summary>` +
      group(G.standards, V.standards) + group(G.eu, V.eu) + group(`${G.country} — ${Taxonomy.countryName(cc, uiLang)}`, V.country) + group(G.method, V.method) + '</details>';
  }

  function tabFoto() {
    const items = state.photos.map((p, i) => `<div class="photo"><img src="${esc(p.dataUrl)}" alt="">
      <div class="pb"><input type="text" data-bind="photos.${i}.caption" data-kind="ltext" value="${esc(I18N.loc(p.caption, RL()))}" placeholder="${esc(t('captionPh'))} · ${RL().toUpperCase()}">
      <div class="pa"><label class="chk"><input type="checkbox" data-kind="cover" data-i="${i}"${p.cover ? ' checked' : ''}><span>${esc(t('cover'))}</span></label>
      ${btn('photo-up', '↑', { i, cls: 'btn-icon', title: t('moveUp') })}${btn('photo-down', '↓', { i, cls: 'btn-icon', title: t('moveDown') })}${btn('photo-del', ic('trash'), { i, cls: 'btn-icon btn-del', title: t('del') })}</div></div></div>`).join('');
    return card(t('photosT'), `<button type="button" class="dropzone" id="dropzone" data-action="photo-add">${t('dropzone')}<br><span>${esc(t('dropSub'))}</span></button>
      <p class="hint" style="margin:10px 0 0">${t('photosHint')}</p>${items ? `<div class="photos">${items}</div>` : ''}`, t('photosCount')(state.photos.length));
  }

  const TEXT_KEYS = ['letter', 'pros', 'cons', 'scope', 'location', 'environment', 'building', 'dwelling', 'condition', 'annexes', 'market', 'methodIntro', 'sample', 'result', 'listing', 'hypotheses', 'declaration'];
  const hasOverride = (k) => !!I18N.loc(state.texts[k], RL()).trim() && (typeof state.texts[k] !== 'object' || state.texts[k][RL()] != null || state.texts[k]._ != null);
  function tabTesti() {
    const auto = Report.autoTexts(state, res);
    return `<section class="card"><h3>${esc(t('textsT'))} ${langTag()}</h3><p class="hint" style="margin:0">${esc(t('textsHint'))}</p></section>` +
      TEXT_KEYS.map((k) => {
        const has = hasOverride(k);
        const val = has ? I18N.loc(state.texts[k], RL()) : auto[k] || '';
        return `<div class="card txt-block"><div class="tb-h"><b>${esc(t('texts')[k])}</b><span class="tag${has ? '' : ' auto'}" data-live="ttag" data-key="${k}">${esc(has ? t('custom') : t('automatic'))}</span><span class="grow"></span>${window.ValestaAI ? btn('ai-text', `✦ ${esc(t('aiImprove'))}`, { key: k, cls: 'btn-ai-soft' }) : ''}${btn('txt-reset', esc(t('reset')), { key: k })}</div>
        <textarea data-kind="textov" data-key="${k}" aria-label="${esc(t('texts')[k])}" rows="${Math.min(12, Math.max(3, String(val).split('\n').length + 2))}">${esc(val)}</textarea></div>`;
      }).join('');
  }

  function logoBox(key) {
    const v = state.brand[key];
    return `<div class="logo-box ${key === 'logoDark' ? 'dark' : ''}">${v ? `<img src="${esc(v)}" alt="">` : '<span>—</span>'}</div>
      <div class="row-actions">${btn('logo-upload', esc(t('upload')), { key })}${v ? btn('logo-remove', esc(t('remove')), { key, cls: 'btn-danger' }) : ''}</div>`;
  }
  // ---------- agency profiles (library examples + the user's own) ----------
  const isHex = (c) => /^#[0-9a-f]{6}$/i.test(String(c || ''));
  const allProfiles = () => Profiles.LIST.concat(myProfiles.map((p) => Object.assign({}, p, { builtin: false })));
  const findProfile = (id) => allProfiles().find((p) => p.id === id) || null;
  function defaultProfileId() { try { return localStorage.getItem(DEFAULT_PROFILE_KEY) || Profiles.DEFAULT_ID; } catch (e) { return Profiles.DEFAULT_ID; } }
  async function loadProfiles() {
    try { myProfiles = storeOk ? await ValestaStore.profiles.list() : JSON.parse(localStorage.getItem(PROFILE_KEY) || '[]'); } catch (e) { myProfiles = []; }
    myProfiles = (Array.isArray(myProfiles) ? myProfiles : []).filter((p) => p && p.id && AppCore.isProfile(p.profile));
  }
  async function putProfile(rec) {
    rec.updated = new Date().toISOString();
    if (storeOk) await ValestaStore.profiles.put(rec);
    else { const list = myProfiles.filter((p) => p.id !== rec.id).concat([rec]); localStorage.setItem(PROFILE_KEY, JSON.stringify(list)); }
    await loadProfiles();
  }
  async function deleteProfile(id) {
    if (storeOk) await ValestaStore.profiles.del(id);
    else localStorage.setItem(PROFILE_KEY, JSON.stringify(myProfiles.filter((p) => p.id !== id)));
    await loadProfiles();
  }
  const newProfileId = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  function profileCard(p) {
    const pr = p.profile || {};
    const b = pr.brand || {};
    const d = pr.design || {};
    const inUse = state.brand && state.brand.profileId === p.id;
    const isDef = defaultProfileId() === p.id;
    const primary = isHex(b.primary) ? b.primary : '#0E5A4E';
    const accent = isHex(b.accent) ? b.accent : '#1A8A47';
    const logo = b.logoMode === 'custom' && AppCore.isSafeLogo(b.logoLight) ? `<img src="${esc(b.logoLight)}" alt="">`
      : `<span class="prof-word" style="font-family:${esc(Report.FONT_STACKS[Report.designOf({ design: d }).fontHead] || '')};color:${primary}">${esc(b.name || p.label)}</span>`;
    return `<div class="prof${inUse ? ' on' : ''}"><div class="prof-logo">${logo}</div>
      <div class="prof-meta"><b>${esc(p.label || pr.name || '')}</b><span>${esc([d.fontHead, d.fontBody].filter(Boolean).join(' · '))}</span>
        <span class="prof-tags"><i class="sw" style="background:${primary}"></i><i class="sw" style="background:${accent}"></i>${p.builtin ? `<em>${esc(t('profBuiltin'))}</em>` : `<em class="mine">${esc(t('profMine'))}</em>`}${isDef ? `<em class="def">★ ${esc(t('profDefault'))}</em>` : ''}</span></div>
      <div class="prof-actions">${inUse ? `<span class="prof-inuse">✓ ${esc(t('profInUse'))}</span>` : btn('prof-use', esc(t('profUse')), { id: p.id, cls: 'btn-primary' })}${isDef ? '' : btn('prof-default', esc(t('profMakeDefault')), { id: p.id })}${p.builtin ? btn('prof-dup', esc(t('profDup')), { id: p.id }) : btn('prof-del', esc(t('profDel')), { id: p.id, cls: 'btn-danger' })}${btn('prof-export', esc(t('profExport')), { id: p.id })}</div></div>`;
  }
  function tabAgenzia(noAdvisor) {
    const b = 'brand';
    const o = 'meta.office';
    const mode = state.brand.logoMode === 'custom' ? 'custom' : 'text';
    const cur = findProfile(state.brand.profileId);
    return card(t('profLibT'), `<p class="hint" style="margin:0 0 10px">${esc(t('profLibHint'))}</p><div class="prof-grid">${allProfiles().map(profileCard).join('')}</div>
      <div class="row-actions">${btn('prof-new', esc(t('profNew')), { cls: 'btn-primary' })}${cur && !cur.builtin ? btn('prof-save', esc(t('profSave')(cur.label))) : ''}${btn('profile-import', esc(t('profileImport')))}</div>
      <p class="hint" style="margin:8px 0 0">${esc(t('profTrademark'))}</p>`) +
      card(t('brandT'), `<div class="grid">
      ${fText(b + '.name', t('brandName'))}${fSel(b + '.logoMode', t('logoMode'), [['text', t('logoText')], ['custom', t('logoCustom')]])}</div>
      ${mode === 'custom' ? `<div class="grid mt"><div class="fld"><span>${esc(t('logoLight'))}</span>${logoBox('logoLight')}</div><div class="fld"><span>${esc(t('logoDark'))}</span>${logoBox('logoDark')}</div></div><p class="hint" style="margin-top:8px">${esc(t('logoHint'))}</p>` : ''}
      <div class="grid mt">${fColor(b + '.primary', t('primary'))}${fColor(b + '.accent', t('accent'))}</div>
      ${fLText(b + '.tagline', t('tagline'), { area: true, rows: 2, cls: 'mt' })}
      <div class="row-actions">${fChk(b + '.showBand', t('showBand'))}<span class="grow"></span>${btn('brand-reset', esc(t('resetBrand')))}</div>`, t('colors')) +
      card(t('officeT'), `<div class="grid">
      ${fText(o + '.name', t('officeName'))}${fText(o + '.company', t('company'))}${fText(o + '.address', t('officeAddress'), { cls: 'span-all' })}
      ${fText(o + '.phone', t('phone'), { type: 'tel' })}${fText(o + '.email', t('email'), { type: 'email' })}${fText(o + '.web', t('web'), { type: 'url' })}${fText(o + '.license', t('license'))}</div>`, t('officeNote')) +
      (noAdvisor ? '' : card(t('cAdvisor'), `<div class="grid">${fText('meta.advisor.name', t('advisorName'))}${fLText('meta.advisor.role', t('role'))}</div>`, t('advisorNote')));
  }

  // ---------- design tab ----------
  const FONT_LIST = [['Cormorant Garamond'], ['Literata'], ['Georgia', true], ['Inter'], ['Open Sans'], ['Montserrat'], ['Helvetica', true]];
  const SEC_TREE = [['summary'], ['toc'], ['letter'], ['scope'], ['location'], ['description', ['surfaces']], ['market'], ['method', ['methodDetail']], ['sample', ['cards']],
    ['homog', ['homogChart']], ['result', ['sensitivity', 'uncertainty']], ['photos'], ['hypotheses', ['sources']], ['certification', ['glossary']]];
  const CS_ANCHORS = ['start', 'scope', 'location', 'description', 'market', 'method', 'sample', 'homog', 'result', 'photos', 'hypotheses', 'certification', 'end'];
  const CS_TEMPLATES = {
    about: (b) => ({ title: { it: 'Chi siamo', en: 'About us', es: 'Quiénes somos' }, body: {
      it: `**${b}** offre consulenza immobiliare completa: valutazione, commercializzazione, assistenza alla trattativa e alla stipula.\n\n- Conoscenza diretta del mercato locale\n- Rete di uffici e acquirenti qualificati\n- Assistenza dalla valutazione al rogito`,
      en: `**${b}** provides full real estate advice: valuation, marketing, negotiation and completion support.\n\n- First-hand knowledge of the local market\n- Network of offices and qualified buyers\n- Support from valuation to completion`,
      es: `**${b}** ofrece asesoramiento inmobiliario integral: valoración, comercialización, negociación y acompañamiento hasta la firma.\n\n- Conocimiento directo del mercado local\n- Red de oficinas y compradores cualificados\n- Acompañamiento desde la valoración hasta la escritura` } }),
    planning: () => ({ title: { it: 'Situazione urbanistica', en: 'Planning status', es: 'Situación urbanística' }, body: {
      it: 'Classificazione del suolo: **urbano consolidato** (da verificare nel piano comunale).\n\n- Destinazione urbanistica: …\n- Certificato di abitabilità / licenza di prima occupazione: …\n- Procedimenti di disciplina urbanistica: non risultano (da verificare)',
      en: 'Land classification: **consolidated urban land** (to be checked in the municipal plan).\n\n- Zoning: …\n- Certificate of occupancy (cédula de habitabilidad): …\n- Planning enforcement proceedings: none recorded (to be verified)',
      es: 'Clasificación del suelo: **urbano consolidado** (a verificar en el planeamiento municipal).\n\n- Calificación urbanística: …\n- Cédula de habitabilidad / licencia de primera ocupación: …\n- Expedientes de disciplina urbanística: no constan (pendiente de verificación)' } }),
    legal: () => ({ title: { it: 'Note legali', en: 'Legal notes', es: 'Notas legales' }, body: {
      it: 'Questo documento è una **valutazione di mercato** a fini di consulenza e non costituisce una perizia ufficiale ai sensi dell’Orden ECO/805/2003.\n\n- L’uso è limitato alla finalità indicata.\n- Non è consentita la riproduzione totale o parziale senza autorizzazione.\n- I dati di terzi sono trattati ai sensi del GDPR (UE) 2016/679.',
      en: 'This document is a **market valuation** for advisory purposes and is not an official appraisal under Orden ECO/805/2003.\n\n- Its use is limited to the stated purpose.\n- It may not be reproduced in whole or in part without permission.\n- Third-party data are processed in accordance with the GDPR (EU) 2016/679.',
      es: 'Este documento es una **valoración de mercado** con fines de asesoramiento y no constituye una tasación oficial a efectos de la Orden ECO/805/2003.\n\n- Su uso queda limitado a la finalidad indicada.\n- No se permite su reproducción total o parcial sin autorización.\n- Los datos de terceros se tratan conforme al RGPD (UE) 2016/679.' } }),
  };
  // Cover gallery: thumbnails of the cover styles in the brand colours, plus a custom cover image.
  function coverGallery(D) {
    const P = Report.palette(state.brand && state.brand.primary);
    const img = D.coverImage;
    const DD = Report.designOf(state);
    const style = DD.coverStyle;
    const CV = Object.assign({ pattern: 'lines', fill: 'gradient' }, DD.cover || {});
    const auto = Report.coverTexts(state);
    const items = Report.COVER_STYLES.map((k) => `<button type="button" class="cv-opt${style === k ? ' on' : ''}" data-action="cover-style" data-key="${k}" aria-pressed="${style === k}">
      ${style === k ? `<span class="po-check" aria-hidden="true">${ic('check')}</span>` : ''}<span class="cv cv--${k}" aria-hidden="true"><i class="v"></i><i class="t1"></i><i class="t2"></i><i class="p"></i></span><b>${esc(t('covers')[k])}</b><small>${esc(t('coversHint')[k])}</small></button>`).join('');
    const seg = (act, cur, opts) => opts.map(([v, l]) => `<button type="button" class="seg-btn${cur === v ? ' on' : ''}" data-action="${act}" data-key="${v}">${esc(l)}</button>`).join('');
    const sub = style === 'pattern'
      ? `<div class="cv-sub"><div><span class="seg-l">${esc(t('cvPattern'))}</span><span class="seg">${seg('cover-pattern', CV.pattern, [['lines', t('cvLines')], ['grid', t('cvGrid')]])}</span></div>
        <div><span class="seg-l">${esc(t('cvFill'))}</span><span class="seg">${seg('cover-fill', CV.fill, [['gradient', t('cvGradient')], ['solid', t('cvSolid')]])}</span></div></div>`
      : style === 'map' && !hasPos(state.subject) ? `<p class="hint" style="margin-top:12px">${esc(t('cvMapNoPos'))}</p>` : '';
    const veil = style === 'map' || style === 'photo'
      ? `<label class="cv-veil"><span>${esc(t('cvVeil'))}</span><input type="range" min="0" max="1" step="0.05" data-bind="design.cover.veil" data-kind="num" value="${esc(CV.veil == null ? 1 : CV.veil)}"></label>` : '';
    const texts = `<div class="cv-texts"><h4>${esc(t('cvTextsT'))}</h4><p class="hint">${esc(t('cvAutoHint'))}</p><div class="grid">
      ${fLText('design.cover.kicker', t('cvKicker'), { ph: auto.kicker, exact: true })}${fLText('design.cover.title', t('cvTitle'), { ph: auto.title, exact: true })}
      ${fLText('design.cover.titleEm', t('cvTitleEm'), { ph: auto.titleEm, cls: 'span-all', exact: true })}
      ${fLText('design.cover.standards', t('cvStd'), { ph: auto.standards, cls: 'span-all', exact: true })}
      ${fLText('design.cover.foot', t('cvFoot'), { ph: auto.foot, cls: 'span-all', exact: true })}</div>
      <div class="cv-flags">${fChk('design.cover.showRef', t('cvShowRef'), true)}${fChk('design.cover.showStandards', t('cvShowStd'), true)}${fChk('design.cover.showPanel', t('cvShowPanel'), true)}</div>
      ${veil}<div class="row-actions">${btn('cover-reset', esc(t('cvReset')))}</div></div>`;
    return `<div class="cv-grid" style="--cvb:${esc(P.brand)};--cvd:${esc(P.deep)};--cva:${esc(P.accent)}">${items}</div>${sub}
      <div class="cv-custom"><div class="logo-box cv-img">${img ? `<img src="${esc(img)}" alt="">` : `<span>${esc(t('coverImgNone'))}</span>`}</div>
      <div><b>${esc(t('coverImgT'))}</b><p class="hint">${esc(t('coverImgHint'))}</p><div class="row-actions">${btn('logo-upload', esc(t('upload')), { key: 'coverImage', cls: 'btn-primary' })}${img ? btn('cover-img-del', esc(t('remove')), { cls: 'btn-danger' }) : ''}</div></div></div>${texts}`;
  }
  // Sample of the report type on paper (white in both themes, as printed): title font, body font, a figure, a small table
  // and a note, in the ink and size chosen. The figures are those of the valuation.
  function fontSample() {
    const DD = Report.designOf(state);
    const ink = isHex(DD.ink) ? `;--fi:${DD.ink}` : '';
    return `<div class="font-preview" style="--fh:${esc(Report.FONT_STACKS[DD.fontHead] || '')};--fb:${esc(Report.FONT_STACKS[DD.fontBody] || '')}${ink};--fs:${Number(DD.textScale) || 1}">
      <b>${esc(state.subject.address || 'Valesta')}</b>
      <p>${esc(t('kValue'))}: <strong>${esc(EUR(res.total))}</strong></p>
      <table><tbody><tr><td>${esc(t('resUnit'))}</td><td>${res.unitValue != null ? esc(`${N(res.unitValue)} ${CURS()}/m²`) : '—'}</td></tr>
      <tr><td>${esc(t('ctArea'))}</td><td>${res.refArea != null ? esc(`${N(res.refArea, res.refArea % 1 ? 2 : 0)} m²`) : '—'}</td></tr></tbody></table>
      <small>${esc(t('fsNote'))}</small></div>`;
  }
  function tabDesign(part) {
    const d = 'design';
    const D = state.design || {};
    const fontOpts = FONT_LIST.map((f) => [f[0], `${f[0]}${f[1] ? ' · ' + t('fontSystem') : ''}`]);
    // Report model: three options with what each one does; the pressed one has a border, a tint and a check.
    const preset = Report.designOf(state).preset;
    const presets = Object.keys(Report.PRESETS).map((k) => `<button type="button" class="preset-opt${preset === k ? ' on' : ''}" data-action="design-preset" data-key="${k}" aria-pressed="${preset === k}">${preset === k ? `<span class="po-check" aria-hidden="true">${ic('check')}</span>` : ''}<b>${esc(t('dPresets')[k])}</b><small>${esc(t('dPresetsDesc')[k])}</small></button>`).join('');
    const secRow = (k, child) => {
      const always = k === 'result';
      const note = k === 'photos' ? t('photosAuto') : always ? t('alwaysOn') : '';
      return `<label class="chk${child ? ' sub' : ''}"><input type="checkbox" data-bind="design.sections.${k}" data-kind="bool"${always || (D.sections || {})[k] !== false ? ' checked' : ''}${always ? ' disabled' : ''}><span>${esc(t('sec')[k])}${note ? ` <em>${esc(note)}</em>` : ''}</span></label>`;
    };
    const secs = SEC_TREE.map(([k, kids]) => `<div class="sec-item">${secRow(k)}${(kids || []).map((c) => secRow(c, true)).join('')}</div>`).join('');
    const anchorOpts = CS_ANCHORS.map((a) => [a, a === 'start' ? t('csStart') : a === 'end' ? t('csEnd') : t('csAfterSec')(t('sec')[a])]);
    const cs = (state.customSections || []).map((c, i) => {
      const p = `customSections.${i}`;
      return `<div class="cs-item"><div class="row-actions cs-head"><label class="chk"><input type="checkbox" data-bind="${p}.enabled" data-kind="bool"${c.enabled !== false ? ' checked' : ''}><span>${esc(t('csEnabled'))}</span></label><span class="grow"></span>
        ${btn('cs-up', '↑', { i, cls: 'btn-icon', title: t('moveUp') })}${btn('cs-down', '↓', { i, cls: 'btn-icon', title: t('moveDown') })}${btn('cs-del', ic('trash'), { i, cls: 'btn-icon btn-del', title: t('del') })}</div>
        <div class="grid">${fLText(p + '.title', t('csTitle'))}${fLText(p + '.kicker', t('csKicker'))}${fSel(p + '.after', t('csAfter'), anchorOpts, { cls: 'span-all' })}</div>
        ${fLText(p + '.body', t('csBody'), { area: true, rows: 7, cls: 'mt' })}</div>`;
    }).join('');
    const tpls = Object.keys(t('csTpl')).map((k) => btn('cs-tpl', esc(t('csTpl')[k]), { key: k })).join('');
    const sig = state.meta.advisor && state.meta.advisor.signature;
    const all = [card(t('dPresetT'), `<div class="preset-grid" role="group" aria-label="${esc(t('dPresetT'))}">${presets}</div><p class="hint" style="margin:10px 0 0">${esc(t('dPresetHint'))}</p>`),
      card(t('dTypoT'), `<div class="sec-t">${esc(t('dTypoGroup'))}</div><div class="grid">
        ${fSel(d + '.fontHead', t('fontHead'), fontOpts)}${fSel(d + '.fontBody', t('fontBody'), fontOpts)}
        ${fSel(d + '.textScale', t('textScale'), [[0.9, '90%'], [0.95, '95%'], [1, '100%'], [1.05, '105%'], [1.1, '110%']])}</div>
        <div class="sec-t">${esc(t('dLookGroup'))}</div><div class="grid">
        ${fSel(d + '.density', t('density'), Object.keys(t('densities')).map((k) => [k, t('densities')[k]]))}
        ${fSel(d + '.radius', t('radius'), Object.keys(t('radii')).map((k) => [k, t('radii')[k]]))}${fColor(d + '.ink', t('ink'))}</div>
        ${fontSample()}
        <div class="brand-go"><button type="button" class="btn btn-sm" data-action="goto-brand">${esc(t('brandGo'))}${ic('chev')}</button><span class="hint">${esc(t('brandGoHint'))}</span></div>`),
      card(t('dCoverT'), coverGallery(D)),
      card(t('dSectionsT'), `<p class="hint" style="margin:0 0 8px">${esc(t('dSectionsHint'))}</p><div class="sec-list">${secs}</div>`),
      card(t('dCustomT'), `<p class="hint" style="margin:0 0 8px">${esc(t('dCustomHint'))}</p>${cs}<div class="row-actions">${btn('cs-add', esc(t('csAdd')), { cls: 'btn-primary' })}<span class="hint" style="margin:0">${esc(t('csTemplates'))}</span>${tpls}</div>`),
      card(t('dPageT'), `<div class="grid">
        ${fSel(d + '.watermark', t('watermark'), Object.keys(t('wms')).map((k) => [k, t('wms')[k]]))}${D.watermark === 'custom' ? fLText(d + '.watermarkText', t('wmText')) : '<span></span>'}
        ${fLText(d + '.footerNote', t('footerNote'), { cls: 'span-all' })}</div>
        <div class="checks mt" style="grid-template-columns:1fr">${fChk(d + '.pageNumbers', t('pageNumbers'))}${fChk(d + '.autoFit', t('autoFit'))}</div>
        <div class="fld mt"><span>${esc(t('signature'))}</span><div class="logo-box sig">${sig ? `<img src="${esc(sig)}" alt="">` : '<span>—</span>'}</div>
        <div class="row-actions">${btn('logo-upload', esc(t('upload')), { key: 'signature' })}${sig ? btn('sig-remove', esc(t('remove')), { cls: 'btn-danger' }) : ''}</div>
        <p class="hint" style="margin:6px 0 0">${esc(t('signatureHint'))}</p></div>`)];
    return (part === 'content' ? [all[3], all[4]] : part === 'style' ? [all[0], all[1], all[2], all[5]] : all).join('');
  }

  // ---------- live refresh (no input re-render) ----------
  function refreshLive() {
    syncMap();
    $$('[data-live="rooms-total"]').forEach((el) => { el.textContent = res.usefulArea != null ? N(res.usefulArea, 2) + ' m²' : '—'; });
    $$('[data-live="ref-area"]').forEach((el) => { el.textContent = res.refArea != null ? N(res.refArea, res.refArea % 1 ? 2 : 0) + ' m²' : '—'; });
    $$('[data-live="poi-d"]').forEach((el) => {
      const p = (state.subject.pois || [])[+el.dataset.i];
      const d = p ? MCA.util.distanceKm(state.subject.lat, state.subject.lon, p.lat, p.lon) : null;
      el.textContent = d == null ? '—' : d < 1 ? N(Math.round(d * 100) * 10) + ' m' : N(d, 2) + ' km';
    });
    $$('[data-live="comp-sum"]').forEach((el) => {
      const i = +el.dataset.i;
      el.innerHTML = compSummary(state.comparables[i] || {}, res.comps[i]);
      const d = el.closest('.comp');
      if (d) d.classList.toggle('excluded', !(res.comps[i] && res.comps[i].include));
    });
    if (step === 'adjust' && $('#mx-wrap')) {
      $('#mx-wrap').innerHTML = matrixHtml();
      const r = res.comps[state.comparables.findIndex((c) => c.id === selComp)];
      $$('[data-live="k"]').forEach((el) => { const fr = r && r.factors.find((y) => y.id === el.dataset.f); el.textContent = fr ? N(fr.k, 3) : ''; });
      $$('[data-live="omog-res"]').forEach((el) => { el.textContent = r && r.valid ? `K ${N(r.kTotal, 3)} · ${N(r.unitHomog)} ${CURS()}/m² · ${N(r.grossAdj * 100)}%` : ''; });
    }
    $$('[data-live="result"]').forEach((el) => { el.innerHTML = resultLive(); });
    $$('[data-live="ap"]').forEach((el) => { el.innerHTML = apValueHtml(el.dataset.k); });
    $$('[data-live="ap-recon"]').forEach((el) => { el.innerHTML = apReconHtml(); });
    if (step === 'content') {
      const auto = Report.autoTexts(state, res);
      $$('textarea[data-kind="textov"]').forEach((ta) => { if (!hasOverride(ta.dataset.key) && document.activeElement !== ta) ta.value = auto[ta.dataset.key] || ''; });
    }
    refreshTop();
  }

  function docTitle() { const x = state.subject; return [x.address, x.floorDoor, x.municipality].filter(Boolean).join(' · ') || t('newDoc'); }
  function refreshTop() {
    rv = Review.run(state, res);
    flow = Workflow.stepStatus(state, res, rv);
    const onStep = screen === 'step';
    $('#crumbs').innerHTML = `<a href="#" data-action="go-home">${esc(t('crumbHome'))}</a>${screen !== 'home' ? `<span aria-hidden="true">/</span><b>${esc(screen === 'start' ? t('newValuation') : docTitle())}</b>` : ''}`;
    const code = (state.subject.propertyType || {}).code;
    const cat = Taxonomy.categoryOf(code);
    const c = state.meta.country || 'ES';
    // Summary of the valuation under its title: country, type and language, each one opens its own choice.
    const sep = '<span class="sep" aria-hidden="true">·</span>';
    $('#chips').innerHTML = onStep ? `<button type="button" class="tchip" data-action="pop-country" title="${esc(t('tCountry'))}" aria-haspopup="listbox"><span class="cc">${esc(c)}</span><span class="lbl">${esc(Taxonomy.countryName(c, uiLang))}</span></button>${sep}<button type="button" class="tchip c-type" data-action="pop-type" title="${esc(t('tType'))}" aria-haspopup="listbox">${cat ? ic(cat.icon) : ''}<span class="lbl">${esc(Taxonomy.typeLabel(code, uiLang) || '—')}</span></button>${sep}<button type="button" class="tchip" data-action="pop-lang" data-key="both" title="${esc(t('langBoth'))}" aria-haspopup="listbox" aria-label="${esc(t('chipLang')(langName(uiLang)))}${RL() !== uiLang ? ` · ${esc(RL().toUpperCase())}` : ''}">${ic('globe')}<span class="lbl">${esc(langName(uiLang))}${RL() !== uiLang ? ` · ${esc(RL().toUpperCase())}` : ''}</span></button>` : '';
    // State of the value, from the existing checks: open checks first (errors in red), then missing essentials.
    const nIss = flow.issues.length;
    const err = flow.issues.some((i) => i.level === 'error');
    const vs = !(res.total > 0) ? null : nIss ? [err ? 'err' : 'warn', t('vsOpen')(nIss), 'alert'] : flow.completeness < 100 ? ['part', t('vsIncomplete'), ''] : ['ok', t('vsClear'), 'check'];
    // A different value shows for a moment in the brand colour (app.css, "ui-ink"): a colour, never a count.
    const upd = onStep && lastTotal != null && res.total !== lastTotal;
    if (onStep) lastTotal = res.total;
    $('#tb-kpi').innerHTML = onStep ? `<button type="button" class="tkpi" data-action="goto-step" data-key="result"><span class="tkpi-l"><span class="tkpi-t">${esc(t('kValue'))}</span>${vs ? `<span class="vstate ${vs[0]}">${vs[2] ? ic(vs[2]) : ''}${esc(vs[1])}</span>` : ''}</span><b class="tkpi-v${upd ? ' upd' : ''}">${EUR(res.total)}</b></button>` +
      `<button type="button" class="tq tb-tip g-${rv.grade}" data-action="goto-step" data-key="checks" aria-label="${esc(t('qualityAria')(rv.score, rv.grade))}" data-tip="${esc(t('qualityT'))}"><span class="tkpi-l">${esc(t('quality'))}</span><span class="tq-v"><b>${rv.score}</b><small>/100</small><i>${rv.grade}</i></span></button>` : '';
    $('#tb-export').hidden = !onStep;
    renderSide();
    // The strip of the phase's steps (phones, steps in a drawer) shows the same states as the sidebar, also after a change.
    $$('.step-strip [data-step]').forEach((b) => { const s = b.querySelector('svg.st'); if (s) s.outerHTML = stepIcon(b.dataset.step); });
    renderCtxTabs();
    if (ctxTab === 'issues') renderIssues();
    renderAiQueue();
  }

  // ---------- compute & preview ----------
  // Amounts in the app follow the currency of the valuation (country pack or meta.currency).
  function recompute() {
    AppCore.syncTechnical(state);
    I18N.setCurrency(Taxonomy.currencyOf(state));
    if (Charts.setCurrency) Charts.setCurrency(I18N.sym());
    res = MCA.compute(state);
  }
  function renderPreview() {
    const sc = $('#pv-scroll');
    const top = sc.scrollTop;
    $('#css-brand').textContent = Report.brandCss(state);
    $('#report').innerHTML = Report.render(state, res);
    $('#report').setAttribute('lang', RL());
    applyZoom();
    sc.scrollTop = top;
    const pages = $$('#report .page').length;
    $('#pv-info').innerHTML = `<b>${esc(t('pages')(pages))}</b> · ${esc(state.photos.length ? t('photosN')(state.photos.length) : t('noPhotos'))}`;
    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(fitAndCheck);
    // First drawing: the page of the step, or, with "follow the step" off, the place where the preview was left last time.
    if (!renderPreview.done) {
      renderPreview.done = true;
      requestAnimationFrame(() => { if (pvFollow) syncPreview(); else if (pvPrefs.top) sc.scrollTop = pvPrefs.top; });
    }
  }
  // Shrinks the text of overflowing pages (design.autoFit) and flags what still does not fit.
  function fitAndCheck() {
    const auto = !(state.design && state.design.autoFit === false);
    lastFit = auto ? Report.fitPages($('#report'), { min: 0.8 }) : {};
    if (!auto) $$('#report .pg-body').forEach((b) => b.style.removeProperty('--fit'));
    const n = Object.keys(lastFit).length;
    $('#pv-fit').textContent = n ? t('fitInfo')(n) : '';
    return checkOverflow();
  }
  // Measures at 100 % (as printed): zoom levels round line breaks slightly differently.
  function atFullSize(fn) {
    const rep = $('#report');
    rep.classList.remove('spread');
    rep.style.setProperty('--zoom', 1);
    try { return fn(); } finally { applyZoom(); }
  }
  function checkOverflow() {
    const over = [];
    $$('#report .page').forEach((p) => {
      const b = p.querySelector('.pg-body');
      const o = b && b.scrollHeight > b.clientHeight + 1;
      p.classList.toggle('overflow', !!o);
      if (o) over.push(p.dataset.page);
    });
    $('#pv-ovf').textContent = over.length ? t('overflow')(over.join(', ')) : '';
    return over;
  }
  const schedule = debounce(() => { recompute(); renderPreview(); refreshLive(); }, 260);
  function changed(structural) {
    recordHistory();
    if (structural) { recompute(); renderTabs(); renderTab(); renderPreview(); } else schedule();
    scheduleSave();
    liveSchedulePush();
  }

  // ---------- undo / redo (snapshots; photos are shared, not copied) ----------
  function snap() {
    return { attachments: (state.attachments || []).map((a) => Object.assign({}, a)), json: JSON.stringify(Object.assign({}, state, { photos: [], attachments: [] })), photos: (state.photos || []).map((p) => Object.assign({}, p, { caption: AppCore.clone(p.caption == null ? '' : p.caption) })) };
  }
  function restoreSnap(sn) {
    const st = JSON.parse(sn.json);
    st.photos = sn.photos.map((p) => Object.assign({}, p));
    st.attachments = (sn.attachments || []).map((a) => Object.assign({}, a));
    state = st;
  }
  function recordHistory() {
    if (!hist.timer) {
      hist.undo.push(hist.last || snap());
      if (hist.undo.length > 80) hist.undo.shift();
      hist.redo = [];
    }
    clearTimeout(hist.timer);
    hist.timer = setTimeout(() => { hist.timer = null; hist.last = snap(); }, 700);
    updateUndoButtons();
  }
  function settleHistory() { if (hist.timer) { clearTimeout(hist.timer); hist.timer = null; } }
  function updateUndoButtons() {
    const u = $('#b-undo');
    const r = $('#b-redo');
    if (u) u.disabled = !hist.undo.length;
    if (r) r.disabled = !hist.redo.length;
  }
  function afterRestore() {
    if (!state.comparables.some((c) => c.id === selComp)) selComp = state.comparables[0] && state.comparables[0].id;
    hist.last = snap();
    recompute();
    renderChrome();
    renderTab();
    renderPreview();
    scheduleSave();
    liveSchedulePush();
  }
  function undo() {
    settleHistory();
    if (!hist.undo.length) return toast(t('toastNothing'));
    hist.redo.push(snap());
    restoreSnap(hist.undo.pop());
    afterRestore();
    toast(t('toastUndo'));
  }
  function redo() {
    settleHistory();
    if (!hist.redo.length) return;
    hist.undo.push(snap());
    restoreSnap(hist.redo.pop());
    afterRestore();
    toast(t('toastRedo'));
  }
  // Replaces the whole case (archive, file, MCP): history starts again.
  function loadState(st, msg) {
    settleHistory();
    state = st;
    AppCore.ensureId(state);
    hist.undo = [];
    hist.redo = [];
    selComp = state.comparables[0] && state.comparables[0].id;
    afterRestore();
    if (msg) toast(msg);
  }

  function applyZoom() {
    const sc = $('#pv-scroll');
    const rep = $('#report');
    const avail = sc.clientWidth - (window.innerWidth < 700 ? 16 : 44);
    const spread = zoom === 'fit' && avail >= 2 * 794 * 0.78 + 28;
    rep.classList.toggle('spread', spread);
    let z = zoom;
    if (zoom === 'fit') z = spread ? Math.min(1.1, (avail - 28) / (2 * 794)) : Math.max(0.25, Math.min(1.25, avail / 794));
    // Whole page: an A4 page (794 × 1123 px at 100 %) fits both the width and the height of the panel.
    else if (zoom === 'page') z = Math.max(0.25, Math.min(1.25, avail / 794, (sc.clientHeight - 36) / 1123));
    rep.style.setProperty('--zoom', z);
    const pct = `${Math.round(z * 100)}%`;
    $('#zoom-label').textContent = pct;
    $('#zoom-label').setAttribute('aria-label', `${pct} · ${t('pvFitW')}`);
    paintPvTools();
  }
  // Pressed state of the preview tools: fit to width, fit to page, follow the step.
  function paintPvTools() {
    const set = (sel, on) => { const b = $(sel); if (b) { b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); } };
    set('#pv-fitw', zoom === 'fit');
    set('#pv-fitp', zoom === 'page');
    set('#pv-follow', pvFollow);
  }
  function paintFullBtn(on) {
    const b = $('#pv-full');
    if (!b) return;
    const l = on ? t('pvClose') : t('pvFull');
    b.innerHTML = ic(on ? 'shrink' : 'expand');
    b.setAttribute('aria-label', l);
    b.dataset.tip = l;
  }
  const currentZoom = () => parseFloat(getComputedStyle($('#report')).getPropertyValue('--zoom')) || 1;

  // ---------- events ----------
  // A field that cannot be read says why, under it. The message is the field's description (aria-describedby) and the field
  // is marked invalid (aria-invalid); it stays out of the label's text (aria-hidden) so the name of the field does not change.
  // Both go away as soon as the value can be read.
  let errSeq = 0;
  function fieldError(el, fld, msg) {
    if (!fld) return;
    let m = fld.querySelector(':scope > .fld-err');
    const ids = (el.getAttribute('aria-describedby') || '').split(' ').filter((x) => x && (!m || x !== m.id));
    if (!msg) {
      el.removeAttribute('aria-invalid');
      if (m) m.remove();
      if (ids.length) el.setAttribute('aria-describedby', ids.join(' ')); else el.removeAttribute('aria-describedby');
      return;
    }
    if (!m) { m = document.createElement('small'); m.className = 'fld-err'; m.id = `fld-err-${++errSeq}`; m.setAttribute('aria-hidden', 'true'); fld.appendChild(m); }
    m.textContent = msg;
    el.setAttribute('aria-invalid', 'true');
    el.setAttribute('aria-describedby', ids.concat(m.id).join(' '));
  }
  function onField(e) {
    const el = e.target;
    if (el.dataset.kind === 'cover') {
      state.photos.forEach((p, i) => { p.cover = i === +el.dataset.i ? el.checked : false; });
      return changed(true);
    }
    if (el.dataset.kind === 'textov') {
      const k = el.dataset.key;
      const auto = Report.autoTexts(state, res)[k] || '';
      if (el.value.trim() === auto.trim() || el.value.trim() === '') clearLoc(state.texts, k, RL());
      else { if (state.texts[k] == null) state.texts[k] = {}; I18N.setLoc(state.texts, k, RL(), el.value); }
      aiTouch('texts.' + k, el);
      const tag = $(`[data-live="ttag"][data-key="${k}"]`);
      if (tag) { const has = hasOverride(k); tag.textContent = has ? t('custom') : t('automatic'); tag.classList.toggle('auto', !has); }
      return changed(false);
    }
    const p = el.dataset.bind;
    if (!p) return;
    const kind = el.dataset.kind;
    let v;
    if (kind === 'num' || kind === 'int' || kind === 'pct') {
      v = AppCore.parseNum(el.value);
      const bad = el.value.trim() !== '' && v == null;
      const fld = el.closest('.fld') || el.closest('td');
      if (fld) fld.classList.toggle('invalid', bad);
      fieldError(el, fld, bad ? t(kind === 'int' ? 'errInt' : 'errNum') : '');
      if (bad) return;
      if (v != null && kind === 'int') v = Math.round(v);
      if (v != null && kind === 'pct') v = v / 100;
    } else if (kind === 'bool') v = el.checked;
    else if (kind === 'seln') v = el.value === '' ? null : Number(el.value);
    else if (kind === 'ltext') { I18N.setLoc(state, p, RL(), el.value); aiTouch(p, el); return changed(false); }
    else if (kind === 'ltextx') {
      const cur = get(p);
      AppCore.setPath(state, p, Object.assign(cur && typeof cur === 'object' && !Array.isArray(cur) ? cur : {}, { [RL()]: el.value }));
      return changed(false);
    }
    else if (kind === 'color' || kind === 'hex') {
      if (!/^#[0-9a-f]{6}$/i.test(el.value)) return;
      v = el.value;
      const twin = $$(`[data-bind="${p}"]`).find((x) => x !== el);
      if (twin) twin.value = v;
    } else v = el.value;
    AppCore.setPath(state, p, v);
    aiTouch(p, el);
    if (/^design\.sections\./.test(p)) state.design.preset = '';
    const structural = /^comparables\.\d+\.(id|include)$/.test(p) || /^(settings\.scalePreset|brand\.logoMode|design\.(watermark|fontHead|fontBody)|design\.sections\.\w+|approaches\.\w+\.on|technical\.systems\.\w+\.status|design\.cover\.show\w+)$/.test(p);
    if (/^comparables\.\d+\.id$/.test(p)) selComp = v;
    changed(structural);
  }
  function clearLoc(obj, k, lang) {
    const cur = obj[k];
    if (cur && typeof cur === 'object') { delete cur[lang]; if (!Object.keys(cur).some((x) => x !== '_' && cur[x] != null) && cur._ == null) delete obj[k]; }
    else delete obj[k];
  }

  function swap(arr, i, j) { if (j < 0 || j >= arr.length) return false; const x = arr[i]; arr[i] = arr[j]; arr[j] = x; return true; }

  function onAction(e) {
    const b = e.target.closest('[data-action]');
    if (!b) return;
    const a = b.dataset.action;
    const i = b.dataset.i != null ? +b.dataset.i : null;
    if (b.closest('#pop')) closePop();
    const S = state.subject;
    const M = state.market;
    if (a !== 'menu') closeMenu();
    switch (a) {
      case 'menu': return toggleMenu();
      case 'new': return goStart();
      case 'open': return $('#file-open').click();
      case 'save': return saveProject();
      case 'export-html': return exportHtml();
      case 'export-dossier': return exportDossier();
      case 'print': return printPdf();
      case 'support': case 'feedback': return window.ValestaSupport && window.ValestaSupport.open(a, b);
      case 'set-lang': {
        const l = I18N.LANGS.includes(b.dataset.lang) ? b.dataset.lang : 'en';
        uiLang = l;
        try { localStorage.setItem(UILANG_KEY, uiLang); } catch (e) { /* ignore */ }
        state.meta.reportLang = l;
        renderChrome();
        if (window.ValestaAI) window.ValestaAI.relabel();
        return changed(true);
      }
      case 'set-rl': if (!I18N.LANGS.includes(b.dataset.rl)) return; state.meta.reportLang = b.dataset.rl; renderChrome(); return changed(true);
      case 'set-ul': setUiLang(b.dataset.ul); return;
      case 'view-edit': return setView('edit');
      case 'view-preview': return setView('preview');
      case 'go-home': e.preventDefault(); return goHome();
      case 'goto-step': return goStep(b.dataset.key);
      case 'palette': return openPalette();
      case 'ctx-toggle': return toggleCtx();
      case 'ctx-issues': return setCtx('issues', true);
      case 'preview-full': return setFullPreview(!document.body.classList.contains('pv-full'));
      // From the menu (closed by now) the list opens under the menu button.
      case 'pop-country': case 'pop-type': case 'pop-lang': case 'pop-purpose': return openPop(a.slice(4), b.closest('#menu') ? $('#menu-btn') : b, b.dataset.key);
      case 'set-country': {
        closePop();
        const curBefore = Taxonomy.currencyOf(state);
        const prevCC = state.meta.country;
        state.meta.country = b.dataset.key;
        if (+state.settings.rounding === AppCore.roundingFor(prevCC)) state.settings.rounding = AppCore.roundingFor(b.dataset.key);
        const curAfter = Taxonomy.currencyOf(state);
        toast(curAfter !== curBefore ? t('toastCountryCur')(Taxonomy.countryName(b.dataset.key, uiLang), curAfter) : t('toastCountry')(Taxonomy.countryName(b.dataset.key, uiLang)));
        return changed(true);
      }
      case 'set-type': {
        closePop();
        const ty = Taxonomy.typeByCode(b.dataset.key);
        if (!ty) return;
        AppCore.setPropertyType(state, ty.code, ty.label);
        toast(t('toastType')(L3(ty.label)), [[t('bUndo'), undo]]);
        return changed(true);
      }
      case 'aiq-accept': AIReview.accept(state.aiLog, b.dataset.id); toast(t('aiqAccepted')); return changed(true);
      case 'aiq-accept-all': AIReview.acceptAll(state.aiLog); toast(t('aiqAccepted')); return changed(true);
      case 'aiq-reject': {
        const r = AIReview.reject(state, state.aiLog, b.dataset.id);
        const v = AppCore.validateState(state, DEFAULT_STATE);
        if (v.ok) state = v.state;
        toast(r.conflicts ? t('aiqRejectedKept')(r.conflicts) : t('aiqRejected'));
        return changed(true);
      }
      case 'aiq-edit': {
        const en = (state.aiLog || []).find((x) => x.id === b.dataset.id);
        const ch = en && en.changes.find((x) => x.state === 'open');
        if (ch) goStep(Workflow.stepForPath(ch.path), ch.kind === 'value' ? ch.path : null);
        return;
      }
      case 'ai-text': if (window.ValestaAI) window.ValestaAI.ask(t('aiImprovePrompt')(t('texts')[b.dataset.key] || b.dataset.key, b.dataset.key)); return;
      case 'chk-status': {
        if (!Array.isArray(state.checks)) state.checks = [];
        const r = state.checks.find((x) => x.topic === b.dataset.key);
        if (r) r.status = b.dataset.st; else state.checks.push({ topic: b.dataset.key, status: b.dataset.st, source: '', date: '', note: '' });
        return changed(true);
      }
      case 'chk-all-nv': {
        if (!Array.isArray(state.checks)) state.checks = [];
        Checks.applicable(Checks.categoryOfCode((state.subject.propertyType || {}).code)).forEach((c) => {
          if (!state.checks.some((x) => x.topic === c.topic)) state.checks.push({ topic: c.topic, status: 'not_verified', source: '', date: '', note: '' });
        });
        return changed(true);
      }
      case 'cover-style': state.design = Object.assign({}, state.design, { coverStyle: b.dataset.key }); return changed(true);
      case 'cover-img-del': state.design = Object.assign({}, state.design, { coverImage: null }); return changed(true);
      case 'att-add': attTopic = b.dataset.key || ''; return $('#file-att').click();
      case 'att-del': (state.attachments || []).splice(i, 1); return changed(true);
      case 'ded-add': state.technical = state.technical || {}; (state.technical.deductions = state.technical.deductions || []).push({ label: '', amount: null }); return changed(true);
      case 'ded-del': state.technical.deductions.splice(i, 1); return changed(true);
      case 'cover-pattern': state.design = Object.assign({}, state.design, { cover: Object.assign({}, state.design.cover, { pattern: b.dataset.key }) }); return changed(true);
      case 'cover-fill': state.design = Object.assign({}, state.design, { cover: Object.assign({}, state.design.cover, { fill: b.dataset.key }) }); return changed(true);
      case 'cover-reset': {
        const c = Object.assign({}, state.design.cover);
        ['kicker', 'title', 'titleEm', 'standards', 'foot', 'veil', 'showRef', 'showStandards', 'showPanel'].forEach((k) => delete c[k]);
        state.design = Object.assign({}, state.design, { cover: c });
        return changed(true);
      }
      case 'set-purpose': closePop(); state.meta.purposeCode = b.dataset.key; return changed(true);
      case 'iss-go': { const x = flow && flow.issues[i]; if (x) goStep(x.step, x.path); return; }
      case 'iss-fix': { const x = flow && flow.issues[i]; if (x && window.ValestaAI) window.ValestaAI.ask(t('issFixPrompt')(L3(x.title), L3(x.detail))); return; }
      case 'home-demo': if (!confirm(t('confirmExample'))) return; return saveNow().then(loadExample);
      case 'home-resume': return goStep(step);
      case 'wiz-src': wiz.src = b.dataset.key; renderTab(); return;
      case 'wiz-cat': wiz.cat = b.dataset.key; if (wiz.code && Taxonomy.typeByCode(wiz.code).category !== wiz.cat) wiz.code = ''; renderTab(); return;
      case 'wiz-type': { const ty = Taxonomy.typeByCode(b.dataset.key); if (ty) { wiz.code = ty.code; wiz.cat = ty.category; } renderTab(); return; }
      case 'wiz-cancel': return wiz && wiz.back !== 'home' ? goStep(wiz.back) : goHome();
      case 'wiz-create': return createFromWizard();
      case 'zoom-in': zoom = Math.min(1.6, (typeof zoom === 'number' ? zoom : currentZoom()) + 0.1); savePv(); return applyZoom();
      case 'zoom-out': zoom = Math.max(0.25, (typeof zoom === 'number' ? zoom : currentZoom()) - 0.1); savePv(); return applyZoom();
      case 'zoom-fit': zoom = 'fit'; savePv(); return applyZoom();
      case 'zoom-page': zoom = 'page'; savePv(); return applyZoom();
      case 'pv-follow': pvFollow = !pvFollow; savePv(); paintPvTools(); if (pvFollow) syncPreview(); return;
      case 'pv-chapters': return openPop('chapters', b);
      case 'pv-goto': {
        const sec = document.getElementById(b.dataset.key);
        const page = sec && sec.closest('.page');
        const sc = $('#pv-scroll');
        if (page) sc.scrollTop += page.getBoundingClientRect().top - sc.getBoundingClientRect().top - 12;
        return;
      }
      case 'map-size': {
        mapBig = !mapBig;
        try { localStorage.setItem('valesta-map-big', mapBig ? '1' : ''); } catch (e) { /* this visit only */ }
        const m = $('.loc-map');
        if (m) m.classList.toggle('big', mapBig);
        b.textContent = t(mapBig ? 'mapSmaller' : 'mapBigger');
        b.setAttribute('aria-pressed', String(mapBig));
        return;
      }
      case 'goto-result': return goStep('result');
      case 'poi-add': (S.pois = S.pois || []).push({ name: '', lat: null, lon: null }); geoUi.focusPoi = S.pois.length - 1; return changed(true);
      case 'poi-search': return geoSearch({ kind: 'poi', i });
      case 'poi-place': return startPick({ kind: 'poi', i });
      case 'geo-search': return geoSearch({ kind: 'subject' });
      case 'geo-result': return useResult(i);
      case 'geo-use-osm': writeJson(GEO_KEY, { provider: 'nominatim', accepted: new Date().toISOString() }); geoUi.panel = null; paintGeo(); return geoUi.after ? geoSearch(geoUi.after) : null;
      case 'geo-custom': geoUi.panel = 'custom'; return paintGeo();
      case 'geo-custom-save': {
        const u = (($('#geo-url') || {}).value || '').trim();
        if (!/^https:\/\/\S+$/i.test(u)) return toast(t('geoUrlBad'));
        writeJson(GEO_KEY, { provider: 'custom', url: u });
        geoUi.panel = null;
        paintGeo();
        return geoUi.after ? geoSearch(geoUi.after) : null;
      }
      case 'geo-off': writeJson(GEO_KEY, { provider: 'off' }); geoUi.panel = null; return paintGeo();
      case 'maps-consent': geoUi.panel = 'maps'; return paintGeo(true);
      case 'maps-on': geoUi.panel = null; return setMapsAllowed(true);
      case 'maps-stay-off': geoUi.panel = null; return paintGeo();
      case 'privacy': closeMenu(); return openPrivacy();
      case 'priv-accept-all': return applyPrivacy({ maps: true, geo: true, geodata: true });
      case 'priv-reject-all': return applyPrivacy({ maps: false, geo: false, geodata: false });
      case 'priv-save': {
        const on = (k) => !!($(`#dlg [data-priv="${k}"]`) || {}).checked;
        return applyPrivacy({ maps: on('maps'), geo: on('geo'), geodata: on('geodata') });
      }
      case 'priv-maps': setMapsAllowed(b.dataset.key === 'on'); return openPrivacy();
      case 'priv-geo-off': writeJson(GEO_KEY, { provider: 'off' }); if ($('#geo-panel')) paintGeo(); return openPrivacy();
      case 'priv-geodata':
        if (b.dataset.key === 'on') writeJson(GEODATA_KEY, { accepted: new Date().toISOString() }); else { try { localStorage.removeItem(GEODATA_KEY); } catch (e) { /* ignore */ } }
        return openPrivacy();
      case 'geo-service': geoUi.panel = 'consent'; geoUi.after = null; return paintGeo(true);
      case 'geo-place': return startPick({ kind: 'subject' });
      case 'geo-locate': return locateMe();
      case 'coord-apply': return applyCoord();
      case 'map-tiles-save': {
        const cfg = { url: (($('#map-url') || {}).value || '').trim(), attribution: (($('#map-attr') || {}).value || '').trim() };
        if (!Maps.custom(cfg)) return toast(t('mapUrlBad'));
        writeJson(TILES_KEY, cfg);
        state.map = Object.assign({}, state.map, { base: 'custom' });
        geoUi.panel = null;
        return changed(true);
      }
      case 'poi-del': S.pois.splice(i, 1); return changed(true);
      case 'room-add': (S.rooms = S.rooms || []).push({ name: t('newRoom'), m2: null }); return changed(true);
      case 'room-del': S.rooms.splice(i, 1); return changed(true);
      case 'ser-add': (M.series = M.series || []).push({ m: '', v: null }); return changed(true);
      case 'ser-del': M.series.splice(i, 1); return changed(true);
      case 'dis-add': (M.districts = M.districts || []).push({ name: '', v: null, yoy: null }); return changed(true);
      case 'dis-del': M.districts.splice(i, 1); return changed(true);
      case 'ref-add': (M.references = M.references || []).push({ label: '', value: '', url: '' }); return changed(true);
      case 'ref-del': M.references.splice(i, 1); return changed(true);
      case 'comp-add': { const c = AppCore.newComparable(state); state.comparables.push(c); selComp = c.id; step = 'comps'; return changed(true); }
      case 'comp-dup': { const c = AppCore.clone(state.comparables[i]); c.id = AppCore.newComparable(state).id; state.comparables.splice(i + 1, 0, c); selComp = c.id; return changed(true); }
      case 'comp-del': if (!confirm(t('confirmDelComp')(state.comparables[i].id))) return; state.comparables.splice(i, 1); return changed(true);
      case 'comp-up': if (swap(state.comparables, i, i - 1)) changed(true); return;
      case 'comp-down': if (swap(state.comparables, i, i + 1)) changed(true); return;
      case 'comp-toggle': { const c = state.comparables[i]; c.include = c.include === false; selComp = c.id; return changed(true); }
      // Style and brand: the colours of the report are set in the agency card further down the same page.
      case 'goto-brand': {
        const h = $$('#tab-body .card > h3').find((x) => x.textContent.trim().startsWith(t('brandT')));
        if (h) { h.scrollIntoView({ block: 'start' }); h.tabIndex = -1; h.focus({ preventScroll: true }); }
        return;
      }
      // From the comparison view to the card of the comparable: opened, in view, with the focus on its title.
      case 'comp-open': {
        if (!state.comparables[i]) return;
        selComp = state.comparables[i].id;
        renderTab();
        const d = $(`.comp[data-i="${i}"]`);
        if (d) { d.open = true; d.scrollIntoView({ block: 'start' }); const s = d.querySelector('summary'); if (s) s.focus({ preventScroll: true }); }
        return;
      }
      case 'comp-suggest': { const n = AppCore.applySuggestions(state, state.comparables[i].id); toast(t('toastSuggest')(state.comparables[i].id, n)); return changed(true); }
      case 'suggest-all': { if (!confirm(t('confirmSuggestAll'))) return; toast(t('toastSuggestAll')(AppCore.applySuggestions(state))); return changed(true); }
      case 'omog-sel': selComp = b.dataset.id; return renderTab();
      case 'photo-add': return $('#file-photos').click();
      case 'photo-del': state.photos.splice(i, 1); return changed(true);
      case 'photo-up': if (swap(state.photos, i, i - 1)) changed(true); return;
      case 'photo-down': if (swap(state.photos, i, i + 1)) changed(true); return;
      case 'txt-reset': clearLoc(state.texts, b.dataset.key, RL()); return changed(true);
      case 'logo-upload': logoTarget = b.dataset.key; return $('#file-logo').click();
      case 'logo-remove': state.brand[b.dataset.key] = null; return changed(true);
      case 'undo': return undo();
      case 'redo': return redo();
      case 'assistant': if (window.ValestaAI) window.ValestaAI.toggle(); return;
      case 'ai-review': if (window.ValestaAI) window.ValestaAI.ask(t('aiQuick')[3][1]); return;
      case 'archive': return goHome();
      case 'dlg-close': return closeDialog();
      case 'arch-open': return archiveOpen(b.dataset.id);
      case 'arch-dup': return archiveDuplicate(b.dataset.id);
      case 'arch-del': return archiveDelete(b.dataset.id);
      case 'share': return shareReport();
      case 'profile-export': return exportProfile();
      case 'profile-import': return $('#file-profile').click();
      case 'goto-tab': return goStep(b.dataset.key);
      case 'design-preset': {
        const k = b.dataset.key;
        state.design = state.design || {};
        state.design.preset = k;
        state.design.sections = Object.assign({}, Report.DEFAULT_DESIGN.sections, Report.PRESETS[k] || {});
        return changed(true);
      }
      case 'cs-add':
        (state.customSections = state.customSections || []).push({ id: 'cs' + Date.now().toString(36), enabled: true, after: 'end', title: { [RL()]: t('csNew') }, kicker: '', body: '' });
        return changed(true);
      case 'cs-tpl': {
        const tp = CS_TEMPLATES[b.dataset.key];
        if (!tp) return;
        const c = tp(state.brand && state.brand.name ? state.brand.name : 'Valesta');
        (state.customSections = state.customSections || []).push({ id: 'cs' + Date.now().toString(36), enabled: true, after: b.dataset.key === 'about' ? 'certification' : b.dataset.key === 'planning' ? 'description' : 'end', title: c.title, kicker: '', body: c.body });
        return changed(true);
      }
      case 'cs-up': if (swap(state.customSections, i, i - 1)) changed(true); return;
      case 'cs-down': if (swap(state.customSections, i, i + 1)) changed(true); return;
      case 'cs-del': if (!confirm(t('confirmDelCs')(I18N.loc(state.customSections[i].title, RL()) || '—'))) return; state.customSections.splice(i, 1); return changed(true);
      case 'sig-remove': state.meta.advisor.signature = null; return changed(true);
      case 'brand-reset': {
        if (!confirm(t('confirmResetBrand'))) return;
        const r = AppCore.applyProfile(state, Profiles.get(Profiles.DEFAULT_ID).profile);
        state = r.state;
        state.brand.profileId = Profiles.DEFAULT_ID;
        return changed(true);
      }
      case 'prof-use': {
        const p = findProfile(b.dataset.id);
        if (!p || !confirm(t('confirmProfile')(p.label))) return;
        const r = AppCore.applyProfile(state, p.profile);
        if (!r.ok) return toast(t('invalidProfile'));
        state = r.state;
        state.brand.profileId = p.id;
        renderChrome();
        changed(true);
        return toast(t('toastProfile'));
      }
      case 'prof-default': {
        const p = findProfile(b.dataset.id);
        if (!p) return;
        try { localStorage.setItem(DEFAULT_PROFILE_KEY, p.id); } catch (e) { /* ignore */ }
        renderTab();
        return toast(t('toastProfDefault')(p.label));
      }
      case 'prof-dup': {
        const p = findProfile(b.dataset.id);
        if (!p) return;
        putProfile({ id: newProfileId(), label: `${p.label} (2)`, profile: AppCore.clone(p.profile) }).then(() => { renderTab(); toast(t('toastProfSaved')); });
        return;
      }
      case 'prof-del': {
        const p = findProfile(b.dataset.id);
        if (!p || p.builtin || !confirm(t('confirmProfDel')(p.label))) return;
        if (defaultProfileId() === p.id) { try { localStorage.removeItem(DEFAULT_PROFILE_KEY); } catch (e) { /* ignore */ } }
        deleteProfile(p.id).then(renderTab);
        return;
      }
      case 'prof-export': {
        const p = findProfile(b.dataset.id);
        if (p) download(new Blob([JSON.stringify(Object.assign({}, p.profile, { name: p.label }), null, 1)], { type: 'application/json' }), `${t('profileFile')}_${AppCore.slug(p.label) || 'agency'}.valesta-profile.json`);
        return;
      }
      case 'prof-new': {
        const name = prompt(t('profNamePrompt'), state.brand.name || '');
        if (!name || !name.trim()) return;
        const id = newProfileId();
        state.brand.profileId = id;
        putProfile({ id, label: name.trim(), profile: Object.assign(AppCore.makeProfile(state), { name: name.trim() }) }).then(() => { changed(true); toast(t('toastProfSaved')); });
        return;
      }
      case 'prof-save': {
        const p = findProfile(state.brand.profileId);
        if (!p || p.builtin) return;
        putProfile({ id: p.id, label: p.label, profile: Object.assign(AppCore.makeProfile(state), { name: p.label }) }).then(() => { renderTab(); toast(t('toastProfSaved')); });
        return;
      }
      default:
    }
  }

  // ---------- menu & views ----------
  function toggleMenu() { const m = $('#menu'); const open = !m.classList.contains('open'); m.classList.toggle('open', open); $('#menu-btn').setAttribute('aria-expanded', open); }
  function closeMenu() { const m = $('#menu'); if (m.classList.contains('open')) { m.classList.remove('open'); $('#menu-btn').setAttribute('aria-expanded', 'false'); } }
  function setView(v) {
    if (v === 'preview') { if (phoneMode()) setFullPreview(true); else setCtx('preview', true); } else setFullPreview(false);
  }
  function setUiLang(l) {
    uiLang = I18N.LANGS.includes(l) ? l : 'en';
    try { localStorage.setItem(UILANG_KEY, uiLang); } catch (e) { /* ignore */ }
    renderChrome();
    renderTab();
    refreshTop();
    renderPreview();
    if (window.ValestaAI) window.ValestaAI.relabel();
  }

  // ---------- files ----------
  const blobToBase64 = (blob) => new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result).split(',')[1] || ''); r.onerror = reject; r.readAsDataURL(blob); });
  async function nativeShareFile(blob, name, title) {
    const fs = nativePlugin('Filesystem');
    const sh = nativePlugin('Share');
    if (!fs || !sh) throw new Error('Filesystem / Share plugin missing');
    const w = await fs.writeFile({ path: name, data: await blobToBase64(blob), directory: 'CACHE' });
    // true once shared, false if the user cancelled the share sheet
    try { await sh.share({ title: title || name, dialogTitle: title || name, files: [w.uri] }); return true; } catch (e) { if (!/cancel/i.test(String(e && e.message))) throw e; return false; }
  }
  // Hands the file over. Resolves to true when the browser received the download (it does not tell whether the file
  // was then saved) or, in the Android and iOS apps, when the share sheet completed; false when cancelled or failed.
  function download(blob, name) {
    if (NATIVE) return nativeShareFile(blob, name).then((shared) => { toast(t('nativeSaved')(name)); return shared; }, (e) => { toast(t('aiError')(e.message || e)); return false; });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
    return Promise.resolve(true);
  }
  // A report was exported (support.js counts only exports that ended well).
  const reportExported = (done) => { if (window.ValestaSupport) window.ValestaSupport.exported(done); return done; };
  function saveProject() {
    download(new Blob([JSON.stringify(state, null, 1)], { type: 'application/json' }), AppCore.fileName(state, 'json'));
    toast(t('toastSaved'));
  }
  const reportName = (ext) => `${Report.fileTitle(RL())}_${AppCore.fileName(state, ext)}`;
  // Standalone report: only the fonts it uses, fit factors measured at 100 %, no scripts.
  // Exported reports carry their map images inside the file, so whoever opens them contacts no outside service.
  async function fetchDataUrl(url) {
    const r = await fetch(url, { mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!r.ok) return null;
    const blob = await r.blob();
    if (!/^image\//.test(blob.type)) return null;
    return new Promise((resolve) => { const fr = new FileReader(); fr.onload = () => resolve(String(fr.result)); fr.onerror = () => resolve(null); fr.readAsDataURL(blob); });
  }
  async function exportReportHtml() {
    const html = buildReportHtml();
    return Maps.isAllowed() ? Report.inlineImages(html, fetchDataUrl) : html;
  }
  function buildReportHtml() {
    atFullSize(fitAndCheck);
    const fonts = Report.filterFontCss(document.getElementById('css-fonts').textContent, Report.usedFonts(state));
    const css = fonts + '\n' + document.getElementById('css-report').textContent + '\n' + Report.brandCss(state);
    return Report.documentHtml(Report.render(state, res, { fit: lastFit }), css, Report.documentTitle(state), RL());
  }
  // Digital file: the report (HTML) and the attached documents with an index, in one ZIP archive.
  async function exportDossier() {
    const enc = new TextEncoder();
    const files = [{ name: reportName('html'), data: enc.encode(await exportReportHtml()) }];
    const ext = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
    const lines = [];
    (state.attachments || []).forEach((a, i) => {
      const b64 = String(a.dataUrl || '').split(',')[1] || '';
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const n = String(i + 1).padStart(2, '0');
      const name = `${t('attFolder')}/${n} ${String(a.title || a.name || 'doc').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80)}.${ext[a.mime] || 'bin'}`;
      files.push({ name, data: bytes });
      lines.push([n, a.title || a.name, (t('attKinds') || {})[a.kind] || a.kind, a.issuer || '', a.date || '', a.ref || '', 'SHA-256 ' + (a.sha256 || '-')].join('\t'));
    });
    if (lines.length) files.push({ name: `${t('attFolder')}/${t('attIndexFile')}`, data: enc.encode(lines.join('\r\n') + '\r\n') });
    reportExported(download(new Blob([Zip.build(files)], { type: 'application/zip' }), reportName('zip')));
    toast(t('dossierDone')(files.length - (lines.length ? 2 : 1)));
  }
  async function exportHtml() {
    reportExported(download(new Blob([await exportReportHtml()], { type: 'text/html;charset=utf-8' }), reportName('html')));
    toast(t('toastHtml'));
  }
  async function shareReport() {
    const html = await exportReportHtml();
    if (NATIVE) return reportExported(nativeShareFile(new Blob([html], { type: 'text/html' }), reportName('html'), Report.documentTitle(state)).catch((e) => { toast(t('aiError')(e.message || e)); return false; }));
    const file = new File([html], reportName('html'), { type: 'text/html' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: Report.documentTitle(state) }); reportExported(true); } catch (e) { /* cancelled */ }
    } else exportHtml();
  }
  function exportProfile() {
    download(new Blob([JSON.stringify(AppCore.makeProfile(state), null, 1)], { type: 'application/json' }), `${t('profileFile')}_${AppCore.slug(state.brand && state.brand.name) || 'agenzia'}.valesta-profile.json`);
  }
  function applyProfileObject(obj) {
    if (!AppCore.isProfile(obj)) return toast(t('invalidProfile'));
    const label = String(obj.name || obj.brand.name || 'Profile').slice(0, 80);
    if (!confirm(t('confirmProfile')(label))) return;
    const r = AppCore.applyProfile(state, obj);
    if (!r.ok) return toast(t('invalidProfile'));
    const id = newProfileId();
    state = r.state;
    state.brand.profileId = id;
    // An imported profile joins the library (validated copy: only safe logos and images).
    putProfile({ id, label, profile: Object.assign(AppCore.makeProfile(state), { name: label }) }).catch(() => null);
    renderChrome();
    changed(true);
    toast(t('toastProfile'));
  }
  function importProfile(file) {
    const rd = new FileReader();
    rd.onload = () => { let obj; try { obj = JSON.parse(rd.result); } catch (e) { obj = null; } applyProfileObject(obj); };
    rd.readAsText(file);
  }
  let printTitle = null;
  function beforePrint() {
    if (ctxTab !== 'preview') setCtx('preview');
    if (printTitle == null) { printTitle = document.title; document.title = reportName('pdf').replace(/\.pdf$/, ''); }
    document.body.classList.add('printing');
    const rep = $('#report');
    rep.classList.remove('spread');
    rep.style.setProperty('--zoom', 1);
    fitAndCheck();
  }
  function afterPrint() {
    if (printTitle != null) { document.title = printTitle; printTitle = null; }
    document.body.classList.remove('printing');
    applyZoom();
  }
  function printPdf() {
    const over = atFullSize(fitAndCheck);
    if (over.length && !confirm(t('confirmOverflow')(over.join(', ')))) return;
    if (NATIVE) {
      const pr = nativePlugin('ValestaPrint');
      beforePrint();
      if (pr && typeof pr.print === 'function') {
        pr.print({ name: reportName('pdf').replace(/\.pdf$/, '') }).catch(() => shareReport()).finally(() => setTimeout(afterPrint, 600));
      } else { afterPrint(); toast(t('nativePrintNo')); shareReport(); }
      return;
    }
    toast(t('toastPrint'), null, 7000);
    beforePrint();
    setTimeout(() => window.print(), 80);
  }
  function openProject(file) {
    const rd = new FileReader();
    rd.onload = () => {
      let obj;
      try { obj = JSON.parse(rd.result); } catch (e) { obj = null; }
      if (AppCore.isProfile(obj)) return applyProfileObject(obj);
      const v = AppCore.validateState(obj, DEFAULT_STATE);
      if (!v.ok) return toast(t('invalidProject'));
      screen = 'step';
      loadState(v.state, t('toastOpened')(v.state.subject.address || file.name));
      $('#main').scrollTop = 0;
    };
    rd.readAsText(file);
  }
  function resetExample() {
    if (!confirm(t('confirmExample'))) return;
    loadExample();
  }

  // ---------- images ----------
  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => resolve({ img, url });
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(file.name)); };
      img.src = url;
    });
  }
  async function compressImage(file, maxSide, quality, png) {
    const { img, url } = await loadImage(file);
    const r = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * r));
    const h = Math.max(1, Math.round(img.naturalHeight * r));
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    if (!png) { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); }
    g.drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(url);
    return c.toDataURL(png ? 'image/png' : 'image/jpeg', quality);
  }
  async function addPhotos(files) {
    const list = Array.from(files || []).filter((f) => /^image\//.test(f.type) || /\.(jpe?g|png|webp|heic)$/i.test(f.name));
    if (!list.length) return;
    let ok = 0;
    const bad = [];
    for (const f of list) {
      try {
        const dataUrl = await compressImage(f, 1800, 0.85, false);
        state.photos.push({ id: 'p' + Date.now() + Math.random().toString(36).slice(2, 6), dataUrl, caption: f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '), cover: false });
        ok++;
      } catch (e) { bad.push(f.name); }
    }
    if (screen === 'step') step = 'photos';
    changed(true);
    toast(t('toastPhotos')(ok, bad.join(', ')));
  }
  async function addLogo(file) {
    if (!file) return;
    if (logoTarget === 'coverImage') {
      let img;
      try { img = await compressImage(file, 2200, 0.86, false); } catch (e) { img = null; }
      if (!AppCore.isSafeImage(img)) return toast(t('invalidImage'));
      state.design = Object.assign({}, state.design, { coverImage: img });
      if (['gradient', 'solid', 'blueprint', 'minimal'].includes(state.design.coverStyle)) state.design.coverStyle = 'fullbleed';
      toast(t('coverImgDone'));
      return changed(true);
    }
    if (logoTarget === 'signature') {
      let sig;
      try { sig = await compressImage(file, 900, 0.92, true); } catch (e) { sig = null; }
      if (!AppCore.isSafeImage(sig)) return toast(t('invalidImage'));
      state.meta.advisor = Object.assign({}, state.meta.advisor || {}, { signature: sig });
      return changed(true);
    }
    let data;
    try {
      if (file.type === 'image/svg+xml' || /\.svg$/i.test(file.name)) {
        data = await new Promise((resolve, reject) => { const rd = new FileReader(); rd.onload = () => resolve(rd.result); rd.onerror = reject; rd.readAsDataURL(file); });
        if (!/^data:image\/svg\+xml;base64,/.test(data)) data = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(await file.text())));
      } else data = await compressImage(file, 1400, 0.92, true);
    } catch (e) { data = null; }
    if (!AppCore.isSafeLogo(data)) return toast(t('invalidImage'));
    state.brand[logoTarget] = data;
    if (state.brand.logoMode !== 'custom') state.brand.logoMode = 'custom';
    changed(true);
  }

  // ---------- archive (IndexedDB) ----------
  const fmtDate = (iso) => { try { return new Date(iso).toLocaleString(I18N.LOCALE[uiLang] || 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return iso || ''; } };
  function closeDialog() { const d = $('#dlg'); privacyNoticeDone(); if (d.open && d.close) d.close(); else d.removeAttribute('open'); }
  async function archiveOpen(id) {
    await saveNow();
    const rec = await ValestaStore.get(id).catch(() => null);
    const v = rec && AppCore.validateState(rec.state, DEFAULT_STATE);
    if (!v || !v.ok) return toast(t('archUnavailable'));
    closeDialog();
    screen = 'step';
    step = 'identity';
    loadState(v.state, t('toastOpened')(rec.title));
    $('#main').scrollTop = 0;
  }
  async function archiveDuplicate(id) {
    await saveNow();
    const rec = id === state.meta.id ? { state: AppCore.clone(state) } : await ValestaStore.get(id).catch(() => null);
    const v = rec && AppCore.validateState(rec.state, DEFAULT_STATE);
    if (!v || !v.ok) return;
    delete v.state.meta.id;
    closeDialog();
    screen = 'step';
    step = 'identity';
    loadState(v.state, t('toastDup'));
    $('#main').scrollTop = 0;
    await saveNow();
  }
  async function archiveDelete(id) {
    const rec = archiveList.find((r) => r.id === id);
    if (!rec || id === state.meta.id || !confirm(t('confirmArchDel')(rec.title))) return;
    await ValestaStore.del(id).catch(() => null);
    archiveList = archiveList.filter((r) => r.id !== id);
    paintHome();
  }

  // ---------- live link with the Valesta MCP server (app served by it on localhost) ----------
  async function liveDetect() {
    if (!/^https?:$/.test(location.protocol) || !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) return;
    try {
      const r = await fetch('api/version', { cache: 'no-store' });
      if (!r.ok) return;
      const v = await r.json();
      if (!v || v.app !== 'valesta') return;
      LIVE.on = true;
      $('#live-badge').hidden = false;
      if (v.version > 0) await livePull(true); else await livePush();
      LIVE.timer = setInterval(livePoll, 1500);
    } catch (e) { /* not served by the MCP server */ }
  }
  async function livePoll() {
    if (!LIVE.on || LIVE.pushing) return;
    try {
      const r = await fetch('api/version', { cache: 'no-store' });
      const v = await r.json();
      if (LIVE.failures >= 3) { $('#live-badge').hidden = false; }
      LIVE.failures = 0;
      if (v.version > LIVE.version && !LIVE.pushTimer) await livePull(false);
    } catch (e) {
      LIVE.failures++;
      if (LIVE.failures === 3) { $('#live-badge').hidden = true; toast(t('liveLost')); }
    }
  }
  async function livePull(initial) {
    const r = await fetch('api/project', { cache: 'no-store' });
    const data = await r.json();
    const v = data && AppCore.validateState(data.state, DEFAULT_STATE);
    if (!v || !v.ok) return;
    LIVE.version = data.version;
    const synced = LIVE.synced ? JSON.parse(LIVE.synced) : null;
    LIVE.synced = JSON.stringify(Object.assign({}, v.state, { photos: [], attachments: [] }));
    if (initial) return loadState(v.state);
    const prop = synced ? AIReview.fromExternal(synced, v.state, { provider: 'MCP', summary: t('mcpProposal') }) : null;
    if (prop) v.state.aiLog = (v.state.aiLog || []).concat([prop]);
    settleHistory();
    hist.undo.push(snap());
    hist.redo = [];
    state = v.state;
    afterRestore();
    toast(t('liveUpdated'));
  }
  function liveSchedulePush() {
    if (!LIVE.on) return;
    clearTimeout(LIVE.pushTimer);
    LIVE.pushTimer = setTimeout(() => { LIVE.pushTimer = null; livePush(); }, 600);
  }
  async function livePush() {
    LIVE.pushing = true;
    try {
      const r = await fetch('api/project', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ base: LIVE.version, state }) });
      const d = await r.json().catch(() => null);
      if (r.status === 409) { LIVE.pushing = false; return livePull(false); }
      if (d && d.version) { LIVE.version = d.version; LIVE.synced = JSON.stringify(Object.assign({}, state, { photos: [], attachments: [] })); }
    } catch (e) { /* offline: next change retries */ } finally { LIVE.pushing = false; }
  }

  // ---------- API for the assistant module ----------
  function exposeApi() {
    window.Valesta = {
      get state() { return state; }, get result() { return res; }, t, uiLang: () => uiLang, reportLang: () => RL(), toast, esc, compressImage, version: VERSION,
      snapshot: snap,
      beginChange: () => { settleHistory(); const sn = snap(); hist.undo.push(sn); if (hist.undo.length > 80) hist.undo.shift(); hist.redo = []; return sn; },
      commitChange: () => { if (!state.comparables.some((c) => c.id === selComp)) selComp = state.comparables[0] && state.comparables[0].id; afterRestore(); },
      restore: (sn) => { settleHistory(); hist.undo.push(snap()); hist.redo = []; restoreSnap(sn); afterRestore(); },
      openTab: (tab) => { const x = Workflow.stepForTab(tab); if (x) goStep(x); },
      openStep: (x) => goStep(x),
      setView,
      aiProposal,
    };
  }

  // ---------- PWA (only when served over http/https) ----------
  function setupPwa() {
    // Only the PWA bundle (Web/index.html, also served by the MCP server) has a manifest and a service worker.
    if (NATIVE || !/^https?:$/.test(location.protocol) || !/\/(index\.html)?$/.test(location.pathname)) return;
    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = 'manifest.webmanifest';
    document.head.appendChild(link);
    const icon = document.createElement('link');
    icon.rel = 'apple-touch-icon';
    icon.href = 'icons/apple-touch-icon.png';
    document.head.appendChild(icon);
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  // ---------- init ----------
  function bindGlobal() {
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#pop') && !e.target.closest('[data-action^="pop-"]')) closePop();
      if (e.target === $('#palette')) return closePalette();
      const pi = e.target.closest('[data-pi]');
      if (pi) return runCmd(palItems[+pi.dataset.pi]);
      const sb = e.target.closest('[data-step]');
      if (sb) { e.preventDefault(); return goStep(sb.dataset.step); }
      const pb = e.target.closest('[data-phase]');
      if (pb) {
        const ph = Workflow.PHASES.find((p) => p.id === pb.dataset.phase);
        const next = ph && (ph.steps.find((x) => flow && flow.byStep[x].status !== 'ok') || ph.steps[0]);
        return next && goStep(next);
      }
      const cb = e.target.closest('[data-ctx]');
      if (cb) { if (cb.dataset.ctx === 'ai' && window.ValestaAI) return window.ValestaAI.open(); return setCtx(cb.dataset.ctx); }
      const tb = e.target.closest('[data-tab]');
      if (tb) { e.preventDefault(); return goStep(tb.dataset.tab); }
      if (e.target.closest('[data-action]')) return onAction(e);
      if (!e.target.closest('#menu')) closeMenu();
    });
    const body = $('#tab-body');
    body.addEventListener('input', onField);
    body.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target && e.target.id === 'geo-coord') { e.preventDefault(); applyCoord(); } });
    body.addEventListener('change', (e) => { if (e.target.matches('select, input[type=checkbox], input[type=date], input[type=color]')) onField(e); });
    const onUi = (e) => {
      const el = e.target;
      if (el.dataset && el.dataset.chk) {
        const r = (state.checks || []).find((x) => x.topic === el.dataset.chk);
        if (r && ['source', 'date'].includes(el.dataset.field)) { r[el.dataset.field] = el.value; changed(false); }
        return;
      }
      if (!el.id) return;
      if (el.id === 'home-q') { homeQ = el.value; return paintHome(); }
      if (el.id === 'dlv-lang' && e.type === 'change') { state.meta.reportLang = el.value; renderChrome(); return changed(true); }
      if (el.id === 'geo-crs' && e.type === 'change') { geoUi.crs = el.value; return syncMap(); }
      if (el.id === 'map-base' && e.type === 'change') {
        if (el.value === 'custom' && !Maps.custom(readJson(TILES_KEY) || {})) { geoUi.panel = 'tiles'; return paintGeo(true); }
        state.map = Object.assign({}, state.map, { base: el.value });
        return changed(true);
      }
      if (!wiz || screen !== 'start') return;
      if (el.id === 'wiz-address') wiz.address = el.value;
      else if (el.id === 'wiz-desc') { wiz.desc = el.value; $('#wiz-guess').innerHTML = guessHtml(); }
      else if (e.type === 'change' && el.id === 'wiz-country') { wiz.country = el.value; renderTab(); }
      else if (e.type === 'change' && el.id === 'wiz-lang') wiz.lang = el.value;
      else if (e.type === 'change' && el.id === 'wiz-purpose') { wiz.purpose = el.value; renderTab(); }
    };
    body.addEventListener('input', onUi);
    body.addEventListener('change', onUi);
    $('#pal-input').addEventListener('input', (e) => renderPal(e.target.value));
    // A screen change has moved once: the class goes, so a later redraw does not move again.
    body.addEventListener('animationend', (e) => { if (e.target === body) body.classList.remove('entering'); });
    // Where the preview is, kept on the device (used when "follow the step" is off).
    const pvSc = $('#pv-scroll');
    if (pvSc) pvSc.addEventListener('scroll', debounce(() => { pvPrefs.top = Math.round(pvSc.scrollTop); savePv(); }, 400), { passive: true });
    body.addEventListener('toggle', (e) => {
      const d = e.target;
      if (d.classList && d.classList.contains('comp') && d.open) selComp = state.comparables[+d.dataset.i].id;
      // The advanced coordinates stay open across redraws of the step once opened.
      if (d.classList && d.classList.contains('loc-adv')) geoUi.adv = d.open;
    }, true);
    $('#file-open').addEventListener('change', (e) => { if (e.target.files[0]) openProject(e.target.files[0]); e.target.value = ''; });
    $('#file-photos').addEventListener('change', (e) => { addPhotos(e.target.files); e.target.value = ''; });
    $('#file-logo').addEventListener('change', (e) => { addLogo(e.target.files[0]); e.target.value = ''; });
    $('#file-att').addEventListener('change', (e) => { addAttachments(e.target.files).catch(() => toast(t('attError'))); e.target.value = ''; });
    $('#file-profile').addEventListener('change', (e) => { if (e.target.files[0]) importProfile(e.target.files[0]); e.target.value = ''; });
    $('#dlg').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeDialog(); });
    ['dragenter', 'dragover'].forEach((ev) => document.addEventListener(ev, (e) => {
      if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes('Files')) return;
      e.preventDefault();
      const dz = $('#dropzone'); if (dz) dz.classList.add('over');
    }));
    ['dragleave', 'drop'].forEach((ev) => document.addEventListener(ev, () => { const dz = $('#dropzone'); if (dz) dz.classList.remove('over'); }));
    document.addEventListener('drop', (e) => {
      if (!e.dataTransfer || !e.dataTransfer.files.length) return;
      e.preventDefault();
      const f = e.dataTransfer.files;
      if (f.length === 1 && /\.json$/i.test(f[0].name)) return openProject(f[0]);
      addPhotos(f);
    });
    window.addEventListener('beforeprint', beforePrint);
    window.addEventListener('afterprint', afterPrint);
    window.addEventListener('resize', debounce(() => { closePop(); applyZoom(); }, 120));
    document.addEventListener('keydown', (e) => {
      const mod = e.ctrlKey || e.metaKey;
      const typing = e.target.closest && e.target.closest('input, textarea, select, [contenteditable="true"]');
      if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); saveProject(); }
      if (mod && !typing && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if (mod && !typing && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
      if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); return $('#palette').hidden ? openPalette() : closePalette(); }
      if (e.key === '/' && !typing && $('#palette').hidden) { e.preventDefault(); return openPalette(); }
      if (!$('#palette').hidden) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          if (!palItems.length) return;
          palIdx = (palIdx + (e.key === 'ArrowDown' ? 1 : -1) + palItems.length) % palItems.length;
          paintPal();
          const on = $('.pi.on');
          if (on) on.scrollIntoView({ block: 'nearest' });
          return;
        }
        if (e.key === 'Enter') { e.preventDefault(); return runCmd(palItems[palIdx]); }
        if (e.key === 'Escape') { e.preventDefault(); return closePalette(); }
        return;
      }
      if (e.key === 'Escape') {
        closeMenu();
        if (!$('#pop').hidden) return closePop();
        if (document.body.classList.contains('pv-full')) return setFullPreview(false);
        if (drawerMode()) $('#ctx').classList.remove('open');
      }
    });
  }

  async function init() {
    storeOk = !!window.ValestaStore && await window.ValestaStore.available();
    Maps.setAllowed(!!readJson(MAPS_KEY));
    await loadProfiles();
    if (NATIVE) document.body.classList.add('native');
    let cur;
    try { cur = localStorage.getItem(CURRENT_KEY); } catch (e) { cur = null; }
    let saved = null;
    if (storeOk && cur) { try { const rec = await ValestaStore.get(cur); saved = rec && rec.state; } catch (e) { saved = null; } }
    if (!saved) saved = AppCore.loadLocal(storage(), STORE_KEY);
    // The language of the app: the one chosen, else the browser's. The browser's is not stored, so the app keeps
    // following the browser until the user chooses.
    let ul;
    try { ul = localStorage.getItem(UILANG_KEY); } catch (e) { ul = null; }
    uiLang = AppCore.uiLangFor(ul, [].concat(navigator.languages || [], navigator.language || []));
    let restored = false;
    if (saved) { const v = AppCore.validateState(saved, DEFAULT_STATE); if (v.ok) { state = v.state; restored = true; } }
    if (!state) state = freshExample();
    AppCore.ensureId(state);
    selComp = state.comparables[0] && state.comparables[0].id;
    recompute();
    hist.last = snap();
    exposeApi();
    bindGlobal();
    // Help menu: the optional invitation to support the project and the feedback form (support.js).
    if (window.ValestaSupport) {
      window.ValestaSupport.mount({ t, esc, ic, closeDialog, lang: () => uiLang, native: NATIVE && typeof CAP.getPlatform === 'function' ? CAP.getPlatform() : '',
        version: () => { const bi = window.VALESTA_BUILD; return `Valesta ${VERSION}${bi && bi.commit ? ` (${bi.commit}${bi.dirty ? '+' : ''})` : ''}`; } });
    }
    window.ValestaShell = {
      showAI: () => setCtx('ai', true),
      hideAI: () => { if (ctxTab === 'ai') setCtx('preview'); if (drawerMode()) $('#ctx').classList.remove('open'); },
      aiVisible: () => ctxTab === 'ai' && (!drawerMode() || $('#ctx').classList.contains('open')),
    };
    renderChrome();
    setCtx('preview');
    renderTab();
    renderPreview();
    setupPwa();
    if (window.ValestaAI) window.ValestaAI.init();
    if (restored) toast(t('toastRestored'), [[t('toastBackExample'), resetExample]]);
    liveDetect();
    // First start on this device: the privacy window asks which outside services to use (Esc counts as closing it).
    $('#dlg').addEventListener('close', privacyNoticeDone);
    if (!readJson(NOTICE_KEY)) openPrivacy(true);
    window.__valesta = { get state() { return state; }, get result() { return res; }, get fit() { return lastFit; }, get step() { return step; }, get screen() { return screen; }, checkOverflow, fitAndCheck, setView, setUiLang, undo, redo, buildReportHtml, goStep, goHome, goStart, openPalette };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
