import { useState } from 'react'
import './marcos.css'
import { marcoClass } from '../lib/marcos'

function hashStr(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

function colorFromEmail(email) {
  if (!email) return 'hsl(330, 65%, 45%)'
  const hue = hashStr(email) % 360
  return `hsl(${hue}, 60%, 45%)`
}

function initials(label) {
  if (!label) return '?'
  const parts = String(label).trim().split(/\s+/)
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (
    parts[0].charAt(0) + parts[parts.length - 1].charAt(0)
  ).toUpperCase()
}

function Avatar({ user, size = 32, className = '', marco }) {
  const src = user?.avatarUrl
  const [failedSrc, setFailedSrc] = useState(null)
  const label = user?.username || user?.nombre || user?.email
  const ini = initials(label)
  const bg = colorFromEmail(user?.email || user?.username || 'anon')

  const cara =
    src && failedSrc !== src ? (
      <img
        src={src}
        alt={label ? `Avatar de ${label}` : 'Avatar'}
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        onError={() => setFailedSrc(src)}
        className={`shrink-0 rounded-full object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    ) : (
      <span
        role="img"
        aria-label={label ? `Avatar de ${label}` : 'Avatar'}
        className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white ${className}`}
        style={{
          width: size,
          height: size,
          background: bg,
          fontSize: Math.max(10, Math.round(size * 0.4)),
        }}
      >
        {ini}
      </span>
    )

  // Marco de avatar (cosmético): aro/aura alrededor. `marco` explícito (preview
  // del picker) o el equipado del usuario. Si no hay marco válido, se devuelve
  // el avatar tal cual (cero coste, mismo markup que antes).
  const claseMarco = marcoClass(marco ?? user?.marcoAvatar)
  if (!claseMarco) return cara
  return <span className={`marco ${claseMarco}`}>{cara}</span>
}

export default Avatar
