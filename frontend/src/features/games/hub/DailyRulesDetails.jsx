import { ArrowRight } from 'lucide-react'

function DailyRulesDetails() {
  return (
    <details className="group rounded-xl border border-border bg-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
        <div>
          <h3 className="text-sm font-semibold text-fg-muted">
            Detalles del reto diario
          </h3>
          <p className="mt-1 text-[12px] text-fg-muted">
            Reglas de reset, progreso local y resultado compartible.
          </p>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-gold transition-transform group-open:rotate-90" />
      </summary>
      <ul className="flex flex-col gap-1.5 border-t border-border px-4 pb-4 pt-3 text-[13px] text-fg-muted">
        <li>
          · El personaje del día se elige <strong>determinísticamente</strong> por
          fecha local. Todos jugamos contra el mismo.
        </li>
        <li>
          · Reset a medianoche de tu zona horaria. Tu progreso vive en este
          navegador (localStorage, sin tracking).
        </li>
        <li>
          · Al final puedes copiar tu resultado con kanji y compartirlo
          donde quieras.
        </li>
      </ul>
    </details>
  )
}

export default DailyRulesDetails
