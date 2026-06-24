import { api } from '../lib/api'

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  )
}

function DiscordIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path
        fill="#5865F2"
        d="M19.54 5.34A17.4 17.4 0 0 0 15.2 4c-.19.33-.4.78-.55 1.14a16.2 16.2 0 0 0-4.82 0A9.2 9.2 0 0 0 9.27 4a17.5 17.5 0 0 0-4.34 1.34C2.18 9.42 1.44 13.4 1.81 17.32A17.7 17.7 0 0 0 7.13 20c.43-.58.81-1.2 1.14-1.85-.63-.24-1.23-.53-1.8-.87.15-.11.3-.23.44-.35a12.5 12.5 0 0 0 10.66 0c.15.12.29.24.44.35-.57.34-1.17.63-1.8.87.33.65.71 1.27 1.14 1.85a17.7 17.7 0 0 0 5.32-2.68c.44-4.54-.73-8.48-3.13-11.98ZM8.52 14.9c-1.04 0-1.9-.96-1.9-2.14s.84-2.14 1.9-2.14c1.07 0 1.92.97 1.9 2.14 0 1.18-.84 2.14-1.9 2.14Zm6.96 0c-1.04 0-1.9-.96-1.9-2.14s.84-2.14 1.9-2.14c1.07 0 1.92.97 1.9 2.14 0 1.18-.84 2.14-1.9 2.14Z"
      />
    </svg>
  )
}

function rememberNext(next) {
  try {
    const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/'
    sessionStorage.setItem('animeshowdown.oauth.next', safeNext)
  } catch {
    // sessionStorage puede estar bloqueado en private mode; el callback caerá a /.
  }
}

/* linkClassName: piel opcional extra para las anclas (p.ej. la tablilla
   de madera del dojo en /login) sin tocar la lógica del next. */
function AuthSocialButtons({ next = '/', action = 'Entrar', linkClassName = '' }) {
  const providers = [
    {
      id: 'google',
      label: `${action} con Google`,
      href: `${api.base}/oauth2/authorization/google`,
      icon: <GoogleIcon />,
    },
    {
      id: 'discord',
      label: `${action} con Discord`,
      href: `${api.base}/oauth2/authorization/discord`,
      icon: <DiscordIcon />,
    },
  ]

  return (
    <div className="mb-5 rounded-2xl border border-border bg-surface p-4">
      <div className="grid gap-2 sm:grid-cols-2">
        {providers.map((provider) => (
          <a
            key={provider.id}
            href={provider.href}
            onClick={() => rememberNext(next)}
            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border bg-bg px-4 py-2.5 text-sm font-semibold text-fg-strong transition-colors hover:border-accent/60 hover:text-gold focus:outline-none focus:ring-2 focus:ring-gold ${linkClassName}`}
          >
            {provider.icon}
            {provider.label}
          </a>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-3 text-[11px] font-semibold text-fg-muted">
        <span className="h-px flex-1 bg-border" />
        o continúa con email
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  )
}

export default AuthSocialButtons
