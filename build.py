# Copyright (C) 2026 Domestone S.r.l.
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as
# published by the Free Software Foundation, either version 3 of the
# License, or (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program. If not, see <https://www.gnu.org/licenses/>.
"""Builds Valesta.

Usage:  python -I build.py          (from the folder of the app)
Output (in the folder dist/):
  Valesta.html            the full app in one file (it works offline from file://)
  Web/                    the same app as a PWA to install on a phone (index.html, manifest, service worker, icons)
  mcp/                    MCP server for Claude Desktop / Claude Code / Gemini CLI / LM Studio (Node.js, no dependencies)
"""
import base64
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "dist")
VERSION = "1.1"

PARTS = {
    "FONTS_CSS": "src/css/fonts.css", "FONTS_CJK_CSS": "src/css/fonts-cjk.css", "REPORT_CSS": "src/css/report.css", "APP_CSS": "src/css/app.css",
    "I18N_JS": "src/js/i18n.js", "NUMWORDS_JS": "src/js/numwords.js", "ENGINE_JS": "src/js/engine.js", "DATA_JS": "src/js/data.js", "ASSETS_JS": "src/js/assets.js",
    "CHARTS_JS": "src/js/charts.js", "REPORT_I18N_JS": "src/js/report_i18n.js", "LANG_PACKS_JS": "src/js/lang", "REFERENCES_JS": "src/js/references.js", "METHOD_JS": "src/js/method.js", "REPORT_JS": "src/js/report.js", "PROFILES_ASSETS_JS": "src/js/profiles_assets.js", "PROFILES_JS": "src/js/profiles.js", "APPCORE_JS": "src/js/appcore.js",
    "REVIEW_JS": "src/js/review.js", "UI_I18N_JS": "src/js/ui_i18n.js", "UI_PACKS_JS": "src/js/lang-ui", "AITOOLS_JS": "src/js/aitools.js", "PROVIDERS_JS": "src/js/providers.js",
    "TAXONOMY_JS": "src/js/taxonomy.js", "CHECKS_JS": "src/js/checks.js", "AIREVIEW_JS": "src/js/aireview.js", "WORKFLOW_JS": "src/js/workflow.js", "MAPS_JS": "src/js/maps.js", "GEO_JS": "src/js/geo.js", "GEOCODE_JS": "src/js/geocode.js", "MAPVIEW_JS": "src/js/mapview.js", "ZIP_JS": "src/js/zip.js", "STORE_JS": "src/js/store.js", "ASSISTANT_JS": "src/js/assistant.js", "EDITOR_JS": "src/js/editor.js",
    "SUPPORT_JS": "src/js/support.js",
}
PARTS["THEME_JS"] = "src/js/theme.js"  # light, dark or automatic theme of the interface (menu "View")
PARTS["LAYOUT_JS"] = "src/js/layout.js"  # workspace modes (Form, Form + document, Document review) and the preview divider
PARTS["MOTION_JS"] = "src/js/motion.js"  # sliding indicators of segmented controls and tabs
MCP_LIB = ["i18n.js", "engine.js", "data.js", "assets.js", "charts.js", "report_i18n.js", "references.js", "method.js", "report.js", "profiles_assets.js", "profiles.js", "appcore.js", "review.js", "aitools.js", "taxonomy.js", "checks.js", "aireview.js", "maps.js", "numwords.js"]
# Brand files (not under AGPL-3.0, see brand/README.md): app icons, favicon and the name in the header.
BRAND = os.path.join(ROOT, "brand")


def brand_svg(name):
    with open(os.path.join(BRAND, name), encoding="utf-8") as f:
        return f.read().strip()


def brand_uri(name):
    return "data:image/svg+xml;base64," + base64.b64encode(brand_svg(name).encode("utf-8")).decode("ascii")


ICON_ROUND = brand_svg("valesta-app-icon.svg")
ICON_FULL = brand_svg("valesta-app-icon-maskable.svg")


def inline_svg(svg, current_color=False):
    """SVG for inline use in the page: decorative (the name is in the text), no title, optional currentColor."""
    svg = re.sub(r"<title>.*?</title>", "", svg, count=1).replace("<svg ", '<svg aria-hidden="true" focusable="false" ', 1)
    return re.sub(r'fill="#[0-9A-Fa-f]{6}"', 'fill="currentColor"', svg) if current_color else svg


def read(rel):
    with open(os.path.join(ROOT, rel), encoding="utf-8") as f:
        return f.read()


def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)


def build_info():
    """When the app was built and from which commit ("dirty": changes not committed); shown in the menu next to the
    version. Outside a git checkout only the time is known."""
    info = {"time": int(time.time() * 1000), "commit": "", "dirty": False}

    def git(*args):
        return subprocess.run(["git", "-C", ROOT, *args], capture_output=True, text=True, check=True, timeout=30).stdout.strip()

    try:
        info["commit"] = git("rev-parse", "--short", "HEAD")
        info["dirty"] = bool(git("status", "--porcelain"))
    except (OSError, subprocess.SubprocessError):
        pass
    return info


def assemble():
    html = read("src/index.template.html")
    markers = {"@FAVICON@": "data:image/svg+xml;base64," + base64.b64encode(ICON_ROUND.encode("utf-8")).decode("ascii"),
               "<!--@APP_ICON@-->": inline_svg(ICON_ROUND), "<!--@WORDMARK@-->": inline_svg(brand_svg("valesta-wordmark.svg"), True),
               "/*@BRAND_JS@*/": "self.VALESTA_LOGO = " + json.dumps({"light": brand_uri("valesta-logo.svg"), "dark": brand_uri("valesta-logo-reverse.svg")}) + ";",
               "/*@BUILD_JS@*/": "self.VALESTA_BUILD = " + json.dumps(build_info()) + ";"}
    for marker, value in markers.items():
        if marker not in html:
            sys.exit(f"marker {marker} missing in template")
        html = html.replace(marker, value, 1)
    for key, rel in PARTS.items():
        src = read_part(rel)
        tag = "script" if key.endswith("_JS") else "style"
        src = re.sub(r"</(%s)" % tag, r"<\\/\1", src, flags=re.I)
        marker = f"/*@{key}@*/"
        if marker not in html:
            sys.exit(f"marker {marker} missing in template")
        html = html.replace(marker, src, 1)
    left = re.findall(r"/\*@[A-Z0-9_]+@\*/", html)
    if left:
        sys.exit(f"unresolved markers: {left}")
    if re.search(r"<script[^>]+src=", html, flags=re.I):
        sys.exit("external scripts are not allowed in the distributable")
    if re.search(r"<[a-z][^>]*\son[a-z]+\s*=", read("src/index.template.html"), flags=re.I):
        sys.exit("inline event handlers are not allowed (Content-Security-Policy)")
    return with_csp(html)


def with_csp(html):
    """Content-Security-Policy: only the inline scripts of this build run (by hash); no plug-ins, base or form targets;
    images, fonts and connections to the app itself, data: and blob: URLs, https services the user turns on and local
    AI models."""
    scripts = re.findall(r"<script>(.*?)</script>", html, flags=re.S)
    hashes = sorted({"'sha256-" + base64.b64encode(hashlib.sha256(s.encode("utf-8")).digest()).decode("ascii") + "'" for s in scripts})
    if re.search(r"<script\b", re.sub(r"<script>.*?</script>", "", html, flags=re.S), flags=re.I):
        sys.exit("every script must be a plain inline <script> (Content-Security-Policy)")
    policy = "; ".join(["default-src 'self'", "script-src " + " ".join(hashes), "style-src 'self' 'unsafe-inline'",
                        "img-src 'self' data: blob: https:", "font-src 'self' data:", "connect-src 'self' https: http://localhost:* http://127.0.0.1:*",
                        "worker-src 'self'", "manifest-src 'self'", "object-src 'none'", "base-uri 'none'", "form-action 'none'"])
    marker = '<meta charset="utf-8">'
    if marker not in html:
        sys.exit("charset meta missing in template")
    return html.replace(marker, marker + '\n<meta http-equiv="Content-Security-Policy" content="' + policy + '">', 1)


def part_files(rel):
    path = os.path.join(ROOT, rel)
    if os.path.isdir(path):
        return [os.path.join(path, f) for f in sorted(os.listdir(path)) if f.endswith(".js")]
    return [path]


def read_part(rel):
    return "\n".join(open(f, encoding="utf-8").read() for f in part_files(rel))


def find_chrome():
    env = os.environ
    for p in [env.get("CHROME_PATH"), os.path.join(env.get("ProgramFiles", r"C:\Program Files"), r"Google\Chrome\Application\chrome.exe"),
              os.path.join(env.get("ProgramFiles(x86)", r"C:\Program Files (x86)"), r"Google\Chrome\Application\chrome.exe"),
              os.path.join(env.get("LOCALAPPDATA", ""), r"Google\Chrome\Application\chrome.exe"),
              os.path.join(env.get("ProgramFiles(x86)", r"C:\Program Files (x86)"), r"Microsoft\Edge\Application\msedge.exe"),
              "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"]:
        if p and os.path.exists(p):
            return p
    return None


def icons(web):
    """PNG icons rendered from the SVG mark with headless Chrome (kept if Chrome is missing)."""
    out = os.path.join(web, "icons")
    os.makedirs(out, exist_ok=True)
    stamp = os.path.join(ROOT, ".icons-stamp")
    digest = hashlib.sha1((ICON_ROUND + ICON_FULL).encode()).hexdigest()
    if os.path.exists(stamp) and open(stamp).read() == digest:
        return "icons up to date"
    chrome = find_chrome()
    if not chrome:
        return "icons skipped (Chrome/Edge not found)"
    tmp = tempfile.mkdtemp(prefix="valesta-icons-")
    jobs = [("icon-192.png", ICON_ROUND, 192, True), ("icon-512.png", ICON_ROUND, 512, True), ("maskable-512.png", ICON_FULL, 512, False), ("apple-touch-icon.png", ICON_FULL, 180, False)]
    for name, svg, size, transparent in jobs:
        page = os.path.join(tmp, name + ".html")
        write(page, f'<!doctype html><html><body style="margin:0;background:transparent">{svg.replace("<svg ", f"<svg width={chr(34)}{size}{chr(34)} height={chr(34)}{size}{chr(34)} style={chr(34)}display:block{chr(34)} ", 1)}</body></html>')
        args = [chrome, "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", f"--user-data-dir={os.path.join(tmp, 'profile')}",
                "--hide-scrollbars", "--force-device-scale-factor=1", f"--window-size={size},{size}", f"--screenshot={os.path.join(out, name)}"]
        if transparent:
            args.append("--default-background-color=00000000")
        args.append("file:///" + page.replace("\\", "/"))
        subprocess.run(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=90)
    shutil.rmtree(tmp, ignore_errors=True)
    open(stamp, "w").write(digest)
    return "icons rendered"


def pwa(web, html):
    write(os.path.join(web, "index.html"), html)
    manifest = {
        "name": "Valesta — Property valuation", "short_name": "Valesta", "id": "./", "start_url": "./", "scope": "./", "display": "standalone", "orientation": "any",
        "description": "Valesta (Value Estate Assistant): property valuation with A4 reports in 17 languages and an AI assistant.",
        "background_color": "#F9F4EA", "theme_color": "#0B4F47", "lang": "en", "categories": ["business", "productivity", "finance"],
        "icons": [{"src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
                  {"src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
                  {"src": "icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}],
    }
    write(os.path.join(web, "manifest.webmanifest"), json.dumps(manifest, ensure_ascii=False, indent=1))
    cache = "valesta-" + hashlib.sha1(html.encode("utf-8")).hexdigest()[:12]
    write(os.path.join(web, "sw.js"), f"""/* Valesta service worker: app shell offline; live sync and MCP always on the network. */
const CACHE = '{cache}';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/apple-touch-icon.png'];
self.addEventListener('install', (e) => {{ e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())); }});
self.addEventListener('activate', (e) => {{
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => (k.startsWith('valesta-') || k.startsWith('valorem-')) && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
}});
self.addEventListener('fetch', (e) => {{
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.includes('/api/') || url.pathname.endsWith('/mcp')) return;
  e.respondWith(caches.match(req, {{ ignoreSearch: true }}).then((hit) => hit || fetch(req).then((res) => {{
    if (res.ok && res.type === 'basic') {{ const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }}
    return res;
  }}).catch(() => caches.match('./index.html'))));
}});
""")
    return cache


def mcp():
    dest = os.path.join(OUT, "mcp")
    lib = os.path.join(dest, "lib")
    os.makedirs(lib, exist_ok=True)
    for f in MCP_LIB:
        shutil.copyfile(os.path.join(ROOT, "src", "js", f), os.path.join(lib, f))
    os.makedirs(os.path.join(lib, "lang"), exist_ok=True)
    for f in part_files("src/js/lang"):
        shutil.copyfile(f, os.path.join(lib, "lang", os.path.basename(f)))
    for f in ["fonts.css", "fonts-cjk.css", "report.css"]:
        shutil.copyfile(os.path.join(ROOT, "src", "css", f), os.path.join(lib, f))
    shutil.copyfile(os.path.join(ROOT, "mcp", "valesta-mcp.js"), os.path.join(dest, "valesta-mcp.js"))
    shutil.copyfile(os.path.join(ROOT, "mcp", "README.md"), os.path.join(dest, "README.md"))
    os.makedirs(os.path.join(dest, "brand"), exist_ok=True)   # Valesta logo for the neutral profile (brand files, see brand/README.md)
    for f in ["valesta-logo.svg", "valesta-logo-reverse.svg", "README.md"]:
        shutil.copyfile(os.path.join(BRAND, f), os.path.join(dest, "brand", f))
    pkg = {"name": "valesta-mcp", "version": VERSION + ".0", "description": "Valesta property valuation — MCP server (stdio + local HTTP with live web app)",
           "license": "AGPL-3.0-or-later", "private": True, "bin": {"valesta-mcp": "valesta-mcp.js"}, "main": "valesta-mcp.js", "engines": {"node": ">=20"},
           "scripts": {"start": "node valesta-mcp.js --http", "stdio": "node valesta-mcp.js"}}
    write(os.path.join(dest, "package.json"), json.dumps(pkg, indent=1))
    return dest


def licences(dest):
    """Each package that we distribute carries the licence of Valesta (LICENSE), the notices (NOTICE) and the licence
    texts of the third-party components (LICENSES/): fonts, base maps and the libraries of the native apps."""
    texts = os.path.join(dest, "LICENSES")
    shutil.rmtree(texts, ignore_errors=True)
    os.makedirs(texts)
    for f in ["LICENSE", "NOTICE"]:
        shutil.copyfile(os.path.join(ROOT, f), os.path.join(dest, f))
    for f in sorted(os.listdir(os.path.join(ROOT, "LICENSES"))):
        if f.endswith(".txt"):
            shutil.copyfile(os.path.join(ROOT, "LICENSES", f), os.path.join(texts, f))


def check(paths):
    try:
        for p in paths:
            subprocess.run(["node", "--check", p], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        return "syntax ok"
    except FileNotFoundError:
        return "node not found: syntax not checked"
    except subprocess.CalledProcessError as e:
        sys.exit("syntax error: " + e.stderr.decode("utf-8", "replace"))


def main():
    js = [f for k, rel in PARTS.items() if k.endswith("_JS") for f in part_files(rel)] + [os.path.join(ROOT, "mcp", "valesta-mcp.js")]
    status = check(js)
    html = assemble()
    write(os.path.join(OUT, "Valesta.html"), html)
    for old in [os.path.join(OUT, "Valorem.html"), os.path.join(OUT, "mcp", "valorem-mcp.js")]:   # outputs of Valorem 1.1, the app before Valesta
        if os.path.exists(old):
            os.remove(old)
    web = os.path.join(OUT, "Web")
    cache = pwa(web, html)
    ic = icons(web)
    licences(web)
    dest = mcp()
    licences(dest)
    print(f"Valesta {VERSION}: Valesta.html {len(html) // 1024} KB · Web/ ({cache}, {ic}) · {os.path.relpath(dest, OUT)}/ · {status}")


if __name__ == "__main__":
    main()
