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
/* Motion that needs measuring: the thumb of a segmented control and the ink of a tab bar slide to the chosen button
   ([data-slide="thumb"] or [data-slide="ink"]; the chosen button has the class "on"). One indicator per group, moved with
   transform; it follows class changes, sizes and fonts. It never slides when it first appears (page opening, a menu
   being opened): transitions are on only while it is already in place. Without this file the chosen button keeps its own
   background or underline (app.css). Reduced motion: app.css removes the transition, the indicator jumps. */
(function () {
  'use strict';

  function place(group) {
    const ind = group.querySelector(':scope > .m-ind');
    if (!ind) return;
    const on = group.querySelector(':scope > button.on');
    if (!on || !on.offsetWidth) { ind.style.opacity = '0'; return; }
    const appearing = ind.style.opacity === '0';
    if (appearing) group.classList.remove('m-ready');
    group.style.setProperty('--m-x', `${on.offsetLeft}px`);
    group.style.setProperty('--m-w', `${on.offsetWidth}px`);
    ind.style.opacity = '';
    if (appearing) {
      void group.offsetWidth; // the new place is taken at once, then the transitions come back
      group.classList.add('m-ready');
    }
  }

  function init(group) {
    if (group.querySelector(':scope > .m-ind')) return;
    const ind = document.createElement('i');
    ind.className = 'm-ind';
    ind.setAttribute('aria-hidden', 'true');
    ind.style.opacity = '0';
    group.insertBefore(ind, group.firstChild);
    group.classList.add('m-on');
    place(group);
    if (typeof MutationObserver === 'function') {
      new MutationObserver(() => place(group)).observe(group, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
    }
    if (typeof ResizeObserver === 'function') new ResizeObserver(() => place(group)).observe(group);
  }

  function start() {
    const groups = Array.from(document.querySelectorAll('[data-slide]'));
    groups.forEach(init);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => groups.forEach(place));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
