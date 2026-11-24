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
'use strict';
// Contrast of the interface colours (WCAG 2.x) in the light and the dark theme: the pairs the components really use.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'css', 'app.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
function block(selector) {
  const start = css.indexOf(`${selector} {`);
  assert.ok(start >= 0, `${selector} block`);
  const body = css.slice(start, css.indexOf('}', start));
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}
const light = block(':root');
const dark = Object.assign({}, light, block(':root[data-theme="dark"]'));
const hex = (theme, name) => {
  const v = name.startsWith('#') ? name : theme[name];
  assert.match(String(v), /^#[0-9A-Fa-f]{6}$/, `--${name} is a hex colour`);
  return v;
};
const lum = (h) => {
  const c = h.slice(1).match(/../g).map((x) => parseInt(x, 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

const TEXT = [
  [['ui-text', 'ui-ink-2', 'ui-muted'], ['ui-bg', 'ui-panel', 'ui-raised', 'ui-surface-2', 'ui-surface-3', 'ui-field']],
  [['ui-faint'], ['ui-bg', 'ui-panel', 'ui-surface-2', 'ui-field']],
  [['ui-text'], ['ui-accent-50', 'ui-green-50', 'ui-warn-50', 'ui-danger-50', 'ui-info-50', 'ui-ai-50', 'ui-hl']],
  [['ui-accent'], ['ui-bg', 'ui-panel', 'ui-surface-2', 'ui-accent-50']],
  [['ui-accent-deep'], ['ui-panel', 'ui-accent-50', 'ui-accent-100']],
  [['ui-green'], ['ui-panel', 'ui-green-50']], [['ui-warn'], ['ui-panel', 'ui-warn-50']], [['ui-danger'], ['ui-panel', 'ui-danger-50']],
  [['ui-info'], ['ui-panel', 'ui-info-50']], [['ui-ai'], ['ui-panel', 'ui-ai-50', 'ui-ai-100']],
  [['ui-warn-deep'], ['ui-warn-100']], [['ui-info-deep'], ['ui-info-100']],
  [['ui-on-accent'], ['ui-accent', 'ui-accent-deep']], [['ui-on-ai'], ['ui-ai', 'ui-ai-deep']], [['ui-on-danger'], ['ui-danger']],
  [['ui-toast-text'], ['ui-toast-bg']], [['ui-on-hero', 'ui-on-hero-2', 'ui-on-hero-3'], ['ui-hero']],
  [['ui-paper-ink', 'ui-paper-muted'], ['ui-paper']], [['ui-paper-dark-ink'], ['ui-paper-dark']],
  // labels of the selected step, and the state of the value in the header on the hover surface
  [['ui-ink-2'], ['ui-accent-50']], [['ui-warn', 'ui-danger'], ['ui-surface-2']],
];
const CONTROLS = [
  [['ui-line-2'], ['ui-bg', 'ui-panel', 'ui-surface-2', 'ui-field']],
  [['ui-focus'], ['ui-bg', 'ui-panel', 'ui-raised', 'ui-surface-2', 'ui-surface-3', 'ui-accent-50', 'ui-field']],
  [['ui-accent', 'ui-danger', 'ui-ai'], ['ui-field']],
  [['ui-green', 'ui-warn', 'ui-faint'], ['ui-panel']],
  // step icons (complete, open checks, in progress, to do) on the selected step and on hover
  [['ui-green', 'ui-warn', 'ui-ink-2', 'ui-faint'], ['ui-accent-50', 'ui-surface-2']],
];

for (const [name, theme] of [['light', light], ['dark', dark]]) {
  test(`${name} theme: text meets 4.5:1 on every background it is used on`, () => {
    for (const [fgs, bgs] of TEXT) for (const fg of fgs) for (const bg of bgs) {
      const r = ratio(hex(theme, fg), hex(theme, bg));
      assert.ok(r >= 4.5, `${fg} on ${bg}: ${r.toFixed(2)}:1`);
    }
  });
  test(`${name} theme: controls, states and the focus ring meet 3:1`, () => {
    for (const [fgs, bgs] of CONTROLS) for (const fg of fgs) for (const bg of bgs) {
      const r = ratio(hex(theme, fg), hex(theme, bg));
      assert.ok(r >= 3, `${fg} on ${bg}: ${r.toFixed(2)}:1`);
    }
  });
}

test('the brand keeps its petrol green and success is a different green', () => {
  assert.equal(light['ui-brand'], '#0E5A4E');
  assert.notEqual(light['ui-green'], light['ui-accent']);
  assert.notEqual(dark['ui-green'], dark['ui-accent']);
});
