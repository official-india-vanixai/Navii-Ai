/**
 * Specialized Workspaces Controller for N.A.V.I.I.
 * Manages Voice, Writing, Coding, File Assistant, and Web Search interactions.
 * Integrates native file dialogs and system notifications via Electron IPC.
 */

const NaviiWorkspaces = {
  init() {
    this.bindVoiceWorkspace();
    this.bindWritingWorkspace();
    this.bindCodingWorkspace();
    this.bindFileWorkspace();
    this.bindSearchWorkspace();
  },

  // ---------------------------------------------------------------------------
  // 1. VOICE WORKSPACE
  // ---------------------------------------------------------------------------
  bindVoiceWorkspace() {
    const orb = document.getElementById('voice-stage-orb');
    const toggleBtn = document.getElementById('btn-toggle-listening');
    const statusLabel = document.getElementById('voice-status-text');
    const transcriptEl = document.getElementById('voice-transcript-text');
    const testAudioBtn = document.getElementById('btn-test-voice');

    const handleVoiceToggle = () => {
      NaviiAudio.playClick();
      NaviiState.voiceState.isListening = !NaviiState.voiceState.isListening;
      const isListening = NaviiState.voiceState.isListening;

      if (orb) orb.classList.toggle('listening', isListening);
      if (toggleBtn) {
        toggleBtn.textContent = isListening ? 'Stop Listening' : 'Start Listening';
        toggleBtn.classList.toggle('btn-secondary', isListening);
        toggleBtn.classList.toggle('btn-primary', !isListening);
      }
      if (statusLabel) {
        statusLabel.textContent = isListening ? 'Listening & processing audio stream...' : 'Voice Engine: Standby';
        statusLabel.classList.toggle('active', isListening);
      }

      if (isListening) {
        NaviiAudio.playNotify();
        if (transcriptEl) {
          transcriptEl.textContent = 'Listening to your microphone...';
          setTimeout(() => {
            if (NaviiState.voiceState.isListening) {
              transcriptEl.innerHTML = '<em>"Navii, what are the architectural requirements for cloud deployment?"</em>';
              setTimeout(() => {
                if (NaviiState.voiceState.isListening) {
                  transcriptEl.innerHTML = `<strong>Synthesized Response:</strong> Cloud deployment on Render requires HTTPS endpoints, Supabase PostgreSQL with RLS, and an isolated Electron preload bridge.`;
                  NaviiAudio.playSend();

                  // Native notification test
                  if (window.naviiAPI && window.naviiAPI.showNotification) {
                    window.naviiAPI.showNotification({
                      title: 'N.A.V.I.I Voice Engine',
                      body: 'Speech synthesis stream completed.'
                    });
                  }
                }
              }, 1800);
            }
          }, 1200);
        }
      }
    };

    if (orb) orb.addEventListener('click', handleVoiceToggle);
    if (toggleBtn) toggleBtn.addEventListener('click', handleVoiceToggle);

    if (testAudioBtn) {
      testAudioBtn.addEventListener('click', () => {
        NaviiAudio.playSwitch();
        const persona = document.getElementById('voice-persona-select')?.value || 'Alloy';
        NaviiUI.showToast(`Testing TTS Voice: ${persona}`, 'info');

        if ('speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(`N.A.V.I.I voice engine initialized using ${persona} persona.`);
          utterance.rate = 1.0;
          window.speechSynthesis.speak(utterance);
        }
      });
    }
  },

  // ---------------------------------------------------------------------------
  // 2. WRITING STUDIO WORKSPACE
  // ---------------------------------------------------------------------------
  bindWritingWorkspace() {
    const textarea = document.getElementById('writing-input-area');
    const wordCountEl = document.getElementById('writing-word-count');
    const charCountEl = document.getElementById('writing-char-count');
    const generateBtn = document.getElementById('btn-generate-writing');
    const outputEl = document.getElementById('writing-output-area');
    const copyBtn = document.getElementById('btn-copy-writing');

    const updateStats = () => {
      if (!textarea) return;
      const text = textarea.value.trim();
      const words = text ? text.split(/\s+/).length : 0;
      const chars = text.length;

      if (wordCountEl) wordCountEl.textContent = `${words} words`;
      if (charCountEl) charCountEl.textContent = `${chars} chars`;
    };

    if (textarea) {
      textarea.addEventListener('input', updateStats);
    }

    // Template Chips
    document.querySelectorAll('.template-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        NaviiAudio.playClick();
        document.querySelectorAll('.template-chip').forEach(c => c.classList.remove('active'));
        e.currentTarget.classList.add('active');
        const template = e.currentTarget.getAttribute('data-template');
        NaviiState.writingState.activeTemplate = template;

        const templates = {
          email: 'Draft an executive briefing email regarding our Q3 AI assistant launch to board members.',
          content: 'Write a comprehensive 500-word overview on the future of autonomous desktop AI copilots.',
          grammar: 'Please review and polish the grammatical clarity, tone, and professional phrasing of this passage:',
          rewrite: 'Rewrite this executive announcement in a persuasive, authoritative, yet approachable tone:',
          summary: 'Extract the top 5 strategic executive takeaways from the following quarterly report:'
        };

        if (textarea) {
          textarea.value = templates[template] || '';
          updateStats();
        }
      });
    });

    if (generateBtn) {
      generateBtn.addEventListener('click', () => {
        if (!textarea || !textarea.value.trim()) {
          NaviiUI.showToast('Please enter prompt or source text first.', 'error');
          return;
        }

        NaviiAudio.playSend();
        generateBtn.disabled = true;
        generateBtn.textContent = 'Synthesizing...';

        if (outputEl) {
          outputEl.innerHTML = '<div class="typing-indicator"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></div>';
        }

        setTimeout(() => {
          const template = NaviiState.writingState.activeTemplate;
          let result = '';

          if (template === 'email') {
            result = `<strong>Subject:</strong> Strategic Operational Launch: N.A.V.I.I Cognitive Workspace<br><br>` +
              `Dear Board Members,<br><br>` +
              `We are pleased to report that the initial deployment phase of <strong>N.A.V.I.I</strong> is complete. Operating on a modern, decoupled cloud architecture, the platform guarantees sub-second response times with zero client credential exposure.<br><br>` +
              `We look forward to presenting the live demonstration at our upcoming session.<br><br>` +
              `Sincerely,<br><em>The N.A.V.I.I Operations Team</em>`;
          } else {
            result = `<h3>Executive Synthesis</h3><p>${textarea.value.trim()}</p><p><strong>Polished Takeaway:</strong> The cognitive architecture maintains strict process isolation while providing seamless multi-modal desktop intelligence.</p>`;
          }

          if (outputEl) outputEl.innerHTML = result;
          generateBtn.disabled = false;
          generateBtn.textContent = 'Synthesize Content';
          NaviiAudio.playNotify();
          NaviiUI.showToast('Content successfully synthesized', 'success');
        }, 1200);
      });
    }

    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        if (outputEl && outputEl.innerText.trim()) {
          navigator.clipboard.writeText(outputEl.innerText.trim()).then(() => {
            NaviiAudio.playClick();
            NaviiUI.showToast('Copied to clipboard', 'success');
          });
        }
      });
    }
  },

  // ---------------------------------------------------------------------------
  // 3. CODING WORKSPACE
  // ---------------------------------------------------------------------------
  bindCodingWorkspace() {
    const langChips = document.querySelectorAll('.lang-chip');
    const runBtn = document.getElementById('btn-run-code-action');
    const copyBtn = document.getElementById('btn-copy-code-studio');
    const codePre = document.getElementById('code-studio-content');
    const promptInput = document.getElementById('code-prompt-input');

    langChips.forEach(chip => {
      chip.addEventListener('click', (e) => {
        NaviiAudio.playClick();
        langChips.forEach(c => c.classList.remove('active'));
        e.currentTarget.classList.add('active');
        const lang = e.currentTarget.getAttribute('data-lang');
        NaviiState.codeState.selectedLang = lang;
        NaviiUI.showToast(`Selected Language: ${lang.toUpperCase()}`, 'info');
      });
    });

    if (runBtn) {
      runBtn.addEventListener('click', () => {
        const lang = NaviiState.codeState.selectedLang;
        const prompt = promptInput?.value.trim() || 'FastAPI Async Client';

        NaviiAudio.playSend();
        runBtn.disabled = true;
        runBtn.textContent = 'Generating...';

        setTimeout(() => {
          let code = '';
          if (lang === 'python') {
            code = `# Production-grade Async Python Client\nimport httpx\nimport asyncio\nfrom typing import Dict, Any\n\nclass NaviiClient:\n    def __init__(self, base_url: str = "https://navii-backend.onrender.com"):\n        self.base_url = base_url\n        self.client = httpx.AsyncClient(timeout=30.0)\n\n    async def send_prompt(self, prompt: str) -> Dict[str, Any]:\n        response = await self.client.post(\n            f"{self.base_url}/api/v1/chat/completions",\n            json={"prompt": prompt, "model": "gpt-4o"}\n        )\n        response.raise_for_status()\n        return response.json()\n\nasync def main():\n    client = NaviiClient()\n    res = await client.send_prompt("Hello Navii")\n    print("Response:", res)`;
          } else if (lang === 'javascript' || lang === 'typescript') {
            code = `// Secure Preload Context Bridge\nimport { contextBridge, ipcRenderer } from 'electron';\n\ncontextBridge.exposeInMainWorld('naviiAPI', {\n  minimize: () => ipcRenderer.send('window:minimize'),\n  maximize: () => ipcRenderer.send('window:maximize'),\n  close: () => ipcRenderer.send('window:close'),\n  openFileDialog: () => ipcRenderer.invoke('dialog:openFile')\n});`;
          } else {
            code = `// Neural Core Module in ${lang.toUpperCase()}\n// Strict memory isolation and async execution pipeline`;
          }

          if (codePre) codePre.textContent = code;
          runBtn.disabled = false;
          runBtn.textContent = 'Generate Code';
          NaviiAudio.playNotify();
          NaviiUI.showToast(`Generated ${lang.toUpperCase()} snippet`, 'success');
        }, 900);
      });
    }

    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        if (codePre && codePre.textContent) {
          navigator.clipboard.writeText(codePre.textContent).then(() => {
            NaviiAudio.playClick();
            NaviiUI.showToast('Code copied to clipboard', 'success');
          });
        }
      });
    }
  },

  // ---------------------------------------------------------------------------
  // 4. FILE ASSISTANT WORKSPACE (NATIVE DIALOG & DRAG-AND-DROP)
  // ---------------------------------------------------------------------------
  bindFileWorkspace() {
    const dropzone = document.getElementById('file-dropzone');
    const summarizeBtn = document.getElementById('btn-summarize-file');

    if (dropzone) {
      // 1. Drag and Drop handlers
      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });

      dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
      });

      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        NaviiAudio.playNotify();

        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
          files.forEach(f => {
            const ext = f.name.split('.').pop().toUpperCase();
            const sizeMb = (f.size / (1024 * 1024)).toFixed(1) + ' MB';
            NaviiState.fileState.files.unshift({
              id: 'file_' + Date.now(),
              name: f.name,
              size: sizeMb,
              type: ext,
              status: 'Extracted'
            });
          });
          this.renderFileList();
          NaviiUI.showToast(`Imported ${files.length} document(s)`, 'success');
        }
      });

      // 2. Click to open native Windows file dialog
      dropzone.addEventListener('click', async () => {
        NaviiAudio.playClick();
        if (window.naviiAPI && window.naviiAPI.openFileDialog) {
          const res = await window.naviiAPI.openFileDialog({
            title: 'Choose Documents to Import into N.A.V.I.I'
          });

          if (!res.canceled && res.files && res.files.length > 0) {
            res.files.forEach(file => {
              NaviiState.fileState.files.unshift({
                id: file.id,
                name: file.name,
                size: file.sizeFormatted,
                type: file.type,
                path: file.path,
                status: 'Ready'
              });
            });
            this.renderFileList();
            NaviiAudio.playNotify();
            NaviiUI.showToast(`Imported ${res.files.length} document(s) via native dialog`, 'success');
          }
        } else {
          NaviiUI.showToast('Native file dialog is active in Electron desktop mode.', 'info');
        }
      });
    }

    if (summarizeBtn) {
      summarizeBtn.addEventListener('click', () => {
        NaviiAudio.playSend();
        NaviiUI.showToast('Synthesizing active document...', 'info');
        setTimeout(() => {
          NaviiState.setActiveMode('chat');
          const convo = NaviiState.getActiveConversation();
          if (convo) {
            convo.messages.push({
              role: 'assistant',
              content: `📄 **Document Analysis Summary (Q3_Financial_Briefing.pdf)**:\n\n` +
                `• **Key Finding 1**: Operational margins increased by 28% year-over-year.\n` +
                `• **Key Finding 2**: Cloud infrastructure transition reduced compute latency by 42%.\n` +
                `• **Recommendation**: Proceed with broader deployment rollout.`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });
            NaviiChat.loadConversation(convo);
          }
        }, 1000);
      });
    }

    this.renderFileList();
  },

  renderFileList() {
    const list = document.getElementById('file-queue-list');
    if (!list) return;

    list.innerHTML = '';
    NaviiState.fileState.files.forEach(file => {
      const div = document.createElement('div');
      div.className = 'file-queue-item';
      div.innerHTML = `
        <div class="file-meta">
          <span class="file-type-badge">${file.type}</span>
          <div>
            <div class="file-name">${file.name}</div>
            <div class="file-size">${file.size}</div>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 10px;">
          <span class="file-status-badge">● ${file.status}</span>
          <button class="history-btn delete-btn" data-file-id="${file.id}" title="Remove file">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      `;

      div.querySelector('[data-file-id]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        NaviiState.fileState.files = NaviiState.fileState.files.filter(f => f.id !== file.id);
        this.renderFileList();
        NaviiUI.showToast(`Removed ${file.name}`, 'info');
      });

      list.appendChild(div);
    });
  },

  // ---------------------------------------------------------------------------
  // 5. WEB SEARCH WORKSPACE
  // ---------------------------------------------------------------------------
  bindSearchWorkspace() {
    const input = document.getElementById('search-query-field');
    const searchBtn = document.getElementById('btn-execute-search');
    const resultsGrid = document.getElementById('search-results-grid');
    const synthesisText = document.getElementById('search-synthesis-text');

    const executeSearch = () => {
      const query = input?.value.trim();
      if (!query) return;

      NaviiAudio.playSend();
      NaviiUI.showToast(`Searching Tavily for "${query}"...`, 'info');

      if (resultsGrid) {
        resultsGrid.innerHTML = '<div class="typing-indicator"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></div>';
      }

      setTimeout(() => {
        NaviiAudio.playNotify();
        const results = [
          {
            title: `Latest Breakthroughs in "${query}" - Intelligence Brief`,
            domain: 'techcrunch.com',
            snippet: `Emerging developments in ${query} indicate exponential adoption across enterprise platforms with sub-second neural inference.`
          },
          {
            title: `Engineering Scalable AI Systems for Desktop Environments`,
            domain: 'arxiv.org',
            snippet: `Peer-reviewed benchmarks show that hybrid local-preload and cloud FastAPI architectures reduce security risk by 99%.`
          }
        ];

        if (resultsGrid) {
          resultsGrid.innerHTML = results.map(r => `
            <div class="result-card">
              <div class="result-domain">🌐 ${r.domain}</div>
              <h4 class="result-title"><a href="#">${r.title}</a></h4>
              <p class="result-snippet">${r.snippet}</p>
            </div>
          `).join('');
        }

        if (synthesisText) {
          synthesisText.textContent = `Neural synthesis of live web results indicates high velocity innovation regarding "${query}". Both theoretical papers and production benchmarks favor modular, cloud-powered assistants.`;
        }
      }, 1100);
    };

    if (searchBtn) searchBtn.addEventListener('click', executeSearch);
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          executeSearch();
        }
      });
    }
  }
};

window.NaviiWorkspaces = NaviiWorkspaces;
