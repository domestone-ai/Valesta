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
"""Source images for the native app icons and splash screens (rendered with headless Chrome).

Usage: python -I make_icons.py   →   assets/icon-only.png, icon-foreground.png, icon-background.png, splash.png, splash-dark.png
Then: npx @capacitor/assets generate --android --ios
"""
import json
import os
import subprocess
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "assets")
# Symbol and colours from brand/brand.json (brand files are not under AGPL-3.0, see brand/README.md).
with open(os.path.join(HERE, "..", "brand", "brand.json"), encoding="utf-8") as _f:
    BRAND = json.load(_f)
C = BRAND["colors"]
GRAD = (f'<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{C["tealDeep"]}"/>'
        f'<stop offset="1" stop-color="{C["teal"]}"/></linearGradient></defs>')
MARK = BRAND["symbolOnDark"]


def svg(body, size, bg=True, scale=1.0):
    rect = '<rect width="64" height="64" fill="url(#g)"/>' if bg else ""
    mark = f'<g transform="translate(32 32) scale({scale}) translate(-32 -32)">{MARK}</g>'
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="{size}" height="{size}" style="display:block">{GRAD}{rect}{mark if body else ""}</svg>'


def chrome():
    for p in [os.environ.get("CHROME_PATH"), r"C:\Program Files\Google\Chrome\Application\chrome.exe", r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"]:
        if p and os.path.exists(p):
            return p
    raise SystemExit("Chrome/Edge not found")


def shot(name, html, size, transparent):
    tmp = tempfile.mkdtemp(prefix="valesta-icon-")
    page = os.path.join(tmp, "p.html")
    open(page, "w", encoding="utf-8").write(f'<!doctype html><html><body style="margin:0;background:transparent">{html}</body></html>')
    args = [chrome(), "--headless=new", "--disable-gpu", "--no-first-run", f"--user-data-dir={os.path.join(tmp, 'prof')}", "--hide-scrollbars",
            "--force-device-scale-factor=1", f"--window-size={size},{size}", f"--screenshot={os.path.join(OUT, name)}"]
    if transparent:
        args.append("--default-background-color=00000000")
    subprocess.run(args + ["file:///" + page.replace("\\", "/")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=120)


def main():
    os.makedirs(OUT, exist_ok=True)
    shot("icon-only.png", svg(True, 1024, True, 0.74), 1024, False)
    shot("icon-background.png", svg(False, 1024, True), 1024, False)
    shot("icon-foreground.png", svg(True, 1024, False, 0.6), 1024, True)
    splash = lambda: (f'<div style="width:2732px;height:2732px;background:linear-gradient(135deg,{C["tealDeep"]},{C["teal"]});'
                      f'display:grid;place-items:center">{svg(True, 480, False, 1.0)}</div>')
    shot("splash.png", splash(), 2732, False)
    shot("splash-dark.png", splash(), 2732, False)
    print("assets:", ", ".join(sorted(os.listdir(OUT))))


if __name__ == "__main__":
    main()
