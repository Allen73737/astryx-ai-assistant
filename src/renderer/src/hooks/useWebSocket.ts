import { useEffect, useRef, useCallback } from 'react'
import { useJarvisStore } from '@/stores/jarvis.store'

/** WebSocket message envelope */
interface WSMessage {
  type: string
  payload: Record<string, unknown>
  timestamp: number
  id: string
}

const RECONNECT_DELAY_MS = 3000
const MAX_RECONNECT_ATTEMPTS = 9999

export function useWebSocket(): void {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectAttempts = useRef(0)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const wsUrl = useJarvisStore((s) => s.wsUrl)
  const setWs = useJarvisStore((s) => s.setWs)
  const setConnectionStatus = useJarvisStore((s) => s.setConnectionStatus)
  const setOrbState = useJarvisStore((s) => s.setOrbState)
  const addMessage = useJarvisStore((s) => s.addMessage)
  const updateMessage = useJarvisStore((s) => s.updateMessage)
  const setCurrentModel = useJarvisStore((s) => s.setCurrentModel)
  const setSwapProgress = useJarvisStore((s) => s.setSwapProgress)
  const addTask = useJarvisStore((s) => s.addTask)
  const updateTask = useJarvisStore((s) => s.updateTask)
  const setMetrics = useJarvisStore((s) => s.setMetrics)

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const msg: WSMessage = JSON.parse(event.data)

        switch (msg.type) {
          case 'chat_response': {
            const { id, content, model, done } = msg.payload as {
              id: string
              content: string
              model: string
              done: boolean
            }
            if (done) {
              const existing = useJarvisStore.getState().messages.find((m) => m.id === id)
              if (!existing) {
                addMessage({
                  id,
                  role: 'assistant',
                  content,
                  timestamp: msg.timestamp,
                  model,
                  isStreaming: false
                })
              } else {
                updateMessage(id, content, false)
              }
              // Text generation is complete — return to standby so input re-enables.
              // If TTS fires, tts_start will transition to 'speaking' automatically.
              setOrbState('standby')
            } else {
              /* Streaming — check if message exists */
              const existing = useJarvisStore.getState().messages.find((m) => m.id === id)
              if (!existing) {
                addMessage({
                  id,
                  role: 'assistant',
                  content,
                  timestamp: msg.timestamp,
                  model,
                  isStreaming: true
                })
                // Use 'processing' for text generation — 'speaking' is reserved
                // exclusively for TTS audio playback to ensure mic mute works
                setOrbState('processing')
              } else {
                updateMessage(id, content, true)
              }
            }
            break
          }

          case 'model_swap': {
            const { model, progress, status } = msg.payload as {
              model: string
              progress: number
              status: string
            }
            setSwapProgress(progress)
            if (status === 'complete') {
              setCurrentModel(model)
              setOrbState('standby')
            } else {
              setOrbState('model_swap')
            }
            break
          }

          case 'task_update': {
            const task = msg.payload as {
              id: string
              label: string
              model: string
              progress: number
              status: 'pending' | 'running' | 'completed' | 'failed'
            }
            const existing = useJarvisStore.getState().tasks.find((t) => t.id === task.id)
            if (!existing) {
              addTask({ ...task, startedAt: msg.timestamp })
            } else {
              updateTask(task.id, task)
            }
            break
          }

          case 'status': {
            const { orb_state, memory } = msg.payload as { orb_state: string, memory?: { status: any, nodes: number } }
            if (orb_state) {
              setOrbState(
                orb_state as
                  | 'standby'
                  | 'listening'
                  | 'processing'
                  | 'speaking'
                  | 'executing'
                  | 'error'
              )
            }
            if (memory) {
              useJarvisStore.getState().setMemoryStatus(memory)
            }
            break
          }

          case 'metrics': {
            setMetrics(msg.payload)
            if (msg.payload.isAdmin !== undefined) {
              useJarvisStore.getState().setAdmin(!!msg.payload.isAdmin)
            }
            break
          }

          case 'webcam_permission_request': {
            const { session_id } = msg.payload as { session_id: string }
            useJarvisStore.getState().setPendingPermissionRequest({ sessionId: session_id })
            import('@/utils/AudioEngine').then(({ audioEngine }) => {
              audioEngine.playScanning()
            })
            break
          }

          case 'tool_result': {
            const { tag, result, error, requestId } = msg.payload as {
              tag: string
              result?: string
              error?: string
              requestId?: string
            }
            if (tag) {
              const resText = error ? `Error: ${error}` : (result || '')
              useJarvisStore.getState().setTrackerData(tag, resText)
              useJarvisStore.getState().setLastToolResult({
                requestId: requestId || '',
                tag,
                result: result || '',
                error,
                timestamp: msg.timestamp
              })
            }
            break
          }

          case 'error': {
            const { message } = msg.payload as { message: string }
            addMessage({
              id: crypto.randomUUID(),
              role: 'assistant',
              content: `Error: ${message}`,
              timestamp: msg.timestamp
            })
            setOrbState('error')
            setTimeout(() => setOrbState('standby'), 3000)
            break
          }

          case 'wake_up': {
            if (window.jarvis && window.jarvis.showWindow) {
              window.jarvis.showWindow()
            }
            setOrbState('listening')
            break
          }

          case 'voice_transcription': {
            const { text } = msg.payload as { text: string }
            addMessage({
              id: crypto.randomUUID(),
              role: 'user',
              content: text,
              timestamp: msg.timestamp
            })
            break
          }

          case 'tts_start': {
            setOrbState('speaking')
            break
          }

          case 'tts_playback_complete': {
            // State is now explicitly managed by the backend's 'status' event
            break
          }

          case 'conversation_started': {
            setOrbState('listening')
            break
          }

          case 'conversation_ended': {
            setOrbState('standby')
            break
          }

          case 'news_update': {
            const data = msg.payload as any
            useJarvisStore.getState().setNewsData(data)
            useJarvisStore.getState().setActiveTab('news')
            useJarvisStore.getState().setIsRightExpanded(true)
            import('@/utils/AudioEngine').then(({ audioEngine }) => {
              audioEngine.playSuccess()
            })
            break
          }

          case 'ide_dir_result': {
            const res = msg.payload as any
            if (res.success && res.items) {
              useJarvisStore.getState().setIdeFileTree(res.items)
              if (res.path) useJarvisStore.getState().setIdeCurrentPath(res.path)
            }
            break
          }

          case 'ide_file_result': {
            const res = msg.payload as any
            if (res.success) {
              useJarvisStore.getState().setIdeActiveFile({
                path: res.path,
                name: res.name,
                content: res.content,
                lines: res.lines
              })
            }
            break
          }

          case 'ide_write_result': {
            import('@/utils/AudioEngine').then(({ audioEngine }) => {
              audioEngine.playSuccess()
            })
            break
          }

          case 'ide_exec_result': {
            const res = msg.payload as any
            useJarvisStore.getState().addIdeTerminalLog({
              command: res.command || 'unknown',
              stdout: res.stdout || '',
              stderr: res.stderr || '',
              exitCode: res.exitCode !== undefined ? res.exitCode : 0,
              durationMs: res.durationMs || 0,
              time: new Date().toLocaleTimeString()
            })
            break
          }

          case 'ide_git_status_result': {
            const res = msg.payload as any
            if (res.success) {
              const prev = useJarvisStore.getState().ideGitState || { branch: '', files: [], commits: [] }
              useJarvisStore.getState().setIdeGitState({ ...prev, branch: res.branch || '', files: res.files || [] })
            }
            break
          }

          case 'ide_git_log_result': {
            const res = msg.payload as any
            if (res.success) {
              const prev = useJarvisStore.getState().ideGitState || { branch: '', files: [], commits: [] }
              useJarvisStore.getState().setIdeGitState({ ...prev, commits: res.commits || [] })
            }
            break
          }

          case 'ide_ai_result': {
            const res = msg.payload as any
            if (res.success) {
              useJarvisStore.getState().setIdeAiResult({
                action: res.action,
                result: res.result,
                language: res.language
              })
              import('@/utils/AudioEngine').then(({ audioEngine }) => {
                audioEngine.playElevate()
              })
            }
            break
          }

          case 'ide_swarm_result': {
            const res = msg.payload as any
            if (res.success) {
              useJarvisStore.getState().setIdeSwarmResult({
                task: res.task,
                swarm: res.swarm
              })
              import('@/utils/AudioEngine').then(({ audioEngine }) => {
                audioEngine.playSuccess()
              })
            }
            break
          }

          default:
            console.log('[WS] Unknown message type:', msg.type)
        }
      } catch (err) {
        console.error('[WS] Failed to parse message:', err)
      }
    },
    [addMessage, addTask, setCurrentModel, setMetrics, setOrbState, setSwapProgress, updateMessage, updateTask]
  )

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    setConnectionStatus('connecting')
    const ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      console.log('[WS] Connected to backend')
      setConnectionStatus('connected')
      setWs(ws)
      reconnectAttempts.current = 0
    }

    ws.onmessage = handleMessage

    ws.onerror = () => {
      console.error('[WS] Connection error')
      setConnectionStatus('error')
    }

    ws.onclose = () => {
      console.log('[WS] Connection closed')
      setConnectionStatus('disconnected')
      setWs(null)
      wsRef.current = null

      /* Auto-reconnect */
      if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts.current += 1
        const delay = RECONNECT_DELAY_MS * Math.min(reconnectAttempts.current, 5)
        console.log(`[WS] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current})`)
        reconnectTimer.current = setTimeout(connect, delay)
      }
    }

    wsRef.current = ws
  }, [wsUrl, handleMessage, setConnectionStatus, setWs])

  useEffect(() => {
    connect()

    return () => {
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current)
      }
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [connect])
}
