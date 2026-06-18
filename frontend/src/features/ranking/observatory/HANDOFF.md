# Observatorio del meta — notas de handoff

Pieza ULTRA (#118): el ranking como cielo nocturno. Vive como pestaña
**Observatorio** en `/ranking` (convive con la tabla clásica, no la sustituye).

## Ficheros

| Fichero | Rol |
|---|---|
| `observatory-core.js` | Módulo PURO (sin React/DOM/Math.random/Date). Proyección determinista ELO→cielo + aritmética del escrutador. |
| `SkyStar.jsx` | Estrella memoizada: retrato circular + halo pre-horneado + estela. Enlace focusable a la ficha. |
| `ConstellationLayer.jsx` | 1 SVG, un `<path>` hairline oro por anime (pathLength=1 dashoffset). |
| `TideScrubber.jsx` | Slider temporal controlado (marcas por día, aria-live). Deshabilitado honesto sin serie. |
| `MetaObservatory.jsx` | Orquestador: lienzo, pan/zoom por ref, timing, leyenda, escrutador, teclado. |
| `observatory.css` | CSS de feature (todos los @keyframes; CSP por hash, cero estilos en runtime). |

## Timing (por acto)

- **Encendido**: stagger 90 ms por constelación (`STAGGER_CONSTEL_MS`) + 40 ms por
  rango dentro del anime; cada estrella fade+scale 0.6→1 en 350 ms (`sky-encender`).
- **Trazos**: entran +200 ms tras su constelación; dibujado 450 ms (`constelacion-trazo`).
- **Pan**: 1:1 con el puntero; inercia ~120 px de glide vía transición 450 ms al soltar.
- **Zoom**: 2 niveles (1 ↔ 1.8), transición 450 ms `--ease-lift` del transform del lienzo.
- **Escrutador**: deriva de las estrellas 600 ms `--ease-lift`; estelas 800 ms una pasada.
- **Titileo** de subidas de hoy: WAAPI one-shot 900 ms al entrar en viewport.

## Puntos de integración (ya cableado en `RankingPage.jsx`)

- Pestaña `observatorio` en `ranking-tabs.js`. Render con `React.lazy` + `Suspense`
  (chunk propio → cero impacto en el bundle inicial).
- `ranking`: `rankedElo.slice(0, 60)` adaptado a `{slug, nombre, anime, elo, posicion}`.
- `hrefPersonaje`: `(slug) => '/personajes/' + slug` (morph personaje-hero enganchable).
- `fecha`: fecha local formateada.
- `onVolverTabla`: vuelve a la pestaña ELO.

### Navegación de las estrellas (decisión de producto)

`SkyStar` usa `<a href>` (prop `hrefPersonaje`), desacoplado y testeable
standalone. Hoy navega con **recarga completa**. Para navegación client-side +
el morph personaje-hero (view transitions same-document, `lib/viewTransitions.js`),
sustituir/envolver el ancla por `AppLink` con `onViewTransitionStart={markPersonajeHero}`
en la integración (patrón de `CategoriaCard`). No bloquea: la ficha carga igual.

### Carga en frío

Deep-link a `/ranking?tab=observatorio` con el catálogo sin hidratar muestra
un skeleton (no un cielo vacío), coherente con el resto de pestañas.

### Props opcionales aún sin cablear (decisión de producto)

- **`movimientos`** (escrutador de mareas): el endpoint actual
  `ranking-movimientos` da SOLO 2 anclas (hoy vs hace N días), NO una serie
  diaria. Por honestidad NO se inventa la serie: hoy el escrutador se muestra
  deshabilitado con nota honesta. Para encenderlo, dos caminos:
  1. **Backend**: endpoint `ranking-movimientos-diario` que devuelva
     `Array<{slug, posicionesPorDia:number[7]}>` (posición global por día). Pásalo
     tal cual como prop `movimientos`. La pieza ya lo soporta y está testeada.
  2. **Aproximación en el padre** (permitido por el spec si se documenta):
     interpolar entre `posicionHace7d` y `posicionActual`. Si se elige, rotular en
     UI que los días intermedios son aproximados (coherente con el resto de la app).
- **`slugDestacado`**: la estrella del propio usuario (aro oro + "tú"). Cablear
  con el top personal del usuario cuando exista esa señal en esta página.

## Riesgos Safari / WebKit

- Cero `blur()`/`backdrop-blur` y cero filtros SVG vivos: el halo es un degradado
  radial pre-horneado con opacity (cross-fade), no blur. El glow no produce jank.
- `vector-effect: non-scaling-stroke` mantiene los trazos finos bajo el zoom.
- El pan escribe `transform` por ref (cero re-render por frame). La deriva del
  escrutador es una transición CSS (un re-render por paso de día, no por frame).

## Kanji / sonidos

- **Kanji nuevos**: ninguno (la pieza no usa kanji; el guard de subset pasa intacto).
- **Sonidos**: ninguno (el observatorio es silencioso por diseño). Si se quisiera
  un toque, `playClick`/`playWhoosh` de `lib/sounds.js` respetan el mute global.

## Criterios de aceptación (estado)

1. Proyección 100 % determinista (mismo input → mismo cielo): ✅ test.
2. Pan/scrub sin re-render por frame (transform por ref): ✅.
3. Cada estrella alcanzable por teclado en orden de ranking: ✅ (links en orden +
   flechas mueven el foco; el lienzo sigue al foco).
4. Estelas solo en scrub real, no al montar: ✅.
5. 60 fps con 60 estrellas + pan en móvil medio: por validar en dispositivo real.
6. Convive con la tabla clásica (cero regresión): ✅ (pestaña nueva).
