import { ExternalLink, Mail, Shield, User } from 'lucide-react'
import { Link } from 'react-router-dom'
import Avatar from '../../../components/Avatar'

function CardDatosCuenta({ user }) {
  return (
    <div className="pattern-overlay pattern-overlay-asanoha rounded-2xl border border-border bg-surface p-6">
      <div className="flex items-center gap-5">
        <Avatar user={user} size={80} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-xl font-bold tracking-tight text-fg-strong">
            {user.username}
          </p>
          <p className="inline-flex items-center gap-1.5 text-[13px] text-fg-muted">
            <Mail className="h-3.5 w-3.5" />
            {user.email || 'sin email'}
          </p>
          <p className="inline-flex items-center gap-1.5 text-[12px]">
            <User className="h-3.5 w-3.5 text-fg-muted" />
            <span
              className={`font-mono font-bold ${
                user.rol === 'ADMIN' ? 'text-gold' : 'text-fg-muted'
              }`}
            >
              {user.rol || 'USER'}
            </span>
            {user.rol === 'ADMIN' && (
              <Shield className="h-3 w-3 text-gold" />
            )}
          </p>
        </div>
      </div>
      <p className="mt-3 text-[11px] italic text-fg-muted">
        Tu email y datos de seguridad no se muestran en tu perfil público.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          to={`/u/${encodeURIComponent(user.username)}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent-soft px-3 py-1.5 text-[12px] font-semibold text-gold transition-colors hover:bg-accent/20"
        >
          <ExternalLink className="h-3 w-3" />
          Ver mi perfil público
        </Link>
        <Link
          to="/votar"
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-accent-hover"
        >
          Votar ahora
        </Link>
      </div>
    </div>
  )
}

export default CardDatosCuenta
