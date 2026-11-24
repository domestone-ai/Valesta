#!/usr/bin/env node
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
/* Valesta MCP server — no dependencies (Node.js ≥ 20).
 *
 *   node valesta-mcp.js                    stdio: Claude Desktop, Claude Code, Gemini CLI, LM Studio, Cursor, VS Code…
 *   node valesta-mcp.js --http             also http://127.0.0.1:8790: the Valesta web app in live sync
 *                                          (the changes made in the chat show in the app) + MCP Streamable HTTP at /mcp
 *   options: --port 8790  --project <file.json>  --web <app folder>  --no-stdio  --lang en|es|it
 *
 * The working project is a JSON file (default: ../Projects/valesta-project.json), saved at every change.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const readline = require('readline');
const { execFile, spawn } = require('child_process');

const HERE = __dirname;
const LIB = fs.existsSync(path.join(HERE, 'lib', 'engine.js')) ? path.join(HERE, 'lib') : path.join(HERE, '..', 'src', 'js');
const CSS = fs.existsSync(path.join(HERE, 'lib', 'report.css')) ? path.join(HERE, 'lib') : path.join(HERE, '..', 'src', 'css');
const ROOT = fs.existsSync(path.join(HERE, 'lib', 'engine.js')) ? path.resolve(HERE, '..') : path.resolve(HERE, '..', '..');
global.I18N = require(path.join(LIB, 'i18n.js'));
global.MCA = require(path.join(LIB, 'engine.js'));
global.Charts = require(path.join(LIB, 'charts.js'));
global.ASSETS = require(path.join(LIB, 'assets.js'));
global.REPORT_I18N = require(path.join(LIB, 'report_i18n.js'));
global.PROFILE_ASSETS = require(path.join(LIB, 'profiles_assets.js'));
global.Profiles = require(path.join(LIB, 'profiles.js'));
global.AppCore = require(path.join(LIB, 'appcore.js'));
global.Maps = require(path.join(LIB, 'maps.js'));
global.Review = require(path.join(LIB, 'review.js'));
const Report = require(path.join(LIB, 'report.js'));
const AITools = require(path.join(LIB, 'aitools.js'));
const DEFAULT_STATE = require(path.join(LIB, 'data.js'));
// The Valesta logo for the neutral profile (brand files, not AGPL code): brand/ next to the server or in the repository.
for (const dir of [path.join(HERE, 'brand'), path.join(ROOT, 'brand')]) {
  const light = path.join(dir, 'valesta-logo.svg'), dark = path.join(dir, 'valesta-logo-reverse.svg');
  if (fs.existsSync(light) && fs.existsSync(dark)) {
    const uri = (p) => 'data:image/svg+xml;base64,' + fs.readFileSync(p).toString('base64');
    global.VALESTA_LOGO = { light: uri(light), dark: uri(dark) };
    break;
  }
}

const VERSION = '1.0.0';
const argv = process.argv.slice(2);
const flag = (k) => argv.includes(k);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const UI_LANG = ['en', 'es', 'it'].includes(opt('--lang', process.env.VALESTA_LANG)) ? opt('--lang', process.env.VALESTA_LANG) : 'en';
// Address search for the geocode tool: off unless the server is started with --geocoder nominatim (OpenStreetMap
// Nominatim, within its usage policy) or --geocoder https://… (a Nominatim-compatible service of the user's own).
const GEOCODER = ((g) => (g === 'nominatim' ? { provider: 'nominatim' } : /^https:\/\/[^\s]+$/i.test(g) ? { provider: 'custom', url: g } : { provider: 'off' }))(String(opt('--geocoder', '') || '').trim());
// Outside map tiles in exported reports only with --maps (then embedded in the file); public geodata services for the
// assistant only with --geodata; the client name and the agency contacts stay out of what the assistant reads unless
// --no-redact.
const MAPS_ON = flag('--maps'), GEODATA_ON = flag('--geodata'), REDACT = !flag('--no-redact');
global.Maps.setAllowed(MAPS_ON);
const PROJECTS = path.resolve(opt('--projects', ['Projects', 'Progetti'].map((d) => path.join(ROOT, d)).find((d) => fs.existsSync(d)) || path.join(ROOT, 'Projects'))); // Progetti: earlier installations
const REPORTS = path.resolve(opt('--reports', path.join(ROOT, 'Reports')));
const WEB = path.resolve(opt('--web', path.join(ROOT, 'Web')));
const log = (...a) => process.stderr.write('[valesta] ' + a.join(' ') + '\n');
const clone = (o) => JSON.parse(JSON.stringify(o));

// ---------- project ----------
const DEFAULT_FILE = ['valesta-project.json', 'valesta-progetto.json'].map((f) => path.join(PROJECTS, f)).find((f) => fs.existsSync(f)) || path.join(PROJECTS, 'valesta-project.json');
const project = { file: path.resolve(opt('--project', DEFAULT_FILE)), state: null, version: 0, saveTimer: null };
function exampleState() { const s = clone(DEFAULT_STATE); s.meta.id = 'vexampledemo01'; return s; }
function loadProject(file) {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const v = AppCore.validateState(raw, DEFAULT_STATE);
  if (!v.ok) throw new Error(v.errors.join(' '));
  project.file = file;
  project.state = v.state;
  project.version++;
}
function saveProject(file) {
  const f = file || project.file;
  fs.mkdirSync(path.dirname(f), { recursive: true });
  const tmp = f + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(project.state, null, 1), 'utf8');
  fs.renameSync(tmp, f);
  project.file = f;
}
function touch() {
  project.version++;
  clearTimeout(project.saveTimer);
  project.saveTimer = setTimeout(() => { try { saveProject(); } catch (e) { log('save failed:', e.message); } }, 300);
}
try {
  if (fs.existsSync(project.file)) loadProject(project.file);
  else { project.state = exampleState(); project.version = 0; }
} catch (e) { log('cannot read project:', e.message); project.state = exampleState(); }
// Files and folders named through the tools stay inside the Projects and Reports folders (subfolders allowed), besides
// the project file the server was started with: a manipulated assistant cannot read or overwrite files elsewhere.
const LAUNCH_FILE = project.file;
const inside = (dir, p) => { const rel = path.relative(dir, p); return rel === '' || (rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel)); };
const resolveFile = (f) => {
  const p = String(f || '').trim();
  if (!p) return null;
  let abs = path.resolve(PROJECTS, p);
  if (!/\.json$/i.test(abs)) abs += '.json';
  if (!inside(PROJECTS, abs) && path.relative(LAUNCH_FILE, abs) !== '') throw new Error(`project files stay in the Projects folder (${PROJECTS})`);
  return abs;
};
const reportDir = (folder) => {
  if (!folder) return REPORTS;
  const dir = path.resolve(REPORTS, String(folder));
  if (!inside(REPORTS, dir)) throw new Error(`reports stay in the Reports folder (${REPORTS}); "folder" is a subfolder name`);
  return dir;
};

// ---------- report export ----------
function findChrome() {
  const env = process.env;
  const list = [env.CHROME_PATH,
    path.join(env.ProgramFiles || 'C:/Program Files', 'Google/Chrome/Application/chrome.exe'),
    path.join(env['ProgramFiles(x86)'] || 'C:/Program Files (x86)', 'Google/Chrome/Application/chrome.exe'),
    path.join(env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'),
    path.join(env['ProgramFiles(x86)'] || 'C:/Program Files (x86)', 'Microsoft/Edge/Application/msedge.exe'),
    path.join(env.ProgramFiles || 'C:/Program Files', 'Microsoft/Edge/Application/msedge.exe'),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Chromium.app/Contents/MacOS/Chromium', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge'];
  return list.find((p) => p && fs.existsSync(p)) || null;
}
async function nodeDataUrl(url) {
  if (typeof fetch !== 'function') return null;
  const r = await fetch(url, { headers: { 'User-Agent': `Valesta/${VERSION} (property valuation tool)` } });
  if (!r.ok) return null;
  const type = String(r.headers.get('content-type') || '').split(';')[0].trim();
  if (!/^image\//.test(type)) return null;
  return `data:${type};base64,${Buffer.from(await r.arrayBuffer()).toString('base64')}`;
}
async function exportReport(args) {
  const dir = reportDir(args.folder);
  const lang = I18N.LANGS.includes(args.lang) ? args.lang : project.state.meta.reportLang || 'es';
  const state = clone(project.state);
  state.meta.reportLang = lang;
  const res = MCA.compute(state);
  const fontCss = ['fonts.css', 'fonts-cjk.css'].map((f) => path.join(CSS, f)).filter((f) => fs.existsSync(f)).map((f) => fs.readFileSync(f, 'utf8')).join('\n');
  const fonts = Report.filterFontCss(fontCss, Report.usedFonts(state));
  const css = fonts + '\n' + fs.readFileSync(path.join(CSS, 'report.css'), 'utf8') + '\n' + Report.brandCss(state);
  let html = Report.documentHtml(Report.render(state, res), css, Report.documentTitle(state), lang, { autoFit: true });
  if (MAPS_ON) html = await Report.inlineImages(html, nodeDataUrl);   // the file contacts no outside service
  const slug = AppCore.slug(`${state.subject.address || 'property'} ${state.subject.municipality || ''}`).replace(/-/g, '_');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${Report.fileTitle(lang)}_${slug}_${lang.toUpperCase()}.html`);
  fs.writeFileSync(file, html, 'utf8');
  const out = { html: file, value: res.total, pages: (html.match(/<section class="page/g) || []).length };
  if (args.format === 'pdf' || args.format === 'both') {
    const chrome = findChrome();
    if (!chrome) { out.pdf_error = 'Chrome or Edge not found (set CHROME_PATH)'; return out; }
    const pdf = file.replace(/\.html$/, '.pdf');
    await new Promise((resolve, reject) => execFile(chrome, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
      `--user-data-dir=${path.join(require('os').tmpdir(), 'valesta-pdf')}`, '--no-pdf-header-footer', '--virtual-time-budget=10000', `--print-to-pdf=${pdf}`,
      'file:///' + file.replace(/\\/g, '/')], { timeout: 120000 }, (err) => (err ? reject(err) : resolve())));
    out.pdf = pdf;
  }
  return out;
}

// ---------- tools ----------
const S = (props, req) => ({ type: 'object', properties: props || {}, required: req || [] });
const SERVER_TOOLS = [
  { name: 'project_info', description: 'Current project: file, version, property, value, number of comparables and the URL of the live web app (when started with --http).', inputSchema: S() },
  { name: 'project_new', description: 'Start a new valuation: "blank" keeps agency, brand, style and method settings; "example" loads the anonymised demo case. The current one is saved first.', inputSchema: S({ template: { type: 'string', enum: ['blank', 'example'] }, file: { type: 'string', description: 'Optional file name in the Projects folder' } }, ['template']) },
  { name: 'project_open', description: 'Open a Valesta project file (.json) from the Projects folder: a name, or a path inside that folder.', inputSchema: S({ file: { type: 'string' } }, ['file']) },
  { name: 'project_save', description: 'Save the project now; pass "file" to save a copy under another name in the Projects folder (then continue on it).', inputSchema: S({ file: { type: 'string' } }) },
  { name: 'project_list', description: 'List the project files in the Projects folder with address and value.', inputSchema: S() },
  { name: 'report_export', description: 'Write the A4 report as standalone HTML and/or PDF (Chrome or Edge) into the Reports folder, in any of the seventeen report languages.', inputSchema: S({ format: { type: 'string', enum: ['html', 'pdf', 'both'] }, lang: { type: 'string', enum: I18N.LANGS }, folder: { type: 'string' } }) },
  { name: 'profile_list', description: 'List the agency profile library (neutral Valesta default plus three fictitious example agencies): brand, colours, fonts and office.', inputSchema: S() },
  { name: 'profile_apply', description: 'Apply an agency profile from the library to the valuation: brand, logo, colours, fonts, cover and office details (the case data are kept).', inputSchema: S({ id: { type: 'string' } }, ['id']) },
  { name: 'open_web_app', description: 'Open the Valesta web app (live view of this project) in the default browser. Needs the server started with --http.', inputSchema: S() },
];
const AI_TOOLS = AITools.TOOLS.filter((t) => !t.optional).map((t) => ({ name: t.name, description: t.description, inputSchema: t.parameters }));
const TOOL_LIST = SERVER_TOOLS.concat(AI_TOOLS);
let httpUrl = null;

const text = (obj, isError) => ({ content: [{ type: 'text', text: typeof obj === 'string' ? obj : JSON.stringify(obj, null, 1) }], isError: !!isError });
async function callTool(name, args) {
  args = args && typeof args === 'object' ? args : {};
  const st = project.state;
  switch (name) {
    case 'project_info': {
      const res = MCA.compute(st);
      return text({ file: project.file, version: project.version, address: [st.subject.address, st.subject.floorDoor, st.subject.municipality].filter(Boolean).join(', '),
        report_language: st.meta.reportLang, value: res.total, comparables: st.comparables.length, used: res.stats.n, web_app_url: httpUrl, reports_folder: REPORTS });
    }
    case 'project_new': {
      const file = args.file ? resolveFile(args.file) : null;   // checked before anything changes
      saveProject();
      project.state = args.template === 'example' ? exampleState() : AppCore.blankState(DEFAULT_STATE, st);
      if (args.template !== 'example') delete project.state.meta.id;
      AppCore.ensureId(project.state);
      if (file) project.file = file;
      else if (args.template !== 'example') project.file = path.join(PROJECTS, `valesta-${new Date().toISOString().slice(0, 10)}-${project.state.meta.id.slice(-5)}.json`);
      touch();
      return text({ ok: true, file: project.file, template: args.template });
    }
    case 'project_open': {
      const f = resolveFile(args.file);
      if (!f || !fs.existsSync(f)) return text({ error: 'file not found: ' + args.file }, true);
      saveProject();
      loadProject(f);
      return text({ ok: true, file: f, address: project.state.subject.address });
    }
    case 'project_save': {
      if (args.file) { project.file = resolveFile(args.file); project.version++; }
      saveProject();
      return text({ ok: true, file: project.file });
    }
    case 'project_list': {
      fs.mkdirSync(PROJECTS, { recursive: true });
      const items = fs.readdirSync(PROJECTS).filter((f) => f.endsWith('.json')).map((f) => {
        try { const s = JSON.parse(fs.readFileSync(path.join(PROJECTS, f), 'utf8')); return { file: f, address: s.subject && s.subject.address, municipality: s.subject && s.subject.municipality, value: MCA.compute(s).total }; }
        catch (e) { return { file: f, error: 'unreadable' }; }
      });
      return text({ folder: PROJECTS, current: project.file, projects: items });
    }
    case 'report_export':
      return text(await exportReport(args));
    case 'profile_list':
      return text({ default: Profiles.DEFAULT_ID, profiles: Profiles.LIST.map((p) => ({ id: p.id, label: p.label, brand: p.profile.brand.name, primary: p.profile.brand.primary, accent: p.profile.brand.accent,
        fonts: [p.profile.design.fontHead, p.profile.design.fontBody], cover: p.profile.design.coverStyle, office: p.profile.office })) });
    case 'profile_apply': {
      const p = Profiles.get(args.id);
      if (!p) return text({ error: 'unknown profile ' + args.id + ' (see profile_list)' }, true);
      const r = AppCore.applyProfile(st, p.profile);
      if (!r.ok) return text({ error: r.errors.join(' ') }, true);
      project.state = r.state;
      project.state.brand.profileId = p.id;
      touch();
      return text({ ok: true, applied: p.label });
    }
    case 'open_web_app': {
      if (!httpUrl) return text({ error: 'start the server with --http to use the web app' }, true);
      const cmd = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', httpUrl]] : process.platform === 'darwin' ? ['open', [httpUrl]] : ['xdg-open', [httpUrl]];
      spawn(cmd[0], cmd[1], { detached: true, stdio: 'ignore' }).unref();
      return text({ ok: true, url: httpUrl });
    }
    default: {
      if (!AI_TOOLS.some((t) => t.name === name)) return text({ error: 'unknown tool ' + name }, true);
      const r = await AITools.execute(name, args, { state: st, lang: st.meta.reportLang, uiLang: UI_LANG, fetch: typeof fetch === 'function' ? fetch : null, node: true, geocoder: GEOCODER, geodata: GEODATA_ON, redact: REDACT });
      if (r.changed) touch();
      return text(r.result, !r.ok);
    }
  }
}

// ---------- JSON-RPC / MCP ----------
const INSTRUCTIONS = 'Valesta valuation tools. Call get_valuation first, then fill fields with update_fields, add comparables found with your web search using add_comparable (always with URL and date), run compute_valuation and review_valuation, and export the report with report_export. Edits are saved to the project file and shown live in the Valesta web app when it is open.';
const err = (id, code, message) => ({ jsonrpc: '2.0', id: id === undefined ? null : id, error: { code, message } });
async function handle(msg) {
  if (!msg || typeof msg !== 'object' || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
    return msg && msg.id !== undefined && msg.result === undefined && msg.error === undefined ? err(msg.id, -32600, 'Invalid Request') : null;
  }
  const { id, method } = msg;
  const params = msg.params || {};
  const note = id === undefined;
  try {
    let result;
    switch (method) {
      case 'initialize': {
        const pv = /^\d{4}-\d{2}-\d{2}$/.test(params.protocolVersion || '') ? params.protocolVersion : '2025-06-18';
        result = { protocolVersion: pv, capabilities: { tools: { listChanged: false }, prompts: { listChanged: false }, resources: { listChanged: false } },
          serverInfo: { name: 'valesta', title: 'Valesta property valuation', version: VERSION }, instructions: INSTRUCTIONS };
        break;
      }
      case 'ping': result = {}; break;
      case 'tools/list': result = { tools: TOOL_LIST }; break;
      case 'tools/call':
        try { result = await callTool(params.name, params.arguments); } catch (e) { result = text({ error: e.message }, true); }
        break;
      case 'prompts/list':
        result = { prompts: [{ name: 'valesta_assistant', title: 'Valesta valuation assistant', description: 'Work as the Valesta assistant on the open valuation: fill in data, find comparables, review and improve the report.',
          arguments: [{ name: 'language', description: 'Conversation language: it, en or es', required: false }] }] };
        break;
      case 'prompts/get': {
        if (params.name !== 'valesta_assistant') return err(id, -32602, 'unknown prompt');
        const lang = ['it', 'en', 'es'].includes((params.arguments || {}).language) ? params.arguments.language : UI_LANG;
        const sys = AITools.systemPrompt({ uiLang: lang, reportLang: project.state.meta.reportLang, today: new Date().toISOString().slice(0, 10), search: 'native' });
        result = { description: 'Valesta valuation assistant', messages: [{ role: 'user', content: { type: 'text', text: `${sys}\n\nStart by calling get_valuation and tell me in two lines what is missing.` } }] };
        break;
      }
      case 'resources/list':
        result = { resources: [{ uri: 'valesta://project/current', name: 'current-valuation', title: 'Current valuation (summary)', mimeType: 'application/json' }] };
        break;
      case 'resources/templates/list': result = { resourceTemplates: [] }; break;
      case 'resources/read': {
        if (params.uri !== 'valesta://project/current') return err(id, -32002, 'resource not found');
        const st = project.state;
        result = { contents: [{ uri: params.uri, mimeType: 'application/json', text: JSON.stringify(AITools.summarize(st, MCA.compute(st), { lang: st.meta.reportLang, uiLang: UI_LANG }), null, 1) }] };
        break;
      }
      case 'logging/setLevel': result = {}; break;
      default:
        if (note || method.startsWith('notifications/')) return null;
        return err(id, -32601, 'Method not found: ' + method);
    }
    return note ? null : { jsonrpc: '2.0', id, result };
  } catch (e) {
    return note ? null : err(id, -32603, e.message);
  }
}
async function handleRaw(raw) {
  let msg;
  try { msg = JSON.parse(raw); } catch (e) { return err(null, -32700, 'Parse error'); }
  if (Array.isArray(msg)) { const out = (await Promise.all(msg.map(handle))).filter(Boolean); return out.length ? out : null; }
  return handle(msg);
}

// ---------- stdio transport ----------
function startStdio() {
  const rl = readline.createInterface({ input: process.stdin, terminal: false });
  let queue = Promise.resolve();
  rl.on('line', (line) => {
    if (!line.trim()) return;
    queue = queue.then(async () => { const out = await handleRaw(line); if (out) process.stdout.write(JSON.stringify(out) + '\n'); });
  });
  rl.on('close', () => { clearTimeout(project.saveTimer); try { saveProject(); } catch (e) { /* ignore */ } if (!flag('--http')) process.exit(0); });
}

// ---------- HTTP: web app + live sync + Streamable HTTP MCP ----------
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
function startHttp(port, attempt) {
  attempt = attempt || 0;
  const allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`]);
  const allowedOrigins = new Set([`http://127.0.0.1:${port}`, `http://localhost:${port}`]);
  const server = http.createServer((req, res) => {
    const send = (code, body, type, extra) => { res.writeHead(code, Object.assign({ 'Content-Type': type || 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }, extra || {})); res.end(body == null ? '' : typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body)); };
    if (!allowedHosts.has(req.headers.host || '')) return send(403, { error: 'host not allowed' });
    if (req.headers.origin && !allowedOrigins.has(req.headers.origin)) return send(403, { error: 'origin not allowed' });
    const url = new URL(req.url, `http://${req.headers.host}`);
    const readBody = (limit) => new Promise((resolve, reject) => {
      const chunks = [];
      let size = 0;
      req.on('data', (c) => { size += c.length; if (size > limit) { reject(new Error('payload too large')); req.destroy(); } else chunks.push(c); });
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      req.on('error', reject);
    });
    if (url.pathname === '/api/version' && req.method === 'GET') return send(200, { app: 'valesta', version: project.version, file: path.basename(project.file) });
    if (url.pathname === '/api/project' && req.method === 'GET') return send(200, { version: project.version, state: project.state });
    if (url.pathname === '/api/project' && req.method === 'PUT') {
      return readBody(80e6).then((raw) => {
        const body = JSON.parse(raw);
        if (body.base !== undefined && body.base !== project.version) return send(409, { version: project.version });
        const v = AppCore.validateState(body.state, DEFAULT_STATE);
        if (!v.ok) return send(400, { error: v.errors.join(' ') });
        project.state = v.state;
        touch();
        return send(200, { version: project.version });
      }).catch((e) => send(400, { error: e.message }));
    }
    if (url.pathname === '/mcp') {
      if (req.method !== 'POST') return send(405, { error: 'use POST' }, null, { Allow: 'POST' });
      return readBody(10e6).then(async (raw) => {
        const out = await handleRaw(raw);
        return out ? send(200, out) : send(202, null);
      }).catch((e) => send(400, err(null, -32700, e.message)));
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(405, { error: 'method not allowed' });
    const rel = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const file = path.resolve(WEB, '.' + rel);
    if (!file.startsWith(WEB + path.sep) || !TYPES[path.extname(file)] || !fs.existsSync(file) || !fs.statSync(file).isFile()) return send(404, 'Not found', 'text/plain; charset=utf-8');
    return send(200, fs.readFileSync(file), TYPES[path.extname(file)]);
  });
  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE' && attempt < 9) return startHttp(port + 1, attempt + 1);
    log('HTTP server not started:', e.message);
  });
  server.listen(port, '127.0.0.1', () => {
    httpUrl = `http://127.0.0.1:${port}/`;
    log(`web app and live sync: ${httpUrl}  ·  MCP over HTTP: ${httpUrl}mcp`);
  });
  return server;
}

if (require.main === module) {
  log(`Valesta MCP ${VERSION} · project: ${project.file}`);
  if (flag('--http')) {
    if (!fs.existsSync(path.join(WEB, 'index.html'))) log('warning: web app not found in', WEB);
    startHttp(Number(opt('--port', 8790)) || 8790);
  }
  if (!flag('--no-stdio')) startStdio();
}

module.exports = { handle, handleRaw, callTool, project, TOOL_LIST };
