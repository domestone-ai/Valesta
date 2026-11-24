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
/* MapView — interactive map of the editor: raster tiles as images (no cross-origin access needed), pan with mouse or
 * finger, zoom with wheel, pinch, double click, keys and buttons, draggable markers and click-to-place. Projection and
 * tile addresses come from Maps. Browser only. */
(function (root, factory) {
  const mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else root.MapView = mod;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const TILE = 256;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const MapsLib = () => (typeof Maps !== 'undefined' ? Maps : null);

  // opts: { center: [lat, lon], zoom, provider, markers: [{ id, lat, lon, kind: 'subject'|'poi'|'comp', label, title, draggable }],
  //         labels: { zoomIn, zoomOut, recenter, locate, place, cancel }, note, onMarkerMove(id, lat, lon), onView(lat, lon, zoom), onLocate() }
  function mount(el, opts) {
    const Mp = MapsLib();
    const L = Object.assign({ zoomIn: '+', zoomOut: '−', recenter: 'Centre', locate: 'My position', cancel: 'Cancel' }, opts.labels || {});
    let provider = opts.provider || Mp.NONE;
    const clampZ = (v) => Math.max(provider.minZoom || 3, Math.min(provider.maxZoom || 19, Math.round(v)));
    let z = clampZ(opts.zoom || 16);
    let c = Mp.project(z, opts.center[0], opts.center[1]);
    let markers = [];
    let picking = null;
    let raf = 0;
    const tiles = new Map();

    el.classList.add('mv');
    el.tabIndex = 0;
    el.setAttribute('role', 'application');
    el.setAttribute('aria-label', opts.ariaLabel || 'Map');
    el.innerHTML = `<div class="mv-back"></div><div class="mv-tiles"></div><div class="mv-marks"></div>
      <div class="mv-ctl"><button type="button" data-mv="in" title="${esc(L.zoomIn)}" aria-label="${esc(L.zoomIn)}">+</button><button type="button" data-mv="out" title="${esc(L.zoomOut)}" aria-label="${esc(L.zoomOut)}">−</button>
      <button type="button" data-mv="center" title="${esc(L.recenter)}" aria-label="${esc(L.recenter)}"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="12" cy="12" r="3.2" fill="currentColor"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="1.6"/></svg></button>
      ${opts.onLocate ? `<button type="button" data-mv="locate" title="${esc(L.locate)}" aria-label="${esc(L.locate)}"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M3 11l18-8-8 18-2-8z" fill="currentColor"/></svg></button>` : ''}</div>
      <div class="mv-note" hidden></div><div class="mv-pick" hidden><span></span><button type="button" data-mv="cancel">${esc(L.cancel)}</button></div><div class="mv-attr"></div>`;
    const back = el.querySelector('.mv-back');
    const front = el.querySelector('.mv-tiles');
    const marks = el.querySelector('.mv-marks');
    const attr = el.querySelector('.mv-attr');
    const noteEl = el.querySelector('.mv-note');
    const pickEl = el.querySelector('.mv-pick');

    const size = () => [el.clientWidth || 600, el.clientHeight || 360];
    const topLeft = () => { const s = size(); return [c[0] - s[0] / 2, c[1] - s[1] / 2]; };
    const toLatLon = (sx, sy) => { const tl = topLeft(); return Mp.unproject(z, tl[0] + sx, tl[1] + sy); };
    const view = () => { const s = size(); const ll = Mp.unproject(z, c[0], c[1]); return { lat: ll.lat, lon: ll.lon, zoom: z, w: s[0], h: s[1] }; };
    const emitView = () => { if (opts.onView) { const v = view(); opts.onView(v.lat, v.lon, v.zoom); } };

    function drawTiles() {
      const s = size();
      const tl = topLeft();
      // beyond its last zoom level a provider's tiles are enlarged (maxNative)
      const nz = Math.min(z, provider.maxNative || z);
      const k = Math.pow(2, z - nz);
      const T = TILE * k;
      const n = Math.pow(2, nz);
      const want = new Set();
      const tx0 = Math.floor(tl[0] / T), tx1 = Math.floor((tl[0] + s[0]) / T), ty0 = Math.floor(tl[1] / T), ty1 = Math.floor((tl[1] + s[1]) / T);
      const sane = Number.isFinite(tx0) && Number.isFinite(ty0) && tx1 - tx0 <= 64 && ty1 - ty0 <= 64;
      if (provider.tile && sane) {
        for (let ty = ty0; ty <= ty1; ty++) {
          if (ty < 0 || ty >= n) continue;
          for (let tx = tx0; tx <= tx1; tx++) {
            const wx = ((tx % n) + n) % n;
            const key = `${provider.id}/${z}/${nz}/${tx}/${ty}`;
            want.add(key);
            let img = tiles.get(key);
            if (!img) {
              img = new Image();
              img.alt = '';
              img.draggable = false;
              img.decoding = 'async';
              img.className = 'mv-tile';
              img.onerror = () => { img.style.visibility = 'hidden'; };
              img.src = provider.tile(nz, wx, ty);
              if (k > 1) { img.style.width = T + 'px'; img.style.height = T + 'px'; }
              tiles.set(key, img);
              front.appendChild(img);
            }
            img.style.transform = `translate(${Math.round(tx * T - tl[0])}px,${Math.round(ty * T - tl[1])}px)`;
          }
        }
      }
      tiles.forEach((img, key) => { if (!want.has(key)) { img.remove(); tiles.delete(key); } });
      el.classList.toggle('mv--plain', !provider.tile);
      if (provider.links) attr.innerHTML = provider.links.map((l) => `<a href="${esc(l[1])}" target="_blank" rel="noopener">${esc(l[0])}</a>`).join(' · ');
      else attr.textContent = provider.attribution || '';
      attr.hidden = !provider.attribution;
      const UIT = typeof self !== 'undefined' && self.UI_I18N && self.UI_I18N.text;
      const note = provider.note && provider.noteBelow && z < provider.noteBelow ? (UIT ? self.UI_I18N.text(provider.note, opts.lang) : provider.note[opts.lang] || provider.note.en) : '';
      noteEl.textContent = note;
      noteEl.hidden = !note;
    }
    function placeMarkers() {
      const tl = topLeft();
      markers.forEach((m) => {
        if (!m.el) return;
        const ok = isFinite(m.lat) && isFinite(m.lon);
        m.el.hidden = !ok;
        if (!ok) return;
        const p = Mp.project(z, m.lat, m.lon);
        m.el.style.transform = `translate(${(p[0] - tl[0]).toFixed(1)}px,${(p[1] - tl[1]).toFixed(1)}px)`;
      });
    }
    function draw() { raf = 0; drawTiles(); placeMarkers(); }
    const schedule = () => { if (!raf) raf = requestAnimationFrame(draw); };

    function setMarkers(list) {
      marks.innerHTML = '';
      markers = (list || []).map((m) => {
        const d = document.createElement('div');
        d.className = `mv-mk mv-mk--${m.kind || 'poi'}${m.draggable ? ' drag' : ''}`;
        d.innerHTML = m.kind === 'subject'
          ? `<svg viewBox="0 0 30 40" width="30" height="40" aria-hidden="true"><path d="M15 39C15 39 2 23.5 2 14.5a13 13 0 0 1 26 0C28 23.5 15 39 15 39z" fill="currentColor" stroke="#fff" stroke-width="2"/><circle cx="15" cy="14.5" r="5" fill="#fff"/></svg>`
          : `<span>${esc(m.label || '')}</span>`;
        if (m.title) d.title = m.title;
        marks.appendChild(d);
        return Object.assign({}, m, { el: d });
      });
      placeMarkers();
    }
    function zoomAround(nz, sx, sy) {
      nz = clampZ(nz);
      if (nz === z) return;
      const s = size();
      const tl = topLeft();
      const k = Math.pow(2, nz - z);
      // keep the old tiles, scaled, until the new ones are loaded
      back.innerHTML = '';
      tiles.forEach((img) => back.appendChild(img));
      tiles.clear();
      back.style.transformOrigin = `${sx}px ${sy}px`;
      back.style.transform = `scale(${k})`;
      clearTimeout(back._t);
      back._t = setTimeout(() => { back.innerHTML = ''; back.style.transform = ''; }, 700);
      c = [(tl[0] + sx) * k - (sx - s[0] / 2), (tl[1] + sy) * k - (sy - s[1] / 2)];
      z = nz;
      draw();
      emitView();
    }

    // ---------- interaction ----------
    const pointers = new Map();
    let drag = null;
    let wheelAcc = 0;
    let wheelAt = 0;
    const local = (e) => { const r = el.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const two = () => { const p = Array.from(pointers.values()); return { d: Math.hypot(p[0][0] - p[1][0], p[0][1] - p[1][1]), m: [(p[0][0] + p[1][0]) / 2, (p[0][1] + p[1][1]) / 2] }; };

    el.addEventListener('pointerdown', (e) => {
      if (e.button > 0 || e.target.closest('.mv-ctl, .mv-pick, .mv-attr')) return;
      el.focus({ preventScroll: true });
      pointers.set(e.pointerId, local(e));
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      if (pointers.size === 2) {
        const g = two();
        drag = { kind: 'pinch', d0: g.d, m0: g.m, c0: c.slice(), k: 1 };
        return;
      }
      const mk = e.target.closest('.mv-mk.drag');
      const m = mk && markers.find((x) => x.el === mk);
      drag = m ? { kind: 'marker', m, moved: false } : { kind: 'pan', s0: local(e), c0: c.slice(), moved: false };
      if (m) mk.classList.add('dragging');
      else el.classList.add('grabbing');
    });
    el.addEventListener('pointermove', (e) => {
      if (!pointers.has(e.pointerId) || !drag) return;
      const p = local(e);
      pointers.set(e.pointerId, p);
      if (drag.kind === 'pan') {
        const dx = p[0] - drag.s0[0], dy = p[1] - drag.s0[1];
        if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
        c = [drag.c0[0] - dx, drag.c0[1] - dy];
        schedule();
      } else if (drag.kind === 'marker') {
        drag.moved = true;
        const ll = toLatLon(p[0], p[1]);
        drag.m.lat = ll.lat;
        drag.m.lon = ll.lon;
        placeMarkers();
      } else if (drag.kind === 'pinch' && pointers.size === 2) {
        const g = two();
        drag.k = g.d / (drag.d0 || 1);
        c = [drag.c0[0] - (g.m[0] - drag.m0[0]), drag.c0[1] - (g.m[1] - drag.m0[1])];
        draw();
        front.style.transformOrigin = marks.style.transformOrigin = `${g.m[0]}px ${g.m[1]}px`;
        front.style.transform = marks.style.transform = `scale(${drag.k})`;
        drag.m = g.m;
      }
    });
    const end = (e) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.delete(e.pointerId);
      el.classList.remove('grabbing');
      if (!drag) return;
      if (drag.kind === 'pinch') {
        if (pointers.size < 2) {
          front.style.transform = marks.style.transform = '';
          const dz = Math.round(Math.log2(drag.k || 1));
          const mid = drag.m || drag.m0;
          drag = null;
          if (dz) zoomAround(z + dz, mid[0], mid[1]); else emitView();
        }
        return;
      }
      if (drag.kind === 'marker') {
        drag.m.el.classList.remove('dragging');
        if (drag.moved && opts.onMarkerMove) opts.onMarkerMove(drag.m.id, drag.m.lat, drag.m.lon);
      } else if (drag.kind === 'pan') {
        if (!drag.moved && picking && e.type === 'pointerup') {
          const p = local(e);
          const ll = toLatLon(p[0], p[1]);
          const cb = picking.onPick;
          setPicking(null);
          cb(ll.lat, ll.lon);
        } else if (drag.moved) emitView();
      }
      drag = null;
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      const now = Date.now();
      wheelAcc += e.deltaY;
      if (Math.abs(wheelAcc) < 40 || now - wheelAt < 220) return;
      const p = local(e);
      zoomAround(z + (wheelAcc < 0 ? 1 : -1), p[0], p[1]);
      wheelAcc = 0;
      wheelAt = now;
    }, { passive: false });
    el.addEventListener('dblclick', (e) => {
      if (e.target.closest('.mv-ctl, .mv-pick')) return;
      const p = local(e);
      zoomAround(z + (e.shiftKey ? -1 : 1), p[0], p[1]);
    });
    el.addEventListener('keydown', (e) => {
      const s = size();
      const step = 80;
      const k = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      if (k) { e.preventDefault(); c = [c[0] + k[0], c[1] + k[1]]; schedule(); emitView(); return; }
      if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomAround(z + 1, s[0] / 2, s[1] / 2); }
      if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomAround(z - 1, s[0] / 2, s[1] / 2); }
      if (e.key === 'Escape' && picking) setPicking(null);
    });
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-mv]');
      if (!b) return;
      const s = size();
      const a = b.dataset.mv;
      if (a === 'in') zoomAround(z + 1, s[0] / 2, s[1] / 2);
      else if (a === 'out') zoomAround(z - 1, s[0] / 2, s[1] / 2);
      else if (a === 'center') { const m = markers.find((x) => x.kind === 'subject' && isFinite(x.lat)); if (m) setView(m.lat, m.lon, Math.max(z, 17)); }
      else if (a === 'locate' && opts.onLocate) opts.onLocate();
      else if (a === 'cancel') setPicking(null);
    });
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => schedule()) : null;
    if (ro) ro.observe(el);

    function setView(lat, lon, zoom) {
      if (!isFinite(lat) || !isFinite(lon)) return;
      if (zoom != null) z = clampZ(zoom);
      c = Mp.project(z, lat, lon);
      draw();
      emitView();
    }
    function setProvider(p) {
      provider = p || Mp.NONE;
      tiles.forEach((img) => img.remove());
      tiles.clear();
      z = clampZ(z);
      draw();
    }
    function setPicking(label, onPick) {
      picking = label ? { onPick } : null;
      el.classList.toggle('picking', !!picking);
      pickEl.hidden = !picking;
      pickEl.querySelector('span').textContent = label || '';
    }
    function destroy() { if (ro) ro.disconnect(); el.innerHTML = ''; el.classList.remove('mv', 'picking', 'mv--plain'); }

    setMarkers(opts.markers);
    draw();
    return { setView, setMarkers, setProvider, setPicking, view, destroy, redraw: draw };
  }

  return { mount };
});
