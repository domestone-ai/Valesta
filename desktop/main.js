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
/* Valesta for Windows: the single-file app (dist/Valesta.html) in its own window, offline.
 * - The page keeps its own Content-Security-Policy and gets no Node.js access (context isolation, sandbox).
 * - Links to outside sites open in the default browser. The window never leaves the app page.
 * - The page gets no permission (camera, microphone, location, notifications), except writing to the clipboard.
 * - Downloads open the usual "Save as" dialog; printing opens the Windows print dialog (Microsoft Print to PDF). */
'use strict';
const { app, BrowserWindow, Menu, nativeTheme, session, shell } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

const PAGE = path.join(__dirname, 'app', 'Valesta.html');
const PAGE_URL = pathToFileURL(PAGE).href;
const outside = (url) => /^https?:\/\//i.test(url);

if (!app.requestSingleInstanceLock()) app.quit();
app.setAppUserModelId('com.domestone.valesta');

let win = null;
function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    show: false,
    title: 'Valesta',
    autoHideMenuBar: true,
    // The colour of the app's canvas, so that no white flash shows before the first paint.
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1C1814' : '#F9F4EA',
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false, devTools: !app.isPackaged },
  });
  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (outside(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith(PAGE_URL)) return;
    event.preventDefault();
    if (outside(url)) shell.openExternal(url);
  });
  win.loadFile(PAGE);
}

app.on('second-instance', () => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
});
app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback) => callback(permission === 'clipboard-sanitized-write'));
  createWindow();
});
app.on('window-all-closed', () => app.quit());
