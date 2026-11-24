/**
 * Window State Manager for N.A.V.I.I.
 * Persists and restores window size, position, and maximized state across sessions.
 */

const { screen, app } = require('electron');
const path = require('path');
const fs = require('fs');

class WindowStateManager {
  constructor(options = {}) {
    this.stateFile = path.join(app.getPath('userData'), 'navii-window-state.json');
    this.defaultWidth = options.defaultWidth || 1280;
    this.defaultHeight = options.defaultHeight || 840;
    this.state = this.loadState();
  }

  loadState() {
    try {
      if (fs.existsSync(this.stateFile)) {
        const raw = fs.readFileSync(this.stateFile, 'utf8');
        const data = JSON.parse(raw);
        if (this.isValidBounds(data)) {
          return data;
        }
      }
    } catch (e) {
      console.warn('[N.A.V.I.I State] Could not load previous window state, using defaults.');
    }

    return {
      width: this.defaultWidth,
      height: this.defaultHeight,
      isMaximized: false,
    };
  }

  isValidBounds(data) {
    if (!data || typeof data.width !== 'number' || typeof data.height !== 'number') {
      return false;
    }

    // Check if the coordinates are visible on any current display
    if (typeof data.x === 'number' && typeof data.y === 'number') {
      const displays = screen.getAllDisplays();
      return displays.some(display => {
        const { x, y, width, height } = display.bounds;
        return (
          data.x >= x - 50 &&
          data.x < x + width &&
          data.y >= y - 50 &&
          data.y < y + height
        );
      });
    }

    return true;
  }

  saveState(window) {
    if (!window || window.isDestroyed()) return;

    try {
      const isMaximized = window.isMaximized();
      if (!isMaximized) {
        const bounds = window.getBounds();
        this.state = {
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
          isMaximized: false,
        };
      } else {
        this.state.isMaximized = true;
      }

      fs.writeFileSync(this.stateFile, JSON.stringify(this.state, null, 2), 'utf8');
    } catch (e) {
      console.error('[N.A.V.I.I State] Error saving window state:', e);
    }
  }

  track(window) {
    let updateTimeout = null;
    const debouncedSave = () => {
      clearTimeout(updateTimeout);
      updateTimeout = setTimeout(() => this.saveState(window), 200);
    };

    window.on('resize', debouncedSave);
    window.on('move', debouncedSave);
    window.on('close', () => this.saveState(window));
  }
}

module.exports = { WindowStateManager };
