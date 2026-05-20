# Visual assets pendientes (2026-05-20)

Estado tras integrar 33 webp + refactor visual completo. Lo que sigue es lo que **falta** para llegar a la cobertura 100% del sistema. El resolver de `visual-assets.js` cae a SVG abstracto cuando no encuentra `.webp`, así que estos huecos NO rompen nada — solo dejan secciones menos cinematográficas que las demás.

## Imágenes que faltan generar

Genera estos PNGs con ChatGPT Pro usando los prompts de `docs/image-generation-prompts.md`, déjalos en `frontend/img/tmp/` con el slug exacto, y avísame para que repita el pipeline (cwebp + sync-visual-assets).

### Prioridad alta (visible en home y nav)

| Slug | Carpeta destino | Por qué importa |
|---|---|---|
| `my-hero-academia.webp` | anime-banners | Anime top 3, aparece en home + listado |
| `home-pulse.webp` | brand/backgrounds | Fondo de la sección "Ahora mismo" en home |

### Prioridad media (visibles si el usuario explora)

| Slug | Carpeta destino | Por qué |
|---|---|---|
| `death-note.webp` | anime-banners | Anime top 10 |
| `quiet-arena.webp` | empty-states | Fallback genérico de empty states |
| `rainy-rooftop.webp` | error-scenes | Fondo del ErrorBoundary global |

### Prioridad baja (torneos secundarios)

| Slug | Carpeta destino |
|---|---|
| `one-piece-strawhats.webp` | tournament-banners |
| `pillars-of-the-corps.webp` | tournament-banners |
| `shonen-showdown.webp` | tournament-banners |

## Animes que comparten stage genérico

El catálogo tiene 105 universos. Solo 8 tienen banner propio (top elegidos). Los otros 97 caen al stage `/img/stage/animes.webp`. Es **intencional** — generar 105 banners es desproporcionado al impacto.

Si quieres ampliar la cobertura, los siguientes 10 candidatos por popularidad/ELO serían:

- Bleach, Black Clover, Hunter x Hunter, Mob Psycho, Tokyo Revengers
- Vinland Saga, Spy x Family, Cyberpunk Edgerunners, Frieren, Solo Leveling

## Workflow para añadir

1. Copia el prompt correspondiente de `docs/image-generation-prompts.md`
2. Pega en ChatGPT Pro: `Generate as 16:9 cinematic anime UI background. No copyrighted characters. Premium dark tournament platform aesthetic. Safe text area on left third.`
3. Descarga PNG con el slug exacto a `frontend/img/tmp/`
4. Avísame, se procesan todos juntos:
   - `cwebp -q 88 → public/assets/<carpeta>/<slug>.webp`
   - `node scripts/sync-visual-assets.mjs` (regenera el manifest)
   - Commit + push
   - CF Pages despliega en 2-5 min
   - El resolver detecta `.webp` y deja de usar `.svg` automáticamente

No hace falta tocar código en ningún momento.
