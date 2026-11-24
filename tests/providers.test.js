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
const Providers = require('../src/js/providers.js');

const TOOLS = [
  { name: 'update_fields', description: 'Set fields by path', parameters: { type: 'object', properties: { updates: { type: 'array', items: { type: 'object', properties: { path: { type: 'string' }, value: { description: 'any' } }, required: ['path', 'value'] } } }, required: ['updates'] } },
  { name: 'web_search', optional: 'search', description: 'Search the web', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
];
const USER = { role: 'user', parts: [{ type: 'file', mime: 'application/pdf', name: 'nota.pdf', data: 'JVBERi0x' }, { type: 'image', mime: 'image/jpeg', data: '/9j/AAA' }, { type: 'text', text: 'Compila i dati' }] };
function mock(response, status) {
  const calls = [];
  const fetch = async (url, init) => { calls.push({ url, init, body: JSON.parse(init.body) }); return { ok: (status || 200) < 400, status: status || 200, json: async () => response, text: async () => JSON.stringify(response) }; };
  return { fetch, calls };
}

test('Anthropic: Messages API request with tools, native web search, fallbacks and browser access header', async () => {
  const m = mock({ stop_reason: 'tool_use', content: [{ type: 'text', text: 'Aggiorno.' }, { type: 'tool_use', id: 'toolu_1', name: 'update_fields', input: { updates: [{ path: 'subject.yearBuilt', value: 1999 }] } }] });
  const out = await Providers.call({ provider: 'anthropic', apiKey: 'sk-ant-x', fetch: m.fetch }, { system: 'SYS', messages: [USER], tools: TOOLS, webSearch: true });
  const c = m.calls[0];
  assert.equal(c.url, 'https://api.anthropic.com/v1/messages');
  assert.equal(c.init.headers['x-api-key'], 'sk-ant-x');
  assert.equal(c.init.headers['anthropic-version'], '2026-10-21');
  assert.equal(c.init.headers['anthropic-dangerous-direct-browser-access'], 'true');
  assert.equal(c.init.headers['anthropic-beta'], 'server-side-fallback-2026-07-01');
  assert.equal(c.body.model, 'claude-opus-5-5');
  assert.equal(c.body.fallbacks, 'default');
  assert.equal(c.body.system, 'SYS');
  assert.equal(c.body.temperature, undefined);
  assert.ok(c.body.tools.some((t) => t.type === 'web_search_20260209' && t.name === 'web_search'));
  assert.ok(c.body.tools.some((t) => t.name === 'update_fields' && t.input_schema.type === 'object'));
  assert.equal(c.body.tools.filter((t) => t.name === 'web_search').length, 1, 'native search replaces the function tool');
  const blocks = c.body.messages[0].content;
  assert.equal(blocks[0].type, 'document');
  assert.equal(blocks[1].type, 'image');
  assert.equal(blocks[2].type, 'text');
  assert.equal(out.stop, 'tool');
  assert.equal(out.message.text, 'Aggiorno.');
  assert.deepEqual(out.message.toolCalls, [{ id: 'toolu_1', name: 'update_fields', args: { updates: [{ path: 'subject.yearBuilt', value: 1999 }] } }]);
  assert.equal(out.message.raw.length, 2);
});

test('Anthropic: history replays raw content, tool results go back in one user message, pause_turn is reported', async () => {
  const m = mock({ stop_reason: 'pause_turn', content: [{ type: 'server_tool_use', id: 'srv_1', name: 'web_search', input: { query: 'pisos Castelldefels centro' } }] });
  const assistant = { role: 'assistant', provider: 'anthropic', text: '', toolCalls: [{ id: 't1', name: 'a' }, { id: 't2', name: 'b' }], raw: [{ type: 'tool_use', id: 't1', name: 'a', input: {} }, { type: 'tool_use', id: 't2', name: 'b', input: {} }] };
  const tool = { role: 'tool', results: [{ id: 't1', name: 'a', content: '{"ok":true}' }, { id: 't2', name: 'b', content: 'boom', isError: true }] };
  const out = await Providers.call({ provider: 'anthropic', apiKey: 'k', model: 'claude-haiku-5-5', fetch: m.fetch }, { system: 'S', messages: [{ role: 'user', parts: [{ type: 'text', text: 'hi' }] }, assistant, tool], tools: TOOLS, webSearch: true });
  const msgs = m.calls[0].body.messages;
  assert.equal(msgs.length, 3);
  assert.deepEqual(msgs[1].content, assistant.raw);
  assert.equal(msgs[2].role, 'user');
  assert.equal(msgs[2].content.length, 2);
  assert.equal(msgs[2].content[1].is_error, true);
  assert.ok(m.calls[0].body.tools.some((t) => t.type === 'web_search_20250305'), 'basic search variant on models without dynamic filtering');
  assert.equal(m.calls[0].body.fallbacks, undefined);
  assert.equal(out.stop, 'pause');
});

test('OpenAI: Responses API with function tools, web search and stateless replay', async () => {
  const m = mock({ status: 'completed', output: [
    { type: 'reasoning', id: 'rs_1', encrypted_content: 'xx' },
    { type: 'function_call', call_id: 'call_1', name: 'update_fields', arguments: '{"updates":[{"path":"subject.floor","value":3}]}' },
    { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Fatto' }] },
  ] });
  const out = await Providers.call({ provider: 'openai', apiKey: 'sk-1', model: 'gpt-5.1', fetch: m.fetch }, { system: 'SYS', messages: [USER], tools: TOOLS, webSearch: true });
  const c = m.calls[0];
  assert.equal(c.url, 'https://api.openai.com/v1/responses');
  assert.equal(c.init.headers.Authorization, 'Bearer sk-1');
  assert.equal(c.body.instructions, 'SYS');
  assert.equal(c.body.store, false);
  assert.ok(c.body.tools.some((t) => t.type === 'web_search'));
  assert.ok(c.body.tools.some((t) => t.type === 'function' && t.name === 'update_fields'));
  assert.ok(!c.body.tools.some((t) => t.name === 'web_search' && t.type === 'function'));
  const parts = c.body.input[0].content;
  assert.deepEqual(parts.map((p) => p.type), ['input_file', 'input_image', 'input_text']);
  assert.equal(out.stop, 'tool');
  assert.equal(out.message.text, 'Fatto');
  assert.deepEqual(out.message.toolCalls[0], { id: 'call_1', name: 'update_fields', args: { updates: [{ path: 'subject.floor', value: 3 }] } });
  const m2 = mock({ status: 'completed', output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'ok' }] }] });
  await Providers.call({ provider: 'openai', apiKey: 'k', fetch: m2.fetch }, { system: 'S', messages: [USER, out.message, { role: 'tool', results: [{ id: 'call_1', name: 'update_fields', content: '{"ok":true}' }] }], tools: TOOLS });
  const input = m2.calls[0].body.input;
  assert.equal(input.length, 1 + 3 + 1);
  assert.deepEqual(input[4], { type: 'function_call_output', call_id: 'call_1', output: '{"ok":true}' });
});

test('Gemini: generateContent with uppercase schema types, function calls and responses, search sub-call', async () => {
  const m = mock({ candidates: [{ finishReason: 'STOP', content: { role: 'model', parts: [{ functionCall: { name: 'update_fields', args: { updates: [] } }, thoughtSignature: 'sig' }] } }] });
  const out = await Providers.call({ provider: 'gemini', apiKey: 'AIza', model: 'gemini-2.5-flash', fetch: m.fetch }, { system: 'SYS', messages: [USER], tools: TOOLS, webSearch: true });
  const c = m.calls[0];
  assert.equal(c.url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent');
  assert.equal(c.init.headers['x-goog-api-key'], 'AIza');
  assert.equal(c.body.systemInstruction.parts[0].text, 'SYS');
  const fd = c.body.tools[0].functionDeclarations;
  assert.equal(fd[0].parameters.type, 'OBJECT');
  assert.equal(fd[0].parameters.properties.updates.items.properties.value.type, 'STRING');
  assert.ok(fd.some((f) => f.name === 'web_search'), 'search is a function tool on Gemini');
  assert.deepEqual(c.body.contents[0].parts.map((p) => Object.keys(p)[0]), ['inlineData', 'inlineData', 'text']);
  assert.equal(out.stop, 'tool');
  assert.equal(out.message.toolCalls[0].name, 'update_fields');
  const m2 = mock({ candidates: [{ finishReason: 'STOP', content: { role: 'model', parts: [{ text: 'ok' }] } }] });
  await Providers.call({ provider: 'gemini', apiKey: 'k', fetch: m2.fetch }, { system: 'S', messages: [USER, out.message, { role: 'tool', results: [{ id: out.message.toolCalls[0].id, name: 'update_fields', content: '{"applied":[]}' }] }], tools: TOOLS });
  const contents = m2.calls[0].body.contents;
  assert.equal(contents[1].role, 'model');
  assert.equal(contents[1].parts[0].thoughtSignature, 'sig');
  assert.deepEqual(contents[2].parts[0].functionResponse, { name: 'update_fields', response: { applied: [] } });
  const m3 = mock({ candidates: [{ content: { parts: [{ text: 'Precio medio 4.500 €/m²' }] }, groundingMetadata: { groundingChunks: [{ web: { uri: 'https://example.com/a', title: 'Fuente' } }] } }] });
  const s = await Providers.search({ provider: 'gemini', apiKey: 'k', fetch: m3.fetch }, 'precio Castelldefels centro');
  assert.ok(m3.calls[0].body.tools.some((t) => t.google_search));
  assert.equal(s.answer, 'Precio medio 4.500 €/m²');
  assert.deepEqual(s.sources, [{ title: 'Fuente', url: 'https://example.com/a' }]);
});

test('OpenAI-compatible (Ollama, LM Studio, OpenRouter): chat completions with tool calls', async () => {
  const m = mock({ choices: [{ finish_reason: 'tool_calls', message: { role: 'assistant', content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'update_fields', arguments: '{"updates":[]}' } }] } }] });
  const out = await Providers.call({ provider: 'compatible', baseUrl: 'http://localhost:11434/v1/', model: 'qwen2.5', fetch: m.fetch }, { system: 'SYS', messages: [USER], tools: TOOLS, webSearch: true });
  const c = m.calls[0];
  assert.equal(c.url, 'http://localhost:11434/v1/chat/completions');
  assert.equal(c.init.headers.Authorization, undefined);
  assert.equal(c.body.messages[0].role, 'system');
  const parts = c.body.messages[1].content;
  assert.ok(parts.some((p) => p.type === 'image_url' && /^data:image\/jpeg;base64,/.test(p.image_url.url)));
  assert.ok(parts.some((p) => p.type === 'text' && /nota\.pdf/.test(p.text)), 'PDFs are described, not sent');
  assert.ok(!c.body.tools.some((t) => t.function.name === 'web_search'), 'no search tool without a search backend');
  assert.equal(out.stop, 'tool');
  assert.deepEqual(out.message.toolCalls[0], { id: 'c1', name: 'update_fields', args: { updates: [] } });
});

test('API errors surface the provider message', async () => {
  const m = mock({ error: { type: 'authentication_error', message: 'invalid x-api-key' } }, 401);
  await assert.rejects(Providers.call({ provider: 'anthropic', apiKey: 'bad', fetch: m.fetch }, { system: 'S', messages: [USER], tools: [] }), /401.*invalid x-api-key/);
});

test('Anthropic refusals are reported as such', async () => {
  const m = mock({ stop_reason: 'refusal', content: [] });
  const out = await Providers.call({ provider: 'anthropic', apiKey: 'k', fetch: m.fetch }, { system: 'S', messages: [USER], tools: [] });
  assert.equal(out.stop, 'refusal');
});

test('Anthropic: retries once without server-side fallbacks when the account rejects that beta', async () => {
  const calls = [];
  const fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push({ headers: init.headers, body });
    if (calls.length === 1) return { ok: false, status: 400, json: async () => ({ error: { type: 'invalid_request_error', message: 'fallbacks: server-side-fallback beta is not enabled for this organization' } }) };
    return { ok: true, status: 200, json: async () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'ok' }] }) };
  };
  const out = await Providers.call({ provider: 'anthropic', apiKey: 'k', fetch }, { system: 'S', messages: [USER], tools: [] });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].body.fallbacks, 'default');
  assert.equal(calls[1].body.fallbacks, undefined);
  assert.equal(calls[1].headers['anthropic-beta'], undefined);
  assert.equal(out.message.text, 'ok');
});


test('preset AI providers state their seat; none is in a country without an EU adequacy decision', () => {
  const P = Providers.PRESETS;
  assert.ok(!/deepseek/i.test(JSON.stringify(P)), 'no DeepSeek preset');
  for (const k of ['anthropic', 'openai', 'gemini']) assert.match(String(P[k].seat || ''), /^[A-Z]{2}$/, k);
  for (const b of P.compatible.baseUrls) assert.match(String(b[2] || ''), /^([A-Z]{2}|local)$/, b[0]);
});
