/**
 * State Management for N.A.V.I.I Desktop Application.
 * Centralized, observable reactive state container.
 */

const NaviiState = {
  theme: localStorage.getItem('navii_theme') || 'dark',
  sidebarCollapsed: localStorage.getItem('navii_sidebar_collapsed') === 'true',
  activeMode: 'chat', // 'chat' | 'voice' | 'writing' | 'coding' | 'files' | 'search'
  activeConversationId: 'session_demo_1',
  isGenerating: false,
  searchEnabled: false,
  
  settings: {
    model: localStorage.getItem('navii_model') || 'smart',
    voice: 'alloy',
    voiceSpeed: 1.0,
    temperature: 0.7,
    maxTokens: 4096,
    soundEffects: true,
    autoTTS: false,
    backendUrl: 'http://127.0.0.1:8000'
  },
  availableModels: [],
  dailyQuotaRemaining: 200,
  dailyQuotaTotal: 200,

  // State for specialized modes
  voiceState: {
    isListening: false,
    isSpeaking: false,
    transcript: '',
    selectedVoice: 'alloy',
    speed: 1.0
  },

  writingState: {
    activeTemplate: 'email',
    sourceText: '',
    generatedText: '',
    tone: 'executive'
  },

  codeState: {
    selectedLang: 'python',
    activeAction: 'generate',
    prompt: '',
    codeOutput: ''
  },

  fileState: {
    files: [
      { id: 'f1', name: 'Q3_Financial_Briefing.pdf', size: '2.4 MB', type: 'PDF', status: 'Extracted' },
      { id: 'f2', name: 'System_Architecture_Specs.docx', size: '840 KB', type: 'DOCX', status: 'Ready' }
    ],
    activeFileId: 'f1'
  },

  searchState: {
    query: '',
    isSearching: false,
    results: [
      {
        title: 'DeepMind Gemini 1.5 Architecture & Multi-Modal Long Context',
        url: 'https://deepmind.google/technologies/gemini/',
        domain: 'deepmind.google',
        snippet: 'Gemini 1.5 achieves breakthrough performance across multi-modal reasoning, native 1M+ token processing, and efficient inference paradigms.'
      },
      {
        title: 'Building Modern Desktop Applications with Electron and FastAPI',
        url: 'https://fastapi.tiangolo.com/tutorial/desktop/',
        domain: 'fastapi.tiangolo.com',
        snippet: 'Decoupling heavy AI computation to remote cloud FastAPI services guarantees low client memory footprint and impenetrable security boundaries.'
      }
    ]
  },

  conversations: [
    {
      id: 'session_demo_1',
      title: 'Neural Core Initialization',
      mode: 'chat',
      updatedAt: 'Just now',
      pinned: true,
      messages: [
        {
          role: 'assistant',
          content: 'Greetings, Operator. I am **N.A.V.I.I** (*Neural Assistant for Virtual Intelligence & Interaction*).\n\nAll cognitive systems are nominal. How may I augment your workflow today?',
          timestamp: '12:00 PM'
        }
      ]
    },
    {
      id: 'session_demo_2',
      title: 'FastAPI Backend Architecture',
      mode: 'coding',
      updatedAt: '2 hours ago',
      pinned: false,
      messages: []
    },
    {
      id: 'session_demo_3',
      title: 'Executive AI Strategy Briefing',
      mode: 'writing',
      updatedAt: 'Yesterday',
      pinned: false,
      messages: []
    }
  ],

  listeners: [],

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  },

  notify(event, payload) {
    this.listeners.forEach(listener => {
      try {
        listener(event, payload);
      } catch (e) {
        console.error('State listener error:', e);
      }
    });
  },

  setTheme(theme) {
    this.theme = theme;
    localStorage.setItem('navii_theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    this.notify('theme_changed', theme);
  },

  toggleSidebar() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
    localStorage.setItem('navii_sidebar_collapsed', String(this.sidebarCollapsed));
    this.notify('sidebar_toggled', this.sidebarCollapsed);
    return this.sidebarCollapsed;
  },

  setActiveMode(mode) {
    this.activeMode = mode;
    this.notify('mode_changed', mode);
  },

  setModel(modelId) {
    this.settings.model = modelId;
    localStorage.setItem('navii_model', modelId);
    this.notify('model_changed', modelId);
  },

  toggleSearch() {
    this.searchEnabled = !this.searchEnabled;
    this.notify('search_toggled', this.searchEnabled);
    return this.searchEnabled;
  },

  getActiveConversation() {
    return this.conversations.find(c => c.id === this.activeConversationId);
  },

  createConversation(title = 'New Conversation', mode = 'chat') {
    const newConvo = {
      id: 'session_' + Date.now(),
      title,
      mode,
      updatedAt: 'Just now',
      pinned: false,
      messages: [
        {
          role: 'assistant',
          content: `Welcome to **${mode.toUpperCase()}** mode with **N.A.V.I.I**. How can I assist you?`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]
    };
    this.conversations.unshift(newConvo);
    this.activeConversationId = newConvo.id;
    this.notify('conversation_created', newConvo);
    return newConvo;
  },

  renameConversation(id, newTitle) {
    const convo = this.conversations.find(c => c.id === id);
    if (convo && newTitle.trim()) {
      convo.title = newTitle.trim();
      this.notify('conversation_renamed', convo);
    }
  },

  togglePinConversation(id) {
    const convo = this.conversations.find(c => c.id === id);
    if (convo) {
      convo.pinned = !convo.pinned;
      // Sort pinned to top
      this.conversations.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
      this.notify('conversation_pinned', convo);
    }
  },

  deleteConversation(id) {
    this.conversations = this.conversations.filter(c => c.id !== id);
    if (this.activeConversationId === id) {
      this.activeConversationId = this.conversations.length > 0 ? this.conversations[0].id : null;
    }
    this.notify('conversation_deleted', id);
  }
};

window.NaviiState = NaviiState;
