/**
 * Soft ding for new support customer messages.
 * State is on globalThis so duplicate module copies share one player/throttle
 * (otherwise Listener + ConversationList can both ding).
 */

const SOUND_SRC = '/sounds/support-notify.mp3'
const GLOBAL_KEY = '__ntgSupportNotifySound'

type SoundState = {
  audio: HTMLAudioElement | null
  lastSoundAt: number
  unlocked: boolean
}

function getState(): SoundState {
  const g = globalThis as typeof globalThis & { [GLOBAL_KEY]?: SoundState }
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = { audio: null, lastSoundAt: 0, unlocked: false }
  }
  return g[GLOBAL_KEY]
}

function getAudio() {
  if (typeof window === 'undefined') return null
  const s = getState()
  // Recreate if an older build cached a different file (e.g. .wav).
  if (s.audio && !s.audio.src.includes('support-notify.mp3')) {
    s.audio.pause()
    s.audio = null
  }
  if (!s.audio) {
    s.audio = new Audio(SOUND_SRC)
    s.audio.preload = 'auto'
    s.audio.volume = 0.55
  }
  return s.audio
}

/** Call once from a user gesture so later plays are allowed. */
export function unlockSupportNotifySound() {
  const s = getState()
  if (s.unlocked || typeof window === 'undefined') return
  s.unlocked = true
  const el = getAudio()
  if (!el) return
  const prev = el.volume
  el.volume = 0
  void el
    .play()
    .then(() => {
      el.pause()
      el.currentTime = 0
      el.volume = prev
    })
    .catch(() => {
      el.volume = prev
      s.unlocked = false
    })
}

export function playSupportNotifySound() {
  const s = getState()
  const now = Date.now()
  if (now - s.lastSoundAt < 2000) return
  s.lastSoundAt = now

  try {
    const el = getAudio()
    if (!el) return
    el.currentTime = 0
    void el.play().catch(() => {
      // Autoplay can still block until unlockSupportNotifySound runs.
    })
  } catch {
    // ignore
  }
}
