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
/* Valesta — AI assistant (chat panel). Depends on Providers, AITools and the window.Valesta API of the editor.
 * It fills in the valuation with the AITools tools, attaches documents (PDF, images, Word, text), takes voice
 * dictation, uses the web search of the provider, and undoes the changes of a turn with one click.
 */
(function () {
  'use strict';
  const V = () => window.Valesta;
  const t = (k) => V().t(k);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const $ = (s, r) => (r || document).querySelector(s);
  const SKEY = 'valesta-ai';
  const KKEY = 'valesta-ai-keys';
  const MUTATING = new Set(['update_fields', 'add_comparable', 'update_comparable', 'remove_comparable', 'set_rooms', 'set_report_text']);
  const IC = {
    gear: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    close: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    clip: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21.4 11.1l-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/></svg>',
    mic: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M19 10a7 7 0 0 1-14 0M12 17v5"/></svg>',
    send: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h13M12 5l7 7-7 7"/></svg>',
    stop: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/></svg>',
  };

  const load = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } };
  let settings = Object.assign({ provider: 'anthropic', models: {}, baseUrl: 'http://localhost:11434/v1', effort: 'medium', web: true, redact: true, remember: false }, load(SKEY) || {});
  let keys = settings.remember ? load(KKEY) || {} : {};
  const sessionKeys = {};
  const keyOf = (p) => sessionKeys[p] || keys[p] || '';

  let panel = null;
  let history = [];
  let busy = false;
  let ctrl = null;
  let pending = [];
  let rec = null;
  let view = 'chat';
  let typingTimer = null;

  // ---------- configuration ----------
  function cfg() {
    const p = Providers.PRESETS[settings.provider] ? settings.provider : 'anthropic';
    return { provider: p, apiKey: keyOf(p), model: (settings.models[p] || '').trim() || Providers.PRESETS[p].model, baseUrl: p === 'compatible' ? settings.baseUrl : '', effort: settings.effort };
  }
  const configured = () => { const c = cfg(); return c.provider === 'compatible' ? !!c.baseUrl : !!c.apiKey; };
  function saveSettings() { store(SKEY, settings); if (settings.remember) store(KKEY, keys); else { try { localStorage.removeItem(KKEY); } catch (e) { /* ignore */ } } }

  // ---------- markdown-lite ----------
  function inline(s) {
    return s.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[^*\w])\*([^*\n]+)\*(?!\w)/g, '$1<i>$2</i>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>');
  }
  function md(text) {
    const lines = esc(text).split('\n');
    let html = '';
    let list = null;
    let para = [];
    let table = [];
    const flushPara = () => { if (para.length) { html += `<p>${inline(para.join('<br>'))}</p>`; para = []; } };
    const flushList = () => { if (list) { html += `<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list.tag}>`; list = null; } };
    const flushTable = () => {
      if (!table.length) return;
      const rows = table.filter((r) => !/^\|?\s*:?-{2,}/.test(r)).map((r) => r.replace(/^\||\|$/g, '').split('|').map((c) => inline(c.trim())));
      html += `<div class="tscroll"><table class="edt">${rows.map((r, i) => `<tr>${r.map((c) => (i ? `<td>${c}</td>` : `<th>${c}</th>`)).join('')}</tr>`).join('')}</table></div>`;
      table = [];
    };
    lines.forEach((ln) => {
      const l = ln.trimEnd();
      if (/^\s*\|.*\|\s*$/.test(l)) { flushPara(); flushList(); table.push(l.trim()); return; }
      flushTable();
      const ul = /^\s*[-*•]\s+(.*)$/.exec(l);
      const ol = /^\s*\d+[.)]\s+(.*)$/.exec(l);
      if (ul || ol) {
        flushPara();
        const tag = ul ? 'ul' : 'ol';
        if (!list || list.tag !== tag) { flushList(); list = { tag, items: [] }; }
        list.items.push((ul || ol)[1]);
        return;
      }
      if (/^#{1,4}\s+/.test(l)) { flushPara(); flushList(); html += `<p><b>${inline(l.replace(/^#{1,4}\s+/, ''))}</b></p>`; return; }
      if (!l.trim()) { flushPara(); flushList(); return; }
      flushList();
      para.push(l);
    });
    flushPara();
    flushList();
    flushTable();
    return html;
  }

  // ---------- DOM ----------
  function build() {
    panel = $('#ai-panel');
    const scrim = document.createElement('div');
    scrim.className = 'ai-scrim';
    scrim.addEventListener('click', close);
    document.body.appendChild(scrim);
    panel.setAttribute('role', 'dialog');
    panel.innerHTML = `<div class="ai-head"><h2><span class="ai-spark">✦</span> <span data-t="aiT"></span></h2><span class="ai-model" id="ai-model"></span><span class="grow"></span>
      <button type="button" class="btn btn-sm btn-icon" data-ai="new">${IC.plus}</button><button type="button" class="btn btn-sm btn-icon" data-ai="settings">${IC.gear}</button><button type="button" class="btn btn-sm btn-icon" data-ai="close">${IC.close}</button></div>
      <div class="ai-body" id="ai-body" aria-live="polite"></div><div class="ai-settings" id="ai-settings" hidden></div>
      <div class="ai-quick" id="ai-quick"></div><div class="ai-files" id="ai-files"></div>
      <div class="ai-compose" id="ai-compose"><button type="button" class="btn btn-icon" data-ai="attach">${IC.clip}</button><button type="button" class="btn btn-icon" data-ai="mic">${IC.mic}</button>
      <textarea id="ai-input" rows="1"></textarea><button type="button" class="btn btn-primary btn-icon" data-ai="send">${IC.send}</button></div>`;
    panel.addEventListener('click', onClick);
    const input = $('#ai-input');
    input.addEventListener('input', autosize);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); } });
    input.addEventListener('paste', (e) => { const files = Array.from((e.clipboardData && e.clipboardData.files) || []); if (files.length) { e.preventDefault(); addFiles(files); } });
    ['dragover', 'drop'].forEach((ev) => panel.addEventListener(ev, (e) => {
      if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes('Files')) return;
      e.preventDefault();
      e.stopPropagation();
      if (ev === 'drop') addFiles(e.dataTransfer.files);
    }));
    $('#file-ai').addEventListener('change', (e) => { addFiles(e.target.files); e.target.value = ''; });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.body.classList.contains('ai-open') && window.innerWidth < 1500) close(); });
  }
  function labels() {
    if (!panel) return;
    panel.setAttribute('aria-label', t('aiT'));
    panel.querySelectorAll('[data-t]').forEach((el) => { el.textContent = t(el.dataset.t); });
    const tips = { new: 'aiNewChat', settings: 'aiSettings', close: 'bClose', attach: 'aiAttach', mic: 'aiMic', send: busy ? 'aiStop' : 'aiSend' };
    panel.querySelectorAll('[data-ai]').forEach((b) => { const k = tips[b.dataset.ai]; if (k) { b.title = t(k); b.setAttribute('aria-label', t(k)); } });
    $('#ai-input').placeholder = t('aiPlaceholder');
    const c = cfg();
    $('#ai-model').textContent = configured() ? `${Providers.PRESETS[c.provider].label.replace(/ \/.*$/, '')} · ${c.model}` : '—';
    $('#ai-quick').innerHTML = (t('aiQuick') || []).map((q, i) => `<button type="button" class="ai-chip" data-ai="quick" data-i="${i}">${esc(q[0])}</button>`).join('');
    $('#ai-quick').hidden = view !== 'chat';
  }
  function autosize() { const a = $('#ai-input'); a.style.height = 'auto'; a.style.height = Math.min(160, a.scrollHeight) + 'px'; a.style.overflowY = a.scrollHeight > 160 ? 'auto' : 'hidden'; }
  const body = () => $('#ai-body');
  function scrollEnd() { const b = body(); b.scrollTop = b.scrollHeight; }
  function addBubble(cls, html) {
    const el = document.createElement('div');
    el.className = 'ai-msg ' + cls;
    el.innerHTML = html;
    const typing = $('.ai-typing', body());
    body().insertBefore(el, typing || null);
    scrollEnd();
    return el;
  }
  const addSys = (text) => addBubble('sys', esc(text));
  function addErr(e) {
    let m = String((e && e.message) || e);
    if (/Failed to fetch|NetworkError|Load failed|fetch not available/i.test(m)) {
      m += ' — ' + (cfg().provider === 'compatible' ? t('aiLocalHint') : t('aiNetHint'));
    }
    addBubble('err', esc(t('aiError')(m)));
  }
  function showTyping() {
    if ($('.ai-typing', body())) return;
    const el = document.createElement('div');
    el.className = 'ai-typing';
    const t0 = Date.now();
    el.innerHTML = `<i></i><i></i><i></i><span></span>`;
    body().appendChild(el);
    const upd = () => { const s = Math.round((Date.now() - t0) / 1000); el.querySelector('span').textContent = `${t('aiThinking')}${s > 2 ? ` ${s} s` : ''}`; };
    upd();
    typingTimer = setInterval(upd, 1000);
    scrollEnd();
  }
  function hideTyping() { clearInterval(typingTimer); const el = $('.ai-typing', body()); if (el) el.remove(); }
  function welcome() {
    body().innerHTML = '';
    if (!configured()) {
      const el = addBubble('bot', `<p>${esc(t('aiWelcome'))}</p><p><b>${esc(t('aiEmpty'))}</b></p><p><button type="button" class="btn btn-sm btn-primary" data-ai="settings">${IC.gear} ${esc(t('aiSettings'))}</button></p><p class="hint" style="margin:6px 0 0">${esc(t('aiSubHint'))}</p>`);
      el.classList.add('welcome');
    } else addBubble('bot', `<p>${esc(t('aiWelcome'))}</p>`);
  }
  function updateComposer() {
    const b = panel.querySelector('[data-ai="send"]');
    b.innerHTML = busy ? IC.stop : IC.send;
    b.classList.toggle('btn-danger', busy);
    labels();
  }

  // ---------- settings view ----------
  // Where the chosen provider is based, so the user knows when data leave the European Economic Area.
  const EEA = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'IS', 'LI', 'NO'];
  function seatNote(c) {
    const P = Providers.PRESETS;
    let seat = P[c.provider] && P[c.provider].seat;
    if (c.provider === 'compatible') { const b = (P.compatible.baseUrls || []).find((x) => x[1] === String(settings.baseUrl || '').trim()); seat = b ? b[2] : ''; }
    if (seat === 'local') return t('aiSeatLocal');
    if (!seat) return t('aiSeatUnknown');
    let place = seat;
    try { place = new Intl.DisplayNames([V().uiLang()], { type: 'region' }).of(seat); } catch (e) { /* keep the code */ }
    return t('aiSeat')(place, !EEA.includes(seat));
  }
  function renderSettings() {
    const c = cfg();
    const P = Providers.PRESETS;
    const pr = P[c.provider];
    const opt = (v, l, sel) => `<option value="${esc(v)}"${sel ? ' selected' : ''}>${esc(l)}</option>`;
    $('#ai-settings').innerHTML = `
      <label class="fld"><span>${esc(t('aiProvider'))}</span><select data-set="provider">${Object.keys(P).map((k) => opt(k, P[k].label, k === c.provider)).join('')}</select></label>
      <p class="ai-note">${esc(seatNote(c))}</p>
      ${c.provider !== 'compatible' ? `<label class="fld"><span>${esc(t('aiKey'))}${pr.keyUrl ? ` · <a href="${esc(pr.keyUrl)}" target="_blank" rel="noopener noreferrer">${esc(t('aiKeyGet'))}</a>` : ''}</span><input type="password" data-set="key" value="${esc(c.apiKey)}" autocomplete="off" spellcheck="false"></label>
        <label class="chk"><input type="checkbox" data-set="remember"${settings.remember ? ' checked' : ''}><span>${esc(t('aiRemember'))} <em>${esc(t('aiRememberNote'))}</em></span></label>`
        : `<label class="fld"><span>${esc(t('aiBaseUrl'))}</span><input type="url" data-set="baseUrl" value="${esc(settings.baseUrl)}" list="ai-base-urls" spellcheck="false"><datalist id="ai-base-urls">${pr.baseUrls.map((b) => `<option value="${esc(b[1])}">${esc(b[0])}</option>`).join('')}</datalist></label>
        <label class="fld"><span>${esc(t('aiKey'))} (${esc(t('aiProvider'))} cloud)</span><input type="password" data-set="key" value="${esc(c.apiKey)}" autocomplete="off" spellcheck="false"></label>
        <label class="chk"><input type="checkbox" data-set="remember"${settings.remember ? ' checked' : ''}><span>${esc(t('aiRemember'))} <em>${esc(t('aiRememberNote'))}</em></span></label>`}
      <label class="fld"><span>${esc(t('aiModel'))}</span><input type="text" data-set="model" value="${esc(settings.models[c.provider] || '')}" placeholder="${esc(pr.model)}" list="ai-models" spellcheck="false"><datalist id="ai-models">${pr.models.map((m) => `<option value="${esc(m)}"></option>`).join('')}</datalist></label>
      ${c.provider === 'anthropic' ? `<label class="fld"><span>${esc(t('aiEffort'))}</span><select data-set="effort">${['low', 'medium', 'high'].map((k) => opt(k, t('aiEfforts')[k], settings.effort === k)).join('')}</select></label>` : ''}
      <label class="chk"><input type="checkbox" data-set="web"${settings.web && pr.search !== 'none' ? ' checked' : ''}${pr.search === 'none' ? ' disabled' : ''}><span>${esc(t('aiWeb'))}</span></label>
      <label class="chk"><input type="checkbox" data-set="redact"${settings.redact ? ' checked' : ''}><span>${esc(t('aiRedact'))}</span></label>
      <label class="chk"><input type="checkbox" data-set="geodata"${load('valesta-geodata') ? ' checked' : ''}><span>${esc(t('aiGeodata'))}</span></label>
      <p class="ai-note">${esc(t('aiGeodataHint'))}</p>
      <div class="row-actions"><button type="button" class="btn btn-sm" data-ai="test">${esc(t('aiTest'))}</button><span id="ai-test" class="hint" style="margin:0"></span><span class="grow"></span><button type="button" class="btn btn-sm btn-primary" data-ai="done">OK</button></div>
      <p class="ai-note">${esc(t('aiPrivacy'))}</p>
      ${c.provider === 'compatible' ? `<p class="ai-note">${esc(t('aiLocalHint'))}</p>` : ''}
      <p class="ai-note">${esc(t('aiSubHint'))}</p>`;
    $('#ai-settings').oninput = $('#ai-settings').onchange = (e) => {
      const el = e.target;
      const k = el.dataset.set;
      if (!k) return;
      if (k === 'provider') { settings.provider = el.value; history = []; saveSettings(); renderSettings(); labels(); return; }
      if (k === 'key') { sessionKeys[cfg().provider] = el.value.trim(); if (settings.remember) keys[cfg().provider] = el.value.trim(); }
      else if (k === 'remember') { settings.remember = el.checked; keys = el.checked ? Object.assign({}, keys, sessionKeys) : {}; }
      else if (k === 'model') settings.models[cfg().provider] = el.value.trim();
      else if (k === 'baseUrl') settings.baseUrl = el.value.trim();
      else if (k === 'effort') settings.effort = el.value;
      else if (k === 'web' || k === 'redact') settings[k] = el.checked;
      else if (k === 'geodata') { if (el.checked) store('valesta-geodata', { accepted: new Date().toISOString() }); else { try { localStorage.removeItem('valesta-geodata'); } catch (e) { /* ignore */ } } }
      saveSettings();
      labels();
    };
  }
  function showView(v) {
    view = v;
    $('#ai-settings').hidden = v !== 'settings';
    body().hidden = v !== 'chat';
    $('#ai-compose').hidden = v !== 'chat';
    $('#ai-files').hidden = v !== 'chat';
    if (v === 'settings') renderSettings();
    labels();
  }
  async function testConnection() {
    const out = $('#ai-test');
    out.textContent = '…';
    try {
      const r = await Providers.call(Object.assign({}, cfg(), { fetch: window.fetch.bind(window) }), { system: 'Reply with the single word OK.', messages: [{ role: 'user', parts: [{ type: 'text', text: 'ping' }] }], tools: [] });
      out.textContent = `${t('aiTestOk')} ${r.message.text ? '«' + r.message.text.slice(0, 40) + '»' : ''}`;
    } catch (e) { out.textContent = t('aiError')(e.message || e); }
  }

  // ---------- attachments ----------
  const b64 = (file) => new Promise((resolve, reject) => { const rd = new FileReader(); rd.onload = () => resolve(String(rd.result).split(',')[1] || ''); rd.onerror = reject; rd.readAsDataURL(file); });
  async function docxText(buf) {
    const u8 = new Uint8Array(buf);
    const dv = new DataView(buf);
    let eocd = -1;
    for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('not a zip file');
    const count = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    const dec = new TextDecoder();
    for (let k = 0; k < count && dv.getUint32(p, true) === 0x02014b50; k++) {
      const method = dv.getUint16(p + 10, true);
      const csize = dv.getUint32(p + 20, true);
      const nlen = dv.getUint16(p + 28, true);
      const elen = dv.getUint16(p + 30, true);
      const clen = dv.getUint16(p + 32, true);
      const lho = dv.getUint32(p + 42, true);
      const name = dec.decode(u8.subarray(p + 46, p + 46 + nlen));
      if (name === 'word/document.xml') {
        const start = lho + 30 + dv.getUint16(lho + 26, true) + dv.getUint16(lho + 28, true);
        const data = u8.subarray(start, start + csize);
        let xml;
        if (method === 0) xml = dec.decode(data);
        else if (typeof DecompressionStream === 'function') xml = dec.decode(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
        else throw new Error('DecompressionStream not supported');
        return xml.replace(/<w:tab\/>/g, '\t').replace(/<w:br\/>/g, '\n').replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, '')
          .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, '\'').replace(/&amp;/g, '&').replace(/\n{3,}/g, '\n\n').trim();
      }
      p += 46 + nlen + elen + clen;
    }
    throw new Error('word/document.xml not found');
  }
  async function addFiles(list) {
    for (const f of Array.from(list || [])) {
      const name = f.name || 'file';
      try {
        if (/^image\//.test(f.type) || /\.(jpe?g|png|webp|gif)$/i.test(name)) {
          const url = await V().compressImage(f, 1600, 0.85, false);
          pending.push({ kind: 'image', name, mime: 'image/jpeg', data: url.split(',')[1], dataUrl: url });
        } else if (f.type === 'application/pdf' || /\.pdf$/i.test(name)) {
          if (f.size > 25e6) { V().toast(t('aiFileTooBig')(name)); continue; }
          pending.push({ kind: 'file', name, mime: 'application/pdf', data: await b64(f) });
        } else {
          let text = null;
          if (/\.docx$/i.test(name)) text = await docxText(await f.arrayBuffer());
          else if (/^text\//.test(f.type) || /\.(txt|md|csv|tsv|json|xml|html?|eml)$/i.test(name)) {
            text = await f.text();
            if (/\.html?$/i.test(name)) text = text.replace(/<(script|style)[\s\S]*?<\/\1>/gi, '').replace(/<[^>]+>/g, ' ').replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n');
          }
          if (text == null) { V().toast(t('aiFileRead')(name)); continue; }
          if (text.length > 150000) { V().toast(t('aiFileTooBig')(name)); continue; }
          pending.push({ kind: 'text', name, text });
        }
      } catch (e) { V().toast(t('aiFileRead')(name)); }
    }
    renderPending();
  }
  function renderPending() {
    $('#ai-files').innerHTML = pending.map((p, i) => `<span class="ai-file">${p.kind === 'image' ? '🖼' : p.kind === 'file' ? '📄' : '📝'} ${esc(p.name)}<button type="button" data-ai="unfile" data-i="${i}" aria-label="${esc(t('del'))}">✕</button></span>`).join('');
  }

  // ---------- voice ----------
  function toggleMic() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const btn = panel.querySelector('[data-ai="mic"]');
    if (!SR) return V().toast(t('aiMicNo'));
    if (rec) { rec.stop(); return; }
    const input = $('#ai-input');
    const base = input.value ? input.value.replace(/\s*$/, ' ') : '';
    rec = new SR();
    rec.lang = (window.I18N && I18N.LOCALE && I18N.LOCALE[V().uiLang()]) || 'en-GB';
    rec.interimResults = true;
    rec.continuous = true;
    rec.onresult = (e) => {
      let text = '';
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      input.value = base + text;
      autosize();
    };
    rec.onerror = (e) => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') V().toast(t('aiMicNo')); };
    rec.onend = () => { rec = null; btn.classList.remove('rec'); input.placeholder = t('aiPlaceholder'); };
    try { rec.start(); btn.classList.add('rec'); input.placeholder = t('aiListening'); } catch (e) { rec = null; V().toast(t('aiMicNo')); }
  }

  // ---------- conversation ----------
  function send(preset) {
    if (busy) { if (ctrl) ctrl.abort(); return; }
    if (rec) rec.stop();
    const input = $('#ai-input');
    let text = (preset != null ? preset : input.value).trim();
    if (!text && !pending.length) return;
    if (!configured()) { showView('settings'); V().toast(t('aiNoKey')); return; }
    if (!text) text = t('aiQuick')[0][1];
    const files = pending;
    pending = [];
    renderPending();
    input.value = '';
    autosize();
    const parts = [];
    files.forEach((f) => {
      if (f.kind === 'image') parts.push({ type: 'image', mime: f.mime, data: f.data });
      else if (f.kind === 'file') parts.push({ type: 'file', mime: f.mime, name: f.name, data: f.data });
      else parts.push({ type: 'text', text: `--- ${f.name} ---\n${f.text}` });
    });
    parts.push({ type: 'text', text });
    const imgs = files.filter((f) => f.kind === 'image');
    const el = addBubble('user', md(text) + (files.length ? `<div class="ai-att">📎 ${files.map((f) => esc(f.name)).join(' · ')}</div>` : ''));
    if (imgs.length) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn btn-sm';
      b.style.marginTop = '6px';
      b.textContent = `＋ ${t('tabs').foto}`;
      b.onclick = () => {
        V().beginChange();
        imgs.forEach((im) => V().state.photos.push({ id: 'p' + Date.now() + Math.random().toString(36).slice(2, 6), dataUrl: im.dataUrl, caption: im.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '), cover: false }));
        V().commitChange();
        b.disabled = true;
      };
      el.appendChild(b);
    }
    runTurn(parts, text);
  }

  async function runTurn(parts, request) {
    const c = cfg();
    busy = true;
    ctrl = new AbortController();
    updateComposer();
    const signal = ctrl.signal;
    const fetchFn = (u, init) => window.fetch(u, Object.assign({}, init || {}, { signal }));
    const pc = Object.assign({}, c, { fetch: fetchFn });
    const web = !!settings.web && Providers.searchMode(c.provider) !== 'none';
    const env = { state: V().state, lang: V().reportLang(), uiLang: V().uiLang(), fetch: fetchFn, redact: settings.redact, geocoder: load('valesta-geocoder'), geodata: !!load('valesta-geodata'), search: (q) => Providers.search(pc, q) };
    const system = AITools.systemPrompt({ currency: window.I18N && I18N.currency ? I18N.currency() : 'EUR', uiLang: V().uiLang(), reportLang: V().reportLang(), today: new Date().toISOString().slice(0, 10), search: web ? Providers.searchMode(c.provider) : 'none' });
    const turn = { snap: null, changes: 0, tools: [], sources: [], foot: null, request: request || '', lastText: '' };
    history.push({ role: 'user', parts });
    try {
      for (let step = 0; step < 18; step++) {
        showTyping();
        const out = await Providers.call(pc, { system, messages: history, tools: AITools.TOOLS, webSearch: web });
        history.push(out.message);
        hideTyping();
        (out.message.sources || []).forEach((s) => turn.sources.push(s));
        if (out.message.text) { turn.lastText = out.message.text; addBubble('bot', md(out.message.text)); }
        if (out.stop === 'pause') continue;
        if (out.stop === 'refusal') { addSys(t('aiRefusal')); break; }
        if (!out.message.toolCalls.length) { if (out.stop === 'length') addSys(t('aiTruncated')); break; }
        const results = [];
        for (const call of out.message.toolCalls) {
          if (signal.aborted) { results.push({ id: call.id, name: call.name, content: '{"error":"stopped by the user"}', isError: true }); continue; }
          if (MUTATING.has(call.name) && !turn.snap) turn.snap = V().beginChange();
          env.state = V().state;
          env.lang = V().reportLang();
          const r = await AITools.execute(call.name, call.args, env);
          if (r.changed) {
            turn.changes += call.name === 'update_fields' || call.name === 'update_comparable' ? (r.result.applied || []).length : 1;
            V().commitChange();
          }
          turn.tools.push({ name: call.name, ok: r.ok });
          results.push({ id: call.id, name: call.name, content: JSON.stringify(r.result), isError: !r.ok });
          renderFoot(turn);
        }
        history.push({ role: 'tool', results });
        if (signal.aborted) throw new DOMException('aborted', 'AbortError');
      }
    } catch (e) {
      hideTyping();
      const last = history[history.length - 1];
      if (last && last.role === 'assistant' && last.toolCalls && last.toolCalls.length) {
        history.push({ role: 'tool', results: last.toolCalls.map((tc) => ({ id: tc.id, name: tc.name, content: '{"error":"interrupted"}', isError: true })) });
      }
      if (signal.aborted || (e && e.name === 'AbortError')) addSys(t('aiStopped')); else addErr(e);
    } finally {
      hideTyping();
      busy = false;
      ctrl = null;
      updateComposer();
      if (turn.snap && turn.changes && V().aiProposal) {
        const preset = Providers.PRESETS[c.provider];
        V().aiProposal({ before: JSON.parse(turn.snap.json), request: turn.request, summary: turn.lastText, sources: turn.sources,
          provider: preset ? preset.label.replace(/ \/.*$/, '') : c.provider, model: c.model });
      }
      renderFoot(turn, true);
    }
  }
  function renderFoot(turn, final) {
    if (!turn.tools.length && !(final && turn.sources.length)) return;
    if (!turn.foot) turn.foot = addBubble('bot foot', '');
    else if (final) body().appendChild(turn.foot);
    const names = t('aiTools') || {};
    const seen = {};
    const chips = turn.tools.filter((x) => { const k = x.name + x.ok; if (seen[k]) { seen[k]++; return false; } seen[k] = 1; return true; })
      .map((x) => `<span class="ai-tool ${x.ok ? 'ok' : 'ko'}">${esc(names[x.name] || x.name)}${seen[x.name + x.ok] > 1 ? ` ×${seen[x.name + x.ok]}` : ''}</span>`).join('');
    const urls = [];
    turn.sources.forEach((s) => { if (s.url && !urls.some((u) => u.url === s.url)) urls.push(s); });
    turn.foot.innerHTML = `<div class="ai-tools">${chips}</div>` +
      (final && turn.changes && turn.snap ? `<div class="ai-undo"><span class="hint" style="margin:0">${esc(t('aiChangesReview')(turn.changes))}</span></div>` : '') +
      (final && urls.length ? `<div class="ai-sources"><b>${esc(t('aiSources'))}</b>${urls.slice(0, 8).map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title || s.url)}</a>`).join('')}</div>` : '');
    scrollEnd();
  }

  // ---------- events ----------
  function onClick(e) {
    const b = e.target.closest('[data-ai]');
    if (!b) return;
    const a = b.dataset.ai;
    if (a === 'close') return close();
    if (a === 'settings') return showView(view === 'settings' ? 'chat' : 'settings');
    if (a === 'done') { showView('chat'); if (!history.length) welcome(); return; }
    if (a === 'new') { if (busy && ctrl) ctrl.abort(); history = []; pending = []; renderPending(); showView('chat'); welcome(); return; }
    if (a === 'attach') return $('#file-ai').click();
    if (a === 'mic') return toggleMic();
    if (a === 'send') return send();
    if (a === 'quick' && busy) return;
    if (a === 'quick') { const q = t('aiQuick')[+b.dataset.i]; if (q && (+b.dataset.i === 0) && !pending.length) { $('#ai-input').value = q[1]; autosize(); $('#file-ai').click(); return; } return send(q ? q[1] : ''); }
    if (a === 'unfile') { pending.splice(+b.dataset.i, 1); return renderPending(); }
    if (a === 'test') return testConnection();
  }
  // In the v2 shell the assistant lives in the AI tab of the context panel (window.ValestaShell).
  function open() {
    if (!panel) return;
    if (window.ValestaShell) window.ValestaShell.showAI(); else document.body.classList.add('ai-open');
    panel.setAttribute('aria-hidden', 'false');
    document.querySelectorAll('.mobile-bar [data-action="assistant"]').forEach((x) => x.classList.add('on'));
    labels();
    if (!body().children.length) welcome();
    if (!configured()) showView('settings');
    window.dispatchEvent(new Event('resize'));
    setTimeout(() => { const i = $('#ai-input'); if (i && view === 'chat' && window.innerWidth > 700) i.focus(); }, 60);
  }
  function close() {
    if (window.ValestaShell) window.ValestaShell.hideAI(); else document.body.classList.remove('ai-open');
    if (panel) panel.setAttribute('aria-hidden', 'true');
    document.querySelectorAll('.mobile-bar [data-action="assistant"]').forEach((x) => x.classList.remove('on'));
    window.dispatchEvent(new Event('resize'));
  }
  const toggle = () => ((window.ValestaShell ? window.ValestaShell.aiVisible() : document.body.classList.contains('ai-open')) ? close() : open());
  function ask(text) { open(); if (configured()) send(text); }

  window.ValestaAI = {
    init() { build(); labels(); welcome(); },
    open, close, toggle, ask,
    relabel() { labels(); if (!history.length && panel) welcome(); },
    _md: md,
  };
})();
