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
// Drives a headless Chromium browser (Edge or Chrome) over the DevTools protocol, with no dependency: prints a page to
// a tagged PDF with bookmarks, takes screenshots and evaluates scripts. Node.js 22 or later (fetch and WebSocket).
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findBrowser() {
  const env = process.env.PAPER_BROWSER;
  const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const pf = process.env.ProgramFiles || 'C:\\Program Files';
  const list = [env, path.join(pf86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(pf, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(pf, 'Google', 'Chrome', 'Application', 'chrome.exe'), path.join(pf86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge'];
  const found = list.find((p) => p && fs.existsSync(p));
  if (!found) throw new Error('no Chromium browser found: set PAPER_BROWSER to its executable');
  return found;
}

const fileUrl = (p) => 'file:///' + path.resolve(p).replace(/\\/g, '/').replace(/^\/+/, '');

// withBrowser(async (page) => …): page.open(url), page.print(pdfOptions), page.shot(png, opts), page.eval(expr), page.send(method, params)
async function withBrowser(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'valesta-paper-'));
  const proc = spawn(findBrowser(), ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--hide-scrollbars', '--force-color-profile=srgb', `--user-data-dir=${dir}`, '--remote-debugging-port=0', 'about:blank'], { stdio: 'ignore' });
  let ws;
  try {
    let port;
    for (let t = 0; t < 200 && !port; t++) {
      const f = path.join(dir, 'DevToolsActivePort');
      try { if (fs.existsSync(f)) port = +fs.readFileSync(f, 'utf8').split('\n')[0]; } catch (e) { /* still being written */ }
      if (!port) await sleep(100);
    }
    if (!port) throw new Error('the browser did not open its DevTools port');
    let target;
    for (let t = 0; t < 50 && !target; t++) {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      target = list.find((x) => x.type === 'page');
      if (!target) await sleep(100);
    }
    ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
    let id = 0;
    const pending = new Map();
    const events = [];
    ws.onmessage = (m) => {
      const d = JSON.parse(m.data);
      if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } else events.push(d);
    };
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const i = ++id;
      pending.set(i, (d) => (d.error ? reject(new Error(`${method}: ${d.error.message}`)) : resolve(d.result)));
      ws.send(JSON.stringify({ id: i, method, params }));
    });
    const waitEvent = async (name, ms = 30000) => {
      for (let t = 0; t < ms / 25; t++) {
        const k = events.findIndex((e) => e.method === name);
        if (k >= 0) return events.splice(k, 1)[0];
        await sleep(25);
      }
      throw new Error(`timeout waiting for ${name}`);
    };
    await send('Page.enable');
    await send('Runtime.enable');
    const evaluate = async (expression) => {
      const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error('page script: ' + (r.exceptionDetails.exception ? r.exceptionDetails.exception.description : r.exceptionDetails.text));
      return r.result.value;
    };
    const page = {
      send,
      eval: evaluate,
      async open(url, viewport) {
        if (viewport) await send('Emulation.setDeviceMetricsOverride', { width: viewport.width, height: viewport.height || 900, deviceScaleFactor: viewport.scale || 1, mobile: !!viewport.mobile });
        events.length = 0;
        await send('Page.navigate', { url: /^[a-z]+:/i.test(url) && !/^[a-z]:\\/i.test(url) ? url : fileUrl(url) });
        await waitEvent('Page.loadEventFired');
        // every font face is loaded before measuring or printing, even those not yet used, so that two prints of the
        // same page always lay it out the same way
        await evaluate('Promise.all([...document.fonts].map((f) => f.load().catch(() => null))).then(() => document.fonts.ready)'
          + '.then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))))');
      },
      async print(out, opts = {}) {
        const r = await send('Page.printToPDF', Object.assign({ printBackground: true, preferCSSPageSize: true, generateTaggedPDF: true,
          generateDocumentOutline: true, displayHeaderFooter: false, transferMode: 'ReturnAsBase64' }, opts));
        fs.writeFileSync(out, Buffer.from(r.data, 'base64'));
        return out;
      },
      async shot(out, opts = {}) {
        const r = await send('Page.captureScreenshot', Object.assign({ format: 'png', captureBeyondViewport: true }, opts));
        fs.writeFileSync(out, Buffer.from(r.data, 'base64'));
        return out;
      },
    };
    return await fn(page);
  } finally {
    try { if (ws) ws.close(); } catch (e) { /* closed */ }
    proc.kill();
    await sleep(400);
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* the browser may still hold a file */ }
  }
}

module.exports = { withBrowser, fileUrl, findBrowser };
