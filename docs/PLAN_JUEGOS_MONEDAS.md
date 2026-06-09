# Plan: que los juegos den monedas (de forma anti-trampa)

> Estado: **PROPUESTA — pendiente de tu visto bueno**. No ejecutado.
> Origen: aprobaste "los minijuegos deberían dar monedas (más por ganar, algo
> por perder)". Al implementarlo aparece un problema de seguridad que no estaba
> sobre la mesa cuando lo aprobaste, y prefiero que decidas el enfoque antes de
> tocar la economía (zona intocable).

## 1. El problema: la economía es server-authoritative, los juegos no

Toda la economía actual es **server-authoritative**: el cliente nunca pide un
drop; los drops los disparan eventos del dominio que el SERVIDOR valida (voto,
predicción resuelta, duelo PvP finalizado). Eso es lo que mantiene la economía
a prueba de exploits (clasificación A en la revisión de producto).

Pero **los minijuegos son client-side**: toda su lógica vive en
`frontend/src/lib/games.ts` sobre `localStorage`. El servidor NO sabe si
ganaste. Si premiáramos un "he ganado" reportado por el cliente, cualquiera
podría **falsear victorias** y farmear monedas infinitas → abriríamos justo el
agujero que la economía hoy no tiene.

## 2. Qué juegos pueden pagar de forma segura

| Juego | ¿Validado en server? | ¿Puede pagar seguro? |
|---|---|---|
| PvP live (`/duel-live`) | Sí (rondas + ELO en BD) | **Ya paga** (`DROP_DUELO`) |
| ELO Duel (`/games/elo-duel`) | **Sí** — `EloDuelService.resolver` valida el acierto en server | Sí, **con plumbing de auth** (ver abajo) |
| Shadow Guess, AniGrid, Nexo, Oráculo, Impostor… | No (todo en `games.ts`/localStorage) | **No** sin rediseño server-side |

## 3. El obstáculo del ELO Duel: hoy es anónimo

`POST /api/games/elo-duel/guess` (`EloDuelController`) **no recibe usuario
autenticado** — se juega sin login. Para acreditar moneda hay que:

1. Pasar el usuario autenticado al endpoint (`@AuthenticationPrincipal` /
   SecurityContext). Decisión: **solo los logueados ganan moneda** (el anónimo
   sigue jugando, sin recompensa) — coherente con el resto de la economía.
2. Premiar el **acierto** (validado en server) con una cantidad pequeña.
3. **Idempotencia**: referencia `juego:elo:<roundToken>` para que una ronda no
   se cobre dos veces.
4. **Anti-farm**: pasar por `DropService` con el **tope diario** ya existente
   (ahora 100). Así, aunque alguien acierte sin parar, no supera el tope/día
   compartido con el resto de drops. Esto es lo que lo hace seguro.

### Implementación concreta (cuando lo apruebes)
- Nuevo motivo `DROP_JUEGO` en `MotivoMovimiento`.
- `EloDuelService.resolver(...)` recibe el `Usuario` (o null si anónimo); si
  `correct && usuario != null`, llama `dropService.otorgar(usuario,
  DROP_JUEGO, "juego:elo:"+roundToken)`.
- Cantidad sugerida: **2-3 monedas por acierto** (pequeña; el tope diario la
  acota). "Algo por perder" no aplica bien aquí (fallar = game over); si lo
  quieres, una propina simbólica de 1 al cerrar la partida.
- Tests: idempotencia por roundToken, respeto del tope, anónimo no acredita.

## 4. Los demás juegos (Shadow Guess, AniGrid, Nexo, Oráculo…)

Para que paguen sin exploit habría que **mover su validación al servidor**
(que el server genere el reto y valide la respuesta, como hace ELO Duel). Es un
rediseño por juego, no un wiring. Recomendación: hacerlo solo si el engagement
lo justifica, juego a juego. Mientras tanto, **no pagan** (mejor sin moneda que
con un exploit).

## 5. Decisiones que necesito de ti

1. ¿OK al enfoque "solo juegos validados en server pagan, vía tope diario"?
2. ELO Duel: ¿requerir login para ganar moneda (anónimo juega gratis sin
   recompensa)? ¿Cantidad por acierto (sugiero 2-3)?
3. ¿Quieres que rediseñe algún juego client-side concreto para que pueda pagar,
   o lo dejamos en PvP + ELO Duel por ahora?
