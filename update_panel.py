import re

with open('c:/My_Project/Jarvis/src/renderer/src/components/panels/RightPanel.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

dialogue_tab_new = """function DialogueTab(): React.JSX.Element {
  const messages = useJarvisStore((s) => s.messages)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

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
    <div ref={scrollRef} className="space-y-6 h-full overflow-y-auto pr-3 font-body pb-4">
      {messages.filter((m) => m.role !== 'system').map((msg, i) => (
        <motion.div
          key={msg.id}
          initial={{ opacity: 0, y: 15, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 30, delay: i * 0.05 }}
          className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          {msg.role === 'user' ? (
            <div className="flex flex-col max-w-[85%] items-end">
              <div className="bg-white/10 backdrop-blur-xl border border-white/20 text-white/90 px-4 py-3 rounded-2xl rounded-tr-sm shadow-[0_4px_20px_rgba(0,0,0,0.1)]">
                <p className="text-[13px] tracking-wide font-light leading-relaxed">
                  {msg.content}
                </p>
              </div>
              <span className="text-[9px] text-white/30 mt-1 mr-1">{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
            </div>
          ) : (
            <div className="flex flex-col max-w-[85%] items-start">
              <div className="bg-gradient-to-br from-[rgba(0,212,255,0.15)] to-[rgba(0,100,255,0.05)] backdrop-blur-2xl border border-[rgba(0,212,255,0.3)] text-white px-4 py-3 rounded-2xl rounded-tl-sm shadow-[0_8px_32px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.2)] relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
                <p className="text-[13.5px] font-body leading-relaxed tracking-wide drop-shadow-sm relative z-10">
                  {msg.content}
                  {msg.isStreaming && <span className="inline-block w-2 h-2 bg-white rounded-full ml-2 animate-pulse shadow-[0_0_8px_rgba(255,255,255,0.8)]" />}
                </p>
              </div>
              <div className="flex gap-2 items-center mt-1 ml-1">
                <span className="text-[9px] text-white/30">{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                {msg.model && (
                  <span className="text-[8px] text-[rgba(0,212,255,0.6)] border border-[rgba(0,212,255,0.2)] px-1.5 py-0.5 rounded-full backdrop-blur-md">{msg.model}</span>
                )}
              </div>
            </div>
          )}
        </motion.div>
      ))}
    </div>
  )
}"""

pattern = re.compile(r'function DialogueTab\(\): React\.JSX\.Element \{.*?(?=function MemoryTab)', re.DOTALL)
content = pattern.sub(dialogue_tab_new + '\n\n', content)

# Also fix the border-b of the tabs to be more VisionOS style
content = content.replace('border-astryx-cyan/20', 'border-white/10')
content = content.replace('bg-astryx-surface/40', 'bg-transparent')
content = content.replace('shadow-[0_0_20px_rgba(0,212,255,0.05)]', 'shadow-[0_20px_40px_rgba(0,0,0,0.4)]')

with open('c:/My_Project/Jarvis/src/renderer/src/components/panels/RightPanel.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('RightPanel.tsx updated to VisionOS style!')
