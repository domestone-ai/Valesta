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
/* Theme of the interface: light, dark or automatic (follows the system). The choice is kept on the device
   ("valesta-theme"); the page applies it before drawing (index.template.html). This file adds the switch in the menu
   ("View"). The change is immediate; the browser bar keeps the brand colour. The report pages stay white. */
(function () {
  'use strict';
  const KEY = 'valesta-theme';
  const CHOICES = ['light', 'dark', 'auto'];
  const LABELS = { light: 'themeLight', dark: 'themeDark', auto: 'themeAuto' };
  const root = document.documentElement;
  const mq = (q) => (typeof window.matchMedia === 'function' ? window.matchMedia(q) : null);
  const media = mq('(prefers-color-scheme: dark)');

  let choice = 'auto';
  try {
    const saved = window.localStorage.getItem(KEY);
    if (CHOICES.includes(saved)) choice = saved;
  } catch (e) { /* storage not available: automatic */ }

  const mode = () => (choice === 'dark' || (choice === 'auto' && media && media.matches) ? 'dark' : 'light');

  function paint() {
    const m = mode();
    root.setAttribute('data-theme', m);
    document.querySelectorAll('[data-theme-choice]').forEach((b) => {
      const on = b.dataset.themeChoice === choice;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
    });
  }

  function choose(next) {
    if (!CHOICES.includes(next)) return;
    choice = next;
    try { window.localStorage.setItem(KEY, choice); } catch (e) { /* the choice lasts for this visit */ }
    paint();
  }

  // Texts in the language of the interface, from the same dictionaries as the rest of the menu.
  function label() {
    const I = window.UI_I18N;
    if (!I) return;
    const dict = I[root.lang] || I.en || {};
    const tx = (k) => dict[k] || (I.en && I.en[k]) || k;
    const title = document.getElementById('menu-title-view');
    if (title) title.textContent = tx('menuView');
    const group = document.getElementById('theme-seg');
    if (group) group.setAttribute('aria-label', tx('theme'));
    document.querySelectorAll('[data-theme-choice]').forEach((b) => {
      const span = b.querySelector('.lbl');
      if (span) span.textContent = tx(LABELS[b.dataset.themeChoice]);
    });
  }

  function init() {
    const group = document.getElementById('theme-seg');
    if (group) {
      group.addEventListener('click', (e) => {
        const b = e.target.closest('[data-theme-choice]');
        if (b) choose(b.dataset.themeChoice);
      });
      // Radio group: the arrow keys move the choice (WAI-ARIA pattern).
      group.addEventListener('keydown', (e) => {
        const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
        if (!step) return;
        e.preventDefault();
        const next = CHOICES[(CHOICES.indexOf(choice) + step + CHOICES.length) % CHOICES.length];
        choose(next);
        const btn = group.querySelector(`[data-theme-choice="${next}"]`);
        if (btn) btn.focus();
      });
    }
    if (media) {
      const follow = () => { if (choice === 'auto') paint(); };
      if (typeof media.addEventListener === 'function') media.addEventListener('change', follow);
      else if (typeof media.addListener === 'function') media.addListener(follow);
    }
    // The editor sets <html lang> when the language of the interface changes: the switch follows it.
    if (typeof MutationObserver === 'function') new MutationObserver(label).observe(root, { attributes: true, attributeFilter: ['lang'] });
    label();
    paint();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
