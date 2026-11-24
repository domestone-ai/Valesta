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
/* Providers — HTTP adapters for language models (no external library; fetch is injected).
 * Anthropic Claude (Messages API), OpenAI (Responses API), Google Gemini (generateContent) and any
 * OpenAI-compatible server (Ollama, LM Studio, OpenRouter, Mistral, Groq…: Chat Completions).
 * Neutral message format:
 *   { role:'user', parts:[{type:'text',text} | {type:'image',mime,data} | {type:'file',mime,name,data}] }
 *   { role:'assistant', provider, text, toolCalls:[{id,name,args}], raw }   (raw = native content to send back)
 *   { role:'tool', results:[{id,name,content,isError}] }
 * call(cfg, {system, messages, tools, webSearch}) → { message, stop: 'end'|'tool'|'pause'|'refusal'|'length', usage }
 */
(function (root, factory) {
  const mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else root.Providers = mod;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const PRESETS = {
    anthropic: { label: 'Anthropic Claude', seat: 'US', model: 'claude-opus-5-5', models: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-fable-5-2'], keyUrl: 'https://platform.claude.com/settings/keys', search: 'native', files: true },
    openai: { label: 'OpenAI', seat: 'US', model: 'gpt-5.1', models: ['gpt-5.1', 'gpt-5-mini', 'gpt-4.1'], keyUrl: 'https://platform.openai.com/api-keys', search: 'native', files: true },
    gemini: { label: 'Google Gemini', seat: 'US', model: 'gemini-2.5-flash', models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-3-pro-preview'], keyUrl: 'https://aistudio.google.com/apikey', search: 'tool', files: true },
    compatible: { label: 'OpenAI-compatible / local', model: 'qwen2.5:14b', models: [], keyUrl: '', search: 'none', files: false,
      // [name, address, seat]: 'local' = on the user's computer.
      baseUrls: [['Ollama', 'http://localhost:11434/v1', 'local'], ['LM Studio', 'http://localhost:1234/v1', 'local'], ['OpenRouter', 'https://openrouter.ai/api/v1', 'US'], ['Mistral', 'https://api.mistral.ai/v1', 'FR'], ['Groq', 'https://api.groq.com/openai/v1', 'US']] },
  };
  const searchMode = (provider) => (PRESETS[provider] || {}).search || 'none';
  const trimSlash = (u) => String(u || '').replace(/\/+$/, '');
  const safeJson = (s, d) => { try { return JSON.parse(s); } catch (e) { return d; } };

  async function post(fetch, url, headers, body) {
    if (typeof fetch !== 'function') throw new Error('fetch not available');
    const r = await fetch(url, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, headers), body: JSON.stringify(body) });
    let data;
    try { data = await r.json(); } catch (e) { data = null; }
    if (!r.ok) {
      const msg = (data && data.error && (data.error.message || data.error)) || (data && data.message) || `HTTP ${r.status}`;
      throw new Error(`${r.status}: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`);
    }
    return data || {};
  }
  // Tools that need an app-side backend ("optional") are offered only when that backend exists.
  const fnTools = (tools, keepSearch) => (tools || []).filter((t) => !(t.optional === 'search' && !keepSearch));

  // ---------- Anthropic (Messages API, direct browser access) ----------
  const DYNAMIC_SEARCH = /^claude-(fable|mythos|opus-5|opus-4-[678]|sonnet-5|sonnet-4-6)/;
  const EFFORT = /^claude-(fable|mythos|opus-[45]|sonnet-5|sonnet-4-6|haiku-5)/;
  const FALLBACKS = /^claude-(fable-5-[12]|opus-5|opus-5-5|sonnet-5-5)$/;
  function anthropicContent(parts) {
    const files = [];
    const rest = [];
    (parts || []).forEach((p) => {
      if (p.type === 'file' && p.mime === 'application/pdf') files.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: p.data }, title: p.name });
      else if (p.type === 'image') files.push({ type: 'image', source: { type: 'base64', media_type: p.mime, data: p.data } });
      else if (p.type === 'text' && p.text) rest.push({ type: 'text', text: p.text });
    });
    return files.concat(rest);
  }
  async function anthropic(cfg, req) {
    const model = cfg.model || PRESETS.anthropic.model;
    const tools = fnTools(req.tools, false).filter((t) => !(req.webSearch && t.name === 'web_search'))
      .map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters }));
    if (req.webSearch) {
      const dyn = DYNAMIC_SEARCH.test(model);
      tools.push({ type: dyn ? 'web_search_20260209' : 'web_search_20250305', name: 'web_search', max_uses: 8 });
      tools.push({ type: dyn ? 'web_fetch_20260209' : 'web_fetch_20250910', name: 'web_fetch', max_uses: 8 });
    }
    const messages = [];
    (req.messages || []).forEach((m) => {
      if (m.role === 'user') messages.push({ role: 'user', content: anthropicContent(m.parts) });
      else if (m.role === 'assistant') messages.push({ role: 'assistant', content: m.raw || [{ type: 'text', text: m.text || '' }] });
      else if (m.role === 'tool') messages.push({ role: 'user', content: m.results.map((r) => Object.assign({ type: 'tool_result', tool_use_id: r.id, content: String(r.content) }, r.isError ? { is_error: true } : {})) });
    });
    const body = { model, max_tokens: 16000, system: req.system, messages };
    if (tools.length) body.tools = tools;
    if (EFFORT.test(model)) body.output_config = { effort: cfg.effort || 'medium' };
    const headers = { 'x-api-key': cfg.apiKey || '', 'anthropic-version': '2026-10-21', 'anthropic-dangerous-direct-browser-access': 'true' };
    const url = (trimSlash(cfg.baseUrl) || 'https://api.anthropic.com') + '/v1/messages';
    let data;
    if (FALLBACKS.test(model)) {
      // Server-side refusal fallbacks (beta): if this account does not accept them, the request is repeated once without.
      try {
        data = await post(cfg.fetch, url, Object.assign({}, headers, { 'anthropic-beta': 'server-side-fallback-2026-07-01' }), Object.assign({}, body, { fallbacks: 'default' }));
      } catch (e) {
        if (!/^400:.*fallback/i.test(e.message)) throw e;
      }
    }
    if (!data) data = await post(cfg.fetch, url, headers, body);
    const content = Array.isArray(data.content) ? data.content : [];
    const text = content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    const toolCalls = content.filter((b) => b.type === 'tool_use').map((b) => ({ id: b.id, name: b.name, args: b.input || {} }));
    const sr = data.stop_reason;
    const stop = sr === 'tool_use' ? 'tool' : sr === 'pause_turn' ? 'pause' : sr === 'refusal' ? 'refusal' : sr === 'max_tokens' ? 'length' : toolCalls.length ? 'tool' : 'end';
    const sources = [];
    content.filter((b) => b.type === 'web_search_tool_result' && Array.isArray(b.content)).forEach((b) => b.content.forEach((x) => { if (x.url) sources.push({ title: x.title || x.url, url: x.url }); }));
    return { message: { role: 'assistant', provider: 'anthropic', text, toolCalls, raw: content, sources }, stop, usage: data.usage || null };
  }

  // ---------- OpenAI (Responses API, stateless: store=false, replay of output items) ----------
  async function openai(cfg, req) {
    const model = cfg.model || PRESETS.openai.model;
    const tools = fnTools(req.tools, false).filter((t) => !(req.webSearch && t.name === 'web_search'))
      .map((t) => ({ type: 'function', name: t.name, description: t.description, parameters: t.parameters, strict: false }));
    if (req.webSearch) tools.push({ type: 'web_search' });
    const input = [];
    (req.messages || []).forEach((m) => {
      if (m.role === 'user') {
        input.push({ role: 'user', content: (m.parts || []).map((p) => {
          if (p.type === 'text') return { type: 'input_text', text: p.text };
          if (p.type === 'image') return { type: 'input_image', image_url: `data:${p.mime};base64,${p.data}` };
          if (p.type === 'file') return { type: 'input_file', filename: p.name || 'document.pdf', file_data: `data:${p.mime};base64,${p.data}` };
          return null;
        }).filter(Boolean) });
      } else if (m.role === 'assistant') (m.raw || [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: m.text || '' }] }]).forEach((it) => input.push(it));
      else if (m.role === 'tool') m.results.forEach((r) => input.push({ type: 'function_call_output', call_id: r.id, output: String(r.content) }));
    });
    const body = { model, instructions: req.system, input, store: false };
    if (tools.length) body.tools = tools;
    if (/^(o\d|gpt-5)/.test(model)) body.include = ['reasoning.encrypted_content'];
    const data = await post(cfg.fetch, (trimSlash(cfg.baseUrl) || 'https://api.openai.com/v1') + '/responses', { Authorization: `Bearer ${cfg.apiKey || ''}` }, body);
    const output = Array.isArray(data.output) ? data.output : [];
    const text = output.filter((o) => o.type === 'message').map((o) => (o.content || []).filter((c) => c.type === 'output_text').map((c) => c.text).join('')).join('\n').trim();
    const toolCalls = output.filter((o) => o.type === 'function_call').map((o) => ({ id: o.call_id, name: o.name, args: safeJson(o.arguments, {}) }));
    const sources = [];
    output.filter((o) => o.type === 'message').forEach((o) => (o.content || []).forEach((c) => (c.annotations || []).forEach((a) => { if (a.url) sources.push({ title: a.title || a.url, url: a.url }); })));
    const stop = toolCalls.length ? 'tool' : data.status === 'incomplete' ? 'length' : 'end';
    return { message: { role: 'assistant', provider: 'openai', text, toolCalls, raw: output, sources }, stop, usage: data.usage || null };
  }

  // ---------- Google Gemini (generateContent; search runs as a separate grounded call) ----------
  function geminiSchema(s) {
    if (!s || typeof s !== 'object') return { type: 'STRING' };
    if (!s.type || (s.type === 'object' && !(s.properties && Object.keys(s.properties).length))) {
      return { type: 'STRING', description: `${s.description ? s.description + ' — ' : ''}JSON value (numbers, true/false, arrays or objects as JSON text)` };
    }
    const out = { type: String(s.type).toUpperCase() };
    if (s.description) out.description = s.description;
    if (Array.isArray(s.enum)) out.enum = s.enum.filter((x) => typeof x === 'string' && x !== '');
    if (out.enum && !out.enum.length) delete out.enum;
    if (s.type === 'object') {
      out.properties = {};
      Object.keys(s.properties).forEach((k) => { out.properties[k] = geminiSchema(s.properties[k]); });
      if (Array.isArray(s.required) && s.required.length) out.required = s.required.filter((k) => k in out.properties);
    }
    if (s.type === 'array') out.items = geminiSchema(s.items);
    return out;
  }
  const geminiUrl = (cfg, model, method) => `${trimSlash(cfg.baseUrl) || 'https://generativelanguage.googleapis.com/v1beta'}/models/${model}:${method}`;
  async function gemini(cfg, req) {
    const model = cfg.model || PRESETS.gemini.model;
    const decl = fnTools(req.tools, !!req.webSearch).map((t) => ({ name: t.name, description: t.description, parameters: geminiSchema(t.parameters) }));
    const contents = [];
    let native = {};
    (req.messages || []).forEach((m) => {
      if (m.role === 'user') {
        contents.push({ role: 'user', parts: (m.parts || []).map((p) => (p.type === 'text' ? { text: p.text } : p.type === 'image' || p.type === 'file' ? { inlineData: { mimeType: p.mime, data: p.data } } : null)).filter(Boolean) });
      } else if (m.role === 'assistant') {
        contents.push(m.raw || { role: 'model', parts: [{ text: m.text || '' }] });
        native = {};
        (m.toolCalls || []).forEach((c) => { native[c.id] = c.nativeId || null; });
      } else if (m.role === 'tool') {
        contents.push({ role: 'user', parts: m.results.map((r) => {
          const parsed = safeJson(r.content, null);
          const response = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : { result: parsed != null ? parsed : String(r.content) };
          const fr = { name: r.name, response };
          if (native[r.id]) fr.id = native[r.id];
          return { functionResponse: fr };
        }) });
      }
    });
    const body = { systemInstruction: { parts: [{ text: req.system }] }, contents };
    if (decl.length) body.tools = [{ functionDeclarations: decl }];
    const data = await post(cfg.fetch, geminiUrl(cfg, model, 'generateContent'), { 'x-goog-api-key': cfg.apiKey || '' }, body);
    const cand = (data.candidates || [])[0] || {};
    const content = cand.content || { role: 'model', parts: [] };
    const parts = content.parts || [];
    const text = parts.filter((p) => p.text && !p.thought).map((p) => p.text).join('\n').trim();
    const toolCalls = parts.filter((p) => p.functionCall).map((p, i) => ({ id: p.functionCall.id || `${p.functionCall.name}-${contents.length}-${i}`, nativeId: p.functionCall.id || null, name: p.functionCall.name, args: p.functionCall.args || {} }));
    const fr = cand.finishReason;
    const stop = toolCalls.length ? 'tool' : fr === 'MAX_TOKENS' ? 'length' : /SAFETY|RECITATION|PROHIBITED|BLOCKLIST/.test(fr || '') ? 'refusal' : 'end';
    return { message: { role: 'assistant', provider: 'gemini', text, toolCalls, raw: { role: 'model', parts }, sources: [] }, stop, usage: data.usageMetadata || null };
  }
  async function geminiSearch(cfg, query) {
    const model = cfg.model || PRESETS.gemini.model;
    const body = { contents: [{ role: 'user', parts: [{ text: `${query}\n\nAnswer with the facts found (prices, sizes, addresses, dates) and keep the source of each.` }] }], tools: [{ google_search: {} }] };
    const data = await post(cfg.fetch, geminiUrl(cfg, model, 'generateContent'), { 'x-goog-api-key': cfg.apiKey || '' }, body);
    const cand = (data.candidates || [])[0] || {};
    const answer = ((cand.content && cand.content.parts) || []).filter((p) => p.text).map((p) => p.text).join('\n').trim();
    const chunks = (cand.groundingMetadata && cand.groundingMetadata.groundingChunks) || [];
    return { answer, sources: chunks.filter((c) => c.web && c.web.uri).map((c) => ({ title: c.web.title || c.web.uri, url: c.web.uri })) };
  }

  // ---------- OpenAI-compatible servers (Chat Completions) ----------
  async function compatible(cfg, req) {
    const model = cfg.model || PRESETS.compatible.model;
    const tools = fnTools(req.tools, false).map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }));
    const messages = [{ role: 'system', content: req.system }];
    (req.messages || []).forEach((m) => {
      if (m.role === 'user') {
        const parts = (m.parts || []).map((p) => {
          if (p.type === 'text') return { type: 'text', text: p.text };
          if (p.type === 'image') return { type: 'image_url', image_url: { url: `data:${p.mime};base64,${p.data}` } };
          if (p.type === 'file') return { type: 'text', text: `[Attached file "${p.name || 'document'}" (${p.mime}) cannot be read by this model: ask the user to paste its text.]` };
          return null;
        }).filter(Boolean);
        messages.push({ role: 'user', content: parts.every((p) => p.type === 'text') ? parts.map((p) => p.text).join('\n\n') : parts });
      } else if (m.role === 'assistant') messages.push(m.raw || { role: 'assistant', content: m.text || '' });
      else if (m.role === 'tool') m.results.forEach((r) => messages.push({ role: 'tool', tool_call_id: r.id, content: String(r.content) }));
    });
    const body = { model, messages };
    if (tools.length) { body.tools = tools; body.tool_choice = 'auto'; }
    const headers = cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {};
    const data = await post(cfg.fetch, (trimSlash(cfg.baseUrl) || 'http://localhost:11434/v1') + '/chat/completions', headers, body);
    const ch = (data.choices || [])[0] || {};
    const msg = ch.message || { role: 'assistant', content: '' };
    const toolCalls = (msg.tool_calls || []).map((c) => ({ id: c.id, name: c.function && c.function.name, args: typeof (c.function && c.function.arguments) === 'string' ? safeJson(c.function.arguments, {}) : (c.function && c.function.arguments) || {} }));
    const raw = { role: 'assistant', content: msg.content || '' };
    if (msg.tool_calls && msg.tool_calls.length) raw.tool_calls = msg.tool_calls;
    const stop = toolCalls.length ? 'tool' : ch.finish_reason === 'length' ? 'length' : 'end';
    return { message: { role: 'assistant', provider: 'compatible', text: String(msg.content || '').trim(), toolCalls, raw, sources: [] }, stop, usage: data.usage || null };
  }

  function call(cfg, req) {
    const p = cfg && cfg.provider;
    if (p === 'anthropic') return anthropic(cfg, req);
    if (p === 'openai') return openai(cfg, req);
    if (p === 'gemini') return gemini(cfg, req);
    if (p === 'compatible') return compatible(cfg, req);
    return Promise.reject(new Error('unknown provider ' + p));
  }
  const search = (cfg, query) => (cfg && cfg.provider === 'gemini' ? geminiSearch(cfg, query) : Promise.resolve(null));

  return { PRESETS, call, search, searchMode, geminiSchema };
});
