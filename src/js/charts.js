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
/* Charts — static (printable) SVG charts for the report.
 * Validated palette (dataviz validate_palette): data #2B6C9C, accent #1A8A47.
 */
(function (root, factory) {
  const mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else root.Charts = mod;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const C = {
    data: '#2B6C9C', dataLight: '#A9C2D6', accent: '#1A8A47', accentWash: 'rgba(26,138,71,0.10)',
    muted: '#B9C3CB', grid: '#E4E9ED', axis: '#CBD3DA', text: '#1A2229', text2: '#4A5661', text3: '#7A8792',
    surface: '#FFFFFF', brand: '#365C76', brandDeep: '#1D3443',
  };

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // Number formatting follows the active locale (es/it: 4.572,5 · en: 4,572.5). Report sets it to the report language.
  // The other report languages use the shared I18N formatter (Intl), so charts and text agree.
  const G = typeof self !== 'undefined' ? self : typeof global !== 'undefined' ? global : {};
  const I18 = () => G.I18N || (typeof require === 'function' ? (G.I18N = require('./i18n.js')) : null);
  const OWN = ['es', 'it', 'en'];
  const BEFORE = ['en', 'nl', 'zh']; // currency symbol before the amount, as in I18N.money
  let LOCALE = 'es';
  const setLocale = (l) => { LOCALE = OWN.includes(l) || (I18() && I18().LANGS.includes(l)) ? l : 'es'; };
  const getLocale = () => LOCALE;
  const fmt = (v, d = 0) => {
    if (v == null || !isFinite(v)) return '—';
    if (!OWN.includes(LOCALE) && I18()) return I18().fmt(v, d, LOCALE);
    const th = LOCALE === 'en' ? ',' : '.';
    const dec = LOCALE === 'en' ? '.' : ',';
    const neg = v < 0;
    const parts = Math.abs(v).toFixed(d).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, th);
    return (neg ? '−' : '') + parts.join(dec);
  };
  let CURSYM = '€';
  const setCurrency = (s) => { CURSYM = s || '€'; };
  const money = (v) => (v == null || !isFinite(v) ? '—' : BEFORE.includes(LOCALE) ? (CURSYM.length > 1 ? CURSYM + ' ' : CURSYM) + fmt(v) : fmt(v) + ' ' + CURSYM);
  const niceStep = (span, target) => {
    const raw = span / Math.max(1, target);
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const m = raw / p;
    return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
  };
  let uid = 0;
  const nextId = (p) => `${p}${++uid}`;

  // Horizontal bars with a reference value line and an optional band (e.g. confidence interval)
  function hbars(o) {
    const W = o.width || 640;
    const rowH = o.rowH || 26;
    const labelW = o.labelW || 150;
    const valueW = 64;
    const top = o.top != null ? o.top : 28;
    const bottom = 26;
    const H = top + o.items.length * rowH + bottom;
    const x0 = labelW;
    const x1 = W - valueW;
    const vals = o.items.map((d) => d.value).concat(o.ref ? [o.ref.value] : [], o.band ? [o.band.lo, o.band.hi] : []);
    let lo = o.min != null ? o.min : Math.min.apply(null, vals);
    let hi = o.max != null ? o.max : Math.max.apply(null, vals);
    const step = niceStep(hi - lo || 1, 4);
    lo = o.min != null ? o.min : Math.floor((lo - step * 0.2) / step) * step;
    hi = o.max != null ? o.max : Math.ceil((hi + step * 0.2) / step) * step;
    const sx = (v) => x0 + ((v - lo) / (hi - lo)) * (x1 - x0);
    let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(o.title || '')}">`;
    for (let t = Math.ceil(lo / step) * step; t <= hi + 1e-9; t += step) {
      s += `<line x1="${sx(t)}" x2="${sx(t)}" y1="${top - 6}" y2="${H - bottom + 4}" stroke="${C.grid}" stroke-width="1"/>`;
      s += `<text x="${sx(t)}" y="${H - bottom + 18}" text-anchor="middle" font-size="10" fill="${C.text3}" class="tnum">${fmt(t)}</text>`;
    }
    if (o.band) {
      s += `<rect x="${sx(o.band.lo)}" y="${top - 6}" width="${Math.max(1, sx(o.band.hi) - sx(o.band.lo))}" height="${H - bottom - top + 10}" fill="${C.accentWash}"/>`;
    }
    if (o.ref) {
      const x = sx(o.ref.value);
      s += `<line x1="${x}" x2="${x}" y1="${top - 10}" y2="${H - bottom + 4}" stroke="${C.accent}" stroke-width="2"/>`;
      s += `<text x="${x}" y="${top - 14}" text-anchor="middle" font-size="10.5" font-weight="700" fill="${C.text}">${esc(o.ref.label)}</text>`;
    }
    const bar = Math.min(16, rowH - 10);
    const halo = `stroke="${C.surface}" stroke-width="3.5" stroke-linejoin="round" paint-order="stroke"`;
    o.items.forEach((d, i) => {
      const y = top + i * rowH + (rowH - bar) / 2;
      const cy = y + bar / 2;
      const base = sx(lo);
      const end = sx(d.value);
      const wbar = Math.max(2, end - base);
      const col = d.muted ? C.muted : d.color || C.data;
      s += `<g><title>${esc(d.label)}: ${fmt(d.value)} ${esc(o.unit || '')}</title>`;
      s += `<text x="${x0 - 10}" y="${cy + 1}" text-anchor="end" dominant-baseline="middle" font-size="11" fill="${C.text}" font-weight="600">${esc(d.label)}</text>`;
      if (d.sub) s += `<text x="${x0 - 10}" y="${cy + 12}" text-anchor="end" dominant-baseline="middle" font-size="8.5" fill="${C.text3}">${esc(d.sub)}</text>`;
      if (o.mode === 'dot') {
        s += `<line x1="${x0}" x2="${x1}" y1="${cy}" y2="${cy}" stroke="${C.grid}" stroke-width="1"/>`;
        s += `<circle cx="${end}" cy="${cy}" r="6" fill="${col}" stroke="${C.surface}" stroke-width="2"/>`;
        s += `<circle cx="${end}" cy="${cy}" r="12" fill="transparent"/>`;
        s += `<text x="${end + 11}" y="${cy + 1}" dominant-baseline="middle" font-size="10.5" fill="${C.text2}" class="tnum" ${halo}>${fmt(d.value)}</text></g>`;
      } else {
        s += `<path d="M${base},${y} H${base + wbar - 4} Q${base + wbar},${y} ${base + wbar},${y + 4} V${y + bar - 4} Q${base + wbar},${y + bar} ${base + wbar - 4},${y + bar} H${base} Z" fill="${col}"/>`;
        s += `<text x="${end + 6}" y="${cy + 1}" dominant-baseline="middle" font-size="10.5" fill="${C.text2}" class="tnum" ${halo}>${fmt(d.value)}</text></g>`;
      }
    });
    return s + '</svg>';
  }

  // Squarified treemap (one whole split by area). Colours: validated categorical order SEG by item.group.
  function treemap(o) {
    const W = o.width || 640;
    const H = o.height || 260;
    const nodes = o.items.filter((d) => d.value > 0).slice().sort((a, b) => b.value - a.value);
    const total = nodes.reduce((s, d) => s + d.value, 0) || 1;
    const k = (W * H) / total;
    nodes.forEach((d) => { d.area = d.value * k; });
    const rects = [];
    let x = 0, y = 0, w = W, h = H;
    const worst = (row, side) => {
      const sum = row.reduce((a, d) => a + d.area, 0);
      const mx = Math.max.apply(null, row.map((d) => d.area));
      const mn = Math.min.apply(null, row.map((d) => d.area));
      return Math.max((side * side * mx) / (sum * sum), (sum * sum) / (side * side * mn));
    };
    const place = (row) => {
      const sum = row.reduce((a, d) => a + d.area, 0);
      if (w >= h) {
        const cw = sum / h; let cy = y;
        row.forEach((d) => { const ch = d.area / cw; rects.push({ d, x, y: cy, w: cw, h: ch }); cy += ch; });
        x += cw; w -= cw;
      } else {
        const rh = sum / w; let cx = x;
        row.forEach((d) => { const cw = d.area / rh; rects.push({ d, x: cx, y, w: cw, h: rh }); cx += cw; });
        y += rh; h -= rh;
      }
    };
    let row = [];
    let i = 0;
    while (i < nodes.length) {
      const side = Math.min(w, h);
      if (!row.length || worst(row.concat([nodes[i]]), side) <= worst(row, side)) { row.push(nodes[i]); i++; }
      else { place(row); row = []; }
    }
    if (row.length) place(row);
    let s = `<svg class="chart treemap" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(o.title || '')}">`;
    rects.forEach((r) => {
      const g = 1; // half of the 2px surface gap
      const col = SEG[(r.d.group || 0) % SEG.length];
      const ink = inkFor(col);
      const rx = (r.x + g).toFixed(1), ry = (r.y + g).toFixed(1), rw = Math.max(0, r.w - 2 * g).toFixed(1), rh = Math.max(0, r.h - 2 * g).toFixed(1);
      s += `<g><title>${esc(r.d.label)}: ${fmt(r.d.value, 2)} m²</title><rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" rx="4" fill="${col}"/>`;
      const fits2 = r.w >= Math.max(r.d.label.length * 6.4, 52) + 14 && r.h >= 40;
      const fits1 = r.w >= Math.max(r.d.label.length * 6.4, 40) + 12 && r.h >= 22;
      if (fits2) {
        s += `<text x="${r.x + 9}" y="${r.y + 18}" font-size="11" font-weight="700" fill="${ink}">${esc(r.d.label)}</text>`;
        s += `<text x="${r.x + 9}" y="${r.y + 33}" font-size="10" fill="${ink}" opacity="0.9" class="tnum">${fmt(r.d.value, 2)} m²</text>`;
      } else if (fits1) {
        s += `<text x="${r.x + 7}" y="${r.y + r.h / 2 + 1}" dominant-baseline="middle" font-size="9.5" font-weight="700" fill="${ink}">${esc(r.d.label)}</text>`;
      }
      s += '</g>';
    });
    return s + '</svg>';
  }

  // Single-series line with area wash and end label
  function line(o) {
    const W = o.width || 640;
    const H = o.height || 220;
    const m = { l: 46, r: 64, t: 16, b: 28 };
    const vals = o.points.map((p) => p.v);
    let lo = Math.min.apply(null, vals);
    let hi = Math.max.apply(null, vals);
    const step = niceStep(hi - lo || 1, 4);
    lo = Math.floor(lo / step) * step;
    hi = Math.ceil(hi / step) * step;
    const sx = (i) => m.l + (i / Math.max(1, o.points.length - 1)) * (W - m.l - m.r);
    const sy = (v) => m.t + (1 - (v - lo) / (hi - lo)) * (H - m.t - m.b);
    let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(o.title || '')}">`;
    for (let t = lo; t <= hi + 1e-9; t += step) {
      s += `<line x1="${m.l}" x2="${W - m.r}" y1="${sy(t)}" y2="${sy(t)}" stroke="${C.grid}" stroke-width="1"/>`;
      s += `<text x="${m.l - 8}" y="${sy(t)}" text-anchor="end" dominant-baseline="middle" font-size="10" fill="${C.text3}" class="tnum">${fmt(t)}</text>`;
    }
    o.points.forEach((p, i) => {
      if (o.labelEvery && i % o.labelEvery !== 0 && i !== o.points.length - 1) return;
      s += `<text x="${sx(i)}" y="${H - 8}" text-anchor="middle" font-size="9.5" fill="${C.text3}">${esc(p.label)}</text>`;
    });
    const path = o.points.map((p, i) => `${i ? 'L' : 'M'}${sx(i).toFixed(1)},${sy(p.v).toFixed(1)}`).join(' ');
    s += `<path d="${path} L${sx(o.points.length - 1)},${sy(lo)} L${sx(0)},${sy(lo)} Z" fill="${C.data}" opacity="0.10"/>`;
    s += `<path d="${path}" fill="none" stroke="${C.data}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    o.points.forEach((p, i) => {
      s += `<circle cx="${sx(i)}" cy="${sy(p.v)}" r="10" fill="transparent"><title>${esc(p.label)}: ${fmt(p.v)} ${esc(o.unit || '')}</title></circle>`;
    });
    const last = o.points[o.points.length - 1];
    const lx = sx(o.points.length - 1);
    const ly = sy(last.v);
    s += `<circle cx="${lx}" cy="${ly}" r="4.5" fill="${C.data}" stroke="${C.surface}" stroke-width="2"/>`;
    s += `<text x="${lx + 9}" y="${ly - 2}" dominant-baseline="middle" font-size="11" font-weight="700" fill="${C.text}" class="tnum">${fmt(last.v)}</text>`;
    if (o.unit) s += `<text x="${lx + 9}" y="${ly + 11}" dominant-baseline="middle" font-size="8.5" fill="${C.text3}">${esc(o.unit)}</text>`;
    return s + '</svg>';
  }

  // Dumbbell: from (base) → to (homogenized) per item, with optional reference line
  function dumbbell(o) {
    const W = o.width || 640;
    const rowH = o.rowH || 24;
    const labelW = o.labelW || 70;
    const top = 30;
    const bottom = 26;
    const H = top + o.items.length * rowH + bottom;
    const vals = [];
    o.items.forEach((d) => vals.push(d.from, d.to));
    if (o.ref) vals.push(o.ref.value);
    const step = niceStep(Math.max.apply(null, vals) - Math.min.apply(null, vals) || 1, 5);
    const lo = Math.floor((Math.min.apply(null, vals) - step * 0.3) / step) * step;
    const hi = Math.ceil((Math.max.apply(null, vals) + step * 0.3) / step) * step;
    const x0 = labelW;
    const x1 = W - 20;
    const sx = (v) => x0 + ((v - lo) / (hi - lo)) * (x1 - x0);
    let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(o.title || '')}">`;
    for (let t = Math.ceil(lo / step) * step; t <= hi + 1e-9; t += step) {
      s += `<line x1="${sx(t)}" x2="${sx(t)}" y1="${top - 8}" y2="${H - bottom + 4}" stroke="${C.grid}" stroke-width="1"/>`;
      s += `<text x="${sx(t)}" y="${H - bottom + 18}" text-anchor="middle" font-size="10" fill="${C.text3}" class="tnum">${fmt(t)}</text>`;
    }
    // legend
    s += `<circle cx="${x0 + 6}" cy="10" r="4.5" fill="${C.dataLight}"/><text x="${x0 + 15}" y="10" dominant-baseline="middle" font-size="9.5" fill="${C.text2}">${esc(o.fromLabel || 'Base')}</text>`;
    s += `<circle cx="${x0 + 136}" cy="10" r="4.5" fill="${C.data}"/><text x="${x0 + 145}" y="10" dominant-baseline="middle" font-size="9.5" fill="${C.text2}">${esc(o.toLabel || 'Homogeneizado')}</text>`;
    if (o.ref) {
      const x = sx(o.ref.value);
      s += `<line x1="${x}" x2="${x}" y1="${top - 8}" y2="${H - bottom + 4}" stroke="${C.accent}" stroke-width="2"/>`;
      s += `<text x="${Math.min(x + 6, W - 4)}" y="${top - 12}" text-anchor="${x > W - 150 ? 'end' : 'start'}" font-size="9.5" font-weight="700" fill="${C.text}">${esc(o.ref.label)}</text>`;
    }
    o.items.forEach((d, i) => {
      const y = top + i * rowH + rowH / 2;
      const a = sx(d.from);
      const b = sx(d.to);
      s += `<g><title>${esc(d.label)}: ${fmt(d.from)} → ${fmt(d.to)} ${esc(o.unit || '')}</title>`;
      s += `<text x="${x0 - 10}" y="${y}" text-anchor="end" dominant-baseline="middle" font-size="11" font-weight="600" fill="${C.text}">${esc(d.label)}</text>`;
      s += `<line x1="${a}" x2="${b}" y1="${y}" y2="${y}" stroke="${C.axis}" stroke-width="2"/>`;
      s += `<circle cx="${a}" cy="${y}" r="5" fill="${C.dataLight}" stroke="${C.surface}" stroke-width="2"/>`;
      s += `<circle cx="${b}" cy="${y}" r="5.5" fill="${C.data}" stroke="${C.surface}" stroke-width="2"/>`;
      const right = b >= a;
      s += `<text x="${right ? b + 10 : b - 10}" y="${y}" text-anchor="${right ? 'start' : 'end'}" dominant-baseline="middle" font-size="9.5" fill="${C.text2}" class="tnum">${fmt(d.to)}</text></g>`;
    });
    return s + '</svg>';
  }

  // Value range figure: scale with CI band, value marker and optional extra markers
  function rangeBar(o) {
    const W = o.width || 640;
    const H = o.height || 74;
    const pad = 16;
    const lo = o.min;
    const hi = o.max;
    const sx = (v) => pad + ((v - lo) / (hi - lo)) * (W - 2 * pad);
    const y = 34;
    const light = !!o.onDark;
    const track = light ? 'rgba(255,255,255,0.22)' : C.grid;
    const band = light ? 'rgba(255,255,255,0.55)' : C.dataLight;
    const ink = light ? '#FFFFFF' : C.text;
    const ink2 = light ? 'rgba(255,255,255,0.78)' : C.text2;
    let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(o.title || '')}">`;
    s += `<rect x="${pad}" y="${y - 4}" width="${W - 2 * pad}" height="8" rx="4" fill="${track}"/>`;
    s += `<rect x="${sx(o.lo)}" y="${y - 4}" width="${sx(o.hi) - sx(o.lo)}" height="8" rx="4" fill="${band}"/>`;
    s += `<text x="${sx(o.lo)}" y="${y + 22}" text-anchor="middle" font-size="10.5" fill="${ink2}" class="tnum">${money(o.lo)}</text>`;
    s += `<text x="${sx(o.hi)}" y="${y + 22}" text-anchor="middle" font-size="10.5" fill="${ink2}" class="tnum">${money(o.hi)}</text>`;
    (o.markers || []).forEach((mk) => {
      const x = sx(mk.v);
      s += `<line x1="${x}" x2="${x}" y1="${y - 9}" y2="${y + 9}" stroke="${ink2}" stroke-width="1.5"/>`;
      s += `<text x="${x}" y="${y - 14}" text-anchor="middle" font-size="9.5" fill="${ink2}">${esc(mk.label)}</text>`;
    });
    const xv = sx(o.value);
    s += `<circle cx="${xv}" cy="${y}" r="7" fill="${light ? '#FFFFFF' : C.accent}" stroke="${light ? C.brand : C.surface}" stroke-width="2.5"/>`;
    s += `<text x="${xv}" y="${y - 14}" text-anchor="middle" font-size="10.5" font-weight="700" fill="${ink}">${esc(o.valueLabel || '')}</text>`;
    return s + '</svg>';
  }

  // Tall segmented bar (one whole split into ≤ 6 parts). Validated categorical order below.
  const SEG = ['#2B6C9C', '#C27C0E', '#8A5CB8', '#1A8A47'];
  function inkFor(hex) {
    const c = hex.replace('#', '');
    const lin = (i) => { const v = parseInt(c.substr(i, 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const L = 0.2126 * lin(0) + 0.7152 * lin(2) + 0.0722 * lin(4);
    return (1.05) / (L + 0.05) >= 4.5 ? '#FFFFFF' : '#14191E';
  }
  function segBar(o) {
    const W = o.width || 640;
    const H = 28;
    const parts = o.parts.filter((p) => p.value > 0);
    const total = parts.reduce((s, p) => s + p.value, 0) || 1;
    const gap = 2;
    let x = 0;
    let s = `<svg class="chart segbar" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(o.title || '')}">`;
    parts.forEach((p, i) => {
      const col = p.color || SEG[i % SEG.length];
      const w = Math.max(0, (p.value / total) * (W - gap * (parts.length - 1)));
      const share = Math.round((p.value / total) * 100) + '%';
      s += `<g><title>${esc(p.label)}: ${fmt(p.value, 2)} m² (${share})</title><rect x="${x}" y="0" width="${w}" height="${H}" rx="4" fill="${col}"/>`;
      if (w >= share.length * 7 + 14) s += `<text x="${x + 8}" y="${H / 2 + 1}" dominant-baseline="middle" font-size="11" font-weight="700" fill="${inkFor(col)}" class="tnum">${share}</text>`;
      s += `</g>`;
      x += w + gap;
    });
    return s + '</svg>';
  }

  function sparkline(values, o) {
    o = o || {};
    const W = o.width || 120;
    const H = o.height || 34;
    const lo = Math.min.apply(null, values);
    const hi = Math.max.apply(null, values);
    const sx = (i) => 3 + (i / (values.length - 1)) * (W - 8);
    const sy = (v) => 3 + (1 - (v - lo) / (hi - lo || 1)) * (H - 6);
    const col = o.color || C.data;
    const d = values.map((v, i) => `${i ? 'L' : 'M'}${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join(' ');
    return `<svg class="spark" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="${d}" fill="none" stroke="${col}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" opacity="0.9"/><circle cx="${sx(values.length - 1)}" cy="${sy(values[values.length - 1])}" r="2.8" fill="${o.endColor || C.accent}"/></svg>`;
  }

  // ---------- maps ----------
  function project(z, lat, lon) {
    const n = 256 * Math.pow(2, z);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return [NaN, NaN];
    lon = ((((lon + 180) % 360) + 360) % 360) - 180;
    const r = (Math.max(-85.0511, Math.min(85.0511, lat)) * Math.PI) / 180;
    return [((lon + 180) / 360) * n, ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n];
  }

  // Tiles come only from the map service passed in (Maps, after the user allows outside maps): none without it.
  // Credit of the maps embedded in the demo valuation (IGN tiles stored in the app).
  const MAP_ATTRIBUTION = '© Instituto Geográfico Nacional (IGN) · CC BY 4.0';

  /* map(asset | {z, center:[lat,lon], w, h}, points, opts)
   * points: {lat, lon, label, kind: 'subject'|'comp'|'ref'|'poi', name}
   */
  function map(asset, points, o) {
    o = o || {};
    const INK = o.ink || C.brandDeep;
    let z, x0, y0, w, h, tiles;
    if (asset && asset.tiles) {
      ({ z, x0, y0, w, h, tiles } = asset);
    } else {
      z = asset.z; w = asset.w; h = asset.h;
      const c = project(z, asset.center[0], asset.center[1]);
      x0 = c[0] - w / 2; y0 = c[1] - h / 2;
      tiles = [];
      const prov = o.provider;
      const tileAt = (zz, tx, ty) => String(prov.tile(zz, tx, ty)).replace(/&/g, '&amp;');
      const tx0 = Math.floor(x0 / 256), tx1 = Math.floor((x0 + w) / 256), ty0 = Math.floor(y0 / 256), ty1 = Math.floor((y0 + h) / 256);
      const sane = Number.isFinite(tx0) && Number.isFinite(ty0) && tx1 - tx0 <= 64 && ty1 - ty0 <= 64;
      if (sane && o.base !== 'none' && prov && prov.tile) for (let ty = ty0; ty <= ty1; ty++) {
        for (let tx = tx0; tx <= tx1; tx++) {
          tiles.push({ x: tx * 256 - x0, y: ty * 256 - y0, d: tileAt(z, tx, ty) });
        }
      }
    }
    const id = nextId('map');
    const lat0 = points.length ? points[0].lat : 41.3;
    const mpp = (156543.03392 * Math.cos((lat0 * Math.PI) / 180)) / Math.pow(2, z);
    // visible window: crop the tile viewport to the requested aspect (w/h), centred
    let vx = 0, vy = 0, vw = w, vh = h;
    if (o.aspect > 0) {
      if (w / h > o.aspect) { vw = h * o.aspect; vx = (w - vw) / 2; }
      else { vh = w / o.aspect; vy = (h - vh) / 2; }
    }
    const r1 = (v) => Math.round(v * 10) / 10;
    let s = `<svg class="map ${o.cls || ''}" viewBox="${r1(vx)} ${r1(vy)} ${r1(vw)} ${r1(vh)}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(o.title || 'Mapa')}">`;
    s += `<defs><clipPath id="${id}c"><rect width="${w}" height="${h}"/></clipPath>`;
    // Colour effects are blend overlays, not SVG filters: a PDF can draw them as they are, so the tiles stay JPEG images
    // (a filtered group is printed as a lossless bitmap at print resolution, several times heavier).
    const dark = /^#[0-9a-f]{6}$/i.test((o.duo && o.duo[0]) || '') ? o.duo[0] : '#142632';
    const light = /^#[0-9a-f]{6}$/i.test((o.duo && o.duo[1]) || '') ? o.duo[1] : '#54728A';
    const veil = o.duotone
      ? `<rect width="${w}" height="${h}" fill="#808080" style="mix-blend-mode:saturation"/><rect width="${w}" height="${h}" fill="${light}" style="mix-blend-mode:multiply"/>` +
        `<rect width="${w}" height="${h}" fill="${dark}" style="mix-blend-mode:screen"/>`
      : `<rect width="${w}" height="${h}" fill="#8C9691" opacity="${r1(Math.max(0, Math.min(1, 1 - 0.25 * (o.saturate != null ? o.saturate : 0.25))))}" style="mix-blend-mode:saturation"/>` +
        `<rect width="${w}" height="${h}" fill="#FFFFFF" opacity="0.12"/>`;
    s += `</defs><g clip-path="url(#${id}c)" style="isolation:isolate"><g>`;
    if (!tiles.length) {
      s += `<rect width="${w}" height="${h}" fill="#F1F4F3"/>`;
      for (let gx = 0; gx <= w; gx += 64) s += `<path d="M${gx} 0V${h}" stroke="#DDE4E2" stroke-width="1"/>`;
      for (let gy = 0; gy <= h; gy += 64) s += `<path d="M0 ${gy}H${w}" stroke="#DDE4E2" stroke-width="1"/>`;
    }
    tiles.forEach((t) => { s += `<image href="${t.d}" x="${t.x}" y="${t.y}" width="256.6" height="256.6" preserveAspectRatio="none"/>`; });
    s += veil + `</g>`;
    if (o.overlay) s += o.overlay(w, h);
    const order = { poi: 0, ref: 1, comp: 2, subject: 3 };
    points.slice().sort((a, b) => order[a.kind] - order[b.kind]).forEach((p) => {
      if (typeof p.lat !== 'number' || typeof p.lon !== 'number') return;
      const pr = project(z, p.lat, p.lon);
      const x = pr[0] - x0;
      const y = pr[1] - y0;
      if (x < -20 || y < -20 || x > w + 20 || y > h + 20) return;
      const k = o.markerScale || 1;
      if (p.kind === 'subject') {
        s += `<g><title>${esc(p.name || p.label)}</title>`;
        s += `<circle cx="${x}" cy="${y}" r="${26 * k}" fill="${o.duotone ? '#FFFFFF' : C.accent}" opacity="0.16"/>`;
        s += `<circle cx="${x}" cy="${y}" r="${16 * k}" fill="${o.duotone ? '#FFFFFF' : C.accent}" opacity="0.22"/>`;
        s += `<circle cx="${x}" cy="${y}" r="${8.5 * k}" fill="${o.duotone ? '#FFFFFF' : C.accent}" stroke="${o.duotone ? INK : '#FFFFFF'}" stroke-width="${3 * k}"/>`;
        if (p.label) {
          const tw = p.label.length * 6.6 * k + 16;
          s += `<rect x="${x + 14 * k}" y="${y - 11 * k}" width="${tw}" height="${22 * k}" rx="${4 * k}" fill="${o.duotone ? '#FFFFFF' : INK}" opacity="0.95"/>`;
          s += `<text x="${x + 14 * k + 8}" y="${y + 1}" dominant-baseline="middle" font-size="${11 * k}" font-weight="700" fill="${o.duotone ? INK : '#FFFFFF'}">${esc(p.label)}</text>`;
        }
        s += `</g>`;
      } else if (p.kind === 'poi') {
        s += `<g><title>${esc(p.name)}</title><rect x="${x - 7 * k}" y="${y - 7 * k}" width="${14 * k}" height="${14 * k}" rx="${3 * k}" fill="${INK}" stroke="#FFFFFF" stroke-width="${2 * k}"/>`;
        s += `<text x="${x}" y="${y + 0.5}" text-anchor="middle" dominant-baseline="middle" font-size="${8.5 * k}" font-weight="700" fill="#FFFFFF">${esc(p.label)}</text>`;
        if (p.caption) s += `<text x="${x + 11 * k}" y="${y + 0.5}" dominant-baseline="middle" font-size="${9.5 * k}" font-weight="600" fill="${INK}" stroke="#FFFFFF" stroke-width="3" paint-order="stroke">${esc(p.caption)}</text>`;
        s += `</g>`;
      } else {
        const fill = p.kind === 'ref' ? '#8C99A4' : C.data;
        const r = 10.5 * k;
        s += `<g><title>${esc(p.name || p.label)}</title><circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="#FFFFFF" stroke-width="${2 * k}"/>`;
        s += `<text x="${x}" y="${y + 0.5}" text-anchor="middle" dominant-baseline="middle" font-size="${9 * k}" font-weight="700" fill="#FFFFFF">${esc(p.label)}</text></g>`;
      }
    });
    const ui = o.uiScale || 1; // overlay size, in map units
    if (o.scaleBar !== false) {
      const target = [50, 100, 200, 250, 500, 1000, 2000].find((m) => m / mpp > vw * 0.14) || 2000;
      const px = target / mpp;
      const bx = r1(vx + 16 * ui);
      const by = r1(vy + vh - 14 * ui);
      s += `<g class="scalebar" transform="translate(${bx},${by})" font-size="${11 * ui}" fill="${C.text}"><rect x="${-7 * ui}" y="${-20 * ui}" width="${px + 14 * ui}" height="${28 * ui}" rx="${4 * ui}" fill="#FFFFFF" opacity="0.88"/>`;
      s += `<path d="M0,${-5 * ui} V0 H${px} V${-5 * ui}" fill="none" stroke="${C.text}" stroke-width="${1.6 * ui}"/>`;
      s += `<text x="${px / 2}" y="${-8 * ui}" text-anchor="middle" font-weight="600">${target >= 1000 ? target / 1000 + ' km' : target + ' m'}</text></g>`;
    }
    if (o.north !== false) {
      s += `<g transform="translate(${r1(vx + vw - 28 * ui)},${r1(vy + 28 * ui)}) scale(${ui})"><circle r="15" fill="#FFFFFF" opacity="0.9"/><path d="M0,-9 L5.5,6 L0,2.5 L-5.5,6 Z" fill="${INK}"/><text y="-11.5" text-anchor="middle" font-size="7.5" font-weight="700" fill="${INK}" dy="-0.5">N</text></g>`;
    }
    if (tiles.length) s += `<text class="credits" x="${r1(vx + vw - 7 * ui)}" y="${r1(vy + vh - 7 * ui)}" text-anchor="end" font-size="${9.5 * ui}" fill="${o.duotone ? 'rgba(255,255,255,0.7)' : C.text2}" stroke="${o.duotone ? 'none' : '#FFFFFF'}" stroke-width="${3 * ui}" paint-order="stroke">${esc((asset && asset.attribution) || (o.provider && (o.provider.creditAt ? o.provider.creditAt(z) : o.provider.attribution)) || MAP_ATTRIBUTION)}</text>`;
    return s + '</g></svg>';
  }

  // Distribution of simulated values: one bar per bin (rounded data-end on the baseline), the band
  // (e.g. P10–P90) in the data colour, the rest in its light tint, vertical markers with labels.
  function histogram(o) {
    const bins = o.bins || [];
    if (!bins.length) return '';
    const W = o.width || 640;
    const H = o.height || 200;
    const left = 12;
    const right = 12;
    const top = 30;
    const bottom = 30;
    const v0 = bins[0].x0;
    const v1 = bins[bins.length - 1].x1;
    const maxC = Math.max.apply(null, bins.map((b) => b.count)) || 1;
    const sx = (v) => left + (v - v0) / ((v1 - v0) || 1) * (W - left - right);
    const base = H - bottom;
    const sy = (c) => top + (1 - c / maxC) * (base - top);
    let s = `<svg class="chart hist" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(o.title || '')}">`;
    bins.forEach((b) => {
      if (!b.count) return;
      const x = sx(b.x0) + 1;
      const w = Math.max(2, sx(b.x1) - sx(b.x0) - 2);
      const y = sy(b.count);
      const r = Math.min(4, w / 2, base - y);
      const inBand = o.band && b.x1 > o.band[0] && b.x0 < o.band[1];
      s += `<path d="M${x.toFixed(1)},${base} V${(y + r).toFixed(1)} Q${x.toFixed(1)},${y.toFixed(1)} ${(x + r).toFixed(1)},${y.toFixed(1)} H${(x + w - r).toFixed(1)} Q${(x + w).toFixed(1)},${y.toFixed(1)} ${(x + w).toFixed(1)},${(y + r).toFixed(1)} V${base} Z" fill="${inBand ? C.data : C.dataLight}"><title>${esc(money(b.x0))} – ${esc(money(b.x1))}: ${b.count}</title></path>`;
    });
    s += `<line x1="${left}" y1="${base}" x2="${W - right}" y2="${base}" stroke="${C.axis}" stroke-width="1"/>`;
    const step = niceStep(v1 - v0 || 1, 5);
    for (let t = Math.ceil(v0 / step) * step; t <= v1 + 1e-9; t += step) {
      const x = sx(t);
      s += `<line x1="${x.toFixed(1)}" y1="${base}" x2="${x.toFixed(1)}" y2="${base + 4}" stroke="${C.axis}"/><text x="${x.toFixed(1)}" y="${base + 16}" text-anchor="middle" font-size="10.5" fill="${C.text3}">${esc(fmt(t / 1000))}k</text>`;
    }
    if (o.band) {
      const a = sx(o.band[0]);
      const b = sx(o.band[1]);
      s += `<path d="M${a.toFixed(1)},${top - 8} V${top - 4} H${b.toFixed(1)} V${top - 8}" fill="none" stroke="${C.text2}" stroke-width="1"/>` +
        `<text x="${a.toFixed(1)}" y="${top - 12}" text-anchor="middle" font-size="10.5" font-weight="600" fill="${C.text2}">P10</text>` +
        `<text x="${b.toFixed(1)}" y="${top - 12}" text-anchor="middle" font-size="10.5" font-weight="600" fill="${C.text2}">P90</text>`;
    }
    (o.markers || []).forEach((m) => {
      if (m.v == null || !isFinite(m.v)) return;
      const x = Math.max(left, Math.min(W - right, sx(m.v)));
      const anchor = x > W - 190 ? 'end' : 'start';
      const label = `${m.label ? m.label + ' · ' : ''}${money(Math.round(m.v / 1000) * 1000)}`;
      s += `<line x1="${x.toFixed(1)}" y1="${top + 2}" x2="${x.toFixed(1)}" y2="${base}" stroke="${C.accent}" stroke-width="2" stroke-dasharray="4 3"/>` +
        `<text x="${x.toFixed(1)}" y="${top + 14}" dx="${anchor === 'start' ? 6 : -6}" text-anchor="${anchor}" font-size="10.5" font-weight="700" fill="${C.text}" stroke="#ffffff" stroke-width="4" stroke-linejoin="round" paint-order="stroke">${esc(label)}</text>`;
    });
    return s + '</svg>';
  }

  // Diverging horizontal bars around zero (e.g. change in value when a comparable is removed).
  function divergingBars(o) {
    const items = o.items || [];
    if (!items.length) return '';
    const W = o.width || 640;
    const rowH = o.rowH || 21;
    const labelW = o.labelW || 190;
    const valueW = 58;
    const top = 6;
    const bottom = 20;
    const H = top + items.length * rowH + bottom;
    const max = o.max || Math.max(0.01, Math.max.apply(null, items.map((d) => Math.abs(d.value))));
    const x0 = labelW;
    const x1 = W - valueW;
    const xm = (x0 + x1) / 2;
    const half = (x1 - x0) / 2;
    const neg = o.negColor || '#B9541C';
    const pos = o.posColor || C.data;
    let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(o.title || '')}">`;
    items.forEach((d, i) => {
      const y = top + i * rowH;
      const w = Math.abs(d.value) / max * half;
      const x = d.value < 0 ? xm - w : xm;
      const cy = y + rowH / 2;
      s += `<text x="${labelW - 8}" y="${cy + 3.5}" text-anchor="end" font-size="10.5" fill="${C.text2}">${esc(d.label)}</text>`;
      if (w > 0.5) s += `<rect x="${x.toFixed(1)}" y="${(cy - 5).toFixed(1)}" width="${w.toFixed(1)}" height="10" rx="2" fill="${d.value < 0 ? neg : pos}"><title>${esc(d.label)}: ${esc(fmt(d.value * 100, 1))}%</title></rect>`;
      s += `<text x="${W - 4}" y="${cy + 3.5}" text-anchor="end" font-size="10.5" font-weight="600" fill="${C.text}">${d.value > 0 ? '+' : ''}${esc(fmt(d.value * 100, 1))}%</text>`;
    });
    s += `<line x1="${xm}" y1="${top - 2}" x2="${xm}" y2="${H - bottom + 2}" stroke="${C.axis}" stroke-width="1"/>`;
    [-1, 1].forEach((sg) => {
      s += `<text x="${(xm + sg * half).toFixed(1)}" y="${H - 5}" text-anchor="${sg < 0 ? 'start' : 'end'}" font-size="9.5" fill="${C.text3}">${sg < 0 ? '−' : '+'}${esc(fmt(max * 100, 1))}%</text>`;
    });
    return s + `<text x="${xm}" y="${H - 5}" text-anchor="middle" font-size="9.5" fill="${C.text3}">0</text></svg>`;
  }

  return { C, SEG, hbars, line, dumbbell, rangeBar, segBar, treemap, sparkline, map, project, histogram, divergingBars, fmt, money, esc, setLocale, getLocale, setCurrency };
});
