import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useJarvisStore } from '@/stores/jarvis.store'
import { audioEngine } from '@/utils/AudioEngine'
import { LabsTab } from './LabsTab'
import { AntigravityIDETab } from './AntigravityIDETab'
import { GoatDashboardTab } from './GoatDashboardTab'

type RightTab = 'dialogue' | 'memory' | 'suggestions' | 'trackers' | 'news' | 'labs' | 'ide' | 'goat'

export function RightPanel(): React.JSX.Element {
  const activeTab = useJarvisStore((s) => s.activeTab)
  const setActiveTab = useJarvisStore((s) => s.setActiveTab)
  const isRightExpanded = useJarvisStore((s) => s.isRightExpanded)
  
  const tabs: { id: RightTab; label: string }[] = [
    { id: 'dialogue', label: 'DIALOGUE' },
    { id: 'trackers', label: 'OPERATIONS' },
    { id: 'news', label: 'DAILY' },
    { id: 'memory', label: 'MEMORY' },
    { id: 'suggestions', label: 'SUGGEST' },
    { id: 'labs', label: 'LABS ⚡' },
    { id: 'ide', label: 'ANTIGRAVITY IDE 🚀' },
    { id: 'goat', label: 'CR7 GOAT 👑' }
  ]

  const handleTabClick = (tabId: RightTab): void => {
    audioEngine.playClick()
    setActiveTab(tabId)
  }

  return (
    <div className="panel-luxury h-full flex flex-col pointer-events-auto shadow-[0_20px_40px_rgba(0,0,0,0.4)]" id="right-panel">
      <div className="flex border-b border-white/10 px-2 bg-transparent justify-between items-center shrink-0">
        <div className="flex overflow-x-auto select-none no-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`tab-button px-4 ${activeTab === tab.id ? 'tab-button-active' : ''}`}
              onClick={() => handleTabClick(tab.id)}
              onMouseEnter={() => audioEngine.playHover()}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => {
            audioEngine.playClick()
            useJarvisStore.getState().setIsRightExpanded(!isRightExpanded)
          }}
          onMouseEnter={() => audioEngine.playHover()}
          className="mr-3 shrink-0 font-mono text-[9px] tracking-[0.2em] px-2 py-1 rounded border border-white/10 hover:border-white/30 bg-white/5 text-white/60 hover:text-white transition-all cursor-pointer flex items-center gap-1.5"
          title={isRightExpanded ? "Collapse Panel" : "Expand Panel"}
        >
          <span>{isRightExpanded ? 'COLLAPSE' : 'EXPAND'}</span>
          <span className="text-[10px]">⛶</span>
        </button>
      </div>
      
      <div className="flex-1 overflow-hidden relative flex flex-col min-h-0">
        {/* Background grid lines for luxury effect */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(rgba(0,212,255,1)_1px,transparent_1px),linear-gradient(90deg,rgba(0,212,255,1)_1px,transparent_1px)] bg-[size:30px_30px]" />
        
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="flex-1 overflow-hidden relative z-10 flex flex-col min-h-0"
          >
            {activeTab === 'dialogue' && <DialogueTab />}
            {activeTab === 'trackers' && <TrackersTab />}
            {activeTab === 'news' && <NewsNewspaperView />}
            {activeTab === 'memory' && <MemoryTab />}
            {activeTab === 'suggestions' && <SuggestionsTab />}
            {activeTab === 'labs' && <LabsTab />}
            {activeTab === 'ide' && <AntigravityIDETab />}
            {activeTab === 'goat' && <GoatDashboardTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

/* ═══════════════════ HELPERS ═══════════════════ */

function parseMarkdownTable(md: string) {
  if (!md) return []
  const lines = md.split('\n').map(l => l.trim()).filter(l => l.startsWith('|'))
  if (lines.length < 2) return []
  
  const headers = lines[0].split('|').map(h => h.trim()).filter(Boolean)
  const dataRows = lines.slice(2)
  return dataRows.map(row => {
    const cells = row.split('|').map(c => c.trim())
    const actualCells = cells.slice(1, cells.length - 1)
    const obj: Record<string, string> = {}
    headers.forEach((h, idx) => {
      obj[h] = actualCells[idx] || ''
    })
    return obj
  })
}

/* ═══════════════════ CLEAN DIALOGUE TEXT HELPERS ═══════════════════ */

function parseInlineElements(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*|`)(.*?)\1/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const textBefore = text.substring(lastIndex, match.index);
    if (textBefore) {
      parts.push(textBefore);
    }

    const type = match[1];
    const content = match[2];

    if (type === '**') {
      parts.push(<strong key={`b-${match.index}`} className="font-bold text-cyan-200">{content}</strong>);
    } else if (type === '`') {
      parts.push(
        <code key={`code-in-${match.index}`} className="bg-black/40 border border-white/10 px-1 py-0.5 rounded text-[11.5px] font-mono text-cyan-300 mx-0.5">
          {content}
        </code>
      );
    }

    lastIndex = regex.lastIndex;
  }

  const remaining = text.substring(lastIndex);
  if (remaining) {
    parts.push(remaining);
  }

  return parts;
}

function parseInlineMarkdownAndBlocks(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const rendered: React.ReactNode[] = [];

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (trimmed.startsWith('### ')) {
      rendered.push(
        <h3 key={`h3-${index}`} className="text-cyan-400 font-bold text-[14px] mt-3 mb-1 tracking-wider uppercase border-b border-cyan-500/10 pb-0.5">
          {parseInlineElements(trimmed.substring(4))}
        </h3>
      );
    } else if (trimmed.startsWith('## ')) {
      rendered.push(
        <h2 key={`h2-${index}`} className="text-cyan-300 font-bold text-[15px] mt-4 mb-1.5 tracking-wider uppercase border-b border-cyan-500/20 pb-1">
          {parseInlineElements(trimmed.substring(3))}
        </h2>
      );
    } else if (trimmed.startsWith('# ')) {
      rendered.push(
        <h1 key={`h1-${index}`} className="text-cyan-200 font-extrabold text-[16px] mt-4 mb-2 tracking-widest uppercase border-b border-cyan-500/30 pb-1">
          {parseInlineElements(trimmed.substring(2))}
        </h1>
      );
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      rendered.push(
        <div key={`li-${index}`} className="flex items-start gap-2 my-1 pl-2 text-[13px] text-white/90">
          <span className="text-cyan-400 select-none mt-[3px]">▪</span>
          <span className="leading-relaxed">{parseInlineElements(trimmed.substring(2))}</span>
        </div>
      );
    } else if (trimmed === '') {
      rendered.push(<div key={`br-${index}`} className="h-2" />);
    } else {
      rendered.push(
        <p key={`p-${index}`} className="text-[13px] leading-relaxed tracking-wide text-white/90 my-1">
          {parseInlineElements(line)}
        </p>
      );
    }
  });

  return rendered;
}

function renderMarkdown(text: string) {
  if (!text) return null;

  const parts: React.ReactNode[] = [];
  const regex = /```(\w*)\n([\s\S]*?)(?:```|$)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const textBefore = text.substring(lastIndex, match.index);
    if (textBefore) {
      parts.push(...parseInlineMarkdownAndBlocks(textBefore));
    }

    const lang = match[1] || 'code';
    const code = match[2];

    parts.push(
      <div key={`code-${match.index}`} className="my-3 border border-cyan-500/30 rounded-lg overflow-hidden bg-black/60 shadow-[0_0_20px_rgba(0,212,255,0.05)] font-mono w-full">
        <div className="flex justify-between items-center bg-black/80 px-3 py-1.5 border-b border-white/10 text-[10px] text-white/50 tracking-wider">
          <span>{lang.toUpperCase()}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(code.trim());
              audioEngine.playSuccess();
            }}
            className="hover:text-cyan-400 transition-colors cursor-pointer"
          >
            COPY
          </button>
        </div>
        <pre className="p-3 overflow-x-auto text-xs text-cyan-100/90 leading-relaxed max-w-full">
          <code>{code}</code>
        </pre>
      </div>
    );

    lastIndex = regex.lastIndex;
  }

  const remainingText = text.substring(lastIndex);
  if (remainingText) {
    parts.push(...parseInlineMarkdownAndBlocks(remainingText));
  }

  return parts;
}

interface CleanDialogueTextProps {
  content: string;
  isStreaming?: boolean;
}

function CleanDialogueText({ content, isStreaming }: CleanDialogueTextProps): React.JSX.Element {
  const systemLogs: { type: 'result' | 'error'; content: string }[] = [];
  
  const systemRegex = /\[System (Result|Error): ([\s\S]*?)\]/g;
  let cleanedContent = content;
  let match;
  
  while ((match = systemRegex.exec(content)) !== null) {
    systemLogs.push({
      type: match[1].toLowerCase() as 'result' | 'error',
      content: match[2].trim()
    });
  }
  
  cleanedContent = cleanedContent.replace(/\[System (Result|Error): ([\s\S]*?)\]/g, '').trim();
  cleanedContent = cleanedContent.replace(/<[A-Z_]+>[\s\S]*?<\/[A-Z_]+>/g, '').trim();

  return (
    <div className="space-y-3 w-full">
      {cleanedContent ? (
        <div className="dialogue-markdown-body text-left">
          {renderMarkdown(cleanedContent)}
        </div>
      ) : (
        !isStreaming && systemLogs.length > 0 && (
          <span className="text-[11px] font-mono text-cyan-400/60 uppercase tracking-widest animate-pulse block text-left">
            ⚡ Action execution logs
          </span>
        )
      )}
      
      {isStreaming && (
        <span className="inline-block w-2 h-2 bg-white rounded-full ml-1 animate-pulse shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
      )}

      {systemLogs.length > 0 && (
        <div className="mt-3 space-y-2 pt-2 border-t border-white/5 w-full">
          {systemLogs.map((log, idx) => (
            <details
              key={`sys-log-${idx}`}
              className="group border border-white/5 rounded-lg overflow-hidden bg-black/40 backdrop-blur-md transition-all duration-300 hover:border-cyan-500/20 w-full"
              onClick={(e) => {
                e.stopPropagation();
                audioEngine.playClick();
              }}
            >
              <summary className="flex justify-between items-center px-3 py-2 cursor-pointer font-mono text-[10px] text-white/40 group-hover:text-cyan-300 transition-colors select-none list-none [&::-webkit-details-marker]:hidden w-full">
                <span className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${log.type === 'error' ? 'bg-red-500 animate-pulse' : 'bg-cyan-500'}`} />
                  {log.type === 'error' ? 'SYSTEM ERROR DETECTED' : 'SYSTEM LOGS'}
                </span>
                <span className="font-mono text-[8px] border border-white/10 group-hover:border-cyan-500/30 px-1 py-0.5 rounded transition-all">
                  CLICK TO VIEW
                </span>
              </summary>
              <div className="px-3 pb-3 pt-1 border-t border-white/5 bg-black/60 w-full">
                <pre className="font-mono text-[11px] leading-relaxed text-left text-cyan-100/70 overflow-x-auto whitespace-pre-wrap max-h-40 max-w-full selection:bg-cyan-500/20">
                  {log.content}
                </pre>
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════ DIALOGUE TAB ═══════════════════ */

function DialogueTab(): React.JSX.Element {
  const messages = useJarvisStore((s) => s.messages)
  const orbState = useJarvisStore((s) => s.orbState)
  const scrollRef = useRef<HTMLDivElement>(null)
  
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  const isExecuting = orbState === 'processing' || orbState === 'speaking' || orbState === 'executing'

  const handleStopExecution = (): void => {
    audioEngine.playAlert()
    useJarvisStore.getState().sendWsMessage('stop_execution', {})
  }

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleCopy = (content: string): void => {
    audioEngine.playSuccess()
    navigator.clipboard.writeText(content)
  }

  const handleStartEdit = (id: string, content: string): void => {
    audioEngine.playClick()
    setEditingId(id)
    setEditText(content)
  }

  const handleSaveEdit = (id: string): void => {
    if (editText.trim()) {
      audioEngine.playClick()
      useJarvisStore.getState().updateMessage(id, editText.trim())
      useJarvisStore.getState().truncateMessagesFromId(id)
      useJarvisStore.getState().sendWsMessage('chat', { message: editText.trim() })
      setEditingId(null)
    }
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-white/40">
        <div className="w-20 h-20 border border-white/10 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(255,255,255,0.05)] backdrop-blur-md">
          <div className="w-12 h-12 border-[1px] border-white/20 rounded-full flex items-center justify-center animate-[pulse_4s_ease-in-out_infinite]">
            <div className="w-4 h-4 bg-white/30 rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
          </div>
        </div>
        <span className="font-body text-xs tracking-[0.2em] text-white/50">Listening...</span>
      </div>
    )
  }

  return (
    <div className="relative flex-1 flex flex-col min-h-0">
      <div ref={scrollRef} className="space-y-6 flex-1 overflow-y-auto p-4 pr-3 font-body pb-4 min-h-0">
        {messages.filter((m) => m.role !== 'system').map((msg, i) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 15, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 30, delay: i * 0.05 }}
            className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'user' ? (
              <div className="flex flex-col max-w-[85%] items-end group w-full">
                {editingId === msg.id ? (
                  <div className="w-full flex flex-col gap-2 bg-white/10 backdrop-blur-xl border border-white/20 p-3 rounded-2xl rounded-tr-sm">
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="w-full bg-black/30 border border-white/10 rounded-lg p-2 text-[13px] text-white font-light focus:outline-none focus:border-white/30 resize-none h-20"
                      onKeyDown={(e) => {
                        if (e.key !== 'Enter' || e.shiftKey) {
                          audioEngine.playKeyboardTyping();
                        }
                      }}
                    />
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1 font-mono text-[9px] tracking-widest border border-white/10 hover:border-white/20 rounded hover:bg-white/5 cursor-pointer text-white/60"
                        onMouseEnter={() => audioEngine.playHover()}
                      >
                        CANCEL
                      </button>
                      <button
                        onClick={() => handleSaveEdit(msg.id)}
                        className="px-3 py-1 font-mono text-[9px] tracking-widest border border-white/30 bg-white/10 hover:bg-white/20 rounded cursor-pointer text-white font-bold"
                        onMouseEnter={() => audioEngine.playHover()}
                      >
                        SAVE
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="bg-white/10 backdrop-blur-xl border border-white/20 text-white/90 px-4 py-3 rounded-2xl rounded-tr-sm shadow-[0_4px_20px_rgba(0,0,0,0.1)] relative">
                      <p className="text-[13px] tracking-wide font-light leading-relaxed whitespace-pre-wrap">
                        {msg.content}
                      </p>
                    </div>
                    <div className="flex gap-2 items-center mt-1 mr-1 opacity-40 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleCopy(msg.content)}
                        className="text-[9px] font-mono tracking-wider text-white/40 hover:text-white transition-colors cursor-pointer"
                        title="Copy message"
                        onMouseEnter={() => audioEngine.playHover()}
                      >
                        COPY
                      </button>
                      <span className="text-white/20">|</span>
                      <button
                        onClick={() => handleStartEdit(msg.id, msg.content)}
                        className="text-[9px] font-mono tracking-wider text-white/40 hover:text-white transition-colors cursor-pointer"
                        title="Edit message"
                        onMouseEnter={() => audioEngine.playHover()}
                      >
                        EDIT
                      </button>
                      <span className="text-white/20">|</span>
                      <span className="text-[9px] text-white/30">{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="flex flex-col max-w-[85%] items-start group w-full">
                <div className="bg-gradient-to-br from-[rgba(0,212,255,0.15)] to-[rgba(0,100,255,0.05)] backdrop-blur-2xl border border-[rgba(0,212,255,0.3)] text-white px-4 py-3 rounded-2xl rounded-tl-sm shadow-[0_8px_32px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.2)] relative overflow-hidden w-full">
                  <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
                  <div className="relative z-10 w-full">
                    <CleanDialogueText content={msg.content} isStreaming={msg.isStreaming} />
                  </div>
                </div>
                <div className="flex gap-2 items-center mt-1 ml-1 opacity-40 group-hover:opacity-100 transition-opacity">
                  <span className="text-[9px] text-white/30">{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  {msg.model && (
                    <span className="text-[8px] text-[rgba(0,212,255,0.6)] border border-[rgba(0,212,255,0.2)] px-1.5 py-0.5 rounded-full backdrop-blur-md">{msg.model}</span>
                  )}
                  <span className="text-white/20">|</span>
                  <button
                    onClick={() => handleCopy(msg.content)}
                    className="text-[9px] font-mono tracking-wider text-white/40 hover:text-white transition-colors cursor-pointer"
                    title="Copy message"
                    onMouseEnter={() => audioEngine.playHover()}
                  >
                    COPY
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {isExecuting && (
        <div className="absolute bottom-4 right-4 flex justify-end pointer-events-none z-30">
          <button
            onClick={handleStopExecution}
            className="pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-red-500/50 hover:border-red-500 bg-red-950/70 text-red-400 font-mono text-[8.5px] font-bold tracking-widest cursor-pointer shadow-[0_0_15px_rgba(239,68,68,0.3)] hover:scale-105 active:scale-95 transition-all uppercase"
            onMouseEnter={() => audioEngine.playHover()}
          >
            <span>🛑</span>
            <span>STOP EXECUTION</span>
          </button>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════ OPERATIONS / TRACKERS DASHBOARD ═══════════════════ */

type SubTrackerTab = 'stealth' | 'coding' | 'ppt' | 'iot' | 'finance' | 'health' | 'drone' | 'gitdocker'

function TrackersTab(): React.JSX.Element {
  const [subTab, setSubTab] = useState<SubTrackerTab>('stealth')
  const trackerData = useJarvisStore((s) => s.trackerData)
  const sendWsMessage = useJarvisStore((s) => s.sendWsMessage)
  const [loading, setLoading] = useState(false)

  const subTabs: { id: SubTrackerTab; label: string }[] = [
    { id: 'stealth', label: '🤫 SOLVER' },
    { id: 'coding', label: '💻 COMPILER' },
    { id: 'ppt', label: '📊 DECKS' },
    { id: 'iot', label: '🏠 IOT' },
    { id: 'finance', label: '🪙 COIN' },
    { id: 'health', label: '🏥 HEALTH' },
    { id: 'drone', label: '🚁 DRONE' },
    { id: 'gitdocker', label: '📦 DEVOPS' }
  ]

  const handleSubTabClick = (id: SubTrackerTab): void => {
    audioEngine.playClick()
    setSubTab(id)
  }

  // Auto-fetch data on sub-tab activation
  useEffect(() => {
    if (subTab === 'iot') {
      setLoading(true)
      sendWsMessage('run_tool', { tag: 'IOT', content: 'list' })
    } else if (subTab === 'finance') {
      setLoading(true)
      sendWsMessage('run_tool', { tag: 'FINANCE', content: 'summary' })
      sendWsMessage('run_tool', { tag: 'FINANCE', content: 'portfolio' })
    } else if (subTab === 'health') {
      setLoading(true)
      sendWsMessage('run_tool', { tag: 'HEALTH', content: 'list' })
    } else if (subTab === 'gitdocker') {
      setLoading(true)
      sendWsMessage('run_tool', { tag: 'GIT', content: 'status' })
    }
  }, [subTab, sendWsMessage])

  // Stop loading when data arrives
  useEffect(() => {
    setLoading(false)
  }, [trackerData])

  return (
    <div className="h-full flex flex-col overflow-hidden min-h-0">
      {/* Sub tabs scroll bar */}
      <div className="flex border-b border-white/5 bg-black/10 overflow-x-auto no-scrollbar shrink-0 select-none py-1.5 gap-1 px-3">
        {subTabs.map((t) => (
          <button
            key={t.id}
            onClick={() => handleSubTabClick(t.id)}
            onMouseEnter={() => audioEngine.playHover()}
            className={`px-3 py-1 font-mono text-[8px] tracking-wider rounded border transition-all cursor-pointer shrink-0 ${
              subTab === t.id
                ? 'border-[#00e5ff]/35 bg-[#00e5ff]/10 text-[#00e5ff] shadow-[0_0_8px_rgba(0,229,255,0.15)] font-semibold'
                : 'border-transparent text-white/50 hover:text-white hover:bg-white/5'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 min-h-0 relative">
        {loading && (
          <div className="absolute inset-0 bg-[#00050d]/80 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="text-center space-y-2">
              <div className="w-8 h-8 border-t-2 border-[#00e5ff] rounded-full animate-spin mx-auto" />
              <div className="font-mono text-[7px] text-[#00e5ff]/70 tracking-widest uppercase">FETCHING TELEMETRY...</div>
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={subTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.15 }}
            className="h-full"
          >
            {subTab === 'stealth' && <StealthSolverView />}
            {subTab === 'coding' && <CodingSandboxView />}
            {subTab === 'ppt' && <PptDesignView />}
            {subTab === 'iot' && <IoTTrackerView />}
            {subTab === 'finance' && <FinanceTrackerView />}
            {subTab === 'health' && <HealthTrackerView />}
            {subTab === 'drone' && <DroneSimulatorView />}
            {subTab === 'gitdocker' && <GitDockerDashboardView />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

/* ── SUB-VIEW 1: STEALTH INTERVIEW & TEST SOLVER ── */

function StealthSolverView(): React.JSX.Element {
  const stealthMode = useJarvisStore((s) => s.stealthMode)
  const setStealthMode = useJarvisStore((s) => s.setStealthMode)
  const addMessage = useJarvisStore((s) => s.addMessage)
  const sendWsMessage = useJarvisStore((s) => s.sendWsMessage)
  const messages = useJarvisStore((s) => s.messages)
  const [solving, setSolving] = useState(false)

  const handleCaptureAndSolve = (): void => {
    audioEngine.playScanning()
    setSolving(true)
    const instruction = "<VISION>Capture the screen, extract any LeetCode/HackerRank or proctoring test coding question present on the display, write an optimized solution for it, and then store/copy it to my clipboard using the <CLIPBOARD>write|...</CLIPBOARD> tag. Also reply with the clean code.</VISION>"
    addMessage({
      id: crypto.randomUUID(),
      role: 'user',
      content: "Snip screen and solve coding test question.",
      timestamp: Date.now()
    })
    sendWsMessage('chat', { message: instruction })
  }

  const lastCodeAnswer = messages
    .filter((m) => m.role === 'assistant')
    .slice(-1)[0]?.content || ''

  useEffect(() => {
    if (lastCodeAnswer) {
      setSolving(false)
    }
  }, [lastCodeAnswer])

  const copyStealthCode = (): void => {
    audioEngine.playSuccess()
    const match = lastCodeAnswer.match(/```(?:[a-zA-Z]+)?\n([\s\S]+?)\n```/)
    const code = match ? match[1] : lastCodeAnswer
    navigator.clipboard.writeText(code)
  }

  return (
    <div className="space-y-6 font-mono text-[10px] relative">
      {/* Background ambient glow when stealth mode is active */}
      {stealthMode && (
        <div className="absolute inset-0 bg-emerald-500/5 blur-3xl pointer-events-none transition-opacity duration-1000" />
      )}
      
      {/* STEALTH SHIELD CONTROL */}
      <motion.div 
        className={`relative overflow-hidden rounded-xl border backdrop-blur-md transition-all duration-500 ${
          stealthMode 
            ? 'border-emerald-500/50 bg-emerald-950/20 shadow-[0_0_30px_rgba(16,185,129,0.15)]' 
            : 'border-cyan-500/20 bg-cyan-950/10 shadow-[0_10px_30px_rgba(0,0,0,0.5)]'
        }`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
        
        {stealthMode && (
          <motion.div 
            className="absolute -right-20 -top-20 w-40 h-40 bg-emerald-500/20 blur-3xl rounded-full pointer-events-none"
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          />
        )}

        <div className="p-4 relative z-10 space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <h4 className="font-display text-[12px] text-white tracking-[0.3em] font-bold flex items-center gap-2">
              <span className={stealthMode ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'text-cyan-400'}>
                {stealthMode ? '✦' : '✧'}
              </span> 
              STEALTH OPERATIONS
            </h4>
            {stealthMode && (
              <span className="text-[9px] font-bold text-emerald-400 tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30 animate-pulse">
                ACTIVE
              </span>
            )}
          </div>
          
          <div className="flex items-center justify-between py-1">
            <div className="space-y-1.5 pr-4">
              <span className="text-white font-bold tracking-widest text-[11px] drop-shadow-md">SCREEN RECORD SHIELD</span>
              <p className="text-[7.5px] text-white/50 tracking-widest leading-relaxed">
                ACTIVATES OS-LEVEL CONTENT PROTECTION. <br/>
                APP BECOMES INVISIBLE TO SCREEN CAPTURE & RECORDING.
              </p>
            </div>
            
            <button
              onClick={() => {
                audioEngine.playElevate()
                setStealthMode(!stealthMode)
              }}
              className="relative group cursor-pointer shrink-0 outline-none"
            >
              <div className={`absolute inset-0 rounded-lg blur-md transition-all duration-500 opacity-0 group-hover:opacity-100 ${stealthMode ? 'bg-emerald-500/40' : 'bg-cyan-500/40'}`} />
              <div className={`relative px-4 py-2.5 rounded-lg border transition-all duration-300 font-bold tracking-[0.2em] flex items-center gap-2 ${
                stealthMode
                  ? 'border-emerald-400 bg-emerald-950/80 text-emerald-300 shadow-[inset_0_0_15px_rgba(16,185,129,0.3)]'
                  : 'border-white/20 bg-black/40 text-white/70 group-hover:text-white group-hover:border-cyan-500/50'
              }`}>
                {stealthMode ? (
                  <>
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    SHIELD ARMED
                  </>
                ) : (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-white/30 group-hover:bg-cyan-400 transition-colors" />
                    ARM SHIELD
                  </>
                )}
              </div>
            </button>
          </div>
        </div>
      </motion.div>

      {/* LIVE INTERVIEW SOLVER */}
      <motion.div 
        className="relative overflow-hidden rounded-xl border border-white/10 bg-black/40 backdrop-blur-md shadow-[0_15px_40px_rgba(0,0,0,0.6)]"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
        
        <div className="p-4 space-y-4 relative z-10">
          <div className="flex justify-between items-center">
            <span className="text-white font-bold tracking-[0.2em] text-[11px] flex items-center gap-2">
              <span className="text-blue-400">⚡</span> LIVE INTERVIEW SOLVER
            </span>
          </div>
          
          <button
            onClick={handleCaptureAndSolve}
            disabled={solving}
            className="group relative w-full py-3 rounded-lg overflow-hidden cursor-pointer disabled:cursor-not-allowed disabled:opacity-80 transition-all duration-300"
          >
            {/* Animated gradient background */}
            <div className={`absolute inset-0 transition-opacity duration-300 ${solving ? 'opacity-100' : 'opacity-80 group-hover:opacity-100'} bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600`} />
            
            {/* Shine effect */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-20 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.5)_50%,transparent_75%)] bg-[length:250%_250%,100%_100%] animate-[shine_2s_infinite]" />
            
            <div className="relative flex items-center justify-center gap-3 text-white font-display text-[11px] font-bold tracking-[0.25em]">
              {solving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
                  <span className="drop-shadow-md">ANALYZING QUESTION...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 drop-shadow-md" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="drop-shadow-md">CAPTURE & SOLVE</span>
                </>
              )}
            </div>
          </button>

          {/* Result Area */}
          <AnimatePresence>
            {lastCodeAnswer && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="pt-2 overflow-hidden"
              >
                <div className="rounded-lg border border-cyan-500/20 bg-cyan-950/20 p-3 space-y-3 relative overflow-hidden">
                  <div className="absolute -right-4 -top-4 w-12 h-12 bg-cyan-500/10 rounded-full blur-xl" />
                  
                  <div className="flex justify-between items-center relative z-10">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                      <span className="text-cyan-200/70 font-semibold tracking-widest text-[8px]">SOLUTION GENERATED</span>
                    </div>
                    
                    <button
                      onClick={copyStealthCode}
                      className="group/btn flex items-center gap-1.5 px-3 py-1.5 bg-cyan-950/40 border border-cyan-500/30 hover:border-cyan-400 hover:bg-cyan-900/60 text-cyan-300 rounded transition-all cursor-pointer shadow-[0_0_10px_rgba(0,229,255,0.1)] hover:shadow-[0_0_15px_rgba(0,229,255,0.3)] outline-none"
                    >
                      <svg className="w-3 h-3 group-hover/btn:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                      </svg>
                      <span className="font-bold tracking-widest text-[8px]">COPY CODE</span>
                    </button>
                  </div>
                  
                  <div className="relative rounded bg-black/60 border border-white/5 p-3 overflow-x-auto overflow-y-auto max-h-48 custom-scrollbar">
                    <pre className="text-white/80 font-mono text-[9px] leading-relaxed">
                      <code>{lastCodeAnswer}</code>
                    </pre>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}

/* ── SUB-VIEW 2: CODING SANDBOX COMPILER ── */

type SandboxLanguage = {
  id: string
  label: string
  defaultCode: string
}

const SANDBOX_LANGUAGES: SandboxLanguage[] = [
  {
    id: 'python',
    label: 'Python',
    defaultCode: `def solve():\n    print("Hello from Python sandbox!")\n    return 2 + 2\n\nprint(f"Result: {solve()}")`
  },
  {
    id: 'javascript',
    label: 'JavaScript',
    defaultCode: `function solve() {\n  console.log("Hello from JavaScript sandbox!");\n  return [1, 2, 3].reduce((a, b) => a + b, 0);\n}\n\nconsole.log(\`Result: \${solve()}\`);`
  },
  {
    id: 'typescript',
    label: 'TypeScript',
    defaultCode: `function solve(): number {\n  console.log("Hello from TypeScript sandbox!");\n  return 10 + 5;\n}\n\nconsole.log(\`Result: \${solve()}\`);`
  },
  {
    id: 'java',
    label: 'Java',
    defaultCode: `public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello from Java sandbox!");\n        System.out.println("Result: " + (6 * 7));\n    }\n}`
  },
  {
    id: 'c',
    label: 'C',
    defaultCode: `#include <stdio.h>\n\nint main() {\n    printf("Hello from C sandbox!\\n");\n    printf("Result: %d\\n", 21 + 21);\n    return 0;\n}`
  },
  {
    id: 'cpp',
    label: 'C++',
    defaultCode: `#include <iostream>\n\nint main() {\n    std::cout << "Hello from C++ sandbox!" << std::endl;\n    std::cout << "Result: " << (15 + 27) << std::endl;\n    return 0;\n}`
  },
  {
    id: 'csharp',
    label: 'C#',
    defaultCode: `using System;\n\nclass Program {\n    static void Main() {\n        Console.WriteLine("Hello from C# sandbox!");\n        Console.WriteLine($"Result: {40 + 2}");\n    }\n}`
  },
  {
    id: 'go',
    label: 'Go',
    defaultCode: `package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello from Go sandbox!")\n    fmt.Println("Result:", 30+12)\n}`
  },
  {
    id: 'rust',
    label: 'Rust',
    defaultCode: `fn main() {\n    println!("Hello from Rust sandbox!");\n    println!("Result: {}", 11 + 31);\n}`
  },
  {
    id: 'ruby',
    label: 'Ruby',
    defaultCode: `puts "Hello from Ruby sandbox!"\nputs "Result: #{6 * 7}"`
  },
  {
    id: 'php',
    label: 'PHP',
    defaultCode: `<?php\necho "Hello from PHP sandbox!\\n";\necho "Result: " . (8 * 5) . "\\n";\n?>`
  },
  {
    id: 'powershell',
    label: 'PowerShell',
    defaultCode: `Write-Output "Hello from PowerShell sandbox!"\n$result = 9 + 33\nWrite-Output "Result: $result"`
  },
  {
    id: 'bash',
    label: 'Bash',
    defaultCode: `#!/usr/bin/env bash\necho "Hello from Bash sandbox!"\necho "Result: $((14 + 28))"`
  }
]

function CodingSandboxView(): React.JSX.Element {
  const [language, setLanguage] = useState(SANDBOX_LANGUAGES[0].id)
  const [code, setCode] = useState(SANDBOX_LANGUAGES[0].defaultCode)
  const [output, setOutput] = useState('')
  const [running, setRunning] = useState(false)
  const pendingRequestId = useRef<string | null>(null)
  const lastToolResult = useJarvisStore((s) => s.lastToolResult)
  const sendWsMessage = useJarvisStore((s) => s.sendWsMessage)
  const connectionStatus = useJarvisStore((s) => s.connectionStatus)

  const selectedLanguage = SANDBOX_LANGUAGES.find((lang) => lang.id === language) ?? SANDBOX_LANGUAGES[0]

  const handleLanguageChange = (nextLanguage: string): void => {
    audioEngine.playClick()
    const nextConfig = SANDBOX_LANGUAGES.find((lang) => lang.id === nextLanguage)
    if (!nextConfig) return
    setLanguage(nextConfig.id)
    setCode(nextConfig.defaultCode)
    setOutput('')
  }

  const handleRunCode = (): void => {
    if (connectionStatus !== 'connected') {
      setOutput('Error: Backend is not connected. Start the Jarvis backend and try again.')
      return
    }

    audioEngine.playClick()
    const requestId = crypto.randomUUID()
    pendingRequestId.current = requestId
    setRunning(true)
    setOutput(`Compiling and running ${selectedLanguage.label}...\n`)
    sendWsMessage('run_tool', {
      tag: 'SANDBOX',
      content: `${language}|${code}`,
      requestId
    })
  }

  useEffect(() => {
    if (!running || !pendingRequestId.current || !lastToolResult) return
    if (lastToolResult.requestId !== pendingRequestId.current) return
    if (lastToolResult.tag !== 'SANDBOX') return

    const resultText = lastToolResult.error
      ? `Error: ${lastToolResult.error}`
      : lastToolResult.result

    setOutput(resultText || 'Program executed successfully with no output.')
    setRunning(false)
    pendingRequestId.current = null
  }, [lastToolResult, running])

  useEffect(() => {
    if (!running) return
    const timeout = window.setTimeout(() => {
      if (pendingRequestId.current) {
        setOutput((prev) => `${prev}\nError: Execution timed out. Check backend logs or compiler installation.`)
        setRunning(false)
        pendingRequestId.current = null
      }
    }, 35000)

    return () => window.clearTimeout(timeout)
  }, [running])

  return (
    <div className="h-full flex flex-col gap-3 font-mono text-[9px] min-h-0">
      <div className="flex justify-between items-center shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-white font-bold shrink-0">CODE SANDBOX</span>
          <select
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value)}
            disabled={running}
            className="bg-black/40 border border-white/10 rounded px-2 py-1 text-[9px] text-cyan-300 focus:outline-none focus:border-[#00e5ff]/40 cursor-pointer max-w-[140px]"
          >
            {SANDBOX_LANGUAGES.map((lang) => (
              <option key={lang.id} value={lang.id} className="bg-[#0a0f18]">
                {lang.label}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={handleRunCode}
          disabled={running}
          className="px-4 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white rounded font-display text-[9px] font-semibold tracking-wider uppercase transition-all cursor-pointer shadow-[0_0_10px_rgba(16,185,129,0.15)] shrink-0"
        >
          {running ? 'RUNNING...' : '⚡ RUN CODE'}
        </button>
      </div>

      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        className="flex-1 min-h-[140px] bg-black/35 border border-white/10 rounded-lg p-3 text-[10px] text-cyan-300 font-mono focus:outline-none focus:border-[#00e5ff]/40 resize-none select-text leading-relaxed"
        spellCheck={false}
      />

      <div className="h-32 bg-black/60 border border-white/5 rounded-lg p-2.5 overflow-auto shrink-0 select-text font-mono text-[9.5px]">
        <div className="text-white/40 border-b border-white/5 pb-1 mb-1 tracking-widest text-[8px] uppercase">
          {selectedLanguage.label.toUpperCase()} TERMINAL OUTPUT
        </div>
        <div className="text-[#00e5ff] whitespace-pre-wrap leading-relaxed">
          {output || 'Awaiting program triggers... Pick a language and click RUN CODE.'}
        </div>
      </div>
    </div>
  )
}

/* ── SUB-VIEW 3: SMART HOME (IOT) DASHBOARD ── */

interface IotItem {
  ID: string
  'Device Name': string
  Type: string
  'Current State': string
  'Outbound Endpoint': string
}

function IoTTrackerView(): React.JSX.Element {
  const trackerData = useJarvisStore((s) => s.trackerData)
  const sendWsMessage = useJarvisStore((s) => s.sendWsMessage)
  
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState('light')
  const [newEndpoint, setNewEndpoint] = useState('')

  const devices = parseMarkdownTable(trackerData['IOT']) as unknown as IotItem[]

  const handleToggle = (id: string, name: string): void => {
    audioEngine.playClick()
    sendWsMessage('run_tool', { tag: 'IOT', content: `toggle|${id}` })
    setTimeout(() => {
      sendWsMessage('run_tool', { tag: 'IOT', content: 'list' })
    }, 500)
  }

  const handleAddDevice = (e: React.FormEvent): void => {
    e.preventDefault()
    if (newName.trim()) {
      audioEngine.playClick()
      sendWsMessage('run_tool', { tag: 'IOT', content: `add|${newName.trim()}|${newType}|${newEndpoint.trim()}` })
      setNewName('')
      setNewEndpoint('')
      setTimeout(() => {
        sendWsMessage('run_tool', { tag: 'IOT', content: 'list' })
      }, 500)
    }
  }

  return (
    <div className="space-y-4 font-mono text-[9px]">
      <div className="panel-luxury p-3 space-y-3">
        <span className="text-white/80 font-bold">🏠 SMART HOME CONTROL PANEL</span>
        
        {devices.length === 0 ? (
          <div className="text-white/40 text-center py-4">No registered IoT devices.</div>
        ) : (
          <div className="grid grid-cols-1 gap-2.5">
            {devices.map((dev) => {
              const isOn = dev['Current State'] === 'ON'
              return (
                <div key={dev.ID} className="flex justify-between items-center p-2.5 border border-white/5 bg-white/5 rounded-md hover:border-white/10 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{dev.Type === 'light' ? '💡' : dev.Type === 'plug' ? '🔌' : '🌡️'}</span>
                    <div>
                      <div className="text-white font-bold">{dev['Device Name']}</div>
                      <div className="text-[7.5px] text-white/55 uppercase">{dev.Type} // ID:{dev.ID}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggle(dev.ID, dev['Device Name'])}
                    className={`px-3 py-1 rounded border transition-all cursor-pointer font-bold tracking-wider ${
                      isOn 
                        ? 'border-[#00e5ff]/50 bg-[#00e5ff]/10 text-[#00e5ff] shadow-[0_0_8px_rgba(0,229,255,0.15)]' 
                        : 'border-white/10 text-white/40 hover:text-white'
                    }`}
                  >
                    {dev['Current State']}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <form onSubmit={handleAddDevice} className="panel-luxury p-3 space-y-2">
        <span className="text-white/70 font-semibold uppercase">Register New Device</span>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            placeholder="Device Name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="bg-black/30 border border-white/10 rounded px-2.5 py-1.5 focus:outline-none focus:border-[#00e5ff]/30 text-white"
          />
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
            className="bg-black/30 border border-white/10 rounded px-2 py-1.5 focus:outline-none focus:border-[#00e5ff]/30 text-white"
          >
            <option value="light">Light</option>
            <option value="plug">Smart Plug</option>
            <option value="thermostat">Thermostat</option>
          </select>
        </div>
        <input
          type="text"
          placeholder="Endpoint URL (Optional)..."
          value={newEndpoint}
          onChange={(e) => setNewEndpoint(e.target.value)}
          className="w-full bg-black/30 border border-white/10 rounded px-2.5 py-1.5 focus:outline-none focus:border-[#00e5ff]/30 text-white"
        />
        <button
          type="submit"
          className="w-full py-1.5 border border-[#00e5ff]/30 hover:border-[#00e5ff] text-[#00e5ff] rounded hover:bg-[#00e5ff]/5 transition-all cursor-pointer font-semibold uppercase"
        >
          Register IoT Node
        </button>
      </form>
    </div>
  )
}

/* ── SUB-VIEW 4: FINANCE BUDGET & PORTFOLIO ── */

interface CryptoItem {
  Symbol: string
  Holdings: string
  'Live Price': string
  'Total Value (USD)': string
  Category?: string
  Spent?: string
  Percentage?: string
}

function FinanceTrackerView(): React.JSX.Element {
  const trackerData = useJarvisStore((s) => s.trackerData)
  const sendWsMessage = useJarvisStore((s) => s.sendWsMessage)
  
  const [expenseAmt, setExpenseAmt] = useState('')
  const [expenseCat, setExpenseCat] = useState('Food')
  const [expenseDesc, setExpenseDesc] = useState('')

  const [cryptoSym, setCryptoSym] = useState('BTC')
  const [cryptoAmt, setCryptoAmt] = useState('')

  const cryptoRows = parseMarkdownTable(trackerData['FINANCE']) as unknown as CryptoItem[]

  const isPortfolioTable = (row: any) => row['Symbol'] !== undefined
  const portfolio = cryptoRows.filter(isPortfolioTable)
  const expensesSummary = cryptoRows.filter(row => row['Category'] !== undefined)

  const handleAddExpense = (e: React.FormEvent): void => {
    e.preventDefault()
    if (expenseAmt) {
      audioEngine.playClick()
      sendWsMessage('run_tool', { tag: 'FINANCE', content: `add_expense|${expenseAmt}|${expenseCat}|${expenseDesc}` })
      setExpenseAmt('')
      setExpenseDesc('')
      setTimeout(() => {
        sendWsMessage('run_tool', { tag: 'FINANCE', content: 'summary' })
      }, 500)
    }
  }

  const handleAddCrypto = (e: React.FormEvent): void => {
    e.preventDefault()
    if (cryptoSym && cryptoAmt) {
      audioEngine.playClick()
      sendWsMessage('run_tool', { tag: 'FINANCE', content: `add_crypto|${cryptoSym}|${cryptoAmt}` })
      setCryptoAmt('')
      setTimeout(() => {
        sendWsMessage('run_tool', { tag: 'FINANCE', content: 'portfolio' })
      }, 500)
    }
  }

  return (
    <div className="space-y-4 font-mono text-[9px]">
      <div className="panel-luxury p-3 space-y-3">
        <span className="text-white/80 font-bold">💸 BUDGET SPENDING GRADIENTS</span>
        {expensesSummary.length === 0 ? (
          <div className="text-white/40 text-center py-2">No expenses tracked.</div>
        ) : (
          <div className="space-y-2">
            {expensesSummary.map((item, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between text-white/70">
                  <span>{item.Category}</span>
                  <span className="font-semibold text-cyan-300">{item.Spent}</span>
                </div>
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-[#00e5ff]"
                    style={{ width: item.Percentage || '10%' }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="panel-luxury p-3 space-y-2">
        <span className="text-white/80 font-bold">🪙 CRYPTO PORTFOLIO STACKS</span>
        {portfolio.length === 0 ? (
          <div className="text-white/40 text-center py-2">No crypto portfolio logged.</div>
        ) : (
          <div className="space-y-2">
            {portfolio.map((coin, idx) => (
              <div key={idx} className="flex justify-between items-center p-2 border border-white/5 bg-white/5 rounded">
                <div>
                  <span className="text-white font-bold">{coin.Symbol}</span>
                  <span className="text-[7.5px] text-white/50 ml-2">Qty: {coin.Holdings}</span>
                </div>
                <div className="text-right">
                  <div className="text-[#00e5ff] font-bold">{coin['Total Value (USD)']}</div>
                  <div className="text-[7px] text-white/40">@{coin['Live Price']}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <form onSubmit={handleAddExpense} className="panel-luxury p-3 space-y-2">
          <span className="text-white/70 font-semibold uppercase text-[8px]">LOG EXPENSE</span>
          <input
            type="number"
            placeholder="Amount ($)..."
            value={expenseAmt}
            onChange={(e) => setExpenseAmt(e.target.value)}
            className="w-full bg-black/30 border border-white/10 rounded px-2 py-1 focus:outline-none focus:border-[#00e5ff]/30 text-white text-[8px]"
          />
          <select
            value={expenseCat}
            onChange={(e) => setExpenseCat(e.target.value)}
            className="w-full bg-black/30 border border-white/10 rounded px-2 py-1 focus:outline-none focus:border-[#00e5ff]/30 text-white text-[8px]"
          >
            <option value="Food">Food</option>
            <option value="Transport">Transport</option>
            <option value="Utilities">Utilities</option>
            <option value="Entertainment">Entertainment</option>
            <option value="Misc">Miscellaneous</option>
          </select>
          <button
            type="submit"
            className="w-full py-1.5 border border-cyan-500/30 hover:border-cyan-500 text-cyan-400 rounded hover:bg-cyan-500/5 transition-all cursor-pointer font-semibold uppercase text-[8px]"
          >
            ADD
          </button>
        </form>

        <form onSubmit={handleAddCrypto} className="panel-luxury p-3 space-y-2">
          <span className="text-white/70 font-semibold uppercase text-[8px]">ADD CRYPTO HOLDINGS</span>
          <input
            type="text"
            placeholder="Ticker (e.g. BTC)..."
            value={cryptoSym}
            onChange={(e) => setCryptoSym(e.target.value.toUpperCase())}
            className="w-full bg-black/30 border border-white/10 rounded px-2 py-1 focus:outline-none focus:border-[#00e5ff]/30 text-white text-[8px]"
          />
          <input
            type="number"
            step="any"
            placeholder="Amount..."
            value={cryptoAmt}
            onChange={(e) => setCryptoAmt(e.target.value)}
            className="w-full bg-black/30 border border-white/10 rounded px-2 py-1 focus:outline-none focus:border-[#00e5ff]/30 text-white text-[8px]"
          />
          <button
            type="submit"
            className="w-full py-1.5 border border-cyan-500/30 hover:border-cyan-500 text-cyan-400 rounded hover:bg-cyan-500/5 transition-all cursor-pointer font-semibold uppercase text-[8px]"
          >
            ADD
          </button>
        </form>
      </div>
    </div>
  )
}

/* ── SUB-VIEW 5: HEALTH TRACKER & TO-DOS ── */

interface TodoItem {
  ID: string
  'Task Description': string
  Status: string
  'Date Added': string
}

function HealthTrackerView(): React.JSX.Element {
  const trackerData = useJarvisStore((s) => s.trackerData)
  const sendWsMessage = useJarvisStore((s) => s.sendWsMessage)
  
  const [waterLogged, setWaterLogged] = useState(250)
  const [medName, setMedName] = useState('')
  const [newTodo, setNewTodo] = useState('')

  const healthData = trackerData['HEALTH'] || ''
  
  const matchWater = healthData.match(/Today's Water Intake\*\*: (\d+)\s*ml/)
  const currentWater = matchWater ? parseInt(matchWater[1]) : 0
  const waterTarget = 2000
  const waterPercentage = Math.min((currentWater / waterTarget) * 100, 100)

  const parsedTodos = parseMarkdownTable(trackerData['TODO']) as unknown as TodoItem[]

  const handleLogWater = (): void => {
    audioEngine.playClick()
    sendWsMessage('run_tool', { tag: 'HEALTH', content: `log_water|${waterLogged}` })
    setTimeout(() => {
      sendWsMessage('run_tool', { tag: 'HEALTH', content: 'list' })
    }, 500)
  }

  const handleCompleteTodo = (id: string): void => {
    audioEngine.playSuccess()
    sendWsMessage('run_tool', { tag: 'TODO', content: `complete|${id}` })
    setTimeout(() => {
      sendWsMessage('run_tool', { tag: 'TODO', content: 'list' })
    }, 500)
  }

  const handleAddTodo = (e: React.FormEvent): void => {
    e.preventDefault()
    if (newTodo.trim()) {
      audioEngine.playClick()
      sendWsMessage('run_tool', { tag: 'TODO', content: `add|${newTodo.trim()}` })
      setNewTodo('')
      setTimeout(() => {
        sendWsMessage('run_tool', { tag: 'TODO', content: 'list' })
      }, 500)
    }
  }

  return (
    <div className="space-y-4 font-mono text-[9px]">
      <div className="grid grid-cols-2 gap-3">
        <div className="panel-luxury p-3 flex flex-col items-center justify-center space-y-2">
          <span className="text-white/80 font-bold uppercase text-[8px]">💧 WATER CUP INTAKE</span>
          <div className="relative w-16 h-24 border-2 border-white/20 rounded-b-xl overflow-hidden bg-black/10 flex flex-col justify-end">
            <motion.div
              className="w-full bg-[#00e5ff]/50 shadow-[0_0_12px_#00e5ff] rounded-t-sm"
              animate={{ height: `${waterPercentage}%` }}
              transition={{ duration: 1 }}
            />
            <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white font-bold text-[10px] drop-shadow-md">
              {currentWater} ml
            </span>
          </div>
          <div className="flex gap-2">
            <select
              value={waterLogged}
              onChange={(e) => setWaterLogged(parseInt(e.target.value))}
              className="bg-black/30 border border-white/10 rounded px-1 text-[8.5px] text-white"
            >
              <option value={250}>250ml</option>
              <option value={500}>500ml</option>
              <option value={750}>750ml</option>
            </select>
            <button
              onClick={handleLogWater}
              className="px-2 py-0.5 border border-cyan-500/30 hover:border-cyan-500 text-cyan-400 rounded hover:bg-cyan-500/5 transition-all cursor-pointer font-bold text-[8.5px] uppercase"
            >
              LOG
            </button>
          </div>
        </div>

        <div className="panel-luxury p-3 space-y-2 flex flex-col justify-between">
          <span className="text-white/80 font-bold uppercase text-[8px]">💊 HEALTH LOG TIMELINE</span>
          <div className="flex-1 text-[8px] text-white/60 space-y-1.5 max-h-[80px] overflow-auto">
            {healthData.split('Medication History')[1] ? (
              <div className="whitespace-pre-line leading-relaxed font-light font-mono">
                {healthData.split('Medication History')[1].trim()}
              </div>
            ) : (
              <div>No medications logged today.</div>
            )}
          </div>
          
          <div className="border-t border-white/5 pt-2 flex gap-1.5">
            <input
              type="text"
              placeholder="Medication name..."
              value={medName}
              onChange={(e) => setMedName(e.target.value)}
              className="flex-1 bg-black/30 border border-white/10 rounded px-2 py-1 focus:outline-none focus:border-[#00e5ff]/30 text-white text-[8px]"
            />
            <button
              onClick={() => {
                if (medName.trim()) {
                  audioEngine.playClick()
                  sendWsMessage('run_tool', { tag: 'HEALTH', content: `log_medication|${medName.trim()}` })
                  setMedName('')
                  setTimeout(() => {
                    sendWsMessage('run_tool', { tag: 'HEALTH', content: 'list' })
                  }, 500)
                }
              }}
              className="px-2 py-1 border border-cyan-500/30 hover:border-cyan-500 text-cyan-400 rounded text-[8px] font-bold"
            >
              LOG
            </button>
          </div>
        </div>
      </div>

      <div className="panel-luxury p-3 space-y-2">
        <span className="text-white/80 font-bold">📋 DIRECTIVES TO-DO CHECKLIST</span>
        <form onSubmit={handleAddTodo} className="flex gap-2 mb-2">
          <input
            type="text"
            placeholder="New directive directive..."
            value={newTodo}
            onChange={(e) => setNewTodo(e.target.value)}
            className="flex-1 bg-black/30 border border-white/10 rounded px-3 py-1.5 focus:outline-none focus:border-[#00e5ff]/30 text-white text-[8.5px]"
          />
          <button
            type="submit"
            className="px-4 py-1 border border-cyan-500/30 hover:border-cyan-500 text-cyan-400 rounded hover:bg-cyan-500/5 transition-all cursor-pointer font-bold text-[8.5px] uppercase"
          >
            ADD
          </button>
        </form>

        <div className="space-y-1.5 max-h-[110px] overflow-auto">
          {parsedTodos.length === 0 ? (
            <div className="text-white/40 text-center py-2">No pending directives.</div>
          ) : (
            parsedTodos.map((todo) => {
              const isCompleted = todo.Status.includes('Completed')
              return (
                <div key={todo.ID} className="flex justify-between items-center p-2 border border-white/5 bg-white/5 rounded-md hover:bg-white/10 transition-colors">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => !isCompleted && handleCompleteTodo(todo.ID)}
                      className={`w-3.5 h-3.5 rounded border flex items-center justify-center cursor-pointer transition-colors ${
                        isCompleted ? 'border-emerald-500 bg-emerald-500 text-black' : 'border-white/20 hover:border-[#00e5ff]'
                      }`}
                    >
                      {isCompleted && <span className="text-[7px]">✓</span>}
                    </button>
                    <span className={`text-white/80 font-medium ${isCompleted ? 'line-through text-white/30' : ''}`}>
                      {todo['Task Description']}
                    </span>
                  </div>
                  <span className="text-[7px] text-white/30">{todo['Date Added']}</span>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

/* ── SUB-VIEW 6: DRONE ROBOTICS SIMULATOR ── */

function DroneSimulatorView(): React.JSX.Element {
  const [altitude, setAltitude] = useState(0)
  const [droneState, setDroneState] = useState<'STANDBY' | 'FLYING' | 'LANDING'>('STANDBY')
  const [flightLog, setFlightLog] = useState<string[]>([])
  
  const [flyX, setFlyX] = useState('10')
  const [flyY, setFlyY] = useState('20')
  const [flyZ, setFlyZ] = useState('15')

  const trackerData = useJarvisStore((s) => s.trackerData)
  const sendWsMessage = useJarvisStore((s) => s.sendWsMessage)

  const handleDroneAction = (action: string, params: string = ''): void => {
    audioEngine.playClick()
    if (action === 'takeoff') {
      setDroneState('FLYING')
      setAltitude(10)
    } else if (action === 'land') {
      setDroneState('LANDING')
      setTimeout(() => {
        setAltitude(0)
        setDroneState('STANDBY')
      }, 2000)
    }
    sendWsMessage('run_tool', { tag: 'ROBOTICS', content: `drone|${action}|${params}` })
  }

  useEffect(() => {
    if (trackerData['ROBOTICS']) {
      setFlightLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${trackerData['ROBOTICS']}`].slice(-10))
    }
  }, [trackerData['ROBOTICS']])

  return (
    <div className="space-y-4 font-mono text-[9px]">
      <div className="panel-luxury p-3 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-white/80 font-bold uppercase">🚁 DRONE TELEMETRY HUD</span>
          <span className={`px-2 py-0.5 rounded font-bold text-[8px] ${
            droneState === 'FLYING' ? 'bg-[#00e5ff]/20 text-[#00e5ff] animate-pulse' : 'bg-white/10 text-white/50'
          }`}>{droneState}</span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2 border-r border-white/5 pr-4 flex flex-col justify-center">
            <div className="flex justify-between">
              <span className="text-white/50">ALTITUDE GAUGE</span>
              <span className="text-[#00e5ff] font-bold">{altitude}m</span>
            </div>
            <div className="h-2 w-full bg-white/5 rounded border border-white/10 overflow-hidden relative">
              <motion.div
                className="h-full bg-[#00e5ff]"
                animate={{ width: `${(altitude / 30) * 100}%` }}
              />
            </div>
          </div>

          <div className="space-y-2 flex flex-col justify-center">
            <button
              onClick={() => handleDroneAction('takeoff')}
              disabled={droneState !== 'STANDBY'}
              className="w-full py-1.5 border border-emerald-500/30 hover:border-emerald-500 bg-emerald-950/10 hover:bg-emerald-950/20 text-emerald-400 rounded font-bold uppercase cursor-pointer"
            >
              LAUNCH DRONE
            </button>
            <button
              onClick={() => handleDroneAction('land')}
              disabled={droneState !== 'FLYING'}
              className="w-full py-1.5 border border-red-500/30 hover:border-red-500 bg-red-950/10 hover:bg-red-950/20 text-red-400 rounded font-bold uppercase cursor-pointer"
            >
              LAND DRONE
            </button>
          </div>
        </div>
      </div>

      <div className="panel-luxury p-3 space-y-2">
        <span className="text-white/70 font-semibold uppercase text-[8px]">NAVIGATE TO WAYPOINT COORDINATES</span>
        <div className="grid grid-cols-3 gap-2">
          <input
            type="number"
            placeholder="X..."
            value={flyX}
            onChange={(e) => setFlyX(e.target.value)}
            className="bg-black/30 border border-white/10 rounded px-2 py-1.5 text-center text-white"
          />
          <input
            type="number"
            placeholder="Y..."
            value={flyY}
            onChange={(e) => setFlyY(e.target.value)}
            className="bg-black/30 border border-white/10 rounded px-2 py-1.5 text-center text-white"
          />
          <input
            type="number"
            placeholder="Z (Alt)..."
            value={flyZ}
            onChange={(e) => setFlyZ(e.target.value)}
            className="bg-black/30 border border-white/10 rounded px-2 py-1.5 text-center text-white"
          />
        </div>
        <button
          onClick={() => {
            setAltitude(parseInt(flyZ))
            handleDroneAction('fly_to', `${flyX}|${flyY}|${flyZ}`)
          }}
          disabled={droneState !== 'FLYING'}
          className="w-full py-1.5 border border-[#00e5ff]/30 hover:border-[#00e5ff] text-[#00e5ff] rounded hover:bg-[#00e5ff]/5 transition-all cursor-pointer font-semibold uppercase"
        >
          EXECUTE WAYPOINT FLIGHT
        </button>
      </div>

      <div className="h-24 bg-black/60 border border-white/5 rounded-lg p-2 overflow-auto text-[8.5px] leading-relaxed">
        <div className="text-white/40 border-b border-white/5 pb-1 mb-1 tracking-widest text-[7.5px] uppercase">FLIGHT RECORDER DATA</div>
        <div className="space-y-1">
          {flightLog.length === 0 ? (
            <div className="text-white/20">Telemetry logs awaiting launch...</div>
          ) : (
            flightLog.map((log, idx) => (
              <div key={idx} className="text-[#00e5ff] whitespace-pre-wrap">{log}</div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

/* ── SUB-VIEW 7: GIT & DOCKER DEVOPS OPERATOR ── */

function GitDockerDashboardView(): React.JSX.Element {
  const trackerData = useJarvisStore((s) => s.trackerData)
  const sendWsMessage = useJarvisStore((s) => s.sendWsMessage)
  
  const [activeConsole, setActiveConsole] = useState<'GIT' | 'DOCKER'>('GIT')
  const [customCmd, setCustomCmd] = useState('')
  const [consoleLog, setConsoleLog] = useState('')
  const [executing, setExecuting] = useState(false)

  const triggerDevopsCommand = (tag: 'GIT' | 'DOCKER', action: string, args: string = ''): void => {
    audioEngine.playClick()
    setExecuting(true)
    setConsoleLog(`[DevOps System] Executing command: ${tag.toLowerCase()} ${action} ${args}...\n`)
    sendWsMessage('run_tool', { tag, content: `${action}|${args}` })
  }

  useEffect(() => {
    if (executing) {
      if (activeConsole === 'GIT' && trackerData['GIT']) {
        setConsoleLog((prev) => prev + trackerData['GIT'])
        setExecuting(false)
      } else if (activeConsole === 'DOCKER' && trackerData['DOCKER']) {
        setConsoleLog((prev) => prev + trackerData['DOCKER'])
        setExecuting(false)
      }
    }
  }, [trackerData['GIT'], trackerData['DOCKER']])

  return (
    <div className="h-full flex flex-col gap-3 font-mono text-[9px] min-h-0">
      <div className="flex justify-between items-center shrink-0">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveConsole('GIT')}
            className={`px-3 py-1 rounded border transition-all cursor-pointer font-bold ${
              activeConsole === 'GIT' ? 'border-[#00e5ff]/40 bg-[#00e5ff]/10 text-[#00e5ff]' : 'border-transparent text-white/50'
            }`}
          >
            GIT CORE
          </button>
          <button
            onClick={() => setActiveConsole('DOCKER')}
            className={`px-3 py-1 rounded border transition-all cursor-pointer font-bold ${
              activeConsole === 'DOCKER' ? 'border-[#00e5ff]/40 bg-[#00e5ff]/10 text-[#00e5ff]' : 'border-transparent text-white/50'
            }`}
          >
            DOCKER DAEMON
          </button>
        </div>
      </div>

      <div className="panel-luxury p-3 space-y-2 shrink-0">
        <span className="text-white/80 font-bold uppercase">{activeConsole} OPERATIONAL TRIGGERS</span>
        <div className="grid grid-cols-2 gap-2">
          {activeConsole === 'GIT' ? (
            <>
              <button
                onClick={() => triggerDevopsCommand('GIT', 'status')}
                className="py-1.5 border border-white/10 hover:border-white/20 bg-white/5 text-white/80 rounded uppercase font-bold cursor-pointer"
              >
                git status
              </button>
              <button
                onClick={() => triggerDevopsCommand('GIT', 'log')}
                className="py-1.5 border border-white/10 hover:border-white/20 bg-white/5 text-white/80 rounded uppercase font-bold cursor-pointer"
              >
                git log
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => triggerDevopsCommand('DOCKER', 'ps')}
                className="py-1.5 border border-white/10 hover:border-white/20 bg-white/5 text-white/80 rounded uppercase font-bold cursor-pointer"
              >
                docker ps
              </button>
              <button
                onClick={() => triggerDevopsCommand('DOCKER', 'images')}
                className="py-1.5 border border-white/10 hover:border-white/20 bg-white/5 text-white/80 rounded uppercase font-bold cursor-pointer"
              >
                docker images
              </button>
            </>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (customCmd.trim()) {
              const parts = customCmd.split(' ')
              const action = parts[0]
              const args = parts.slice(1).join(' ')
              triggerDevopsCommand(activeConsole, action, args)
              setCustomCmd('')
            }
          }}
          className="flex gap-2 pt-2 border-t border-white/5"
        >
          <input
            type="text"
            placeholder={`Execute custom ${activeConsole.toLowerCase()} command...`}
            value={customCmd}
            onChange={(e) => setCustomCmd(e.target.value)}
            className="flex-1 bg-black/30 border border-white/10 rounded px-2.5 py-1 focus:outline-none focus:border-[#00e5ff]/35 text-white text-[8.5px]"
          />
          <button
            type="submit"
            className="px-3 py-1 border border-cyan-500/30 hover:border-cyan-500 text-cyan-400 rounded uppercase font-bold"
          >
            EXEC
          </button>
        </form>
      </div>

      <div className="flex-1 bg-black/60 border border-white/5 rounded-lg p-2.5 overflow-auto select-text font-mono text-[9px]">
        <div className="text-white/40 border-b border-white/5 pb-1 mb-1 tracking-widest text-[7.5px] uppercase">DEVOPS TERMINAL CONSOLE</div>
        <div className="text-[#00e5ff] whitespace-pre-wrap leading-relaxed">
          {consoleLog || 'Console terminal standing by...'}
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════ PRESENTATIONS TAB ═══════════════════ */

function PptDesignView(): React.JSX.Element {
  const [activeMode, setActiveMode] = useState<'generate' | 'restyle'>('generate')
  const [topic, setTopic] = useState('')
  const [slideCount, setSlideCount] = useState(6)
  const [fontKey, setFontKey] = useState('segoe-ui')
  const [layoutKey, setLayoutKey] = useState('neon-dark')
  const [customInstructions, setCustomInstructions] = useState('')
  const [learning, setLearning] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [restyling, setRestyling] = useState(false)
  const [selectedFilePath, setSelectedFilePath] = useState('')
  const [selectedFileName, setSelectedFileName] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const pendingRequestId = useRef<string | null>(null)
  const sendWsMessage = useJarvisStore((s) => s.sendWsMessage)
  const lastToolResult = useJarvisStore((s) => s.lastToolResult)
  const connectionStatus = useJarvisStore((s) => s.connectionStatus)

  const fontOptions = [
    { key: 'segoe-ui', label: 'Segoe UI' },
    { key: 'inter', label: 'Inter' },
    { key: 'poppins', label: 'Poppins' },
    { key: 'montserrat', label: 'Montserrat' },
    { key: 'raleway', label: 'Raleway' },
    { key: 'playfair', label: 'Playfair Display + Lato' },
    { key: 'roboto', label: 'Roboto' },
    { key: 'oswald', label: 'Oswald + Open Sans' },
    { key: 'bebas-garamond', label: 'Bebas Neue + Garamond' },
    { key: 'outfit', label: 'Outfit' },
  ]

  const layoutOptions = [
    { key: 'neon-dark', label: 'Neon Dark', color: '#00e5ff' },
    { key: 'midnight-purple', label: 'Midnight Purple', color: '#a855f7' },
    { key: 'arctic-frost', label: 'Arctic Frost', color: '#38bdf8' },
    { key: 'ember-gold', label: 'Ember Gold', color: '#f59e0b' },
    { key: 'emerald-depth', label: 'Emerald Depth', color: '#10b981' },
    { key: 'coral-sunset', label: 'Coral Sunset', color: '#fb7185' },
    { key: 'clean-white', label: 'Clean White', color: '#1e40af' },
    { key: 'graphite-steel', label: 'Graphite Steel', color: '#9ca3af' },
    { key: 'rose-elegance', label: 'Rose Elegance', color: '#f472b6' },
    { key: 'ocean-breeze', label: 'Ocean Breeze', color: '#06b6d4' },
    { key: 'crystal-clear', label: 'Crystal Clear (Premium)', color: '#4f46e5' },
    { key: 'royal-velvet', label: 'Royal Velvet (Premium)', color: '#d4af37' },
    { key: 'neon-cyber', label: 'Neon Cyber (Premium)', color: '#ff00ff' },
    { key: 'forest-canopy', label: 'Forest Canopy (Premium)', color: '#4ade80' },
    { key: 'sunset-blaze', label: 'Sunset Blaze (Premium)', color: '#ff6b35' },
    { key: 'glass-ocean', label: 'Glass Ocean (Style)', color: '#0ea5e9' },
    { key: 'glass-ruby', label: 'Glass Ruby (Style)', color: '#e11d48' },
    { key: 'glass-emerald', label: 'Glass Emerald (Style)', color: '#10b981' },
    { key: 'glass-amethyst', label: 'Glass Amethyst (Style)', color: '#8b5cf6' },
    { key: 'matte-charcoal', label: 'Matte Charcoal (Style)', color: '#121212' },
    { key: 'matte-cream', label: 'Matte Cream (Style)', color: '#faf9f6' },
    { key: 'holographic-pearl', label: 'Holographic Pearl (Style)', color: '#ff9ecd' },
    { key: 'cyber-punk', label: 'Cyber Punk (Style)', color: '#fde047' },
    { key: 'neo-brutalism', label: 'Neo Brutalism (Style)', color: '#ef4444' },
    { key: 'luxury-gold', label: 'Luxury Gold (Style)', color: '#d4af37' },
    { key: 'claymorphism', label: 'Claymorphism (Morphism)', color: '#f472b6' },
    { key: 'neumorphism', label: 'Neumorphism (Morphism)', color: '#3b82f6' },
    { key: 'bauhaus', label: 'Bauhaus (Morphism)', color: '#facc15' },
    { key: 'aurora-mesh', label: 'Aurora Mesh (Morphism)', color: '#c084fc' },
    { key: 'memphis', label: 'Memphis Design (Morphism)', color: '#34d399' },
    { key: 'glitch-cyber', label: 'Glitch Cyberpunk (Morphism)', color: '#00ffff' },
    { key: 'dark-academia', label: 'Dark Academia (Morphism)', color: '#27272a' },
    { key: 'y2k-retro', label: 'Y2K Retro (Morphism)', color: '#d946ef' },
    { key: 'minimalist-editorial', label: 'Minimalist Editorial (Morphism)', color: '#ffffff' },
    { key: 'holo-glass', label: 'Holographic Glass (Morphism)', color: '#eef2ff' },
  ]

  const handleLearnTrends = async (): Promise<void> => {
    audioEngine.playClick()
    setLearning(true)
    setStatus('Scanning 8+ social media platforms (Reddit, YouTube, Twitter, Instagram, Threads, Pinterest, Dribbble, Behance)...')
    try {
      sendWsMessage('run_tool', { tag: 'PPT', content: 'learn' })
      setTimeout(() => {
        setLearning(false)
        setStatus('Multi-platform trend intelligence scan complete. Design cache updated with latest styles.')
      }, 8000)
    } catch (e) {
      setLearning(false)
      setStatus('Trend scan failed.')
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFileName(file.name)
      const filePath = (file as any).path || ''
      setSelectedFilePath(filePath)
      audioEngine.playClick()
    }
  }

  const handleGenerateDeck = (): void => {
    if (!topic.trim()) return
    if (connectionStatus !== 'connected') {
      setStatus('Error: Backend is not connected. Start the Jarvis backend and try again.')
      return
    }
    audioEngine.playClick()
    const requestId = crypto.randomUUID()
    pendingRequestId.current = requestId
    setGenerating(true)
    setStatus(`Planning ${slideCount} slides with ${layoutOptions.find(l => l.key === layoutKey)?.label} theme... PowerPoint will build live on your desktop.`)
    const payload = `generate|${topic.trim()}|${slideCount}|${fontKey}|${layoutKey}|${customInstructions.trim()}`
    sendWsMessage('run_tool', { tag: 'PPT', content: payload, requestId })
  }

  const handleRestyleDeck = (): void => {
    if (!selectedFilePath) return
    if (connectionStatus !== 'connected') {
      setStatus('Error: Backend is not connected. Start the Jarvis backend and try again.')
      return
    }
    audioEngine.playClick()
    const requestId = crypto.randomUUID()
    pendingRequestId.current = requestId
    setRestyling(true)
    setStatus(`Restyling presentation: ${selectedFileName} with ${layoutOptions.find(l => l.key === layoutKey)?.label} theme...`)
    const payload = `restyle|${selectedFilePath}|${fontKey}|${layoutKey}`
    sendWsMessage('run_tool', { tag: 'PPT', content: payload, requestId })
  }

  useEffect(() => {
    if ((!generating && !restyling) || !pendingRequestId.current || !lastToolResult) return
    if (lastToolResult.requestId !== pendingRequestId.current) return
    if (lastToolResult.tag !== 'PPT') return

    const resultText = lastToolResult.error
      ? `Error: ${lastToolResult.error}`
      : lastToolResult.result

    setGenerating(false)
    setRestyling(false)
    setStatus(resultText || 'Operation complete.')
    pendingRequestId.current = null
  }, [lastToolResult, generating, restyling])

  useEffect(() => {
    if (!generating && !restyling) return
    const timeout = window.setTimeout(() => {
      if (pendingRequestId.current) {
        setGenerating(false)
        setRestyling(false)
        setStatus('Operation timed out. Ensure the local LLM/PowerPoint environment is ready.')
        pendingRequestId.current = null
      }
    }, 600000)

    return () => window.clearTimeout(timeout)
  }, [generating, restyling])

  const selectedLayoutColor = layoutOptions.find(l => l.key === layoutKey)?.color || '#00e5ff'

  return (
    <div className="space-y-4 text-white/90">
      {/* Header */}
      <div
        className="border p-4 rounded-xl backdrop-blur-md relative overflow-hidden"
        style={{ borderColor: `${selectedLayoutColor}33`, backgroundColor: `${selectedLayoutColor}0d` }}
      >
        <h4 className="font-mono text-xs tracking-widest uppercase mb-1 flex items-center gap-1.5" style={{ color: selectedLayoutColor }}>
          <span>📊</span> ASTRYX DECK STUDIO
        </h4>
        <p className="text-[11px] text-white/50 leading-relaxed font-light">
          Generate or restyle widescreen presentations live inside Microsoft PowerPoint with modern layouts, custom fonts, color themes, animations, transitions, and Unsplash imagery — powered by AI trend intelligence.
        </p>
      </div>

      {/* Mode Tabs */}
      <div className="flex gap-2 border-b border-white/5 pb-2">
        <button
          onClick={() => { audioEngine.playClick(); setActiveMode('generate') }}
          className={`flex-1 py-2 font-mono text-[9px] tracking-wider rounded border transition-all cursor-pointer ${
            activeMode === 'generate'
              ? 'border-[#00e5ff]/35 bg-[#00e5ff]/10 text-[#00e5ff] font-semibold shadow-[0_0_8px_rgba(0,229,255,0.15)]'
              : 'border-transparent text-white/40 hover:text-white hover:bg-white/5'
          }`}
          style={{ borderColor: activeMode === 'generate' ? `${selectedLayoutColor}60` : undefined, color: activeMode === 'generate' ? selectedLayoutColor : undefined }}
        >
          ⚡ GENERATE NEW DECK
        </button>
        <button
          onClick={() => { audioEngine.playClick(); setActiveMode('restyle') }}
          className={`flex-1 py-2 font-mono text-[9px] tracking-wider rounded border transition-all cursor-pointer ${
            activeMode === 'restyle'
              ? 'border-[#00e5ff]/35 bg-[#00e5ff]/10 text-[#00e5ff] font-semibold shadow-[0_0_8px_rgba(0,229,255,0.15)]'
              : 'border-transparent text-white/40 hover:text-white hover:bg-white/5'
          }`}
          style={{ borderColor: activeMode === 'restyle' ? `${selectedLayoutColor}60` : undefined, color: activeMode === 'restyle' ? selectedLayoutColor : undefined }}
        >
          🎨 RESTYLE EXISTING DECK
        </button>
      </div>

      {/* Trend Crawler */}
      <div className="border border-white/5 bg-black/30 p-4 rounded-xl space-y-3">
        <div className="flex justify-between items-center">
          <span className="font-mono text-[10px] text-white/40 tracking-wider">TREND INTELLIGENCE ENGINE</span>
          <button
            onClick={handleLearnTrends}
            disabled={learning}
            className={`px-3 py-1.5 font-mono text-[9px] tracking-widest rounded border transition-all cursor-pointer ${
              learning
                ? 'border-white/10 text-white/30 bg-white/5 cursor-not-allowed animate-pulse'
                : 'border-[#00e5ff]/30 bg-[#00e5ff]/5 text-[#00e5ff] hover:bg-[#00e5ff]/10 hover:border-[#00e5ff]'
            }`}
            onMouseEnter={() => audioEngine.playHover()}
          >
            {learning ? '⟳ SCANNING...' : '🔍 CRAWL TRENDS'}
          </button>
        </div>
        <p className="text-[10px] text-white/40 font-light leading-relaxed">
          Scans Reddit, YouTube, Twitter/X, Instagram, Threads, Pinterest, Dribbble, and Behance for the latest presentation design trends.
        </p>
      </div>

      {/* Configuration Panel */}
      <div className="border border-white/5 bg-black/30 p-4 rounded-xl space-y-4">
        <span className="font-mono text-[10px] text-white/40 tracking-wider block">DECK CONFIGURATION</span>

        {activeMode === 'generate' ? (
          <>
            {/* Topic */}
            <div className="space-y-1.5">
              <label className="font-mono text-[9px] text-white/40 tracking-wider">PRESENTATION TOPIC</label>
              <input
                type="text"
                placeholder="e.g. Artificial Intelligence in 2026"
                value={topic}
                onChange={(e) => {
                  setTopic(e.target.value)
                  audioEngine.playKeyboardTyping()
                }}
                className="w-full bg-black/30 border border-white/10 rounded-lg p-2.5 text-[13px] text-white font-light focus:outline-none focus:border-[#00e5ff]/50 transition-all placeholder-white/20"
              />
            </div>

            {/* Slide Count & Font — side by side */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="font-mono text-[9px] text-white/40 tracking-wider">SLIDES</label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setSlideCount(Math.max(3, slideCount - 1)); audioEngine.playClick() }}
                    className="w-8 h-8 flex items-center justify-center rounded border border-white/10 bg-black/40 text-white/60 hover:border-[#00e5ff]/40 hover:text-[#00e5ff] transition-all cursor-pointer text-sm font-bold"
                    onMouseEnter={() => audioEngine.playHover()}
                  >−</button>
                  <span className="font-mono text-lg text-white/90 min-w-[28px] text-center">{slideCount}</span>
                  <button
                    onClick={() => { setSlideCount(Math.min(35, slideCount + 1)); audioEngine.playClick() }}
                    className="w-8 h-8 flex items-center justify-center rounded border border-white/10 bg-black/40 text-white/60 hover:border-[#00e5ff]/40 hover:text-[#00e5ff] transition-all cursor-pointer text-sm font-bold"
                    onMouseEnter={() => audioEngine.playHover()}
                  >+</button>
                </div>
                <span className="font-mono text-[8px] text-white/25">3 — 35 slides</span>
              </div>

              <div className="space-y-1.5">
                <label className="font-mono text-[9px] text-white/40 tracking-wider">FONT FAMILY</label>
                <select
                  value={fontKey}
                  onChange={(e) => { setFontKey(e.target.value); audioEngine.playClick() }}
                  className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-[12px] text-white/80 focus:outline-none focus:border-[#00e5ff]/50 transition-all cursor-pointer appearance-none"
                  style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23666\' stroke-width=\'2\'%3E%3Cpath d=\'M6 9l6 6 6-6\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}
                >
                  {fontOptions.map(f => (
                    <option key={f.key} value={f.key} style={{ background: '#111', color: '#eee' }}>{f.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* File selection drop area */}
            <div className="space-y-1.5">
              <label className="font-mono text-[9px] text-white/40 tracking-wider">UPLOAD PRESENTATION FILE (.pptx / .ppt)</label>
              <div className="relative group border border-dashed border-white/20 hover:border-[#00e5ff]/40 rounded-xl p-6 bg-black/20 text-center transition-all">
                <input
                  type="file"
                  accept=".pptx,.ppt"
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                />
                <div className="space-y-2 pointer-events-none">
                  <span className="text-2xl block">📁</span>
                  {selectedFileName ? (
                    <div>
                      <span className="text-[11px] font-bold text-white tracking-wide block truncate">{selectedFileName}</span>
                      <span className="text-[8px] text-[#00e5ff]/60 font-mono tracking-widest block uppercase mt-0.5">READY TO RESTYLE</span>
                      <span className="text-[6.5px] text-white/30 font-mono block mt-1 truncate">{selectedFilePath}</span>
                    </div>
                  ) : (
                    <div>
                      <span className="text-[10px] text-white/70 block">DRAG & DROP OR CLICK TO CHOOSE</span>
                      <span className="text-[8px] text-white/30 block mt-1 font-mono">SUPPORTED FORMATS: .PPTX, .PPT</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Font family for restyle */}
            <div className="space-y-1.5">
              <label className="font-mono text-[9px] text-white/40 tracking-wider">TARGET FONT FAMILY</label>
              <select
                value={fontKey}
                onChange={(e) => { setFontKey(e.target.value); audioEngine.playClick() }}
                className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-[12px] text-white/80 focus:outline-none focus:border-[#00e5ff]/50 transition-all cursor-pointer appearance-none"
                style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23666\' stroke-width=\'2\'%3E%3Cpath d=\'M6 9l6 6 6-6\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}
              >
                {fontOptions.map(f => (
                  <option key={f.key} value={f.key} style={{ background: '#111', color: '#eee' }}>{f.label}</option>
                ))}
              </select>
            </div>
          </>
        )}

        {/* Layout Style */}
        <div className="space-y-2">
          <label className="font-mono text-[9px] text-white/40 tracking-wider">COLOR THEME</label>
          <div className="grid grid-cols-5 gap-2">
            {layoutOptions.map(l => (
              <button
                key={l.key}
                onClick={() => { setLayoutKey(l.key); audioEngine.playClick() }}
                onMouseEnter={() => audioEngine.playHover()}
                className={`group relative flex flex-col items-center gap-1 p-2 rounded-lg border transition-all cursor-pointer ${
                  layoutKey === l.key
                    ? 'border-white/40 bg-white/10 shadow-[0_0_12px_rgba(255,255,255,0.06)]'
                    : 'border-white/5 bg-black/20 hover:border-white/15 hover:bg-black/30'
                }`}
                title={l.label}
              >
                <div
                  className="w-5 h-5 rounded-full border border-white/10 transition-transform group-hover:scale-110"
                  style={{ backgroundColor: l.color, boxShadow: layoutKey === l.key ? `0 0 8px ${l.color}60` : 'none' }}
                />
                <span className="font-mono text-[7px] text-white/40 leading-none text-center truncate w-full">
                  {l.label.split(' ')[0]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Custom Instructions */}
        {activeMode === 'generate' && (
          <div className="space-y-1.5">
            <label className="font-mono text-[9px] text-white/40 tracking-wider">CUSTOM INSTRUCTIONS <span className="text-white/20">(optional)</span></label>
            <textarea
              placeholder="e.g. Focus on market data, include a comparison slide, use minimalist bullet points..."
              value={customInstructions}
              onChange={(e) => {
                setCustomInstructions(e.target.value)
                audioEngine.playKeyboardTyping()
              }}
              rows={2}
              className="w-full bg-black/30 border border-white/10 rounded-lg p-2.5 text-[12px] text-white/80 font-light focus:outline-none focus:border-[#00e5ff]/50 transition-all resize-none placeholder-white/15"
            />
          </div>
        )}

        {/* Action Button */}
        {activeMode === 'generate' ? (
          <button
            onClick={handleGenerateDeck}
            disabled={generating || !topic.trim()}
            className={`w-full py-3 font-mono text-[10px] tracking-[0.2em] rounded-lg border transition-all cursor-pointer font-bold ${
              generating || !topic.trim()
                ? 'border-white/10 text-white/30 bg-white/5 cursor-not-allowed'
                : 'text-white hover:shadow-lg'
            }`}
            style={
              !(generating || !topic.trim())
                ? {
                    borderColor: `${selectedLayoutColor}80`,
                    backgroundColor: `${selectedLayoutColor}1a`,
                    color: selectedLayoutColor,
                    boxShadow: `0 0 20px ${selectedLayoutColor}12`,
                  }
                : undefined
            }
            onMouseEnter={() => audioEngine.playHover()}
          >
            {generating ? '⟳  BUILDING DECK IN POWERPOINT...' : '⚡  GENERATE & PREVIEW IN POWERPOINT'}
          </button>
        ) : (
          <button
            onClick={handleRestyleDeck}
            disabled={restyling || !selectedFilePath}
            className={`w-full py-3 font-mono text-[10px] tracking-[0.2em] rounded-lg border transition-all cursor-pointer font-bold ${
              restyling || !selectedFilePath
                ? 'border-white/10 text-white/30 bg-white/5 cursor-not-allowed'
                : 'text-white hover:shadow-lg'
            }`}
            style={
              !(restyling || !selectedFilePath)
                ? {
                    borderColor: `${selectedLayoutColor}80`,
                    backgroundColor: `${selectedLayoutColor}1a`,
                    color: selectedLayoutColor,
                    boxShadow: `0 0 20px ${selectedLayoutColor}12`,
                  }
                : undefined
            }
            onMouseEnter={() => audioEngine.playHover()}
          >
            {restyling ? '⟳  RESTYLING DECK IN POWERPOINT...' : '🎨  RESTYLE UPLOADED DECK'}
          </button>
        )}
      </div>

      {/* Status */}
      {status && (
        <div className="border border-white/5 bg-black/50 p-3 rounded-lg font-mono text-[10px] leading-relaxed text-left flex gap-2 items-start shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]" style={{ color: `${selectedLayoutColor}cc` }}>
          <span className="select-none animate-pulse" style={{ color: selectedLayoutColor }}>❯</span>
          <span>{status}</span>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════ MEMORY TAB ═══════════════════ */

function MemoryTab(): React.JSX.Element {
  const memory = useJarvisStore((s) => s.memory)

  const isConnected = memory.status === 'connected'
  const isError = memory.status === 'error'

  return (
    <div className="flex flex-col items-center justify-center h-full text-astryx-text-secondary p-4">
      <div className={`w-12 h-12 border rounded-full flex items-center justify-center mb-3 relative overflow-hidden ${
        isConnected ? 'border-astryx-emerald/50' : isError ? 'border-astryx-red/50' : 'border-astryx-violet/50'
      }`}>
        <div className={`absolute inset-0 animate-pulse ${
          isConnected ? 'bg-astryx-emerald/20' : isError ? 'bg-astryx-red/20' : 'bg-astryx-violet/20'
        }`} />
        <span className={`text-sm relative z-10 ${
          isConnected ? 'text-astryx-emerald' : isError ? 'text-astryx-red' : 'text-astryx-violet'
        }`}>◇</span>
      </div>
      <span className={`font-mono text-[10px] uppercase tracking-widest ${
        isConnected ? 'text-astryx-emerald' : isError ? 'text-astryx-red' : 'text-astryx-violet'
      }`}>
        {isConnected ? 'MEMORY CORE ONLINE' : isError ? 'MEMORY CORE ERROR' : 'MEMORY CORE OFFLINE'}
      </span>
      {isConnected ? (
        <span className="font-mono text-[8px] text-astryx-text mt-2 text-center max-w-[200px] tracking-widest uppercase">
          {memory.nodes} VECTORS STORED
        </span>
      ) : (
        <span className="font-mono text-[8px] text-astryx-text-secondary/50 mt-2 text-center max-w-[200px]">
          WAITING FOR VECTOR DATABASE INITIALIZATION
        </span>
      )}
    </div>
  )
}

/* ═══════════════════ SUGGESTIONS TAB ═══════════════════ */

function SuggestionsTab(): React.JSX.Element {
  const suggestions = [
    { id: '1', label: 'RUN SYSTEM DIAGNOSTICS' },
    { id: '2', label: 'SCAN LOCAL NETWORK' },
    { id: '3', label: 'COMPILE DAILY BRIEFING' },
    { id: '4', label: 'ACTIVATE DEFENSE PROTOCOL' }
  ]
  const sendWsMessage = useJarvisStore((s) => s.sendWsMessage)
  const addMessage = useJarvisStore((s) => s.addMessage)

  const handle = (label: string): void => {
    audioEngine.playClick()
    addMessage({ id: crypto.randomUUID(), role: 'user', content: label, timestamp: Date.now() })
    sendWsMessage('chat', { message: label })
  }

  return (
    <div className="space-y-3 p-4">
      <div className="font-mono text-[9px] text-astryx-cyan uppercase tracking-[0.3em] mb-4 border-b border-white/10 pb-2">
        SUGGESTED DIRECTIVES
      </div>
      {suggestions.map((s, i) => (
        <motion.button
          key={s.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.08 }}
          onClick={() => handle(s.label)}
          className="w-full text-left p-3 bg-astryx-surface-light/20 border border-astryx-cyan/10 hover:border-astryx-cyan/50 hover:bg-astryx-cyan/5 transition-all duration-500 group cursor-pointer relative overflow-hidden rounded-md shadow-sm"
        >
          <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-astryx-cyan/20 group-hover:bg-astryx-cyan transition-colors" />
          <div className="pl-4 font-mono text-[10px] text-astryx-platinum/80 group-hover:text-astryx-cyan tracking-[0.2em] transition-colors">
            &gt; {s.label}
          </div>
        </motion.button>
      ))}
    </div>
  )
}

/* ═══════════════════ DIGITAL NEWSPAPER VIEW — THE ASTRYX DAILY ═══════════════════ */

function NewsNewspaperView(): React.JSX.Element {
  const newsData = useJarvisStore((s) => s.newsData)
  const sendWsMessage = useJarvisStore((s) => s.sendWsMessage)
  const [selectedArticle, setSelectedArticle] = useState<any | null>(null)
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [searchTopic, setSearchTopic] = useState<string>('')
  const [compiling, setCompiling] = useState<boolean>(false)
  const [isReading, setIsReading] = useState<boolean>(false)

  // Cancel speech on unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel()
    }
  }, [])

  // Cancel speech and reset state when article selection changes
  useEffect(() => {
    window.speechSynthesis.cancel()
    setIsReading(false)
  }, [selectedArticle])

  const toggleReadAloud = (): void => {
    if (!selectedArticle) return
    
    if (isReading) {
      window.speechSynthesis.cancel()
      setIsReading(false)
    } else {
      audioEngine.playClick()
      window.speechSynthesis.cancel()
      const textToSpeak = `${selectedArticle.title}. ${selectedArticle.summary}`
      const utterance = new SpeechSynthesisUtterance(textToSpeak)
      utterance.lang = 'en-US'
      utterance.onend = () => {
        setIsReading(false)
      }
      utterance.onerror = () => {
        setIsReading(false)
      }
      setIsReading(true)
      window.speechSynthesis.speak(utterance)
    }
  }
  
  // Inject premium newspaper serif and sans fonts dynamically
  useEffect(() => {
    if (!document.getElementById('news-fonts')) {
      const link = document.createElement('link')
      link.id = 'news-fonts'
      link.rel = 'stylesheet'
      link.href = 'https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700;800&family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=Outfit:wght@300;400;600&display=swap'
      document.head.appendChild(link)
    }
  }, [])

  const handleCompile = (topic: string) => {
    if (!topic.trim()) return
    audioEngine.playClick()
    setCompiling(true)
    sendWsMessage('run_tool', { tag: 'NEWS', content: topic.trim() })
  }

  // Clear compiling overlay when new data arrives
  useEffect(() => {
    setCompiling(false)
  }, [newsData])

  if (compiling) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-0 bg-[#020710]/95 backdrop-blur-md p-6 text-center z-50">
        <div className="space-y-4">
          <div className="relative w-20 h-20 mx-auto">
            <div className="absolute inset-0 border-t-2 border-r-2 border-[#00e5ff] rounded-full animate-spin" />
            <div className="absolute inset-2 border-b-2 border-l-2 border-[#00a8cc] rounded-full animate-spin [animation-direction:reverse]" />
            <div className="absolute inset-5 bg-white/5 rounded-full flex items-center justify-center">
              <span className="text-[14px] animate-pulse">📰</span>
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="font-mono text-[11px] text-[#00e5ff] tracking-[0.25em] uppercase">Compiling Edition</h3>
            <p className="font-body text-[10px] text-white/50 tracking-wider">CRAWLING GLOBAL SOURCES & SYNTHESIZING DATA...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!newsData) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 min-h-0 text-center font-mono text-[10px] text-white/40">
        <div className="max-w-xs space-y-6">
          <div className="w-16 h-16 rounded-full border border-white/10 flex items-center justify-center mx-auto bg-white/5 shadow-[0_0_20px_rgba(255,255,255,0.02)]">
            <span className="text-[20px]">📰</span>
          </div>
          <div className="space-y-2">
            <h4 className="text-white text-[11px] tracking-[0.2em] uppercase font-bold">THE ASTRYX DAILY</h4>
            <p className="text-[9px] leading-relaxed text-white/40">No news edition has been compiled yet. Ask Astryx for today's news or type a custom topic below to generate a premium digital newspaper.</p>
          </div>
          
          <div className="space-y-3 pt-2 select-none pointer-events-auto">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="ENTER SEARCH TOPIC..."
                value={searchTopic}
                onChange={(e) => setSearchTopic(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCompile(searchTopic)
                }}
                className="flex-1 bg-black/40 border border-white/10 rounded px-3 py-1.5 font-mono text-[9px] text-white focus:outline-none focus:border-[#00e5ff]/50 uppercase tracking-widest"
              />
              <button
                onClick={() => handleCompile(searchTopic)}
                className="px-3 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded font-bold hover:from-cyan-500 hover:to-blue-500 transition-all cursor-pointer shadow-[0_4px_10px_rgba(0,191,255,0.15)]"
              >
                COMPILE
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 justify-center pt-2">
              {['LATEST NEWS', 'TECH TRENDS', 'AI BREAKTHROUGHS', 'SPACE EXPLORATION'].map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setSearchTopic(s)
                    handleCompile(s)
                  }}
                  className="px-2 py-1 rounded border border-white/5 bg-white/5 hover:border-[#00e5ff]/30 hover:bg-[#00e5ff]/5 text-[8px] text-white/50 hover:text-white transition-all cursor-pointer"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const { masthead, categories, mode } = newsData
  
  // Flatten all articles for easy filtering/scrolling
  const allArticles: any[] = []
  if (mode === 'general') {
    Object.entries(categories).forEach(([cat, list]) => {
      if (Array.isArray(list)) {
        list.forEach((art: any) => {
          allArticles.push({ ...art, categoryLabel: cat.toUpperCase() })
        })
      }
    })
  } else {
    // Topic mode
    Object.entries(categories).forEach(([sec, list]) => {
      if (Array.isArray(list)) {
        list.forEach((art: any) => {
          let label = 'UPDATE'
          if (sec === 'top_story') label = 'TOP STORY'
          if (sec === 'deep_dives') label = 'DEEP DIVE'
          if (sec === 'perspectives') label = 'PERSPECTIVE'
          allArticles.push({ ...art, categoryLabel: label })
        })
      }
    })
  }

  // Deduplicate flattened list
  const uniqueFlatArticles = allArticles.filter((v, i, a) => a.findIndex(t => t.url === v.url) === i)

  // Filter based on activeCategory
  const filteredArticles = activeCategory === 'all' 
    ? uniqueFlatArticles 
    : uniqueFlatArticles.filter(a => a.categoryLabel.toLowerCase() === activeCategory || (a.category && a.category.toLowerCase() === activeCategory))

  // Top Story / Hero Article is the first one in the list
  const heroArticle = mode === 'topic' 
    ? (categories.top_story?.[0] || uniqueFlatArticles[0])
    : uniqueFlatArticles[0]

  const gridArticles = filteredArticles.filter(a => a.url !== heroArticle?.url)

  // Categories list for tabs
  const filterTabs = mode === 'general'
    ? ['all', 'world', 'technology', 'business', 'science', 'lifestyle']
    : ['all', 'top story', 'deep dive', 'perspective', 'update']

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#02050b] text-white overflow-hidden relative font-sans selection:bg-[#00e5ff]/20 pointer-events-auto">
      {/* Newspaper Header */}
      <div className="px-6 pt-6 pb-2 shrink-0 border-b border-white/10 relative z-20 bg-gradient-to-b from-[#02050b] to-transparent">
        <div className="flex justify-between items-end pb-3 border-b-4 border-double border-white/20">
          <div className="text-left select-none">
            <span className="font-mono text-[8px] tracking-[0.3em] text-[#00e5ff]/80 font-bold uppercase">{masthead.edition}</span>
            <h1 className="font-serif text-[28px] md:text-[34px] tracking-wide font-extrabold text-white leading-none mt-1 shadow-sm" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              {masthead.title}
            </h1>
            <span className="font-mono text-[7px] tracking-[0.4em] text-white/50 uppercase mt-1 block">{masthead.subtitle}</span>
          </div>
          
          <div className="text-right font-mono text-[8px] text-white/40 space-y-0.5 select-none">
            <div>LONDON • NEW YORK • TOKYO</div>
            <div>{new Date(masthead.timestamp).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).toUpperCase()}</div>
          </div>
        </div>

        {/* Scrolling News Ticker */}
        <div className="border-b border-white/10 py-1.5 overflow-hidden relative select-none">
          <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-[#02050b] to-transparent z-10" />
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#02050b] to-transparent z-10" />
          
          <div className="whitespace-nowrap inline-flex gap-8 animate-[marquee_25s_linear_infinite] text-[8px] font-mono tracking-widest text-[#00e5ff]/60 uppercase">
            {uniqueFlatArticles.map((art, idx) => (
              <span key={`ticker-${idx}`} className="inline-flex items-center gap-2">
                <span className="text-white/20">•</span>
                <span className="text-white/80 font-semibold">{art.title}</span>
                <span className="text-[7px] bg-white/5 border border-white/10 px-1 rounded font-normal text-white/50">{art.source}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Main Newspaper Body Scroller */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-6 py-4 space-y-6 relative min-h-0">
        
        {/* Editorial Section */}
        {masthead.editorial && (
          <div className="border border-[#00e5ff]/15 rounded-xl bg-gradient-to-r from-[#00e5ff]/5 to-[#00a8cc]/5 p-4 relative overflow-hidden shadow-[0_4px_25px_rgba(0,229,255,0.02)] shrink-0 select-text">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#00e5ff]/5 rounded-full blur-3xl pointer-events-none" />
            <div className="flex gap-4 items-start relative z-10">
              <div className="w-1.5 h-12 bg-gradient-to-b from-[#00e5ff] to-blue-500 rounded-full shrink-0" />
              <div className="space-y-1 text-left">
                <h3 className="font-mono text-[9px] text-[#00e5ff] tracking-[0.25em] uppercase font-bold">TODAY'S EDITORIAL</h3>
                <p className="font-serif text-[12.5px] leading-relaxed text-white/90 italic tracking-wide" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                  "{masthead.editorial}"
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Live Compilation Controls */}
        <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between border-b border-white/5 pb-4 shrink-0 select-none">
          {/* Categories / Filter Tabs */}
          <div className="flex gap-1 overflow-x-auto no-scrollbar select-none py-1">
            {filterTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  audioEngine.playClick()
                  setActiveCategory(tab)
                }}
                className={`px-3 py-1 rounded-full font-mono text-[8px] tracking-wider border transition-all cursor-pointer shrink-0 uppercase ${
                  activeCategory === tab
                    ? 'border-[#00e5ff]/40 bg-[#00e5ff]/10 text-[#00e5ff] shadow-[0_0_8px_rgba(0,229,255,0.15)] font-semibold'
                    : 'border-white/5 hover:border-white/20 text-white/50 hover:text-white hover:bg-white/5'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Mini Search input */}
          <div className="flex gap-2 w-full md:w-64 select-text">
            <input
              type="text"
              placeholder="COMPILE NEW EDITION..."
              value={searchTopic}
              onChange={(e) => setSearchTopic(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCompile(searchTopic)
              }}
              className="flex-1 bg-white/5 border border-white/10 rounded px-2.5 py-1 font-mono text-[8px] text-white focus:outline-none focus:border-[#00e5ff]/40 uppercase tracking-widest"
            />
            <button
              onClick={() => handleCompile(searchTopic)}
              className="px-3 py-1 bg-[#00e5ff]/10 border border-[#00e5ff]/30 text-[#00e5ff] hover:bg-[#00e5ff]/20 rounded font-mono text-[8px] tracking-widest transition-all cursor-pointer"
            >
              COMPILE
            </button>
          </div>
        </div>

        {/* Newspaper Grid Layout */}
        <div className="space-y-6 select-text">
          
          {/* Top Story / Hero Section (only visible when filtering 'all') */}
          {activeCategory === 'all' && heroArticle && (
            <div 
              onClick={() => {
                audioEngine.playElevate()
                setSelectedArticle(heroArticle)
              }}
              className="group border border-white/10 rounded-xl overflow-hidden bg-white/[0.02] hover:bg-white/[0.04] transition-all duration-300 shadow-md hover:shadow-[0_10px_30px_rgba(0,0,0,0.4)] cursor-pointer flex flex-col md:flex-row relative"
            >
              {/* Featured Image */}
              {heroArticle.imageUrl && (
                <div className="md:w-1/2 h-56 md:h-72 overflow-hidden relative shrink-0">
                  <img 
                    src={heroArticle.imageUrl} 
                    alt={heroArticle.title} 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
                  <span className="absolute top-4 left-4 font-mono text-[8px] tracking-widest bg-[#00e5ff] text-black px-2 py-0.5 rounded font-bold uppercase shadow-lg">
                    {heroArticle.categoryLabel || 'FEATURED'}
                  </span>
                </div>
              )}
              
              {/* Text content */}
              <div className="p-5 md:p-6 flex flex-col justify-between flex-1 text-left">
                <div className="space-y-3">
                  <div className="flex gap-3 items-center text-white/40 font-mono text-[8px] tracking-wider">
                    <span className="font-bold text-[#00e5ff]/80 border border-[#00e5ff]/30 px-1.5 py-0.5 rounded bg-[#00e5ff]/5 select-none">{heroArticle.source}</span>
                    <span>•</span>
                    <span>{heroArticle.date}</span>
                  </div>
                  <h2 className="font-serif text-[18px] md:text-[22px] font-bold text-white tracking-wide leading-snug group-hover:text-[#00e5ff] transition-colors" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                    {heroArticle.title}
                  </h2>
                  <p className="text-[12px] text-white/70 leading-relaxed font-light font-body line-clamp-4">
                    {heroArticle.summary}
                  </p>
                </div>
                <div className="flex justify-between items-center pt-4 border-t border-white/5 mt-4">
                  <span className="font-mono text-[8px] tracking-widest text-[#00e5ff] group-hover:underline flex items-center gap-1">
                    READ DETAILED ANALYSIS <span className="text-[10px]">→</span>
                  </span>
                  <span className="font-mono text-[7px] text-white/30">EDITION TOP STORY</span>
                </div>
              </div>
            </div>
          )}

          {/* Article Masonry Grid */}
          {gridArticles.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {gridArticles.map((art, idx) => (
                <div
                  key={`art-grid-${idx}`}
                  onClick={() => {
                    audioEngine.playElevate()
                    setSelectedArticle(art)
                  }}
                  className="group border border-white/5 rounded-xl overflow-hidden bg-white/[0.01] hover:bg-white/[0.03] hover:border-white/15 transition-all duration-300 shadow-sm hover:shadow-[0_8px_25px_rgba(0,0,0,0.3)] cursor-pointer flex flex-col h-full text-left"
                >
                  {/* Thumbnail */}
                  {art.imageUrl && (
                    <div className="h-40 overflow-hidden relative shrink-0">
                      <img 
                        src={art.imageUrl} 
                        alt={art.title} 
                        className="w-full h-full object-cover transition-transform duration-75 group-hover:scale-102"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                      <span className="absolute top-3 left-3 font-mono text-[7px] tracking-widest bg-white/10 backdrop-blur-md text-white border border-white/15 px-2 py-0.5 rounded font-medium uppercase">
                        {art.categoryLabel || art.category || 'ARTICLE'}
                      </span>
                    </div>
                  )}
                  
                  {/* Body */}
                  <div className="p-4 flex flex-col justify-between flex-1 space-y-4">
                    <div className="space-y-2">
                      <div className="flex gap-2.5 items-center text-white/40 font-mono text-[8px] tracking-wider">
                        <span className="font-semibold text-white/70">{art.source}</span>
                        <span>•</span>
                        <span>{art.date}</span>
                      </div>
                      <h3 className="font-serif text-[14px] font-bold text-white/90 tracking-wide leading-snug group-hover:text-[#00e5ff] transition-colors line-clamp-3" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                        {art.title}
                      </h3>
                      <p className="text-[11.5px] text-white/50 leading-relaxed font-light font-body line-clamp-3">
                        {art.summary}
                      </p>
                    </div>
                    <div className="pt-3 border-t border-white/5 flex justify-between items-center text-white/30 font-mono text-[7px] tracking-widest group-hover:text-[#00e5ff] transition-colors">
                      <span>READ MORE</span>
                      <span>✦</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-white/30 font-mono text-[9px] uppercase tracking-wider select-none">
              No additional articles found in this section.
            </div>
          )}
        </div>
      </div>

      {/* Immersive Reading Drawer (Overlay) */}
      <AnimatePresence>
        {selectedArticle && (
          <div className="absolute inset-0 z-50 flex justify-end pointer-events-auto select-text">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                audioEngine.playClick()
                setSelectedArticle(null)
              }}
              className="absolute inset-0 bg-black/75 backdrop-blur-md"
            />
            
            {/* Reading Pane */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 200 }}
              className="relative w-full max-w-lg h-full bg-[#030812] border-l border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col z-10"
            >
              {/* Close Button */}
              <button
                onClick={() => {
                  audioEngine.playClick()
                  setSelectedArticle(null)
                }}
                className="absolute top-4 right-4 w-8 h-8 rounded-full border border-white/10 bg-white/5 hover:bg-white/15 hover:border-white/30 transition-all flex items-center justify-center text-[10px] cursor-pointer z-30 text-white select-none"
                title="Back to Newspaper"
              >
                ✕
              </button>

              {/* Scroller */}
              <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-6 select-text text-left">
                {/* Cover Photo */}
                {selectedArticle.imageUrl && (
                  <div className="w-full h-56 rounded-lg overflow-hidden relative shrink-0 select-none">
                    <img 
                      src={selectedArticle.imageUrl} 
                      alt={selectedArticle.title} 
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#030812] to-transparent" />
                    <span className="absolute bottom-4 left-4 font-mono text-[8px] tracking-widest bg-[#00e5ff] text-black px-2 py-0.5 rounded font-bold uppercase shadow-md">
                      {selectedArticle.categoryLabel || 'REPORT'}
                    </span>
                  </div>
                )}

                {/* Article Metadata */}
                <div className="space-y-4 pt-2">
                  <div className="flex gap-3 items-center text-white/40 font-mono text-[8px] tracking-wider select-none">
                    <span className="font-bold text-[#00e5ff] border border-[#00e5ff]/30 px-2 py-0.5 rounded bg-[#00e5ff]/5">{selectedArticle.source}</span>
                    <span>•</span>
                    <span>{selectedArticle.date}</span>
                  </div>
                  
                  <h1 className="font-serif text-[18px] md:text-[22px] font-bold leading-snug tracking-wide text-white" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                    {selectedArticle.title}
                  </h1>
                </div>

                <div className="w-full h-[1px] bg-white/10" />

                {/* Article Takeaways Box */}
                <div className="p-4 border border-white/10 rounded-xl bg-white/[0.01] space-y-2.5">
                  <h4 className="font-mono text-[8px] text-[#00e5ff] tracking-[0.2em] font-bold uppercase flex items-center gap-1 select-none">
                    <span>⚡ KEY BRIEFING POINTS</span>
                  </h4>
                  <ul className="space-y-2 font-body text-[11.5px] text-white/80 font-light leading-relaxed">
                    <li className="flex items-start gap-2">
                      <span className="text-[#00e5ff] select-none mt-[3px]">▪</span>
                      <span>Direct digital reporting attributes this update to recent international interest in the sector.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[#00e5ff] select-none mt-[3px]">▪</span>
                      <span>The source notes significant market or structural transformations impacting these channels.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[#00e5ff] select-none mt-[3px]">▪</span>
                      <span>Analysts predict this trend will influence subsequent research, production, and policy decisions.</span>
                    </li>
                  </ul>
                </div>

                {/* Detailed content */}
                <div className="space-y-3 font-body text-[12.5px] leading-relaxed font-light text-white/80">
                  <h4 className="font-mono text-[8px] text-white/40 tracking-[0.2em] font-bold uppercase select-none">DETAILED NEWS CONTENT</h4>
                  <p className="indent-4">
                    {selectedArticle.summary}
                  </p>
                  <p>
                    For detailed coverage, interviews, and real-time updates regarding this story, you can access the full report directly from the official source link below. Astryx continues to monitor global feeds for subsequent briefings.
                  </p>
                </div>

                {/* Action buttons */}
                <div className="pt-6 border-t border-white/5 flex gap-3 select-none">
                  <a
                    href={selectedArticle.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => audioEngine.playSuccess()}
                    className="flex-1 py-2.5 bg-[#00e5ff]/10 border border-[#00e5ff]/35 hover:bg-[#00e5ff]/20 text-[#00e5ff] font-mono text-[9px] font-bold tracking-[0.2em] uppercase rounded transition-all text-center cursor-pointer flex items-center justify-center gap-2 shadow-[0_4px_15px_rgba(0,229,255,0.05)]"
                  >
                    <span>🌐 VISIT SOURCE LINK</span>
                  </a>
                  <button
                    onClick={toggleReadAloud}
                    className={`flex-1 py-2.5 font-mono text-[9px] font-bold tracking-[0.2em] uppercase rounded transition-all cursor-pointer flex items-center justify-center gap-2 border ${
                      isReading
                        ? 'bg-red-500/10 border-red-500/40 text-red-400 hover:bg-red-500/20'
                        : 'bg-[#00e5ff]/10 border-[#00e5ff]/35 hover:bg-[#00e5ff]/20 text-[#00e5ff]'
                    }`}
                  >
                    <span>{isReading ? '🛑 STOP READING' : '🔊 READ ALOUD'}</span>
                  </button>
                  <button
                    onClick={() => {
                      audioEngine.playClick()
                      setSelectedArticle(null)
                    }}
                    className="px-4 py-2.5 border border-white/10 hover:border-white/20 hover:bg-white/5 rounded text-white/60 hover:text-white font-mono text-[9px] tracking-[0.2em] transition-all cursor-pointer"
                  >
                    CLOSE
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

