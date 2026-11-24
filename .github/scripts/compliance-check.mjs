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
// Repository compliance check: licences, copyright headers, secrets, real data, dependencies, notices.
// Zero dependencies, Node.js >= 18. Configuration: .compliance.json in the repository root.
// Usage: node .github/scripts/compliance-check.mjs        (exit code 1 when an error is found)
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const CFG_PATH = join(ROOT, '.compliance.json');
if (!existsSync(CFG_PATH)) { console.error('compliance: .compliance.json not found in ' + ROOT); process.exit(2); }
const cfg = JSON.parse(readFileSync(CFG_PATH, 'utf8'));

// SHA-256 of the unmodified official texts (LF line endings).
const KNOWN_LICENCE_HASHES = {
  'Apache-2.0': 'cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30',
  'AGPL-3.0': '0d96a4ff68ad6d4b6f1f30f713b18d5184912ba8dd389f86aa7710db079abcb0',
  'CC-BY-4.0': '9ba9550ad48438d0836ddab3da480b3b69ffa0aac7b7878b5a0039e7ab429411',
};
const PERMISSIVE = ['MIT', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause', '0BSD', 'Apache-2.0', 'Zlib', 'Unlicense', 'CC0-1.0', 'BlueOak-1.0.0', 'Python-2.0'];
const ALLOWED_DEPENDENCY_LICENCES = {
  // Licences whose code can be combined with an AGPL-3.0 application.
  'AGPL-3.0': [...PERMISSIVE, 'MPL-2.0', 'LGPL-2.1-only', 'LGPL-2.1-or-later', 'LGPL-3.0-only', 'LGPL-3.0-or-later',
    'GPL-3.0-only', 'GPL-3.0-or-later', 'AGPL-3.0-only', 'AGPL-3.0-or-later', 'OFL-1.1', 'CC-BY-4.0'],
  // An Apache-2.0 library must stay usable in any product: permissive licences only.
  'Apache-2.0': [...PERMISSIVE],
};

const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);
const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const lf = (s) => s.replace(/\r\n?/g, '\n');
const squash = (s) => s.replace(/\s+/g, ' ').trim();

const TEXT_EXT = new Set(['.js', '.mjs', '.cjs', '.ts', '.css', '.html', '.htm', '.md', '.json', '.yaml', '.yml', '.py', '.ps1', '.sh',
  '.java', '.swift', '.kt', '.xml', '.gradle', '.properties', '.plist', '.txt', '.csv', '.svg', '.webmanifest', '.toml', '.cfg', '.ini',
  '.pro', '.bat', '.storyboard', '.pbxproj', '.podspec', '.xcconfig', '.entitlements', '.resolved', '.gitignore', '.gitattributes']);
const BINARY_OK = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico', '.woff', '.woff2', '.ttf', '.otf', '.jar']);
const IGNORE_DIRS = new Set(['.git', 'node_modules', 'dist', ...(cfg.ignoreDirs || [])]);
// Folders with a compliance check of their own (ignoreDirs at the top level), also skipped in the list from git.
const TOP_IGNORE = new Set(cfg.ignoreDirs || []);

function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') { if (glob[i + 1] === '*') { re += '.*'; i++; if (glob[i + 1] === '/') i++; } else re += '[^/]*'; }
    else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp('^' + re + '$');
}
const matcher = (globs) => { const res = (globs || []).map(globToRegExp); return (p) => res.some((r) => r.test(p)); };

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) { if (!IGNORE_DIRS.has(name)) walk(full, out); }
    else out.push({ full, rel: relative(ROOT, full).split('\\').join('/'), size: st.size });
  }
  return out;
}
// Prefer the files git would commit (tracked and untracked, honouring .gitignore); fall back to a directory walk.
function gitFiles() {
  try {
    const out = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return out.split('\0').filter(Boolean).filter((rel) => !TOP_IGNORE.has(rel.split('/')[0])).map((rel) => ({ full: join(ROOT, rel), rel })).filter((f) => existsSync(f.full))
      .map((f) => ({ ...f, size: statSync(f.full).size }));
  } catch (e) { return null; }
}
const files = gitFiles() || walk(ROOT);
const read = (f) => readFileSync(f.full, 'utf8');

// 1. Required files
for (const f of cfg.requiredFiles || []) if (!existsSync(join(ROOT, f))) err(`missing required file: ${f}`);

// 2. Licence texts must be the unmodified official texts
for (const [file, id] of Object.entries(cfg.licenceFiles || {})) {
  const p = join(ROOT, file);
  if (!existsSync(p)) continue;
  if (sha256(lf(readFileSync(p, 'utf8'))) !== KNOWN_LICENCE_HASHES[id]) err(`${file}: not the unmodified official ${id} text`);
}

// 3. README must contain the Licensing section (exact text where configured)
if (existsSync(join(ROOT, 'README.md'))) {
  const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');
  if (!/^## Licensing\s*$/m.test(readme)) err('README.md: missing "## Licensing" section');
  for (const para of cfg.readmeLicensing || []) if (!squash(readme).includes(squash(para))) err(`README.md: Licensing text differs from the required wording ("${para.slice(0, 60)}…")`);
}

// 4. Copyright headers in source files
if (cfg.headers) {
  const isExcluded = matcher(cfg.headers.exclude);
  const patterns = cfg.headers.mustMatch.map((s) => new RegExp(s));
  for (const f of files) {
    if (!cfg.headers.extensions.includes(extname(f.rel)) || isExcluded(f.rel)) continue;
    const head = read(f).split('\n').slice(0, 60)
      .map((l) => l.replace(/^\s*(\/\*+|\*\/|\*|\/\/+|#!.*|#+|<!--|-->)\s?/, '').replace(/\s*(\*\/|-->)\s*$/, ''))
      .join(' ');
    const flat = squash(head);
    if (!patterns.every((r) => r.test(flat))) err(`${f.rel}: missing or wrong copyright/licence header`);
  }
}

// 5-7. Secrets, personal data, real-data sources, denied terms
const SECRET_PATTERNS = [
  [/-----BEGIN (RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/, 'private key'],
  [/\bsk-ant-[A-Za-z0-9_-]{16,}/, 'Anthropic API key'],
  [/\bsk-(proj-)?[A-Za-z0-9]{32,}/, 'OpenAI-style API key'],
  [/\bAIza[0-9A-Za-z_-]{35}\b/, 'Google API key'],
  [/\b(ghp|gho|ghu|ghs)_[A-Za-z0-9]{36}\b|\bgithub_pat_[A-Za-z0-9_]{60,}/, 'GitHub token'],
  [/\bxox[baprs]-[A-Za-z0-9-]{10,}/, 'Slack token'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'AWS access key'],
  [/\b(password|passwd|secret|api[_-]?key|access[_-]?token)\b\s*[:=]\s*['"](?!(test|fake|dummy|example|placeholder|changeme|your[-_]))[^'"\s]{16,}['"]/i, 'hard-coded secret'],
];
const FORBIDDEN_FILES = matcher(['**/.env', '**/.env.*', '.env', '.env.*', '**/*.jks', '*.jks', '**/*.keystore', '**/*.p12', '**/*.pem',
  '**/keystore.properties', 'keystore.properties', '**/local.properties']);
const PORTALS = /https?:\/\/(?:[a-z0-9-]+\.)*(idealista|fotocasa|habitaclia|pisos|milanuncios|immobiliare|casa\.it|rightmove|zoopla|onthemarket|seloger|leboncoin|logic-immo|bienici|immobilienscout24|immowelt|immonet|willhaben|funda|pararius|jaap|imovirtual|casasapo|otodom|morizon|sreality|bezrealitky|ingatlan|daft|myhome|finn|hemnet|booli|boligsiden|boliga|njuskalo|storia|imobiliare|homegate|immoscout24|comparis|realadvisor|casafari)\.[a-z.]+/i;
const ALLOWED_EMAIL_DOMAINS = new Set(cfg.allowedEmailDomains || ['example.com', 'example.org', 'example.net']);
const DENIED = new Set(cfg.deniedTermHashes || []);
const noData = matcher(cfg.dataScanExclude);
const normWords = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);

for (const f of files) {
  if (FORBIDDEN_FILES(f.rel)) err(`${f.rel}: file type must never be committed (secrets or machine-specific settings)`);
  const ext = extname(f.rel).toLowerCase();
  if (!TEXT_EXT.has(ext)) {
    if (!BINARY_OK.has(ext) && ext) warn(`${f.rel}: binary file type ${ext} — check it is needed for reproducibility`);
    continue;
  }
  if (f.size > (cfg.maxTextFileBytes || 3_000_000)) { warn(`${f.rel}: very large text file (${Math.round(f.size / 1024)} KB)`); }
  if (noData(f.rel)) continue;
  const text = read(f).replace(/[A-Za-z0-9+/=]{200,}/g, ' ');
  for (const [re, what] of SECRET_PATTERNS) if (re.test(text)) err(`${f.rel}: possible ${what}`);
  for (const m of text.matchAll(/[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.([A-Za-z]{2,}))/g)) {
    const domain = m[1].toLowerCase();
    if (/^(png|jpe?g|svg|webp|gif|json|js|css|html?|md|txt|pdf)$/i.test(m[2])) continue;
    if (ALLOWED_EMAIL_DOMAINS.has(domain) || domain.endsWith('.example') || domain === 'users.noreply.github.com') continue;
    err(`${f.rel}: e-mail address outside the allowed domains (${m[0]})`);
  }
  for (const m of text.matchAll(/(?<![\w.\/-])\+\d{2,3}[ .-]?\d{2,4}[ .-]?\d{3}[ .-]?\d{3,4}(?![\w.])/g)) {
    if ((m[0].match(/[1-9]/g) || []).length > 3) warn(`${f.rel}: phone number found (${m[0]}) — use fictitious numbers only`);
  }
  const portal = text.match(PORTALS);
  if (portal) err(`${f.rel}: link to a real listing or data portal (${portal[0]}) — examples and demo data must be synthetic`);
  if (DENIED.size) {
    const words = normWords(text);
    for (let i = 0; i < words.length; i++) {
      for (let n = 1; n <= 3 && i + n <= words.length; n++) {
        if (DENIED.has(sha256(words.slice(i, i + n).join(' ')))) { err(`${f.rel}: denied term found (third-party brand or real-case data)`); i = words.length; break; }
      }
    }
  }
}

// 8. Synthetic marker in example documents
const isSynthetic = matcher(cfg.syntheticJson);
for (const f of files) {
  if (!isSynthetic(f.rel)) continue;
  try { if (JSON.parse(read(f)).synthetic !== true) err(`${f.rel}: example documents must declare "synthetic": true`); }
  catch (e) { err(`${f.rel}: invalid JSON (${e.message})`); }
}

// 9. Dependency licences
function licenceOk(expr, allowed) {
  if (!expr) return false;
  return String(expr).replace(/[()]/g, ' ').split(/\s+OR\s+/i)
    .some((alt) => alt.split(/\s+AND\s+/i).every((id) => allowed.includes(id.trim().replace(/\+$/, '-or-later'))));
}
for (const pj of cfg.packageJson || []) {
  const p = join(ROOT, pj);
  if (!existsSync(p)) continue;
  const pkg = JSON.parse(readFileSync(p, 'utf8'));
  const allowed = ALLOWED_DEPENDENCY_LICENCES[cfg.projectLicence] || PERMISSIVE;
  const deps = { ...(pkg.dependencies || {}), ...(cfg.checkDevDependencies ? pkg.devDependencies || {} : {}) };
  for (const name of Object.keys(deps)) {
    const dp = join(ROOT, pj, '..', 'node_modules', name, 'package.json');
    if (!existsSync(dp)) { warn(`${pj}: ${name} not installed — licence not verified (run npm install, then re-run this check)`); continue; }
    const lic = JSON.parse(readFileSync(dp, 'utf8')).license;
    const id = typeof lic === 'object' && lic ? lic.type : lic;
    if (!licenceOk(id, allowed)) err(`${pj}: dependency ${name} has licence "${id}", not compatible with ${cfg.projectLicence}`);
  }
}

// 10. NOTICE
if (existsSync(join(ROOT, 'NOTICE'))) {
  const notice = readFileSync(join(ROOT, 'NOTICE'), 'utf8');
  if (!notice.includes('Domestone S.r.l.')) err('NOTICE: copyright holder Domestone S.r.l. not named');
  for (const name of cfg.noticeMustMention || []) if (!notice.includes(name)) err(`NOTICE: third-party component "${name}" not listed`);
}

// 11. Contributor License Agreement
if (cfg.requireCla) {
  const tpl = join(ROOT, '.github', 'PULL_REQUEST_TEMPLATE.md');
  if (!existsSync(tpl) || !/CLA/.test(readFileSync(tpl, 'utf8'))) err('pull request template must include the CLA checkbox');
  if (!existsSync(join(ROOT, '.github', 'workflows', 'cla.yml'))) err('CLA workflow (.github/workflows/cla.yml) missing');
}

// 12. Placeholders that must be filled before publication
for (const f of files) {
  if (!['.md', '.txt'].includes(extname(f.rel))) continue;
  if (/\[INSERT [A-Z ]+\]/.test(read(f))) warn(`${f.rel}: placeholder still to be filled before publication`);
}

for (const w of warnings) console.log('warning  ' + w);
for (const e of errors) console.log('ERROR    ' + e);
console.log(`compliance: ${errors.length} error(s), ${warnings.length} warning(s) — ${cfg.name || ROOT}`);
process.exit(errors.length ? 1 : 0);
