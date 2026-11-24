/**
 * Main Application Orchestrator for N.A.V.I.I Desktop.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Submodules
  NaviiAudio.init();
  NaviiUI.init();
  NaviiWorkspaces.init();
  NaviiChat.init();

  // Assistant Mode Navigation Hook
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const mode = item.getAttribute('data-mode');
      if (mode) {
        NaviiAudio.playSwitch();
        NaviiState.setActiveMode(mode);
        NaviiUI.showToast(`Switched to ${mode.toUpperCase()} Assistant`, 'info');
      }
    });
  });

  // Global Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    // Ctrl+N / Cmd+N -> New Conversation
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
      e.preventDefault();
      NaviiAudio.playSwitch();
      const newConvo = NaviiState.createConversation('New Session', NaviiState.activeMode);
      NaviiChat.loadConversation(newConvo);
      NaviiUI.showToast('New session started', 'success');
    }

    // Ctrl+, / Cmd+, -> Open Settings
    if ((e.ctrlKey || e.metaKey) && e.key === ',') {
      e.preventDefault();
      NaviiAudio.playClick();
      const settingsModal = document.getElementById('settings-modal');
      if (settingsModal) settingsModal.classList.toggle('active');
    }

    // Ctrl+B -> Toggle Sidebar
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      NaviiAudio.playClick();
      NaviiState.toggleSidebar();
    }

    // Escape -> Close Modals
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-backdrop.active').forEach(modal => {
        NaviiAudio.playClick();
        modal.classList.remove('active');
      });
    }
  });

  // Check if running inside Electron or Browser
  if (window.naviiAPI) {
    window.naviiAPI.getAppInfo().then(info => {
      console.log(`[N.A.V.I.I] Running in Electron runtime v${info.version} on ${info.platform}`);
    }).catch(() => {});
  } else {
    console.log('[N.A.V.I.I] Running in standard Web Browser environment.');
  }
});
