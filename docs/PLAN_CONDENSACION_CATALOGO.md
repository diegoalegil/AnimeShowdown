# Plan: condensar Personajes + Animes en un catálogo único

> Estado: **PROPUESTA — pendiente de revisión del owner**. No ejecutado.
> Origen: revisión de producto 2026-06-04 ("Personajes y Animes se pueden condensar
> en una sección; entras y decides ver por anime o por personaje con sus
> filtros"). Es además la pieza que desbloquea sacar **Cartas** y **PvP** del
> menú "Más".

## 1. Por qué (y por qué necesita tu criterio)

- **UX**: hoy Personajes y Animes son dos entradas separadas en el nav que
  comparten el mismo catálogo. Condensarlas libera un hueco en la barra
  (el header está diseñado para exactamente 5 links primarios a ≥1120px,
  `flex-nowrap`), que es justo lo que permite subir **Cartas** (el gancho) y
  **PvP** al nivel primario sin desbordar la fila.
- **Por qué no lo ejecuté de noche**: toca el **SEO de dos rutas ya indexadas**
  (`/personajes` y `/animes`) y sus deep-links. Hacer redirects mal puede tirar
  posiciones de búsqueda. Es una decisión de producto + SEO que quiero validar
  contigo antes de tocar.

## 2. Estado actual (verificado)

- Rutas (`frontend/src/App.jsx`):
  - `/personajes` → `PersonajesPage`, `/personajes/:slug` → `PersonajeDetailPage`
  - `/animes` → `AnimesPage`, `/animes/:slug` → `AnimeDetailPage`,
    `/animes/:slug/ranking` → `AnimeRankingPage`
  - Todas bajo `<RequireCatalog>` (catalog-aware).
- Datos: **ya unificados**. Ambas páginas leen el mismo catálogo
  (`useCatalogoPersonajes` / `usePersonajesCatalogo`) y el mismo
  `VisualPageShell`. No hay dos fuentes de datos que fusionar.
- Nav (`frontend/src/components/Header.jsx`): `primaryNavLinks` = Personajes,
  Animes, Torneos, Games, Ranking (5). `moreNavLinks` (menú "Más") = Cartas,
  Tier Lists, Fantasy, Feed, Eventos, PvP.

## 3. Diseño propuesto

Una sección **`/catalogo`** con un toggle de modo y filtros propios:

```
┌───────────────────────────────────────────────┐
│  CATÁLOGO            [ Personajes | Animes ]   │  ← toggle de modo
│  Buscar…   Filtros: anime ▾ · rareza ▾ · …     │
├───────────────────────────────────────────────┤
│  (modo Personajes) grid de PersonajeCard       │
│  (modo Animes)      grid de animes con su       │
│                     identidad visual por universo│
└───────────────────────────────────────────────┘
```

- El toggle vive en la URL: `?ver=personajes` (default) / `?ver=animes`, para
  que sea deep-linkable y compartible.
- Reutiliza **íntegros** `PersonajesPage` y `AnimesPage` como los dos modos
  (no se reescriben; se montan dentro de un shell común con el toggle). Coste
  real = componer, no reescribir.
- Las fichas de detalle **NO se tocan**: `/personajes/:slug` y `/animes/:slug`
  siguen igual (deep-links y SEO de detalle intactos).

## 4. SEO y redirects (la parte delicada)

Opción recomendada (conservadora):

1. **Mantener** `/personajes` y `/animes` como URLs canónicas que renderizan el
   nuevo catálogo en el modo correspondiente (no romper nada indexado). El nav
   apunta a una sola entrada "Catálogo" → `/personajes` (o `/catalogo?ver=personajes`).
2. Si se quiere `/catalogo` como URL nueva: redirección **301** de
   `/catalogo` → `/personajes?...` o al revés, eligiendo UNA canónica y poniendo
   `<link rel="canonical">` coherente. Decisión tuya cuál es la canónica.
3. Actualizar `sitemap` y los `breadcrumbs`/JSON-LD para reflejar la estructura
   elegida.

> Riesgo SEO: cambiar la canónica de dos rutas con tráfico puede mover
> posiciones temporalmente. Por eso es decisión tuya, no automática.

## 5. Pasos de implementación (cuando lo apruebes)

1. Crear `CatalogoPage` (shell + toggle por `?ver=`) que monta `PersonajesPage`
   o `AnimesPage` según el modo. Cada uno conserva sus filtros actuales.
2. Cablear el toggle en la URL (searchParams), sin perder el estado de filtros
   al cambiar de modo si es posible.
3. Nav: sustituir las dos entradas (Personajes, Animes) por una sola "Catálogo";
   eso libera un slot → mover **Cartas** a `primaryNavLinks` (gancho) y subir
   **PvP** (o dejar PvP según prefieras).
4. Decidir canónicas + redirects + actualizar sitemap/breadcrumbs/JSON-LD.
5. Tests: e2e de `/personajes` y `/animes` siguen verdes (o se adaptan a la
   nueva URL); test del toggle.

## 6. Esfuerzo y riesgo

- **Esfuerzo**: M-L. La UI se reutiliza; el grueso es el shell del toggle + la
  decisión de SEO/redirects + actualizar nav y sitemap.
- **Riesgo**: medio, **concentrado en SEO** (rutas indexadas). Cero riesgo de
  dominio (no toca economía/voto/torneos).

## 7. Decisiones que necesito de ti

- ¿URL canónica del catálogo: mantener `/personajes` + `/animes`, o crear
  `/catalogo` y redirigir?
- ¿El nav muestra "Catálogo" (una entrada) o prefieres otro nombre (Roster,
  Explorar…)?
- Tras condensar: ¿subo **solo Cartas** a primario, o **Cartas + PvP**?
