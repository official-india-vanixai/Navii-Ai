/**
 * UI Interactions, Animations, and Modal Controllers for N.A.V.I.I.
 */

const NaviiUI = {
  init() {
    this.bindWindowControls();
    this.bindSidebarCollapse();
    this.bindModals();
    this.bindTheme();
    this.bindSliders();
    this.bindElectronListeners();
    this.loadPersistedPreferences();
    this.renderHistoryList();
    this.updateActiveModeDisplay();
    this.bindModelDropdown();
    this.fetchLiveModels();
    if (window.NaviiAuth) window.NaviiAuth.init();

    // Subscribe to state changes
    NaviiState.subscribe((event, data) => {
      if (event === 'mode_changed') {
        this.updateActiveModeDisplay();
      } else if (event === 'model_changed') {
        this.updateModelDisplay(data);
      } else if (event === 'conversation_created' || event === 'conversation_deleted' || event === 'conversation_renamed' || event === 'conversation_pinned') {
        this.renderHistoryList();
      } else if (event === 'sidebar_toggled') {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.classList.toggle('collapsed', data);
      } else if (event === 'search_toggled') {
        const pill = document.getElementById('search-toggle');
        if (pill) pill.classList.toggle('active', data);
      }
    });

    // Restore sidebar state
    if (NaviiState.sidebarCollapsed) {
      document.getElementById('sidebar')?.classList.add('collapsed');
    }
  },

  bindWindowControls() {
    const minBtn = document.getElementById('win-min');
    const maxBtn = document.getElementById('win-max');
    const closeBtn = document.getElementById('win-close');

    if (minBtn) {
      minBtn.addEventListener('click', () => {
        NaviiAudio.playClick();
        if (window.naviiAPI && window.naviiAPI.minimize) {
          window.naviiAPI.minimize();
        }
      });
    }

    if (maxBtn) {
      maxBtn.addEventListener('click', () => {
        NaviiAudio.playClick();
        if (window.naviiAPI && window.naviiAPI.maximize) {
          window.naviiAPI.maximize();
        }
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        NaviiAudio.playClick();
        if (window.naviiAPI && window.naviiAPI.close) {
          window.naviiAPI.close();
        }
      });
    }
  },

  bindElectronListeners() {
    if (!window.naviiAPI) return;

    // Window Maximized State Listener (Updates Titlebar Icon)
    if (window.naviiAPI.onMaximizedChange) {
      window.naviiAPI.onMaximizedChange((isMaximized) => {
        const maxBtn = document.getElementById('win-max');
        if (!maxBtn) return;
        if (isMaximized) {
          // Restore Icon (overlapping squares)
          maxBtn.innerHTML = '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor"><rect x="2.5" y="0.5" width="7" height="7"/><rect x="0.5" y="2.5" width="7" height="7"/></svg>';
          maxBtn.title = 'Restore';
        } else {
          // Maximize Icon (single square)
          maxBtn.innerHTML = '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor"><rect x="0.5" y="0.5" width="9" height="9"/></svg>';
          maxBtn.title = 'Maximize';
        }
      });
    }

    // Global Shortcut Listeners from Main Process
    if (window.naviiAPI.onNewSession) {
      window.naviiAPI.onNewSession(() => {
        const newConvo = NaviiState.createConversation('New Session', NaviiState.activeMode);
        NaviiChat.loadConversation(newConvo);
        this.showToast('New session started', 'success');
      });
    }

    if (window.naviiAPI.onOpenSettings) {
      window.naviiAPI.onOpenSettings(() => {
        document.getElementById('settings-modal')?.classList.toggle('active');
      });
    }
  },

  async loadPersistedPreferences() {
    if (window.naviiAPI && window.naviiAPI.getPreferences) {
      try {
        const saved = await window.naviiAPI.getPreferences();
        if (saved && typeof saved === 'object') {
          Object.assign(NaviiState.settings, saved);
          if (saved.theme) NaviiState.setTheme(saved.theme);

          const modelSelect = document.getElementById('setting-model-select');
          const voiceSelect = document.getElementById('setting-voice-select');
          const soundToggle = document.getElementById('setting-sound-toggle');
          const tempSlider = document.getElementById('setting-temp-slider');
          const speedSlider = document.getElementById('setting-speed-slider');

          if (modelSelect && saved.model) modelSelect.value = saved.model;
          if (voiceSelect && saved.voice) voiceSelect.value = saved.voice;
          if (soundToggle && typeof saved.soundEffects === 'boolean') soundToggle.checked = saved.soundEffects;
          if (tempSlider && saved.temperature) {
            tempSlider.value = saved.temperature;
            document.getElementById('temp-val-display').textContent = saved.temperature;
          }
          if (speedSlider && saved.voiceSpeed) {
            speedSlider.value = saved.voiceSpeed;
            document.getElementById('speed-val-display').textContent = `${saved.voiceSpeed}x`;
          }
        }
      } catch (e) {
        console.warn('[N.A.V.I.I UI] Error reading persisted settings:', e);
      }
    }
  },

  bindSidebarCollapse() {
    const collapseBtn = document.getElementById('sidebar-collapse-btn');
    if (collapseBtn) {
      collapseBtn.addEventListener('click', () => {
        NaviiAudio.playClick();
        NaviiState.toggleSidebar();
      });
    }
  },

  bindTheme() {
    const savedTheme = NaviiState.theme;
    document.documentElement.setAttribute('data-theme', savedTheme);

    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    if (themeToggleBtn) {
      themeToggleBtn.addEventListener('click', () => {
        const nextTheme = NaviiState.theme === 'dark' ? 'light' : 'dark';
        NaviiAudio.playSwitch();
        NaviiState.setTheme(nextTheme);
        this.showToast(`Switched to ${nextTheme.toUpperCase()} theme`, 'info');

        // Persist theme
        if (window.naviiAPI && window.naviiAPI.savePreferences) {
          NaviiState.settings.theme = nextTheme;
          window.naviiAPI.savePreferences(NaviiState.settings);
        }
      });
    }

    // Modal theme pills
    document.querySelectorAll('.theme-pill-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        NaviiAudio.playClick();
        const selected = e.currentTarget.getAttribute('data-theme-val');
        document.querySelectorAll('.theme-pill-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        NaviiState.setTheme(selected);

        if (window.naviiAPI && window.naviiAPI.savePreferences) {
          NaviiState.settings.theme = selected;
          window.naviiAPI.savePreferences(NaviiState.settings);
        }
      });
    });
  },

  bindSliders() {
    const tempSlider = document.getElementById('setting-temp-slider');
    const tempVal = document.getElementById('temp-val-display');
    if (tempSlider && tempVal) {
      tempSlider.addEventListener('input', (e) => {
        tempVal.textContent = e.target.value;
        NaviiState.settings.temperature = parseFloat(e.target.value);
      });
    }

    const speedSlider = document.getElementById('setting-speed-slider');
    const speedVal = document.getElementById('speed-val-display');
    if (speedSlider && speedVal) {
      speedSlider.addEventListener('input', (e) => {
        speedVal.textContent = `${e.target.value}x`;
        NaviiState.settings.voiceSpeed = parseFloat(e.target.value);
      });
    }
  },

  bindModelDropdown() {
    const wrapper = document.getElementById('model-selector-wrapper');
    const trigger = document.getElementById('model-dropdown-trigger');
    const settingSelect = document.getElementById('setting-model-select');

    if (!wrapper || !trigger) return;

    // Toggle dropdown
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      NaviiAudio.playClick();
      wrapper.classList.toggle('open');
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!wrapper.contains(e.target)) {
        wrapper.classList.remove('open');
      }
    });

    // Option selection
    const options = wrapper.querySelectorAll('.model-option');
    options.forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        const modelId = opt.getAttribute('data-model');
        if (!modelId) return;

        NaviiAudio.playClick();
        NaviiState.setModel(modelId);
        wrapper.classList.remove('open');

        const optName = opt.querySelector('.model-option-name')?.textContent || modelId;
        this.showToast(`Selected: ${optName}`, 'info');
      });
    });

    // Keep settings modal select in sync
    if (settingSelect) {
      settingSelect.value = NaviiState.settings.model;
      settingSelect.addEventListener('change', (e) => {
        NaviiState.setModel(e.target.value);
      });
    }

    this.updateModelDisplay(NaviiState.settings.model);
  },

  updateModelDisplay(modelId) {
    const triggerLabel = document.getElementById('model-trigger-label');
    const options = document.querySelectorAll('.model-option');
    const settingSelect = document.getElementById('setting-model-select');

    options.forEach(opt => {
      const isSelected = opt.getAttribute('data-model') === modelId;
      opt.classList.toggle('active', isSelected);
      if (isSelected && triggerLabel) {
        const name = opt.querySelector('.model-option-name')?.textContent || modelId;
        triggerLabel.textContent = name;
      }
    });

    if (settingSelect && settingSelect.value !== modelId) {
      settingSelect.value = modelId;
    }
  },

  async fetchLiveModels() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const res = await fetch('http://127.0.0.1:8000/api/v1/models', { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        NaviiState.availableModels = data.models || [];
        NaviiState.dailyQuotaRemaining = data.daily_remaining;
        NaviiState.dailyQuotaTotal = data.daily_quota;

        const quotaBadge = document.getElementById('quota-display-badge');
        if (quotaBadge && data.daily_remaining !== undefined) {
          quotaBadge.textContent = `${data.daily_remaining} / ${data.daily_quota} left`;
        }

        // Update online status indicators
        if (data.models) {
          data.models.forEach(m => {
            const opt = document.querySelector(`.model-option[data-model="${m.id}"]`);
            if (opt && !m.is_online) {
              const tag = opt.querySelector('.model-badge-tag');
              if (tag) {
                tag.textContent = 'OFFLINE';
                tag.style.background = 'rgba(239, 68, 68, 0.2)';
                tag.style.color = '#f87171';
              }
            }
          });
        }
      }
    } catch (err) {
      console.warn('[N.A.V.I.I UI] Could not query live model availability from backend:', err);
    }
  },

  bindModals() {
    // Settings Modal
    const settingsBtn = document.getElementById('btn-open-settings');
    const settingsModal = document.getElementById('settings-modal');
    const closeSettingsBtn = document.getElementById('close-settings-modal');
    const saveSettingsBtn = document.getElementById('save-settings-btn');

    if (settingsBtn && settingsModal) {
      settingsBtn.addEventListener('click', () => {
        NaviiAudio.playClick();
        settingsModal.classList.add('active');
      });
    }

    if (closeSettingsBtn && settingsModal) {
      closeSettingsBtn.addEventListener('click', () => {
        NaviiAudio.playClick();
        settingsModal.classList.remove('active');
      });
    }

    // Settings Tabs
    document.querySelectorAll('.modal-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        NaviiAudio.playClick();
        const targetTab = e.currentTarget.getAttribute('data-tab');
        document.querySelectorAll('.modal-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.modal-tab-content').forEach(c => c.classList.remove('active'));

        e.currentTarget.classList.add('active');
        document.getElementById(`tab-content-${targetTab}`)?.classList.add('active');
      });
    });

    if (saveSettingsBtn && settingsModal) {
      saveSettingsBtn.addEventListener('click', () => {
        NaviiAudio.playNotify();
        const modelSelect = document.getElementById('setting-model-select');
        const voiceSelect = document.getElementById('setting-voice-select');
        const soundToggle = document.getElementById('setting-sound-toggle');

        if (modelSelect) NaviiState.settings.model = modelSelect.value;
        if (voiceSelect) NaviiState.settings.voice = voiceSelect.value;
        if (soundToggle) NaviiState.settings.soundEffects = soundToggle.checked;
        NaviiState.settings.theme = NaviiState.theme;

        // Persist to local disk via Electron IPC
        if (window.naviiAPI && window.naviiAPI.savePreferences) {
          window.naviiAPI.savePreferences(NaviiState.settings);
        }

        settingsModal.classList.remove('active');
        this.showToast('Preferences saved successfully', 'success');
      });
    }

    // User Profile / Auth Modal
    const profileBtn = document.getElementById('btn-user-profile');
    const profileModal = document.getElementById('profile-modal');
    const closeProfileBtn = document.getElementById('close-profile-modal');

    if (profileBtn && profileModal) {
      profileBtn.addEventListener('click', () => {
        NaviiAudio.playClick();
        profileModal.classList.add('active');
      });
    }

    if (closeProfileBtn && profileModal) {
      closeProfileBtn.addEventListener('click', () => {
        NaviiAudio.playClick();
        profileModal.classList.remove('active');
      });
    }

    this.bindAuthModal();

    // Rename Modal
    const renameModal = document.getElementById('rename-modal');
    const closeRenameBtn = document.getElementById('close-rename-modal');
    const confirmRenameBtn = document.getElementById('btn-confirm-rename');

    if (closeRenameBtn && renameModal) {
      closeRenameBtn.addEventListener('click', () => {
        NaviiAudio.playClick();
        renameModal.classList.remove('active');
      });
    }

    if (confirmRenameBtn && renameModal) {
      confirmRenameBtn.addEventListener('click', () => {
        const input = document.getElementById('rename-input');
        const targetId = renameModal.getAttribute('data-target-id');
        if (input && targetId) {
          NaviiState.renameConversation(targetId, input.value);
          renameModal.classList.remove('active');
          NaviiAudio.playNotify();
          this.showToast('Conversation renamed', 'success');
        }
      });
    }

    // Close on backdrop click
    window.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-backdrop')) {
        NaviiAudio.playClick();
        e.target.classList.remove('active');
      }
    });
  },

  bindAuthModal() {
    const googleBtn = document.getElementById('btn-google-signin');
    const tabLogin = document.getElementById('tab-auth-login');
    const tabRegister = document.getElementById('tab-auth-register');
    const submitBtn = document.getElementById('btn-auth-submit');
    const logoutBtn = document.getElementById('btn-auth-logout');
    const nameRow = document.getElementById('auth-register-name-row');
    const emailInput = document.getElementById('auth-email');
    const passwordInput = document.getElementById('auth-password');
    const nameInput = document.getElementById('auth-fullname');
    const errorMsg = document.getElementById('auth-error-msg');
    const profileModal = document.getElementById('profile-modal');

    let isRegisterMode = false;

    // Toggle Tabs
    tabLogin?.addEventListener('click', () => {
      NaviiAudio.playClick();
      isRegisterMode = false;
      tabLogin.classList.add('active');
      tabRegister.classList.remove('active');
      if (nameRow) nameRow.style.display = 'none';
      if (submitBtn) submitBtn.textContent = 'Sign In with Email';
      if (errorMsg) errorMsg.style.display = 'none';
    });

    tabRegister?.addEventListener('click', () => {
      NaviiAudio.playClick();
      isRegisterMode = true;
      tabRegister.classList.add('active');
      tabLogin.classList.remove('active');
      if (nameRow) nameRow.style.display = 'block';
      if (submitBtn) submitBtn.textContent = 'Create Account';
      if (errorMsg) errorMsg.style.display = 'none';
    });

    // Google Sign-In
    googleBtn?.addEventListener('click', async () => {
      NaviiAudio.playClick();
      if (errorMsg) errorMsg.style.display = 'none';
      try {
        await NaviiAuth.loginWithGoogle();
        NaviiAudio.playNotify();
        this.showToast('Successfully authenticated with Google!', 'success');
        profileModal?.classList.remove('active');
      } catch (err) {
        console.error('[N.A.V.I.I Google Auth Error]', err);
        if (errorMsg) {
          errorMsg.textContent = err.message || 'Google Sign-In failed';
          errorMsg.style.display = 'block';
        }
      }
    });

    // Email/Password Submit
    submitBtn?.addEventListener('click', async () => {
      NaviiAudio.playClick();
      if (errorMsg) errorMsg.style.display = 'none';
      const email = emailInput?.value.trim();
      const password = passwordInput?.value.trim();
      const name = nameInput?.value.trim();

      if (!email || !password) {
        if (errorMsg) {
          errorMsg.textContent = 'Please enter both email and password.';
          errorMsg.style.display = 'block';
        }
        return;
      }

      try {
        if (isRegisterMode) {
          await NaviiAuth.registerWithEmail(email, password, name);
          NaviiAudio.playNotify();
          this.showToast('Account created successfully!', 'success');
        } else {
          await NaviiAuth.loginWithEmail(email, password);
          NaviiAudio.playNotify();
          this.showToast('Signed in successfully!', 'success');
        }
        profileModal?.classList.remove('active');
      } catch (err) {
        console.error('[N.A.V.I.I Email Auth Error]', err);
        if (errorMsg) {
          errorMsg.textContent = err.message || 'Authentication failed.';
          errorMsg.style.display = 'block';
        }
      }
    });

    // Logout
    logoutBtn?.addEventListener('click', async () => {
      NaviiAudio.playClick();
      await NaviiAuth.logout();
      this.showToast('Signed out of N.A.V.I.I', 'info');
      profileModal?.classList.remove('active');
    });
  },

  renderHistoryList() {
    const listContainer = document.getElementById('history-list');
    if (!listContainer) return;

    listContainer.innerHTML = '';
    NaviiState.conversations.forEach(convo => {
      const li = document.createElement('li');
      li.className = `history-item ${convo.id === NaviiState.activeConversationId ? 'active' : ''} ${convo.pinned ? 'pinned' : ''}`;
      li.setAttribute('data-id', convo.id);

      li.innerHTML = `
        <span class="history-title" title="${convo.title}">${convo.title}</span>
        <div class="history-actions">
          <button class="history-btn" title="Pin / Unpin" data-action="pin">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10V8l-6-6H5a2 2 0 0 0-2 2v16h2l6-6h8a2 2 0 0 0 2-2v-2"></path></svg>
          </button>
          <button class="history-btn" title="Rename" data-action="rename">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
          </button>
          <button class="history-btn delete-btn" title="Delete" data-action="delete">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      `;

      li.addEventListener('click', (e) => {
        // Pin Action
        if (e.target.closest('[data-action="pin"]')) {
          e.stopPropagation();
          NaviiAudio.playClick();
          NaviiState.togglePinConversation(convo.id);
          this.showToast(convo.pinned ? 'Conversation pinned' : 'Conversation unpinned', 'info');
          return;
        }

        // Rename Action
        if (e.target.closest('[data-action="rename"]')) {
          e.stopPropagation();
          NaviiAudio.playClick();
          const renameModal = document.getElementById('rename-modal');
          const input = document.getElementById('rename-input');
          if (renameModal && input) {
            renameModal.setAttribute('data-target-id', convo.id);
            input.value = convo.title;
            renameModal.classList.add('active');
            input.focus();
          }
          return;
        }

        // Delete Action
        if (e.target.closest('[data-action="delete"]')) {
          e.stopPropagation();
          NaviiAudio.playClick();
          NaviiState.deleteConversation(convo.id);
          this.showToast('Conversation deleted', 'info');
          return;
        }

        NaviiAudio.playClick();
        NaviiState.activeConversationId = convo.id;
        this.renderHistoryList();
        NaviiState.setActiveMode(convo.mode || 'chat');
        NaviiChat.loadConversation(convo);
      });

      listContainer.appendChild(li);
    });
  },

  updateActiveModeDisplay() {
    const mode = NaviiState.activeMode;
    const modeMap = {
      chat: { title: 'AI Chat Intelligence', icon: '💬' },
      voice: { title: 'Voice Assistant & Dictation', icon: '🎙️' },
      writing: { title: 'AI Writing & Synthesis Studio', icon: '✍️' },
      coding: { title: 'Code Intelligence & Debugging', icon: '💻' },
      files: { title: 'Document & File Assistant', icon: '📁' },
      search: { title: 'Live Neural Web Search', icon: '🌐' },
    };

    const target = modeMap[mode] || modeMap.chat;
    const headerTitle = document.getElementById('current-mode-heading');
    if (headerTitle) {
      headerTitle.innerHTML = `<span>${target.icon}</span> ${target.title}`;
    }

    // Update active nav item
    document.querySelectorAll('.nav-item').forEach(item => {
      const itemMode = item.getAttribute('data-mode');
      item.classList.toggle('active', itemMode === mode);
    });

    // Toggle Workspace Views
    document.querySelectorAll('.workspace-view').forEach(view => {
      view.classList.remove('active');
    });

    const targetView = document.getElementById(`workspace-${mode}`);
    if (targetView) {
      targetView.classList.add('active');
    } else {
      document.getElementById('workspace-chat')?.classList.add('active');
    }
  },

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';

    let icon = '⚡';
    if (type === 'success') icon = '✓';
    if (type === 'error') icon = '✕';

    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => toast.remove(), 250);
    }, 2800);
  }
};

window.NaviiUI = NaviiUI;
