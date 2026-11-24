/**
 * Main Process for N.A.V.I.I Electron Application.
 * Configures secure window lifecycle, sandbox, context isolation, tray, and state persistence.
 */

const { app, BrowserWindow, shell, globalShortcut } = require('electron');
const path = require('path');
const { setupIpcHandlers } = require('./ipc-handlers');
const { WindowStateManager } = require('./window-state');
const { createTray } = require('./tray');

let mainWindow = null;
let windowStateManager = null;

function createMainWindow() {
  windowStateManager = new WindowStateManager({
    defaultWidth: 1280,
    defaultHeight: 840,
  });

  const { width, height, x, y, isMaximized } = windowStateManager.state;

  mainWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    minWidth: 980,
    minHeight: 660,
    frame: false, // Frameless for custom futuristic glass titlebar
    titleBarStyle: 'hidden',
    backgroundColor: '#07090e',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      spellcheck: true,
    },
    show: false, // Prevents white flash before CSS loads
  });

  if (isMaximized) {
    mainWindow.maximize();
  }

  windowStateManager.track(mainWindow);

  mainWindow.loadFile(path.join(__dirname, '../src/index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Intercept new window requests and open securely in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  setupIpcHandlers(mainWindow);
  createTray(mainWindow);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App lifecycle
app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
