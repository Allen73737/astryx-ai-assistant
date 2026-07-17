import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useJarvisStore } from '@/stores/jarvis.store'
import { audioEngine } from '@/utils/AudioEngine'

type IDESubTab = 'explorer' | 'copilot' | 'terminal' | 'git' | 'swarm' | 'diff'

export function AntigravityIDETab(): React.JSX.Element {
  const [activeSubTab, setActiveSubTab] = useState<IDESubTab>('explorer')
  const [editorContent, setEditorContent] = useState<string>('')
  const [isDirty, setIsDirty] = useState<boolean>(false)
  
  const ideCurrentPath = useJarvisStore((s) => s.ideCurrentPath)
  const setIdeCurrentPath = useJarvisStore((s) => s.setIdeCurrentPath)
  const ideFileTree = useJarvisStore((s) => s.ideFileTree)
  const ideActiveFile = useJarvisStore((s) => s.ideActiveFile)
  const setIdeActiveFile = useJarvisStore((s) => s.setIdeActiveFile)
  const ideTerminalLogs = useJarvisStore((s) => s.ideTerminalLogs)
  const ideGitState = useJarvisStore((s) => s.ideGitState)
  const ideAiResult = useJarvisStore((s) => s.ideAiResult)
  const ideSwarmResult = useJarvisStore((s) => s.ideSwarmResult)
  const sendWsMessage = useJarvisStore((s) => s.sendWsMessage)

  // Load initial directory on mount
  useEffect(() => {
    sendWsMessage('ide_list_dir', { path: ideCurrentPath })
    sendWsMessage('ide_git_status', { repo: ideCurrentPath })
  }, [ideCurrentPath, sendWsMessage])

  // Sync active file content to local editor state
  useEffect(() => {
    if (ideActiveFile) {
      setEditorContent(ideActiveFile.content)
      setIsDirty(false)
    }
  }, [ideActiveFile])

  // Handle keyboard shortcuts (Ctrl+S for save)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (ideActiveFile && isDirty) {
          handleSaveFile()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [ideActiveFile, isDirty, editorContent])

  const handleSaveFile = () => {
    if (!ideActiveFile) return
    audioEngine.playElevate()
    sendWsMessage('ide_write_file', {
      path: ideActiveFile.path,
      content: editorContent
    })
    setIsDirty(false)
    setIdeActiveFile({
      ...ideActiveFile,
      content: editorContent,
      lines: editorContent.split('\n').length
    })
  }

  const handleOpenItem = (item: any) => {
    audioEngine.playClick()
    if (item.isDir) {
      setIdeCurrentPath(item.path)
    } else {
      sendWsMessage('ide_read_file', { path: item.path })
    }
  }

  const handleNavigateUp = () => {
    audioEngine.playClick()
    const parts = ideCurrentPath.split('/')
    if (parts.length > 1) {
      parts.pop()
      const parent = parts.join('/') || 'c:/'
      setIdeCurrentPath(parent)
    }
  }

  const subTabs: { id: IDESubTab; label: string; icon: string }[] = [
    { id: 'explorer', label: 'STUDIO EXPLORER', icon: '📁' },
    { id: 'copilot', label: 'AI COPILOT', icon: '🧠' },
    { id: 'terminal', label: 'CYBER TERMINAL', icon: '⚡' },
    { id: 'git', label: 'VERSION CONTROL', icon: '🌿' },
    { id: 'swarm', label: 'AGENT FORGE SWARM', icon: '🤖' },
    { id: 'diff', label: 'PATCH REVIEWER', icon: '⚖️' },
  ]

  return (
    <div className="h-full flex flex-col min-h-0 text-white font-mono select-none bg-[#000814]/80">
      {/* Top Banner & Sub-Nav */}
      <div className="border-b border-[#00e5ff]/20 px-4 py-2 bg-[#001224]/90 flex items-center justify-between shrink-0 shadow-[0_4px_15px_rgba(0,229,255,0.1)]">
        <div className="flex items-center gap-2">
          <span className="text-[14px] animate-pulse">🚀</span>
          <span className="text-[12px] font-display font-bold tracking-[0.2em] text-[#00e5ff] drop-shadow-[0_0_8px_rgba(0,229,255,0.8)]">
            ANTIGRAVITY IDE // PREMIUM STUDIO
          </span>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#00e5ff]/10 text-[#00e5ff] border border-[#00e5ff]/30">
            ADVANCED AGENTIC CODING
          </span>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {subTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                audioEngine.playClick()
                setActiveSubTab(tab.id)
              }}
              className={`px-3 py-1 text-[10px] tracking-wider rounded transition-all flex items-center gap-1.5 border ${
                activeSubTab === tab.id
                  ? 'bg-[#00e5ff]/20 text-[#00e5ff] border-[#00e5ff] shadow-[0_0_10px_rgba(0,229,255,0.3)] font-semibold'
                  : 'bg-white/5 text-white/60 border-transparent hover:border-white/20 hover:text-white'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Studio Area */}
      <div className="flex-1 overflow-hidden relative min-h-0 p-3">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSubTab}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
            className="h-full w-full overflow-hidden flex flex-col min-h-0"
          >
            {activeSubTab === 'explorer' && (
              <ExplorerEditorView
                currentPath={ideCurrentPath}
                fileTree={ideFileTree}
                activeFile={ideActiveFile}
                editorContent={editorContent}
                isDirty={isDirty}
                onOpenItem={handleOpenItem}
                onNavigateUp={handleNavigateUp}
                onEditorChange={(val) => {
                  setEditorContent(val)
                  setIsDirty(val !== (ideActiveFile?.content || ''))
                }}
                onSave={handleSaveFile}
                onRefresh={() => sendWsMessage('ide_list_dir', { path: ideCurrentPath })}
              />
            )}
            {activeSubTab === 'copilot' && <CopilotView activeFile={ideActiveFile} editorContent={editorContent} aiResult={ideAiResult} />}
            {activeSubTab === 'terminal' && <TerminalView logs={ideTerminalLogs} currentPath={ideCurrentPath} />}
            {activeSubTab === 'git' && <GitView currentPath={ideCurrentPath} gitState={ideGitState} />}
            {activeSubTab === 'swarm' && <SwarmView activeFile={ideActiveFile} swarmResult={ideSwarmResult} currentPath={ideCurrentPath} />}
            {activeSubTab === 'diff' && <DiffView activeFile={ideActiveFile} editorContent={editorContent} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

/* ═══════════════════ EXPLORER & EDITOR VIEW ═══════════════════ */

function ExplorerEditorView({
  currentPath,
  fileTree,
  activeFile,
  editorContent,
  isDirty,
  onOpenItem,
  onNavigateUp,
  onEditorChange,
  onSave,
  onRefresh
}: {
  currentPath: string
  fileTree: any[]
  activeFile: any
  editorContent: string
  isDirty: boolean
  onOpenItem: (item: any) => void
  onNavigateUp: () => void
  onEditorChange: (val: string) => void
  onSave: () => void
  onRefresh: () => void
}): React.JSX.Element {
  const getFileIcon = (name: string, isDir: boolean) => {
    if (isDir) return '📁'
    if (name.endsWith('.ts') || name.endsWith('.tsx')) return '⚛️'
    if (name.endsWith('.py')) return '🐍'
    if (name.endsWith('.json')) return '📦'
    if (name.endsWith('.md')) return '📝'
    if (name.endsWith('.css') || name.endsWith('.html')) return '🎨'
    return '📄'
  }

  return (
    <div className="h-full flex gap-3 min-h-0">
      {/* Left Tree Explorer */}
      <div className="w-1/3 min-w-[220px] max-w-[320px] bg-[#001224]/60 border border-[#00e5ff]/20 rounded p-2 flex flex-col min-h-0 shadow-lg">
        {/* Path bar */}
        <div className="flex items-center justify-between gap-1 pb-2 border-b border-white/10 shrink-0">
          <button
            onClick={onNavigateUp}
            title="Parent Directory"
            className="px-2 py-1 rounded bg-white/5 hover:bg-white/15 text-[10px] border border-white/10 transition-colors"
          >
            ⬆ Up
          </button>
          <div className="flex-1 truncate text-[10px] text-[#00e5ff] px-1 font-mono tracking-tight" title={currentPath}>
            {currentPath}
          </div>
          <button
            onClick={onRefresh}
            title="Refresh Directory"
            className="px-2 py-1 rounded bg-white/5 hover:bg-[#00e5ff]/20 hover:text-[#00e5ff] text-[10px] border border-white/10 transition-colors"
          >
            ↻
          </button>
        </div>

        {/* Tree List */}
        <div className="flex-1 overflow-y-auto mt-2 space-y-0.5 pr-1 min-h-0 no-scrollbar">
          {fileTree.length === 0 && (
            <div className="text-center py-6 text-white/40 text-[11px] italic">No items found or loading...</div>
          )}
          {fileTree.map((item, idx) => (
            <div
              key={idx}
              onClick={() => onOpenItem(item)}
              className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer text-[11px] transition-all group ${
                activeFile?.path === item.path
                  ? 'bg-[#00e5ff]/20 text-[#00e5ff] font-semibold border-l-2 border-[#00e5ff]'
                  : 'hover:bg-white/5 text-white/80 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <span className="text-[13px]">{getFileIcon(item.name, item.isDir)}</span>
                <span className="truncate">{item.name}</span>
              </div>
              {!item.isDir && item.size > 0 && (
                <span className="text-[9px] text-white/40 group-hover:text-white/60 shrink-0 ml-1">
                  {item.size > 1024 ? `${(item.size / 1024).toFixed(0)}KB` : `${item.size}B`}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Right Code Editor Pane */}
      <div className="flex-1 bg-[#00050d]/90 border border-[#00e5ff]/30 rounded flex flex-col min-h-0 shadow-[inset_0_0_20px_rgba(0,229,255,0.05)]">
        {activeFile ? (
          <>
            {/* Editor Top Bar */}
            <div className="px-3 py-2 bg-[#001830]/80 border-b border-[#00e5ff]/20 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-[14px]">📄</span>
                <span className="text-[12px] text-[#00e5ff] font-semibold tracking-wide">
                  {activeFile.name} {isDirty && <span className="text-[#f59e0b] font-bold">* [MODIFIED]</span>}
                </span>
                <span className="text-[10px] text-white/40">({activeFile.lines} lines)</span>
              </div>

              <div className="flex items-center gap-2">
                {isDirty && (
                  <button
                    onClick={() => onEditorChange(activeFile.content)}
                    className="px-2.5 py-1 text-[10px] rounded bg-white/10 hover:bg-white/20 text-white/80 transition-all border border-white/10"
                  >
                    Revert
                  </button>
                )}
                <button
                  onClick={onSave}
                  disabled={!isDirty}
                  className={`px-3 py-1 text-[10px] font-bold rounded transition-all flex items-center gap-1 ${
                    isDirty
                      ? 'bg-[#00e5ff] hover:bg-[#00e5ff]/80 text-black shadow-[0_0_10px_rgba(0,229,255,0.6)] cursor-pointer animate-pulse'
                      : 'bg-white/5 text-white/30 border border-white/10 cursor-not-allowed'
                  }`}
                >
                  <span>💾</span>
                  <span>SAVE (Ctrl+S)</span>
                </button>
              </div>
            </div>

            {/* Editor Area with Line Numbers */}
            <div className="flex-1 flex min-h-0 overflow-hidden relative">
              {/* Line Numbers */}
              <div className="w-12 bg-[#000a18]/80 text-white/30 text-[11px] font-mono select-none py-3 px-2 text-right border-r border-white/10 overflow-hidden shrink-0">
                {Array.from({ length: Math.max(editorContent.split('\n').length, 1) }).map((_, i) => (
                  <div key={i} className="leading-5">{i + 1}</div>
                ))}
              </div>

              {/* Textarea Editor */}
              <textarea
                value={editorContent}
                onChange={(e) => onEditorChange(e.target.value)}
                spellCheck={false}
                className="flex-1 bg-transparent text-[#e0faff] text-[11px] font-mono p-3 leading-5 outline-none resize-none overflow-y-auto no-scrollbar selection:bg-[#00e5ff]/30"
                placeholder="Select a file or type code here..."
              />
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-6">
            <span className="text-[40px] mb-3 animate-bounce">🌌</span>
            <h3 className="text-[14px] font-display font-bold text-[#00e5ff] tracking-widest uppercase mb-1">
              ANTIGRAVITY STUDIO EDITOR
            </h3>
            <p className="text-[11px] text-white/50 max-w-sm">
              Select any file from the studio explorer on the left to inspect, edit, or invoke AI agentic tools.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════ COPILOT VIEW ═══════════════════ */

function CopilotView({
  activeFile,
  editorContent,
  aiResult
}: {
  activeFile: any
  editorContent: string
  aiResult: any
}): React.JSX.Element {
  const [customPrompt, setCustomPrompt] = useState('')
  const sendWsMessage = useJarvisStore((s) => s.sendWsMessage)

  const handleAction = (action: string) => {
    if (!activeFile) return
    audioEngine.playElevate()
    sendWsMessage('ide_ai_action', {
      action,
      code: editorContent || activeFile.content,
      language: activeFile.name.split('.').pop() || 'typescript',
      prompt: customPrompt
    })
  }

  const actions = [
    { id: 'refactor', label: 'REFACTOR & CLEAN', icon: '✨', color: '#00e5ff', desc: 'Modern syntax & clean architecture' },
    { id: 'linter', label: 'AI BUG LINTER', icon: '🐞', color: '#ef4444', desc: 'Scan for bugs, leaks & edge cases' },
    { id: 'test', label: 'GENERATE TESTS', icon: '🧪', color: '#10b981', desc: 'Create complete unit test suites' },
    { id: 'complexity', label: 'BIG-O COMPLEXITY', icon: '📊', color: '#f59e0b', desc: 'Time & space algorithm analysis' },
    { id: 'security', label: 'SECURITY AUDIT', icon: '🛡️', color: '#a855f7', desc: 'Strict OWASP vulnerability scan' },
    { id: 'doc', label: 'AUTO DOCUMENT', icon: '📝', color: '#38bdf8', desc: 'Generate docstrings & markdown' },
  ]

  return (
    <div className="h-full flex flex-col gap-3 min-h-0">
      {/* Top Controls Box */}
      <div className="bg-[#001224]/80 border border-[#00e5ff]/30 rounded p-3 shrink-0 shadow-lg">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-[14px]">🧠</span>
            <span className="text-[12px] font-bold text-[#00e5ff] tracking-wider uppercase">
              ANTIGRAVITY AGENTIC COPILOT
            </span>
          </div>
          <span className="text-[10px] text-white/50">
            Target: <span className="text-[#00e5ff] font-semibold">{activeFile ? activeFile.name : 'No file selected'}</span>
          </span>
        </div>

        {/* Custom Prompt Input */}
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="Optional custom instruction (e.g. 'Convert to async/await and optimize imports')..."
            className="flex-1 bg-[#00050d] border border-white/20 rounded px-3 py-1.5 text-[11px] text-white placeholder-white/40 focus:border-[#00e5ff] outline-none"
          />
          <button
            onClick={() => handleAction('refactor')}
            disabled={!activeFile}
            className="px-4 py-1.5 bg-[#00e5ff] hover:bg-[#00e5ff]/80 text-black font-bold text-[11px] rounded transition-all shadow-[0_0_12px_rgba(0,229,255,0.5)] disabled:opacity-30 disabled:cursor-not-allowed"
          >
            RUN AI ⚡
          </button>
        </div>

        {/* Action Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {actions.map((act) => (
            <button
              key={act.id}
              onClick={() => handleAction(act.id)}
              disabled={!activeFile}
              className="flex items-center gap-2 p-2 rounded bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#00e5ff]/40 transition-all text-left group disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <span className="text-[16px] group-hover:scale-110 transition-transform">{act.icon}</span>
              <div className="truncate">
                <div className="text-[10px] font-bold text-white group-hover:text-[#00e5ff]">{act.label}</div>
                <div className="text-[8px] text-white/50 truncate">{act.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* AI Response Output Card */}
      <div className="flex-1 bg-[#000814]/90 border border-[#00e5ff]/30 rounded p-4 flex flex-col min-h-0 overflow-hidden shadow-[inset_0_0_20px_rgba(0,229,255,0.05)]">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10 shrink-0">
          <span className="text-[11px] font-bold text-[#00e5ff] uppercase flex items-center gap-1.5">
            <span>📡</span> AI ANALYSIS REPORT {aiResult ? `[${aiResult.action.toUpperCase()}]` : ''}
          </span>
          {aiResult && (
            <button
              onClick={() => {
                navigator.clipboard.writeText(aiResult.result)
                audioEngine.playClick()
              }}
              className="px-2 py-0.5 text-[9px] bg-white/10 hover:bg-[#00e5ff]/20 hover:text-[#00e5ff] rounded border border-white/15 transition-all"
            >
              📋 COPY RESULT
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto pr-2 min-h-0 text-[11px] text-[#e0faff] leading-6 font-mono whitespace-pre-wrap no-scrollbar">
          {aiResult ? (
            aiResult.result
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center text-white/40 italic">
              Click any Antigravity Copilot action above to trigger state-of-the-art AI code intelligence.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════ TERMINAL VIEW ═══════════════════ */

function TerminalView({
  logs,
  currentPath
}: {
  logs: any[]
  currentPath: string
}): React.JSX.Element {
  const [cmdInput, setCmdInput] = useState('')
  const sendWsMessage = useJarvisStore((s) => s.sendWsMessage)

  const handleRunCommand = (e: React.FormEvent) => {
    e.preventDefault()
    if (!cmdInput.trim()) return
    audioEngine.playClick()
    sendWsMessage('ide_exec_cmd', {
      command: cmdInput.trim(),
      cwd: currentPath
    })
    setCmdInput('')
  }

  const quickCommands = [
    'dir',
    'git status',
    'npm run typecheck',
    'python --version',
    'whoami',
    'git log -n 5 --oneline'
  ]

  return (
    <div className="h-full flex flex-col gap-3 min-h-0">
      {/* Quick Command Buttons */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
        <span className="text-[10px] text-white/50 shrink-0">QUICK EXEC:</span>
        {quickCommands.map((cmd, idx) => (
          <button
            key={idx}
            onClick={() => {
              audioEngine.playClick()
              sendWsMessage('ide_exec_cmd', { command: cmd, cwd: currentPath })
            }}
            className="px-2.5 py-1 rounded bg-white/5 hover:bg-[#00e5ff]/20 hover:text-[#00e5ff] text-[10px] border border-white/10 transition-all font-mono whitespace-nowrap"
          >
            $ {cmd}
          </button>
        ))}
      </div>

      {/* Cyberdeck Console Screen */}
      <div className="flex-1 bg-[#00050d] border border-[#00e5ff]/40 rounded p-3 flex flex-col min-h-0 shadow-[0_0_20px_rgba(0,229,255,0.15)] relative overflow-hidden">
        {/* Scanline Overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.04] bg-[linear-gradient(rgba(0,229,255,1)_1px,transparent_1px)] bg-[size:100%_4px]" />

        {/* Console Log Feed */}
        <div className="flex-1 overflow-y-auto flex flex-col-reverse gap-3 pr-2 min-h-0 text-[11px] font-mono no-scrollbar">
          {logs.length === 0 && (
            <div className="text-center py-10 text-[#00e5ff]/40 italic">
              Antigravity Cyberdeck Terminal Ready. Enter a command below or click a quick execute button.
            </div>
          )}
          {logs.map((log, i) => (
            <div key={i} className="border-l-2 border-[#00e5ff]/40 pl-3 py-1 bg-white/[0.02] rounded-r">
              <div className="flex items-center justify-between text-[10px] text-white/60 mb-1">
                <span className="text-[#00e5ff] font-bold">$ {log.command}</span>
                <div className="flex items-center gap-2">
                  <span className="text-white/40">{log.time}</span>
                  <span className="px-1.5 py-0.2 rounded bg-white/10 text-[9px]">{log.durationMs}ms</span>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                      log.exitCode === 0 ? 'bg-[#10b981]/20 text-[#10b981]' : 'bg-[#ef4444]/20 text-[#ef4444]'
                    }`}
                  >
                    {log.exitCode === 0 ? 'OK [0]' : `ERR [${log.exitCode}]`}
                  </span>
                </div>
              </div>
              {log.stdout && <pre className="text-[#e0faff] whitespace-pre-wrap leading-5 text-[11px] overflow-x-auto">{log.stdout}</pre>}
              {log.stderr && <pre className="text-[#ef4444] whitespace-pre-wrap leading-5 text-[11px] mt-1 overflow-x-auto">{log.stderr}</pre>}
            </div>
          ))}
        </div>

        {/* Command Input Box */}
        <form onSubmit={handleRunCommand} className="mt-3 pt-2 border-t border-[#00e5ff]/20 flex items-center gap-2 shrink-0">
          <span className="text-[#00e5ff] font-bold text-[13px] animate-pulse">❯</span>
          <input
            type="text"
            value={cmdInput}
            onChange={(e) => setCmdInput(e.target.value)}
            placeholder={`Execute terminal command in ${currentPath}...`}
            className="flex-1 bg-transparent text-[#00e5ff] text-[12px] font-mono outline-none placeholder-white/30"
          />
          <button
            type="submit"
            className="px-3 py-1 rounded bg-[#00e5ff] hover:bg-[#00e5ff]/80 text-black font-bold text-[10px] transition-all shadow-[0_0_10px_rgba(0,229,255,0.5)]"
          >
            EXEC ⚡
          </button>
        </form>
      </div>
    </div>
  )
}

/* ═══════════════════ GIT VIEW ═══════════════════ */

function GitView({ currentPath, gitState }: { currentPath: string; gitState: any }): React.JSX.Element {
  const [commitMsg, setCommitMsg] = useState('')
  const sendWsMessage = useJarvisStore((s) => s.sendWsMessage)

  const handleRefresh = () => {
    audioEngine.playClick()
    sendWsMessage('ide_git_status', { repo: currentPath })
    sendWsMessage('ide_git_log', { repo: currentPath })
  }

  const handleCommit = () => {
    if (!commitMsg.trim()) return
    audioEngine.playElevate()
    sendWsMessage('ide_git_commit', { repo: currentPath, message: commitMsg.trim() })
    setCommitMsg('')
    setTimeout(handleRefresh, 1000)
  }

  const handleAICommitMsg = () => {
    audioEngine.playElevate()
    const files = gitState?.files || []
    const fileNames = files.map((f: any) => f.file).join(', ')
    setCommitMsg(`feat(ide): update studio components and state (${fileNames || 'workspace changes'})`)
  }

  return (
    <div className="h-full flex gap-3 min-h-0">
      {/* Left Staged/Modified Files */}
      <div className="w-1/2 bg-[#001224]/80 border border-[#00e5ff]/30 rounded p-3 flex flex-col min-h-0 shadow-lg">
        <div className="flex items-center justify-between pb-2 border-b border-white/10 mb-2 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[14px]">🌿</span>
            <span className="text-[12px] font-bold text-[#00e5ff] tracking-wider">BRANCH: {gitState?.branch || 'main'}</span>
          </div>
          <button
            onClick={handleRefresh}
            className="px-2 py-0.5 rounded bg-white/10 hover:bg-[#00e5ff]/20 hover:text-[#00e5ff] text-[10px] border border-white/15 transition-all"
          >
            ↻ REFRESH
          </button>
        </div>

        {/* Commit Box */}
        <div className="flex flex-col gap-2 mb-3 pb-3 border-b border-white/10 shrink-0">
          <input
            type="text"
            value={commitMsg}
            onChange={(e) => setCommitMsg(e.target.value)}
            placeholder="Commit message (e.g. 'feat: implement new IDE feature')..."
            className="w-full bg-[#00050d] border border-white/20 rounded px-3 py-1.5 text-[11px] text-white placeholder-white/40 focus:border-[#00e5ff] outline-none"
          />
          <div className="flex justify-between gap-2">
            <button
              onClick={handleAICommitMsg}
              className="px-2.5 py-1 rounded bg-[#a855f7]/20 hover:bg-[#a855f7]/30 text-[#a855f7] border border-[#a855f7]/40 text-[10px] font-semibold transition-all flex items-center gap-1"
            >
              <span>✨ AI GENERATE MSG</span>
            </button>
            <button
              onClick={handleCommit}
              disabled={!commitMsg.trim()}
              className="px-4 py-1 rounded bg-[#00e5ff] hover:bg-[#00e5ff]/80 text-black font-bold text-[10px] transition-all shadow-[0_0_10px_rgba(0,229,255,0.5)] disabled:opacity-30 disabled:cursor-not-allowed"
            >
              COMMIT & STAGE ALL 🚀
            </button>
          </div>
        </div>

        {/* File List */}
        <div className="flex-1 overflow-y-auto space-y-1 pr-1 min-h-0 no-scrollbar">
          <div className="text-[10px] text-white/50 mb-1">CHANGED FILES ({gitState?.files?.length || 0}):</div>
          {!gitState?.files || gitState.files.length === 0 ? (
            <div className="text-center py-6 text-white/40 text-[11px] italic">Working tree clean. No modified files.</div>
          ) : (
            gitState.files.map((f: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-1.5 rounded bg-white/[0.03] border border-white/5 text-[11px]">
                <div className="flex items-center gap-2 truncate">
                  <span
                    className={`px-1.5 py-0.2 rounded font-bold text-[9px] ${
                      f.status.includes('M')
                        ? 'bg-[#f59e0b]/20 text-[#f59e0b]'
                        : f.status.includes('A') || f.status.includes('??')
                        ? 'bg-[#10b981]/20 text-[#10b981]'
                        : 'bg-[#ef4444]/20 text-[#ef4444]'
                    }`}
                  >
                    {f.status}
                  </span>
                  <span className="truncate text-white/90 font-mono">{f.file}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Recent Commits Log */}
      <div className="w-1/2 bg-[#000814]/90 border border-[#00e5ff]/30 rounded p-3 flex flex-col min-h-0 shadow-lg">
        <div className="text-[12px] font-bold text-[#00e5ff] pb-2 border-b border-white/10 mb-2 shrink-0 flex items-center gap-1.5">
          <span>📜</span> RECENT COMMIT HISTORY
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0 no-scrollbar">
          {!gitState?.commits || gitState.commits.length === 0 ? (
            <div className="text-center py-6 text-white/40 text-[11px] italic">Click Refresh to load commit history...</div>
          ) : (
            gitState.commits.map((c: any, i: number) => (
              <div key={i} className="p-2 rounded bg-white/[0.03] border-l-2 border-[#00e5ff] flex flex-col gap-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-bold text-[#00e5ff] px-1.5 py-0.2 bg-[#00e5ff]/10 rounded font-mono">{c.hash}</span>
                  <span className="text-white/40">{c.time}</span>
                </div>
                <div className="text-[11px] text-white/90 font-semibold">{c.message}</div>
                <div className="text-[9px] text-white/50">Author: {c.author}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════ SWARM VIEW (AGENT FORGE) ═══════════════════ */

function SwarmView({ activeFile, swarmResult, currentPath }: { activeFile: any; swarmResult: any; currentPath: string }): React.JSX.Element {
  const [taskPrompt, setTaskPrompt] = useState('')
  const sendWsMessage = useJarvisStore((s) => s.sendWsMessage)

  const handleLaunchSwarm = () => {
    if (!taskPrompt.trim()) return
    audioEngine.playElevate()
    sendWsMessage('ide_agent_swarm', {
      task: taskPrompt.trim(),
      code: activeFile?.content || '',
      repo: currentPath
    })
  }

  const agents = [
    { name: 'Architect Agent 🏛️', role: 'System Design & Patterns', color: '#00e5ff', bg: 'bg-[#00e5ff]/10 border-[#00e5ff]/40' },
    { name: 'Security Auditor Agent 🛡️', role: 'Vulnerability & Threat Scan', color: '#ef4444', bg: 'bg-[#ef4444]/10 border-[#ef4444]/40' },
    { name: 'Test Engineer Agent 🧪', role: 'Edge Cases & Unit Testing', color: '#10b981', bg: 'bg-[#10b981]/10 border-[#10b981]/40' },
    { name: 'UX/UI Designer Agent 🎨', role: 'Ergonomics & Elegance', color: '#a855f7', bg: 'bg-[#a855f7]/10 border-[#a855f7]/40' },
  ]

  return (
    <div className="h-full flex flex-col gap-3 min-h-0">
      {/* Top Launcher */}
      <div className="bg-[#001224]/80 border border-[#00e5ff]/40 rounded p-3 shrink-0 shadow-lg flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[16px] animate-spin" style={{ animationDuration: '6s' }}>🤖</span>
            <span className="text-[12px] font-bold text-[#00e5ff] tracking-wider uppercase">
              MULTI-AGENT COLLABORATIVE SWARM (AGENT FORGE)
            </span>
          </div>
          <span className="text-[10px] text-white/50">
            Active Context: <span className="text-[#00e5ff] font-semibold">{activeFile ? activeFile.name : 'Full Workspace'}</span>
          </span>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={taskPrompt}
            onChange={(e) => setTaskPrompt(e.target.value)}
            placeholder="Describe your architecture goal or feature (e.g. 'Build a high-performance caching layer with thread safety')..."
            className="flex-1 bg-[#00050d] border border-white/20 rounded px-3 py-1.5 text-[11px] text-white placeholder-white/40 focus:border-[#00e5ff] outline-none"
          />
          <button
            onClick={handleLaunchSwarm}
            disabled={!taskPrompt.trim()}
            className="px-5 py-1.5 bg-[linear-gradient(90deg,#00e5ff,#a855f7)] hover:opacity-90 text-black font-bold text-[11px] rounded transition-all shadow-[0_0_15px_rgba(0,229,255,0.5)] cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed uppercase"
          >
            LAUNCH SWARM ⚡🚀
          </button>
        </div>
      </div>

      {/* 4-Agent Grid */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 min-h-0 overflow-hidden">
        {agents.map((ag, idx) => {
          const content = swarmResult?.swarm?.[ag.name] || null
          return (
            <div
              key={idx}
              className={`rounded p-3 flex flex-col min-h-0 border ${ag.bg} backdrop-blur-md shadow-md overflow-hidden`}
            >
              <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-white/10 shrink-0">
                <span className="text-[11px] font-bold" style={{ color: ag.color }}>
                  {ag.name}
                </span>
                <span className="text-[9px] text-white/50 uppercase tracking-tight">{ag.role}</span>
              </div>
              <div className="flex-1 overflow-y-auto pr-1 min-h-0 text-[11px] text-[#e0faff] leading-5 font-mono whitespace-pre-wrap no-scrollbar">
                {content ? (
                  content
                ) : (
                  <div className="h-full flex items-center justify-center text-center text-white/30 italic text-[10px]">
                    Waiting for Swarm launch... Agent standing by.
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ═══════════════════ DIFF VIEW ═══════════════════ */

function DiffView({ activeFile, editorContent }: { activeFile: any; editorContent: string }): React.JSX.Element {
  if (!activeFile) {
    return (
      <div className="h-full flex items-center justify-center text-center text-white/40 italic">
        Select a file from the Explorer to preview code diffs and patch comparisons.
      </div>
    )
  }

  const originalLines = activeFile.content.split('\n')
  const modifiedLines = editorContent.split('\n')
  const isChanged = activeFile.content !== editorContent

  return (
    <div className="h-full flex flex-col gap-3 min-h-0">
      <div className="bg-[#001224]/80 border border-[#00e5ff]/30 rounded px-4 py-2 flex items-center justify-between shrink-0 shadow-md">
        <div className="flex items-center gap-2">
          <span className="text-[14px]">⚖️</span>
          <span className="text-[12px] font-bold text-[#00e5ff] uppercase tracking-wider">
            PATCH COMPARISON // {activeFile.name}
          </span>
        </div>
        <span
          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
            isChanged ? 'bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/40' : 'bg-[#10b981]/20 text-[#10b981]'
          }`}
        >
          {isChanged ? 'MODIFIED (UNSAVED CHANGES)' : 'IDENTICAL TO DISK'}
        </span>
      </div>

      <div className="flex-1 grid grid-cols-2 gap-3 min-h-0 overflow-hidden">
        {/* Left Original */}
        <div className="bg-[#00050d] border border-white/10 rounded p-3 flex flex-col min-h-0">
          <div className="text-[10px] font-bold text-white/50 pb-1 border-b border-white/10 mb-2 shrink-0">
            ORIGINAL DISK STATE ({originalLines.length} lines)
          </div>
          <div className="flex-1 overflow-y-auto font-mono text-[11px] leading-5 text-white/70 space-y-0.5 no-scrollbar">
            {originalLines.map((l: string, i: number) => (
              <div key={i} className="flex gap-2">
                <span className="text-white/30 w-8 text-right select-none shrink-0">{i + 1}</span>
                <span className="whitespace-pre-wrap break-all">{l}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Modified */}
        <div className="bg-[#00050d] border border-[#00e5ff]/30 rounded p-3 flex flex-col min-h-0">
          <div className="text-[10px] font-bold text-[#00e5ff] pb-1 border-b border-white/10 mb-2 shrink-0">
            CURRENT STUDIO EDITOR STATE ({modifiedLines.length} lines)
          </div>
          <div className="flex-1 overflow-y-auto font-mono text-[11px] leading-5 text-[#e0faff] space-y-0.5 no-scrollbar">
            {modifiedLines.map((l: string, i: number) => {
              const orig = originalLines[i]
              const isDiff = orig !== l
              return (
                <div
                  key={i}
                  className={`flex gap-2 px-1 rounded ${
                    isDiff ? 'bg-[#10b981]/20 text-[#10b981] font-bold border-l-2 border-[#10b981]' : ''
                  }`}
                >
                  <span className="text-white/30 w-8 text-right select-none shrink-0">{i + 1}</span>
                  <span className="whitespace-pre-wrap break-all">{l}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
