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
/* Layout of the workspace.
   Wide screens (more than 1240 px) have three modes: Form (steps and form), Form + document (the preview takes the width
   left beyond a form of reading width, with a divider that can be dragged or moved with the keyboard) and Document review
   (the document first, the form in a narrow column). When the steps, a form of reading width and a useful preview do not
   fit side by side, and in Document review, the steps become a drawer opened from the strip at the top of the step; on
   tablets in portrait they are a drawer in every mode. The mode and the widths chosen with the divider are kept on the
   device ("valesta-layout"). The editor fits the preview on every window resize, so a resize event is enough here. */
(function () {
  'use strict';
  const KEY = 'valesta-layout';
  const MODES = ['compile', 'split', 'review'];
  const LABELS = { compile: 'layoutCompile', split: 'layoutSplit', review: 'layoutReview' };
  const FORM = 800; // reading width of a form (--form-w in app.css)
  const FORM_MIN = 720; // narrowest form shown next to the document before the steps become a drawer
  const MAIN_MIN = 520; // the divider never makes the form column narrower than this
  const MIN_CTX = 400; // narrower than this an A4 page is only a thumbnail
  const FAIR_CTX = 560; // on mid-size screens the form gives up to 80 px of its width so the page reaches this
  const REVIEW_FORM = 520; // in Document review the form keeps this column…
  const REVIEW_MAX = 1100; // …and the page grows up to about 125 %
  const DIVIDER = 9;
  const STEP = 24;
  const DRAWER_MAX = 900; // tablets in portrait: the steps are a drawer in every mode
  const app = document.getElementById('app');
  const root = document.documentElement;
  if (!app) return;

  function read() {
    try {
      const v = JSON.parse(window.localStorage.getItem(KEY) || 'null') || {};
      const num = (x) => (Number.isFinite(x) ? x : null);
      // "width" is the key used before the review width was kept apart.
      return { mode: MODES.includes(v.mode) ? v.mode : 'split', split: num(v.split != null ? v.split : v.width), review: num(v.review) };
    } catch (e) {
      return { mode: 'split', split: null, review: null };
    }
  }
  const state = read();
  const save = () => { try { window.localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* kept for this visit only */ } };
  const matches = (q) => typeof window.matchMedia === 'function' && window.matchMedia(q).matches;
  const wide = () => matches('(min-width: 1241px)');
  const phone = () => matches('(max-width: 760px)');
  const px = (v, d) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };
  const sideWidth = () => px(getComputedStyle(root).getPropertyValue('--side'), 216);
  function pad() {
    const m = document.getElementById('main');
    if (!m) return 64;
    const cs = getComputedStyle(m);
    return px(cs.paddingLeft, 32) + px(cs.paddingRight, 32);
  }

  // Where the steps go: in the grid ("side"), in a drawer ("drawer") or nowhere (phone: the bottom bar has the phases).
  function navMode() {
    if (phone()) return 'none';
    if (!wide()) return window.innerWidth <= DRAWER_MAX ? 'drawer' : 'side';
    if (state.mode === 'review') return 'drawer';
    if (state.mode === 'split' && window.innerWidth - sideWidth() - DIVIDER < FORM_MIN + pad() + MIN_CTX) return 'drawer';
    return 'side';
  }
  const room = () => window.innerWidth - (navMode() === 'side' ? sideWidth() : 0) - DIVIDER;
  const bounds = () => ({ min: MIN_CTX, max: Math.max(MIN_CTX, Math.round(room() - MAIN_MIN)) });
  const clamp = (w) => { const b = bounds(); return Math.round(Math.min(b.max, Math.max(b.min, w))); };
  const slot = () => (state.mode === 'review' ? 'review' : 'split');
  // Without a width chosen with the divider: in Form + document the form keeps its reading width (800 px, down to 720 px
  // on mid-size screens) and the document takes the rest; in Document review the form keeps a narrow column and the page
  // grows up to about 125 %.
  function auto() {
    if (state.mode === 'review') return Math.min(REVIEW_MAX, room() - REVIEW_FORM);
    return Math.max(room() - FORM - pad(), Math.min(room() - FORM_MIN - pad(), FAIR_CTX));
  }
  const width = () => clamp(state[slot()] == null ? auto() : state[slot()]);

  // The editor re-fits the preview on resize; events sent from here are not handled again by this file.
  let selfResize = false;
  function refit() { selfResize = true; window.dispatchEvent(new Event('resize')); selfResize = false; }

  const side = () => document.getElementById('side');
  const navOpen = () => { const s = side(); return !!s && s.classList.contains('open'); };
  function setNav(open, focusBack) {
    const s = side();
    if (!s) return;
    const was = s.classList.contains('open');
    s.classList.toggle('open', open);
    document.querySelectorAll('[data-nav-toggle]').forEach((b) => b.setAttribute('aria-expanded', String(open)));
    if (open && !was) {
      // In the next frame, only if the drawer is still open: a quick Escape must not leave the focus in a closed drawer.
      requestAnimationFrame(() => { if (!navOpen()) return; const cur = s.querySelector('.step.on') || s.querySelector('.step'); if (cur) cur.focus(); });
    } else if (!open && was && focusBack) {
      const t = document.querySelector('[data-nav-toggle]');
      if (t) t.focus();
    }
  }

  function paint() {
    const nav = navMode();
    app.dataset.layout = state.mode;
    app.dataset.nav = nav;
    if (nav !== 'drawer' && navOpen()) setNav(false);
    const w = width();
    app.style.setProperty('--ctx', `${w}px`);
    const r = document.getElementById('ctx-resizer');
    if (r) {
      const b = bounds();
      r.setAttribute('aria-valuemin', String(b.min));
      r.setAttribute('aria-valuemax', String(b.max));
      r.setAttribute('aria-valuenow', String(w));
      r.setAttribute('aria-valuetext', `${w} px`);
    }
    document.querySelectorAll('[data-layout-mode]').forEach((b) => {
      const on = b.dataset.layoutMode === state.mode;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
    });
  }
  // A change of mode on a wide screen: the panel slides in from the right when it is shown, the form only fades in place
  // (app.css, "ctx-enter" and "soft"); nothing moves with reduced motion.
  function replay(el, cls) {
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }
  function motion(was, mode) {
    if (was === mode || !wide()) return;
    if (mode !== 'compile') replay(document.getElementById('ctx'), 'ctx-enter');
    const body = document.getElementById('tab-body');
    if (body) { body.dataset.enter = 'soft'; replay(body, 'entering'); }
  }
  function setMode(mode) {
    if (!MODES.includes(mode)) return;
    const was = state.mode;
    state.mode = mode;
    save();
    paint();
    motion(was, mode);
    requestAnimationFrame(refit);
  }
  function setWidth(w) {
    state[slot()] = w == null ? null : clamp(w);
    save();
    paint();
    refit();
  }
  // Menu View → "Reset the layout": Form + document, widths chosen by the app.
  function reset() {
    const was = state.mode;
    state.mode = 'split';
    state.split = null;
    state.review = null;
    save();
    setNav(false);
    paint();
    motion(was, 'split');
    requestAnimationFrame(refit);
  }

  // Texts in the language of the interface, from the same dictionaries as the rest of the app.
  function label() {
    const I = window.UI_I18N;
    if (!I) return;
    const dict = I[root.lang] || I.en || {};
    const tx = (k) => dict[k] || (I.en && I.en[k]) || k;
    const group = document.getElementById('layout-seg');
    if (group) group.setAttribute('aria-label', tx('layoutMode'));
    document.querySelectorAll('[data-layout-mode]').forEach((b) => {
      const name = tx(LABELS[b.dataset.layoutMode]);
      b.dataset.tip = name;
      b.removeAttribute('title');
      const s = b.querySelector('.lbl');
      if (s) s.textContent = name;
    });
    const r = document.getElementById('ctx-resizer');
    if (r) r.setAttribute('aria-label', tx('layoutResize'));
  }

  function bindModes() {
    const group = document.getElementById('layout-seg');
    if (!group) return;
    group.addEventListener('click', (e) => {
      const b = e.target.closest('[data-layout-mode]');
      if (b) setMode(b.dataset.layoutMode);
    });
    // Radio group: the arrow keys move the choice (WAI-ARIA pattern).
    group.addEventListener('keydown', (e) => {
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!step) return;
      e.preventDefault();
      const next = MODES[(MODES.indexOf(state.mode) + step + MODES.length) % MODES.length];
      setMode(next);
      const b = group.querySelector(`[data-layout-mode="${next}"]`);
      if (b) b.focus();
    });
  }

  // Window splitter (WAI-ARIA): drag, arrows (Shift for larger steps), Home/End for the limits, Enter or double click to reset.
  function bindResizer() {
    const r = document.getElementById('ctx-resizer');
    if (!r) return;
    let frame = 0;
    r.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || !wide()) return;
      e.preventDefault();
      r.setPointerCapture(e.pointerId);
      r.classList.add('dragging');
      document.body.classList.add('resizing');
      const move = (ev) => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => { state[slot()] = clamp(window.innerWidth - ev.clientX - DIVIDER / 2); paint(); });
      };
      const up = () => {
        cancelAnimationFrame(frame);
        if (r.hasPointerCapture(e.pointerId)) r.releasePointerCapture(e.pointerId);
        r.classList.remove('dragging');
        document.body.classList.remove('resizing');
        r.removeEventListener('pointermove', move);
        r.removeEventListener('pointerup', up);
        r.removeEventListener('pointercancel', up);
        save();
        refit();
      };
      r.addEventListener('pointermove', move);
      r.addEventListener('pointerup', up);
      r.addEventListener('pointercancel', up);
    });
    r.addEventListener('dblclick', () => setWidth(null));
    r.addEventListener('keydown', (e) => {
      const cur = width();
      const big = e.shiftKey ? 4 : 1;
      if (e.key === 'Enter') { e.preventDefault(); setWidth(null); return; }
      const next = { ArrowLeft: cur + STEP * big, ArrowRight: cur - STEP * big, Home: bounds().max, End: bounds().min }[e.key];
      if (next == null) return;
      e.preventDefault();
      setWidth(next);
    });
  }

  function bindPanel() {
    const ctx = document.getElementById('ctx');
    // On wide screens the close button of the panel switches to Form; on narrow screens the editor closes the drawer.
    const close = document.getElementById('ctx-close');
    if (close) {
      close.addEventListener('click', (e) => {
        if (!wide()) return;
        e.stopPropagation();
        setMode('compile');
        const back = document.querySelector('[data-layout-mode="split"]');
        if (back) back.focus();
      }, true);
    }
    if (ctx) ctx.addEventListener('animationend', (e) => { if (e.target === ctx) ctx.classList.remove('ctx-enter'); });
    // Whatever asks for the panel (AI, checks, an issue, the command bar) shows it when it is hidden.
    if (ctx && typeof MutationObserver === 'function') {
      new MutationObserver(() => { if (wide() && state.mode === 'compile' && ctx.classList.contains('open')) setMode('split'); })
        .observe(ctx, { attributes: true, attributeFilter: ['class'] });
    }
    document.addEventListener('click', (e) => {
      const b = e.target.closest('[data-ctx]');
      if (!b || b.closest('#ctx')) return;
      if (wide()) { if (state.mode === 'compile') setMode('split'); } else if (ctx) ctx.classList.add('open');
    }, true);
    window.addEventListener('resize', () => { if (!selfResize) paint(); });
  }

  // Steps drawer: the button in the strip opens it; a choice, a click outside or Escape closes it.
  function bindNav() {
    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-action="layout-reset"]')) { reset(); return; }
      const t = e.target.closest('[data-nav-toggle]');
      if (t) { e.preventDefault(); setNav(!navOpen()); return; }
      if (!navOpen()) return;
      const s = side();
      if (s && s.contains(e.target)) {
        if (!e.target.closest('button, a')) return;
        const toStep = !!e.target.closest('[data-step]');
        setNav(false);
        // Once the editor has drawn the chosen step, the focus goes to its title.
        if (toStep) {
          setTimeout(() => {
            const h = document.querySelector('.v-head h1');
            if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); }
          }, 0);
        }
        return;
      }
      setNav(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && navOpen()) { e.stopPropagation(); setNav(false, true); }
    }, true);
  }

  // The grid gets its final columns before the first frame.
  paint();
  function init() {
    bindModes();
    bindResizer();
    bindPanel();
    bindNav();
    if (typeof MutationObserver === 'function') new MutationObserver(label).observe(root, { attributes: true, attributeFilter: ['lang'] });
    label();
    paint();
  }
  window.ValestaLayout = { reset, setMode };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
