# UI resilience primitives

Session C adds shared UI primitives for loading, empty, error, and missing-asset states without changing fetch logic.

## Primitives

### `Skeleton`

```jsx
import Skeleton from '../components/Skeleton'

<Skeleton variant="card" />
<Skeleton variant="line" className="h-16 w-full rounded-lg" />
<Skeleton variant="circle" />
<Skeleton variant="banner" />
```

Variants use `animate-pulse` and `motion-reduce:animate-none`.

### `EmptyState`

```jsx
import { AlertTriangle } from 'lucide-react'
import EmptyState from '../components/EmptyState'

<EmptyState
  icon={AlertTriangle}
  title="No pudimos cargar datos"
  description="Reintenta en unos segundos."
  action={<button className="as-button-primary rounded-lg px-5 py-3">Reintentar</button>}
/>
```

`action` is a slot, so pages can pass a button, link, or grouped actions.

### `ErrorBoundary`

The existing class boundary now supports the section-level API:

```jsx
<ErrorBoundary
  fallback={({ reset }) => (
    <EmptyState title="No pudimos mostrar esta seccion" action={<button onClick={reset}>Reintentar</button>} />
  )}
>
  <CriticalSection />
</ErrorBoundary>
```

The top-level boundary already wraps the app in `main.jsx`.

### `AssetFallback`

`AssetFallback` renders branded artwork fallback for missing character/anime/tournament art. `PersonajeImg` delegates to it only when `imagenPersonaje(slug)` returns the sentinel `/img/_missing/...` path.

```jsx
<AssetFallback slug="luffy" anime="One Piece" dominantColor="var(--color-accent)" />
```

## Coverage

Core pages covered:

- `InicioPage`: catalog guard, skeleton grid, error/empty states, section boundaries.
- `PersonajesPage`: catalog loading/error guard plus existing filter empty state.
- `AnimesPage`: catalog loading/error guard plus existing filter empty state.
- `TorneosPage`: shared skeleton and error state with retry; existing tournament empty state preserved.
- `RankingPage`: shared skeletons and ranking error states.

Secondary pages covered:

- `LeaderboardsPage`: skeleton rows and error state with retry.
- `UsuarioPage`: profile loading skeleton and non-404 error state.
- `UsuarioLogrosPage`: achievements loading skeleton and non-404 error state.
- `TorneoDetailPage`: tournament error state with retry; 404 behavior preserved.
- `AdminPage`: review queues use shared skeletons and error states.
- `AnimeDetailPage`: loading skeleton for catalog-dependent detail.

Skipped or preserved:

- `StatusPage`: already has explicit loading/error UI; skipped to stay within the 20-file guardrail.
- Static/informational pages without fetch state were skipped.
- Game pages with local gameplay state were skipped unless they exposed a simple data-loading pattern.
- `PerfilPage` has nested stats loading state; skipped to avoid touching broad account workflow.

## Notes

- The missing image sentinel is centralized through `MISSING_IMAGE_PREFIX`, so integrating `AssetFallback` in `PersonajeImg` covers all callers using `<PersonajeImg>`.
- `frontend/scripts/generate-dominant-colors.mjs` already exists and uses `sharp`; no new dominant-color script was added because Session C requested no new dependency path.
- `build:no-images` requires `ANIMESHOWDOWN_IMG_CDN_BASE_URL` when `ANIMESHOWDOWN_SKIP_IMG_COPY=true`.
