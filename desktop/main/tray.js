/**
 * System Tray Integration for N.A.V.I.I.
 * Provides quick access, minimize-to-tray, and status monitoring.
 */

const { Tray, Menu, nativeImage, app } = require('electron');

let trayInstance = null;

// Procedural 16x16 futuristic cyan icon (base64 PNG)
const TRAY_ICON_DATA = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAZklEQVR4nGNgGAXUBIxgwtLSkv9gTC4gxgB0TYyMjPy45LHZiK4Jm0tQDWBkZPxPTD0hNWCG4DMRnwGMjIz/sblqFIwCwgEMQ3AZkJaW9h8mhh6zGBgYGP6jK8ZpAJHhN4qBCwAAcR43jN3NqQkAAAAASUVORK5CYII=';

function createTray(mainWindow) {
  if (trayInstance) return trayInstance;

  try {
    const icon = nativeImage.createFromDataURL(TRAY_ICON_DATA);
    trayInstance = new Tray(icon);
    trayInstance.setToolTip('N.A.V.I.I - Neural Assistant for Virtual Intelligence & Interaction');

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'N.A.V.I.I AI Assistant',
        enabled: false,
      },
      { type: 'separator' },
      {
        label: 'Open N.A.V.I.I',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        },
      },
      {
        label: 'New Session',
        accelerator: 'CmdOrCtrl+N',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
            mainWindow.webContents.send('session:new');
          }
        },
      },
      {
        label: 'Preferences',
        accelerator: 'CmdOrCtrl+,',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
            mainWindow.webContents.send('settings:open');
          }
        },
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          app.isQuitting = true;
          app.quit();
        },
      },
    ]);

    trayInstance.setContextMenu(contextMenu);

    trayInstance.on('double-click', () => {
      if (mainWindow) {
        if (mainWindow.isVisible()) {
          mainWindow.focus();
        } else {
          mainWindow.show();
        }
      }
    });

    return trayInstance;
  } catch (e) {
    console.warn('[N.A.V.I.I Tray] Could not initialize system tray:', e);
    return null;
  }
}

module.exports = { createTray };
