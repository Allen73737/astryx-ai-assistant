import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useJarvisStore, type VoiceProfile } from '@/stores/jarvis.store'
import { audioEngine } from '@/utils/AudioEngine'

interface VoiceProfilesProps {
  onSelectVoice: (voice: string) => void
}

export function VoiceProfiles({ onSelectVoice }: VoiceProfilesProps): React.JSX.Element {
  const profiles = useJarvisStore((s) => s.voiceProfiles)
  const activeProfileId = useJarvisStore((s) => s.activeProfileId)
  const setActiveProfileId = useJarvisStore((s) => s.setActiveProfileId)
  const addVoiceProfile = useJarvisStore((s) => s.addVoiceProfile)
  const updateVoiceProfile = useJarvisStore((s) => s.updateVoiceProfile)
  const deleteVoiceProfile = useJarvisStore((s) => s.deleteVoiceProfile)
  const sendWsMessage = useJarvisStore((s) => s.sendWsMessage)

  const [editing, setEditing] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [editName, setEditName] = useState('')
  const [editIcon, setEditIcon] = useState('🎙️')
  const [editVoice, setEditVoice] = useState('en-GB-RyanNeural')
  const [editRate, setEditRate] = useState('+5%')
  const [editPitch, setEditPitch] = useState('-2Hz')

  const ICON_PICKER = ['🎙️', '🎧', '💼', '📖', '🔧', '📰', '👩‍💼', '🌙', '🎭', '🤖', '🎤', '📡']

  const handleActivate = (profile: VoiceProfile) => {
    audioEngine.playSuccess()
    setActiveProfileId(profile.id)
    // Send rate+pitch together so backend applies all at once
    sendWsMessage('set_voice', {
      voice: profile.voice,
      rate: profile.rate,
      pitch: profile.pitch,
    })

    try { localStorage.setItem('astryx-active-profile', profile.id) } catch {}
  }

  const handleStartEdit = (profile: VoiceProfile) => {
    audioEngine.playClick()
    setEditing(profile.id)
    setEditName(profile.name)
    setEditIcon(profile.icon)
    setEditVoice(profile.voice)
    setEditRate(profile.rate)
    setEditPitch(profile.pitch)
  }

  const handleSaveEdit = () => {
    if (!editing || !editName.trim()) return
    audioEngine.playClick()
    updateVoiceProfile(editing, {
      name: editName.trim(),
      icon: editIcon,
      voice: editVoice,
      rate: editRate,
      pitch: editPitch,
    })
    persistProfiles()
    setEditing(null)
  }

  const handleStartCreate = () => {
    audioEngine.playClick()
    setCreating(true)
    setEditName('')
    setEditIcon('🎙️')
    setEditVoice('en-GB-RyanNeural')
    setEditRate('+5%')
    setEditPitch('-2Hz')
  }

  const handleSaveCreate = () => {
    if (!editName.trim()) return
    audioEngine.playClick()
    const id = `custom-${Date.now()}`
    addVoiceProfile({
      id,
      name: editName.trim(),
      icon: editIcon,
      voice: editVoice,
      rate: editRate,
      pitch: editPitch,
    })
    persistProfiles()
    setCreating(false)
  }

  const handleDelete = (id: string) => {
    if (!window.confirm('Delete this voice profile?')) return
    audioEngine.playClick()
    deleteVoiceProfile(id)
    persistProfiles()
  }

  const persistProfiles = () => {
    try {
      localStorage.setItem(
        'astryx-voice-profiles',
        JSON.stringify(useJarvisStore.getState().voiceProfiles)
      )
    } catch { /* ignore */ }
  }

  const isActive = (id: string) => id === activeProfileId

  return (
    <div className="space-y-2">
      {/* Profile Cards */}
      <div className="grid grid-cols-2 gap-2">
        {profiles.map((profile) => (
          <motion.div
            key={profile.id}
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`relative rounded-lg border transition-all cursor-pointer overflow-hidden ${
              isActive(profile.id)
                ? 'border-[#00e5ff]/50 bg-[#00e5ff]/10 shadow-[0_0_12px_rgba(0,229,255,0.08)]'
                : 'border-white/5 hover:border-white/20 bg-white/[0.02] hover:bg-white/[0.04]'
            }`}
          >
            {editing === profile.id ? (
              // Edit mode
              <div className="p-2.5 space-y-2" onClick={(e) => e.stopPropagation()}>
                <div className="flex gap-1.5">
                  <select
                    value={editIcon}
                    onChange={(e) => setEditIcon(e.target.value)}
                    className="bg-black/40 border border-white/10 rounded px-1 text-[10px] cursor-pointer shrink-0"
                  >
                    {ICON_PICKER.map((ic) => (
                      <option key={ic} value={ic}>{ic}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Profile name"
                    className="flex-1 bg-black/40 border border-white/10 rounded px-1.5 py-0.5 text-[9px] font-mono text-white focus:outline-none focus:border-[#00e5ff]/40"
                    autoFocus
                  />
                </div>
                <div className="flex gap-1.5 text-[8px] font-mono">
                  <span className="text-white/40">Voice:</span>
                  <span className="text-white/70 truncate flex-1">{editVoice}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <label className="text-[7px] text-white/30">Rate:</label>
                  <select
                    value={editRate}
                    onChange={(e) => setEditRate(e.target.value)}
                    className="bg-black/40 border border-white/10 rounded px-1 py-0.5 text-[7px] font-mono text-white cursor-pointer flex-1"
                  >
                    <option value="-10%">-10%</option>
                    <option value="-5%">-5%</option>
                    <option value="0%">0%</option>
                    <option value="+5%">+5%</option>
                    <option value="+8%">+8%</option>
                    <option value="+10%">+10%</option>
                  </select>
                  <label className="text-[7px] text-white/30">Pitch:</label>
                  <select
                    value={editPitch}
                    onChange={(e) => setEditPitch(e.target.value)}
                    className="bg-black/40 border border-white/10 rounded px-1 py-0.5 text-[7px] font-mono text-white cursor-pointer flex-1"
                  >
                    <option value="-8Hz">-8Hz</option>
                    <option value="-5Hz">-5Hz</option>
                    <option value="-2Hz">-2Hz</option>
                    <option value="0Hz">0Hz</option>
                    <option value="+2Hz">+2Hz</option>
                    <option value="+5Hz">+5Hz</option>
                    <option value="+8Hz">+8Hz</option>
                  </select>
                </div>
                <div className="flex gap-1.5 justify-end">
                  <button
                    onClick={() => setEditing(null)}
                    className="px-2 py-0.5 text-[7px] border border-white/10 rounded text-white/50 hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    className="px-2 py-0.5 text-[7px] border border-[#00e5ff]/40 rounded text-[#00e5ff] hover:bg-[#00e5ff]/10 cursor-pointer"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              // Display mode
              <div onClick={() => handleActivate(profile)} className="p-2.5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[16px]">{profile.icon}</span>
                    <div>
                      <div className={`text-[9px] font-mono font-bold ${
                        isActive(profile.id) ? 'text-[#00e5ff]' : 'text-white/90'
                      }`}>
                        {profile.name}
                      </div>
                      <div className="text-[7px] font-mono text-white/40 mt-0.5 truncate max-w-[80px]">
                        {profile.voice.split('-').slice(1, 3).join('.')}
                      </div>
                    </div>
                  </div>

                  {/* Active badge */}
                  {isActive(profile.id) && (
                    <span className="px-1 py-0.5 rounded text-[5px] font-mono tracking-widest bg-[#00e5ff]/20 text-[#00e5ff] border border-[#00e5ff]/30 uppercase">
                      Active
                    </span>
                  )}
                </div>

                {/* Rate/Pitch tags */}
                <div className="flex gap-1.5 mt-1.5">
                  <span className="px-1 py-0.5 rounded text-[5px] font-mono border border-white/5 text-white/30">
                    {profile.rate}
                  </span>
                  <span className="px-1 py-0.5 rounded text-[5px] font-mono border border-white/5 text-white/30">
                    {profile.pitch}
                  </span>
                </div>

                {/* Edit/Delete — only for custom profiles */}
                {!['casual', 'professional', 'storytelling', 'technical', 'news-anchor', 'british-female', 'soothing'].includes(profile.id) && (
                  <div className="flex gap-1.5 mt-1.5 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleStartEdit(profile) }}
                      className="px-1.5 py-0.5 text-[6px] border border-white/10 rounded text-white/40 hover:text-white cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(profile.id) }}
                      className="px-1.5 py-0.5 text-[6px] border border-red-500/30 rounded text-red-400 hover:bg-red-500/10 cursor-pointer"
                    >
                      Del
                    </button>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        ))}

        {/* Create new profile card */}
        {creating ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-lg border border-[#00e5ff]/30 bg-[#00e5ff]/5 p-2.5 space-y-2"
          >
            <div className="flex gap-1.5">
              <select
                value={editIcon}
                onChange={(e) => setEditIcon(e.target.value)}
                className="bg-black/40 border border-white/10 rounded px-1 text-[10px] cursor-pointer shrink-0"
              >
                {ICON_PICKER.map((ic) => (
                  <option key={ic} value={ic}>{ic}</option>
                ))}
              </select>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Profile name"
                className="flex-1 bg-black/40 border border-white/10 rounded px-1.5 py-0.5 text-[9px] font-mono text-white focus:outline-none focus:border-[#00e5ff]/40"
                autoFocus
              />
            </div>
            <input
              type="text"
              value={editVoice}
              onChange={(e) => setEditVoice(e.target.value)}
              placeholder="Voice name (e.g. en-US-AriaNeural)"
              className="w-full bg-black/40 border border-white/10 rounded px-1.5 py-0.5 text-[7px] font-mono text-white/70 focus:outline-none focus:border-[#00e5ff]/40"
            />
            <div className="flex items-center gap-1.5">
              <label className="text-[7px] text-white/30">Rate:</label>
              <select
                value={editRate}
                onChange={(e) => setEditRate(e.target.value)}
                className="bg-black/40 border border-white/10 rounded px-1 py-0.5 text-[7px] font-mono text-white cursor-pointer flex-1"
              >
                <option value="-10%">-10%</option>
                <option value="-5%">-5%</option>
                <option value="0%">0%</option>
                <option value="+5%">+5%</option>
                <option value="+8%">+8%</option>
                <option value="+10%">+10%</option>
              </select>
              <label className="text-[7px] text-white/30">Pitch:</label>
              <select
                value={editPitch}
                onChange={(e) => setEditPitch(e.target.value)}
                className="bg-black/40 border border-white/10 rounded px-1 py-0.5 text-[7px] font-mono text-white cursor-pointer flex-1"
              >
                <option value="-8Hz">-8Hz</option>
                <option value="-5Hz">-5Hz</option>
                <option value="-2Hz">-2Hz</option>
                <option value="0Hz">0Hz</option>
                <option value="+2Hz">+2Hz</option>
                <option value="+5Hz">+5Hz</option>
                <option value="+8Hz">+8Hz</option>
              </select>
            </div>
            <div className="flex gap-1.5 justify-end">
              <button
                onClick={() => setCreating(false)}
                className="px-2 py-0.5 text-[7px] border border-white/10 rounded text-white/50 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCreate}
                disabled={!editName.trim()}
                className="px-2 py-0.5 text-[7px] border border-[#00e5ff]/40 rounded text-[#00e5ff] hover:bg-[#00e5ff]/10 disabled:opacity-30 cursor-pointer"
              >
                Create
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.button
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={handleStartCreate}
            className="rounded-lg border border-dashed border-white/10 hover:border-[#00e5ff]/30 bg-white/[0.01] hover:bg-[#00e5ff]/5 transition-all cursor-pointer flex flex-col items-center justify-center py-4 gap-1"
          >
            <span className="text-[14px] text-white/30">+</span>
            <span className="text-[7px] font-mono text-white/30 tracking-wider uppercase">New Profile</span>
          </motion.button>
        )}
      </div>

      <div className="text-[6px] font-mono text-white/20 tracking-wider text-center pt-1">
        Profiles saved to local storage • Default profiles cannot be deleted
      </div>
    </div>
  )
}
