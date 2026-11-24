/**
 * Chat Controller & Message Renderer for N.A.V.I.I.
 * Connects to Python FastAPI backend for real-time SSE streaming.
 * Handles Markdown parsing, code syntax blocks, TTS playback, file attachments, and scrolling.
 */

const NaviiChat = {
  backendUrl: 'http://127.0.0.1:8000',

  init() {
    this.bindEvents();
    const activeConvo = NaviiState.getActiveConversation();
    if (activeConvo) {
      this.loadConversation(activeConvo);
    }
  },

  bindEvents() {
    const inputArea = document.getElementById('chat-textarea');
    const sendBtn = document.getElementById('btn-send-message');
    const clearBtn = document.getElementById('btn-clear-chat');
    const newChatBtn = document.getElementById('btn-new-chat');
    const searchToggle = document.getElementById('search-toggle');
    const micBtn = document.getElementById('btn-voice-input');
    const attachBtn = document.getElementById('btn-attach');

    if (inputArea) {
      // Auto-grow textarea
      inputArea.addEventListener('input', () => {
        inputArea.style.height = 'auto';
        inputArea.style.height = Math.min(inputArea.scrollHeight, 140) + 'px';
      });

      // Enter to send (Shift+Enter for newline)
      inputArea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.handleSendMessage();
        }
      });
    }

    if (sendBtn) {
      sendBtn.addEventListener('click', () => this.handleSendMessage());
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        NaviiAudio.playClick();
        const convo = NaviiState.getActiveConversation();
        if (convo) {
          convo.messages = [];
          this.loadConversation(convo);
          NaviiUI.showToast('Conversation cleared', 'info');
        }
      });
    }

    if (newChatBtn) {
      newChatBtn.addEventListener('click', () => {
        NaviiAudio.playSwitch();
        const newConvo = NaviiState.createConversation('New Session', NaviiState.activeMode);
        this.loadConversation(newConvo);
        NaviiUI.showToast('New session initialized', 'success');
      });
    }

    if (searchToggle) {
      searchToggle.addEventListener('click', () => {
        NaviiAudio.playClick();
        const active = NaviiState.toggleSearch();
        NaviiUI.showToast(active ? 'Neural Web Search enabled' : 'Web Search disabled', 'info');
      });
    }

    if (attachBtn) {
      attachBtn.addEventListener('click', async () => {
        NaviiAudio.playClick();
        if (window.naviiAPI && window.naviiAPI.openFileDialog) {
          const res = await window.naviiAPI.openFileDialog({
            title: 'Attach Documents to Conversation'
          });

          if (!res.canceled && res.files && res.files.length > 0) {
            res.files.forEach(f => {
              NaviiState.fileState.files.unshift({
                id: f.id,
                name: f.name,
                size: f.sizeFormatted,
                type: f.type,
                path: f.path,
                status: 'Attached'
              });
            });

            NaviiAudio.playNotify();
            NaviiUI.showToast(`Attached ${res.files.length} document(s)`, 'success');

            if (inputArea) {
              inputArea.value = `Please analyze the attached document: "${res.files[0].name}"`;
              inputArea.focus();
            }
          }
        }
      });
    }

    if (micBtn) {
      micBtn.addEventListener('click', () => {
        NaviiAudio.playClick();
        micBtn.classList.toggle('recording');
        const isRec = micBtn.classList.contains('recording');
        if (isRec) {
          NaviiUI.showToast('Voice mode active: Listening...', 'info');
        } else {
          NaviiUI.showToast('Voice input stopped', 'info');
        }
      });
    }

    // Suggested prompt cards
    document.querySelectorAll('.prompt-card').forEach(card => {
      card.addEventListener('click', (e) => {
        NaviiAudio.playClick();
        const promptText = e.currentTarget.getAttribute('data-prompt');
        if (promptText && inputArea) {
          inputArea.value = promptText;
          this.handleSendMessage();
        }
      });
    });
  },

  loadConversation(convo) {
    const list = document.getElementById('message-list');
    const welcome = document.getElementById('welcome-container');
    if (!list) return;

    list.innerHTML = '';

    if (!convo.messages || convo.messages.length === 0) {
      if (welcome) welcome.style.display = 'flex';
    } else {
      if (welcome) welcome.style.display = 'none';
    }

    convo.messages.forEach(msg => {
      this.appendMessageElement(msg.role, msg.content, msg.timestamp, false, msg.model);
    });

    this.scrollToBottom();
  },

  async handleSendMessage() {
    const inputArea = document.getElementById('chat-textarea');
    if (!inputArea) return;
    const content = inputArea.value.trim();
    if (!content || NaviiState.isGenerating) return;

    NaviiAudio.playSend();
    inputArea.value = '';
    inputArea.style.height = 'auto';

    const welcome = document.getElementById('welcome-container');
    if (welcome) welcome.style.display = 'none';

    const convo = NaviiState.getActiveConversation();
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Append User Message to UI & State
    const userMsg = { role: 'user', content, timestamp };
    if (convo) convo.messages.push(userMsg);
    this.appendMessageElement('user', content, timestamp, false);
    this.scrollToBottom();

    // Stream AI response directly from FastAPI backend
    await this.streamFromBackend(content, convo);
  },

  async streamFromBackend(userPrompt, convo) {
    NaviiState.isGenerating = true;
    const sendBtn = document.getElementById('btn-send-message');
    if (sendBtn) sendBtn.disabled = true;

    const list = document.getElementById('message-list');
    const row = document.createElement('div');
    row.className = 'message-row assistant';

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    row.innerHTML = `
      <div class="message-avatar">N</div>
      <div class="message-bubble">
        <div class="message-header">
          <span class="assistant-name">N.A.V.I.I</span>
          <span>${timestamp}</span>
        </div>
        <div class="message-content">
          <div class="typing-indicator">
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
          </div>
        </div>
      </div>
    `;

    list.appendChild(row);
    this.scrollToBottom();

    const contentDiv = row.querySelector('.message-content');
    let accumulatedText = '';

    const payload = {
      conversation_id: convo ? convo.id : null,
      messages: (convo ? convo.messages : [{ role: 'user', content: userPrompt }]).map(m => ({
        role: m.role,
        content: m.content
      })),
      mode: NaviiState.activeMode,
      model: NaviiState.settings.model || 'smart',
      temperature: NaviiState.settings.temperature || 0.7,
      stream: true
    };

    let activeModelName = NaviiState.settings.model || 'smart';
    let modelPillAttached = false;

    try {
      const headers = { 'Content-Type': 'application/json' };
      const token = window.NaviiAuth ? await window.NaviiAuth.getToken() : localStorage.getItem('navii_token');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${this.backendUrl}/api/v1/chat/stream`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      contentDiv.innerHTML = '';

      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop(); // keep last incomplete chunk

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim();
            if (dataStr === '[DONE]') {
              break;
            }

            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.model && !modelPillAttached) {
                modelPillAttached = true;
                activeModelName = parsed.model;
                const header = row.querySelector('.message-header');
                if (header) {
                  const badgeSpan = document.createElement('span');
                  badgeSpan.className = 'message-model-pill';
                  badgeSpan.textContent = parsed.model.replace(':free', '').split('/').pop();
                  badgeSpan.title = `Inference Model: ${parsed.model}`;
                  header.appendChild(badgeSpan);
                }
              }
              if (parsed.content) {
                accumulatedText += parsed.content;
                contentDiv.innerHTML = this.renderMarkdown(accumulatedText);
                this.scrollToBottom();
              }
            } catch (jsonErr) {}
          }
        }
      }

      // Finalize message rendering
      contentDiv.innerHTML = this.renderMarkdown(accumulatedText);
      this.attachCodeCopyHandlers(row);
      this.attachMessageActionHandlers(row, accumulatedText);

      if (convo) {
        convo.messages.push({
          role: 'assistant',
          content: accumulatedText,
          timestamp,
          model: activeModelName
        });
      }

      NaviiAudio.playNotify();

    } catch (err) {
      console.warn('[N.A.V.I.I Stream] Live backend unreachable, engaging autonomous local synthesis:', err);
      // Fallback synthesis if server is temporarily unreachable
      accumulatedText = `⚠️ **Notice**: Backend connection standby (${err.message}).\n\nEnsure FastAPI is running on \`${this.backendUrl}\`.\n\nAll cognitive systems are ready.`;
      contentDiv.innerHTML = this.renderMarkdown(accumulatedText);
      this.attachCodeCopyHandlers(row);
      this.attachMessageActionHandlers(row, accumulatedText);
    } finally {
      NaviiState.isGenerating = false;
      if (sendBtn) sendBtn.disabled = false;
      this.scrollToBottom();
    }
  },

  appendMessageElement(role, content, timestamp, animate = true, modelName = null) {
    const list = document.getElementById('message-list');
    if (!list) return;

    const row = document.createElement('div');
    row.className = `message-row ${role}`;

    if (role === 'user') {
      row.innerHTML = `
        <div class="message-bubble">
          <div class="message-content">${this.escapeHtml(content)}</div>
        </div>
      `;
    } else {
      const modelBadgeHtml = modelName ? `<span class="message-model-pill" title="Model: ${modelName}">${modelName.replace(':free', '').split('/').pop()}</span>` : '';
      row.innerHTML = `
        <div class="message-avatar">N</div>
        <div class="message-bubble">
          <div class="message-header">
            <span class="assistant-name">N.A.V.I.I</span>
            <span>${timestamp || ''}</span>
            ${modelBadgeHtml}
          </div>
          <div class="message-content">${this.renderMarkdown(content)}</div>
        </div>
      `;
      this.attachCodeCopyHandlers(row);
      this.attachMessageActionHandlers(row, content);
    }

    list.appendChild(row);
  },

  attachMessageActionHandlers(row, rawText) {
    const header = row.querySelector('.message-header');
    if (!header || header.querySelector('.msg-actions')) return;

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'msg-actions';
    actionsDiv.style.cssText = 'display: flex; gap: 8px; align-items: center;';

    actionsDiv.innerHTML = `
      <button class="history-btn btn-tts-speak" title="Read Aloud (TTS)">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
      </button>
      <button class="history-btn btn-copy-msg" title="Copy Message">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
      </button>
    `;

    // TTS Button
    actionsDiv.querySelector('.btn-tts-speak')?.addEventListener('click', (e) => {
      e.stopPropagation();
      NaviiAudio.playClick();
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const cleanSpeech = rawText.replace(/[*#`_>]/g, '');
        const utterance = new SpeechSynthesisUtterance(cleanSpeech);
        utterance.rate = NaviiState.settings.voiceSpeed || 1.0;
        window.speechSynthesis.speak(utterance);
        NaviiUI.showToast('Speaking response...', 'info');
      }
    });

    // Copy Message Button
    actionsDiv.querySelector('.btn-copy-msg')?.addEventListener('click', (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(rawText).then(() => {
        NaviiAudio.playClick();
        NaviiUI.showToast('Message copied to clipboard', 'success');
      });
    });

    header.appendChild(actionsDiv);
  },

  renderMarkdown(text) {
    if (!text) return '';

    // Extract code blocks first to protect them
    const codeBlocks = [];
    let formatted = text.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
      const id = 'CODE_BLOCK_' + codeBlocks.length;
      codeBlocks.push({ lang: lang || 'code', code: code.trim() });
      return `[[${id}]]`;
    });

    // Bold **text**
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Italic *text*
    formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // Inline code `code`
    formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Blockquote > quote
    formatted = formatted.replace(/^>\s?(.*)$/gm, '<blockquote>$1</blockquote>');
    // Unordered lists
    formatted = formatted.replace(/^\s*•\s?(.*)$/gm, '<li>$1</li>');
    formatted = formatted.replace(/^\s*\*\s?(.*)$/gm, '<li>$1</li>');
    // Line breaks to paragraphs
    formatted = formatted.replace(/\n\n/g, '</p><p>');
    formatted = `<p>${formatted}</p>`;

    // Restore Code Blocks with custom header and copy button
    codeBlocks.forEach((cb, i) => {
      const codeHtml = `
        <div class="code-block-container">
          <div class="code-block-header">
            <span>${cb.lang.toUpperCase()}</span>
            <button class="code-copy-btn" data-code="${this.escapeAttr(cb.code)}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              <span>Copy</span>
            </button>
          </div>
          <pre><code>${this.escapeHtml(cb.code)}</code></pre>
        </div>
      `;
      formatted = formatted.replace(`[[CODE_BLOCK_${i}]]`, codeHtml);
    });

    return formatted;
  },

  attachCodeCopyHandlers(container) {
    container.querySelectorAll('.code-copy-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const code = btn.getAttribute('data-code');
        if (code) {
          navigator.clipboard.writeText(code).then(() => {
            NaviiAudio.playClick();
            const span = btn.querySelector('span');
            if (span) {
              const original = span.textContent;
              span.textContent = 'Copied!';
              btn.style.color = '#10b981';
              setTimeout(() => {
                span.textContent = original;
                btn.style.color = '';
              }, 2000);
            }
          });
        }
      });
    });
  },

  escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  },

  escapeAttr(str) {
    return str
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  scrollToBottom() {
    const container = document.getElementById('chat-container');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }
};

window.NaviiChat = NaviiChat;
