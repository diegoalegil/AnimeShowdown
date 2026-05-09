let audioContext = null

function getCtx() {
  if (!audioContext) {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return null
    audioContext = new Ctx()
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume().catch(() => {})
  }
  return audioContext
}

function envelope(gainNode, ctx, peakAt, peak, releaseAt, releaseDur) {
  gainNode.gain.setValueAtTime(0, ctx.currentTime + peakAt - 0.005)
  gainNode.gain.linearRampToValueAtTime(peak, ctx.currentTime + peakAt)
  gainNode.gain.exponentialRampToValueAtTime(
    0.0001,
    ctx.currentTime + releaseAt + releaseDur,
  )
}

export function playClick() {
  const ctx = getCtx()
  if (!ctx) return
  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(1400, now)
  osc.frequency.exponentialRampToValueAtTime(600, now + 0.05)
  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(0.12, now + 0.005)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(now)
  osc.stop(now + 0.1)
}

export function playHover() {
  const ctx = getCtx()
  if (!ctx) return
  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(880, now)
  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(0.05, now + 0.005)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(now)
  osc.stop(now + 0.05)
}

export function playVote() {
  const ctx = getCtx()
  if (!ctx) return
  const now = ctx.currentTime

  // Acorde mayor ascendente (C5, E5, G5, C6) — sensación de victoria anime
  const notes = [
    { freq: 523.25, time: 0 },
    { freq: 659.25, time: 0.06 },
    { freq: 783.99, time: 0.12 },
    { freq: 1046.5, time: 0.22 },
  ]
  notes.forEach(({ freq, time }) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, now + time)
    gain.gain.setValueAtTime(0, now + time)
    gain.gain.linearRampToValueAtTime(0.13, now + time + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + time + 0.45)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now + time)
    osc.stop(now + time + 0.5)
  })

  // Sparkle final (C7)
  const sparkle = ctx.createOscillator()
  const sparkleGain = ctx.createGain()
  sparkle.type = 'sine'
  sparkle.frequency.setValueAtTime(2093, now + 0.22)
  sparkleGain.gain.setValueAtTime(0, now + 0.22)
  sparkleGain.gain.linearRampToValueAtTime(0.06, now + 0.24)
  sparkleGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6)
  sparkle.connect(sparkleGain)
  sparkleGain.connect(ctx.destination)
  sparkle.start(now + 0.22)
  sparkle.stop(now + 0.65)
}
