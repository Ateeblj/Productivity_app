/**
 * Electron main — serves dist/, opens external links in system browser.
 * Fixed port + persistent partition so login & Supabase keys survive restarts.
 * Express 5-safe (no app.get('*')).
 */
const { app, BrowserWindow, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const express = require('express');
const http = require('http');

let server = null;
let win = null;

/** Fixed origin so localStorage / AsyncStorage persist across launches */
const PORT = 47832;

function log(msg) {
  try {
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    fs.appendFileSync(path.join(app.getPath('userData'), 'startup.log'), line);
  } catch (_) {}
  console.log(msg);
}

function findDist() {
  const candidates = [
    path.join(__dirname, 'dist'),
    path.join(process.resourcesPath || '', 'app.asar.unpacked', 'dist'),
    path.join(process.resourcesPath || '', 'app', 'dist'),
    path.join(process.resourcesPath || '', 'dist'),
    path.join(path.dirname(process.execPath), 'resources', 'app.asar.unpacked', 'dist'),
    path.join(path.dirname(process.execPath), 'resources', 'dist'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(path.join(p, 'index.html'))) {
      log('Found dist at: ' + p);
      return p;
    }
  }
  log('dist NOT found. Tried: ' + candidates.join(' | '));
  return null;
}

function isExternal(url) {
  if (!url) return false;
  if (url.startsWith('http://127.0.0.1') || url.startsWith('http://localhost')) return false;
  return /^https?:\/\//i.test(url);
}

function createWindow() {
  const root = findDist();
  if (!root) {
    dialog.showErrorBox(
      'UI missing',
      'Could not find dist/index.html.\n\nCheck startup.log in:\n' + app.getPath('userData')
    );
    app.quit();
    return;
  }

  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      // Persist login session + Supabase credentials across app restarts
      partition: 'persist:productivityapp',
    },
    show: false,
    backgroundColor: '#0d0d1a',
    title: 'Productivity App',
  });

  const expressApp = express();
  expressApp.use(express.static(root));
  // Express 5-safe SPA fallback
  expressApp.use((req, res) => {
    res.sendFile(path.join(root, 'index.html'));
  });

  server = http.createServer(expressApp);

  const start = (port) => {
    server.listen(port, '127.0.0.1', () => {
      const actual = server.address().port;
      log('Server on http://127.0.0.1:' + actual);
      win.loadURL('http://127.0.0.1:' + actual);
      win.once('ready-to-show', () => win.show());
    });
  };

  server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
      log('Port ' + PORT + ' in use, falling back to random port');
      start(0);
    } else {
      log('Server error: ' + String(err));
      dialog.showErrorBox('Server error', String(err));
      app.quit();
    }
  });

  start(PORT);

  win.webContents.on('did-fail-load', (_e, code, desc) => {
    log('did-fail-load ' + code + ' ' + desc);
    dialog.showErrorBox('Load failed', String(code) + ' ' + String(desc));
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternal(url)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (isExternal(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (server) {
    try { server.close(); } catch (_) {}
    server = null;
  }
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
