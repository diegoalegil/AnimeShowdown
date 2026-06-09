# DESIGN.md — Reglas de diseño de AnimeShowdown (anti-"look IA")

> Origen: Meng To / Wes Bos — los **"four horsemen of the apocalypse"** son
> patrones que delatan una UI hecha con IA al instante. Este repo los usaba a
> saturación. Esta guía los prohíbe y define qué hacer en su lugar. **Todo PR de
> UI debe respetarla.** El objetivo no es "menos diseño" sino diseño que parezca
> hecho por una persona con criterio: jerarquía tipográfica real, color con
> intención, asimetría y textura en vez de plantillas.

## Los 4 horsemen — PROHIBIDOS

### H1 — Barra/borde de acento (la "AI stripe")
- ❌ **EVITAR:** barra vertical de color en el borde izquierdo de cards/notifs
  (`border-l-2/4 border-gold/accent`), y cualquier "stripe" decorativa de marca.
- ✅ **EN SU LUGAR:** el oro/carmesí es color de MARCA, no de chrome. Úsalo en
  números clave, iconos, enlaces y estados — no como franja. Las cards llevan un
  **hairline** (`border border-border`) o un tinte de fondo sutil, y lideran con
  el CONTENIDO. Si una card necesita identidad, dásela con tipografía/jerarquía,
  no con una barra.

### H2 — Mayúsculas + letter-spacing ancho (el tell más extendido aquí)
- ❌ **EVITAR:** `uppercase` + `tracking-[≥0.05em]` en eyebrows/kickers/labels/
  badges. Es EL patrón que más grita IA en este repo (261 usos).
- ✅ **EN SU LUGAR:** **sentence case** + tracking por defecto (o `tracking-tight`
  en titulares grandes). La jerarquía se hace con **peso + tamaño + color**, no
  con espaciado. Un eyebrow correcto: `text-xs font-semibold text-fg-muted`
  (sentence case), no `text-[11px] uppercase tracking-[0.18em]`.
- **Excepción única:** mayúsculas LITERALES y semánticas en texto de cuerpo para
  siglas reales (ELO, PvP, VS, SSR) — nunca como recurso de estilo, nunca con
  tracking forzado.

### H3 — Píldoras de estado "● Live"
- ❌ **EVITAR:** el pill `rounded-full border-X/30 bg-X/10` con **punto de color +
  texto de color** ("● En curso", "● Live", "● Madrugador"). Plantilla pura.
- ✅ **EN SU LUGAR:** estado **inline** = punto sólido pequeño (`h-1.5 w-1.5
  rounded-full bg-X`) + texto en peso normal (`text-sm text-fg`/`text-fg-muted`),
  sin burbuja tintada ni glow. Si necesita contenedor, un tag plano con
  `border-border`, sin halo. El color comunica, no decora.

### H4 — Glows de gradiente radial / auroras simétricas
- ❌ **EVITAR:** `radial-gradient(circle at …)` como blob de glow decorativo y las
  auroras simétricas como fondo principal (el sistema procedural actual).
- ✅ **EN SU LUGAR:** superficies **planas tinta­das**, **grano/textura sutil**,
  **imágenes reales** (ya tenemos covers `<picture>` AVIF/WebP), y acentos
  **asimétricos/descentrados** atados al contenido. Si queda un resplandor, que
  sea tenue, off-center y motivado — no un círculo limpio centrado.

## Reglas generales (taste)
- **Referencia siempre:** parte de una imagen/sitio real, no de cero.
- **Jerarquía con tipografía**, no con efectos. Pocos pesos, bien usados.
- **Asimetría > simetría perfecta.** Lo perfectamente centrado/espejado lee a IA.
- **Color con intención**, no "acento por todas partes". Menos saturación de oro.
- **Bordes hairline** y sombras sutiles antes que glows y rings de colores.
- Tokens en `src/index.css`; nada de literales de color en JSX (color-literal guard).

## Mapa de la deuda visual
| Horseman | Archivos | Notas |
|---|---|---|
| H2 uppercase+tracking | ~124 / 261 usos | `uppercase tracking-[0.05–0.3em]`; el grueso del trabajo |
| H1 acento dorado | ~77 | `border-gold/*`, barras de acento |
| H3 pills de estado | ~16 | SectionPulso, NotifBell, "en curso", drops |
| H4 glows radiales | ~13 | VisualSystem (procedural), EditorialCover, GameCardBackground |

## Orden de limpieza visual
1. **Zonas de alta visibilidad primero:** Header + bottom nav, NotifBell, hero
   (`CinematicHero`/`Hero`), cards principales (Editorial/Game/Pulso).
2. **H2 sistemático** por features (el de mayor volumen y más mecánico).
3. **H1 y H3** junto a las zonas que toque.
4. **H4 (sistema procedural)** al final y con cuidado: es lo más identitario.

> Estado del barrido y decisiones por zona se registran en notas privadas de
> producto y en PRs de estilo con alcance acotado.
