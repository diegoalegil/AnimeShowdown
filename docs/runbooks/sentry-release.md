# Runbook — Sentry releases & source maps

Cómo configurar Sentry con DSN propio + cómo subir source maps en cada deploy para que los stack traces de prod sean legibles.

## Estado actual

- Frontend tiene `@sentry/react` integrado (env-var driven).
- Build de Vite produce source maps en `dist/assets/*.map`.
- DSN aún **no configurado** — Sentry init es no-op en ausencia de `VITE_SENTRY_DSN`.
- Source maps **no se suben** a Sentry actualmente.

## Setup inicial (una vez)

### 1. Crear cuenta y proyecto en Sentry

1. https://sentry.io/signup → cuenta gratis (5K events/mes free tier).
2. Create project → React → nombre `animeshowdown-frontend`.
3. Anota:
   - **DSN** (formato `https://abc@oXXX.ingest.sentry.io/YYY`)
   - **Org slug** (visible en URL: `sentry.io/organizations/<org>/`)
   - **Project slug** (sin espacios, lowercase)

### 2. Crear auth token para subida de source maps

1. https://sentry.io/settings/account/api/auth-tokens/
2. **Create New Token** → permisos: `project:releases`, `org:read`.
3. Copia el token (formato `sntrys_...`) — solo se ve una vez.

### 3. Configurar secrets en GitHub Actions

Repository → Settings → Secrets and variables → Actions → New secret:

| Secret | Valor |
|---|---|
| `SENTRY_DSN` | el DSN del paso 1 |
| `SENTRY_AUTH_TOKEN` | el token del paso 2 |
| `SENTRY_ORG` | tu org slug |
| `SENTRY_PROJECT` | `animeshowdown-frontend` |

### 4. Configurar Cloudflare Pages

Dashboard → animeshowdown → Settings → Environment variables → **Production**:

- `VITE_SENTRY_DSN` = el DSN (el frontend lo lee en build)

Cloudflare Pages redeploya automáticamente.

### 5. Verificar

Visitar `https://animeshowdown.pages.dev/dev/crash-test` (página oculta que lanza `throw new Error("Sentry test")`). En Sentry dashboard, en <2min:

- Evento `Sentry test` aparece
- Stack trace muestra **líneas de tu código fuente original**, no minificado
- Source maps están aplicados (cuadro verde "Source map applied")

Si los stack traces salen minificados (`q.fn (a.js:1:3245)`), el upload de source maps falló — ver troubleshooting.

## Flujo en cada deploy

CI workflow `.github/workflows/sentry-release.yml` (a crear):

```yaml
- name: Build frontend with source maps
  run: cd frontend && npm run build
  env:
    VITE_SENTRY_DSN: ${{ secrets.SENTRY_DSN }}

- name: Upload to Sentry
  uses: getsentry/action-release@v1
  env:
    SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
    SENTRY_ORG: ${{ secrets.SENTRY_ORG }}
    SENTRY_PROJECT: ${{ secrets.SENTRY_PROJECT }}
  with:
    sourcemaps: ./frontend/dist/assets
    version: ${{ github.sha }}
    finalize: true

- name: Strip source maps from dist
  run: rm frontend/dist/assets/*.map
```

Lógica:
1. Build produce `.map` files (con `build.sourcemap: 'hidden'` en `vite.config.js`).
2. Action sube los `.map` a Sentry con el SHA como release version.
3. Borramos los `.map` del dist antes de que Cloudflare suba — **NO queremos source maps públicos en producción** (revelan código y nombres de variables).

## Política de alertas

Crear en Sentry → Alerts → New Alert Rule:

| Alerta | Condición | Notificar |
|---|---|---|
| **Error rate spike** | `>5 events/min during 10min` | Email (canal Slack si lo configuras) |
| **New regression** | Issue reaparece después de marcado `Resolved` | Email |
| **Critical user count** | `>10 users affected by single issue in 1h` | Email |

Setear `environment: production` para no notificar errores de staging/dev.

## Sample rate y costes

Free tier: **5K events/mes**. Con 100 visitas/día y 1% error rate ≈ 30 events/día = 900/mes. Suficiente.

Si llegas al límite:
- `Sentry.init({ tracesSampleRate: 0.1 })` → solo 10% de traces se envían
- `beforeSend(event)` filtra eventos ruidosos (CORS, network errors esperados)

Si quieres apagar Sentry temporalmente:

```bash
# Cloudflare Pages → Variables → eliminar VITE_SENTRY_DSN → Redeploy
# Frontend detecta DSN vacío y hace no-op en Sentry.init
```

## Performance overhead

- `@sentry/react` ~30 KB gzipped en bundle
- Cada evento enviado: ~5-20 KB en background, no bloquea el main thread
- Source maps: 0 KB en cliente (solo en Sentry)

Sin DSN configurado: bundle igual, runtime no-op (sin requests, sin overhead).

## Troubleshooting

### Stack traces salen minificados

Causas comunes:
1. **No se subieron source maps al deploy** → revisar CI logs del action `getsentry/action-release`.
2. **Release version no coincide**: el frontend reporta release X pero los maps están bajo Y. Forzar `Sentry.init({ release: import.meta.env.VITE_SENTRY_RELEASE })` con la misma variable que GH Actions.
3. **Source maps con URLs incorrectos**: en `vite.config.js`, `build.sourcemap: 'hidden'` produce maps sin comentario `//# sourceMappingURL=` en el `.js`. Sentry los matchea por `release` + `filename`. Verificar que los maps subidos tienen el mismo path que los `.js` servidos.

### Eventos duplicados

Causas: `Sentry.init` corriendo dos veces (HMR en dev, React StrictMode). Wrap en check:

```js
if (!window.__SENTRY_INITED__) {
  Sentry.init({ ... })
  window.__SENTRY_INITED__ = true
}
```

### `DSN incorrecto` en consola

DSN copiado mal o expirado. Re-generar en Sentry settings → Client Keys.

## Checklist de "Sentry funciona en prod"

- [ ] `VITE_SENTRY_DSN` configurado en Cloudflare Pages production env
- [ ] `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` configurados en GitHub secrets
- [ ] CI workflow `sentry-release.yml` corre tras cada deploy
- [ ] Visitar `/dev/crash-test` → evento aparece en Sentry en <2min con stack trace decoded
- [ ] Alerta "Error rate spike" creada y testeada
- [ ] Source maps **NO accesibles** en prod (curl `dist/assets/index-*.js.map` → 404)
- [ ] Sample rate y filtros configurados según uso real
