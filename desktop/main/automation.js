/**
 * Desktop Automation & Capability Security Gateway for N.A.V.I.I.
 * Strictly enforces permission-based execution.
 * Never executes arbitrary shell commands.
 */

const { dialog, clipboard, shell, app } = require('electron');
const os = require('os');

// Whitelisted capabilities with security clearance tiers
const CAPABILITY_PERMISSIONS = {
  get_system_telemetry: {
    name: 'Read System Telemetry',
    description: 'Access non-sensitive memory and platform usage metrics.',
    sensitive: false,
  },
  read_clipboard: {
    name: 'Access Clipboard Text',
    description: 'Read the current text content from your system clipboard.',
    sensitive: true,
  },
  write_clipboard: {
    name: 'Update Clipboard Content',
    description: 'Copy synthesized text or code into your system clipboard.',
    sensitive: false,
  },
  open_safe_url: {
    name: 'Launch External Browser Link',
    description: 'Open a verified web URL in your default system browser.',
    sensitive: false,
  },
  create_desktop_notification: {
    name: 'Display Desktop Alert',
    description: 'Trigger a Windows system tray notification.',
    sensitive: false,
  },
};

class AutomationGateway {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
  }

  async requestPermission(capabilityKey, details = '') {
    const meta = CAPABILITY_PERMISSIONS[capabilityKey];
    if (!meta) {
      throw new Error(`Capability "${capabilityKey}" is not authorized or whitelisted.`);
    }

    // Non-sensitive capabilities are permitted automatically
    if (!meta.sensitive) {
      return true;
    }

    // Sensitive capabilities require explicit user confirmation via native modal
    const result = await dialog.showMessageBox(this.mainWindow, {
      type: 'question',
      buttons: ['Authorize Action', 'Deny Permission'],
      defaultId: 0,
      cancelId: 1,
      title: 'N.A.V.I.I Security Guard',
      message: `Permission Request: ${meta.name}`,
      detail: `${meta.description}\n\nOperation details: ${details}\n\nDo you authorize N.A.V.I.I to execute this action?`,
      noLink: true,
    });

    return result.response === 0;
  }

  async executeCapability(capabilityKey, params = {}) {
    // 1. Guard against arbitrary shell command execution attempts
    if (capabilityKey === 'shell' || capabilityKey === 'exec' || capabilityKey === 'eval' || capabilityKey === 'cmd') {
      throw new Error('SECURITY VIOLATION: Arbitrary shell command execution is strictly forbidden in N.A.V.I.I.');
    }

    // 2. Permission clearance
    const authorized = await this.requestPermission(capabilityKey, JSON.stringify(params));
    if (!authorized) {
      return {
        success: false,
        denied: true,
        message: `Action "${capabilityKey}" was denied by user permission policy.`,
      };
    }

    // 3. Whitelisted execution handlers
    switch (capabilityKey) {
      case 'get_system_telemetry': {
        const totalMemMb = Math.round(os.totalmem() / (1024 * 1024));
        const freeMemMb = Math.round(os.freemem() / (1024 * 1024));
        return {
          success: true,
          data: {
            platform: process.platform,
            arch: os.arch(),
            cpuCount: os.cpus().length,
            cpuModel: os.cpus()[0]?.model || 'Standard CPU',
            totalMemoryMb: totalMemMb,
            freeMemoryMb: freeMemMb,
            memoryUsagePercent: Math.round(((totalMemMb - freeMemMb) / totalMemMb) * 100),
            systemUptimeHours: (os.uptime() / 3600).toFixed(1),
          },
        };
      }

      case 'read_clipboard': {
        return {
          success: true,
          data: clipboard.readText(),
        };
      }

      case 'write_clipboard': {
        if (typeof params.text === 'string') {
          clipboard.writeText(params.text);
          return { success: true };
        }
        throw new Error('Missing parameter "text" for write_clipboard capability.');
      }

      case 'open_safe_url': {
        if (typeof params.url === 'string' && (params.url.startsWith('https://') || params.url.startsWith('http://'))) {
          shell.openExternal(params.url);
          return { success: true };
        }
        throw new Error('Invalid or non-HTTPS URL specified.');
      }

      default:
        throw new Error(`Capability "${capabilityKey}" has no associated execution handler.`);
    }
  }
}

module.exports = { AutomationGateway, CAPABILITY_PERMISSIONS };
