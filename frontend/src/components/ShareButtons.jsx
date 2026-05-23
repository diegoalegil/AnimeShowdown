import { useState } from 'react'
import { Copy, Link as LinkIcon } from 'lucide-react'
import { toast } from 'sonner'

/**
 * Botones de share multi-plataforma.
 *
 * <p>Construye URLs de intent para Twitter/X, Reddit, WhatsApp,
 * Telegram y Bluesky. Cada plataforma tiene su propio formato:
 *
 * <ul>
 *   <li><b>Twitter/X</b>: {@code twitter.com/intent/tweet?text=...&url=...}</li>
 *   <li><b>Reddit</b>: {@code reddit.com/submit?title=...&url=...}</li>
 *   <li><b>WhatsApp</b>: {@code wa.me/?text=...} (web + mobile)</li>
 *   <li><b>Telegram</b>: {@code t.me/share/url?url=...&text=...}</li>
 *   <li><b>Bluesky</b>: {@code bsky.app/intent/compose?text=...}</li>
 * </ul>
 *
 * <p>Bonus: botón "Copiar enlace" siempre presente como fallback.
 *
 * @param {object} props
 * @param {string} props.url URL absoluta a compartir
 * @param {string} props.texto texto que acompaña el enlace
 */
function ShareButtons({ url, texto }) {
  const [copiado, setCopiado] = useState(false)
  const encodedUrl = encodeURIComponent(url)
  const encodedText = encodeURIComponent(texto)

  const enlaces = [
    {
      nombre: 'X/Twitter',
      bg: 'bg-black hover:bg-zinc-800',
      text: 'text-white',
      href: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
      icon: <XIcon />,
    },
    {
      nombre: 'Reddit',
      bg: 'bg-orange-600 hover:bg-orange-500',
      text: 'text-white',
      href: `https://www.reddit.com/submit?title=${encodedText}&url=${encodedUrl}`,
      icon: <RedditIcon />,
    },
    {
      nombre: 'WhatsApp',
      bg: 'bg-emerald-600 hover:bg-emerald-500',
      text: 'text-white',
      href: `https://wa.me/?text=${encodedText}%20${encodedUrl}`,
      icon: <WhatsAppIcon />,
    },
    {
      nombre: 'Telegram',
      bg: 'bg-sky-600 hover:bg-sky-500',
      text: 'text-white',
      href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
      icon: <TelegramIcon />,
    },
    {
      nombre: 'Bluesky',
      bg: 'bg-blue-600 hover:bg-blue-500',
      text: 'text-white',
      href: `https://bsky.app/intent/compose?text=${encodedText}%20${encodedUrl}`,
      icon: <BlueskyIcon />,
    },
  ]

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1800)
      toast.success('Enlace copiado al portapapeles')
    } catch {
      toast.error('No se pudo copiar')
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {enlaces.map((e) => (
        <a
          key={e.nombre}
          href={e.href}
          target="_blank"
          rel="noopener noreferrer"
          title={`Compartir en ${e.nombre}`}
          aria-label={`Compartir en ${e.nombre}`}
          className={`inline-flex h-9 w-9 items-center justify-center rounded-lg transition-transform hover:-translate-y-0.5 ${e.bg} ${e.text}`}
        >
          {e.icon}
        </a>
      ))}
      <button
        type="button"
        onClick={handleCopy}
        aria-label="Copiar enlace"
        title="Copiar enlace"
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-[12px] font-semibold text-fg-strong transition-colors hover:border-accent/40"
      >
        {copiado ? <LinkIcon className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
        {copiado ? 'Copiado' : 'Copiar enlace'}
      </button>
    </div>
  )
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}
function RedditIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm5.5 11a1 1 0 010-2c.49 0 .92.355 1 .835.05.328.05.336 0 .335a1 1 0 01-1 .83zm-11 0a1 1 0 010-2c.49 0 .92.355 1 .835.05.328.05.336 0 .335a1 1 0 01-1 .83zm5.5 4.5c-1.93 0-3.5-1.12-3.5-2.5h7c0 1.38-1.57 2.5-3.5 2.5z" />
    </svg>
  )
}
function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.413c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.65 5.45l-.999 3.648 3.838-.997zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.017-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z" />
    </svg>
  )
}
function TelegramIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.94z" />
    </svg>
  )
}
function BlueskyIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d="M5.328 4.328c2.65 2.072 5.485 6.245 6.672 8.481 1.187-2.236 4.023-6.41 6.672-8.481C20.55 2.997 23.5 1.99 23.5 5.4c0 .68-.394 5.713-.626 6.532-.807 2.84-3.692 3.566-6.252 3.13 4.467.76 5.61 3.31 3.156 5.86-4.665 4.847-6.706-1.218-7.229-2.77-.096-.286-.143-.428-.143-.296 0-.132-.047.01-.143.295-.523 1.553-2.564 7.618-7.229 2.771-2.454-2.55-1.311-5.1 3.157-5.86-2.56.435-5.446-.291-6.252-3.131C.7 11.114.305 6.08.305 5.4c0-3.41 2.95-2.403 5.022-1.072z" />
    </svg>
  )
}

export default ShareButtons
