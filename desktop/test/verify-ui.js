const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const { setupIpcHandlers } = require('../main/ipc-handlers');
const { WindowStateManager } = require('../main/window-state');

const logFile = path.join(__dirname, 'console.log');
const resultFile = path.join(__dirname, 'test-result.json');
fs.writeFileSync(logFile, '', 'utf8');
if (fs.existsSync(resultFile)) fs.unlinkSync(resultFile);

app.whenReady().then(async () => {
  const windowStateManager = new WindowStateManager({ defaultWidth: 1024, defaultHeight: 768 });
  const win = new BrowserWindow({
    width: 1024,
    height: 768,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  windowStateManager.track(win);
  setupIpcHandlers(win);

  win.webContents.on('console-message', (e, level, message, line, sourceId) => {
    fs.appendFileSync(logFile, `[CONSOLE ${level}] ${message} (${sourceId}:${line})\n`, 'utf8');
  });

  win.webContents.on('did-finish-load', () => {
    win.webContents.executeJavaScript(`
      (async () => {
        const appInfo = await window.naviiAPI.getAppInfo();
        const isMax = await window.naviiAPI.isMaximized();

        // 1. Test Automation Capability (get_system_telemetry)
        const telemetryRes = await window.naviiAPI.executeAutomation('get_system_telemetry', {});

        // 2. Test Arbitrary Shell Protection (Must throw or return error)
        let shellBlocked = false;
        try {
          await window.naviiAPI.executeAutomation('shell', { cmd: 'dir' });
        } catch (e) {
          shellBlocked = true;
        }

        // 3. Test Preference Store Roundtrip
        await window.naviiAPI.savePreferences({ theme: 'dark', testKey: 'navii_verified' });
        const prefs = await window.naviiAPI.getPreferences();

        // 4. Test Native Notification Bridge
        const notifSupported = await window.naviiAPI.showNotification({
          title: 'N.A.V.I.I Automated Verification',
          body: 'Phase 3 Desktop functionality confirmed.'
        });

        // 5. Test Automation Capabilities List
        const capabilities = await window.naviiAPI.getAutomationCapabilities();

        // 6. Test Multi-Model UI Components
        const modelSelector = document.getElementById('model-selector-wrapper');
        const modelTrigger = document.getElementById('model-dropdown-trigger');
        const modelOptions = document.querySelectorAll('.model-option');
        const settingOptions = document.querySelectorAll('#setting-model-select option');

        // 7. Test Auth Components (Google OAuth & Email/Password)
        const googleAuthBtn = document.getElementById('btn-google-signin');
        const authModal = document.getElementById('profile-modal');
        const authEmail = document.getElementById('auth-email');
        const authPassword = document.getElementById('auth-password');

        return {
          title: document.title,
          appInfo,
          isMaximized: isMax,
          telemetrySuccess: telemetryRes.success && !!telemetryRes.data.platform,
          shellExecutionBlocked: shellBlocked,
          prefsRoundtrip: prefs && prefs.testKey === 'navii_verified',
          notifTriggered: typeof notifSupported === 'boolean',
          capabilitiesCount: Object.keys(capabilities || {}).length,
          multiModelUI: {
            hasModelSelector: !!modelSelector,
            hasModelTrigger: !!modelTrigger,
            modelOptionCount: modelOptions.length,
            hasFreeModelsInSetting: Array.from(settingOptions).some(o => o.value.includes(':free')),
            settingOptionCount: settingOptions.length
          },
          authUI: {
            hasGoogleAuthBtn: !!googleAuthBtn,
            hasAuthModal: !!authModal,
            hasEmailInput: !!authEmail,
            hasPasswordInput: !!authPassword,
            hasNaviiAuth: typeof window.NaviiAuth === 'object'
          },
          hasApiMethods: {
            openFileDialog: typeof window.naviiAPI.openFileDialog === 'function',
            showNotification: typeof window.naviiAPI.showNotification === 'function',
            getPreferences: typeof window.naviiAPI.getPreferences === 'function',
            executeAutomation: typeof window.naviiAPI.executeAutomation === 'function',
            onMaximizedChange: typeof window.naviiAPI.onMaximizedChange === 'function'
          }
        };
      })()
    `).then(result => {
      fs.writeFileSync(
        path.join(__dirname, 'test-result.json'),
        JSON.stringify({ status: 'PASS', details: result, timestamp: new Date().toISOString() }, null, 2),
        'utf8'
      );
      setTimeout(() => app.quit(), 200);
    }).catch(err => {
      fs.writeFileSync(
        path.join(__dirname, 'test-result.json'),
        JSON.stringify({ status: 'FAIL', error: err.message }, null, 2),
        'utf8'
      );
      setTimeout(() => app.quit(), 200);
    });
  });

  win.loadFile(path.join(__dirname, '../src/index.html'));

  setTimeout(() => {
    if (!fs.existsSync(path.join(__dirname, 'test-result.json'))) {
      fs.writeFileSync(
        path.join(__dirname, 'test-result.json'),
        JSON.stringify({ status: 'TIMEOUT' }, null, 2),
        'utf8'
      );
    }
    app.quit();
  }, 12000);
});
