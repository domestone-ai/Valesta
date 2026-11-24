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
/* ValestaStore — local archive (IndexedDB) of the valuations (with photos) and agency profiles. Browser and app only.
 * Valuations: { id, updated, title, municipality, value, reportLang, brand, ref, state }
 * Profiles:   { id, label, updated, profile }
 * At the first start it imports once the data of version 1.1 (database and "valorem" keys), and does not delete them.
 */
(function (root) {
  'use strict';
  const DB = 'valesta';
  const LEGACY_DB = 'valorem';
  const VERSION = 2;
  const STORES = ['projects', 'profiles'];
  const LEGACY_KEYS = ['state-v2', 'ui-lang', 'current', 'profiles', 'default-profile', 'ai', 'ai-keys'];
  let dbp = null;

  // Copies the settings saved by Valorem 1.1 (prefix "valorem-") to the new keys, once. Returns how many were copied.
  function migrateLegacyKeys(storage) {
    let n = 0;
    if (!storage) return 0;
    try {
      LEGACY_KEYS.forEach((k) => {
        const v = storage.getItem('valorem-' + k);
        if (v === null || storage.getItem('valesta-' + k) !== null) return;
        storage.setItem('valesta-' + k, k === 'default-profile' && v === 'valorem' ? 'valesta' : v);
        n += 1;
      });
    } catch (e) { /* storage blocked */ }
    return n;
  }

  // Copies the records of the Valorem 1.1 database into the newly created one. The old database is left untouched.
  function importLegacy(db) {
    return new Promise((resolve) => {
      let req;
      try { req = root.indexedDB.open(LEGACY_DB); } catch (e) { resolve(0); return; }
      req.onupgradeneeded = (ev) => { if (ev.oldVersion === 0) req.transaction.abort(); }; // no old database: do not create one
      req.onerror = () => resolve(0);
      req.onblocked = () => resolve(0);
      req.onsuccess = () => {
        const old = req.result;
        const names = STORES.filter((s) => old.objectStoreNames.contains(s));
        if (!names.length) { old.close(); resolve(0); return; }
        const data = {};
        const rt = old.transaction(names, 'readonly');
        names.forEach((s) => { const g = rt.objectStore(s).getAll(); g.onsuccess = () => { data[s] = g.result || []; }; });
        rt.onerror = () => { old.close(); resolve(0); };
        rt.oncomplete = () => {
          old.close();
          let count = 0;
          const wt = db.transaction(names, 'readwrite');
          names.forEach((s) => (data[s] || []).forEach((rec) => { wt.objectStore(s).put(rec); count += 1; }));
          wt.oncomplete = () => resolve(count);
          wt.onerror = () => resolve(0);
          wt.onabort = () => resolve(0);
        };
      };
    });
  }

  function open() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      let req;
      let created = false;
      try {
        if (!root.indexedDB) throw new Error('IndexedDB not available');
        req = root.indexedDB.open(DB, VERSION);
      } catch (e) { reject(e); return; }
      req.onupgradeneeded = (ev) => {
        const db = req.result;
        created = ev.oldVersion === 0;
        STORES.forEach((s) => { if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' }); });
      };
      req.onsuccess = () => { const db = req.result; (created ? importLegacy(db) : Promise.resolve(0)).then(() => resolve(db)); };
      req.onerror = () => reject(req.error || new Error('IndexedDB error'));
      req.onblocked = () => reject(new Error('IndexedDB blocked'));
    });
    dbp.catch(() => { dbp = null; });
    return dbp;
  }
  function tx(store, mode, fn) {
    return open().then((db) => new Promise((resolve, reject) => {
      const t = db.transaction(store, mode);
      const r = fn(t.objectStore(store));
      t.oncomplete = () => resolve(r ? r.result : undefined);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error || new Error('aborted'));
    }));
  }
  const byUpdated = (a, b) => String(b.updated || '').localeCompare(String(a.updated || ''));
  const meta = (rec) => { const m = Object.assign({}, rec); delete m.state; return m; };
  try { if (root.localStorage) migrateLegacyKeys(root.localStorage); } catch (e) { /* storage blocked */ }
  root.ValestaStore = {
    migrateLegacyKeys,
    available: () => open().then(() => true, () => false),
    put: (rec) => tx('projects', 'readwrite', (st) => st.put(rec)),
    get: (id) => tx('projects', 'readonly', (st) => st.get(id)),
    del: (id) => tx('projects', 'readwrite', (st) => st.delete(id)),
    list: () => tx('projects', 'readonly', (st) => st.getAll()).then((all) => (all || []).map(meta).sort(byUpdated)),
    profiles: {
      list: () => tx('profiles', 'readonly', (st) => st.getAll()).then((all) => (all || []).sort((a, b) => String(a.label || '').localeCompare(String(b.label || '')))),
      put: (rec) => tx('profiles', 'readwrite', (st) => st.put(rec)),
      del: (id) => tx('profiles', 'readwrite', (st) => st.delete(id)),
    },
  };
})(typeof self !== 'undefined' ? self : this);
