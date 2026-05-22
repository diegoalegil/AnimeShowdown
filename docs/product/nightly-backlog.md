# Backlog producto — Night shift


**Convención de tabla:**
- **Impacto**: alto (mueve métricas de negocio), medio (mejora UX), bajo (calidad de vida)
- **Coste**: días-persona estimados (1d = 8h)
- **Riesgo**: técnico/legal/producto/operacional + nota
- **Métrica**: KPI observable post-feature

---

## Bloque A — Onboarding y primer voto

### A1. Tour interactivo opcional al primer voto

| | |
|---|---|
| **Impacto** | Alto — el primer voto es el momento de aha de la app |
| **Coste** | 1.5 d |
| **Riesgo** | Bajo — overlay skipable, no rompe flujo existente |
| **Métrica** | % usuarios que llegan a voto #5 sube de baseline → >40% |

Overlay con 3 pasos al primer `POST /api/votos`: (1) "Cada voto cambia el ELO de ambos personajes", (2) "El que más coincide con la mayoría gana puntos en el ranking", (3) "Tu próximo duelo te lo elige el sistema". CTA "Empezar" hace `localStorage.setItem('animeshowdown.onboarded', '1')`. Si skipean, no se vuelve a mostrar.

### A2. Streak counter visible

| | |
|---|---|
| **Impacto** | Alto — gamificación clásica de retención |
| **Coste** | 2 d (backend + UI) |
| **Riesgo** | Bajo |
| **Métrica** | DAU/MAU sube de baseline → >0.25 |

Backend: campo `usuarios.dias_consecutivos_activo` actualizado en cada voto. Si pasan >24h sin voto → reset a 1. Frontend: número grande en header móvil + animación "🔥 N días" cuando pasas un umbral (3, 7, 30, 100).

### A3. Email recordatorio si llevas 5+ días sin votar

| | |
|---|---|
| **Impacto** | Medio |
| **Coste** | 1 d |
| **Riesgo** | Producto: email = spam si se abusa. Legal: GDPR opt-in obligatorio en signup |
| **Métrica** | % usuarios que reactivan en 7 días tras email > 15% |

Scheduler nocturno 10:00 UTC busca usuarios con `last_vote_at < now - 5d` y `email_marketing_opt_in = true`. Envía email con: top 3 movers de la semana + 1 duelo personalizado pendiente. Opt-out con un click. **No mandar a usuarios sin opt-in explícito.**

---

## Bloque B — Comunidad

### B1. Sistema de seguir personajes con notificaciones

| | |
|---|---|
| **Impacto** | Medio — útil para hardcore fans |
| **Coste** | 2 d |
| **Riesgo** | Bajo |
| **Métrica** | % usuarios con ≥1 favorito > 30% |

`POST /api/personajes/:slug/favorito` (ya existe campo en V19?). Notificación in-app cuando: el personaje sube/baja >5 posiciones en ranking, gana torneo, alguien añade comentario en su ficha (cuando hayan comentarios del Round 1).

### B2. Perfiles públicos shareables

| | |
|---|---|
| **Impacto** | Alto — viralidad |
| **Coste** | 2 d |
| **Riesgo** | Privacidad: opt-in obligatorio antes de hacer público |
| **Métrica** | % usuarios con perfil público > 20%; tráfico desde redes > 100/día |

`/u/<username>` ya existe parcial. Hacerlo robusto: cabecera con avatar grande + ELO PvP + badges desbloqueados + top 5 favoritos + última actividad. Toggle "Hacer mi perfil público" en ajustes. OG image dinámico para previews de Twitter/Discord/WhatsApp.

### B3. "Mi top 5 del año" — campaña anual compartible

| | |
|---|---|
| **Impacto** | Alto en pico (1 mes/año, alto share orgánico) |
| **Coste** | 3 d |
| **Riesgo** | Operacional: lanzamiento atado a fecha (diciembre) |
| **Métrica** | Shares en RRSS > 500 en 7 días |

Estilo Spotify Wrapped: al final de año, página `/mi-top5-2026` con los 5 personajes que más votó cada user, estética de Polaroid + kanji + estilo trading-card. Botón "Compartir" genera imagen via Open Graph dinámico. Solo accesible para usuarios con ≥10 votos en el año.

---

## Bloque C — Moderación y abuso

### C1. Reportar comentario / personaje / torneo

| | |
|---|---|
| **Impacto** | Alto — escala obligado cuando crezca la comunidad |
| **Coste** | 1.5 d |
| **Riesgo** | Operacional: alguien tiene que revisar reportes |
| **Métrica** | Tiempo medio de revisión de reporte < 24h |

Botón "Reportar" en cada comentario, perfil público y torneo público. Modal con motivos: spam, contenido ofensivo, copyright, otro. Crea entrada en `reportes_moderacion`. Panel admin `/admin/moderacion` con cola priorizada. Reportes acumulados al mismo objeto → auto-oculto en >3 reportes únicos (de IPs distintas).

### C2. Rate limit por user (no solo IP)

| | |
|---|---|
| **Impacto** | Medio — protege ranking del abuso |
| **Coste** | 0.5 d |
| **Riesgo** | UX: si mal calibrado, frustra usuarios power |
| **Métrica** | 0 incidentes de inflation artificial en 30 días |

Hoy `RateLimitFilter` usa IP. Cambiar a `user_id` cuando `Authentication` presente, IP fallback para anónimos. Limits diferenciados: 100 votos/h anónimo, 500 votos/h logged, 2000 votos/h verificado.

### C3. Captcha invisible en signup (Cloudflare Turnstile)

| | |
|---|---|
| **Impacto** | Alto si recibe ataques de bot |
| **Coste** | 1 d |
| **Riesgo** | Bajo |
| **Métrica** | 0 cuentas bot detectadas/semana |

Turnstile es gratis y sin tracking. Token devuelto en form → backend valida con Cloudflare API → si OK proceed, si KO 403. Casi invisible para usuarios reales.

### C4. Política de privacidad + términos legibles

| | |
|---|---|
| **Impacto** | Medio (legal obligatorio en EU) |
| **Coste** | 0.5 d con plantilla |
| **Riesgo** | Legal: tener "T&C" inútiles es peor que no tenerlos |
| **Métrica** | N/A (obligatorio GDPR) |

Páginas `/privacidad` y `/terminos` con texto real, no boilerplate. Cubrir: qué datos guardamos (email, votos, IP, fingerprint), retención (30 días para anónimos, hasta cierre cuenta para logged), terceros (Resend, Cloudflare, Sentry cuando aplique), derecho de acceso/borrado (link a `/perfil → Borrar mi cuenta` que ya existe). Versionado en footer.

---

## Bloque D — SEO editorial

### D1. Páginas hub por rasgo otaku

| | |
|---|---|
| **Impacto** | Alto — long-tail SEO con 30+ URLs |
| **Coste** | 2 d (con plantilla SSG) |
| **Riesgo** | Bajo |
| **Métrica** | Tráfico orgánico mensual > 1000 sesiones desde estas pages |

`/rasgos/tsundere`, `/rasgos/yandere`, `/rasgos/kuudere`, etc. Cada página combina: definición del glossary + lista de los 20 personajes más representativos del rasgo + link a `/personajes?tag=X` + link de vuelta al glossary. Schema.org `DefinedTerm` + `ItemList`.

### D2. Posts editoriales mensuales

| | |
|---|---|
| **Impacto** | Alto a largo plazo |
| **Coste** | 1 d/post + 1 d setup CMS |
| **Riesgo** | Operacional: necesitas alguien escribiendo |
| **Métrica** | 5K visitas/mes a /blog tras 6 meses |

`/blog` con posts: "El meta de noviembre", "Los 10 duelos más reñidos del año", "Cómo el algoritmo ELO premia las sorpresas", "Lo que dice el ranking de Demon Slayer". MDX en `frontend/content/blog/*.mdx`. Build genera HTML estático.

### D3. Sitemap de imágenes dentro de URLs (formato correcto)

| | |
|---|---|
| **Impacto** | Medio — Google Images coverage |
| **Coste** | 0.5 d |
| **Riesgo** | Bajo |
| **Métrica** | % imágenes indexadas en Search Console > 80% |


### D4. Schema.org `Review` en duelos populares

| | |
|---|---|
| **Impacto** | Medio |
| **Coste** | 1 d |
| **Riesgo** | Bajo |
| **Métrica** | Rich Results en SERP para "luffy vs zoro" |

Cada `/duelos/<a>-vs-<b>` con JSON-LD: dos personajes como `ItemReviewed` (FictionalCharacter), votos como `reviewCount`, % ganador como `ratingValue`. Permite que Google muestre rich snippet con porcentajes.

---

## Bloque E — Campañas

### E1. Torneo seasonal cada trimestre

| | |
|---|---|
| **Impacto** | Alto en pico — evento comunidad |
| **Coste** | 1 d/torneo setup |
| **Riesgo** | Operacional: requiere comunicación a usuarios |
| **Métrica** | >500 votos en el bracket del torneo |

Torneos curados oficiales con tema: "Best Girls 2026", "Saiyajin vs Shinigami", "Mecha Royale". Anunciar 7 días antes por: notif PWA, banner en home, email opt-in. Recompensa: badge único por torneo (`campeon_best_girls_2026`).

### E2. Daily Bracket — 1 duelo destacado por día

| | |
|---|---|
| **Impacto** | Medio |
| **Coste** | 0.5 d |
| **Riesgo** | Bajo |
| **Métrica** | DAU sube los días del daily bracket |

Cada día a las 00:00 UTC, el sistema elige un duelo (algoritmo: ELO diff <50 + personajes con ≥3 personajes shared anime + nunca enfrentados antes). Aparece en home como "DUELO DEL DÍA". Votos al daily bracket cuentan doble para ELO ese día.

### E3. Referral con tracking transparente

| | |
|---|---|
| **Impacto** | Medio |
| **Coste** | Ya parcialmente en `ReferralService` (V14) — falta UI |
| **Riesgo** | Bajo |
| **Métrica** | % signups con referral > 15% |

Cada user tiene `/r/<código>`. Cuando alguien se registra usando ese link, ambos suben un nivel de un badge `red_de_amigos` o similar. Ver tracking en `/perfil → Mi referido`.

---

## Bloque F — Plataforma

### F1. PWA offline real para fichas vistas

| | |
|---|---|
| **Impacto** | Bajo (nicho) |
| **Coste** | 1.5 d |
| **Riesgo** | Bajo |
| **Métrica** | N/A |

Service Worker cachea las últimas 50 fichas visitadas + sus imágenes. Sin red, el user puede navegar las que ya vio. CTA "Vuelve cuando tengas red" en home.

### F2. Modo lectura / impresión

| | |
|---|---|
| **Impacto** | Bajo |
| **Coste** | 0.5 d |
| **Riesgo** | Bajo |
| **Métrica** | N/A |

CSS `@media print` para `/personajes/:slug` que oculta nav/footer y muestra ficha limpia. Útil si alguien quiere imprimir/compartir como PDF.

### F3. API pública documentada

| | |
|---|---|
| **Impacto** | Alto en developer community |
| **Coste** | 1 d (OpenAPI ya está integrado, falta pulir) |
| **Riesgo** | Operacional: alguien va a abusar el endpoint. Rate limit obligatorio. |
| **Métrica** | Apps de terceros usando la API > 5 |

`/api-docs` con Swagger UI público. Sección "Para devs" en footer. Rate limit estricto sin API key (10 req/min) o generoso con key (500/min). Genera tracción comunidad dev.

---

## Resumen prioritario (top 5 para Q3 2026)

1. **A2 Streak counter** (gamificación, alto impacto, 2d)
2. **B2 Perfiles públicos shareables** (viralidad, 2d)
3. **C4 Privacidad/términos** (legal obligatorio, 0.5d)
4. **D1 Páginas hub por rasgo otaku** (SEO long-tail, 2d)
5. **E2 Daily Bracket** (retención diaria, 0.5d)

**Total aprox:** 7 días para impacto inmediato en retención + viralidad + SEO + legal.

---

## Lo que está fuera

- Infra grande (k8s, monitoring complejo) — overkill para el tráfico actual.
- Features sin demanda comprobada (e.g. chat AI con personajes, NFTs, etc.) — bonitas en idea, ROI dudoso.
