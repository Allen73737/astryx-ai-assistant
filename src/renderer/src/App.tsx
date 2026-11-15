import { useEffect, useState, useRef } from 'react'
import './App.css'

interface Message {
  id: string
  sender: 'user' | 'astryx' | 'tool'
  text: string
  toolData?: {
    tool: string
    args?: Record<string, any>
    result?: string
  }
  timestamp: string
}

function App() {
  const [status, setStatus] = useState<string>('connecting')
  const [statusDetail, setStatusDetail] = useState<string>('INITIALIZING ASTRYX NEURAL CORE...')
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome-1',
      sender: 'astryx',
      text: 'Astryx Sovereign Mark IV online. Full computer access granted. Real-time web browsing, system control, and multi-agent reasoning active. Ready for your command, sir.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ])
  const [inputValue, setInputValue] = useState<string>('')
  const [currentStream, setCurrentStream] = useState<string>('')
  const [ws, setWs] = useState<WebSocket | null>(null)
  const [isRecording, setIsRecording] = useState<boolean>(false)

  const audioContextRef = useRef<AudioContext | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const streamAccumulatorRef = useRef<string>('')

  // Auto-scroll chat to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, currentStream])

  // WebSocket Connection Management
  useEffect(() => {
    let socket: WebSocket | null = null
    let reconnectTimer: NodeJS.Timeout

    const connect = () => {
      const wsClient = new WebSocket('ws://localhost:8002/ws')
      socket = wsClient

      wsClient.onopen = () => {
        setStatus('idle')
        setStatusDetail('ALL SYSTEMS OPERATIONAL • GOD-MODE READY')
        setWs(wsClient)
        setupAudioDetection(wsClient)
      }

      wsClient.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          if (data.type === 'status') {
            setStatus(data.payload.startsWith('⚡') ? 'tool' : data.payload)
            setStatusDetail(data.payload.toUpperCase())
          } else if (data.type === 'system_ready') {
            setStatus('idle')
            setStatusDetail(`ONLINE • ${data.payload.tools_count} TOOLS READY`)
          } else if (data.type === 'transcription') {
            const userText = data.payload
            if (userText) {
              setMessages((prev) => [
                ...prev,
                {
                  id: `user-${Date.now()}`,
                  sender: 'user',
                  text: userText,
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }
              ])
            }
          } else if (data.type === 'tool_call') {
            const { tool, args } = data.payload
            setStatus('tool')
            setStatusDetail(`EXECUTING: ${tool}`)
            setMessages((prev) => [
              ...prev,
              {
                id: `tool-${Date.now()}`,
                sender: 'tool',
                text: `Executing ${tool}...`,
                toolData: { tool, args },
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              }
            ])
          } else if (data.type === 'tool_result') {
            const { tool, result } = data.payload
            setMessages((prev) =>
              prev.map((m): Message => {
                if (m.sender === 'tool' && m.toolData && m.toolData.tool === tool && !m.toolData.result) {
                  return {
                    ...m,
                    text: `Completed ${tool}`,
                    toolData: {
                      tool,
                      args: m.toolData.args,
                      result: typeof result === 'string' ? result : JSON.stringify(result)
                    }
                  }
                }
                return m
              })
            )
          } else if (data.type === 'reply_chunk') {
            streamAccumulatorRef.current += data.payload
            setCurrentStream(streamAccumulatorRef.current)
          } else if (data.type === 'reply') {
            const fullReply = data.payload || streamAccumulatorRef.current
            streamAccumulatorRef.current = ''
            setCurrentStream('')
            setMessages((prev) => [
              ...prev,
              {
                id: `ai-${Date.now()}`,
                sender: 'astryx',
                text: fullReply,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              }
            ])
            setStatus('idle')
            setStatusDetail('READY FOR NEXT DIRECTIVE')
          }
        } catch (e) {
          console.error('WS Parse error', e)
        }
      }

      socket.onclose = () => {
        setStatus('offline')
        setStatusDetail('CORE BRAIN DISCONNECTED • RETRYING...')
        reconnectTimer = setTimeout(connect, 3000)
      }

      socket.onerror = () => {
        setStatus('offline')
        socket?.close()
      }
    }

    connect()

    return () => {
      clearTimeout(reconnectTimer)
      socket?.close()
      if (audioContextRef.current) audioContextRef.current.close()
    }
  }, [])

  // Audio Detection & Clap Trigger
  const setupAudioDetection = async (socket: WebSocket) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      mediaRecorderRef.current = new MediaRecorder(stream)
      mediaRecorderRef.current.ondataavailable = (e) => chunksRef.current.push(e.data)
      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        chunksRef.current = []

        const reader = new FileReader()
        reader.readAsDataURL(blob)
        reader.onloadend = () => {
          const base64Audio = reader.result?.toString().split(',')[1]
          if (socket.readyState === WebSocket.OPEN && base64Audio) {
            socket.send(JSON.stringify({ type: 'audio_chunk', payload: base64Audio }))
          }
        }
      }

      const audioCtx = new AudioContext()
      audioContextRef.current = audioCtx
      const analyser = audioCtx.createAnalyser()
      const source = audioCtx.createMediaStreamSource(stream)
      source.connect(analyser)

      analyser.fftSize = 256
      const bufferLength = analyser.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)

      let lastClapTime = 0

      const detectClap = () => {
        analyser.getByteFrequencyData(dataArray)
        let sum = 0
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i]
        }
        const average = sum / bufferLength

        // Clap detection threshold
        if (average > 105 && !isRecording) {
          const now = Date.now()
          if (now - lastClapTime > 2500) {
            lastClapTime = now
            toggleRecording()
          }
        }
        requestAnimationFrame(detectClap)
      }
      detectClap()
    } catch (err) {
      console.warn('Microphone access unavailable or denied', err)
    }
  }

  const toggleRecording = () => {
    if (isRecording) {
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop()
      }
      setIsRecording(false)
      setStatus('thinking')
      setStatusDetail('PROCESSING SPEECH...')
    } else {
      if (!mediaRecorderRef.current) return
      chunksRef.current = []
      mediaRecorderRef.current.start()
      setIsRecording(true)
      setStatus('listening')
      setStatusDetail('LISTENING TO YOUR VOICE...')

      // Auto stop after 7 seconds max
      setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop()
          setIsRecording(false)
          setStatus('thinking')
          setStatusDetail('ANALYZING AUDIO...')
        }
      }, 7000)
    }
  }

  const handleSendMessage = (textToSend?: string) => {
    const query = (textToSend || inputValue).trim()
    if (!query || !ws || ws.readyState !== WebSocket.OPEN) return

    setMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        sender: 'user',
        text: query,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ])

    ws.send(JSON.stringify({ type: 'chat', payload: { text: query, lang: 'en' } }))
    setInputValue('')
    setStatus('thinking')
    setStatusDetail('REASONING & ORCHESTRATING...')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSendMessage()
    }
  }

  const handleQuickAction = (prompt: string) => {
    handleSendMessage(prompt)
  }

  const minimizeWindow = () => window.api?.minimize?.()
  const closeWindow = () => window.api?.close?.()

  return (
    <div className="astryx-container">
      {/* Background Cybernetic Ambient Glows */}
      <div className={`ambient-glow ${status}`}></div>
      <div className="hud-grid-overlay"></div>

      <div className="astryx-panel">
        {/* HUD Top Bar with Window Controls */}
        <header className="hud-header">
          <div className="brand-section">
            <div className={`core-indicator ${status}`}></div>
            <div className="brand-titles">
              <h1 className="brand-logo">ASTRYX <span className="version-pill">MARK IV</span></h1>
              <span className="brand-subtitle">SOVEREIGN AI • FULL COMPUTER ACCESS • WEB CONNECTED</span>
            </div>
          </div>

          <div className="hud-status-badge">
            <span className={`status-dot ${status}`}></span>
            <span className="status-label">{status.toUpperCase()}</span>
          </div>

          <div className="window-controls no-drag">
            <button className="win-btn minimize" onClick={minimizeWindow} title="Minimize">
              ─
            </button>
            <button className="win-btn close" onClick={closeWindow} title="Close">
              ✕
            </button>
          </div>
        </header>

        {/* Central Holographic Reactor Orb */}
        <div className="reactor-zone no-drag" onClick={toggleRecording}>
          <div className={`reactor-orb ${status} ${isRecording ? 'recording' : ''}`}>
            <div className="reactor-ring outer"></div>
            <div className="reactor-ring middle"></div>
            <div className="reactor-core">
              <span className="core-glyph">{isRecording ? '🎙️' : status === 'tool' ? '⚡' : '◈'}</span>
            </div>
          </div>
          <p className="status-detail-text">{statusDetail}</p>
        </div>

        {/* Chat & Output Stream Panel */}
        <div className="conversation-display">
          {messages.map((msg) => (
            <div key={msg.id} className={`message-bubble ${msg.sender}`}>
              <div className="bubble-header">
                <span className="sender-tag">
                  {msg.sender === 'user' ? 'YOU' : msg.sender === 'astryx' ? 'ASTRYX' : '⚡ TOOL'}
                </span>
                <span className="message-time">{msg.timestamp}</span>
              </div>
              <div className="bubble-content">
                {msg.sender === 'tool' && msg.toolData ? (
                  <div className="tool-card">
                    <div className="tool-name">⚡ {msg.toolData.tool}</div>
                    {msg.toolData.args && (
                      <div className="tool-args">{JSON.stringify(msg.toolData.args)}</div>
                    )}
                    {msg.toolData.result && (
                      <div className="tool-result-preview">{msg.toolData.result}</div>
                    )}
                  </div>
                ) : (
                  <p className="bubble-text">{msg.text}</p>
                )}
              </div>
            </div>
          ))}

          {/* Live Streaming Token Preview */}
          {currentStream && (
            <div className="message-bubble astryx streaming">
              <div className="bubble-header">
                <span className="sender-tag">ASTRYX (LIVE)</span>
              </div>
              <div className="bubble-content">
                <p className="bubble-text">{currentStream}<span className="stream-cursor">▌</span></p>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Action Directives */}
        <div className="quick-actions no-drag">
          <button className="action-pill" onClick={() => handleQuickAction('Search the web for the latest breakthrough in artificial intelligence')}>
            🌐 Search Web
          </button>
          <button className="action-pill" onClick={() => handleQuickAction('Give me a full system diagnostic report of CPU, RAM, and storage')}>
            💻 System Specs
          </button>
          <button className="action-pill" onClick={() => handleQuickAction('Fetch the latest breaking technology news')}>
            📰 Tech News
          </button>
          <button className="action-pill" onClick={() => handleQuickAction('List all active windows and top running processes')}>
            🪟 Windows & Tasks
          </button>
          <button className="action-pill" onClick={() => handleQuickAction('What is the current weather forecast?')}>
            🌦️ Weather
          </button>
        </div>

        {/* Command Palette & Text Input Bar */}
        <footer className="command-bar no-drag">
          <button
            className={`mic-button ${isRecording ? 'recording' : ''}`}
            onClick={toggleRecording}
            title={isRecording ? 'Stop Recording' : 'Voice Input'}
          >
            {isRecording ? '⏹' : '🎙'}
          </button>

          <input
            type="text"
            className="command-input"
            placeholder="Ask Astryx anything, search the internet, or issue any computer command..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
          />

          <button
            className="send-button"
            onClick={() => handleSendMessage()}
            disabled={!inputValue.trim() || status === 'offline'}
          >
            <span>TRANSMIT</span> ➔
          </button>
        </footer>
      </div>
    </div>
  )
}

export default App
