# SEO Testing & Setup — AnimeShowdown

Guía operacional para SEO técnico, configuración externa (DNS, Search
Console, IndexNow) y mediciones manuales de Core Web Vitals.

---

## 5.7 · IndexNow + Search Console + Bing

### IndexNow (Bing + Yandex + Seznam)

El backend hace ping automático a IndexNow cada vez que:

- Admin aprueba un torneo creado por usuario (`TorneoService.aprobar`).
- El cron `auto-tournament.yml` genera un torneo nuevo (`TorneoAutoService.generar`).

**Activación en producción (una sola vez):**

1. Generar la clave UUID:
   ```sh
   openssl rand -hex 16
   # → 7a2f9c1d8e4b3a1f0c5d6e7f8a9b0c1d
   ```

2. Crear el archivo de verificación en
   `frontend/public/{KEY}.txt` con el contenido = la propia clave. Por
   ejemplo:
   ```sh
   echo "7a2f9c1d8e4b3a1f0c5d6e7f8a9b0c1d" > \
        frontend/public/7a2f9c1d8e4b3a1f0c5d6e7f8a9b0c1d.txt
   ```
   Tras `vite build` queda servido en
   `https://animeshowdown.dev/7a2f9c1d8e4b3a1f0c5d6e7f8a9b0c1d.txt`,
   que es lo que valida IndexNow al recibir un ping.

3. Configurar variables de entorno en Railway:
   ```env
   APP_INDEXNOW_KEY=7a2f9c1d8e4b3a1f0c5d6e7f8a9b0c1d
   APP_INDEXNOW_HOST=animeshowdown.dev
   APP_INDEXNOW_BASE_URL=https://animeshowdown.dev
   ```

4. Restart de Railway. El log debe mostrar:
   ```
   IndexNow activo: host=animeshowdown.dev keyPrefix=7a2f9c***
   ```

Sin la env var el service queda en modo no-op (útil en dev y CI).

### Google Search Console

1. Abrir https://search.google.com/search-console y añadir
   `animeshowdown.dev` como propiedad (no URL prefix — Domain property,
   más completa).
2. Google pide un TXT en DNS. Copiar el valor.
3. En Cloudflare DNS de `animeshowdown.dev` añadir record:
   ```
   Type: TXT
   Name: @
   Value: google-site-verification=<valor>
   TTL: Auto
   ```
4. Volver a Search Console y pulsar "Verify". Suele tardar <5min.
5. En Search Console → Sitemaps, añadir
   `https://animeshowdown.dev/sitemap.xml`.

### Bing Webmaster Tools

1. https://www.bing.com/webmasters → "Import from Google Search Console"
   (auto-rellena la propiedad y el sitemap).
2. Si no aceptara el import, verificación manual via DNS TXT igual que
   Google pero con `BingSiteAuth.xml` en `frontend/public/`.

---

## 5.8 · Core Web Vitals (LCP / INP / CLS)

La medición está enchufada con web-vitals → Sentry. El objetivo es mantener:

- **LCP** < 2.5s · candidate ya optimizado con `<link rel="preload">`
  del logo del Hero en `index.html`.
- **INP** < 200ms · cubierto por code-splitting de rutas lazy y presupuesto
  de bundle para el chunk principal.
- **CLS** < 0.1 · verificar tras deploy con Lighthouse.

### Lighthouse local

```sh
cd frontend
npm run build:no-images
npx serve dist -p 4173 &
npx lighthouse http://localhost:4173 --view --output-path=./lighthouse-report.html
```

Apuntar a >90 en Performance y >95 en SEO/Best Practices/Accessibility.

### Field data (usuarios reales)

Las métricas de campo llegan a Sentry como measurements. Filtros útiles:

- Performance → Web Vitals tab → seleccionar transacciones de `/`,
  `/personajes/[slug]`, `/torneos/[slug]`.
- Histograma de LCP por país: si un país tiene p75 > 4s revisar
  Bloque 5.11 (velocidad por país).

---

## 5.11 · Velocidad por país

Cloudflare Pages ya da CDN global, pero conviene validar latencia real.

### WebPageTest cron mensual

URL: https://webpagetest.org/

Tests recomendados tras cada release mayor (semestral):

- US-East · Cable + 4G · `/`
- Tokyo · Cable + 4G · `/personajes/akame`
- São Paulo · Cable · `/torneos`

Apuntar el resultado del p75 (3 runs por config) en un Google Sheet
para detectar regresiones release-a-release. Si TTFB de Railway pasa
de 800ms en alguna región, considerar mover backend a region más cercana
o añadir cache layer en Cloudflare Workers.

### Lighthouse CI por country (futuro)

Cuando haya tráfico real (~1k MAU), montar Lighthouse CI en GitHub
Actions con throttling preset para LATAM/EU/APAC y subir a Sentry como
metric custom. Out of scope hasta que haya volumen real.

---

## Verificación post-deploy

Tras cada cambio importante de SEO:

1. **Sitemap**: abrir `https://animeshowdown.dev/sitemap.xml`,
   verificar que tiene los URLs esperados.
2. **Robots**: `https://animeshowdown.dev/robots.txt` debe permitir
   crawl y apuntar al sitemap.
3. **JSON-LD**: pegar URL en
   https://search.google.com/test/rich-results · debe parsear sin
   errores.
4. **Meta tags**: ver source HTML de la página · `<title>`,
   `<meta name="description">`, `<link rel="canonical">`, OG tags y
   hreflang deben estar.
5. **Preview redes**: pegar URL en
   https://www.opengraph.xyz/ · la card debería renderizar con la
   imagen OG dinámica cuando aplique.

---

## 16.10 · UptimeRobot — monitor de salud

Monitor público de salud del backend.

### Setup

1. Crear cuenta gratuita en https://uptimerobot.com (50 monitors, ping 5min).
2. Añadir monitor HTTP(s):
   - **Type**: HTTP(s)
   - **URL**: `https://animeshowdown-backend.up.railway.app/actuator/health`
   - **Friendly name**: `AnimeShowdown · Backend health`
   - **Monitoring Interval**: 5 minutos
3. Añadir contacto:
   - Email del autor para alerta inmediata si cae.
   - (Opcional) Webhook Discord — crear webhook en canal #alerts y
     pegar URL.
4. Status page pública:
   - Settings → Public status pages → Add new
   - Nombre: `status.animeshowdown.dev`
   - Monitors: el de health
   - Custom domain (premium $7/mes) o subdomain free.

### Verificación

Tras 10 minutos UptimeRobot debe mostrar el monitor en verde "Up". Forzar
una caída local con `docker stop` del backend (dev), confirmar que llega
email + Discord webhook.

### Endpoint en backend

`/actuator/health` ya está expuesto y permitAll en SecurityConfig.
Devuelve `{"status":"UP"}` cuando todo va bien, 503 si DB cae o si los
checkers internos fallan.

## 16.18 · Status page público

Si quieres self-host la status page (sin depender de UptimeRobot premium):

- **Cachet** (PHP) — feo pero gratis.
- **Statping-ng** (Go single binary) — recomendado, despliegue en Railway
  con 1 click.
- **Better Stack Status pages** (free 1 status page).

Para AnimeShowdown la status page de UptimeRobot free + dominio
`status.animeshowdown.dev` apuntado al subdomain gratuito de UptimeRobot
es la opción mínima viable.

## Referencias

- SEO técnico completo
- OG image dinámica server-side
- Web Vitals → Sentry
- IndexNow protocol — https://www.indexnow.org/
- Google Rich Results Test — https://search.google.com/test/rich-results
