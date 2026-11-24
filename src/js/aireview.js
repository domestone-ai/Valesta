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
/* AIReview — the AI proposes, the professional decides. Each assistant turn that changes the valuation becomes an entry
 * of the AI log (state.aiLog) with the changed values; the entry stays open until it is accepted, rejected (the previous
 * values come back, except those the user changed afterwards) or confirmed field by field. The log feeds the AI use
 * statement of the report (RICS, EU AI Act transparency). Pure logic, no DOM. */
(function (root, factory) {
  const mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else root.AIReview = mod;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const L = (en, es, it) => ({ en, es, it });
  const lng = (lang) => (['en', 'es', 'it'].includes(lang) ? lang : 'en');
  const IGNORE = /^(aiLog|photos|meta\.id)(\.|$)/;
  const LKEYS = ['it', 'en', 'es', '_'];
  const MAX_VALUE = 60000;

  // Canonical JSON (sorted keys): equality that does not depend on key order.
  function canon(v) {
    if (v === undefined) return 'undefined';
    if (v === null || typeof v !== 'object') return JSON.stringify(v);
    if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
    return '{' + Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
  }
  const same = (a, b) => canon(a) === canon(b);
  const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
  const isLtext = (v) => isObj(v) && Object.keys(v).length > 0 && Object.keys(v).every((k) => LKEYS.includes(k) && (v[k] == null || typeof v[k] !== 'object'));

  function diff(before, after) {
    const out = [];
    const walk = (a, b, path) => {
      if (path && IGNORE.test(path)) return;
      if (path === 'comparables' && Array.isArray(a) && Array.isArray(b)) return comps(a, b);
      if (isObj(a) && isObj(b) && !isLtext(a) && !isLtext(b)) {
        Array.from(new Set(Object.keys(a).concat(Object.keys(b)))).forEach((k) => walk(a[k], b[k], path ? `${path}.${k}` : k));
        return;
      }
      if (!same(a, b)) out.push({ path, kind: 'value', before: clone(a), after: clone(b) });
    };
    const comps = (a, b) => {
      const ida = new Map(a.filter((c) => c && c.id != null).map((c) => [String(c.id), c]));
      const idb = new Map(b.filter((c) => c && c.id != null).map((c) => [String(c.id), c]));
      a.forEach((c, index) => { if (c && c.id != null && !idb.has(String(c.id))) out.push({ path: 'comparables', kind: 'comp-remove', id: String(c.id), index, before: clone(c) }); });
      b.forEach((c) => {
        if (!c || c.id == null) return;
        const prev = ida.get(String(c.id));
        if (!prev) out.push({ path: 'comparables', kind: 'comp-add', id: String(c.id), after: clone(c) });
        else if (!same(prev, c)) out.push({ path: `comparables#${c.id}`, kind: 'comp-replace', id: String(c.id), before: clone(prev), after: clone(c) });
      });
    };
    walk(before || {}, after || {}, '');
    return out;
  }

  let seq = 0;
  function entry(o) {
    const x = o || {};
    seq += 1;
    const changes = (x.changes || []).map((c) => {
      const big = JSON.stringify(c.before === undefined ? null : c.before).length + JSON.stringify(c.after === undefined ? null : c.after).length > MAX_VALUE;
      return Object.assign({}, c, big ? { before: undefined, after: undefined, big: true } : {}, { state: 'open' });
    });
    return {
      id: `ai${Date.now().toString(36)}${seq}`, at: x.at || new Date().toISOString(), status: 'open',
      request: String(x.request || '').slice(0, 400), summary: String(x.summary || '').slice(0, 600),
      provider: String(x.provider || '').slice(0, 60), model: String(x.model || '').slice(0, 80),
      sources: (x.sources || []).filter((s) => s && s.url).slice(0, 8).map((s) => ({ title: String(s.title || '').slice(0, 160), url: String(s.url).slice(0, 500) })),
      changes,
    };
  }

  // Changes that reached the valuation from outside the editor (an assistant connected through MCP) become a proposal
  // to review, like the turns of the built-in assistant. Photos, documents and the AI log itself are not changes.
  function fromExternal(synced, next, info) {
    const strip = (x) => Object.assign({}, x || {}, { photos: [], attachments: [], aiLog: [] });
    const changes = diff(strip(synced), strip(next));
    return changes.length ? entry(Object.assign({}, info || {}, { changes })) : null;
  }

  // ---------- state paths ----------
  const parts = (path) => String(path).split('.');
  function getPath(obj, path) { return parts(path).reduce((o, k) => (o == null ? undefined : o[k]), obj); }
  function setPath(obj, path, value) {
    const ks = parts(path);
    let o = obj;
    for (let i = 0; i < ks.length - 1; i++) { if (!isObj(o[ks[i]]) && !Array.isArray(o[ks[i]])) o[ks[i]] = {}; o = o[ks[i]]; }
    if (value === undefined) delete o[ks[ks.length - 1]]; else o[ks[ks.length - 1]] = clone(value);
  }
  function revertChange(state, c) {
    if (c.big) return false;
    const list = Array.isArray(state.comparables) ? state.comparables : (state.comparables = []);
    const at = list.findIndex((x) => x && String(x.id) === c.id);
    if (c.kind === 'comp-add') { if (at < 0) return true; if (!same(list[at], c.after)) return false; list.splice(at, 1); return true; }
    if (c.kind === 'comp-remove') { if (at >= 0) return false; list.splice(Math.min(c.index, list.length), 0, clone(c.before)); return true; }
    if (c.kind === 'comp-replace') { if (at < 0 || !same(list[at], c.after)) return false; list[at] = clone(c.before); return true; }
    if (!same(getPath(state, c.path), c.after)) return false;
    setPath(state, c.path, c.before);
    return true;
  }

  // ---------- decisions ----------
  const find = (log, id) => (log || []).find((e) => e && e.id === id);
  const decide = (e, status) => { e.status = status; e.decidedAt = new Date().toISOString(); };
  function accept(log, id) {
    const e = find(log, id);
    if (!e || e.status !== 'open') return false;
    e.changes.forEach((c) => { if (c.state === 'open') c.state = 'accepted'; });
    decide(e, 'accepted');
    return true;
  }
  function acceptAll(log) { let n = 0; (log || []).forEach((e) => { if (e && e.status === 'open' && accept(log, e.id)) n += 1; }); return n; }
  function reject(state, log, id) {
    const e = find(log, id);
    if (!e || e.status !== 'open') return { reverted: 0, conflicts: 0 };
    let reverted = 0;
    let conflicts = 0;
    e.changes.slice().reverse().forEach((c) => {
      if (c.state !== 'open') return;
      if (revertChange(state, c)) { reverted += 1; c.state = 'rejected'; } else { conflicts += 1; c.state = 'kept'; }
    });
    decide(e, 'rejected');
    return { reverted, conflicts };
  }
  // The user edited a field: its open AI changes count as confirmed; an entry with nothing left open is accepted.
  function touch(log, path) {
    let done = 0;
    (log || []).forEach((e) => {
      if (!e || e.status !== 'open') return;
      let hit = false;
      e.changes.forEach((c) => { if (c.state === 'open' && (c.path === path || String(path).startsWith(c.path + '.'))) { c.state = 'edited'; hit = true; } });
      if (hit && e.changes.every((c) => c.state !== 'open')) { decide(e, 'accepted'); done += 1; }
    });
    return done;
  }
  function openPaths(log) {
    const s = new Set();
    (log || []).forEach((e) => { if (e && e.status === 'open') e.changes.forEach((c) => { if (c.state === 'open') s.add(c.kind === 'comp-add' ? `comparables#${c.id}` : c.path); }); });
    return s;
  }
  function counts(log) {
    const n = { open: 0, accepted: 0, rejected: 0 };
    (log || []).forEach((e) => { if (e && n[e.status] != null) n[e.status] += 1; });
    return n;
  }

  // ---------- AI use statement for the report ----------
  const TEXT = {
    title: L('Use of artificial intelligence', 'Uso de inteligencia artificial', 'Uso dell’intelligenza artificiale'),
    body: L((n, who) => `In preparing this report the advisor used artificial intelligence tools${who} for ${n} ${n === 1 ? 'proposal' : 'proposals'} of data and text. Every proposal was reviewed and approved by the advisor, who remains responsible for the valuation and its conclusions.`,
      (n, who) => `En la preparación de este informe el asesor utilizó herramientas de inteligencia artificial${who} para ${n} ${n === 1 ? 'propuesta' : 'propuestas'} de datos y textos. Cada propuesta fue revisada y aprobada por el asesor, que sigue siendo responsable de la valoración y de sus conclusiones.`,
      (n, who) => `Nella preparazione di questo rapporto il consulente si è avvalso di strumenti di intelligenza artificiale${who} per ${n} ${n === 1 ? 'proposta' : 'proposte'} di dati e testi. Ogni proposta è stata rivista e approvata dal consulente, che resta responsabile della valutazione e delle sue conclusioni.`),
    pending: L((p) => ` ${p} ${p === 1 ? 'proposal is' : 'proposals are'} still under review.`, (p) => ` ${p} ${p === 1 ? 'propuesta sigue' : 'propuestas siguen'} en revisión.`,
      (p) => ` ${p} ${p === 1 ? 'proposta è' : 'proposte sono'} ancora in revisione.`),
  };
  // X: texts of a report language pack ({ title, body(accepted, who), pending(open) }), when present.
  function statement(log, lang, X) {
    const c = counts(log);
    if (!c.accepted && !c.open) return null;
    const l = lng(lang);
    const providers = Array.from(new Set((log || []).filter((e) => e && e.status !== 'rejected' && e.provider).map((e) => e.provider)));
    const who = providers.length ? ` (${providers.join(', ')})` : '';
    if (X && X.title && X.body) return { title: X.title, text: X.body(c.accepted, who) + (c.open && X.pending ? X.pending(c.open) : '') };
    return { title: TEXT.title[l], text: TEXT.body[l](c.accepted, who) + (c.open ? TEXT.pending[l](c.open) : '') };
  }

  return { diff, entry, fromExternal, accept, acceptAll, reject, touch, openPaths, counts, statement, getPath, same };
});
