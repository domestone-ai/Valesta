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
/* Exports the report as a standalone HTML file and (with --pdf) as a PDF with headless Chrome or Edge.
 * Usage: node tools/export_report.js [--pdf] [--lang en|es|it|all] [--state project.json] [--out dist/reports]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const J = (p) => path.join(ROOT, p);
global.I18N = require(J('src/js/i18n.js'));
global.MCA = require(J('src/js/engine.js'));
global.Charts = require(J('src/js/charts.js'));
global.ASSETS = require(J('src/js/assets.js'));
global.REPORT_I18N = require(J('src/js/report_i18n.js'));
global.PROFILE_ASSETS = require(J('src/js/profiles_assets.js'));
global.Profiles = require(J('src/js/profiles.js'));
const DEFAULT_STATE = require(J('src/js/data.js'));
// The Valesta logo for the neutral profile, as in the app (brand files, see brand/README.md).
const logo = (n) => 'data:image/svg+xml;base64,' + fs.readFileSync(J('brand/' + n)).toString('base64');
global.VALESTA_LOGO = { light: logo('valesta-logo.svg'), dark: logo('valesta-logo-reverse.svg') };
const Report = require(J('src/js/report.js'));

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const base = arg('--state') ? JSON.parse(fs.readFileSync(arg('--state'), 'utf8')) : JSON.parse(JSON.stringify(DEFAULT_STATE));
const langs = (arg('--lang', 'en') === 'all' ? I18N.LANGS : [arg('--lang', 'en')]);
const outDir = path.resolve(ROOT, arg('--out', 'dist/reports'));
fs.mkdirSync(outDir, { recursive: true });
const slug = `${base.subject.address || 'property'} ${base.subject.municipality || ''}`
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '');
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p));

for (const lang of langs) {
  const state = JSON.parse(JSON.stringify(base));
  state.meta.reportLang = lang;
  const res = MCA.compute(state);
  const fonts = Report.filterFontCss(['src/css/fonts.css', 'src/css/fonts-cjk.css'].map((f) => fs.readFileSync(J(f), 'utf8')).join('\n'), Report.usedFonts(state));
  const css = fonts + '\n' + fs.readFileSync(J('src/css/report.css'), 'utf8') + '\n' + Report.brandCss(state);
  const html = Report.documentHtml(Report.render(state, res), css, Report.documentTitle(state), lang, { autoFit: true });
  const file = path.join(outDir, `${Report.fileTitle(lang)}_${slug}_${lang.toUpperCase()}.html`);
  fs.writeFileSync(file, html, 'utf8');
  console.log(`HTML ${lang}:`, path.relative(path.resolve(ROOT, '..'), file), Math.round(html.length / 1024) + ' KB · total', res.total);
  if (args.includes('--pdf')) {
    if (!chrome) throw new Error('Chrome/Edge not found');
    const pdf = file.replace(/\.html$/, '.pdf');
    execFileSync(chrome, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${path.join(process.env.TEMP || '/tmp', 'valesta-pdf')}`,
      '--no-pdf-header-footer', '--virtual-time-budget=10000', `--print-to-pdf=${pdf}`, 'file:///' + file.replace(/\\/g, '/')], { stdio: 'ignore', timeout: 120000 });
    console.log(`PDF  ${lang}:`, path.relative(path.resolve(ROOT, '..'), pdf), Math.round(fs.statSync(pdf).size / 1024) + ' KB');
  }
}
