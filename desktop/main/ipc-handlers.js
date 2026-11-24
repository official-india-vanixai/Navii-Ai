/**
 * Secure IPC Handlers for N.A.V.I.I Electron Application.
 * Mediates safe communication between Main Process and Renderer Process.
 * Enforces strict security boundaries and native dialog integrations.
 */

const { ipcMain, app, shell, dialog, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const { AutomationGateway, CAPABILITY_PERMISSIONS } = require('./automation');

function setupIpcHandlers(mainWindow) {
  const automation = new AutomationGateway(mainWindow);
  const prefsFile = path.join(app.getPath('userData'), 'navii-preferences.json');

  // ---------------------------------------------------------------------------
  // 1. WINDOW CONTROLS & STATE EVENTS
  // ---------------------------------------------------------------------------
  ipcMain.on('window:minimize', () => {
    if (mainWindow) mainWindow.minimize();
  });

  ipcMain.on('window:maximize', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });

  ipcMain.on('window:close', () => {
    if (mainWindow) mainWindow.close();
  });

  ipcMain.handle('window:isMaximized', () => {
    return mainWindow ? mainWindow.isMaximized() : false;
  });

  // Broadcast window maximize state changes to the renderer
  if (mainWindow) {
    mainWindow.on('maximize', () => {
      mainWindow.webContents.send('window:maximized-change', true);
    });
    mainWindow.on('unmaximize', () => {
      mainWindow.webContents.send('window:maximized-change', false);
    });
  }

  // ---------------------------------------------------------------------------
  // 2. NATIVE FILE DIALOGS & PROCESSING
  // ---------------------------------------------------------------------------
  ipcMain.handle('dialog:openFile', async (event, options = {}) => {
    if (!mainWindow) return { canceled: true };

    const filters = options.filters || [
      { name: 'Supported Documents', extensions: ['pdf', 'docx', 'txt', 'csv', 'json', 'md'] },
      { name: 'PDF Documents (*.pdf)', extensions: ['pdf'] },
      { name: 'Word Documents (*.docx)', extensions: ['docx'] },
      { name: 'Plain Text & Data (*.txt, *.csv, *.json)', extensions: ['txt', 'csv', 'json', 'md'] },
      { name: 'All Files (*.*)', extensions: ['*'] }
    ];

    const result = await dialog.showOpenDialog(mainWindow, {
      title: options.title || 'Select Documents for N.A.V.I.I',
      properties: ['openFile', 'multiSelections'],
      filters,
    });

    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return { canceled: true, files: [] };
    }

    const files = [];
    for (const filePath of result.filePaths) {
      try {
        const stats = fs.statSync(filePath);
        const name = path.basename(filePath);
        const ext = path.extname(filePath).replace('.', '').toUpperCase();

        // Read preview for plain text types up to 128KB
        let textPreview = null;
        if (['TXT', 'CSV', 'JSON', 'MD'].includes(ext)) {
          const buffer = fs.readFileSync(filePath, { encoding: 'utf8', flag: 'r' });
          textPreview = buffer.slice(0, 10000);
        }

        files.push({
          id: 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          name,
          path: filePath,
          sizeBytes: stats.size,
          sizeFormatted: (stats.size / (1024 * 1024)).toFixed(2) + ' MB',
          type: ext || 'UNKNOWN',
          textPreview,
          status: 'Ready',
        });
      } catch (err) {
        console.error(`[N.A.V.I.I File Bridge] Error reading ${filePath}:`, err);
      }
    }

    return { canceled: false, files };
  });

  // ---------------------------------------------------------------------------
  // 3. NATIVE NOTIFICATIONS
  // ---------------------------------------------------------------------------
  ipcMain.handle('notification:show', (event, { title, body }) => {
    if (Notification.isSupported()) {
      const notification = new Notification({
        title: title || 'N.A.V.I.I',
        body: body || 'Cognitive task finished.',
      });

      notification.on('click', () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      });

      notification.show();
      return true;
    }
    return false;
  });

  // ---------------------------------------------------------------------------
  // 4. SECURE USER PREFERENCES PERSISTENCE
  // ---------------------------------------------------------------------------
  ipcMain.handle('storage:getPreferences', () => {
    try {
      if (fs.existsSync(prefsFile)) {
        return JSON.parse(fs.readFileSync(prefsFile, 'utf8'));
      }
    } catch (e) {
      console.warn('[N.A.V.I.I Storage] Could not read preferences:', e);
    }
    return null;
  });

  ipcMain.handle('storage:savePreferences', (event, prefs) => {
    try {
      fs.writeFileSync(prefsFile, JSON.stringify(prefs, null, 2), 'utf8');
      return true;
    } catch (e) {
      console.error('[N.A.V.I.I Storage] Error saving preferences:', e);
      return false;
    }
  });

  // ---------------------------------------------------------------------------
  // 5. PERMISSION-BASED DESKTOP AUTOMATION GATEWAY
  // ---------------------------------------------------------------------------
  ipcMain.handle('automation:execute', async (event, { capability, params }) => {
    return automation.executeCapability(capability, params);
  });

  ipcMain.handle('automation:getCapabilities', () => {
    return CAPABILITY_PERMISSIONS;
  });

  // ---------------------------------------------------------------------------
  // 6. APP INFO & EXTERNAL BROWSER LAUNCHER
  // ---------------------------------------------------------------------------
  ipcMain.handle('app:getInfo', () => {
    return {
      name: 'N.A.V.I.I',
      fullName: 'Neural Assistant for Virtual Intelligence & Interaction',
      version: app.getVersion(),
      platform: process.platform,
    };
  });

  ipcMain.on('shell:openExternal', (event, url) => {
    if (typeof url === 'string' && (url.startsWith('https://') || url.startsWith('http://'))) {
      shell.openExternal(url);
    }
  });
}

module.exports = { setupIpcHandlers };
