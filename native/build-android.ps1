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
# Builds the Android app with a local toolchain (JDK 21 + Android SDK, see setup_toolchain.py).
#   .\build-android.ps1           -> dist\android\Valesta-<version>-debug.apk (debug key, for tests)
#   .\build-android.ps1 -NewKey   -> creates the release key (once; keytool asks for its password)
#   .\build-android.ps1 -Release  -> dist\android\Valesta-<version>.apk and .aab, signed with the release key
# The release key is ..\..\private\valesta-release.jks next to the repository, or -Keystore <path>, or
# $env:VALESTA_KEYSTORE. It never goes into the repository, and its password is asked for each release build and never
# written to disk. Keep a backup of the key: updates of the app must be signed with the same key.
# Toolchain folder: $env:DV_ANDROID_TOOLS, or ..\..\_tools next to the repository.
param([switch]$Release, [switch]$NewKey, [string]$Keystore)
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$repo = Resolve-Path (Join-Path $here '..')
$tools = if ($env:DV_ANDROID_TOOLS) { $env:DV_ANDROID_TOOLS } else { Join-Path $repo '..\..\_tools' }
if (-not (Test-Path (Join-Path $tools 'jdk-21'))) { throw "Android toolchain not found in $tools (set DV_ANDROID_TOOLS or run setup_toolchain.py)" }
$env:JAVA_HOME = Join-Path $tools 'jdk-21'
$env:ANDROID_HOME = Join-Path $tools 'android-sdk'
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:GRADLE_USER_HOME = Join-Path $tools 'gradle-home'
$env:Path = (Join-Path $env:JAVA_HOME 'bin') + ';' + $env:Path
if (-not $Keystore) { $Keystore = if ($env:VALESTA_KEYSTORE) { $env:VALESTA_KEYSTORE } else { Join-Path $repo '..\..\private\valesta-release.jks' } }
$Keystore = [System.IO.Path]::GetFullPath($Keystore)

if ($NewKey) {
  if (Test-Path $Keystore) { throw "$Keystore already exists. Apps signed with it can be updated only with it: keep it." }
  New-Item -ItemType Directory -Force (Split-Path $Keystore) | Out-Null
  keytool -genkeypair -v -keystore $Keystore -alias valesta -keyalg RSA -keysize 4096 -validity 10000 -dname 'CN=Valesta, O=Domestone S.r.l., C=IT'
  if ($LASTEXITCODE -ne 0) { throw 'keytool failed' }
  Write-Host "Release key created: $Keystore. Keep a copy of it and of its password in a safe place."
  return
}

# File name follows the version the phone shows (versionName in android/app/build.gradle)
$version = [regex]::Match((Get-Content (Join-Path $here 'android\app\build.gradle') -Raw), 'versionName\s+"([^"]+)"').Groups[1].Value
if (-not $version) { throw 'versionName not found in android\app\build.gradle' }
$name = 'Valesta'

if ($Release -and -not (Test-Path (Join-Path $here 'keystore.properties'))) {
  if (-not (Test-Path $Keystore)) { throw "Release key not found: $Keystore. Create it once with .\build-android.ps1 -NewKey" }
  $secure = Read-Host 'Password of the release key' -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
  $env:VALESTA_KEYSTORE = $Keystore
  $env:VALESTA_KEY_ALIAS = 'valesta'
  $env:VALESTA_KEYSTORE_PASSWORD = $plain
  $env:VALESTA_KEY_PASSWORD = $plain
}

try {
  Push-Location $repo; python -I build.py; Pop-Location
  Push-Location $here
  node prepare-www.js
  npx cap sync android
  Push-Location android
  if ($Release) { .\gradlew.bat assembleRelease bundleRelease --no-daemon --console=plain } else { .\gradlew.bat assembleDebug --no-daemon --console=plain }
  if ($LASTEXITCODE -ne 0) { throw 'Gradle build failed' }
  Pop-Location; Pop-Location
} finally {
  foreach ($v in 'VALESTA_KEYSTORE_PASSWORD', 'VALESTA_KEY_PASSWORD') { Remove-Item "Env:$v" -ErrorAction SilentlyContinue }
}

$out = Join-Path $repo 'dist\android'
New-Item -ItemType Directory -Force $out | Out-Null
if ($Release) {
  Copy-Item (Join-Path $here 'android\app\build\outputs\apk\release\app-release.apk') (Join-Path $out "$name-$version.apk") -Force
  Copy-Item (Join-Path $here 'android\app\build\outputs\bundle\release\app-release.aab') (Join-Path $out "$name-$version.aab") -Force
} else {
  Copy-Item (Join-Path $here 'android\app\build\outputs\apk\debug\app-debug.apk') (Join-Path $out "$name-$version-debug.apk") -Force
}
Get-ChildItem $out
