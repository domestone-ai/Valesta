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
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const { spawn } = require('child_process');

const SERVER = path.join(__dirname, '..', 'mcp', 'valesta-mcp.js');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'valesta-mcp-'));

function startStdio(extra) {
  const proj = path.join(tmp, `p${Date.now()}${Math.random().toString(36).slice(2, 6)}.json`);
  const args = [SERVER, '--project', proj].concat(extra || []);
  if (!args.includes('--projects')) args.push('--projects', path.join(tmp, 'Projects'));
  if (!args.includes('--reports')) args.push('--reports', path.join(tmp, 'Reports'));
  const child = spawn(process.execPath, args, { stdio: ['pipe', 'pipe', 'pipe'] });
  let buf = '';
  const waiters = new Map();
  child.stdout.on('data', (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i);
      buf = buf.slice(i + 1);
      const msg = JSON.parse(line);
      const w = waiters.get(msg.id);
      if (w) { waiters.delete(msg.id); w(msg); }
    }
  });
  let n = 0;
  const rpc = (method, params) => new Promise((resolve) => { const id = ++n; waiters.set(id, resolve); child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'); });
  const notify = (method, params) => child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n');
  return { child, rpc, notify, proj };
}
const toolJson = (r) => JSON.parse(r.result.content[0].text);

test('MCP stdio: initialize, list tools, read and edit the valuation, project saved to file', async () => {
  const s = startStdio();
  try {
    const init = await s.rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } });
    assert.equal(init.result.protocolVersion, '2025-06-18');
    assert.equal(init.result.serverInfo.name, 'valesta');
    assert.ok(init.result.capabilities.tools);
    s.notify('notifications/initialized', {});
    const list = await s.rpc('tools/list', {});
    const names = list.result.tools.map((t) => t.name);
    for (const n of ['get_valuation', 'update_fields', 'add_comparable', 'compute_valuation', 'review_valuation', 'project_info', 'report_export']) assert.ok(names.includes(n), n);
    assert.ok(!names.includes('web_search'), 'MCP clients use their own web search');
    list.result.tools.forEach((t) => assert.equal(t.inputSchema.type, 'object', t.name));
    const val = toolJson(await s.rpc('tools/call', { name: 'compute_valuation', arguments: {} }));
    assert.equal(val.value, 518000);
    const upd = await s.rpc('tools/call', { name: 'update_fields', arguments: { updates: [{ path: 'subject.areaBuilt', value: 120 }] } });
    assert.equal(upd.result.isError, false);
    const info = toolJson(await s.rpc('tools/call', { name: 'project_info', arguments: {} }));
    assert.ok(info.version >= 1);
    assert.ok(info.value > 518000, 'larger area, higher value');
    await new Promise((r) => setTimeout(r, 500));
    const saved = JSON.parse(fs.readFileSync(s.proj, 'utf8'));
    assert.equal(saved.subject.areaBuilt, 120);
    const bad = await s.rpc('tools/call', { name: 'update_fields', arguments: { updates: [{ path: 'brand.logoLight', value: 'x' }] } });
    assert.equal(bad.result.isError, true);
    const unknown = await s.rpc('no/such/method', {});
    assert.equal(unknown.error.code, -32601);
    const prompt = await s.rpc('prompts/get', { name: 'valesta_assistant', arguments: { language: 'it' } });
    assert.match(prompt.result.messages[0].content.text, /get_valuation/);
    const resource = await s.rpc('resources/read', { uri: 'valesta://project/current' });
    assert.ok(JSON.parse(resource.result.contents[0].text).result.value > 0);
  } finally { s.child.kill(); }
});

test('MCP stdio: report export writes a standalone HTML report', async () => {
  const s = startStdio();
  try {
    await s.rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {} });
    const out = toolJson(await s.rpc('tools/call', { name: 'report_export', arguments: { format: 'html', lang: 'en' } }));
    assert.ok(fs.existsSync(out.html));
    const html = fs.readFileSync(out.html, 'utf8');
    assert.match(html, /<html lang="en">/);
    assert.match(html, /fitPages/);
    assert.ok(out.pages >= 15);
  } finally { s.child.kill(); }
});

// An installed server (the layout of dist/mcp: the server next to lib/) keeps its projects in a folder next to mcp/.
function install() {
  const root = fs.mkdtempSync(path.join(tmp, 'inst-'));
  const lib = path.join(root, 'mcp', 'lib');
  fs.mkdirSync(path.join(lib, 'lang'), { recursive: true });
  const JS = path.join(__dirname, '..', 'src', 'js');
  for (const f of fs.readdirSync(JS)) if (f.endsWith('.js')) fs.copyFileSync(path.join(JS, f), path.join(lib, f));
  for (const f of fs.readdirSync(path.join(JS, 'lang'))) fs.copyFileSync(path.join(JS, 'lang', f), path.join(lib, 'lang', f));
  for (const f of ['fonts.css', 'fonts-cjk.css', 'report.css']) fs.copyFileSync(path.join(__dirname, '..', 'src', 'css', f), path.join(lib, f));
  fs.copyFileSync(SERVER, path.join(root, 'mcp', 'valesta-mcp.js'));
  return root;
}
async function listProjects(root) {
  const child = spawn(process.execPath, [path.join(root, 'mcp', 'valesta-mcp.js')], { stdio: ['pipe', 'pipe', 'pipe'] });
  let buf = '';
  const reply = new Promise((resolve) => child.stdout.on('data', (d) => {
    buf += d;
    const i = buf.indexOf('\n');
    if (i >= 0) resolve(JSON.parse(buf.slice(0, i)));
  }));
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'project_list', arguments: {} } }) + '\n');
  try { return toolJson(await reply); } finally { child.kill(); }
}

test('MCP: an installed server keeps the projects in the folder "Projects" next to the folder mcp', async () => {
  const root = install();
  const list = await listProjects(root);
  assert.equal(list.folder, path.join(root, 'Projects'));
  assert.equal(list.current, path.join(root, 'Projects', 'valesta-project.json'));
});

test('MCP: an installed server keeps using the folder "Progetti" of an earlier installation', async () => {
  const root = install();
  fs.mkdirSync(path.join(root, 'Progetti'));
  fs.writeFileSync(path.join(root, 'Progetti', 'valesta-progetto.json'), JSON.stringify(require('../src/js/data.js')));
  const list = await listProjects(root);
  assert.equal(list.folder, path.join(root, 'Progetti'));
  assert.equal(list.current, path.join(root, 'Progetti', 'valesta-progetto.json'));
});

function request(port, method, p, body, headers) {
  return new Promise((resolve, reject) => {
    const data = body == null ? null : typeof body === 'string' ? body : JSON.stringify(body);
    const req = http.request({ host: '127.0.0.1', port, method, path: p, headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {}) }, (res) => {
      let b = '';
      res.on('data', (c) => { b += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: b ? (() => { try { return JSON.parse(b); } catch (e) { return b; } })() : null }));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

test('MCP HTTP: live sync API with optimistic versioning, MCP over HTTP, host and origin checks', async () => {
  const port = 18790 + Math.floor(Math.random() * 500);
  const proj = path.join(tmp, 'http.json');
  const child = spawn(process.execPath, [SERVER, '--project', proj, '--http', '--port', String(port), '--no-stdio'], { stdio: ['ignore', 'ignore', 'pipe'] });
  try {
    await new Promise((resolve, reject) => {
      const to = setTimeout(() => reject(new Error('server did not start')), 8000);
      child.stderr.on('data', (d) => { if (/live sync/.test(String(d))) { clearTimeout(to); resolve(); } });
    });
    const v = await request(port, 'GET', '/api/version');
    assert.equal(v.status, 200);
    assert.equal(v.body.app, 'valesta');
    const p = await request(port, 'GET', '/api/project');
    assert.equal(p.body.state.subject.address, 'Calle de Ejemplo, 10');
    const st = p.body.state;
    st.subject.yearBuilt = 2001;
    const stale = await request(port, 'PUT', '/api/project', { base: p.body.version + 5, state: st });
    assert.equal(stale.status, 409);
    const ok = await request(port, 'PUT', '/api/project', { base: p.body.version, state: st });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.version, p.body.version + 1);
    const mcp = await request(port, 'POST', '/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'get_valuation', arguments: { include: ['subject'] } } }, { Accept: 'application/json, text/event-stream' });
    assert.equal(mcp.status, 200);
    assert.equal(JSON.parse(mcp.body.result.content[0].text).subject.yearBuilt, 2001);
    const noteOnly = await request(port, 'POST', '/mcp', { jsonrpc: '2.0', method: 'notifications/initialized' });
    assert.equal(noteOnly.status, 202);
    const evilHost = await request(port, 'GET', '/api/version', null, { Host: 'evil.example:80' });
    assert.equal(evilHost.status, 403);
    const evilOrigin = await request(port, 'GET', '/api/project', null, { Origin: 'https://evil.example' });
    assert.equal(evilOrigin.status, 403);
    const traversal = await request(port, 'GET', '/..%2f..%2fSource%2fbuild.py');
    assert.equal(traversal.status, 404);
  } finally { child.kill(); }
});

test('MCP stdio: agency profile library can be listed and applied', async () => {
  const s = startStdio();
  try {
    await s.rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {} });
    const list = toolJson(await s.rpc('tools/call', { name: 'profile_list', arguments: {} }));
    assert.deepEqual(list.profiles.map((p) => p.id), ['valesta', 'example-casa-aurora', 'example-mirador', 'example-nordic-homes']);
    const applied = await s.rpc('tools/call', { name: 'profile_apply', arguments: { id: 'example-nordic-homes' } });
    assert.equal(applied.result.isError, false);
    const v = toolJson(await s.rpc('tools/call', { name: 'get_valuation', arguments: { include: ['meta', 'design'] } }));
    assert.equal(v.meta.office.name, 'Nordic Homes — demo office');
    assert.equal(v.design.fontHead, 'Figtree');
    const bad = await s.rpc('tools/call', { name: 'profile_apply', arguments: { id: 'nope' } });
    assert.equal(bad.result.isError, true);
  } finally { s.child.kill(); }
});

test('MCP stdio: the report exports in every report language, Chinese and Russian included', async () => {
  const s = startStdio();
  try {
    await s.rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {} });
    const list = await s.rpc('tools/list', {});
    const exp = list.result.tools.find((t) => t.name === 'report_export');
    for (const l of ['fr', 'de', 'zh', 'ru']) assert.ok(exp.inputSchema.properties.lang.enum.includes(l), l);
    for (const l of ['zh', 'ru']) {
      const out = toolJson(await s.rpc('tools/call', { name: 'report_export', arguments: { format: 'html', lang: l } }));
      const html = fs.readFileSync(out.html, 'utf8');
      assert.match(html, new RegExp(`<html lang="${l}">`));
      assert.ok(html.includes(l === 'zh' ? '房地产估价报告' : 'Отчёт об оценке недвижимости'), `${l} texts`);
    }
  } finally { s.child.kill(); }
});


test('MCP: files and folders named by the assistant stay inside the Projects and Reports folders', async () => {
  const P = fs.mkdtempSync(path.join(tmp, 'proj-'));
  const Rd = fs.mkdtempSync(path.join(tmp, 'rep-'));
  const outside = fs.mkdtempSync(path.join(tmp, 'outside-'));
  const s = startStdio(['--projects', P, '--reports', Rd]);
  try {
    await s.rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {} });
    const call = (name, args) => s.rpc('tools/call', { name, arguments: args });
    // Outside: an absolute path elsewhere, a climb out of the folder.
    for (const file of [path.join(outside, 'x.json'), '../escape', path.join(P, '..', 'up.json')]) {
      assert.equal((await call('project_save', { file })).result.isError, true, `save ${file}`);
    }
    assert.deepEqual(fs.readdirSync(outside), []);
    assert.equal(fs.existsSync(path.join(path.dirname(P), 'escape.json')), false);
    assert.equal(fs.existsSync(path.join(path.dirname(P), 'up.json')), false);
    fs.writeFileSync(path.join(outside, 'o.json'), '{}');
    assert.equal((await call('project_open', { file: path.join(outside, 'o.json') })).result.isError, true, 'open outside');
    assert.equal((await call('project_new', { template: 'blank', file: path.join(outside, 'n.json') })).result.isError, true, 'new outside');
    assert.equal((await call('report_export', { format: 'html', lang: 'en', folder: outside })).result.isError, true, 'export outside');
    assert.equal((await call('report_export', { format: 'html', lang: 'en', folder: '../x' })).result.isError, true, 'export climbing out');
    assert.deepEqual(fs.readdirSync(outside), ['o.json']);
    // Inside: a name in the Projects folder, a subfolder of Reports.
    assert.equal((await call('project_save', { file: 'copy' })).result.isError, false);
    assert.ok(fs.existsSync(path.join(P, 'copy.json')));
    const ok = toolJson(await call('report_export', { format: 'html', lang: 'en', folder: 'client-a' }));
    assert.equal(path.dirname(ok.html), path.join(Rd, 'client-a'));
  } finally { s.child.kill(); }
});


test('MCP: the geocode tool sends nothing unless the server is started with --geocoder', async () => {
  const s = startStdio();
  try {
    await s.rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {} });
    const r = await s.rpc('tools/call', { name: 'geocode', arguments: { address: 'Calle de Ejemplo 10, Castelldefels' } });
    assert.equal(r.result.isError, true);
    assert.match(r.result.content[0].text, /address search is off/);
  } finally { s.child.kill(); }
});


test('MCP: by default the geodata tools send nothing and the client name stays out of what the assistant reads', async () => {
  const s = startStdio();
  try {
    await s.rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {} });
    const np = await s.rpc('tools/call', { name: 'nearby_places', arguments: {} });
    assert.equal(np.result.isError, true);
    assert.match(np.result.content[0].text, /geodata services are off/);
    const gv = await s.rpc('tools/call', { name: 'get_valuation', arguments: { include: ['meta'] } });
    assert.ok(!gv.result.content[0].text.includes('John Sample'));
  } finally { s.child.kill(); }
});
