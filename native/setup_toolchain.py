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
"""Installs the tools that build the Android app of Valesta into the folder _tools (the folder of build-android.ps1).
It installs nothing in the system.

Usage:  python -I setup_toolchain.py [tools_folder]
- Eclipse Temurin JDK 21 (Adoptium) → _tools/jdk-21
- Android SDK command-line tools → _tools/android-sdk (platform-tools, platform and build-tools)
When you run it, you accept the licence of the Android SDK (Android Software Development Kit License Agreement).
"""
import io
import os
import shutil
import subprocess
import sys
import urllib.request
import zipfile

sys.stdout.reconfigure(encoding="utf-8")
TOOLS = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "_tools"))
JDK_URL = "https://api.adoptium.net/v3/binary/latest/21/ga/windows/x64/jdk/hotspot/normal/eclipse?project=jdk"
CMDLINE_URL = "https://dl.google.com/android/repository/commandlinetools-win-16111833_latest.zip"
PACKAGES = ["platform-tools", "platforms;android-36", "build-tools;36.0.0"]


def fetch(url, label):
    print(f"download {label} …", flush=True)
    req = urllib.request.Request(url, headers={"User-Agent": "Valesta-build/1.0"})
    with urllib.request.urlopen(req, timeout=600) as r:
        data = r.read()
    print(f"  {len(data) // (1024 * 1024)} MB", flush=True)
    return data


def unzip(data, dest, strip_top=True):
    tmp = dest + ".tmp"
    shutil.rmtree(tmp, ignore_errors=True)
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        z.extractall(tmp)
    inner = os.listdir(tmp)
    src = os.path.join(tmp, inner[0]) if strip_top and len(inner) == 1 else tmp
    shutil.rmtree(dest, ignore_errors=True)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    shutil.move(src, dest)
    shutil.rmtree(tmp, ignore_errors=True)


def main():
    os.makedirs(TOOLS, exist_ok=True)
    jdk = os.path.join(TOOLS, "jdk-21")
    if not os.path.exists(os.path.join(jdk, "bin", "java.exe")):
        unzip(fetch(JDK_URL, "Temurin JDK 21"), jdk)
    sdk = os.path.join(TOOLS, "android-sdk")
    latest = os.path.join(sdk, "cmdline-tools", "latest")
    if not os.path.exists(os.path.join(latest, "bin", "sdkmanager.bat")):
        unzip(fetch(CMDLINE_URL, "Android command-line tools"), latest)
    env = dict(os.environ, JAVA_HOME=jdk, ANDROID_HOME=sdk, ANDROID_SDK_ROOT=sdk)
    env["PATH"] = os.path.join(jdk, "bin") + os.pathsep + env.get("PATH", "")
    sdkmanager = os.path.join(latest, "bin", "sdkmanager.bat")
    print("accept Android SDK licences", flush=True)
    subprocess.run([sdkmanager, f"--sdk_root={sdk}", "--licenses"], input=("y\n" * 40).encode(), env=env, check=True, stdout=subprocess.DEVNULL)
    print("install " + ", ".join(PACKAGES), flush=True)
    subprocess.run([sdkmanager, f"--sdk_root={sdk}"] + PACKAGES, input=("y\n" * 10).encode(), env=env, check=True, stdout=subprocess.DEVNULL)
    print(f"ready: JAVA_HOME={jdk}  ANDROID_HOME={sdk}", flush=True)


if __name__ == "__main__":
    main()
