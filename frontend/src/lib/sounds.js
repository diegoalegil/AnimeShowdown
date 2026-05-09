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

function noiseBuffer(ctx, duration) {
  const length = Math.floor(ctx.sampleRate * duration)
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / length)
  }
  return buffer
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

// Sword whoosh — bandpass-swept noise (transición/menu open)
export function playWhoosh() {
  const ctx = getCtx()
  if (!ctx) return
  const now = ctx.currentTime
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer(ctx, 0.25)
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.Q.value = 6
  filter.frequency.setValueAtTime(2400, now)
  filter.frequency.exponentialRampToValueAtTime(500, now + 0.22)
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.12, now)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25)
  src.connect(filter)
  filter.connect(gain)
  gain.connect(ctx.destination)
  src.start(now)
}

// Magic sparkle — 6 sines high-freq apilados aleatoriamente (login/register success)
export function playMagic() {
  const ctx = getCtx()
  if (!ctx) return
  const now = ctx.currentTime
  const baseFreqs = [1568, 1760, 2093, 2349, 2637, 3136]
  baseFreqs.forEach((freq, i) => {
    const t = now + i * 0.04 + Math.random() * 0.03
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, t)
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(0.05, t + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(t)
    osc.stop(t + 0.45)
  })
}

// Impact — sub-bass thump + filtered noise (kapow al votar contundente o VS reveal)
export function playImpact() {
  const ctx = getCtx()
  if (!ctx) return
  const now = ctx.currentTime
  // Sub-bass thump
  const osc = ctx.createOscillator()
  const oscGain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(180, now)
  osc.frequency.exponentialRampToValueAtTime(60, now + 0.15)
  oscGain.gain.setValueAtTime(0, now)
  oscGain.gain.linearRampToValueAtTime(0.25, now + 0.005)
  oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2)
  osc.connect(oscGain)
  oscGain.connect(ctx.destination)
  osc.start(now)
  osc.stop(now + 0.22)
  // Crack noise
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer(ctx, 0.12)
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.setValueAtTime(1800, now)
  filter.Q.value = 4
  const noiseGain = ctx.createGain()
  noiseGain.gain.setValueAtTime(0.15, now)
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12)
  src.connect(filter)
  filter.connect(noiseGain)
  noiseGain.connect(ctx.destination)
  src.start(now)
}

// Level up / power up — fanfare ascendente largo (achievement)
export function playLevelUp() {
  const ctx = getCtx()
  if (!ctx) return
  const now = ctx.currentTime
  // Arpegio mayor mas rápido y más alto
  const notes = [
    { freq: 392.0, time: 0 },
    { freq: 523.25, time: 0.08 },
    { freq: 659.25, time: 0.16 },
    { freq: 783.99, time: 0.24 },
    { freq: 1046.5, time: 0.32 },
    { freq: 1318.51, time: 0.42 },
  ]
  notes.forEach(({ freq, time }) => {
    const t = now + time
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(freq, t)
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(0.1, t + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(t)
    osc.stop(t + 0.55)
  })
  // Sparkle final largo
  const sparkle = ctx.createOscillator()
  const sparkleGain = ctx.createGain()
  sparkle.type = 'sine'
  sparkle.frequency.setValueAtTime(2637, now + 0.42)
  sparkleGain.gain.setValueAtTime(0, now + 0.42)
  sparkleGain.gain.linearRampToValueAtTime(0.08, now + 0.45)
  sparkleGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.0)
  sparkle.connect(sparkleGain)
  sparkleGain.connect(ctx.destination)
  sparkle.start(now + 0.42)
  sparkle.stop(now + 1.05)
}
