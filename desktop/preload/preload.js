/**
 * Preload Script for N.A.V.I.I.
 * Securely bridges strictly whitelisted IPC channels to the Renderer.
 * Node integration is DISABLED and context isolation is ENABLED.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('naviiAPI', {
  // Window Controls & State
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  onMaximizedChange: (callback) => {
    if (typeof callback === 'function') {
      ipcRenderer.on('window:maximized-change', (event, isMaximized) => callback(isMaximized));
    }
  },

  // Native File Dialog Bridge
  openFileDialog: (options) => ipcRenderer.invoke('dialog:openFile', options),

  // Native System Notifications
  showNotification: (payload) => ipcRenderer.invoke('notification:show', payload),

  // Local Persistent Store Bridge
  getPreferences: () => ipcRenderer.invoke('storage:getPreferences'),
  savePreferences: (prefs) => ipcRenderer.invoke('storage:savePreferences', prefs),

  // Permission-based Automation Bridge
  executeAutomation: (capability, params) => ipcRenderer.invoke('automation:execute', { capability, params }),
  getAutomationCapabilities: () => ipcRenderer.invoke('automation:getCapabilities'),

  // Application Info & Browser Link Launcher
  getAppInfo: () => ipcRenderer.invoke('app:getInfo'),
  openExternal: (url) => ipcRenderer.send('shell:openExternal', url),

  // Menu / Shortcut IPC Listeners
  onNewSession: (callback) => {
    if (typeof callback === 'function') {
      ipcRenderer.on('session:new', () => callback());
    }
  },
  onOpenSettings: (callback) => {
    if (typeof callback === 'function') {
      ipcRenderer.on('settings:open', () => callback());
    }
  },

  // Platform identity
  platform: process.platform,
  isElectron: true,
});
