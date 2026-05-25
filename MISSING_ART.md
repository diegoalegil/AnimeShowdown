# MISSING_ART

Generado: 2026-05-24T23:36:08.594Z

Manifest anti-fanfiction: no inventa slugs, personajes, animes, eventos, torneos ni juegos. Las fuentes usadas son archivos versionados del repo y assets reales detectados en `frontend/img/` o `frontend/public/assets/`.

## Fuentes y grep usado

- Personajes: `backend/src/main/resources/personajes-seed.json`; `src/data/*.js` no contiene el catalogo de personajes hidratado.
- Grep de shape real: `rg -n 'slug|nombre|anime' backend/src/main/resources/personajes-seed.json frontend/src/data frontend/src/lib`.
- Banners de anime: slugs desde `slugifyAnime()` aplicado a los animes del seed; overrides desde `frontend/src/data/visual-assets.js`.
- Torneos: `backend/src/main/resources/torneos-seed.json` + `frontend/src/data/visual-assets.js`.
- Eventos: `frontend/src/data/eventos.js` + `frontend/src/data/visual-assets.js`.
- Juegos: entries `type: 'game'` en `frontend/src/data/visual-assets.js`.
- Assets reales: `frontend/img/**/*.webp|avif` y `frontend/src/data/visual-assets-manifest.js`.

## Resumen

| Categoria | Declarados | Con asset | Faltantes |
|---|---:|---:|---:|
| Personajes | 1052 | 1052 | 0 |
| Banners de anime | 105 | 105 | 0 |
| Torneos | 13 | 13 | 0 |
| Eventos | 4 | 4 | 0 |
| Juegos | 6 | 6 | 0 |

## Personajes

Fuente: backend/src/main/resources/personajes-seed.json + imagenUrl.

| Slug | Anime/Categoria | Ruta destino | Variantes | Estado |
|---|---|---|---|---|
| _Sin faltantes_ | - | - | - | OK |

### Prompts copia-pega

No se generan prompts: 0 faltantes detectados.

## Banners de anime

Fuente: backend/src/main/resources/personajes-seed.json + frontend/src/lib/animes.js slugifyAnime + frontend/src/data/visual-assets.js.

| Slug | Anime/Categoria | Ruta destino | Variantes | Estado |
|---|---|---|---|---|
| _Sin faltantes_ | - | - | - | OK |

### Prompts copia-pega

No se generan prompts: 0 faltantes detectados.

## Torneos

Fuente: backend/src/main/resources/torneos-seed.json + frontend/src/data/visual-assets.js.

| Slug | Anime/Categoria | Ruta destino | Variantes | Estado |
|---|---|---|---|---|
| _Sin faltantes_ | - | - | - | OK |

### Prompts copia-pega

No se generan prompts: 0 faltantes detectados.

## Eventos

Fuente: frontend/src/data/eventos.js + frontend/src/data/visual-assets.js.

| Slug | Anime/Categoria | Ruta destino | Variantes | Estado |
|---|---|---|---|---|
| _Sin faltantes_ | - | - | - | OK |

### Prompts copia-pega

No se generan prompts: 0 faltantes detectados.

## Juegos

Fuente: frontend/src/data/visual-assets.js type=game.

| Slug | Anime/Categoria | Ruta destino | Variantes | Estado |
|---|---|---|---|---|
| _Sin faltantes_ | - | - | - | OK |

### Prompts copia-pega

No se generan prompts: 0 faltantes detectados.
