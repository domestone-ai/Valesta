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
/* Report — builds the A4 pages of the valuation report in the chosen language.
 * Depends on the globals MCA, Charts, ASSETS, I18N, REPORT_I18N.
 */
(function (root, factory) {
  const mod = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else root.Report = mod;
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';
  const G = typeof self !== 'undefined' ? self : typeof global !== 'undefined' ? global : root;
  const req = (name, path) => G[name] || (typeof require === 'function' ? (G[name] = require(path)) : null);
  const MCA = () => G.MCA;
  const CH = () => G.Charts;
  const AS = () => G.ASSETS || { logo: '', maps: {} };
  const I = () => req('I18N', './i18n.js');
  const RI = () => req('REPORT_I18N', './report_i18n.js');
  const CK = () => req('Checks', './checks.js');
  const MP = () => req('Maps', './maps.js');
  const AR = () => req('AIReview', './aireview.js');
  const RF = () => req('References', './references.js');
  const MT = () => req('Method', './method.js');
  const CUR = () => I().sym();
  // ¤ in the report texts stands for the currency of the valuation (CHF 80, 80 € …).
  const withCurrency = (x) => I().withCurrency(x);
  const TX = () => req('Taxonomy', './taxonomy.js');

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // The report reads a cleaned copy of the property and of each comparable: a number that is missing or not finite
  // becomes empty, and a plain-text field holding a list, an object or a boolean (a damaged file, an assistant) becomes
  // empty text, so the report never prints "null", "NaN", "Infinity" or "[object Object]".
  const NUM_KEYS = ['floor', 'yearBuilt', 'bedrooms', 'bathrooms', 'terraceM2', 'galleryM2', 'gardenM2', 'communityFee', 'neighbours', 'areaBuilt',
    'areaBuiltCommon', 'areaUseful', 'price', 'energyKwh', 'cadastralYear', 'cadastralPrivate', 'cadastralCommon', 'cadastralShare', 'lat', 'lon'];
  const TEXT_KEYS = ['id', 'address', 'floorDoor', 'postalCode', 'municipality', 'province', 'region', 'zone', 'cadastralRef', 'cadastralRefAlt',
    'cadastralParcel', 'cadastralAddress', 'condition', 'orientation', 'gas', 'electricity', 'energyCert', 'notes', 'source', 'sourceName', 'url',
    'date'];   // (excludeReason and the descriptions are localized texts, read with L())
  function cleanNum(v) {
    if (v == null || v === '' || typeof v === 'boolean' || typeof v === 'object') return null;
    const x = typeof v === 'number' ? v : Number(String(v).trim());
    return Number.isFinite(x) ? x : null;
  }
  const cleanText = (v) => (v == null || typeof v === 'object' || typeof v === 'boolean' || (typeof v === 'number' && !Number.isFinite(v)) ? '' : String(v));
  function cleanItem(o) {
    if (!o || typeof o !== 'object') return {};
    const out = Object.assign({}, o);
    NUM_KEYS.forEach((k) => { if (k in out) out[k] = cleanNum(out[k]); });
    TEXT_KEYS.forEach((k) => { if (k in out) out[k] = cleanText(out[k]); });
    return out;
  }
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  const low = (s) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);
  const inline = (p) => esc(p).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
  const paras = (s) => String(s || '').split(/\n\s*\n/).filter((p) => p.trim()).map((p) => `<p>${inline(p.trim())}</p>`).join('');
  const listItems = (s) => String(s || '').split(/\n/).map((x) => x.replace(/^\s*[-•·]\s*/, '').trim()).filter(Boolean);
  const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

  // ---------- brand ----------
  const DEFAULT_BRAND = { name: 'Valesta', logoMode: 'text', logoLight: null, logoDark: null, primary: '#0E5A4E', accent: '#1A8A47', showBand: true, tagline: '' };
  const hex = (h, d) => (/^#[0-9a-f]{6}$/i.test(String(h || '')) ? String(h).toLowerCase() : d.toLowerCase());
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.substr(i, 2), 16));
  const toHex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, t) => { const x = rgb(a), y = rgb(b); return toHex(x.map((v, i) => v + (y[i] - v) * t)); };
  function palette(brand) {
    const p = hex(brand.primary, DEFAULT_BRAND.primary);
    const a = hex(brand.accent, DEFAULT_BRAND.accent);
    return { brand: p, deep: mix(p, '#000000', 0.45), mid: mix(p, '#000000', 0.22), b50: mix(p, '#ffffff', 0.94), b100: mix(p, '#ffffff', 0.86),
      b200: mix(p, '#ffffff', 0.68), b300: mix(p, '#ffffff', 0.45), accent: a, a50: mix(a, '#ffffff', 0.9), a200: mix(a, '#ffffff', 0.6),
      duoDark: mix(p, '#000000', 0.62), duoLight: mix(p, '#ffffff', 0.08) };
  }
  function brandOf(state) { return Object.assign({}, DEFAULT_BRAND, (state && state.brand) || {}); }
  // ---------- design: fonts, text size, spacing, corners, cover, watermark, sections ----------
  const FONT_STACKS = {
    'Cormorant Garamond': "'Cormorant Garamond', 'Noto Sans SC', Georgia, 'Times New Roman', serif",
    Literata: "'Literata', 'Noto Sans SC', Georgia, 'Times New Roman', serif",
    Georgia: "Georgia, 'Noto Sans SC', 'Times New Roman', serif",
    Inter: "'Inter', 'Noto Sans SC', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    'Open Sans': "'Open Sans', 'Noto Sans SC', 'Segoe UI', Roboto, Arial, sans-serif",
    Montserrat: "'Montserrat', 'Noto Sans SC', 'Segoe UI', Roboto, Arial, sans-serif",
    Figtree: "'Figtree', 'Noto Sans SC', 'Segoe UI', Roboto, Arial, sans-serif",
    Helvetica: "'Helvetica Neue', Helvetica, 'Noto Sans SC', Arial, sans-serif",
  };
  const EMBEDDED_FONTS = ['Cormorant Garamond', 'Literata', 'Inter', 'Open Sans', 'Montserrat', 'Figtree'];
  // Fonts used by projects saved before 2026-11-23, replaced by equivalents without a Reserved Font Name (OFL).
  const LEGACY_FONTS = { 'Playfair Display': 'Cormorant Garamond', Lora: 'Literata', 'Source Sans 3': 'Open Sans' };
  const SECTION_KEYS = ['summary', 'toc', 'letter', 'scope', 'location', 'description', 'surfaces', 'market', 'method', 'methodDetail', 'sample', 'cards',
    'homog', 'homogChart', 'result', 'sensitivity', 'uncertainty', 'photos', 'hypotheses', 'sources', 'certification', 'annexes', 'glossary'];
  const DENSITY = { compact: { sp: 0.8, lh: 1.42 }, normal: { sp: 1, lh: 1.5 }, airy: { sp: 1.2, lh: 1.6 } };
  const RADIUS = { square: 0, rounded: 1, soft: 1.8 };
  // Height of the logo in the page headers (mm); the brand band and the stamp follow in proportion.
  const HEADER_LOGO = { S: 5, M: 7, L: 9 };
  // Cover gallery. Photo covers use the custom cover image, then the photo marked as cover, then the map.
  // Four covers. Older styles are shown with the closest one: photo for full-page and editorial, pattern for gradient,
  // solid colour and architectural (grid).
  const COVER_STYLES = ['map', 'photo', 'pattern', 'minimal'];
  const LEGACY_COVERS = { fullbleed: 'photo', editorial: 'photo', gradient: 'pattern', solid: 'pattern', blueprint: 'pattern' };
  const SAFE_IMG = /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/;
  const WATERMARKS = ['', 'draft', 'confidential', 'custom'];
  const DEFAULT_DESIGN = { preset: 'full', fontHead: 'Cormorant Garamond', fontBody: 'Inter', textScale: 1, density: 'normal', radius: 'rounded',
    ink: '#1A2229', coverStyle: 'map', coverImage: null, headerLogo: 'M', autoFit: true, watermark: '', watermarkText: '', footerNote: '', pageNumbers: true,
    sections: SECTION_KEYS.reduce((o, k) => { o[k] = true; return o; }, {}) };
  // Report models: which blocks each audience gets (missing keys = shown). A model sets the sections when the user
  // picks it; the name only marks the button. "complete" and "technical" (1.0.0) open as "full".
  const PRESETS = {
    client: { toc: false, scope: false, surfaces: false, methodDetail: false, cards: false, homog: false, sensitivity: false, uncertainty: false, sources: false, glossary: false },
    full: {},
  };
  function designOf(state) {
    const d = (state && state.design) || {};
    const out = Object.assign({}, DEFAULT_DESIGN, d);
    if (!Object.prototype.hasOwnProperty.call(PRESETS, out.preset)) out.preset = 'full';
    out.sections = Object.assign({}, DEFAULT_DESIGN.sections, d.sections || {}, { result: true });
    if (LEGACY_FONTS[out.fontHead]) out.fontHead = LEGACY_FONTS[out.fontHead];
    if (LEGACY_FONTS[out.fontBody]) out.fontBody = LEGACY_FONTS[out.fontBody];
    if (!FONT_STACKS[out.fontHead]) out.fontHead = DEFAULT_DESIGN.fontHead;
    if (!FONT_STACKS[out.fontBody]) out.fontBody = DEFAULT_DESIGN.fontBody;
    const ts = Number(out.textScale);
    out.textScale = isFinite(ts) && ts > 0 ? Math.max(0.85, Math.min(1.15, ts)) : 1;
    if (!DENSITY[out.density]) out.density = 'normal';
    if (!(out.radius in RADIUS)) out.radius = 'rounded';
    if (!HEADER_LOGO[out.headerLogo]) out.headerLogo = 'M';
    const legacy = out.coverStyle;
    out.cover = Object.assign({ pattern: legacy === 'blueprint' ? 'grid' : 'lines', fill: legacy === 'solid' || legacy === 'blueprint' ? 'solid' : 'gradient' }, d.cover || {});
    if (LEGACY_COVERS[legacy]) out.coverStyle = LEGACY_COVERS[legacy];
    if (!COVER_STYLES.includes(out.coverStyle)) out.coverStyle = 'map';
    if (!(typeof out.coverImage === 'string' && SAFE_IMG.test(out.coverImage))) out.coverImage = null;
    if (!WATERMARKS.includes(out.watermark)) out.watermark = '';
    out.ink = hex(out.ink, DEFAULT_DESIGN.ink);
    out.layers = coverModel(d);
    return out;
  }
  // ---------- cover layers ----------
  // A cover is a stack of layers: background, shade (over a map or a photo), motif, logo and text. Version 1.0.0 stored
  // a style (map, photo, pattern, minimal) with a few options; such covers become the layers that give the same look.
  // Colours are a hex value or a token of the brand palette, so that a cover follows the brand until the user picks a
  // colour of their own.
  const COVER_BG = ['solid', 'gradient', 'map', 'photo'];
  const COVER_SHAPES = ['linear', 'radial'];
  const SHADE_MODES = ['frame', 'full', 'bottom', 'top'];
  const MOTIFS = ['none', 'lines', 'grid', 'band'];
  const LOGO_POS = ['tl', 'tc', 'tr', 'bl'];
  const LOGO_PLATES = ['auto', 'on', 'off'];
  const TEXT_COLORS = ['auto', 'light', 'dark'];
  const COLOR_TOKENS = ['brand', 'brandDeep', 'accent', 'white', 'ink'];
  // The choices of each layer, as the editor offers them.
  const COVER_OPTIONS = Object.freeze({ bg: COVER_BG, shapes: COVER_SHAPES, shades: SHADE_MODES, motifs: MOTIFS, logoPos: LOGO_POS, plates: LOGO_PLATES,
    textColors: TEXT_COLORS, tokens: COLOR_TOKENS });
  const pick = (v, list, d) => (list.includes(v) ? v : d);
  const colorTok = (v, d) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : COLOR_TOKENS.includes(v) ? v : d);
  const bounded = (v, lo, hi, d) => { const n = Number(v); return v === '' || v == null || !isFinite(n) ? d : Math.max(lo, Math.min(hi, Math.round(n))); };
  function coverModel(design) {
    const d = design || {};
    const cv = d.cover && typeof d.cover === 'object' && !Array.isArray(d.cover) ? d.cover : {};
    const old = d.coverStyle;
    const style = LEGACY_COVERS[old] || (COVER_STYLES.includes(old) ? old : 'map');
    const grid = (cv.pattern || (old === 'blueprint' ? 'grid' : 'lines')) === 'grid';
    const solid = (cv.fill || (old === 'solid' || old === 'blueprint' ? 'solid' : 'gradient')) === 'solid';
    const veil = cv.veil === '' || cv.veil == null || !isFinite(+cv.veil) ? 1 : Math.max(0, Math.min(1, +cv.veil));
    const layer = (k) => (cv[k] && typeof cv[k] === 'object' && !Array.isArray(cv[k]) ? cv[k] : {});
    const B = layer('bg'), S = layer('shade'), M = layer('motif'), L = layer('logo'), X = layer('text');
    // The shade of 1.0.0 covered every cover but the minimal one. A cover made with layers has a shade over a map or a
    // photo only, until the user sets one: a white background stays white.
    const layered = Object.keys(B).length > 0;
    const shadeDefault = layered ? (B.type === 'map' || B.type === 'photo' ? 100 : 0) : style === 'minimal' ? 0 : Math.round(veil * 100);
    const base = {
      type: style === 'photo' || style === 'map' ? style : style === 'minimal' || solid ? 'solid' : 'gradient',
      shape: style === 'pattern' && grid && !solid ? 'radial' : 'linear',
      c1: style === 'minimal' ? 'white' : 'brandDeep',
      motif: style === 'pattern' ? (grid ? 'grid' : 'lines') : style === 'minimal' ? 'band' : 'none',
    };
    return {
      bg: { type: pick(B.type, COVER_BG, base.type), shape: pick(B.shape, COVER_SHAPES, base.shape), c1: colorTok(B.c1, base.c1),
        c2: colorTok(B.c2, 'brand'), angle: bounded(B.angle, 0, 360, 155) },
      shade: { color: colorTok(S.color, 'brandDeep'), opacity: bounded(S.opacity, 0, 100, shadeDefault), mode: pick(S.mode, SHADE_MODES, 'frame') },
      motif: { type: pick(M.type, MOTIFS, base.motif) },
      logo: { size: bounded(L.size, 6, 30, 14), pos: pick(L.pos, LOGO_POS, 'tl'), plate: pick(L.plate, LOGO_PLATES, 'auto') },
      text: { color: pick(X.color, TEXT_COLORS, 'auto'), align: pick(X.align, ['left', 'center'], 'left') },
      // A 1.0.0 cover keeps the geometry of 1.0.0 (a gradient in the upper part, blended by the shade).
      legacy: !layered,
    };
  }
  // Colour of a cover token or hex value, contrast ratio (WCAG 2.x) and the text colour of a cover.
  function colorOf(v, P, D) {
    if (/^#[0-9a-f]{6}$/i.test(String(v))) return String(v).toLowerCase();
    return { brand: P.brand, brandDeep: P.deep, accent: P.accent, white: '#ffffff', ink: D.ink }[v] || P.deep;
  }
  const luminance = (h) => rgb(h).map((c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); })
    .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
  function contrast(a, b) { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  // The background behind the cover texts: the middle of a gradient; for a map or a photo, the shade over a middle tone
  // (the image itself is not measured). A shade from the top covers the texts only a little.
  const MID_TONE = '#7f7f7f';
  function coverBackground(L, P, D) {
    const k = (L.shade.opacity / 100) * (L.shade.mode === 'top' ? 0.25 : 1);
    const shade = colorOf(L.shade.color, P, D);
    if (L.bg.type === 'map' || L.bg.type === 'photo') return mix(MID_TONE, shade, k);
    const c1 = colorOf(L.bg.c1, P, D);
    // The texts sit in the lower part of the page, where a gradient is near its first colour.
    return mix(L.bg.type === 'gradient' ? mix(c1, colorOf(L.bg.c2, P, D), 0.25) : c1, shade, k);
  }
  // Light or dark text: the one with the higher contrast, unless the user forces it.
  function coverInk(L, P, D) {
    const bg = coverBackground(L, P, D);
    const light = '#ffffff';
    const useLight = L.text.color === 'light' || (L.text.color === 'auto' && contrast(light, bg) >= contrast(D.ink, bg));
    const ink = useLight ? light : D.ink;
    return { ink, dark: !useLight, bg, ratio: Math.round(contrast(ink, bg) * 10) / 10 };
  }
  // Fonts an exported report carries: the design's families and, for a report in Chinese, Noto Sans SC (src/css/fonts-cjk.css).
  const usedFonts = (state) => {
    const d = designOf(state);
    const out = Array.from(new Set([d.fontHead, d.fontBody])).filter((f) => EMBEDDED_FONTS.includes(f));
    return (state && state.meta && state.meta.reportLang) === 'zh' ? out.concat('Noto Sans SC') : out;
  };
  // Keeps only the @font-face blocks of the given families: exports carry just the fonts they use.
  function filterFontCss(css, families) {
    const keep = new Set(families || []);
    return String(css || '').replace(/(\/\*[^*]*\*\/\s*)?@font-face\s*\{[^}]*\}\s*/g, (block) => {
      const m = /font-family:\s*'([^']+)'/.exec(block);
      return m && keep.has(m[1]) ? block : '';
    });
  }
  function brandCss(state) {
    const P = palette(brandOf(state));
    const D = designOf(state);
    const dn = DENSITY[D.density];
    return `.report{--brand:${P.brand};--brand-deep:${P.deep};--brand-mid:${P.mid};--brand-50:${P.b50};--brand-100:${P.b100};--brand-200:${P.b200};--brand-300:${P.b300};--accent:${P.accent};--accent-50:${P.a50};--accent-200:${P.a200};` +
      `--serif:${FONT_STACKS[D.fontHead]};--sans:${FONT_STACKS[D.fontBody]};--ts:${D.textScale};--sp:${dn.sp};--lh:${dn.lh};--rf:${RADIUS[D.radius]};--ink:${D.ink};` +
      `--hl:${HEADER_LOGO[D.headerLogo]}mm;--hl-k:${Math.round((HEADER_LOGO[D.headerLogo] / 7) * 1000) / 1000}}`;
  }
  const isRaster = (d) => typeof d === 'string' && /^data:image\/(jpeg|jpg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(d);
  function logoHtml(ctx, onDark, slot, plate) {
    // The neutral Valesta profile shows the Valesta logo when the app provides it (the brand files are not in the code).
    const VL = G.VALESTA_LOGO;
    const b = ctx.brand.logoMode !== 'custom' && ctx.brand.profileId === 'valesta' && VL && VL.light
      ? Object.assign({}, ctx.brand, { logoMode: 'custom', logoLight: VL.light, logoDark: VL.dark }) : ctx.brand;
    const name = esc(b.name || '');
    if (b.logoMode === 'custom' && (b.logoLight || b.logoDark)) {
      if (plate === 'on' || (plate !== 'off' && onDark && !b.logoDark)) {
        return `<span class="brand-logo brand-logo--${slot} brand-logo--pill"><img src="${esc(b.logoLight || b.logoDark)}" alt="${name}"></span>`;
      }
      if (onDark && b.logoDark) return `<span class="brand-logo brand-logo--${slot}"><img src="${esc(b.logoDark)}" alt="${name}"></span>`;
      return `<span class="brand-logo brand-logo--${slot}"><img src="${esc(b.logoLight || b.logoDark)}" alt="${name}"></span>`;
    }
    return `<span class="wordmark wordmark--${slot}">${name}</span>`;
  }

  // ---------- context ----------
  const SECTION_IDS = ['scope', 'location', 'description', 'market', 'method', 'sample', 'homog', 'result', 'photos', 'hypotheses', 'certification'];

  function makeCtx(state, res) {
    const lang = I().norm((state.meta && state.meta.reportLang) || 'en');
    I().setCurrency(TX() ? TX().currencyOf(state) : 'EUR');
    if (CH().setCurrency) CH().setCurrency(I().sym());
    const T = RI()[lang] || RI().en;
    const L = (v) => I().loc(v, lang);
    // In a draft language a text is used only when written in that language: no English (or Spanish, Italian) fallback.
    const draft = (I().DRAFT || []).includes(lang);
    const exact = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v[lang] || v._ || '' : v == null ? '' : String(v));
    const N = (v, d) => I().fmt(v, d || 0, lang);
    const comps = (Array.isArray(state.comparables) ? state.comparables : []).map((c, i) => ({ c: cleanItem(c), r: res.comps[i] }));
    const ctx = {
      state, res, lang, T, L, N, draft, LD: (v) => (draft ? exact(v) : L(v)),
      EUR: (v) => I().money(v, lang), PM2: (v) => I().perM2(v, lang), M2: (v, d) => (v == null || !isFinite(v) ? '—' : `${N(v, d == null ? 2 : d)} m²`),
      PCT: (v, d, s) => I().pct(v, d, lang, s), DATE: (iso) => I().dateLong(iso, lang),
      KM: (v) => (v == null ? '—' : v < 1 ? `${N(Math.round(v * 100) * 10)} m` : `${N(v, v < 10 ? 2 : 1)} km`),
      s: cleanItem(state.subject), m: state.meta || {}, st: state.settings || {}, mk: state.market || {}, brand: brandOf(state),
      comps, used: comps.filter((x) => x.r && x.r.include), excluded: comps.filter((x) => x.r && !x.r.include),
      photos: (state.photos || []).filter((p) => p && p.dataUrl), sections: {}, sectionPage: {}, total: 0,
      cty: (() => {
        const code = ((state.meta || {}).country) || 'ES';
        const p = (TX() && TX().country(code)) || { docs: [], reserved: {} };
        return { cc: code, name: TX() ? TX().countryName(code, lang) : code, inName: TX() ? TX().countryIn(code, lang) : code, docs: p.docs || [],
          reserved: (p.reserved && (p.reserved[lang] || (draft ? '' : p.reserved.en))) || '', law: p.law || '', std: p.std || '', area: p.area || '',
          planDoc: p.planningDoc || '' };
      })(),
      cat: (TX() && (TX().categoryOf(((state.subject || {}).propertyType || {}).code) || {}).id) || 'residential',
      checksBlock: CK() ? CK().reportBlock(state, lang, ((TX() && TX().country((state.meta || {}).country)) || {}).checkDocs || [], T.checks) : null,
    };
    ctx.noun = (T.nouns && (T.nouns[ctx.cat] || T.nouns.residential)) || { cap: '', the: '', of: '', unit: '', g: '', rooms: '', a: '', b: '' };
    // Property type as shown in the report; in a draft language without a text of its own, the language's noun ("Logement").
    ctx.typeName = draft ? exact(ctx.s.type) || ctx.noun.cap : L(ctx.s.type);
    ctx.techBlock = techData(ctx);
    ctx.P = palette(ctx.brand);
    ctx.D = designOf(state);
    ctx.on = (k) => ctx.D.sections[k] !== false;
    ctx.customs = (Array.isArray(state.customSections) ? state.customSections : [])
      .filter((c) => c && typeof c === 'object' && c.enabled !== false && c.id != null && (L(c.title).trim() || L(c.body).trim()));
    const anchorOf = (c) => (c.after === 'start' || SECTION_IDS.includes(c.after) ? c.after : 'end');
    ctx.order = [];
    let no = 0;
    const push = (id, kicker, title, custom) => { ctx.sections[id] = { id, no: ++no, kicker, title, custom }; ctx.order.push(id); };
    const customs = (anchor) => ctx.customs.filter((c) => anchorOf(c) === anchor)
      .forEach((c) => push('custom-' + String(c.id).replace(/[^\w-]/g, ''), L(c.kicker) || T.customKicker, L(c.title) || T.customKicker, c));
    customs('start');
    SECTION_IDS.forEach((id) => {
      if (id === 'result' || (ctx.on(id) && (id !== 'photos' || ctx.photos.length > 0))) push(id, T.sections[id][0], T.sections[id][1]);
      customs(id);
    });
    customs('end');
    ctx.factors = (Array.isArray(state.factors) && state.factors.length ? state.factors : MCA().FACTORS).map((f) => {
      const base = MCA().FACTORS.find((x) => x.id === f.id) || {};
      const tr = T.engine && T.engine.factors && T.engine.factors[f.id];
      return Object.assign({}, base, f, { label: f['label_' + lang] || (tr && tr[0]) || base['label_' + lang] || base.label_en || f.label_es,
        desc: f['desc_' + lang] || (tr && tr[1]) || base['desc_' + lang] || base.desc_en || f.desc_es || '' });
    });
    ctx.pois = (ctx.s.pois || []).map((p) => Object.assign({}, p, { nameL: L(p.name), d: MCA().util.distanceKm(ctx.s.lat, ctx.s.lon, p.lat, p.lon) }));
    ctx.floorName = (f) => (f == null || f === '' ? '—' : +f === 0 ? T.floorGround : T.floorOrd(f));
    ctx.cond = (k) => (MCA().CONDITIONS[k] ? (T.engine && T.engine.conditions && T.engine.conditions[k]) || MCA().CONDITIONS[k][lang] || MCA().CONDITIONS[k].en : k ? cap(String(k).replace(/_/g, ' ')) : '—');
    ctx.orient = (o) => T.orient[String(o || '').toUpperCase()] || (o ? String(o) : '');
    ctx.yes = (b) => (b ? T.yes : T.no);
    // Kind of prices in use: asking prices (sources without their own negotiation coefficient), transaction prices, or both.
    const asking = ctx.used.map((x) => (MCA().SOURCES[x.c.source] || MCA().SOURCES.otro).negotiation == null);
    ctx.priceKind = !asking.length || asking.every(Boolean) ? 'asking' : asking.some(Boolean) ? 'mixed' : 'closed';
    ctx.auto = autoTexts(ctx);
    return ctx;
  }

  function txt(ctx, key, paragraphs) {
    const o = ctx.state.texts && ctx.state.texts[key];
    const ov = I().loc(o, ctx.lang);
    const s = ov && ov.trim() ? ov : ctx.auto[key] || '';
    return paragraphs === false ? s : paras(s);
  }

  function roomText(v) { return typeof v === 'object' && v ? Object.values(v).join(' ') : String(v || ''); }
  function roomGroup(name) {
    const n = roomText(name);
    if (/ba[ñn]o|aseo|bagno|bath|wc|toilet/i.test(n)) return 2;
    if (/sal[oó]n|comedor|cocina|estar|soggiorno|pranzo|cucina|living|dining|kitchen|lounge/i.test(n)) return 0;
    if (/dormitorio|habitaci|camera|bedroom|suite/i.test(n)) return 1;
    return 3;
  }

  // ---------- automatic texts ----------
  function autoTexts(ctx) {
    const { T, s, m, st, mk, res, N, EUR, PM2, M2, PCT, DATE, KM, L } = ctx;
    const A = T.auto;
    const town = s.municipality || '—';
    const addr = `${s.address || ''}${s.floorDoor ? ', ' + s.floorDoor : ''}`;
    const neg = MCA().negotiationDefault(st);
    const outdoor = (s.terraceM2 || 0) + (s.galleryM2 || 0);
    const near = ctx.pois.filter((p) => p.d != null).sort((a, b) => a.d - b.d).slice(0, 2);
    const bedrooms = (s.rooms || []).filter((r) => roomGroup(r.name) === 1);
    const suite = (s.rooms || []).some((r) => /suite|in camera|en-suite/i.test(roomText(r.name)));
    const minRoom = bedrooms.length ? Math.min.apply(null, bedrooms.map((r) => +r.m2 || 99)) : 99;
    const areas = ctx.comps.map((x) => x.c.areaBuilt).filter((v) => v > 0);
    const dist = (mk.districts || []).map((d) => d.v).filter((v) => v > 0);
    const seriesMax = (mk.series || []).length ? Math.max.apply(null, mk.series.map((p) => p.v)) : null;
    const pPark = st.annex && st.annex.parking;
    const pStor = st.annex && st.annex.storage;
    const ests = [res.stats.mean, res.stats.median, res.stats.weighted].filter((v) => v > 0);
    const estSpread = ests.length ? Math.max.apply(null, ests) / Math.min.apply(null, ests) - 1 : 0;
    const c = {
      noun: ctx.noun, cat: ctx.cat, cc: ctx.cty.cc, docs: ctx.cty.docs, planDoc: ctx.cty.planDoc, law: ctx.cty.law, inName: ctx.cty.inName, reserved: ctx.cty.reserved,
      addr, zone: s.zone, town, province: s.province, visit: DATE(m.visitDate), valDate: DATE(m.valuationDate), brand: ctx.brand.name,
      nAll: ctx.comps.length, nUsed: ctx.used.length, nExcl: ctx.excluded.length, nFactors: ctx.factors.length,
      total: EUR(res.total), words: res.total ? I().currencyWords(res.total, ctx.lang) : '—', lo: res.rangeLow != null ? EUR(res.rangeLow) : '', hi: res.rangeHigh != null ? EUR(res.rangeHigh) : '',
      parcel: s.cadastralParcel, mkSrc: L(mk.source), month: L(mk.month), desc: L(s.locationDesc),
      pois: ctx.pois.map((p) => ({ name: p.nameL, d: KM(p.d) })),
      year: s.yearBuilt || '—', lift: !!s.elevator, intercom: !!s.intercom, neighbours: s.neighbours, fee: s.communityFee ? N(s.communityFee) : '',
      exterior: !!s.exterior, floor: +s.floor === 0 && s.floor !== null && s.floor !== '' ? low(T.floorGround) : ctx.floorName(s.floor),
      ground: +s.floor === 0 && s.floor !== null && s.floor !== '', door: String(s.floorDoor || '').split(' ').pop(), orient: ctx.orient(s.orientation),
      bed: s.bedrooms || '—', bath: s.bathrooms || '—',
      rooms: A.roomsJoin((s.rooms || []).map((r) => `${low(L(r.name))} (${M2(+r.m2)})`)),
      outdoor: A.outdoorJoin(s.terraceM2 ? M2(s.terraceM2) : '', s.galleryM2 ? M2(s.galleryM2) : ''),
      useful: M2(res.usefulArea), usefulTotal: M2((res.usefulArea || 0) + outdoor),
      cond: ctx.cond(s.condition), ac: !!s.ac, heating: !!s.heating,
      list: A.annexList(s.parking, s.storage), values: A.annexValues(s.parking ? EUR(pPark) : '', s.storage ? EUR(pStor) : ''),
      avg: PM2(mk.cityAvg), isMax: seriesMax != null && mk.cityAvg >= seriesMax, yoy: PCT(mk.yoy, 1, true), qoq: PCT(mk.qoq, 1, true),
      zoneNote: L(mk.zoneNote || mk.canBouNote), commentary: L(mk.commentary),
      dRange: dist.length ? `${PM2(Math.min.apply(null, dist))} ${T.and} ${PM2(Math.max.apply(null, dist))}` : '',
      negPct: N((1 - neg) * 100, 0), neg: N(neg, 2),
      zones: Array.from(new Set(ctx.comps.map((x) => x.c.zone).filter(Boolean))).join(', '),
      areaRange: areas.length ? `${N(Math.min.apply(null, areas))}–${N(Math.max.apply(null, areas))}` : '—',
      est: A.estimator[res.estimator] || A.estimator.weighted, mean: PM2(res.stats.mean), median: PM2(res.stats.median), weighted: PM2(res.stats.weighted),
      unitTotal: PM2(res.unitTotal), listing: EUR(res.listingPrice), margin: N(st.listingMarginPct || 0, 0),
      energy: s.energyCert, validity: st.validityMonths || m.validityMonths || 6, office: m.office && m.office.name,
      priceKind: ctx.priceKind, ci: Math.round((res.stats.ciLevel || 0.95) * 100), estSpread: PCT(estSpread, 1), estAgree: estSpread <= 0.05,
    };
    const traits = [];
    if (s.bedrooms >= 3) traits.push(A.traits.bed(s.bedrooms));
    if (s.floor >= 2 && s.elevator) traits.push(A.traits.high);
    if (s.yearBuilt) traits.push(A.traits.year(s.yearBuilt));
    if (s.parking || s.storage) traits.push(A.traits.annexes);
    c.traits = traits.length ? A.traitsJoin(traits) : '';

    const pros = [];
    if (s.bedrooms >= 3 && s.bathrooms > 0) pros.push(A.pros.rooms(s.bedrooms, s.bathrooms, suite));   // both numbers known
    if (s.floor >= 2 && s.elevator) pros.push(A.pros.floor(ctx.floorName(s.floor), s.exterior, ctx.orient(s.orientation)));
    if (s.parking || s.storage) pros.push(A.pros.annexes(A.annexPros(s.parking, s.storage)));
    if (['muy_bueno', 'reformado', 'nuevo'].includes(s.condition)) pros.push(A.pros.cond(ctx.cond(s.condition), s.yearBuilt || '—'));
    if (near.length) pros.push(A.pros.near(A.traitsJoin(near.map((p) => `${p.nameL} (${KM(p.d)})`))));
    if (s.ac && s.heating) pros.push(A.pros.clim);
    const cons = [];
    if (outdoor < 12) cons.push(A.cons.outdoor(A.outdoorCons(M2(s.terraceM2 || 0, 0), s.galleryM2 ? M2(s.galleryM2, 0) : '')));
    if (!s.pool) cons.push(A.cons.pool);
    if (!s.energyCert) cons.push(A.cons.energy);
    if (minRoom < 7) cons.push(A.cons.smallRoom(M2(minRoom)));
    if (!s.elevator && s.floor >= 2) cons.push(A.cons.noLift);
    if (res.stats && res.stats.cv > 0.1) cons.push(A.cons.cv(PCT(res.stats.cv)));

    return {
      letter: A.letter(c), purpose: ctx.draft ? ctx.LD(m.purpose) || T.purposeDefault || '' : L(m.purpose), scope: A.scope(c),
      location: A.location(c), environment: L(s.environmentDesc) || A.environment(c),
      building: A.building(Object.assign({}, c, { desc: L(s.buildingDesc) })),
      dwelling: A.dwelling(c), condition: A.condition(c), annexes: A.annexes(Object.assign({}, c, { desc: L(s.annexDesc) })),
      market: A.market(c), methodIntro: A.methodIntro(c), sample: A.sample(c), result: A.result(c), listing: A.listing(c),
      hypotheses: A.hypotheses(c), declaration: A.declaration(c), pros: pros.join('\n'), cons: cons.join('\n'),
    };
  }

  // ---------- page parts ----------
  function secHead(ctx, id, cont) {
    const sec = ctx.sections[id];
    return `<div class="sec-head${cont ? ' sec-head--cont' : ''}"${cont ? '' : ` id="sec-${id}"`}><span class="sec-num">${String(sec.no).padStart(2, '0')}</span>` +
      `<div class="sec-titles"><div class="sec-kicker">${esc(sec.kicker)}</div><h2 class="sec-title">${esc(sec.title)}${cont ? ` <span class="cont">${esc(ctx.T.cont)}</span>` : ''}</h2></div></div>`;
  }
  const plainHead = (kicker, title, id) => `<div class="sec-head sec-head--plain"${id ? ` id="sec-${id}"` : ''}><div class="sec-titles"><div class="sec-kicker">${esc(kicker)}</div><h2 class="sec-title">${esc(title)}</h2></div></div>`;
  const h3 = (t, sub) => `<h3 class="h3">${esc(t)}${sub ? ` <span>${esc(sub)}</span>` : ''}</h3>`;
  const ul = (items, cls) => `<ul class="${cls || 'bullets'}">${items.map((i) => `<li>${inline(i)}</li>`).join('')}</ul>`;
  const shortUrl = (u) => String(u || '').replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');

  // ---------- pages ----------
  // Decorative contour lines (deterministic), white on a dark cover and ink on a light one.
  function coverLines(stroke = '#ffffff') {
    const w = 840;
    const h = 712;
    const cx = w * 0.8;
    const cy = h * 0.3;
    let out = '';
    for (let i = 1; i <= 17; i++) {
      const r0 = i * 62;
      let d = '';
      for (let a = 0; a <= 360; a += 5) {
        const t = a * Math.PI / 180;
        const r = r0 * (1 + 0.06 * Math.sin(3 * t + i * 0.7) + 0.035 * Math.sin(5 * t - i * 0.4));
        d += (a ? 'L' : 'M') + (cx + r * Math.cos(t)).toFixed(1) + ',' + (cy + r * 0.8 * Math.sin(t)).toFixed(1);
      }
      out += `<path d="${d}Z" fill="none" stroke="${stroke}" stroke-width="${i % 4 === 0 ? 1.3 : 0.6}" opacity="${(0.42 - i * 0.017).toFixed(3)}"/>`;
    }
    return `<svg class="cover-lines" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${out}</svg>`;
  }
  // Architectural cover: drawing grid and an axonometric building with floors and dimension ticks (deterministic).
  function coverBlueprint(stroke = '#fff') {
    const w = 840;
    const h = 712;
    const P = (x, y) => `${x.toFixed(1)},${y.toFixed(1)}`;
    let g = '';
    for (let x = 0; x <= w; x += 21) g += `<path d="M${x} 0V${h}" stroke="${stroke}" stroke-width="${x % 105 ? 0.4 : 0.9}" opacity="${x % 105 ? 0.06 : 0.13}"/>`;
    for (let y = 0; y <= h; y += 21) g += `<path d="M0 ${y}H${w}" stroke="${stroke}" stroke-width="${y % 105 ? 0.4 : 0.9}" opacity="${y % 105 ? 0.06 : 0.13}"/>`;
    const c = [0.866, 0.5];
    const b0 = [600, 560];
    const L = 230;
    const R = 190;
    const H = 330;
    const floors = 8;
    const bl = [b0[0] - L * c[0], b0[1] - L * c[1]];
    const br = [b0[0] + R * c[0], b0[1] - R * c[1]];
    const up = (p, d) => [p[0], p[1] - d];
    const tb = [bl[0] + R * c[0], bl[1] - R * c[1] - H];
    const line = (a, b2, sw, op) => `<path d="M${P(a[0], a[1])}L${P(b2[0], b2[1])}" stroke="${stroke}" stroke-width="${sw}" opacity="${op}"/>`;
    let b = `<path d="M${P(b0[0], b0[1])}L${P(bl[0], bl[1])}L${P(bl[0], bl[1] - H)}L${P(tb[0], tb[1])}L${P(br[0], br[1] - H)}L${P(br[0], br[1])}Z" fill="${stroke}" fill-opacity=".035" stroke="${stroke}" stroke-width="1.6" opacity=".6"/>`;
    b += line(b0, up(b0, H), 1.6, 0.6) + line(up(b0, H), up(bl, H), 1.2, 0.5) + line(up(b0, H), up(br, H), 1.2, 0.5);
    for (let f = 1; f < floors; f++) { const d = (H * f) / floors; b += line(up(b0, d), up(bl, d), 0.7, 0.28) + line(up(b0, d), up(br, d), 0.7, 0.28); }
    for (let j = 1; j < 6; j++) { const p = [b0[0] - (L * j / 6) * c[0], b0[1] - (L * j / 6) * c[1]]; b += line(p, up(p, H), 0.5, 0.2); }
    for (let j = 1; j < 5; j++) { const p = [b0[0] + (R * j / 5) * c[0], b0[1] - (R * j / 5) * c[1]]; b += line(p, up(p, H), 0.5, 0.2); }
    const o = 26;
    const dl = [[bl[0] - o * c[1], bl[1] + o * c[0]], [b0[0] - o * c[1], b0[1] + o * c[0]]];
    const dr = [[b0[0] + o * c[1], b0[1] + o * c[0]], [br[0] + o * c[1], br[1] + o * c[0]]];
    b += line(dl[0], dl[1], 0.8, 0.45) + line(dr[0], dr[1], 0.8, 0.45);
    [dl[0], dl[1], dr[0], dr[1]].forEach((p) => { b += `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="2.4" fill="${stroke}" opacity=".55"/>`; });
    b += `<circle cx="118" cy="470" r="48" fill="none" stroke="${stroke}" stroke-width=".8" opacity=".22"/><path d="M118 414V526M62 470H174" stroke="${stroke}" stroke-width=".6" opacity=".18"/><path d="M118 428L128 470L118 462L108 470Z" fill="${stroke}" opacity=".3"/>`;
    return `<svg class="cover-lines" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${g}${b}</svg>`;
  }
  // Online base map: IGN for Spain. Other countries get a schematic map (markers, distances and scale stay exact)
  // until an open base map is configured for them.
  // Base map of the valuation: its own choice or the open national map of its country (Maps); none: a schematic map.
  const hasLL = (s) => !!s && typeof s.lat === 'number' && typeof s.lon === 'number' && isFinite(s.lat) && isFinite(s.lon) &&
    Math.abs(s.lat) <= 90 && Math.abs(s.lon) <= 180;
  const mapProv = (ctx) => (MP() ? MP().resolve(ctx.state, null) : { id: 'none', tile: null, attribution: '' });
  const baseMap = (ctx) => (mapProv(ctx).tile ? 'tiles' : 'none');
  const mapZoom = (ctx, k, d) => { const r = mapProv(ctx).report; return (r && r[k]) || d; };
  const sampleTiles = (ctx) => embedded((AS().maps || {}).micro, ctx.s) || embedded((AS().maps || {}).overview, ctx.s);
  // Credit under the sources: the Spanish IGN + Catastro note for the Spanish maps, else the credit of the provider.
  function mapCredit(ctx) {
    if (!hasLL(ctx.s)) return '';
    const p = mapProv(ctx);
    if (sampleTiles(ctx) || p.id === 'es-ign') return ctx.T.mapCredit;
    return p.tile ? (p.creditAt ? p.creditAt(mapZoom(ctx, 'micro', 16)) : p.attribution) : '';
  }
  function embedded(mp, s) {
    return !!(mp && mp.tiles && hasLL(s) && Math.abs(CH().project(mp.z, s.lat, s.lon)[0] - mp.x0 - mp.w / 2) < mp.w &&
      Math.abs(CH().project(mp.z, s.lat, s.lon)[1] - mp.y0 - mp.h / 2) < mp.h);
  }

  // Classes and CSS variables of the cover layers (report.css, "cover layers"). The page colour is the background
  // colour, or the shade colour under a map or a photo (as in 1.0.0).
  function coverLook(ctx) {
    const L = ctx.D.layers || coverModel(ctx.D);
    const P = ctx.P;
    const ink = coverInk(L, P, ctx.D);
    const c1 = colorOf(L.bg.c1, P, ctx.D);
    const c2 = colorOf(L.bg.c2, P, ctx.D);
    const shade = colorOf(L.shade.color, P, ctx.D);
    const base = L.bg.type === 'map' || L.bg.type === 'photo' ? shade : c1;
    const cls = ['page--cover', `cv-bg-${L.bg.type}`, `cv-shape-${L.bg.shape}`, `cv-shade-${L.shade.mode}`, `cv-motif-${L.motif.type}`,
      `cv-txt-${ink.dark ? 'dark' : 'light'}`, `cv-logo-${L.logo.pos}`, `cv-al-${L.text.align}`, (ctx.D.cover || {}).showPanel === false ? 'cv-nopanel' : '',
      L.legacy ? 'cv-legacy' : ''];
    const vars = { base, c1, c2, mid: mix(c1, c2, 0.5), ang: `${L.bg.angle}deg`, shade, so: Math.round(L.shade.opacity) / 100, 'logo-h': `${L.logo.size}mm`,
      'logo-k': Math.round((L.logo.size / 14) * 1000) / 1000, band: P.brand };
    return { L, ink, cls: cls.filter(Boolean).join(' '), style: Object.keys(vars).map((k) => `--cv-${k}:${vars[k]}`).join(';') + ';' };
  }

  function pCover(ctx) {
    const { s, m, T, L } = ctx;
    const look = ctx.look || coverLook(ctx);
    const LY = look.L;
    const CV = ctx.D.cover || {};
    // Cover texts have an automatic default in every language: a custom text counts only in the language it was written in
    // (a plain string, or the language-neutral "_", counts in all of them).
    const own = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v[ctx.lang] || v._ || '' : v || '');
    const txtOr = (k, d) => String(own(CV[k])).trim() || d;
    const cover = ctx.photos.find((p) => p.cover);
    const photo = ctx.D.coverImage || (cover && cover.dataUrl) || null;
    const map = () => {
      if (!hasLL(s)) return '';
      const A = AS().maps || {};
      const mp = embedded(A.micro, s) ? A.micro : baseMap(ctx) === 'tiles' ? { z: mapZoom(ctx, 'micro', 16), center: [s.lat, s.lon], w: 840, h: 712 } : null;
      if (!mp) return '';
      return CH().map(mp, [{ lat: s.lat, lon: s.lon, kind: 'subject', label: s.address }], { provider: mapProv(ctx), duotone: true, duo: [ctx.P.duoDark, ctx.P.duoLight], scaleBar: false, north: false, markerScale: 1.35, aspect: 1.18, ink: ctx.P.deep, title: 'Map' });
    };
    const img = photo ? `<img class="cover-photo" src="${esc(photo)}" alt="">` : '';
    // The motif is drawn in the visual area, under the shade (as in 1.0.0): white on a dark cover, ink on a light one.
    const light = !look.ink.dark;
    const lines = (stroke) => (LY.motif.type === 'grid' ? coverBlueprint(stroke) : coverLines(stroke));
    const motif = LY.motif.type === 'lines' || LY.motif.type === 'grid' ? lines(light ? (LY.motif.type === 'grid' ? '#fff' : '#ffffff') : ctx.D.ink) : '';
    let visual = '';
    if (LY.bg.type === 'photo') visual = img || map() || (motif ? '' : coverLines());
    else if (LY.bg.type === 'map') visual = map() || img || (motif ? '' : coverLines());
    const logo = logoHtml(ctx, light, 'cover', LY.logo.plate);
    const bottomLogo = LY.logo.pos === 'bl';
    return `<div class="cover-visual">${visual}${motif}</div><div class="cover-shade"></div>${LY.motif.type === 'band' ? '<div class="cover-band"></div>' : ''}
<div class="cover-top">${bottomLogo ? '' : logo}<div class="cover-ref"><span>${esc(T.reportTitle)}</span>${CV.showRef === false ? '' : `<strong>${esc(T.ref)} ${esc(m.reportNo)}</strong>`}</div></div>
<div class="cover-main">
  <div class="cover-kicker">${esc(txtOr('kicker', T.coverKicker))}</div>
  <h1 class="cover-title">${esc(txtOr('title', T.coverTitle))}<em>${esc(txtOr('titleEm', ctx.noun.of))}</em></h1>
  <div class="cover-address"><strong>${esc(s.address)}${s.floorDoor ? ' · ' + esc(s.floorDoor) : ''}</strong><span>${esc([s.zone, [s.postalCode, s.municipality].filter(Boolean).join(' ')].filter(Boolean).join(' · '))}${s.province ? ` (${esc(s.province)})` : ''}</span></div>
  ${CV.showStandards === false ? '' : `<div class="cover-standards">${esc(txtOr('standards', methodsLine(ctx) || T.coverStandards))}</div>`}
</div>
${CV.showPanel === false ? '' : `<div class="cover-panel">
  <div><span class="lbl">${esc(T.applicant)}</span><strong>${esc(m.client && m.client.name)}</strong><span>${esc(L(m.client && m.client.role))}</span></div>
  <div><span class="lbl">${esc(T.preparedBy)}</span><strong>${esc(m.advisor && m.advisor.name)}</strong><span>${esc([L(m.advisor && m.advisor.role), m.office && m.office.name].filter(Boolean).join(' · '))}</span></div>
  <div><span class="lbl">${esc(T.valuationDate)}</span><strong>${ctx.DATE(m.valuationDate)}</strong><span>${esc(T.visit)}: ${ctx.DATE(m.visitDate)}</span></div>
</div>`}
${bottomLogo ? `<div class="cover-logo-b">${logo}</div>` : ''}
<div class="cover-foot"><span>${esc(txtOr('foot', T.coverFoot))}</span><span>${esc((m.office && m.office.web) || '')}</span></div>`;
  }

  // Automatic cover texts in the report language (the cover editor shows them as placeholders).
  function coverTexts(state) {
    const lang = I().norm((state.meta || {}).reportLang || 'es');
    const T = RI()[lang] || RI().en;
    const cat = (TX() && (TX().categoryOf(((state.subject || {}).propertyType || {}).code) || {}).id) || 'residential';
    const n = (T.nouns && (T.nouns[cat] || T.nouns.residential)) || { of: '' };
    return { kicker: T.coverKicker, title: T.coverTitle, titleEm: n.of, standards: T.coverStandards, foot: T.coverFoot };
  }

  function pSummary(ctx) {
    const { res, s, mk, st, T, N, EUR, PM2, M2, PCT, L } = ctx;
    const ci = Math.round((res.stats.ciLevel || 0.95) * 100);
    const lo = Math.min(res.rangeLow || res.total, res.total) * 0.96;
    const hi = Math.max(res.rangeHigh || res.total, res.listingPrice || res.total) * 1.03;
    const markers = st.showListingPrice !== false && res.listingPrice ? [{ v: res.listingPrice, label: `${T.rangeListing} ${N(res.listingPrice)}` }] : [];
    const range = res.rangeLow != null && res.total ? CH().rangeBar({ onDark: true, min: lo, max: hi, lo: res.rangeLow, hi: res.rangeHigh, value: res.total, valueLabel: `${T.rangeValue} ${N(res.total)}`, markers, width: 600, height: 64, title: T.rangeLabel(ci) }) : '';
    const bars = ctx.used.length ? CH().hbars({ mode: 'dot', items: ctx.used.map((x) => ({ label: x.c.id, sub: x.c.zone, value: x.r.unitHomog })),
      ref: { value: res.unitValue, label: T.adopted(PM2(res.unitValue)) }, band: res.stats.ciLow != null ? { lo: res.stats.ciLow, hi: res.stats.ciHigh } : null,
      width: 400, labelW: 86, rowH: 25, unit: CUR() + '/m²', title: T.homogTitle }) : '';
    const outdoor = (s.terraceM2 || 0) + (s.galleryM2 || 0);
    const suite = (s.rooms || []).some((r) => /suite|in camera|en-suite/i.test(roomText(r.name)));
    const kpis = [
      [M2(res.refArea, 0), T.kpiBuilt, s.areaBuiltCommon ? T.kpiWithCommon(M2(s.areaBuiltCommon, 0)) : ''],
      [M2(res.usefulArea), T.kpiUseful, outdoor ? T.kpiOutdoor(M2(outdoor)) : ''],
      [`${s.bedrooms ?? '—'} · ${s.bathrooms ?? '—'}`, ctx.noun.rooms, suite ? T.ensuite : ''],
      [ctx.floorName(s.floor), T.kpiFloor, `${s.exterior ? T.exterior : T.interior} ${s.elevator ? T.withLift : T.withoutLift}`],
      [String(s.yearBuilt || '—'), T.kpiYear, ctx.cond(s.condition).toLowerCase()],
      [[s.parking ? T.annexP : '', s.storage ? T.annexT : ''].filter(Boolean).join(' + ') || '—', T.kpiAnnexes, [s.parking ? T.parking : '', s.storage ? T.storage : ''].filter(Boolean).join(` ${T.and} `)],
    ];
    const qIdx = { alta: 3, media: 2, baja: 1 }[res.quality] || 0;
    const series = (mk.series || []).map((p) => p.v);
    return `${plainHead(T.summaryKicker, T.summaryTitle, 'summary')}
<div class="hero">
  <div class="hero-main">
    <div class="hero-lbl">${esc(T.mostProbable)}</div>
    <div class="hero-val">${EUR(res.total)}</div>
    <div class="hero-words">${res.total ? esc(cap(I().currencyWords(res.total, ctx.lang))) : ''}</div>
    <div class="hero-note">${esc([ctx.typeName, s.parking ? T.parkingSpace : '', s.storage ? T.storageRoom : ''].filter(Boolean).join(', '))} · ${esc(T.at(ctx.DATE(ctx.m.valuationDate)))}</div>
  </div>
  <div class="hero-side">
    <div class="hs"><span class="hs-v">${PM2(res.unitValue)}</span><span class="hs-l">${esc(T.unitDwelling(M2(res.refArea, 0), ctx.noun))}</span></div>
    ${res.rangeLow != null ? `<div class="hs"><span class="hs-v">${EUR(res.rangeLow)} – ${EUR(res.rangeHigh)}</span><span class="hs-l">${esc(T.rangeLabel(ci))}</span></div>` : ''}
    ${st.showListingPrice !== false ? `<div class="hs"><span class="hs-v">${EUR(res.listingPrice)}</span><span class="hs-l">${esc(T.listingPrice)}</span></div>` : ''}
  </div>
  <div class="hero-range">${range}</div>
</div>
<div class="kpis">${kpis.map((k) => `<div class="kpi"><div class="kpi-v">${esc(k[0])}</div><div class="kpi-l">${esc(k[1])}</div><div class="kpi-s">${esc(k[2])}</div></div>`).join('')}</div>
<div class="sum-grid">
  <div class="panel">${h3(T.homogTitle, T.homogSub(ctx.noun))}${bars}<p class="caption">${esc(T.bandCaption(ci))} ${ctx.excluded.length && ctx.sections.sample ? esc(T.excludedRefs(ctx.excluded.length, ctx.sections.sample.no)) : ''}</p></div>
  <div class="stack">
    <div class="panel panel--tint">${h3(T.marketContext)}
      <div class="mkt"><div><div class="mkt-v">${PM2(mk.cityAvg)}</div><div class="mkt-l">${esc(T.avgAsking(s.municipality || ''))}</div></div>${series.length > 2 ? CH().sparkline(series, { width: 110, height: 36 }) : ''}</div>
      <div class="mkt-delta"><strong>${PCT(mk.yoy, 1, true)}</strong> ${esc(T.yoy)} · <strong>${PCT(mk.qoq, 1, true)}</strong> ${esc(T.qoq)}</div>
      <div class="mkt-src">${esc(T.source)}: ${esc(L(mk.source))}${L(mk.month) ? ', ' + esc(L(mk.month)) : ''}</div>
    </div>
    <div class="panel">${h3(T.quality)}
      <div class="qrow"><span>${esc(T.compsUsed)}</span><strong>${ctx.used.length} ${esc(T.of)} ${ctx.comps.length}</strong></div>
      <div class="qrow"><span>${esc(T.cv)}</span><strong>${PCT(res.stats.cv)}</strong></div>
      <div class="qrow"><span>${esc(T.avgGross)}</span><strong>${PCT(avg(ctx.used.map((x) => x.r.grossAdj)), 0)}</strong></div>
      <div class="qrow"><span>${esc(T.reliability)}</span><strong class="qpill q${qIdx}">${esc(T.q[res.quality] || '—')}</strong></div>
      <div class="qmeter"><span class="${qIdx >= 1 ? 'on' : ''}"></span><span class="${qIdx >= 2 ? 'on' : ''}"></span><span class="${qIdx >= 3 ? 'on' : ''}"></span></div>
    </div>
  </div>
</div>
<div class="pros-cons">
  <div>${h3(T.strengths)}${ul(listItems(txt(ctx, 'pros', false)), 'ticks')}</div>
  <div>${h3(T.considerations)}${ul(listItems(txt(ctx, 'cons', false)), 'flags')}</div>
</div>`;
  }

  function pTocLetter(ctx) {
    const { m, s, T, L } = ctx;
    const rows = ctx.sectionPage.summary != null ? [`<div class="toc-row toc-row--plain" data-toc-target="summary"><span class="toc-n">${ctx.sectionPage.summary}</span><span class="toc-no"></span><span class="toc-l">${esc(T.summaryTitle)}</span></div>`] : [];
    ctx.order.forEach((id) => {
      const sec = ctx.sections[id];
      if (!sec || ctx.sectionPage[id] == null) return;
      rows.push(`<div class="toc-row" data-toc-target="${id}"><span class="toc-n">${ctx.sectionPage[id]}</span><span class="toc-no">${String(sec.no).padStart(2, '0')}</span><span class="toc-l">${esc(sec.title)}</span></div>`);
    });
    const name = String((m.client && m.client.name) || '');
    const sex = /^(d\.|don|sr\.?|sig\.|mr\.?)\s/i.test(name) ? 'm' : /^(d(ña|ª)\.?|doña|sra\.?|sig\.ra|mrs\.?|ms\.?)\s/i.test(name) ? 'f' : 'x';
    const surname = name.replace(/^(d\.?|dña\.?|dª\.?|don|doña|sr\.?|sra\.?|sig\.?(ra)?|mrs?\.?|ms\.?)\s+/i, '').split(/\s+/).slice(1, 2).join(' ');
    // A language pack may give the salutation as a function of the surname (title after the name: zh, hu).
    const dear = T.dear[sex];
    const greeting = typeof dear === 'function' ? `${dear(sex !== 'x' ? surname : '')}${T.dearEnd}` : `${dear}${sex !== 'x' && surname ? ' ' + surname : ''}${T.dearEnd}`;
    const b = ctx.brand;
    const band = b.showBand !== false ? `<div class="brand-band">${logoHtml(ctx, true, 'band')}<span>${esc(ctx.LD(b.tagline))}</span><span class="bb-web">${esc((m.office && m.office.web) || '')}</span></div>` : '';
    const showToc = ctx.on('toc');
    const showLetter = ctx.on('letter');
    const sig = isRaster(m.advisor && m.advisor.signature) ? `<img class="sign-img sign-img--letter" src="${esc(m.advisor.signature)}" alt="">` : '';
    const letter = !showLetter ? '' : `<div class="letter">
    <div class="letter-meta">${esc(s.municipality || '')}, ${ctx.DATE(m.reportDate)}</div>
    <div class="letter-to"><strong>${esc(name)}</strong><br>${esc(s.address || '')}${s.floorDoor ? ', ' + esc(s.floorDoor) : ''}<br>${esc([s.postalCode, s.municipality].filter(Boolean).join(' '))}${s.province ? ` (${esc(s.province)})` : ''}</div>
    <div class="letter-ref">${esc(T.subjectLine(m.reportNo || ''))}</div>
    <p>${esc(greeting)}</p>
    ${txt(ctx, 'letter')}
    <div class="letter-sign"><span>${esc(T.regards)}</span>${sig}<strong>${esc(m.advisor && m.advisor.name)}</strong><span>${esc([L(m.advisor && m.advisor.role), m.office && m.office.name].filter(Boolean).join(' · '))}</span></div>
  </div>`;
    const toc = showToc ? `<nav class="toc"><div class="toc-title">${esc(T.toc)}</div>${rows.join('')}</nav>` : '';
    const head = showToc ? plainHead(T.tocKicker, T.tocTitle, 'toc') : plainHead(T.letterKicker, T.letterTitle, 'toc');
    return `${head}
<div class="toc-letter${showToc && showLetter ? '' : showToc ? ' toc-letter--toc' : ' toc-letter--letter'}">${toc}${letter}</div>
${band}`;
  }

  function pScope(ctx) {
    const { m, st, T, L } = ctx;
    const office = m.office || {};
    return `${secHead(ctx, 'scope')}
<div class="cols-2-1">
  <div>
    ${h3(T.s11)}${paras(txt(ctx, 'purpose', false))}
    ${h3(T.s12)}
    <blockquote class="def">${esc(T.mvDef)}<cite>${esc(T.mvCite)}</cite></blockquote>
    <p>${esc(T.mvNote(I().currencyName(ctx.lang)))}</p>
    ${h3(T.s13)}${ul(listItems(txt(ctx, 'scope', false)))}
  </div>
  <aside class="side">
    <div class="facts">
      <div class="fact"><span>${esc(T.applicant)}</span><strong>${esc(m.client && m.client.name)}</strong><em>${esc(L(m.client && m.client.role))}</em></div>
      <div class="fact"><span>${esc(T.advisor)}</span><strong>${esc(m.advisor && m.advisor.name)}</strong><em>${esc(office.name || '')}${office.license ? ` · ${esc(T.license)} ${esc(office.license)}` : ''}</em></div>
      <div class="fact"><span>${esc(T.visitDate)}</span><strong>${ctx.DATE(m.visitDate)}</strong></div>
      <div class="fact"><span>${esc(T.valuationDate)}</span><strong>${ctx.DATE(m.valuationDate)}</strong></div>
      <div class="fact"><span>${esc(T.reportDate)}</span><strong>${ctx.DATE(m.reportDate)}</strong></div>
      <div class="fact"><span>${esc(T.validity)}</span><strong>${esc(T.months(st.validityMonths || m.validityMonths || 6))}</strong></div>
      <div class="fact"><span>${esc(T.reference)}</span><strong>${esc(m.reportNo || '—')}</strong>${m.internalRef ? `<em>${esc(T.internalRef(m.internalRef))}</em>` : ''}</div>
    </div>
  </aside>
</div>
${h3(T.s14)}
<div class="std-grid">${(ctx.cty.cc === 'ES' ? T.stds : T.stds.slice(0, 3).concat(ctx.cty.std ? [[ctx.cty.std, T.stdNational(ctx.cty.name)]] : [])).map((x) => `<div class="std"><strong>${esc(x[0])}</strong><p>${esc(x[1])}</p></div>`).join('')}</div>
<div class="callout callout--warn"><strong>${esc(T.natureTitle)}</strong> ${T.nature(esc(ctx.brand.name || ''), { inName: esc(ctx.cty.inName), reserved: esc(ctx.cty.reserved), law: esc(ctx.cty.law) })}</div>`;
  }

  function pLocation(ctx) {
    const { s, T } = ctx;
    const A = AS().maps || {};
    const pts = [{ lat: s.lat, lon: s.lon, kind: 'subject', label: T.property, name: [s.address, s.floorDoor].filter(Boolean).join(', ') }]
      .concat(ctx.comps.map((x) => ({ lat: x.c.lat, lon: x.c.lon, kind: x.r.include ? 'comp' : 'ref', label: x.c.id, name: [x.c.id, x.c.address].filter(Boolean).join(' · ') })));
    const poiPts = ctx.pois.map((p, i) => ({ lat: p.lat, lon: p.lon, kind: 'poi', label: String(i + 1), name: p.nameL }));
    const microOpts = { base: baseMap(ctx), provider: mapProv(ctx), title: T.situation, saturate: 0.35, markerScale: 1.75, aspect: 1.23, uiScale: 1.6, ink: ctx.P.deep };
    const useEmbedded = (mp) => mp && mp.tiles && hasLL(s) && Math.abs(CH().project(mp.z, s.lat, s.lon)[0] - mp.x0 - mp.w / 2) < mp.w && Math.abs(CH().project(mp.z, s.lat, s.lon)[1] - mp.y0 - mp.h / 2) < mp.h;
    const microPts = [pts[0]].concat(pts.slice(1)).concat(poiPts).filter(hasLL);
    const micro = useEmbedded(A.micro) ? CH().map(A.micro, microPts, microOpts) : (hasLL(s) ? CH().map({ z: mapZoom(ctx, 'micro', 16), center: [s.lat, s.lon], w: 840, h: 560 }, microPts, microOpts) : '');
    const over = useEmbedded(A.overview) ? CH().map(A.overview, pts.filter(hasLL), { title: T.sampleMap, saturate: 0.3, markerScale: 1.55, aspect: 0.6, uiScale: 1.45, ink: ctx.P.deep })
      : (hasLL(s) ? CH().map({ z: mapZoom(ctx, 'overview', 15), center: [s.lat, s.lon], w: 620, h: 1030 }, pts.filter(hasLL), { base: baseMap(ctx), provider: mapProv(ctx), title: T.sampleMap, saturate: 0.3, markerScale: 1.55, aspect: 0.6, uiScale: 1.45, ink: ctx.P.deep }) : '');
    return `${secHead(ctx, 'location')}
<div class="lead">${txt(ctx, 'location')}</div>
<div class="maps">
  <div class="maps-left">
    <figure class="map-fig">${micro}<figcaption><strong>${esc(T.situation)}</strong> ${esc(T.situationCap)}</figcaption></figure>
    ${h3(T.distances, T.straight)}
    <table class="tbl tbl--compact"><tbody>${ctx.pois.map((p, i) => `<tr><td><span class="poi-n">${i + 1}</span>${esc(p.nameL)}</td><td class="num">${ctx.KM(p.d)}</td></tr>`).join('')}</tbody></table>
  </div>
  <figure class="map-fig map-fig--tall">${over}<figcaption><strong>${esc(T.sampleMap)}</strong> <i class="dot dot--subject"></i> ${esc(T.property)} · <i class="dot dot--comp"></i> ${esc(T.compsIn)} · <i class="dot dot--ref"></i> ${esc(T.refsOut)}</figcaption></figure>
</div>
${h3(T.environment)}${ul(listItems(txt(ctx, 'environment', false)), 'bullets bullets--2col')}`;
  }

  function pDescription(ctx) {
    const { s, T, L, N } = ctx;
    const F = T.feats;
    const feats = [[F.lift, s.elevator], [F.exterior, s.exterior], [F.ac, s.ac], [F.heating, s.heating], [F.intercom, s.intercom],
      [F.terrace, (s.terraceM2 || 0) > 0], [F.gallery, (s.galleryM2 || 0) > 0], [F.parking, s.parking], [F.storage, s.storage], [F.pool, s.pool]];
    const idRows = [
      [T.idAddress, `${s.address || ''}${s.floorDoor ? ', ' + s.floorDoor : ''}`], [T.idTown, `${[s.postalCode, s.municipality].filter(Boolean).join(' ')}${s.province ? ` (${s.province})` : ''}`],
      [T.idZone, s.zone || '—'], [T.idType, T.typeIn(ctx.typeName || '—')], [T.idUse, L(s.cadastralUse) || '—'], [T.idYear, s.yearBuilt || '—'],
      [T.idOrient, cap(ctx.orient(s.orientation)) || '—'], [T.idFees, s.communityFee != null ? T.perMonth(N(s.communityFee)) : '—'],
      [T.idUtilities, [s.electricity ? `${T.electricity} ${s.electricity}` : '', s.gas ? `${T.gas} ${s.gas}` : ''].filter(Boolean).join(' · ') || '—'],
      [T.idEnergy, s.energyCert ? T.energyClass(s.energyCert) : T.notProvided],
    ];
    const tm = (s.rooms || []).length ? `<figure class="tm-fig">${CH().treemap({ items: (s.rooms || []).map((r) => ({ label: L(r.name), value: +r.m2 || 0, group: roomGroup(r.name) })), width: 660, height: 132, title: T.programme })}
<figcaption>${esc(T.programme(ctx.noun))} · ${T.groups.map((g, i) => `<i class="sw sw${i}"></i>${esc(g)}`).join(' ')}</figcaption></figure>` : '';
    return `${secHead(ctx, 'description')}
<div class="desc-top">
  <div>${h3(T.s31)}<table class="kv"><tbody>${idRows.map((r) => `<tr><th>${esc(r[0])}</th><td>${esc(r[1])}</td></tr>`).join('')}</tbody></table></div>
  <div>${h3(T.equipment)}<div class="feats">${feats.map((f) => `<div class="feat ${f[1] ? 'on' : 'off'}"><i></i>${esc(f[0])}</div>`).join('')}</div>
    <div class="mini-kpis"><div><strong>${s.bedrooms ?? '—'}</strong><span>${esc(T.miniBed)}</span></div><div><strong>${s.bathrooms ?? '—'}</strong><span>${esc(T.miniBath)}</span></div><div><strong>${esc(ctx.floorName(s.floor))}</strong><span>${esc(T.miniFloor)}</span></div><div><strong>${s.neighbours || '—'}</strong><span>${esc(T.miniNeighbours)}</span></div></div>
  </div>
</div>
${h3(T.s32)}${txt(ctx, 'building')}
${h3(T.s33(ctx.noun))}${txt(ctx, 'dwelling')}
${tm}
${h3(T.s34)}${txt(ctx, 'condition')}
${h3(T.s35)}${txt(ctx, 'annexes')}`;
  }

  function pSurfaces(ctx) {
    const { s, res, T, L, N, M2 } = ctx;
    const rooms = s.rooms || [];
    const groups = T.groups.map((g) => ({ label: g, value: 0 }));
    rooms.forEach((r) => { groups[roomGroup(r.name)].value += +r.m2 || 0; });
    const useful = res.usefulArea || 0;
    const outdoor = (s.terraceM2 || 0) + (s.galleryM2 || 0);
    const ratio = s.areaBuilt && useful ? s.areaBuilt / (useful + outdoor) : null;
    const refA = M2(res.refArea, res.refArea % 1 ? 2 : 0);
    const hasCat = s.cadastralParcel || s.cadastralRef;
    // Spanish references have 20 characters: the first 14 name the parcel, the last 6 the unit. Other countries' references
    // are shown whole, and the Spanish source is named only for Spanish properties.
    const isES = ctx.cty.cc === 'ES';
    const unitRef = (r) => (isES && /^[0-9A-Z]{20}$/i.test(String(r || '').replace(/\s+/g, '')) ? String(r).replace(/\s+/g, '').slice(14) : String(r || ''));
    const cat = hasCat ? `${h3(T.s39, isES ? T.catSource : '')}
<div class="cat-box">
  <div><span>${esc(T.catParcel)}</span><strong>${esc(s.cadastralParcel || '—')}</strong></div>
  <div><span>${esc(T.catUnit(s.floorDoor || ''))}</span><strong>${esc(unitRef(s.cadastralRef) || '—')}${s.cadastralRefAlt ? ` / ${esc(unitRef(s.cadastralRefAlt))}` : ''}</strong>${s.cadastralRefAlt ? `<em>${esc(T.catStair)}</em>` : ''}</div>
  <div><span>${esc(T.catAddress)}</span><strong>${esc(s.cadastralAddress || '—')}</strong></div>
  <div><span>${esc(T.catUseYear)}</span><strong>${esc(L(s.cadastralUse) || '—')} · ${esc(s.cadastralYear || '—')}</strong></div>
  <div><span>${esc(T.catBuilt)}</span><strong>${M2(s.areaBuiltCommon, 0)}</strong>${s.cadastralPrivate ? `<em>${esc(T.catSplit(M2(s.cadastralPrivate, 0), M2(s.cadastralCommon, 0)))}</em>` : ''}</div>
  <div><span>${esc(T.catShare)}</span><strong>${s.cadastralShare != null ? N(s.cadastralShare, 4) + '%' : '—'}</strong></div>
</div>
<p class="note">${esc(T.catNote((s.cadastralAddress || '').split(',')[0] || '—', [s.cadastralRef, s.cadastralRefAlt].filter(Boolean).join(' · ') || '—'))}</p>` : '';
    return `${secHead(ctx, 'description', true)}
<div class="surf-grid">
  <div>${h3(T.s36, T.measured)}
    <table class="tbl rooms"><thead><tr><th>${esc(T.room)}</th><th class="num">m²</th></tr></thead><tbody>
      ${rooms.map((r) => `<tr><td><i class="sw sw${roomGroup(r.name)}"></i>${esc(L(r.name))}</td><td class="num">${N(+r.m2, 2)}</td></tr>`).join('')}
      <tr class="sub"><td>${esc(T.usefulInt)}</td><td class="num">${N(useful, 2)}</td></tr>
      ${s.terraceM2 ? `<tr><td>${esc(T.terrace)}</td><td class="num">${N(s.terraceM2, 2)}</td></tr>` : ''}
      ${s.galleryM2 ? `<tr><td>${esc(T.gallery)}</td><td class="num">${N(s.galleryM2, 2)}</td></tr>` : ''}
      <tr class="tot"><td>${esc(T.usefulTotal)}</td><td class="num">${N(useful + outdoor, 2)}</td></tr>
    </tbody></table></div>
  <div>${h3(T.s37)}
    <table class="tbl"><tbody>
      <tr><td>${esc(T.rUseful)}</td><td class="num">${M2(useful)}</td></tr>
      <tr><td>${esc(T.rUsefulOut)}</td><td class="num">${M2(useful + outdoor)}</td></tr>
      <tr><td>${esc(T.rBuilt)}</td><td class="num">${M2(s.areaBuilt, 0)}</td></tr>
      <tr><td>${esc(T.rBuiltCommon)}</td><td class="num">${M2(s.areaBuiltCommon, 0)}</td></tr>
      <tr class="tot"><td>${esc(T.rRef)}</td><td class="num">${refA}</td></tr>
    </tbody></table>
    <div class="callout">${T.criterion(esc(T.basis[ctx.st.areaBasis || 'built'] || T.basis.built), esc(refA))}${ratio ? esc(T.ratio(N(ratio, 2))) : ''}</div>
  </div>
</div>
${h3(T.s38)}
${CH().segBar({ parts: groups, width: 640, title: T.s38 })}
<div class="seg-legend">${groups.map((g, i) => (g.value > 0 ? `<span><i class="sw sw${i}"></i>${esc(g.label)} · ${M2(g.value)}</span>` : '')).join('')}</div>
${cat}
<div class="callout callout--muted defs"><strong>${esc(T.defsTitle)}</strong> ${esc(ctx.cty.cc === 'ES' ? T.defsSrc : T.defsSrcCountry(ctx.cty.area))}
${T.defs.map((d) => `<span><b>${esc(d[0])}:</b> ${esc(d[1])}</span>`).join('')}</div>`;
  }

  function pMarket(ctx) {
    const { mk, T, L, PM2, PCT, N, res, lang } = ctx;
    const series = (mk.series || []).filter((p) => /^\d{4}-\d{2}/.test(p.m || '')).map((p, i) => ({ label: I().monthShort(+p.m.slice(5, 7) - 1, lang) + (p.m.slice(5, 7) === '01' || i === 0 ? ' ' + p.m.slice(2, 4) : ''), v: p.v }));
    const districts = (mk.districts || []).filter((d) => d.v > 0).slice().sort((a, b) => b.v - a.v);
    const seriesMax = (mk.series || []).length ? Math.max.apply(null, mk.series.map((p) => p.v)) : null;
    const tiles = [
      [PM2(mk.cityAvg), T.kAvg, `${ctx.s.municipality || ''} · ${L(mk.month)}`],
      [PCT(mk.yoy, 1, true), T.kYoy, seriesMax != null && mk.cityAvg >= seriesMax ? T.kSeriesMax : T.kLast12],
      [PCT(mk.qoq, 1, true), T.kQoq, `${T.mom} ${PCT(mk.mom, 1, true)}`],
      [PM2(res.unitTotal), T.kSubject, T.kSubjectSub],
    ];
    return `${secHead(ctx, 'market')}
<div class="kpis kpis--4">${tiles.map((k) => `<div class="kpi"><div class="kpi-v">${esc(k[0])}</div><div class="kpi-l">${esc(k[1])}</div><div class="kpi-s">${esc(k[2])}</div></div>`).join('')}</div>
<div class="panel">${h3(T.trendTitle(ctx.s.municipality || ''), T.trendSub)}${series.length > 1 ? CH().line({ points: series, unit: CUR() + '/m²', width: 660, height: 190, title: T.trendTitle(ctx.s.municipality || '') }) : ''}</div>
<div class="mkt-grid">
  <div class="panel">${h3(T.districtsTitle, `${CUR()}/m² · ${L(mk.month)}`)}${districts.length ? CH().hbars({ items: districts.map((d) => ({ label: d.name, value: d.v })), ref: { value: mk.cityAvg, label: T.cityAvgRef(N(mk.cityAvg)) }, min: 0, width: 330, labelW: 118, rowH: 21, top: 30, unit: CUR() + '/m²', title: T.districtsTitle }) : ''}</div>
  <div class="mkt-text">${txt(ctx, 'market')}</div>
</div>
${(mk.references || []).length ? `<table class="tbl tbl--compact refs"><thead><tr><th>${esc(T.otherRefs)}</th><th class="num">${esc(T.value)}</th></tr></thead><tbody>${mk.references.map((r) => `<tr><td>${esc(L(r.label))}</td><td class="num">${esc(L(r.value))}</td></tr>`).join('')}</tbody></table>` : ''}
<p class="note">${esc(T.mainSource(L(mk.source), shortUrl(mk.sourceUrl)))}</p>`;
  }

  function pMethod(ctx) {
    const { st, T, N, PCT } = ctx;
    const uniform = st.scalePreset === 'uniform10';
    const neg = MCA().negotiationDefault(st);
    const formulas = ['', 'P′ = P × K<sub>neg</sub> × K<sub>t</sub> − V<sub>anejos</sub>', 'p<sub>i</sub> = P′<sub>i</sub> / S<sub>i</sub>',
      'p<sub>h,i</sub> = p<sub>i</sub> × ∏<sub>j</sub> k<sub>ij</sub> ; k<sub>ij</sub> = 1 + n<sub>ij</sub> · δ<sub>j</sub>',
      'w<sub>i</sub> = f<sub>i</sub> × max(0.2, 1 − Σ<sub>j</sub>|k<sub>ij</sub> − 1|)', 'V = p* × S<sub>ref</sub> + V<sub>anejos</sub> ; p* = Σ w<sub>i</sub> p<sub>h,i</sub> / Σ w<sub>i</sub>'];
    const stepText = (x, i) => (typeof x[1] === 'function' ? (i === 1 ? x[1](N(neg, 2), st.timeAdjust !== false ? PCT(st.timeTrendAnnual, 1) : '') : i === 2 ? x[1]((T.compArea || {})[st.areaBasis] || (T.compArea || {}).built || '') : x[1](uniform)) : x[1]);
    const deltaOf = (f) => (uniform ? 0.1 : f.delta);
    const ci = Math.round((ctx.res.stats.ciLevel || 0.95) * 100);
    return `${secHead(ctx, 'method')}
<div class="lead">${txt(ctx, 'methodIntro')}</div>
<ol class="steps">${T.steps.map((x, i) => `<li><span class="step-n">${i + 1}</span><div><h4>${esc(x[0])}</h4><p>${esc(stepText(x, i))}</p>${formulas[i] ? `<div class="formula">${formulas[i]}</div>` : ''}</div></li>`).join('')}</ol>
<div class="meth-grid">
  <div>${h3(T.factorsTitle)}
    <table class="tbl tbl--compact factors"><thead><tr><th>${esc(T.factor)}</th><th class="num">${esc(T.deltaLevel)}</th><th class="num">${esc(T.max)}</th></tr></thead><tbody>
    ${ctx.factors.map((f) => `<tr><td><strong>${esc(f.label)}</strong><span class="fdesc">${esc(f.desc)}</span></td><td class="num">${PCT(deltaOf(f), 1)}</td><td class="num">±${PCT(deltaOf(f) * 2, 0)}</td></tr>`).join('')}
    </tbody></table></div>
  <div>${h3(T.scaleTitle, T.scaleSub)}
    <table class="tbl tbl--compact scale"><thead><tr><th>${esc(T.level)}</th><th class="num">n</th><th class="num">${esc(T.kAt5)}</th></tr></thead><tbody>
    ${MCA().LEVELS.map((l, li) => `<tr><td>${esc((ctx.T.engine && ctx.T.engine.levels && ctx.T.engine.levels[li]) || l[ctx.lang] || l.en)}</td><td class="num">${l.v > 0 ? '+' : ''}${l.v}</td><td class="num">${N(1 + l.v * 0.05, 3)}</td></tr>`).join('')}
    </tbody></table>
    <div class="callout">${T.scaleRead}</div>
    <div class="callout callout--muted">${T.controls(ci)}</div>
  </div>
</div>`;
  }

  // ---------- method applied in this valuation (facts from src/js/method.js) ----------
  // Rows of the method table by part: 0 approach, 1 evidence, 2 adjustment, 3 weights and estimator, 4 confidence
  // interval, 5 uncertainty. Values are HTML-escaped here.
  function methodRows(ctx, F, rob) {
    const { T, N, PCT, EUR, L } = ctx;
    const X = T.ma;
    const rows = {};
    const add = (p, label, value) => { if (value) (rows[p] = rows[p] || []).push([label, esc(value)]); };
    add(0, X.approach, X.approachName);
    if (F.approach.active) {
      add(0, X.weightsAp, F.approach.used.map((k) => `${(T.ap.names || {})[k] || k} ${PCT(F.approach.weights[k] || 0, 0)}`).join(' · '));
      add(0, X.reason, L(F.approach.reason) || '—');
    }
    add(0, X.notComputed, F.approach.notComputed.map((a) => (X.apNames || {})[a] || a).join(' · '));
    const ev = F.evidence;
    add(1, X.comps, X.compsVal(ev.used, ev.total));
    add(1, X.sources, Object.keys(ev.bySource).map((k) => `${X.src[k] || k}: ${ev.bySource[k]}`).join(' · '));
    if (ev.dateFrom) add(1, X.dates, ev.dateFrom === ev.dateTo ? ctx.DATE(ev.dateFrom) : `${ctx.DATE(ev.dateFrom)} – ${ctx.DATE(ev.dateTo)}`);
    add(1, X.time, ev.time.on ? X.timeVal(PCT(ev.time.trend, 1), N(Math.round(ev.time.monthsMax), 0)) : X.timeNone);
    const ng = ev.negotiation;
    add(1, X.neg, [ng.onDefault ? X.negVal(N(ng.value, 2), ng.onDefault) : '', ng.own ? X.negOwn(ng.own) : ''].filter(Boolean).join('; ') || X.negClosed);
    add(1, X.negReason, L(ng.reason));
    const fs = F.adjustment.factors;
    if (fs.length) {
      const ds = fs.map((f) => f.delta);
      add(2, X.factors, X.factorsVal(fs.length, PCT(Math.min(...ds), 1), PCT(Math.max(...ds), 1)));
      const label = (id) => (ctx.factors.find((x) => x.id === id) || {}).label || id;
      const own = fs.filter((f) => f.origin === 'valuer').map((f) => `${label(f.id)} ${PCT(f.delta, 1)}${f.source ? ` (${f.source})` : ''}`);
      add(2, X.origin, X.originVal(fs.length - own.length, own.length) + (own.length ? ` — ${own.join('; ')}` : ''));
    }
    add(2, X.ovr, F.adjustment.overrides ? X.ovrVal(F.adjustment.overrides) : X.none);
    add(3, X.weight, X.weightVal);
    add(3, X.estimator, (T.est || {})[F.weights.estimator] || F.weights.estimator);
    if (F.ci) {
      add(4, X.level, X.levelVal(PCT(F.ci.level, 0), N(F.ci.nEff, 1), F.ci.n));
      add(4, X.unit, `${ctx.PM2(F.ci.low)} – ${ctx.PM2(F.ci.high)}`);
      add(4, X.meaning, X.meaningVal + (F.ci.approx ? ` ${X.approx}` : ''));
    }
    if (F.mc && rob) {
      const K = uncertaintyKpis(ctx.state, ctx.res, rob);
      add(5, X.mc, X.mcVal(EUR(K.p10), EUR(K.p50), EUR(K.p90), PCT(K.half, 1), N(F.mc.n)));
    }
    if (F.loo) add(5, X.loo, X.looVal(PCT(F.loo.maxAbs, 1), F.loo.id));
    if (F.mc) add(5, X.assumptions, T.uncMethod(N(F.mc.n)));
    return rows;
  }
  function methodTable(ctx, rows, parts) {
    const X = ctx.T.ma;
    return `<table class="tbl tbl--compact ma">${parts.filter((p) => rows[p]).map((p, i) => `<tbody><tr><th colspan="2">${i + 1}. ${esc(X.sec[p])}</th></tr>` +
      rows[p].map(([l, v]) => `<tr><td class="ma-l">${esc(l)}</td><td>${v}</td></tr>`).join('') + '</tbody>').join('')}</table>`;
  }
  // Technical report: a page after the method with what was done in this valuation, its limits and the reference.
  function pMethodApplied(ctx) {
    const X = ctx.T.ma;
    const rob = ctx.rob();
    const F = MT().facts(ctx.state, ctx.res, rob);
    return `${secHead(ctx, 'method', true)}
${h3(X.title, X.sub)}
${methodTable(ctx, methodRows(ctx, F, rob), [0, 1, 2, 3, 4, 5])}
${h3(X.sec[6])}${ul(X.limits)}
<p class="note">${esc(X.ref(ctx.DATE(F.doc.date)))}</p>`;
  }
  // Client report (method detail off): the short method chapter — approach, evidence, confidence interval, uncertainty.
  function pMethodShort(ctx) {
    const X = ctx.T.ma;
    const rob = ctx.rob();
    const F = MT().facts(ctx.state, ctx.res, rob);
    return `${secHead(ctx, 'method')}
<div class="lead">${txt(ctx, 'methodIntro')}</div>
${methodTable(ctx, methodRows(ctx, F, rob), [0, 1, 4, 5])}
<p class="note">${esc(X.ref(ctx.DATE(F.doc.date)))}</p>`;
  }

  function compRowCells(ctx, x) {
    const { T, N } = ctx;
    const c = x.c;
    const r = x.r;
    return `<td><span class="badge${r.include ? '' : ' badge--ref'}">${esc(c.id)}</span></td><td><strong>${esc(c.address)}</strong><span class="sub">${esc(c.zone)}</span></td>` +
      `<td class="num">${ctx.KM(r.distanceKm)}</td><td class="num">${N(c.price)}</td><td class="num">${N(c.areaBuilt)}</td><td class="num">${N(r.unitAsk)}</td>` +
      `<td class="c">${c.bedrooms ?? '—'}/${c.bathrooms ?? '—'}</td><td class="c">${esc(ctx.floorName(c.floor))}${c.elevator ? ' · ' + T.lift : ''}</td><td class="c">${c.newBuild ? esc(T.newBuild) : c.yearBuilt || '—'}</td>` +
      `<td>${esc(ctx.cond(c.condition))}</td><td class="c">${[c.parking ? T.annexP : '', c.storage ? T.annexT : ''].filter(Boolean).join('+') || '—'}</td>`;
  }

  function pSample(ctx) {
    const { T, L } = ctx;
    const H = T.th;
    return `${secHead(ctx, 'sample')}
<div class="lead">${txt(ctx, 'sample')}</div>
<table class="tbl sample"><thead><tr><th>${H.id}</th><th>${esc(H.loc)}</th><th class="num">${esc(H.dist)}</th><th class="num">${esc(H.price)}</th><th class="num">${H.m2}</th><th class="num">${H.pm2}</th><th class="c">${esc(H.db)}</th><th class="c">${esc(H.floor)}</th><th class="c">${esc(H.year)}</th><th>${esc(H.state)}</th><th class="c">${esc(H.annex)}</th></tr></thead>
<tbody>${ctx.used.map((x) => `<tr>${compRowCells(ctx, x)}</tr>`).join('')}
${ctx.excluded.length ? `<tr class="grp"><td colspan="11">${esc(T.excludedGroup)}</td></tr>${ctx.excluded.map((x) => `<tr class="ref">${compRowCells(ctx, x)}</tr>`).join('')}` : ''}</tbody></table>
<p class="note">${esc(T.sampleNote(ctx.DATE(ctx.m.valuationDate), ctx.comps.some((x) => x.c.approxLocation), ctx.priceKind))}</p>
${ctx.excluded.length ? `<div class="callout callout--muted"><h4>${esc(T.exclusionReasons)}</h4>${ctx.excluded.map((x) => `<p><span class="badge badge--ref">${esc(x.c.id)}</span> <strong>${esc(x.c.address)}.</strong> ${esc(L(x.c.excludeReason) || T.excludedByValuer)}</p>`).join('')}</div>` : ''}
<div class="callout">${T.selection(esc(ctx.s.zone || ctx.s.municipality || ''))}</div>`;
  }

  function compCard(ctx, x) {
    const { T, N, EUR, M2, L } = ctx;
    const c = x.c;
    const r = x.r;
    const C = T.card;
    const data = [
      [C.db, `${c.bedrooms ?? '—'} / ${c.bathrooms ?? '—'}`], [C.floor, ctx.floorName(c.floor)], [C.lift, ctx.yes(c.elevator)],
      [C.year, c.newBuild ? T.newBuildLong : c.yearBuilt || '—'], [C.state, ctx.cond(c.condition)], [C.orient, c.orientation ? cap(ctx.orient(c.orientation)) : '—'],
      [C.outdoor, (c.terraceM2 || 0) + (c.gardenM2 || 0) ? M2((c.terraceM2 || 0) + (c.gardenM2 || 0), 0) : '—'], [C.ps, `${ctx.yes(c.parking)} / ${ctx.yes(c.storage)}`],
      [C.pg, `${ctx.yes(c.pool)} / ${ctx.yes(c.garden)}`], [C.energy, c.energyCert ? T.energyClass(c.energyCert) : c.energyKwh ? T.kwh(N(c.energyKwh)) : '—'],
    ];
    return `<article class="comp-card${r.include ? '' : ' comp-card--ref'}">
  <header><span class="badge${r.include ? '' : ' badge--ref'}">${esc(c.id)}</span><div class="cc-t"><strong>${esc(c.address)}</strong><span>${esc(c.zone)} · ${ctx.KM(r.distanceKm)}</span></div><span class="chip ${r.include ? 'chip--in' : 'chip--out'}">${esc(r.include ? T.inCalc : T.reference)}</span></header>
  <div class="cc-price"><strong>${EUR(c.price)}</strong><span>${ctx.PM2(r.unitAsk)} · ${M2(c.areaBuilt, 0)}${c.areaUseful ? ` (${esc(T.usefulAbbr(M2(c.areaUseful, 0)))})` : ''}</span></div>
  <dl class="cc-data">${data.map((d) => `<div><dt>${esc(d[0])}</dt><dd>${esc(d[1])}</dd></div>`).join('')}</dl>
  <p class="cc-desc">${esc(L(c.description))}</p>
  ${r.include ? `<div class="cc-res"><span>${esc(T.homogenized)}</span><strong>${ctx.PM2(r.unitHomog)}</strong><span>${esc(T.kWeight(N(r.kTotal, 3), N(r.weight, 2)))}</span></div>` : `<div class="cc-res cc-res--ref">${esc(L(c.excludeReason))}</div>`}
  <footer>${esc(c.sourceName || '')}${c.url ? ` · ${esc(shortUrl(c.url))}` : ''}</footer>
</article>`;
  }

  const pCards = (ctx, chunk) => `${secHead(ctx, 'sample', true)}\n<div class="card-grid">${chunk.map((x) => compCard(ctx, x)).join('')}</div><!--grid-->`;

  const LVL_SYM = { 2: '++', 1: '+', 0: '=', '-1': '−', '-2': '−−' };
  function pHomog(ctx, chunk, idx, pages) {
    const { T, N, PCT } = ctx;
    const cols = chunk;
    const row = (label, fn, cls) => `<tr class="${cls || ''}"><td>${esc(label)}</td>${cols.map((x) => `<td class="num">${fn(x)}</td>`).join('')}</tr>`;
    const factorRows = ctx.factors.map((f) => `<tr><td>${esc(f.label)}</td>${cols.map((x) => {
      const fr = x.r.factors.find((y) => y.id === f.id) || { level: 0, k: 1 };
      return `<td class="num"><span class="lvl lvl${fr.level > 0 ? 'p' : fr.level < 0 ? 'n' : 'z'}">${LVL_SYM[fr.level]}</span><span class="k${fr.overridden ? ' ovr' : ''}">${N(fr.k, 3)}${fr.overridden ? '*' : ''}</span></td>`;
    }).join('')}</tr>`).join('');
    const heavy = ctx.used.filter((x) => x.r.grossAdj > 0.35).map((x) => x.c.id).join(', ');
    const neg = MCA().negotiationDefault(ctx.st);
    return `${secHead(ctx, 'homog', idx > 0)}
${idx === 0 ? `<p class="lead-sm">${T.homogLead(ctx.factors.length)}</p>` : ''}
<table class="tbl matrix"><thead><tr><th>${esc(T.concept)}</th>${cols.map((x) => `<th class="num"><span class="badge">${esc(x.c.id)}</span><span class="mz">${esc(x.c.zone)}</span></th>`).join('')}</tr></thead><tbody>
<tr class="grp"><td colspan="${cols.length + 1}">${esc(T.gPrice)}</td></tr>
${row(T.rAsk, (x) => N(x.c.price))}${row(T.rArea, (x) => N(x.r.area, 0))}${row(T.rUnitAsk, (x) => N(x.r.unitAsk))}
${row(T.rK, (x) => N(x.r.kSource * x.r.kTime, 3))}${row(T.rAnnex, (x) => { const v = x.r.annexDeduct ? '−' + N(x.r.annexDeduct) : '—'; return MCA().util.num(x.c.annexOverride) != null ? `<span class="ovr">${v}*</span>` : v; })}${row(T.rBase, (x) => N(x.r.unitBase), 'em')}
<tr class="grp"><td colspan="${cols.length + 1}">${esc(T.gFactors)}</td></tr>
${factorRows}
<tr class="grp"><td colspan="${cols.length + 1}">${esc(T.gResult)}</td></tr>
${row(T.rKt, (x) => N(x.r.kTotal, 3), 'em')}${row(T.rGross, (x) => PCT(x.r.grossAdj, 0))}${row(T.rHomog, (x) => `<strong>${N(x.r.unitHomog)}</strong>`, 'strong')}${row(T.rWeight, (x) => N(x.r.weight, 3))}
</tbody></table>
${cols.some((x) => MCA().util.num(x.c.annexOverride) != null || x.r.factors.some((f) => f.overridden)) ? `<p class="note">${esc(T.ovrNote)}</p>` : ''}
${pages > 1 ? `<p class="note">${esc(T.tableOf(idx + 1, pages))}</p>` : ''}
${idx === pages - 1 ? `<div class="callout callout--muted">${T.readTable(ctx.factors.length, esc(heavy), N(neg, 2), ctx.st.timeAdjust !== false ? PCT(ctx.st.timeTrendAnnual, 1) : '')}</div>` : ''}`;
  }

  function pHomogChart(ctx) {
    const { T, N, L } = ctx;
    const notes = ctx.used.map((x) => {
      const items = Object.entries(x.c.ratingNotes || {}).map(([k, v]) => [k, L(v)]).filter(([, v]) => v).map(([k, v]) => {
        const f = ctx.factors.find((y) => y.id === k);
        return `<li><strong>${esc(f ? f.label : k)}:</strong> ${esc(v)}</li>`;
      });
      return items.length ? `<div class="jn"><span class="badge">${esc(x.c.id)}</span><ul>${items.join('')}</ul></div>` : '';
    }).filter(Boolean);
    const bases = ctx.used.map((x) => x.r.unitBase);
    return `${secHead(ctx, 'homog', true)}
<div class="panel">${h3(T.baseToHomog, CUR() + '/m²')}${CH().dumbbell({ items: ctx.used.map((x) => ({ label: x.c.id, from: x.r.unitBase, to: x.r.unitHomog })), ref: { value: ctx.res.unitValue, label: T.adopted(N(ctx.res.unitValue)) }, fromLabel: T.basePrice, toLabel: T.homogenized, width: 660, rowH: 26, unit: CUR() + '/m²', title: T.baseToHomog })}
<p class="caption">${esc(T.rangeShrink(N(Math.min.apply(null, bases)), N(Math.max.apply(null, bases)), N(ctx.res.stats.min), N(ctx.res.stats.max)))}</p></div>
${h3(T.justification)}
<div class="jnotes">${notes.join('') || `<p>${esc(T.justFallback)}</p>`}</div>
<div class="callout callout--muted">${T.objective}</div>`;
  }

  // "8.1 Statistics" → numbered after the result chapter actually printed (chapters can be switched off).
  const sub = (ctx, label) => String(label).replace(/^\d+\./, `${ctx.sections.result.no}.`);

  function pResult(ctx) {
    const { res, st, s, T, N, EUR, PM2, PCT, M2 } = ctx;
    const ci = Math.round((res.stats.ciLevel || 0.95) * 100);
    const S = T.st;
    const statRows = [[S.n, String(res.stats.n)], [S.mean, PM2(res.stats.mean)], [S.median, PM2(res.stats.median)], [S.trimmed, PM2(res.stats.trimmed)],
      [S.weighted, PM2(res.stats.weighted)], [S.std, PM2(res.stats.std)], [S.cv, PCT(res.stats.cv)], [S.minmax, `${N(res.stats.min)} – ${N(res.stats.max)} ${CUR()}/m²`],
      [S.ci(ci), res.stats.ciLow != null ? `${N(res.stats.ciLow)} – ${N(res.stats.ciHigh)} ${CUR()}/m²` : '—']];
    return `${secHead(ctx, 'result')}
<div class="res-grid">
  <div>${h3(sub(ctx, T.s81))}<table class="tbl stats"><tbody>${statRows.map((r) => `<tr><td>${esc(r[0])}</td><td class="num">${esc(r[1])}</td></tr>`).join('')}</tbody></table></div>
  <div>${h3(sub(ctx, T.s82))}<table class="tbl calc"><tbody>
    <tr><td>${esc(T.cUnit(T.est[res.estimator] || T.est.weighted))}</td><td class="num">${PM2(res.unitValue)}</td></tr>
    <tr><td>${esc(T.cArea)}</td><td class="num">${M2(res.refArea, res.refArea % 1 ? 2 : 0)}</td></tr>
    <tr class="sub"><td>${esc(T.cDwelling(ctx.noun))}</td><td class="num">${EUR(res.dwellingValue == null ? null : Math.round(res.dwellingValue))}</td></tr>
    ${s.parking ? `<tr><td>${esc(T.cParking)}</td><td class="num">${EUR(st.annex && st.annex.parking)}</td></tr>` : ''}
    ${s.storage ? `<tr><td>${esc(T.cStorage)}</td><td class="num">${EUR(st.annex && st.annex.storage)}</td></tr>` : ''}
    ${(res.deductions || 0) > 0 ? `<tr><td>${esc(T.tech.deductT)}</td><td class="num">− ${EUR(res.deductions)}</td></tr>` : ''}
    <tr class="sub"><td>${esc(T.cTotal)}</td><td class="num">${EUR(res.totalRaw == null ? null : Math.round(res.totalRaw))}</td></tr>
    <tr class="tot"><td>${esc(T.cRounded(EUR(st.rounding || 1000)))}</td><td class="num">${EUR(res.total)}</td></tr>
  </tbody></table></div>
</div>
<div class="conclusion">
  <div class="concl-main"><div class="concl-lbl">${esc(T.mostProbableAt(ctx.DATE(ctx.m.valuationDate)))}</div><div class="concl-val">${EUR(res.total)}</div><div class="concl-words">${res.total ? esc(cap(I().currencyWords(res.total, ctx.lang))) : ''}</div></div>
  <div class="concl-side">
    ${res.rangeLow != null ? `<div><span>${esc(T.rangeCI(ci))}</span><strong>${EUR(res.rangeLow)} – ${EUR(res.rangeHigh)}</strong></div>` : ''}
    <div><span>${esc(T.unitTotal)}</span><strong>${PM2(res.unitTotal)}</strong></div>
    ${st.showListingPrice !== false ? `<div><span>${esc(T.listingPrice)}</span><strong>${EUR(res.listingPrice)}</strong></div>` : ''}
  </div>
</div>
${h3(sub(ctx, T.s83))}${txt(ctx, 'result')}
${st.showListingPrice !== false ? `${h3(sub(ctx, T.s84))}${txt(ctx, 'listing')}` : ''}
${ctx.on('sensitivity') ? sensitivity(ctx) : ''}`;
  }

  // The value under each estimator and under three negotiation coefficients, each computed by the engine, so deductions
  // and the reconciliation with other approaches are included.
  function sensitivityRows(state, res) {
    const st = (state && state.settings) || {};
    const base = Object.assign({}, state, { photos: [] });
    const run = (o) => MCA().compute(Object.assign({}, base, { settings: Object.assign({}, st, o) }));
    const est = MCA().ESTIMATORS.filter((k) => res.stats[k] != null).map((k) => {
      const r = k === res.estimator ? res : run({ estimator: k });
      return { key: k, u: r.unitValue, t: r.total, adopted: k === res.estimator };
    });
    const neg0 = MCA().negotiationDefault(st);
    const neg = [neg0 - 0.02, neg0, neg0 + 0.02].map((k) => {
      const kk = Math.round(k * 100) / 100;
      const adopted = Math.abs(kk - neg0) < 1e-9;
      const r = adopted ? res : run({ negotiationDefault: kk });
      return { k: kk, u: r.unitValue, t: r.total, adopted };
    });
    return { est, neg };
  }
  // P10, P50 and P90 of the simulation rounded with the valuation's rounding step, and the half-spread P10–P90.
  function uncertaintyKpis(state, res, rob) {
    const step = MCA().roundingStep((state && state.settings) || {});
    const r = (v) => Math.round(v / step) * step;
    const mc = rob.mc;
    return { p10: r(mc.p10), p50: r(mc.p50), p90: r(mc.p90), half: res.total ? (mc.p90 - mc.p10) / 2 / res.total : 0 };
  }

  function sensitivity(ctx) {
    const { res, T, N, EUR, PCT } = ctx;
    if (!res.refArea || res.unitValue == null) return '';
    const delta = (t) => (res.total ? (t - res.total) / res.total : 0);
    const rows = sensitivityRows(ctx.state, res);
    const estRows = rows.est.map((r) => ({ label: T.est[r.key], u: r.u, t: r.t, adopted: r.adopted }));
    const negRows = rows.neg.map((r) => ({ label: T.coeff(N(r.k, 2)), u: r.u, t: r.t, adopted: r.adopted }));
    const table = (title, rows) => `<table class="tbl tbl--compact sens"><thead><tr><th>${esc(title)}</th><th class="num">${CUR()}/m²</th><th class="num">${esc(T.value)}</th><th class="num">Δ</th></tr></thead><tbody>` +
      rows.map((r) => `<tr class="${r.adopted ? 'adopted' : ''}"><td>${esc(r.label)}${r.adopted ? ` <span class="pill">${esc(T.adoptedPill)}</span>` : ''}</td><td class="num">${N(r.u)}</td><td class="num">${EUR(r.t)}</td><td class="num">${r.adopted ? '—' : PCT(delta(r.t), 1, true)}</td></tr>`).join('') + '</tbody></table>';
    return `${h3(sub(ctx, T.s85), T.s85sub)}<div class="sens-grid">${table(T.sensEst, estRows)}${table(T.sensNeg, negRows)}</div>`;
  }

  function pPhotos(ctx, chunk, idx) {
    return `${secHead(ctx, 'photos', idx > 0)}
<div class="photo-grid photo-grid--n${chunk.length}">${chunk.map((p, i) => `<figure><div class="ph"><img src="${esc(p.dataUrl)}" alt=""></div><figcaption><span>${idx * 6 + i + 1}</span>${esc(ctx.L(p.caption))}</figcaption></figure>`).join('')}</div>`;
  }

  // Document checks: what was verified, and the checks we recommend before signing (positive wording).
  // ---------- other approaches and reconciliation ----------
  function apUsed(ctx) { const a = ctx.res.approaches; return a && a.active ? a : null; }
  function methodsLine(ctx) {
    const a = apUsed(ctx);
    if (!a) return '';
    return a.reconciled.used.map((k) => ctx.T.ap.names[k]).join(' · ') + ' · ' + ctx.T.coverStdTail;
  }
  function pApproaches(ctx) {
    const a = apUsed(ctx);
    const X = ctx.T.ap;
    const A = ctx.state.approaches || {};
    const E = (v) => ctx.EUR(Math.round(v));
    const P = (v) => `${ctx.N(+v || 0, 1)}%`;
    const tbl = (rows, total) => `<table class="tbl tbl--compact ap-t"><tbody>${rows.filter(Boolean).map((r) => `<tr><td>${esc(r[0])}</td><td class="num">${r[1]}</td></tr>`).join('')}
<tr class="tot"><td>${esc(X.value)}</td><td class="num">${E(total)}</td></tr></tbody></table>`;
    const parts = [];
    if (a.income) {
      const i = A.income || {};
      parts.push(`${h3(X.names.income)}${tbl([[X.income.rent, ctx.EUR(+i.rentMonthly)], [X.income.gross, E(a.income.gross)], [X.income.vacancy, P(i.vacancy)], [X.income.effective, E(a.income.effective)],
        [X.income.opex, P(i.opex)], [X.income.noi, E(a.income.noi)], [X.income.cap, P(i.capRate)]], a.income.value)}`);
    }
    if (a.cost) {
      const c = A.cost || {};
      parts.push(`${h3(X.names.cost)}${tbl([[X.cost.land, E(a.cost.land)], [X.cost.unit, `${ctx.EUR(+c.unitCost)}/m²`], [X.cost.costNew, E(a.cost.costNew)], [X.cost.fees, P(c.fees)],
        +c.profit ? [X.cost.profit, P(c.profit)] : null, [X.cost.dep, P(c.depreciation)], [X.cost.depreciated, E(a.cost.depreciated)]], a.cost.value)}`);
    }
    if (a.residual) {
      const r = a.residual;
      parts.push(`${h3(X.names.residual)}${tbl([[X.residual.gdv, E(r.gdv)], [X.residual.build, `− ${E(r.build)}`], [X.residual.fees, `− ${E(r.fees)}`], [X.residual.finance, `− ${E(r.finance)}`],
        [X.residual.profit, `− ${E(r.profit)}`], [X.residual.sale, `− ${E(r.sale)}`]], r.value)}`);
    }
    const rec = a.reconciled;
    const vals = { market: ctx.res.marketGross, income: a.income && a.income.value, cost: a.cost && a.cost.value, residual: a.residual && a.residual.value };
    const recon = `${h3(X.recon)}<table class="tbl tbl--compact ap-r"><thead><tr><th>${esc(X.method)}</th><th class="num">${esc(X.value)}</th><th class="num">${esc(X.weight)}</th></tr></thead><tbody>
${rec.used.map((k) => `<tr><td>${esc(X.names[k])}</td><td class="num">${E(vals[k])}</td><td class="num">${Math.round(rec.weights[k] * 100)}%</td></tr>`).join('')}
<tr class="tot"><td>${esc(X.result)}</td><td class="num">${E(rec.value)}</td><td class="num">100%</td></tr></tbody></table><p class="note">${esc(X.note)}</p>${String(ctx.L(A.reason) || '').trim() ? `<h4>${esc(X.reasonTitle)}</h4><p>${esc(ctx.L(A.reason))}</p>` : ''}`;
    return `${secHead(ctx, 'result', true)}<div class="ap-page"><h2 class="h2">${esc(X.title)}</h2><p class="lead-sm">${esc(X.lead)}</p><div class="ap-grid">${parts.join('')}</div>${recon}</div>`;
  }

  // ---------- technical page (energy, seismic, installations, deductions) and annexes ----------
  const ENERGY_SCALE = { IT: ['A4', 'A3', 'A2', 'A1', 'B', 'C', 'D', 'E', 'F', 'G'], DE: ['A+', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] };
  const SEISMIC_SCALE = ['A+', 'A', 'B', 'C', 'D', 'E', 'F', 'G'];
  const annexList = (state) => (state.attachments || []).filter((a) => a && a.include !== false && a.dataUrl);
  function techData(ctx) {
    const t = ctx.state.technical || {};
    const e = t.energy || {}, z = t.seismic || {}, sys = t.systems || {};
    const hasE = !!(e.class || e.ep != null || e.code);
    const hasZ = !!(z.zone || z.riskClass || z.structure || z.year || z.works);
    const sysRows = ['heating', 'cooling', 'electrical', 'gas'].filter((k) => sys[k] && (sys[k].status || sys[k].date || sys[k].by || sys[k].notes));
    const ded = (t.deductions || []).filter((d) => d && d.label && +d.amount > 0);
    return hasE || hasZ || sysRows.length || ded.length ? { e, z, sys, hasE, hasZ, sysRows, ded } : null;
  }
  function docRefs(ctx, topic) {
    const list = annexList(ctx.state);
    const refs = list.map((a, i) => (a.topic === topic ? ctx.T.tech.docRef(i + 1) + ' · ' + a.title : '')).filter(Boolean);
    return refs.length ? `<p class="tech-docs"><strong>${esc(ctx.T.tech.docs)}:</strong> ${esc(refs.join('; '))}</p>` : '';
  }
  function scale(classes, on, cls) {
    return `<div class="${cls}">${classes.map((c, i) => `<span class="ecl${c === on ? ' on' : ''}" style="--i:${i};--n:${classes.length}">${esc(c)}</span>`).join('')}</div>`;
  }
  function pTechnical(ctx) {
    const d = ctx.techBlock;
    const X = ctx.T.tech;
    const kv = (rows) => `<table class="tbl tbl--compact tech-kv"><tbody>${rows.filter((r) => r[1] != null && r[1] !== '').map((r) => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`).join('')}</tbody></table>`;
    const energy = d.hasE ? `${h3(X.energy)}${d.e.class ? scale(ENERGY_SCALE[ctx.cty.cc] || ['A', 'B', 'C', 'D', 'E', 'F', 'G'], d.e.class, 'escale') : ''}
${kv([[X.eClass, d.e.class], [X.eIndex, d.e.ep != null ? `${ctx.N(d.e.ep, 1)} ${X.eUnit}` : ''], [X.eIssued, d.e.issued ? ctx.DATE(d.e.issued) : ''], [X.eValid, d.e.validUntil ? ctx.DATE(d.e.validUntil) : ''], [X.eCode, d.e.code], [X.eBy, d.e.certifier]])}${docRefs(ctx, 'energy')}` : '';
    const seismic = d.hasZ ? `${h3(X.seismic, d.z.zone ? X.sZone(d.z.zone) : '')}${d.z.riskClass ? scale(SEISMIC_SCALE, d.z.riskClass, 'escale sscale') : ''}
${kv([[X.sClass, d.z.riskClass], [X.sStructure, d.z.structure ? X.structures[d.z.structure] : ''], [X.sYear, d.z.year || ''], [X.sWorks, d.z.works]])}${d.z.notes ? `<p class="tech-note">${esc(d.z.notes)}</p>` : ''}${docRefs(ctx, 'seismic')}` : '';
    const systems = d.sysRows.length ? `${h3(X.systems)}<table class="tbl tbl--compact tech-sys"><thead><tr>${X.cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${d.sysRows.map((k) => {
      const r = d.sys[k];
      return `<tr><td>${esc(X.sysNames[k])}</td><td>${esc(X.status[r.status || ''])}</td><td>${r.date ? ctx.DATE(r.date) : '—'}</td><td>${esc(r.by || '—')}</td><td>${esc(r.notes || '')}</td></tr>`;
    }).join('')}</tbody></table>${docRefs(ctx, 'installations')}` : '';
    const ded = d.ded.length ? `${h3(X.deductT)}<table class="tbl tbl--compact tech-ded"><tbody>${d.ded.map((x) => `<tr><td>${esc(x.label)}</td><td class="num">− ${ctx.EUR(+x.amount)}</td></tr>`).join('')}
<tr class="tot"><td>${esc(X.deductTot)}</td><td class="num">− ${ctx.EUR(d.ded.reduce((t, x) => t + +x.amount, 0))}</td></tr></tbody></table>` : '';
    return `${secHead(ctx, 'hypotheses')}<div class="tech"><h2 class="h2">${esc(X.title)}</h2><p class="lead-sm">${esc(X.lead)}</p>${energy}${seismic}${systems}${ded}</div>`;
  }
  function pAnnexIndex(ctx) {
    const A = ctx.T.annex;
    const list = annexList(ctx.state);
    return `${plainHead('', A.title, 'annexes')}<p class="lead-sm">${esc(A.lead)}</p>
<table class="tbl tbl--compact annex-t"><thead><tr>${A.cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${list.map((a, i) => `<tr><td class="num">${i + 1}</td><td><strong>${esc(a.title || a.name)}</strong>${/pdf$/.test(a.mime || '') ? `<span class="sub">${esc(A.pdf)}</span>` : ''}</td>
<td>${esc(A.kinds[a.kind] || A.kinds.other)}</td><td>${esc(a.issuer || '—')}</td><td>${a.date ? ctx.DATE(a.date) : '—'}</td><td>${esc(a.ref || '—')}</td><td class="hash">${esc((a.sha256 || '').slice(0, 12) || '—')}</td></tr>`).join('')}</tbody></table>`;
  }
  function pAnnexImage(ctx, a, n) {
    return `<figure class="annex-img"><figcaption>${esc(ctx.T.annex.image(n, a.title || a.name))}</figcaption><img src="${esc(a.dataUrl)}" alt="${esc(a.title || a.name)}"></figure>`;
  }

  function pChecks(ctx) {
    const b = ctx.checksBlock;
    return `${secHead(ctx, 'hypotheses', !!ctx.techBlock)}
<h3 class="h3">${esc(b.title)}</h3>
<div class="checks-rep">${b.verified.length ? `<div class="cr-col"><div class="cr-h">${esc(b.verifiedTitle)}</div><ul class="cr-ok">${b.verified.map((v) => `<li>${esc(v.text)}</li>`).join('')}</ul></div>` : ''}
${b.advice.length ? `<div class="cr-col"><div class="cr-h">${esc(b.adviceTitle)}</div>${b.advice.map((a) => `<p class="cr-box">${a.deep ? `<strong class="cr-deep">${esc(b.deepLabel)}</strong> ` : ''}<strong>${esc(a.label)}.</strong> ${esc(a.text)}</p>`).join('')}</div>` : ''}</div>`;
  }
  function pHypotheses(ctx) {
    const { m, T, L } = ctx;
    const items = listItems(txt(ctx, 'hypotheses', false));
    const sources = (ctx.cty.cc === 'ES' ? [[T.catastro, T.catastroUrl, '']] : []).concat([[L(ctx.mk.source), shortUrl(ctx.mk.sourceUrl), '']])
      .concat((ctx.mk.references || []).map((r) => [L(r.label), shortUrl(r.url), '']))
      .concat(ctx.comps.map((x) => [[x.c.id, x.c.address].filter(Boolean).join(' · ') + (x.c.zone && !String(x.c.address).includes(x.c.zone) ? ` (${x.c.zone})` : ''), shortUrl(x.c.url), x.c.sourceName]));
    return `${secHead(ctx, 'hypotheses', !!ctx.checksBlock || !!ctx.techBlock)}
<p class="lead-sm">${esc(T.hypLead)}</p>
<ol class="hyp">${items.map((t) => {
      const mm = /^([^:]{3,40}):\s*(.*)$/.exec(t);
      return `<li>${mm ? `<strong>${esc(mm[1])}.</strong> ${inline(cap(mm[2]))}` : inline(t)}</li>`;
    }).join('')}</ol>
${ctx.on('sources') ? `${h3(T.sources, T.consulted(ctx.DATE(m.valuationDate)))}
<table class="tbl tbl--compact sources"><tbody>${sources.filter((r) => r[0]).map((r) => `<tr><td>${esc(r[0])}${r[2] ? ` <span class="sub">${esc(r[2])}</span>` : ''}</td><td class="url">${esc(r[1])}</td></tr>`).join('')}</tbody></table>
${mapCredit(ctx) ? `<p class="note">${esc(mapCredit(ctx))}</p>` : ''}` : ''}`;
  }
  // Methodological references (src/js/references.js): the standards, the rules and guidance of the country and the
  // literature on the method, each with the status of its verification. A page of its own after the sources.
  function pRefs(ctx) {
    const R = RF();
    const X = ctx.T.refs;
    const groups = [[X.standards, R.international()], [`${X.country} — ${ctx.cty.name}`, R.byCountry(ctx.cty.cc)], [X.method, R.method()]]
      .filter((g) => g[1].length);
    return `${secHead(ctx, 'hypotheses', true)}
${h3(X.title)}
<p class="lead-sm">${esc(X.scope(String(ctx.T.natureTitle || '').replace(/[.。]\s*$/, '')))}</p>
<table class="tbl tbl--compact sources refs"><tbody>${groups.map(([title, list]) => `<tr><th colspan="2">${esc(title)}</th></tr>` +
      list.map((r) => `<tr><td>${esc(r.text)}<span class="sub">${esc(X.status(r.status, r.date))}</span></td><td class="url">${esc(shortUrl(r.url))}</td></tr>`).join('')).join('')}</tbody></table>
<p class="note">${esc(X.note)}</p>`;
  }

  function pCertification(ctx) {
    const { m, T, L } = ctx;
    const office = m.office || {};
    return `${secHead(ctx, 'certification')}
<div class="cert">${h3(T.declaration)}<p>${esc(T.declares)}</p>${ul(listItems(txt(ctx, 'declaration', false)), 'ticks')}</div>
${(() => { const ai = AR() ? AR().statement(ctx.state.aiLog, ctx.lang, ctx.T.aiUse) : null; return ai ? `<div class="ai-use">${h3(ai.title)}<p>${esc(ai.text)}</p></div>` : ''; })()}
<div class="sign-grid">
  <div class="sign"><span class="lbl">${esc(T.signAdvisor)}</span>${isRaster(m.advisor && m.advisor.signature) ? `<img class="sign-img" src="${esc(m.advisor.signature)}" alt="">` : ''}<div class="sign-line"></div><strong>${esc(m.advisor && m.advisor.name)}</strong><span>${esc(L(m.advisor && m.advisor.role))}</span><span>${esc(ctx.s.municipality || '')}, ${ctx.DATE(m.reportDate)}</span></div>
  <div class="sign"><span class="lbl">${esc(T.agency)}</span><div class="stamp">${logoHtml(ctx, false, 'stamp')}<span>${esc(T.stamp)}</span></div><strong>${esc(office.name || '')}</strong>${[office.company, office.address, office.phone, office.email, office.web, office.license ? `${T.license} ${office.license}` : ''].filter(Boolean).map((x) => `<span>${esc(x)}</span>`).join('')}</div>
</div>
${ctx.on('glossary') ? `${h3(T.glossaryTitle)}
<dl class="glossary">${T.glossary.map((g) => `<div><dt>${esc(g[0])}</dt><dd>${esc(g[1])}</dd></div>`).join('')}</dl>` : ''}
<div class="callout callout--warn">${T.privacy}</div>`;
  }

  // ---------- valuation uncertainty (Monte Carlo + leave-one-out) ----------
  function pUncertainty(ctx, rob) {
    const { T, N, EUR, PCT, res } = ctx;
    const mc = rob.mc;
    const K = uncertaintyKpis(ctx.state, res, rob);
    const half = K.half;
    const level = rob.looMaxAbs <= 0.03 && half <= 0.05 ? 'robust' : rob.looMaxAbs <= 0.06 && half <= 0.1 ? 'moderate' : 'sensitive';
    const worst = rob.loo.reduce((w, l) => (!w || Math.abs(l.delta) > Math.abs(w.delta) ? l : w), null);
    const comp = (id) => (ctx.comps.find((x) => x.c.id === id) || { c: {} }).c;
    const kpi = (lbl, v, note) => `<div class="kpi"><div class="kpi-v">${v}</div><div class="kpi-l">${esc(lbl)}</div>${note ? `<div class="kpi-s">${esc(note)}</div>` : ''}</div>`;
    const hist = CH().histogram({ bins: mc.hist, band: [mc.p10, mc.p90], markers: [{ v: res.totalRaw, label: T.uncAdopted }], width: 640, height: 200, title: T.uncHistTitle });
    const bars = CH().divergingBars({ items: rob.loo.map((l) => ({ label: `${l.id} · ${String(comp(l.id).zone || comp(l.id).address || '').slice(0, 22)}`, value: l.delta })), width: 640, title: T.uncLooTitle });
    return `${secHead(ctx, 'result', true)}
${h3(sub(ctx, T.uncTitle), T.uncSub)}
<p>${esc(T.uncIntro)}</p>
<div class="kpis kpis--4">${kpi('P10', EUR(K.p10))}${kpi('P50', EUR(K.p50))}${kpi('P90', EUR(K.p90))}${kpi(T.uncSpread, `±${PCT(half, 1)}`, T.uncSpreadNote)}</div>
<figure class="unc-fig">${hist}<figcaption>${esc(T.uncHistCap(N(mc.n)))}</figcaption></figure>
${h3(T.uncLooTitle, T.uncLooSub)}
<figure class="unc-fig">${bars}</figure>
<div class="callout callout--muted"><h4>${esc(T.uncReadTitle)}</h4><p>${esc(T.uncReading(EUR(K.p10), EUR(K.p90), PCT(half, 1), worst ? worst.id : '—', worst ? PCT(Math.abs(worst.delta), 1) : '—', T.uncLevel[level]))}</p><p class="note">${esc(T.uncMethod(N(mc.n)))}</p></div>`;
  }

  // Custom chapter body: paragraphs, **bold**, "## " sub-headings, "- " lists; a line with "---" starts a new page.
  function mdBlocks(text) {
    return String(text || '').split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean).map((b) => {
      if (/^#{2,3}\s+/.test(b)) return h3(b.replace(/^#{2,3}\s+/, ''));
      const lines = b.split('\n');
      if (lines.every((l) => /^\s*[-•·*]\s+/.test(l))) return ul(lines.map((l) => l.replace(/^\s*[-•·*]\s+/, '')));
      return `<p>${inline(b)}</p>`;
    }).join('');
  }
  const customPages = (ctx, c) => ctx.L(c.body).split(/\n\s*-{3,}\s*(?:\n|$)/).map((part) => part.trim()).filter((p, i) => p || i === 0);
  function pCustom(ctx, id, part, idx) {
    return `${secHead(ctx, id, idx > 0)}<div class="custom-body">${mdBlocks(part)}</div>`;
  }

  // ---------- assembly ----------
  function chunks(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  function render(state, res, opts) {
    opts = opts || {};
    const ctx = makeCtx(state, res);
    const on = ctx.on;
    // Uncertainty analysis (Monte Carlo + leave-one-out), computed once for the method and the uncertainty pages.
    let rob;
    ctx.rob = () => (rob !== undefined ? rob : (rob = res.total ? MCA().robustness(Object.assign({}, state, { photos: [] }), { n: 600 }) : null));
    const prevLocale = CH().getLocale ? CH().getLocale() : 'es';
    if (CH().setLocale) CH().setLocale(ctx.lang);
    try {
      const pages = [];
      const add = (sections, fn, cls) => pages.push({ sections, fn, cls });
      ctx.look = coverLook(ctx);
      add(['cover'], pCover, ctx.look.cls);
      if (on('summary')) add(['summary'], pSummary, 'page--summary');
      if (on('toc') || on('letter')) add(['toc'], pTocLetter);
      ctx.order.forEach((id) => {
        const sec = ctx.sections[id];
        if (sec.custom) { customPages(ctx, sec.custom).forEach((part, i) => add([id], (c) => pCustom(c, id, part, i))); return; }
        switch (id) {
          case 'scope': add(['scope'], pScope); break;
          case 'location': add(['location'], pLocation); break;
          case 'description': add(['description'], pDescription); if (on('surfaces')) add(['surfaces'], pSurfaces); break;
          case 'market': add(['market'], pMarket); break;
          case 'method': if (on('methodDetail')) { add(['method'], pMethod); add(['method'], pMethodApplied); } else add(['method'], pMethodShort); break;
          case 'sample': add(['sample'], pSample); if (on('cards')) chunks(ctx.comps, 6).forEach((ch) => add(['cards'], (c) => pCards(c, ch))); break;
          case 'homog': {
            const mx = chunks(ctx.used, 7);
            mx.forEach((ch, i) => add(i === 0 ? ['homog'] : ['homog-cont'], (c) => pHomog(c, ch, i, mx.length)));
            if (!ctx.used.length) add(['homog'], (c) => `${secHead(c, 'homog')}<div class="callout callout--warn">${c.T.noComps}</div>`);
            else if (on('homogChart')) add(['homog-chart'], pHomogChart);
            break;
          }
          case 'result': {
            add(['result'], pResult);
            if (apUsed(ctx)) add(['result'], pApproaches);
            const rob = on('uncertainty') ? ctx.rob() : null;
            if (rob && rob.mc && rob.loo.length) add(['uncertainty'], (c) => pUncertainty(c, rob));
            break;
          }
          case 'photos': chunks(ctx.photos, 6).forEach((ch, i) => add(i === 0 ? ['photos'] : ['photos-cont'], (c) => pPhotos(c, ch, i))); break;
          case 'hypotheses': if (ctx.techBlock) add(['hypotheses'], pTechnical); if (ctx.checksBlock) add(['hypotheses'], pChecks); add(['hypotheses'], pHypotheses); if (on('sources') && RF()) add(['hypotheses'], pRefs); break;
          case 'certification': {
            add(['certification'], pCertification);
            const ann = annexList(state);
            if (ann.length && on('annexes')) {
              add(['annexes'], pAnnexIndex);
              ann.forEach((a, i) => { if (/^data:image\//.test(a.dataUrl)) add(['annexes'], (c) => pAnnexImage(c, a, i + 1), 'page--annex'); });
            }
            break;
          }
          default:
        }
      });
      pages.forEach((p, i) => { p.n = i + 1; p.sections.forEach((s) => { if (!(s in ctx.sectionPage)) ctx.sectionPage[s] = p.n; }); });
      ctx.total = pages.length;
      const s = ctx.s;
      const m = ctx.m;
      const head = `${ctx.T.reportTitle} · ${s.address || ''}${s.floorDoor ? ', ' + s.floorDoor : ''} · ${s.municipality || ''}`;
      const foot = `${ctx.T.ref} ${m.reportNo || ''} · ${ctx.DATE(m.reportDate)}`;
      const D = ctx.D;
      const wmText = D.watermark === 'draft' ? ctx.T.wmDraft : D.watermark === 'confidential' ? ctx.T.wmConfidential : D.watermark === 'custom' ? ctx.L(D.watermarkText) : '';
      const wm = wmText ? `<div class="watermark" aria-hidden="true"><span>${esc(wmText)}</span></div>` : '';
      const note = ctx.L(D.footerNote).trim() || ctx.T.confidential;
      const fit = opts.fit || {};
      return withCurrency(pages.map((p) => {
        const body = p.fn(ctx);
        const attrs = `class="page ${p.cls || ''}" data-page="${p.n}" data-sections="${p.sections.join(' ')}" lang="${ctx.lang}"`;
        if (p.sections[0] === 'cover') return `<section ${attrs} style="${ctx.look.style}">${body}${wm}</section>`;
        const f = Number(fit[p.n]);
        const fitAttr = isFinite(f) && f >= 0.5 && f < 1 ? ` style="--fit:${Math.round(f * 1000) / 1000}"` : '';
        return `<section ${attrs}><header class="pg-head">${logoHtml(ctx, false, 'head')}<span class="pg-head-txt">${esc(head)}</span></header>` +
          `<div class="pg-body"${fitAttr}>${body}</div><footer class="pg-foot"><span>${esc(foot)}</span><span>${esc(note)}</span>${D.pageNumbers !== false ? `<span class="pg-num">${p.n} / ${ctx.total}</span>` : '<span></span>'}</footer>${wm}</section>`;
      }).join('\n'));
    } finally {
      if (CH().setLocale) CH().setLocale(prevLocale);
    }
  }

  function autoTextsFor(state, res) {
    const prev = CH().getLocale ? CH().getLocale() : 'es';
    try { const auto = makeCtx(state, res).auto; Object.keys(auto).forEach((k) => { if (typeof auto[k] === 'string') auto[k] = withCurrency(auto[k]); }); return auto; } finally { if (CH().setLocale) CH().setLocale(prev); }
  }

  // An exported report carries its map images inside the file, so whoever opens it contacts no outside service: each
  // <image href> or <img src> with an outside address becomes a data URL; one that cannot be fetched is removed.
  async function inlineImages(html, getDataUrl) {
    const re = /<(image|img)\b[^>]*?\s(?:xlink:href|href|src)="(https?:\/\/[^"]*)"[^>]*?\/?>(?:<\/\1>)?/g;
    const urls = [];
    String(html).replace(re, (m, tag, u) => { if (!urls.includes(u)) urls.push(u); return m; });
    const got = new Map();
    for (let i = 0; i < urls.length; i += 6) {
      await Promise.all(urls.slice(i, i + 6).map(async (u) => {
        let d;
        try { d = await getDataUrl(u.replace(/&amp;/g, '&')); } catch (e) { d = null; }
        got.set(u, typeof d === 'string' && /^data:image\//.test(d) ? d : null);
      }));
    }
    return String(html).replace(re, (m, tag, u) => { const d = got.get(u); return d ? m.replace(u, () => d) : ''; });
  }

  // File names of exported reports, plain ASCII, in each report language.
  const FILE_TITLES = { en: 'Valuation_Report', es: 'Informe_Valoracion', it: 'Rapporto_Valutazione', fr: 'Rapport_Evaluation', de: 'Bewertungsbericht',
    pt: 'Relatorio_Avaliacao', nl: 'Taxatierapport', pl: 'Raport_z_wyceny', cs: 'Zprava_o_oceneni', hu: 'Ertekbecslesi_jelentes', ro: 'Raport_de_evaluare',
    hr: 'Izvjesce_o_procjeni', da: 'Vurderingsrapport', sv: 'Varderingsrapport', nb: 'Verdivurdering', zh: 'Gujia_baogao', ru: 'Otchet_ob_otsenke' };
  const fileTitle = (lang) => FILE_TITLES[lang] || FILE_TITLES.en;

  function documentTitle(state) {
    const s = (state && state.subject) || {};
    const lang = I().norm((state && state.meta && state.meta.reportLang) || 'en');
    return `${(RI()[lang] || RI().en).reportTitle} · ${s.address || ''}${s.floorDoor ? ', ' + s.floorDoor : ''} · ${s.municipality || ''}`;
  }

  // Standalone, script-free HTML document (A4 pages) for download / archiving / printing.
  /* Shrinks the text of overflowing pages (binary search on --fit, never below opts.min) so nothing is cut.
   * Browser only; returns { pageNo: factor } for the pages it touched. Self-contained: it is also serialised into exports. */
  function fitPages(root, opts) {
    var min = (opts && opts.min) || 0.8, out = {};
    var pages = root.querySelectorAll('.page');
    for (var i = 0; i < pages.length; i++) {
      var b = pages[i].querySelector('.pg-body');
      if (!b) continue;
      b.style.removeProperty('--fit');
      if (b.scrollHeight <= b.clientHeight + 1) continue;
      var lo = min, hi = 1, best = min;
      for (var k = 0; k < 7; k++) {
        var mid = (lo + hi) / 2;
        b.style.setProperty('--fit', mid.toFixed(3));
        if (b.scrollHeight <= b.clientHeight + 1) { best = mid; lo = mid; } else hi = mid;
      }
      b.style.setProperty('--fit', best.toFixed(3));
      out[pages[i].getAttribute('data-page')] = Math.round(best * 1000) / 1000;
    }
    return out;
  }

  function documentHtml(pagesHtml, cssText, title, lang, opts) {
    return `<!doctype html>\n<html lang="${esc(lang || 'es')}"><head><meta charset="utf-8">` +
      '<meta name="viewport" content="width=device-width, initial-scale=1">' +
      `<title>${esc(title || 'Valesta')}</title><meta name="generator" content="Valesta">` +
      `<style>${cssText || ''}\nhtml,body{margin:0;background:#E9EDF0}@media screen{body{padding:10mm 0}.report .page{zoom:var(--zoom,1)}}@media screen and (max-width:820px){body{padding:3mm 0}.report{--zoom:calc((100vw - 6mm) / 210mm)}}@media print{body{background:#fff;padding:0}}</style>` +
      `</head><body><main class="report">${pagesHtml}</main>` +
      (opts && opts.autoFit ? `<script>(function(){var fitPages=${fitPages.toString()};function go(){fitPages(document,{min:0.8});}if(document.fonts&&document.fonts.ready)document.fonts.ready.then(go);else window.addEventListener('load',go);})();</script>` : '') +
      '</body></html>';
  }

  // Backwards-compatible helpers
  const numberToWords = (n, lang) => I().numberToWords(n, lang || 'es');
  const dateEs = (iso) => I().dateLong(iso, 'es');

  return { render, sensitivityRows, uncertaintyKpis, inlineImages, fileTitle, autoTexts: autoTextsFor, documentHtml, documentTitle, brandCss, palette, numberToWords, dateEs, SECTION_IDS, roomGroup,
    designOf, usedFonts, filterFontCss, fitPages, FONT_STACKS, EMBEDDED_FONTS, LEGACY_FONTS, SECTION_KEYS, PRESETS, DEFAULT_DESIGN, COVER_STYLES, coverTexts,
    coverModel, colorOf, contrast, coverInk, COVER_OPTIONS };
});
