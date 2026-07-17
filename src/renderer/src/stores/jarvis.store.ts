import { create } from 'zustand'

/* ═══════════════════ VOICE PROFILE TYPE ═══════════════════ */

export interface VoiceProfile {
  id: string
  name: string
  icon: string
  voice: string
  rate: string    // e.g. "+5%", "0%"
  pitch: string   // e.g. "-2Hz", "0Hz"
}

/* ═══════════════════ TYPES ═══════════════════ */

export type OrbState = 'standby' | 'listening' | 'processing' | 'speaking' | 'executing' | 'error' | 'model_swap' | 'ar_mode'

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export type RightTab = 'dialogue' | 'memory' | 'suggestions' | 'trackers' | 'news' | 'labs' | 'ide' | 'goat'

export interface NewsArticle {
  title: string
  url: string
  summary: string
  source: string
  date: string
  category: string
  imageUrl?: string
}

export interface NewsDataset {
  topic: string
  mode: 'general' | 'topic'
  masthead: {
    title: string
    subtitle: string
    edition: string
    editorial: string
    timestamp: number
  }
  categories: Record<string, NewsArticle[]>
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  model?: string
  isStreaming?: boolean
}

export interface ActiveTask {
  id: string
  label: string
  model: string
  progress: number
  status: 'pending' | 'running' | 'completed' | 'failed'
  startedAt: number
  completedAt?: number
}

export interface ModelInfo {
  id: string
  name: string
  status: 'loaded' | 'unloaded' | 'loading' | 'error'
  vramUsage?: number
  lastUsed?: number
}

export interface MemoryStatus {
  status: 'disconnected' | 'connected' | 'error'
  nodes: number
}

export interface LearningCorrection {
  id: string
  misheard: string
  correct: string
  language: string
  audio_file: string | null
  created_at: number
  usage_count: number
  last_used: number | null
}

export interface SystemMetrics {
  cpuUsage: number
  gpuUsage: number
  ramUsage: number
  vramUsage: number
  diskUsage: number
  networkUp: number
  networkDown: number
}

/* ═══════════════════ STORE ═══════════════════ */

interface JarvisStore {
  /* Connection */
  connectionStatus: ConnectionStatus
  backendUrl: string
  wsUrl: string
  setConnectionStatus: (status: ConnectionStatus) => void
  setBackendConfig: (httpUrl: string, wsUrl: string) => void

  /* Orb */
  orbState: OrbState
  setOrbState: (state: OrbState) => void

  /* Chat */
  messages: ChatMessage[]
  addMessage: (message: ChatMessage) => void
  updateMessage: (id: string, content: string, isStreaming?: boolean) => void
  setMessages: (messages: ChatMessage[]) => void
  truncateMessagesFromId: (id: string) => void
  clearMessages: () => void
  isRightExpanded: boolean
  setIsRightExpanded: (expanded: boolean) => void

  /* Tasks */
  tasks: ActiveTask[]
  addTask: (task: ActiveTask) => void
  updateTask: (id: string, updates: Partial<ActiveTask>) => void
  removeTask: (id: string) => void

  /* Models */
  currentModel: string
  models: ModelInfo[]
  swapProgress: number
  setCurrentModel: (model: string) => void
  setModels: (models: ModelInfo[]) => void
  setSwapProgress: (progress: number) => void

  /* Memory */
  memory: MemoryStatus
  setMemoryStatus: (status: MemoryStatus) => void

  /* Metrics */
  metrics: SystemMetrics
  setMetrics: (metrics: Partial<SystemMetrics>) => void

  /* Agent state */
  isAgentActive: boolean

  /* WebSocket */
  ws: WebSocket | null
  setWs: (ws: WebSocket | null) => void
  sendWsMessage: (type: string, payload: Record<string, unknown>) => void

  /* Extended UI States */
  isAdmin: boolean
  setAdmin: (status: boolean) => void
  pendingPermissionRequest: { sessionId: string } | null
  setPendingPermissionRequest: (req: { sessionId: string } | null) => void
  trackerData: Record<string, string>
  setTrackerData: (key: string, value: string) => void
  lastToolResult: { requestId: string; tag: string; result: string; error?: string; timestamp: number } | null
  setLastToolResult: (result: { requestId: string; tag: string; result: string; error?: string; timestamp: number } | null) => void
  stealthMode: boolean
  setStealthMode: (mode: boolean) => void
  hudMode: 'full' | 'minimal'
  setHudMode: (mode: 'full' | 'minimal') => void
  toggleHudMode: () => void
  activeTheme: 'cyan' | 'purple' | 'green' | 'amber' | 'red'
  setActiveTheme: (theme: 'cyan' | 'purple' | 'green' | 'amber' | 'red') => void

  /* News state */
  activeTab: RightTab
  setActiveTab: (tab: RightTab) => void
  newsData: NewsDataset | null
  setNewsData: (data: NewsDataset | null) => void

  /* Labs state */
  activeLab: string | null
  setActiveLab: (lab: string | null) => void
  compilerResult: string | null
  setCompilerResult: (result: string | null) => void

  /* Live Notes state */
  isLiveNotesActive: boolean
  setLiveNotesActive: (active: boolean) => void
  liveNotesSource: 'mic' | 'system' | null
  setLiveNotesSource: (source: 'mic' | 'system' | null) => void
  liveNotesContent: string
  setLiveNotesContent: (content: string) => void

  /* Voice settings */
  selectedVoice: string
  setSelectedVoice: (voice: string) => void
  voiceSettingsOpen: boolean
  setVoiceSettingsOpen: (open: boolean) => void
  voiceShortcuts: Record<string, string>
  setVoiceShortcuts: (shortcuts: Record<string, string>) => void

  /* Voice profiles */
  voiceProfiles: VoiceProfile[]
  activeProfileId: string | null
  setActiveProfileId: (id: string | null) => void
  addVoiceProfile: (profile: VoiceProfile) => void
  updateVoiceProfile: (id: string, updates: Partial<VoiceProfile>) => void
  deleteVoiceProfile: (id: string) => void
  loadVoicesFromStorage: () => void

  /* VAD sensitivity */
  vadSensitivity: number
  setVadSensitivity: (value: number) => void

  /* Voice learning mode */
  learningModeActive: boolean
  setLearningModeActive: (active: boolean) => void
  learningCorrections: LearningCorrection[]
  setLearningCorrections: (corrections: LearningCorrection[]) => void
  learningLastTestResult: { raw: string; corrected: string; matchFound: boolean } | null
  setLearningLastTestResult: (result: { raw: string; corrected: string; matchFound: boolean } | null) => void

  /* Pronunciation editor */
  pronunciations: PronunciationEntry[]
  setPronunciations: (entries: PronunciationEntry[]) => void

  /* Antigravity IDE State */
  ideCurrentPath: string
  setIdeCurrentPath: (path: string) => void
  ideFileTree: any[]
  setIdeFileTree: (tree: any[]) => void
  ideActiveFile: { path: string; name: string; content: string; lines: number } | null
  setIdeActiveFile: (file: { path: string; name: string; content: string; lines: number } | null) => void
  ideTerminalLogs: { command: string; stdout: string; stderr: string; exitCode: number; durationMs: number; time: string }[]
  addIdeTerminalLog: (log: { command: string; stdout: string; stderr: string; exitCode: number; durationMs: number; time: string }) => void
  ideGitState: { branch: string; files: { status: string; file: string }[]; commits: any[] } | null
  setIdeGitState: (state: any) => void
  ideAiResult: { action: string; result: string; language: string } | null
  setIdeAiResult: (result: any) => void
  ideSwarmResult: { task: string; swarm: Record<string, string> } | null
  setIdeSwarmResult: (result: any) => void
}

/* ═══════════════════ PRONUNCIATION TYPE ═══════════════════ */

export interface PronunciationEntry {
  id: string
  word: string
  pronunciation: string
  type: 'alias' | 'phoneme'
  language: string
  created_at: number
  usage_count: number
}

export const useJarvisStore = create<JarvisStore>((set, get) => ({
  /* Connection */
  connectionStatus: 'disconnected',
  backendUrl: 'http://127.0.0.1:8002',
  wsUrl: 'ws://127.0.0.1:8002/ws',
  setConnectionStatus: (status) => set({ connectionStatus: status }),
  setBackendConfig: (httpUrl, wsUrl) => set({ backendUrl: httpUrl, wsUrl }),

  /* Orb */
  orbState: 'standby',
  setOrbState: (orbState) => {
    const isAgentActive = orbState === 'processing' || orbState === 'speaking' || orbState === 'executing' || orbState === 'model_swap'
    set({ orbState, isAgentActive })
  },

  /* Chat */
  messages: [],
  addMessage: (message) => set((s) => ({ messages: [...s.messages, message] })),
  updateMessage: (id, content, isStreaming) =>
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id ? { ...m, content, isStreaming: isStreaming !== undefined ? isStreaming : m.isStreaming } : m))
    })),
  setMessages: (messages) => set({ messages }),
  truncateMessagesFromId: (id) =>
    set((s) => {
      const idx = s.messages.findIndex((m) => m.id === id)
      if (idx !== -1) {
        return { messages: s.messages.slice(0, idx + 1) }
      }
      return {}
    }),
  clearMessages: () => set({ messages: [] }),
  isRightExpanded: false,
  setIsRightExpanded: (expanded) => set({ isRightExpanded: expanded }),

  /* Tasks */
  tasks: [],
  addTask: (task) => set((s) => ({ tasks: [...s.tasks, task] })),
  updateTask: (id, updates) =>
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t))
    })),
  removeTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),

  /* Models */
  currentModel: 'qwen2.5-3b-instruct-q4_k_m',
  models: [
    { id: 'qwen2.5-3b-instruct-q4_k_m', name: 'Qwen 2.5 3B (Active)', status: 'loaded' },
    { id: 'microsoft_Phi-4-mini-instruct-Q4_K_M', name: 'Phi-4 Mini 3.8B', status: 'unloaded' },
    { id: 'gemma-4-E4B-it-Q4_K_M', name: 'Gemma 4 E4B 4B', status: 'unloaded' },
    { id: 'Llama-3.2-1B-Instruct-Q4_K_M', name: 'Llama 3.2 1B', status: 'unloaded' },
    { id: 'Phi-3-mini-4k-instruct-q4', name: 'Phi-3 Mini 3.8B', status: 'unloaded' },
    { id: 'Qwen2.5-VL-7B-Instruct-Q4_K_M', name: 'Qwen 2.5 VL 7B', status: 'unloaded' },
    { id: 'qwen2.5-0.5b-instruct-q4_k_m', name: 'Qwen 0.5B', status: 'unloaded' }
  ],
  swapProgress: 0,
  setCurrentModel: (model) =>
    set((s) => ({
      currentModel: model,
      models: s.models.map((m) => ({
        ...m,
        status: m.id === model ? 'loaded' : m.status === 'loaded' ? 'unloaded' : m.status,
        lastUsed: m.id === model ? Date.now() : m.lastUsed
      }))
    })),
  setModels: (models) => set({ models }),
  setSwapProgress: (swapProgress) => set({ swapProgress }),

  /* Memory */
  memory: { status: 'disconnected', nodes: 0 },
  setMemoryStatus: (memory) => set({ memory }),

  /* Metrics */
  metrics: {
    cpuUsage: 0,
    gpuUsage: 0,
    ramUsage: 0,
    vramUsage: 0,
    diskUsage: 0,
    networkUp: 0,
    networkDown: 0
  },
  setMetrics: (metrics) => set((s) => ({ metrics: { ...s.metrics, ...metrics } })),

  /* Agent state — derived from orbState */
  isAgentActive: false,

  /* WebSocket */
  ws: null,
  setWs: (ws) => set({ ws }),
  sendWsMessage: (type, payload) => {
    const { ws } = get()
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type,
          payload,
          timestamp: Date.now(),
          id: crypto.randomUUID()
        })
      )
    }
  },

  /* Extended UI States */
  isAdmin: false,
  setAdmin: (isAdmin) => set({ isAdmin }),
  pendingPermissionRequest: null,
  setPendingPermissionRequest: (pendingPermissionRequest) => set({ pendingPermissionRequest }),
  trackerData: {},
  setTrackerData: (key, value) => set((s) => ({ trackerData: { ...s.trackerData, [key]: value } })),
  lastToolResult: null,
  setLastToolResult: (lastToolResult) => set({ lastToolResult }),
  stealthMode: false,
  setStealthMode: (stealthMode) => {
    set({ stealthMode })
    if (window.jarvis && window.jarvis.setContentProtection) {
      window.jarvis.setContentProtection(stealthMode)
    }
  },
  hudMode: 'full',
  setHudMode: (hudMode) => set({ hudMode }),
  toggleHudMode: () => set((s) => ({ hudMode: s.hudMode === 'full' ? 'minimal' : 'full' })),
  activeTheme: 'cyan',
  setActiveTheme: (activeTheme) => set({ activeTheme }),

  /* News state */
  activeTab: 'dialogue',
  setActiveTab: (activeTab) => set({ activeTab }),
  newsData: null,
  setNewsData: (newsData) => set({ newsData }),

  /* Labs state */
  activeLab: null,
  setActiveLab: (activeLab) => set({ activeLab }),
  compilerResult: null,
  setCompilerResult: (compilerResult) => set({ compilerResult }),

  /* Live Notes state */
  isLiveNotesActive: false,
  setLiveNotesActive: (isLiveNotesActive) => set({ isLiveNotesActive }),
  liveNotesSource: null,
  setLiveNotesSource: (liveNotesSource) => set({ liveNotesSource }),
  liveNotesContent: '',
  setLiveNotesContent: (liveNotesContent) => set({ liveNotesContent }),

  /* Voice settings */
  selectedVoice: 'en-GB-RyanNeural',
  setSelectedVoice: (selectedVoice) => set({ selectedVoice }),
  voiceSettingsOpen: false,
  setVoiceSettingsOpen: (voiceSettingsOpen) => set({ voiceSettingsOpen }),
  voiceShortcuts: {},
  setVoiceShortcuts: (voiceShortcuts) => set({ voiceShortcuts }),

  /* Voice profiles */
  voiceProfiles: [
    {
      id: 'casual',
      name: 'Casual',
      icon: '🎧',
      voice: 'en-US-JennyNeural',
      rate: '+8%',
      pitch: '+5Hz',
    },
    {
      id: 'professional',
      name: 'Professional',
      icon: '💼',
      voice: 'en-GB-RyanNeural',
      rate: '+5%',
      pitch: '-2Hz',
    },
    {
      id: 'storytelling',
      name: 'Storytelling',
      icon: '📖',
      voice: 'en-US-ChristopherNeural',
      rate: '-5%',
      pitch: '+3Hz',
    },
    {
      id: 'technical',
      name: 'Technical',
      icon: '🔧',
      voice: 'en-US-GuyNeural',
      rate: '+5%',
      pitch: '0Hz',
    },
    {
      id: 'news-anchor',
      name: 'News Anchor',
      icon: '📰',
      voice: 'en-US-AriaNeural',
      rate: '0%',
      pitch: '0Hz',
    },
    {
      id: 'british-female',
      name: 'British Elegance',
      icon: '👩‍💼',
      voice: 'en-GB-MaisieNeural',
      rate: '+3%',
      pitch: '+2Hz',
    },
    {
      id: 'soothing',
      name: 'Soothing',
      icon: '🌙',
      voice: 'en-US-MichelleNeural',
      rate: '-10%',
      pitch: '+8Hz',
    },
    {
      id: 'malayalam-male',
      name: 'മലയാളം (Midhun)',
      icon: '🇮🇳',
      voice: 'ml-IN-MidhunNeural',
      rate: '+10%',
      pitch: '0Hz',
    },
    {
      id: 'malayalam-female',
      name: 'മലയാളം (Sobhana)',
      icon: '🇮🇳',
      voice: 'ml-IN-SobhanaNeural',
      rate: '+8%',
      pitch: '+3Hz',
    },
    {
      id: 'hindi-male',
      name: 'हिन्दी (Madhur)',
      icon: '🇮🇳',
      voice: 'hi-IN-MadhurNeural',
      rate: '+5%',
      pitch: '-2Hz',
    },
    {
      id: 'hindi-female',
      name: 'हिन्दी (Swara)',
      icon: '🇮🇳',
      voice: 'hi-IN-SwaraNeural',
      rate: '+5%',
      pitch: '+2Hz',
    },
    {
      id: 'tamil-male',
      name: 'தமிழ் (Valluvar)',
      icon: '🇮🇳',
      voice: 'ta-IN-ValluvarNeural',
      rate: '+5%',
      pitch: '-2Hz',
    },
    {
      id: 'tamil-female',
      name: 'தமிழ் (Pallavi)',
      icon: '🇮🇳',
      voice: 'ta-IN-PallaviNeural',
      rate: '+8%',
      pitch: '+3Hz',
    },
  ],
  activeProfileId: 'professional',
  setActiveProfileId: (activeProfileId) => set({ activeProfileId }),
  addVoiceProfile: (profile) =>
    set((s) => ({ voiceProfiles: [...s.voiceProfiles, profile] })),
  updateVoiceProfile: (id, updates) =>
    set((s) => ({
      voiceProfiles: s.voiceProfiles.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
    })),
  deleteVoiceProfile: (id) =>
    set((s) => ({
      voiceProfiles: s.voiceProfiles.filter((p) => p.id !== id),
      activeProfileId:
        s.activeProfileId === id ? 'professional' : s.activeProfileId,
    })),
  loadVoicesFromStorage: () => {
    try {
      const stored = localStorage.getItem('astryx-voice-profiles')
      const storedActive = localStorage.getItem('astryx-active-profile')
      if (stored) {
        const profiles = JSON.parse(stored)
        if (Array.isArray(profiles) && profiles.length > 0) {
          set({ voiceProfiles: profiles })
        }
      }
      if (storedActive) {
        set({ activeProfileId: storedActive })
      }
    } catch { /* ignore */ }
  },

  /* VAD sensitivity */
  vadSensitivity: 7,
  setVadSensitivity: (vadSensitivity) => set({ vadSensitivity }),

  /* Voice learning mode */
  learningModeActive: false,
  setLearningModeActive: (learningModeActive) => set({ learningModeActive }),
  learningCorrections: [],
  setLearningCorrections: (learningCorrections) => set({ learningCorrections }),
  learningLastTestResult: null,
  setLearningLastTestResult: (learningLastTestResult) => set({ learningLastTestResult }),

  /* Pronunciation editor */
  pronunciations: [],
  setPronunciations: (pronunciations) => set({ pronunciations }),

  /* Antigravity IDE State */
  ideCurrentPath: 'c:/My_Project/Jarvis',
  setIdeCurrentPath: (ideCurrentPath) => set({ ideCurrentPath }),
  ideFileTree: [],
  setIdeFileTree: (ideFileTree) => set({ ideFileTree }),
  ideActiveFile: null,
  setIdeActiveFile: (ideActiveFile) => set({ ideActiveFile }),
  ideTerminalLogs: [],
  addIdeTerminalLog: (log) => set((s) => ({ ideTerminalLogs: [log, ...s.ideTerminalLogs] })),
  ideGitState: null,
  setIdeGitState: (ideGitState) => set({ ideGitState }),
  ideAiResult: null,
  setIdeAiResult: (ideAiResult) => set({ ideAiResult }),
  ideSwarmResult: null,
  setIdeSwarmResult: (ideSwarmResult) => set({ ideSwarmResult }),
}))
