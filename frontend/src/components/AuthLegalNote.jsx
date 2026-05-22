import { Link } from 'react-router-dom'

function AuthLegalNote({ action = 'continuar' }) {
  return (
    <p className="mt-3 rounded-lg border border-border bg-bg/60 px-4 py-3 text-[12px] leading-relaxed text-fg-muted">
      Al {action}, aceptas los{' '}
      <Link to="/terminos" className="font-semibold text-fg-strong hover:text-gold">
        términos
      </Link>{' '}
      y la{' '}
      <Link to="/privacidad" className="font-semibold text-fg-strong hover:text-gold">
        privacidad
      </Link>
      . Guardamos tu email, perfil público, votos, rachas y preferencias para
      sincronizar la experiencia y proteger el ranking.
    </p>
  )
}

export default AuthLegalNote
