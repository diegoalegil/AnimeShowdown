import { Link } from 'react-router-dom'
import {
  LogIn,
  X,
} from 'lucide-react'
import Dialog from '../../../components/Dialog'
import { api } from '../../../lib/api'

function AnonVoteLimitModal({ open, onClose }) {
  const next = encodeURIComponent('/votar')
  return (
    <Dialog
      open={open}
      onClose={onClose}
      titleId="anon-vote-limit-title"
      panelClassName="border-gold/40 shadow-[0_30px_90px_rgba(0,0,0,0.5)]"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-3 top-3 rounded-full border border-border bg-surface p-2 text-fg-muted transition-colors hover:border-gold/50 hover:text-gold"
        aria-label="Cerrar aviso de límite invitado"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-full border border-gold/50 bg-gold/15 text-gold">
        <LogIn className="h-5 w-5" />
      </div>
      <h2 id="anon-vote-limit-title" className="text-2xl font-black text-fg-strong">
        Crea cuenta gratis para seguir votando
      </h2>
      <p className="mt-2 text-sm leading-6 text-fg-muted">
        Ya usaste tus 5 votos invitados. Al entrar, esos votos se migran a tu
        perfil y aparecen en Mi historial.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <a
          href={`${api.base}/oauth2/authorization/google?next=${next}`}
          className="inline-flex items-center justify-center rounded-lg border border-border bg-surface px-4 py-3 text-sm font-bold text-fg-strong transition-colors hover:border-gold/60 hover:text-gold"
        >
          Google
        </a>
        <a
          href={`${api.base}/oauth2/authorization/discord?next=${next}`}
          className="inline-flex items-center justify-center rounded-lg border border-border bg-surface px-4 py-3 text-sm font-bold text-fg-strong transition-colors hover:border-violet-400/60 hover:text-violet-200"
        >
          Discord
        </a>
      </div>
      <Link
        to="/login?next=%2Fvotar"
        className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-gold px-4 py-3 text-sm font-black text-bg transition-transform hover:scale-[1.01]"
      >
        Entrar con email
      </Link>
    </Dialog>
  )
}

export default AnonVoteLimitModal
