# HANDOFF SESSION A - ui/pro-design-system-home

Fecha local de cierre: 2026-05-25.

Worktree usado: `C:\Users\User\Desktop\AnimeShowdown-session-a`.
Rama: `ui/pro-design-system-home`.
Sesion start epoch: `1779664749`.
Duracion real al cierre operativo: 30 min aprox.
Hard stop: no alcanzado. Cola agotada antes de 18h; se para tras push.
Checkpoints 3h: no hubo checkpoint intermedio porque la sesion termino antes de 3h.

## Fases

| Fase | Estado | Notas |
|---|---|---|
| Fase 1 - primitivos core + home | DONE | Button, Card y Section creados/aplicados solo en home/Hero. |
| Fase 2 - MISSING_ART + helper | DONE | Manifest exhaustivo creado; helper solo propuesto en este handoff. |
| Fase 3 - primitivos extras audit-driven | DONE | Badge y StatPill creados por duplicacion >3; Avatar/Tooltip skip. |
| Fase 4 - docs + audit transversal | DONE | JSDoc, catalogo, token audit y page audit creados. |

## Tareas y commits

| Tarea | Estado | Commit |
|---|---|---|
| T0 - `.codex/` en gitignore | DONE | `6d3d14ee` |
| T1 - `Button.jsx` | DONE | `8ab78898` |
| T2 - `Card.jsx` | DONE | `26e6ea8b` |
| T3 - `Section.jsx` | DONE | `cd559baf` |
| T4 - Hero CTAs con Button | DONE | `12900105` |
| T4 - CTAs inline de secciones con Button | DONE | `cade5386` |
| T4 - Cards inline con Card | DONE | `7e62c9d1` |
| T4 - Headers de seccion con Section | DONE | `dc5d82a4` |
| T5 - `MISSING_ART.md` | DONE | `9959a963` |
| T6 - propuesta helper colores dominantes | DONE | Documentada abajo; no se creo script por instruccion explicita. |
| T7 - `Badge.jsx` | DONE | `7c9f5e04` |
| T8 - `StatPill.jsx` | DONE | `f8dcce79` |
| T9 - `Avatar.jsx` | SKIP | Ya existe `frontend/src/components/Avatar.jsx` orientado a usuario; no se duplico API. |
| T10 - `Tooltip.jsx` | SKIP | No habia 3+ tooltips inline con divs absolutos. |
| T11 - JSDoc en primitivos | DONE | `facc64da` |
| T12 - catalogo UI primitives | DONE | `ddd01a17` |
| T13 - token consolidation report | DONE | `0915be58` |
| T14 - audit transversal pages | DONE | `018f56de` |
| T15 - handoff final | DONE | Este archivo; commit generado al cierre. |

## Decisiones autopilot

- El cwd inicial `C:\Users\User\Desktop\AnimeShowdown` estaba en otra rama/sesion QA. Se creo worktree hermano `C:\Users\User\Desktop\AnimeShowdown-session-a` para `ui/pro-design-system-home` y no se toco main.
- `frontend/src/pages/InicioPage.jsx` existe, asi que la sesion continua.
- Se ejecuto `git fetch origin main` y `git rebase origin/main`; la rama quedo actualizada.
- Node disponible: `v24.16.0`. No se encontro nvm usable para Node 22 en este entorno Windows.
- `npm.cmd run build:no-images` falla en PowerShell por asignacion POSIX dentro del script. Se documento como gap de plataforma y se valido con equivalente PowerShell sin modificar `package.json`.
- `frontend/tailwind.config.js` no existe en esta rama; Tailwind v4 usa tokens en `frontend/src/index.css` con `@theme`. No se creo ni modifico config.
- `frontend/src/data/*.js` no expone el catalogo hidratado completo de personajes; para el manifest se uso la fuente real `backend/src/main/resources/personajes-seed.json`, documentando el grep.
- No se generaron imagenes, no se descargaron assets externos y no se tocaron archivos prohibidos.
- `docs/TOKENS_AUDIT.md` y `docs/PAGES_PRIMITIVE_AUDIT.md` estaban ignorados por reglas existentes de `docs/`; se anadieron con `git add -f`.

## Primitivos creados

| Primitivo | API | Uso aplicado |
|---|---|---|
| `Button` | `variant="primary|secondary|ghost"`, `size="sm|md|lg"`, `as`, `className`, `forwardRef` | Hero CTAs y CTAs de secciones en home. |
| `Card` | `as="article"`, `className`, `forwardRef` | Retos, ranking, Bento y pasos de home. |
| `Section` | `eyebrow`, `title`, `description`, `headerAction`, `as` | Bloques principales de home. |
| `Badge` | `variant="ok|warn|err|info"`, `as`, `className` | Eyebrows pequenos del Bento en home. |
| `StatPill` | `icon`, `value`, `label`, `layout="stack|inline"`, `as` | Stats del Hero y stats compactas de home. |

Justificacion extras:

- `Badge`: auditoria detecto mas de 3 ocurrencias de etiquetas `inline-flex`/pill con borde y tipografia mini; se consolido solo en InicioPage.
- `StatPill`: auditoria detecto mas de 3 patrones de metricas numericas con `font-mono`/`tabular-nums`; se consolido en Hero/InicioPage.
- `Avatar`: skip conservador por componente existente no equivalente para personajes.
- `Tooltip`: skip por falta de 3+ tooltips inline absolutos.

## MISSING_ART

Archivo: `MISSING_ART.md`.

Conteos:

| Categoria | Total detectado | Missing |
|---|---:|---:|
| Personajes | 1052 | 0 |
| Banners de anime | 105 | 0 |
| Torneos | 13 | 0 |
| Eventos | 4 | 0 |
| Juegos | 6 | 0 |

Resultado: no se generaron prompts porque no habia assets faltantes. Las tablas quedan con `_Sin faltantes_`.

Grep/documentacion de shape real:

```bash
rg -n 'slug|nombre|anime' backend/src/main/resources/personajes-seed.json frontend/src/data frontend/src/lib
```

## Propuesta T6 - `scripts/extract-dominant-colors.mjs`

No se creo el script. Propuesta para Sesion C:

1. Descubrir `frontend/img/**/*.webp` con `fs.promises.readdir` recursivo.
2. Agrupar variantes por slug base quitando sufijos `-300`, `-600`, `-1024`.
3. No instalar dependencias nuevas.
4. macOS: usar `child_process.execFile("sips", ["-s", "format", "png", input, "--out", tmp])` para convertir muestras y leer una version pequena.
5. Linux/Windows: si no hay decodificador node-only disponible, emitir warning y escribir color fallback por slug desde tokens existentes, sin bloquear build.
6. Salida propuesta: `.codex/dominant-colors.json` para auditoria y, si C lo decide, `frontend/src/data/dominant-colors.generated.json`.
7. Algoritmo: muestrear grid pequeno, ignorar alpha/negros extremos, cuantizar RGB en buckets de 16, elegir bucket dominante y devolver hex + rgb triplet.

## Archivos modificados desde origin/main

```text
.gitignore
MISSING_ART.md
docs/PAGES_PRIMITIVE_AUDIT.md
docs/TOKENS_AUDIT.md
docs/UI_PRIMITIVES.md
frontend/src/components/Badge.jsx
frontend/src/components/Button.jsx
frontend/src/components/Card.jsx
frontend/src/components/Hero.jsx
frontend/src/components/Section.jsx
frontend/src/components/StatPill.jsx
frontend/src/pages/InicioPage.jsx
```

Total: 12 archivos, por debajo del limite de 20.

## Build state

- `npm.cmd run lint`: OK.
- `npm.cmd run build:no-images`: FAIL en PowerShell por sintaxis POSIX del script npm.
- Equivalente PowerShell de `build:no-images`: OK.
- Browser smoke: app Vite arranca en `http://127.0.0.1:5173/`; sin backend local el home renderiza el estado de error `No pudimos cargar los personajes`, sin texto de stack trace.
- Screenshot via navegador integrado: intento de captura fallo por timeout de `Page.captureScreenshot`; no bloquea el cierre porque lint/build equivalentes pasaron.

## Output de comandos finales

### Rama

```text
$ git branch --show-current
ui/pro-design-system-home
```

### Node

```text
$ node --version
v24.16.0
```

### Lint

```text
$ npm.cmd run lint

> frontend@0.0.0 lint
> eslint .
```

### Build directo solicitado

```text
$ npm.cmd run build:no-images

> frontend@0.0.0 build:no-images
> node ../scripts/generate-sitemap.mjs && ANIMESHOWDOWN_SKIP_IMG_COPY=true NODE_OPTIONS=--disable-warning=DEP0205 vite build

   SITEMAP_API_URL no definida - fallback a torneos-seed.json
sitemap.xml generado en C:\Users\User\Desktop\AnimeShowdown-session-a\frontend\public\sitemap.xml
   - 37 rutas estaticas
   - 1052 personajes (con image extension)
   - 105 fichas de anime
   - 105 rankings por anime
   - 13 torneos (seed fallback)
   - 0 usuarios publicos
   - Total: 1312 URLs - 1275 imagenes
"ANIMESHOWDOWN_SKIP_IMG_COPY" no se reconoce como un comando interno o externo,
programa o archivo por lotes ejecutable.
```

Exit code: 1 en PowerShell/cmd por sintaxis POSIX.

### Build equivalente validado

```text
$ node ..\scripts\generate-sitemap.mjs
$env:ANIMESHOWDOWN_SKIP_IMG_COPY='true'
$env:ANIMESHOWDOWN_IMG_CDN_BASE_URL='https://assets.animeshowdown.dev/img'
$env:NODE_OPTIONS='--disable-warning=DEP0205'
$ npx.cmd vite build

SITEMAP_API_URL no definida - fallback a torneos-seed.json
sitemap.xml generado en C:\Users\User\Desktop\AnimeShowdown-session-a\frontend\public\sitemap.xml
Total: 1312 URLs - 1275 imagenes
vite v8.0.14 building client environment for production...
transforming...
2884 modules transformed.
rendering chunks...
computing gzip size...
dist/assets/InicioPage-CpwZJyg7.js                67.24 kB | gzip: 16.90 kB
dist/assets/index-5BrPapnr.js                    171.42 kB | gzip: 53.10 kB
dist/assets/react-vendor-CisRtccu.js             222.08 kB | gzip: 71.33 kB
dist/assets/personaje3d-CqABeVde.js              877.90 kB | gzip: 233.26 kB
built in 2.51s
[img-folder] /img/* servido desde CDN externo: https://assets.animeshowdown.dev/img/:splat
[img-folder] frontend/img/ no se copia al artefacto de build
PWA v1.3.0
mode      generateSW
precache  11 entries (579.57 KiB)
files generated
  dist/sw.js
  dist/workbox-3a82ee25.js
[critical-css] index.html procesado con beasties
```

### Hex audit

```text
$ rg -n "#[0-9a-fA-F]{3,8}" src --glob "!node_modules" | rg -v "(index\.css|tailwind\.config)"
156 matches, all pre-existing in files outside this session scope such as:
src\components\AuthSocialButtons.jsx
src\data\visual-assets.js
src\components\BadgeUnlockListener.jsx
src\components\Card2faSeguridad.jsx
src\pages\MiTop5Page.jsx
src\components\DailyMissionPanel.jsx
src\pages\StatusPage.jsx
src\components\ErrorBoundary.jsx
src\pages\VotarPage.jsx
src\components\Personaje3D.jsx
src\components\PersonajeImg.jsx
src\components\SakuraPetals.jsx
```

Diff check for new hex in touched frontend source:

```text
$ git diff origin/main..HEAD -- frontend/src | rg "#[0-9a-fA-F]{3,8}"
Sin salida.
```

### Git log antes del handoff commit

```text
018f56de docs(audit): primitives application opportunities across all pages
0915be58 docs(tokens): audit current visual tokens and gaps
ddd01a17 docs(ui): add primitives catalog
facc64da docs(ui): add JSDoc with usage examples to all primitives
f8dcce79 feat(ui): add StatPill primitive (4 inline duplicates consolidated)
7c9f5e04 feat(ui): add Badge primitive (3 inline duplicates consolidated)
9959a963 docs(art): add missing-art manifest with ChatGPT-ready prompts
dc5d82a4 refactor(home): replace inline section headers with Section
7e62c9d1 refactor(home): replace inline cards with Card
cade5386 refactor(home): replace inline section CTAs with Button
12900105 refactor(home): replace hero CTAs with Button
cd559baf feat(ui): add reusable Section component
26e6ea8b feat(ui): add reusable Card component
8ab78898 feat(ui): add reusable Button component with tailwind tokens
6d3d14ee chore: ignore .codex session state
```

### Diff stat antes del handoff commit

```text
 .gitignore                           |    1 +
 MISSING_ART.md                       |   85 +++
 docs/PAGES_PRIMITIVE_AUDIT.md        | 1161 ++++++++++++++++++++++++++++++++++
 docs/TOKENS_AUDIT.md                 |   74 +++
 docs/UI_PRIMITIVES.md                |   69 ++
 frontend/src/components/Badge.jsx    |   38 ++
 frontend/src/components/Button.jsx   |   63 ++
 frontend/src/components/Card.jsx     |   37 ++
 frontend/src/components/Hero.jsx     |   39 +-
 frontend/src/components/Section.jsx  |   76 +++
 frontend/src/components/StatPill.jsx |   77 +++
 frontend/src/pages/InicioPage.jsx    |  270 ++++----
 12 files changed, 1810 insertions(+), 180 deletions(-)
```

## Cierre

Queue completa. Siguiente accion: commit de este handoff y push obligatorio a `origin/ui/pro-design-system-home`.
