# Pages Primitive Audit

Read-only audit de oportunidades para aplicar `Button`, `Card`, `Section`, `Badge` y `StatPill` fuera de la home. No se aplico ningun cambio a estas paginas en esta fase.

Heuristicas usadas: `<button>/<Link>` con clases inline, `inline-flex rounded-*`, shells `rounded-2xl|rounded-xl` con `bg/border`, hex literals, y patrones tipograficos `font-mono`, `tabular-nums`, `text-[clamp(...)]`.

## AdminPage.jsx

### Patrones inline
- L61: action/badge/card inline
- L80: action/badge/card inline
- L90: action/badge/card inline
- L102: action/badge/card inline
- L119: action/badge/card inline
- L165: card/panel shell
- L225: card/panel shell
- L249: action/badge/card inline
- ... 15 mas

### Hex literals
- No detectado.

### Inconsistencias tipograficas potenciales
- L59: <span className="font-mono text-gold">ADMIN</span>.
- L80: <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent-soft px-3.5 p
- L84: <h1 className="text-[clamp(2rem,5vw,3rem)] leading-tight tracking-tight">

## AnidelPage.jsx

### Patrones inline
- L222: action/badge/card inline
- L311: action/badge/card inline
- L334: action/badge/card inline
- L343: action/badge/card inline
- L523: action/badge/card inline
- L527: action/badge/card inline

### Hex literals
- No detectado.

### Inconsistencias tipograficas potenciales
- L239: <h1 className="text-[clamp(2.2rem,6vw,4.2rem)] font-extrabold leading-tight tracking-tight">
- L259: <strong className="font-mono font-bold uppercase">
- L271: <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded border border-border bg-b
- L416: className={`inline-flex h-7 w-7 items-center justify-center rounded-md font-mono text-[11px] font-bold ${

## AnimeDetailPage.jsx

### Patrones inline
- L174: action/badge/card inline
- L190: action/badge/card inline
- L192: action/badge/card inline
- L198: action/badge/card inline
- L200: action/badge/card inline
- L205: action/badge/card inline
- L207: action/badge/card inline
- L212: action/badge/card inline
- ... 29 mas

### Hex literals
- No detectado.

### Inconsistencias tipograficas potenciales
- L224: <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gold">
- L230: <p className="mt-4 font-mono text-4xl font-black text-fg-strong">
- L233: <p className="text-[11px] uppercase tracking-[0.16em] text-fg-muted">
- L280: <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-fg-muted">
- L305: <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-gold">
- L335: <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-fg-muted">
- L374: <p className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-gold">
- L388: <span className="font-mono font-bold text-fg-strong">{diferencia}</span>{' '}
- ... 10 mas

## AnimeRankingPage.jsx

### Patrones inline
- L175: action/badge/card inline
- L199: action/badge/card inline
- L207: action/badge/card inline
- L209: action/badge/card inline
- L213: action/badge/card inline
- L217: action/badge/card inline
- L225: card/panel shell
- L280: action/badge/card inline
- ... 18 mas

### Hex literals
- No detectado.

### Inconsistencias tipograficas potenciales
- L226: <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gold">
- L229: <p className="mt-4 font-mono text-4xl font-black text-fg-strong">
- L232: <p className="text-[11px] uppercase tracking-[0.16em] text-fg-muted">
- L273: <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gold">
- L302: <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gold">
- L389: <span className="inline-flex rounded-full border border-current/35 px-2.5 py-0.5 font-mono text-[11px] font-bl
- L406: <p className="mt-1 font-mono text-sm font-black">
- L420: <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-bg font-mono text-sm font-b
- ... 3 mas

## AnimesPage.jsx

### Patrones inline
- L86: card/panel shell
- L98: card/panel shell
- L110: action/badge/card inline
- L150: action/badge/card inline
- L192: action/badge/card inline
- L195: card/panel shell

### Hex literals
- No detectado.

### Inconsistencias tipograficas potenciales
- L87: <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gold">
- L215: <span className="rounded-md border border-white/10 bg-bg/60 px-2 py-0.5 font-mono text-[10px] font-semibold te
- L219: <span className="rounded-md border border-gold/35 bg-gold-soft px-2 py-0.5 font-mono text-[10px] font-bold tex
- L237: <span className="font-mono text-gold"> · {topElo.elo}</span>

## ApiDocsPage.jsx

### Patrones inline
- L230: action/badge/card inline
- L262: action/badge/card inline
- L270: action/badge/card inline
- L283: card/panel shell
- L306: action/badge/card inline
- L310: action/badge/card inline
- L330: card/panel shell

### Hex literals
- No detectado.

### Inconsistencias tipograficas potenciales
- L230: <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-1.5 t
- L234: <h1 className="text-[clamp(2rem,5vw,3rem)] leading-tight tracking-tight">
- L241: <code className="rounded bg-surface px-1 py-0.5 font-mono text-[0.9em] text-fg-strong">
- L347: className={`inline-flex rounded-md px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${
- L355: <code className="break-all font-mono text-[13px] text-fg-strong">
- L361: <pre className="mt-2 overflow-x-auto rounded-md bg-surface-alt p-2 font-mono text-[11px] text-fg-muted">

## ApoyaPage.jsx

### Patrones inline
- L70: action/badge/card inline
- L103: card/panel shell
- L129: card/panel shell
- L152: card/panel shell
- L172: card/panel shell
- L213: card/panel shell
- L220: action/badge/card inline
- L240: card/panel shell

### Hex literals
- No detectado.

### Inconsistencias tipograficas potenciales
- L70: <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent-soft px-3.5 p
- L74: <h1 className="text-[clamp(2rem,5vw,3rem)] leading-tight tracking-tight">
- L107: <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-300">
- L133: <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-fuchsia-300">
- L248: <p className="font-mono text-[13px] tabular-nums text-fg-muted">

## AuthCallbackPage.jsx

### Patrones inline
- L51: card/panel shell

### Hex literals
- No detectado.

### Inconsistencias tipograficas potenciales
- No detectado.

## ComoFuncionaPage.jsx

### Patrones inline
- L52: action/badge/card inline
- L57: action/badge/card inline
- L72: card/panel shell
- L83: action/badge/card inline
- L86: action/badge/card inline
- L89: action/badge/card inline
- L101: card/panel shell

### Hex literals
- No detectado.

### Inconsistencias tipograficas potenciales
- No detectado.

## CompararPage.jsx

### Patrones inline
- L145: action/badge/card inline
- L153: action/badge/card inline
- L174: action/badge/card inline
- L188: card/panel shell
- L213: action/badge/card inline
- L221: action/badge/card inline
- L223: action/badge/card inline
- L227: action/badge/card inline
- ... 8 mas

### Hex literals
- No detectado.

### Inconsistencias tipograficas potenciales
- L191: <p className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-gold">
- L201: <span className="font-mono font-black text-fg-strong">{diferencia}</span>{' '}
- L273: <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gold">
- L331: <p className="truncate text-[9px] font-black uppercase tracking-[0.12em] text-fg-muted">
- L334: <p className={`mt-1 font-mono text-lg font-black ${accent ? 'text-gold' : 'text-fg-strong'}`}>

## CrearTorneoPage.jsx

### Patrones inline
- L179: action/badge/card inline
- L219: action/badge/card inline
- L231: action/badge/card inline
- L246: card/panel shell
- L259: action/badge/card inline
- L280: card/panel shell
- L366: card/panel shell
- L371: action/badge/card inline
- ... 1 mas

### Hex literals
- No detectado.

### Inconsistencias tipograficas potenciales
- L179: <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent-soft px-3.5 p
- L183: <h1 className="text-[clamp(2rem,5vw,3rem)] leading-tight tracking-tight">
- L371: className={`ml-auto inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tabular-nums ${

## DescubrePersonajePage.jsx

### Patrones inline
- L124: action/badge/card inline
- L133: action/badge/card inline
- L147: card/panel shell
- L171: card/panel shell
- L213: action/badge/card inline
- L216: action/badge/card inline
- L221: action/badge/card inline
- L224: action/badge/card inline
- ... 3 mas

### Hex literals
- No detectado.

### Inconsistencias tipograficas potenciales
- L157: <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gold">
- L262: <p className="mt-3 text-[10px] font-black uppercase tracking-[0.16em] text-fg-muted">

## DmcaPage.jsx

### Patrones inline
- L47: action/badge/card inline
- L182: action/badge/card inline
- L186: action/badge/card inline

### Hex literals
- No detectado.

### Inconsistencias tipograficas potenciales
- L47: <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-1.5 t
- L51: <h1 className="text-[clamp(2rem,5vw,3rem)] leading-tight tracking-tight">

## DueloLivePage.jsx

### Patrones inline
- L185: card/panel shell
- L231: card/panel shell
- L233: card/panel shell
- L265: action/badge/card inline
- L268: action/badge/card inline
- L275: action/badge/card inline
- L279: card/panel shell
- L295: card/panel shell
- ... 13 mas

### Hex literals
- No detectado.

### Inconsistencias tipograficas potenciales
- L177: <p className="text-xs font-black uppercase tracking-[0.18em] text-gold">PvP live</p>
- L240: <p className="text-xs font-black uppercase tracking-[0.18em] text-gold">Resultado final</p>
- L257: <span className={`text-2xl font-black tabular-nums ${delta >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
- L310: <span className="text-[11px] font-black uppercase tracking-[0.14em] text-gold">
- L313: <span className="font-mono text-sm font-black tabular-nums text-fg-strong">
- L354: <div className="mt-8 text-7xl font-black tabular-nums text-gold">{formatSeconds(startsIn)}</div>
- L365: <p className="text-xs font-black uppercase tracking-[0.18em] text-gold">Ronda {state.ronda?.numero}</p>
- L375: <div className="text-3xl font-black tabular-nums text-fg-strong">{formatSeconds(remaining)}s</div>
- ... 4 mas

## DueloVersusPage.jsx

### Patrones inline
- L121: action/badge/card inline
- L130: action/badge/card inline
- L162: card/panel shell
- L196: card/panel shell
- L211: action/badge/card inline
- L218: action/badge/card inline
- L220: action/badge/card inline
- L225: action/badge/card inline
- ... 13 mas

### Hex literals
- No detectado.

### Inconsistencias tipograficas potenciales
- L130: <span className="inline-flex w-fit items-center gap-2 rounded-full border border-accent/30 bg-accent-soft px-3
- L135: <h1 className="text-[clamp(2.25rem,6vw,4.8rem)] font-black leading-[0.95] tracking-tight text-fg-strong">
- L199: <p className="text-[11px] font-semibold uppercase tracking-[0.14em]">
- L273: <p className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-gold">
- L330: <p className="mt-0.5 font-mono text-xl font-black">{count}</p>
- L331: <p className="text-[10px] uppercase tracking-[0.12em] text-fg-muted">votos tuyos</p>
- L352: <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-muted">
- L381: <div className="border-x border-border bg-bg/40 px-3 py-3 text-center text-[11px] font-semibold uppercase trac
- ... 3 mas

## EditorialRankingPage.jsx

### Patrones inline
- L164: action/badge/card inline
- L184: action/badge/card inline
- L192: action/badge/card inline
- L196: action/badge/card inline
- L201: action/badge/card inline
- L203: action/badge/card inline
- L211: card/panel shell
- L235: card/panel shell
- ... 15 mas

### Hex literals
- No detectado.

### Inconsistencias tipograficas potenciales
- L212: <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gold">
- L218: <p className="mt-4 font-mono text-4xl font-black text-fg-strong">
- L221: <p className="text-[11px] uppercase tracking-[0.16em] text-fg-muted">
- L236: <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gold">
- L272: <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gold">
- L301: <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gold">
- L354: <span className="inline-flex rounded-full border border-current/35 px-2.5 py-0.5 font-mono text-[11px] font-bl
- L372: <p className="mt-1 font-mono text-sm font-black">
- ... 3 mas

## EventoDetailPage.jsx

### Patrones inline
- L133: action/badge/card inline
- L145: card/panel shell
- L167: action/badge/card inline
- L175: action/badge/card inline
- L177: action/badge/card inline
- L190: card/panel shell
- L199: card/panel shell
- L259: card/panel shell
- ... 6 mas

### Hex literals
- No detectado.

### Inconsistencias tipograficas potenciales
- L152: <span className={`relative inline-flex w-fit items-center gap-1.5 text-[11px] font-semibold uppercase tracking
- L160: <h1 className="text-[clamp(1.75rem,4vw,2.75rem)] leading-tight tracking-tight">
- L191: <span className="inline-flex w-fit items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] t
- L209: <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-fg
- L221: <span className="font-mono text-[12px] text-fg-muted tabular-nums">
- L273: <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-300/15 px-3 py-1 text-[11px] font-blac
- L281: <p className="mt-4 font-mono text-sm font-bold text-gold">
- L300: <span className="font-mono text-[11px] font-black uppercase tracking-[0.12em] text-fg-muted">
- ... 5 mas

## EventosIndexPage.jsx

### Patrones inline
- L170: action/badge/card inline
- L172: card/panel shell
- L185: card/panel shell

### Hex literals
- No detectado.

### Inconsistencias tipograficas potenciales
- L119: <h2 className={`text-[13px] font-semibold uppercase tracking-[0.1em] ${tono}`}>
- L122: <span className="font-mono text-[11px] text-fg-muted tabular-nums">

## FaqPage.jsx

### Patrones inline
- L143: action/badge/card inline
- L157: card/panel shell
- L171: action/badge/card inline
- L206: action/badge/card inline
- L209: action/badge/card inline
- L216: card/panel shell
- L236: action/badge/card inline
- L245: action/badge/card inline
- ... 4 mas

### Hex literals
- No detectado.

### Inconsistencias tipograficas potenciales
- L143: <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-1.5 t
- L147: <h1 className="text-[clamp(2rem,5vw,3rem)] leading-tight tracking-tight">
- L175: className={`min-h-10 rounded-lg px-3 text-xs font-bold uppercase tracking-[0.08em] transition-colors ${
- L277: <span className="ml-auto hidden rounded-full border border-border bg-bg px-2 py-0.5 text-[11px] font-semibold 

## ForgotPasswordPage.jsx

### Patrones inline
- L61: action/badge/card inline
- L71: card/panel shell
- L100: action/badge/card inline
- L109: action/badge/card inline
- L116: action/badge/card inline
- L125: action/badge/card inline

### Hex literals
- No detectado.

### Inconsistencias tipograficas potenciales
- L61: <span className="inline-flex rounded-full border border-border bg-surface px-3.5 py-1.5 text-[12px] font-semib

## GamesHubPage.jsx

### Patrones inline
- L329: card/panel shell
- L344: card/panel shell
- L354: action/badge/card inline
- L357: action/badge/card inline
- L362: action/badge/card inline
- L364: action/badge/card inline
- L373: card/panel shell
- L433: card/panel shell
- ... 14 mas

### Hex literals
- No detectado.

### Inconsistencias tipograficas potenciales
- L330: <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gold">
- L333: <p className="mt-3 font-mono text-4xl font-black text-fg-strong">
- L407: <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-fg-muted">
- L415: <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-fg-muted">
- L423: <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-fg-muted">
- L518: <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-fg-muted">
- L521: <p className="truncate font-mono text-lg font-extrabold tabular-nums text-fg-strong">
- L550: <p className="text-[10px] font-black uppercase tracking-[0.16em] text-gold">
- ... 13 mas

## GlossaryPage.jsx

### Patrones inline
- L380: action/badge/card inline
- L407: action/badge/card inline
- L421: action/badge/card inline
- L458: card/panel shell
- L481: action/badge/card inline
- L485: action/badge/card inline
- L499: card/panel shell
- L510: action/badge/card inline
- ... 4 mas

### Hex literals
- No detectado.

### Inconsistencias tipograficas potenciales
- L380: <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-1.5 t
- L384: <h1 className="text-[clamp(2rem,5vw,3rem)] leading-tight tracking-tight">

## GuessAnimePage.jsx

### Patrones inline
- L177: action/badge/card inline
- L207: card/panel shell
- L269: action/badge/card inline
- L296: action/badge/card inline
- L305: action/badge/card inline
- L308: action/badge/card inline
- L369: action/badge/card inline
- L373: action/badge/card inline
- ... 1 mas

### Hex literals
- No detectado.

### Inconsistencias tipograficas potenciales
- L194: <h1 className="text-[clamp(2.2rem,6vw,4.6rem)] font-extrabold leading-tight tracking-tight">
- L231: className="rounded-full border-2 border-amber-300/80 bg-amber-500/20 px-5 py-2 text-lg font-extrabold uppercas

## GuessCharacterPage.jsx

### Patrones inline
- L194: action/badge/card inline
- L226: card/panel shell
- L290: action/badge/card inline
- L317: action/badge/card inline
- L326: action/badge/card inline
- L329: action/badge/card inline
- L390: action/badge/card inline
- L394: action/badge/card inline
- ... 1 mas

### Hex literals
- No detectado.

### Inconsistencias tipograficas potenciales
- L211: <h1 className="text-[clamp(2.2rem,6vw,4.2rem)] font-extrabold leading-tight tracking-tight">
- L252: className="rounded-full border-2 border-emerald-300/80 bg-emerald-500/20 px-5 py-2 text-lg font-extrabold uppe

## HigherOrLowerPage.jsx

### Patrones inline
- L279: card/panel shell
- L352: card/panel shell
- L394: card/panel shell
- L441: action/badge/card inline
- L445: action/badge/card inline
- L450: action/badge/card inline
- L454: action/badge/card inline
- L491: card/panel shell
- ... 6 mas

### Hex literals
- No detectado.

### Inconsistencias tipograficas potenciales
- L221: <h1 className="text-[clamp(2.4rem,7vw,4.45rem)] font-extrabold leading-tight tracking-tight">
- L292: <span className="font-mono text-2xl font-extrabold tabular-nums text-fg-strong">
- L301: <span className="font-mono text-2xl font-extrabold tabular-nums text-gold">
- L336: <span className="font-mono text-xs font-extrabold tracking-tighter sm:text-base">
- L361: <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-white/80 sm:text-[10px] sm:tracking
- L364: <span className="font-mono text-xl font-extrabold text-white tabular-nums sm:text-4xl">
- L410: <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-white/80 sm:text-[10px] sm:tracking
- L425: <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-white/80 sm:text-[10px] sm:tracking
- ... 5 mas

## ImpostorPage.jsx

### Patrones inline
- L191: action/badge/card inline
- L250: action/badge/card inline
- L259: action/badge/card inline
- L308: card/panel shell
- L376: action/badge/card inline
- L381: card/panel shell
- L467: action/badge/card inline

### Hex literals
- No detectado.

### Inconsistencias tipograficas potenciales
- L208: <h1 className="text-[clamp(2.4rem,6vw,4.6rem)] font-extrabold leading-tight tracking-tight">
- L313: className="pointer-events-none absolute -right-2 -top-4 select-none font-mono text-[7rem] leading-none text-pu
- L320: <span className="inline-flex h-7 items-center justify-center rounded-md bg-purple-500/20 px-2 font-mono text-[
- L329: className={`inline-flex items-center gap-1 font-mono text-[12px] font-bold tabular-nums ${

## InicioPage.jsx

### Patrones inline
- L341: card/panel shell
- L356: card/panel shell
- L458: action/badge/card inline
- L519: action/badge/card inline
- L653: card/panel shell
- L762: card/panel shell
- L776: card/panel shell

### Hex literals
- No detectado.

### Inconsistencias tipograficas potenciales
- L172: <span className="text-[12px] font-semibold uppercase tracking-[0.05em] text-fg-muted">
- L175: <h2 className="text-[clamp(1.75rem,4vw,2.5rem)] tracking-tight">
- L233: <span className="font-mono text-xs font-bold text-gold">
- L348: className={`pointer-events-none absolute -right-4 -top-8 select-none font-mono text-[7rem] font-black leading-
- L426: <p className="font-mono text-2xl font-extrabold tracking-tight text-emerald-200 sm:text-3xl">
- L430: <p className="text-xs font-semibold uppercase tracking-[0.1em] text-fg-muted">
- L454: titleClassName="text-[clamp(1.75rem,4vw,2.5rem)] tracking-tight"
- L455: eyebrowClassName="text-[12px] font-semibold uppercase tracking-[0.05em] text-fg-muted"
- ... 5 mas

## JuegosAnimePage.jsx

### Patrones inline
- L134: action/badge/card inline
- L139: action/badge/card inline
- L163: action/badge/card inline
- L210: action/badge/card inline
- L214: action/badge/card inline
- L245: card/panel shell
- L258: action/badge/card inline
- L260: card/panel shell
- ... 2 mas

### Hex literals
- L73: #2026

### Inconsistencias tipograficas potenciales
- L156: <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gold">
- L181: <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gold">
- L197: <p className="text-[11px] font-black uppercase tracking-[0.18em] text-fg-muted">
- L247: <p className="mt-3 text-[10px] font-black uppercase tracking-[0.18em] text-fg-muted">
- L264: <span className="rounded-full border border-white/10 bg-bg px-2 py-1 text-[10px] font-black uppercase tracking
- L269: <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-gold/80">
- L289: <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft font-mono text-sm f

## LeaderboardsPage.jsx

### Patrones inline
- L67: action/badge/card inline
- L84: action/badge/card inline
- L128: card/panel shell
- L134: action/badge/card inline
- L138: action/badge/card inline
- L142: action/badge/card inline
- L173: card/panel shell
- L181: action/badge/card inline
- ... 1 mas

### Hex literals
- No detectado.

### Inconsistencias tipograficas potenciales
- L67: <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-1.5 t
- L71: <h1 className="text-[clamp(2rem,5vw,3rem)] leading-tight tracking-tight">
- L177: <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300">
- L207: <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-bg font-mono text-sm f
- L217: <p className="font-mono text-base font-bold text-gold">

## LoginPage.jsx

### Patrones inline
- L145: action/badge/card inline
- L158: card/panel shell
- L220: action/badge/card inline
- L228: action/badge/card inline
- L237: action/badge/card inline
- L291: action/badge/card inline
- L303: card/panel shell
- L352: action/badge/card inline
- ... 1 mas

### Hex literals
- No detectado.

### Inconsistencias tipograficas potenciales
- L145: <span className="inline-flex rounded-full border border-border bg-surface px-3.5 py-1.5 text-[12px] font-semib
- L291: <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 
- L330: className={`rounded-lg border bg-bg px-3.5 py-3 text-center font-mono text-2xl tracking-[0.4em] text-fg-strong

## LogrosPage.jsx

### Patrones inline
- L130: action/badge/card inline
- L153: action/badge/card inline
- L160: action/badge/card inline
- L162: action/badge/card inline
- L220: action/badge/card inline
- L244: card/panel shell
- L284: card/panel shell
- L293: action/badge/card inline
- ... 2 mas

### Hex literals
- No detectado.

### Inconsistencias tipograficas potenciales
- L130: <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3
- L134: <h1 className="text-[clamp(2rem,5vw,3rem)] leading-tight tracking-tight">
- L144: <strong className="font-semibold text-fg-strong tabular-nums">
- L321: <span className="text-2xl font-black tabular-nums text-fg-strong">{valor}</span>
- L323: <span className="text-sm text-fg-muted tabular-nums">/ {total}</span>

## MetodologiaEloPage.jsx

### Patrones inline
- L57: action/badge/card inline
- L62: action/badge/card inline
- L88: card/panel shell
- L103: action/badge/card inline
- L106: action/badge/card inline
- L115: card/panel shell
- L128: card/panel shell
- L129: action/badge/card inline

### Hex literals
- No detectado.

### Inconsistencias tipograficas potenciales
- L89: <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gold">

## MiRankingPage.jsx

### Patrones inline
- L135: action/badge/card inline
- L143: action/badge/card inline
- L151: action/badge/card inline
- L161: card/panel shell
- L175: card/panel shell
- L178: action/badge/card inline
- L195: action/badge/card inline
- L197: action/badge/card inline
- ... 15 mas

### Hex literals
- No detectado.

### Inconsistencias tipograficas potenciales
- L162: <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gold">
- L165: <p className="mt-3 font-mono text-5xl font-black text-fg-strong">
- L250: <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gold/40 bg-gold-s
- L277: <p className="font-mono text-2xl font-black text-fg-strong">{item.count}</p>
- L278: <p className="text-[10px] uppercase tracking-[0.14em] text-fg-muted">
- L297: <p className="text-[11px] font-black uppercase tracking-[0.16em] text-gold">
- L313: <p className="font-mono text-lg font-black text-fg-strong">{value}</p>
- L314: <p className="text-[10px] uppercase tracking-[0.12em] text-fg-muted">{label}</p>
- ... 3 mas

## MiTop5Page.jsx

### Patrones inline
- L247: action/badge/card inline
- L260: action/badge/card inline
- L301: card/panel shell
- L313: action/badge/card inline
- L317: action/badge/card inline
- L333: card/panel shell
- L356: card/panel shell
- L377: action/badge/card inline
- ... 12 mas

### Hex literals
- L465: #0d0d12
- L474: #f4f4f5
- L477: #a1a1aa
- L510: #9f1d2c
- L515: #f4f4f5
- L520: #a1a1aa
- L526: #71717a

### Inconsistencias tipograficas potenciales
- L260: <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent-soft px-3.5 p
- L264: <h1 className="text-[clamp(2rem,5vw,3rem)] leading-tight tracking-tight">
- L359: <p className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-gold">

## MisionesPage.jsx

### Patrones inline
- L106: action/badge/card inline
- L114: action/badge/card inline
- L125: card/panel shell
- L236: card/panel shell
- L265: card/panel shell
- L281: card/panel shell
- L323: action/badge/card inline
- L325: card/panel shell

### Hex literals
- No detectado.

### Inconsistencias tipograficas potenciales
- L126: <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gold">
- L129: <p className="mt-3 font-mono text-5xl font-black text-fg-strong">
- L238: <p className="mt-3 text-[10px] font-black uppercase tracking-[0.16em] text-fg-muted">
- L241: <p className="mt-1 font-mono text-2xl font-black text-fg-strong">{value}</p>
- L267: <p className="text-[10px] font-black uppercase tracking-[0.16em] text-gold">
- L296: <p className="text-[9px] font-black uppercase tracking-[0.08em] text-fg-muted">
- L300: className={`mt-2 font-mono text-xl font-black ${

## NewsletterConfirmarPage.jsx

### Patrones inline
- L77: card/panel shell
- L85: card/panel shell
- L89: action/badge/card inline
- L98: card/panel shell
- L105: action/badge/card inline
- L107: action/badge/card inline

### Hex literals
- No detectado.

### Inconsistencias tipograficas potenciales
- No detectado.

## NotFoundPage.jsx

### Patrones inline
- L36: action/badge/card inline
- L38: action/badge/card inline
- L43: action/badge/card inline
- L45: action/badge/card inline

### Hex literals
- No detectado.

### Inconsistencias tipograficas potenciales
- No detectado.

## OmikujiPage.jsx

### Patrones inline
- L220: action/badge/card inline
- L233: action/badge/card inline
- L248: card/panel shell
- L254: card/panel shell
- L267: action/badge/card inline
- L284: card/panel shell
- L348: card/panel shell
- L371: card/panel shell
- ... 4 mas

### Hex literals
- No detectado.

### Inconsistencias tipograficas potenciales
- L233: <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent-soft px-3.5 p
- L237: <h1 className="text-[clamp(2rem,5vw,3rem)] leading-tight tracking-tight">
- L254: className="mb-6 inline-block rounded-2xl border-2 border-amber-500/30 bg-amber-500/5 px-8 py-12 font-mono text
- L322: <em className="not-italic font-mono text-[12px] text-fg-muted">

## PerfilPage.jsx

### Patrones inline
- L113: action/badge/card inline
- L140: action/badge/card inline
- L189: card/panel shell
- L219: action/badge/card inline
- L226: action/badge/card inline
- L240: card/panel shell
- L254: action/badge/card inline
- L266: action/badge/card inline
- ... 19 mas

### Hex literals
- No detectado.

### Inconsistencias tipograficas potenciales
- L113: <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent-soft px-3.5 p
- L117: <h1 className="text-[clamp(2rem,5vw,3rem)] leading-tight tracking-tight">
- L203: className={`font-mono font-bold ${
- L941: className={`tabular-nums text-fg-strong ${t.strong ? 'truncate text-base font-bold' : 'text-2xl font-black'}`}

## PersonajeDetailPage.jsx

### Patrones inline
- L280: action/badge/card inline
- L315: card/panel shell
- L352: action/badge/card inline
- L360: action/badge/card inline
- L364: action/badge/card inline
- L369: action/badge/card inline
- L402: action/badge/card inline
- L410: action/badge/card inline
- ... 41 mas

### Hex literals
- No detectado.

### Inconsistencias tipograficas potenciales
- L352: className="inline-flex items-center gap-1 rounded-full border border-yellow-400/40 bg-yellow-500/10 px-3 py-1 
- L360: <span className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent-soft px-3 py-1 
- L364: <span className="inline-flex rounded-full border border-border bg-surface px-3 py-1 text-[11px] font-semibold 
- L369: className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-3 py-1 text-[11px] f
- L379: className="text-[clamp(2rem,5vw,3.5rem)] leading-tight tracking-tight"
- L475: <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-fg-muted">
- L540: <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.15em] text-fg-muted">
- L552: <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.15em] text-fg-muted">
- ... 11 mas

## PersonajesPage.jsx

### Patrones inline
- L67: card/panel shell
- L426: action/badge/card inline
- L434: action/badge/card inline
- L444: card/panel shell
- L457: card/panel shell
- L478: action/badge/card inline
- L491: card/panel shell
- L505: action/badge/card inline
- ... 24 mas

### Hex literals
- No detectado.

### Inconsistencias tipograficas potenciales
- L68: <p className="text-[10px] font-black uppercase tracking-[0.16em] text-fg-muted">
- L71: <p className="mt-1 font-mono text-2xl font-black text-gold tabular-nums">
- L445: <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gold">
- L700: <p className="text-[11px] font-black uppercase tracking-[0.16em] text-gold">
- L719: <legend className="text-[11px] font-black uppercase tracking-[0.14em] text-fg-muted">
- L737: <legend className="text-[11px] font-black uppercase tracking-[0.14em] text-fg-muted">
- L755: <legend className="text-[11px] font-black uppercase tracking-[0.14em] text-fg-muted">
- L772: <legend className="text-[11px] font-black uppercase tracking-[0.14em] text-fg-muted">
- ... 5 mas

## PrivacyPage.jsx

### Patrones inline
- L53: action/badge/card inline
- L255: action/badge/card inline
- L265: action/badge/card inline
- L269: action/badge/card inline

### Hex literals
- No detectado.

### Inconsistencias tipograficas potenciales
- L53: <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-1.5 t
- L57: <h1 className="text-[clamp(2rem,5vw,3rem)] leading-tight tracking-tight">

## RankingPage.jsx

### Patrones inline
- L174: action/badge/card inline
- L182: action/badge/card inline
- L184: action/badge/card inline
- L189: action/badge/card inline
- L193: action/badge/card inline
- L201: card/panel shell
- L209: action/badge/card inline
- L213: action/badge/card inline
- ... 41 mas

### Hex literals
- No detectado.

### Inconsistencias tipograficas potenciales
- L202: <p className="mb-3 text-[12px] font-bold uppercase tracking-[0.14em] text-amber-300">
- L209: <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border bg-bg/45 px-3 py-1.5 text-
- L280: <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gold">
- L344: <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-gold">
- L417: <code className="font-mono text-[12px]">data/personajes-tags.js</code>.
- L459: className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-semibold uppercase
- L464: <span className="font-mono text-[11px] text-fg-muted tabular-nums" aria-label={`${seccion.personajes.length} p
- L518: className={`absolute left-1.5 top-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded px-1 fo
- ... 19 mas

## RegisterPage.jsx

### Patrones inline
- L140: action/badge/card inline
- L153: card/panel shell
- L288: action/badge/card inline
- L299: action/badge/card inline

### Hex literals
- No detectado.

### Inconsistencias tipograficas potenciales
- L140: <span className="inline-flex rounded-full border border-border bg-surface px-3.5 py-1.5 text-[12px] font-semib
- L266: className="rounded-lg border border-border bg-bg px-3.5 py-2.5 font-mono text-sm tracking-[0.18em] text-fg-str

## ResetPasswordPage.jsx

### Patrones inline
- L74: action/badge/card inline
- L84: card/panel shell
- L199: action/badge/card inline
- L210: action/badge/card inline

### Hex literals
- No detectado.

### Inconsistencias tipograficas potenciales
- L74: <span className="inline-flex rounded-full border border-border bg-surface px-3.5 py-1.5 text-[12px] font-semib
- L133: className={`rounded-lg border bg-bg px-3.5 py-2.5 text-center font-mono text-xl tracking-[0.4em] text-fg-stron

## StatusPage.jsx

### Patrones inline
- L176: action/badge/card inline
- L231: action/badge/card inline

### Hex literals
- L136: #34d399, #ff2e63

### Inconsistencias tipograficas potenciales
- L57: <h2 className="text-[12px] font-black uppercase tracking-[0.14em] text-fg-muted">
- L60: <span className="rounded-full border border-white/10 bg-bg/70 px-2 py-1 font-mono text-[11px] text-fg-muted">
- L64: <p className="font-mono text-3xl font-black tabular-nums text-fg-strong">
- L70: <strong className="font-mono text-fg-strong">
- L76: <strong className="font-mono text-fg-strong">
- L82: <strong className="font-mono text-fg-strong">
- L140: <div className="mt-2 flex items-center justify-between text-[11px] uppercase tracking-[0.12em] text-fg-muted">
- L176: <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-black upperc
- ... 7 mas

## TermsPage.jsx

### Patrones inline
- L45: action/badge/card inline
- L139: action/badge/card inline
- L150: action/badge/card inline
- L212: action/badge/card inline
- L216: action/badge/card inline

### Hex literals
- No detectado.

### Inconsistencias tipograficas potenciales
- L45: <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-1.5 t
- L49: <h1 className="text-[clamp(2rem,5vw,3rem)] leading-tight tracking-tight">

## TorneoDetailPage.jsx

### Patrones inline
- L93: action/badge/card inline
- L156: action/badge/card inline
- L169: card/panel shell
- L182: action/badge/card inline
- L210: action/badge/card inline
- L212: card/panel shell
- L281: action/badge/card inline
- L285: action/badge/card inline
- ... 2 mas

### Hex literals
- No detectado.

### Inconsistencias tipograficas potenciales
- L73: <p className="text-[12px] uppercase tracking-[0.18em] text-fg-muted">
- L182: <span className="relative inline-flex items-center gap-2 rounded-full border border-border bg-surface/70 px-3.
- L188: className="relative text-[clamp(2rem,5vw,3.5rem)] leading-tight tracking-tight"
- L261: <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-fg-muted">
- L299: <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.1em] text-fg-muted">

## TorneosPage.jsx

### Patrones inline
- L102: action/badge/card inline
- L104: action/badge/card inline
- L194: card/panel shell
- L214: action/badge/card inline
- L216: action/badge/card inline
- L234: card/panel shell
- L257: card/panel shell
- L279: action/badge/card inline
- ... 5 mas

### Hex literals
- No detectado.

### Inconsistencias tipograficas potenciales
- L174: <h2 className={`text-[13px] font-semibold uppercase tracking-[0.1em] ${tono}`}>
- L177: <span className="font-mono text-[11px] text-fg-muted tabular-nums">
- L207: <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-200">
- L306: <h2 className="text-[13px] font-semibold uppercase tracking-[0.1em] text-gold">
- L353: <div className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-full border border-border bg-bg px-2.5 py-

## TvModePage.jsx

### Patrones inline
- L91: action/badge/card inline
- L96: action/badge/card inline
- L159: card/panel shell
- L278: card/panel shell

### Hex literals
- No detectado.

### Inconsistencias tipograficas potenciales
- L128: <span className="font-mono">
- L148: <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-gold sm:text-[12px]">
- L151: <h1 className="mt-2 text-[clamp(1.5rem,6vw,5rem)] font-extrabold leading-none">
- L161: <span className="font-mono text-[11px] font-bold text-gold">
- L174: <p className="font-mono text-base font-bold text-gold sm:text-lg">{p.elo}</p>
- L209: <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-gold sm:text-[12px]">
- L212: <h2 className="text-[clamp(1.75rem,6vw,4.5rem)] font-extrabold leading-none">
- L251: <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-gold sm:text-[12px]">
- ... 4 mas

## UsuarioLogrosPage.jsx

### Patrones inline
- L100: action/badge/card inline
- L103: action/badge/card inline
- L129: action/badge/card inline
- L139: action/badge/card inline
- L163: action/badge/card inline
- L200: card/panel shell
- L204: action/badge/card inline

### Hex literals
- No detectado.

### Inconsistencias tipograficas potenciales
- L90: <h1 className="text-[clamp(1.75rem,4vw,2.25rem)] font-bold tracking-tight text-fg-strong">
- L131: className="inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-fg-mute
- L139: <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1
- L143: <h1 className="text-[clamp(1.75rem,4vw,2.5rem)] leading-tight tracking-tight">
- L147: <strong className="font-semibold text-fg-strong tabular-nums">

## UsuarioPage.jsx

### Patrones inline
- L83: action/badge/card inline
- L86: action/badge/card inline
- L160: card/panel shell
- L185: action/badge/card inline
- L196: action/badge/card inline

### Hex literals
- No detectado.

### Inconsistencias tipograficas potenciales
- L73: <h1 className="text-[clamp(1.75rem,4vw,2.25rem)] font-bold tracking-tight text-fg-strong">
- L170: <strong className="font-semibold tabular-nums text-fg-strong">
- L177: <strong className="font-semibold tabular-nums text-fg-strong">

## VerifyPage.jsx

### Patrones inline
- L86: card/panel shell
- L115: action/badge/card inline
- L136: action/badge/card inline
- L138: action/badge/card inline
- L169: action/badge/card inline
- L172: action/badge/card inline

### Hex literals
- No detectado.

### Inconsistencias tipograficas potenciales
- No detectado.

## VotarPage.jsx

### Patrones inline
- L893: action/badge/card inline
- L912: action/badge/card inline
- L917: action/badge/card inline
- L926: action/badge/card inline
- L930: action/badge/card inline
- L975: action/badge/card inline
- L1021: card/panel shell
- L1032: action/badge/card inline
- ... 22 mas

### Hex literals
- L1329: #151923

### Inconsistencias tipograficas potenciales
- L876: <p className="text-[12px] uppercase tracking-[0.18em] text-fg-muted">
- L893: <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 tex
- L952: <h1 className="text-[clamp(1.5rem,3.5vw,2.25rem)] font-extrabold leading-tight tracking-tight">
- L1063: <p className="hidden text-[11px] uppercase tracking-[0.15em] text-fg-muted sm:block">
- L1065: <kbd className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded border border-border bg-su
- L1069: <kbd className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded border border-border bg-su
- L1073: <kbd className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded border border-border bg-su
- L1080: <kbd className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded border border-border bg-su
- ... 4 mas

