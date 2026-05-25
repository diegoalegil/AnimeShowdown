# AGENTS.md

Convenciones permanentes del proyecto AnimeShowdown. Cualquier colaborador o agente automatizado que trabaje en este repositorio debe leerlas antes de tocar código. Si un prompt o instrucción contradice este archivo, este gana.

---

## 1. Autoría de commits

- Autor único: el usuario humano del proyecto. **Nunca** trailers `Co-Authored-By` (de herramientas, asistentes o servicios automáticos) en commits que aterrizan en `main`. En commits intermedios de feature branch se permiten — el squash a main los limpia automáticamente.
- Conventional Commits expandido: `feat | fix | chore | refactor | test | docs | ci | build | perf | style | revert`.
- Un commit = un cambio lógico atómico. Si la verificación falla, revert antes del siguiente.
- Mensajes profesionales, descriptivos, en español o inglés (consistencia dentro del PR).

## 2. Archivos intocables

| Archivo / área | Regla |
|---|---|
| `backend/src/main/resources/db/migration/V1__*.sql` … `V29__*.sql` | Inmutables (desplegadas). Nuevas migraciones desde `V30__`. |
| `frontend/vite.config.js` → `cacheNames` | Debe quedar en `v3` o superior; nunca bajar. |
| `backend/.../security/PrometheusScrapeAuthFilter.java` | Protegido. |
| `frontend/src/lib/i18n.js` → `detection.order` | Debe quedar `['localStorage']`. |
| `backend/.../controller/AuthController.java` → refresh cookie | `SameSite=Lax`, NO Strict. |
| `frontend/playwright.config.js` → `retries` | Mantener `2` en CI. |

## 3. Patrones prohibidos en código

- `useEffect(() => setState(...))` para derived state. Patrón canónico: `frontend/src/components/PersonajeImg.jsx` (derive durante render).
- Hex colors literales en `*.jsx`. Tokens viven en `frontend/src/index.css` (Tailwind v4 `@theme`).
- `git push --force` a `main`. `git reset --hard` sin OK humano explícito. `--no-verify` skip de hooks.
- Llamadas a APIs externas de generación de imágenes desde código del proyecto. La pipeline asistida está permitida; la generación queda fuera del scope de agentes automatizados.
- `useEffect` sin dependency array correcto.

## 4. Estilo visual

- Paleta: tokens declarados en `frontend/src/index.css` con `@theme`. Identidad: dark anime premium con accent gold/aurora. Ningún color hex nuevo en componentes — siempre token.
- Componentes UI base disponibles: `Button`, `Card`, `Section`, `Badge`, `StatPill`, `Skeleton`, `EmptyState`, `ErrorBoundary`, `AssetFallback`, `PersonajeImg`. Reutiliza antes de crear nuevos.

## 5. Territorios entre sesiones paralelas

Si se ejecutan sprints en paralelo, cada owner solo modifica su tipo de utility class Tailwind:

| Owner | Utility classes Tailwind |
|---|---|
| Sesión visual / estilo | `bg-*`, `text-*`, `border-*`, `rounded-*`, `shadow-*`, `font-*`, `transition-*`, `hover:*`, colores |
| Sesión layout / responsive | `w-*`, `min-w-*`, `max-w-*`, `h-*`, `min-h-*`, `flex-*`, `grid-cols-*`, `gap-*`, `p-*`, `m-*`, `overflow-*`, `break-*`, `aspect-*` |

Si un PR necesita tocar utility classes del otro owner, parar y documentar en el handoff.

## 6. Reparto de trabajo en assets visuales (humano ↔ agente)

- **Agente**: infraestructura, helpers, manifest, pipeline R2, integración en componentes, fallbacks visuales, plantillas estéticas reutilizables (paleta, mood, ratio, dimensiones).
- **Humano**: dirección creativa concreta (qué representa cada slot, referencias visuales específicas, ejecución de la generación en herramientas externas, curación de calidad).

Ningún agente automatizado debe escribir prompts diseñados para reproducir personajes o IPs específicas. Esa responsabilidad queda en el humano.

## 7. Condiciones obligatorias de parada

Un agente debe detenerse y reportar (sin auto-resolver) cuando:

- CI rojo persistente con la **misma causa** durante > 4 reintentos sin progreso de diagnóstico. Flakes conocidos (duel-live, etc.) no cuentan.
- El PR introduce un cambio que **contradice explícitamente** una decisión documentada en este archivo o en `BACKLOG.md`. Si no contradice, proceder con juicio.
- Se introduce un coste mensual nuevo (SaaS, cuota API, infraestructura).
- Se requiere cambio de seguridad/auth no listado en el ticket.
- Más de 75 archivos modificados en un PR — **considerar** dividir si tienen alcance temático distinto; permitido sin split si son del mismo tipo (batch de assets, refactor mecánico, sync masivo, etc.).

**Autopilot multi-sprint autorizado**: completar todos los sprints en secuencia (sprint 0 → ... → sprint N del backlog) sin pausa al cerrar uno, salvo que se active una de las condiciones de parada listadas arriba. El push de la rama del sprint y el merge a `main` siguen siendo operaciones separadas — main se mergea con squash desde la rama del sprint, no en vivo.

## 8. Verificación obligatoria antes de cada commit

```bash
cd frontend
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh" && nvm use 22 || node --version
npm run lint
npm run build:no-images
# Solo si el PR toca tests E2E:
npm run test:e2e:responsive 2>&1 | tail -5
```

Backend (solo si el PR toca Java):

```bash
cd backend
./mvnw -q test
```

Todos deben pasar. Si fallan, **diagnosticar y corregir** el origen. `git restore` solo si el cambio en sí es la causa y no hay recovery razonable.

## 9. Auto-merge a ramas de sprint

- Auto-merge **autorizado** a ramas `sprint-N-*`, `visuals/*`, `feature/*`, `fix/*` y `chore/*` con CI verde.
- **Nunca** auto-merge a `main`. Main se mergea manualmente vía PR squash desde la rama del sprint.

## 10. Bitácora de progreso

Cada PR mergeado se anota en `PROGRESS.md` con: ID del PR, commit hash, resultado de verify, timestamp, decisiones tomadas autopilot.

## 11. Higiene del repositorio público

- No publicar informes internos, auditorías auto-generadas, prompts, notas de proceso, ni archivos con nombres que delaten herramientas automatizadas.
- README y `docs/*` reflejan el proyecto como un producto serio mantenido por humanos.
