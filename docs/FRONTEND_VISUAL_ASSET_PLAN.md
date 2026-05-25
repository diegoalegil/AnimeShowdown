# AnimeShowdown - Frontend Visual Asset Plan

## 1. Diagnostico visual actual

AnimeShowdown ya tiene una base visual potente: fondo oscuro de arena, cartas SSR, portadas editoriales por anime, portadas de juegos, banners de torneos, estados vacios y un sistema de `cuts` para retratos recortados. El problema principal no es falta total de sistema, sino consistencia de uso.

Debilidades detectadas:

- La home depende mucho del logo central y de un titular muy grande; en mobile la accion principal llega tarde.
- Votar es el corazon del producto, pero paneles secundarios pueden empujar el duelo fuera del primer viewport.
- La ficha de personaje usa la carta como asset principal, pero la galeria externa compite visualmente y puede mostrar recortes irregulares.
- Ranking y brackets necesitan retratos compactos; la carta SSR completa funciona bien como pieza premium, pero no siempre como avatar operativo.
- Algunos universos tienen buen banner y otros dependen de fallback editorial.
- Los juegos tienen portadas propias, pero necesitan fondos/escenas mas reconocibles por modo.
- Empty states y error states existen, pero faltan versiones especificas para catalogo caido, sin torneos, sin actividad de ranking y PvP sin sesion.
- Falta una convencion documentada para decidir card vs portrait vs banner vs thumbnail.

Riesgo principal:

- Anadir imagenes sin criterio puede hacer que el frontend parezca menos anime real y mas plantilla decorada. Cada asset nuevo debe corresponder a un personaje, anime, torneo, juego o estado concreto.

## 2. Estrategia visual recomendada

### Card SSR

Uso principal:

- Catalogo de personajes.
- Ficha de personaje.
- Top visual / coleccionismo.
- Podio cuando hay espacio.
- Momentos compartibles.

Ratio recomendado: `2:3`.

Resolucion recomendada: `1024x1536`, con variantes `300w` y `600w`.

Ruta actual:

- `frontend/img/<Anime_Folder>/<slug>.webp`
- `frontend/img/<Anime_Folder>/<slug>-300.webp`
- `frontend/img/<Anime_Folder>/<slug>-600.webp`
- `frontend/img/<Anime_Folder>/<slug>.dominant.json`

### Cut / portrait recortado

Uso principal:

- Votar si se decide pasar a arena portrait-first.
- Brackets y predicciones.
- Ranking compacto.
- PvP.
- Historial competitivo.
- Notificaciones y chips.

Ruta actual recomendada:

- `frontend/img/cuts/<slug>.webp`
- `frontend/img/cuts/<slug>-300.webp`
- `frontend/img/cuts/<slug>-600.webp`

Ruta futura para retrato no transparente:

- `frontend/img/<Anime_Folder>/portraits/<slug>.webp`

Ratio recomendado:

- Transparent cut: lienzo `4:5` o `3:4`.
- Portrait cerrado: `4:5`.
- Avatar compacto: `1:1`.

### Banner

Uso principal:

- Hero de anime.
- Ficha de personaje si se crea una escena dedicada.
- Torneos.
- Eventos.
- Social cards.

Rutas actuales:

- `frontend/public/assets/anime-banners/<anime-slug>.webp`
- `frontend/public/assets/tournament-banners/<tournament-slug>.webp`
- `frontend/public/assets/event-covers/<event-slug>.webp`

Ratio recomendado:

- Hero/banner: `16:9` o `21:9`.
- Card editorial: `16:9`.

Resolucion recomendada:

- `1920x1080` para `16:9`.
- `2400x1080` para `21:9`.

### Thumbnail

Uso principal:

- Command palette.
- Autocomplete.
- Notificaciones.
- Chips de participantes.
- Mobile bottom surfaces.

Ruta futura:

- `frontend/img/<Anime_Folder>/thumbs/<slug>.webp`

Ratio recomendado: `1:1`.

Resolucion recomendada: `384x384`.

## 3. Reglas de calidad visual

- Usar personajes reales donde la pantalla representa un personaje concreto.
- Usar universos reales donde la pantalla representa un anime concreto.
- Usar composiciones reconocibles del anime cuando el objetivo sea identidad de universo.
- No sustituir Luffy, Naruto, Gojo, Makima, Frieren, Ichigo, Goku, Eren u otros personajes reales por personajes originales.
- No usar fondos abstractos si la pantalla necesita comunicar un anime, torneo o modo de juego concreto.
- No mezclar estilos incompatibles dentro del mismo anime.
- Priorizar nitidez, recorte limpio, pose legible, contraste y composicion.
- Evitar caras cortadas, manos deformadas, texto ilegible, logos inventados y fondos que parezcan stock.
- Mantener peso optimizado: WebP, dimensiones estables, lazy loading salvo LCP.
- Cada asset debe tener propietario visual: pagina, componente y problema que resuelve.

## 4. Estructura de carpetas recomendada

Mantener estructura actual:

```text
frontend/img/<Anime_Folder>/<slug>.webp
frontend/img/<Anime_Folder>/<slug>-300.webp
frontend/img/<Anime_Folder>/<slug>-600.webp
frontend/img/<Anime_Folder>/<slug>.dominant.json
frontend/img/cuts/<slug>.webp
frontend/img/cuts/<slug>-300.webp
frontend/img/cuts/<slug>-600.webp
frontend/public/assets/anime-banners/<anime-slug>.webp
frontend/public/assets/game-covers/<game-slug>.webp
frontend/public/assets/tournament-banners/<tournament-slug>.webp
frontend/public/assets/event-covers/<event-slug>.webp
frontend/public/assets/empty-states/<state-slug>.webp
frontend/public/assets/error-scenes/<state-slug>.webp
```

Carpetas futuras opcionales:

```text
frontend/img/<Anime_Folder>/portraits/<slug>.webp
frontend/img/<Anime_Folder>/thumbs/<slug>.webp
frontend/public/assets/og/<template-slug>.webp
```

## 5. Naming convention

- Slugs de personajes: `snake_case`, igual que el catalogo (`satoru_gojo.webp`).
- Slugs de assets publicos: `kebab-case` (`jujutsu-kaisen.webp`).
- Carpetas de anime: mantener formato actual con `_` y mayusculas cuando ya exista (`Jujutsu_Kaisen`).
- No usar nombres temporales como `test`, `new`, `final`, `v2-final`.
- No usar nombres de herramientas ni metadatos de produccion en archivos publicos.

## 6. Imagenes criticas a producir

| ID | Archivo | Carpeta | Pagina | Componente | Descripcion | Ratio | Resolucion | Prioridad | Prompt sugerido |
|---|---|---|---|---|---|---|---|---|---|
| HOME-01 | `home-hero-vote-arena.webp` | `frontend/public/assets/brand/backgrounds/` | Home | `Hero` | Arena anime nocturna con tablero ELO, siluetas de publico y duelos 1v1; sin personajes inventados en primer plano. | 21:9 | 2400x1080 | Alta | Escena cinematografica de arena urbana nocturna para AnimeShowdown, pantallas con ranking ELO, energia roja/dorada/cian, espacio central limpio para titular, atmosfera competitiva premium. |
| VOTE-01 | `vote-arena.webp` | `frontend/public/assets/brand/backgrounds/` | Votar | `VisualPageShell` | Fondo propio de duelo 1v1, mas directo que torneo generico. | 16:9 | 1920x1080 | Alta | Arena de combate anime 1v1, dos zonas enfrentadas, luz roja y dorada, publico abstracto lejano, centro despejado para VS, tono premium oscuro. |
| RANK-01 | `ranking-podium.webp` | `frontend/public/assets/brand/backgrounds/` | Ranking | `CinematicHero` | Podio competitivo con copa, tabla y energia de comunidad. | 21:9 | 2400x1080 | Media | Salon de la fama anime competitivo, podio iluminado, copa central, pantallas de ranking, ambiente rojo/dorado/cian, sin personajes originales. |
| EMPTY-01 | `catalog-offline.webp` | `frontend/public/assets/error-scenes/` | App | `CatalogoError` | Estado de catalogo caido que no parezca pantalla muerta. | 16:9 | 1600x900 | Alta | Arena anime cerrada por mantenimiento, luces bajas, panel de roster apagado, tono serio pero premium, espacio central para mensaje. |
| EMPTY-02 | `no-duels-open.webp` | `frontend/public/assets/empty-states/` | Votar/Torneos | `EmptyStateScene` | Sin duelos abiertos. | 16:9 | 1600x900 | Media | Bracket anime vacio esperando combatientes, escenario nocturno, marcadores apagados, atmosfera de pausa competitiva. |
| GAME-01 | `shadow-guess-character-wall.webp` | `frontend/public/assets/game-covers/` | Shadow Guess | `GamesHubPage` | Portada mas reconocible para silueta/personaje oculto. | 16:9 | 1600x900 | Media | Silueta de personaje anime real sin revelar identidad, muro de sombras, luz roja lateral, sensacion de misterio diario. |
| GAME-02 | `anime-reveal-clue-board.webp` | `frontend/public/assets/game-covers/` | Anime Reveal | `GamesHubPage` | Mesa de pistas por anime. | 16:9 | 1600x900 | Media | Tablero de pistas de anime con capturas abstractas, etiquetas, luces cian y doradas, composicion limpia para titulo. |
| GAME-03 | `anigrid-grid-arena.webp` | `frontend/public/assets/game-covers/` | AniGrid | `GamesHubPage` | Identidad de puzzle/wordle anime. | 16:9 | 1600x900 | Media | Grid competitivo de pistas de personajes anime, casillas iluminadas, estilo puzzle premium, colores cian/dorado/rojo. |
| GAME-04 | `impostor-trial-court.webp` | `frontend/public/assets/game-covers/` | Impostor Trial | `GamesHubPage` | Juicio visual del impostor. | 16:9 | 1600x900 | Media | Tribunal anime oscuro con cuatro cartas en mesa, una carta marcada como sospechosa, luz violeta y roja, tension de juicio. |
| GAME-05 | `elo-duel-scoreboard.webp` | `frontend/public/assets/game-covers/` | ELO Duel | `GamesHubPage` | Higher/lower con marcador claro. | 16:9 | 1600x900 | Media | Marcador ELO con dos personajes enfrentados fuera de foco, flechas de subida/bajada, energia competitiva, UI diegetica. |

## 7. Fondos recomendados

| Pagina | Asset | Uso |
|---|---|---|
| Home | `home-hero-vote-arena.webp` | Hero principal con espacio central limpio. |
| Votar | `vote-arena.webp` | Shell de duelo, sustituyendo dependencia de fondo de torneos. |
| Ranking | `ranking-podium.webp` | Hero competitivo, podio y meta report. |
| Personajes | `personajes-archive.webp` | Archivo de cartas SSR con wall de coleccion. |
| Animes | `anime-catalog.webp` | Archivo de universos, ya existe pero debe revisarse por legibilidad. |
| Torneos | `tournament-catalog.webp` | Brackets, ya existe; mantener y sumar banners por torneo real. |
| Eventos | `events-hero.webp` | Campanas temporales, ya existe; producir covers por evento fuerte. |
| PvP | `pvp-live-arena.webp` | Cola 1v1, rondas y marcador live. |
| 404 | `lost-portal.webp` | Ruta perdida, portal de arena sin destino. |

## 8. Assets por juego

| Juego | Necesita | Prioridad | Componentes |
|---|---|---|---|
| Shadow Guess | Fondo de silueta, emblema `影`, resultado perfecto compartible. | Alta | `GamesHubPage`, `GuessCharacterPage`, share text visual futuro. |
| Anime Reveal | Fondo de pistas, banner de resultado, mini icono de pista. | Media | `GamesHubPage`, `GuessAnimePage`. |
| AniGrid | Fondo de tablero, casillas premium, icono de grid. | Media | `GamesHubPage`, `AnidelPage`. |
| Impostor Trial | Fondo de juicio, emblema de sospechoso, resultado perfecto. | Alta | `GamesHubPage`, `ImpostorPage`. |
| ELO Duel | Fondo de marcador, flechas ELO, pantalla de game over. | Alta | `GamesHubPage`, `HigherOrLowerPage`. |
| Omikuji | Santuario, papel de suerte, variantes de fortuna. | Baja | `GamesHubPage`, `OmikujiPage`. |

## 9. Assets por anime

Prioridad alta de banners/collages:

| Anime | Archivo | Motivo |
|---|---|---|
| Jujutsu Kaisen | `jujutsu-kaisen.webp` | Muy visible en home, votar, ranking y detalle. Revisar composicion para Gojo/Sukuna/Yuji/Megumi. |
| One Piece | `one-piece.webp` | Falta reforzar aventura y tripulacion; muy reconocible. |
| Naruto | `naruto-v2.webp` | Ya existe, mantener como referencia. Necesita portraits de personajes secundarios. |
| My Hero Academia | `my-hero-academia.webp` | Roster enorme; el banner debe representar heroes vs villanos. |
| Demon Slayer | `demon-slayer.webp` | Roster enorme; puede tener fondo de corps y lunas superiores. |
| Attack on Titan | `attack-on-titan.webp` | Debe sentirse mas guerra/murallas que carta generica. |
| Chainsaw Man | `chainsaw-man.webp` | Necesita identidad caotica, roja, urbana. |
| Frieren: Beyond Journey's End | `frieren.webp` | Universo importante para retencion actual; tono mas sereno y fantastico. |
| Bleach | `bleach.webp` | Necesita identidad de Soul Society y espadas. |
| Dragon Ball | `dragon-ball.webp` | Necesita energia y roster iconico para duelos. |
| Blue Lock | `blue-lock.webp` | Buen candidato para juegos y ranking competitivo. |
| Dandadan | `dandadan.webp` | Popularidad actual; necesita portada fuerte. |

## 10. Personajes recomendados para anadir

No tocar seeds en esta tanda. Esta lista es backlog de producto.

| Anime | Personaje | Slug sugerido | Prioridad | Motivo | Assets necesarios | Carpeta | Prompt sugerido |
|---|---|---|---|---|---|---|---|
| One Piece | Usopp | `usopp` | Alta | Completa Straw Hats; falta en roster actual. | SSR, cut, thumb. | `frontend/img/One_Piece/` | Usopp de One Piece en composicion de carta SSR 2:3, pose heroica con tirachinas, fondo marino de tripulacion, marco premium rojo/dorado. |
| One Piece | Tony Tony Chopper | `tony_tony_chopper` | Alta | Straw Hat esencial y muy votable. | SSR, cut, thumb. | `frontend/img/One_Piece/` | Tony Tony Chopper en carta SSR 2:3, expresivo y reconocible, fondo de barco y nieve suave, recorte limpio. |
| One Piece | Trafalgar Law | `trafalgar_law` | Alta | Rival/favorito muy popular para ranking. | SSR, cut, portrait. | `frontend/img/One_Piece/` | Trafalgar Law en carta SSR 2:3, pose con espada, energia ROOM sutil, fondo azul oscuro y dorado. |
| One Piece | Donquixote Doflamingo | `donquixote_doflamingo` | Alta | Villano clave para torneos. | SSR, cut, banner opcional. | `frontend/img/One_Piece/` | Doflamingo en carta SSR 2:3, abrigo rosa, hilos luminosos, fondo Dressrosa dramatico. |
| One Piece | Kaido | `kaido` | Alta | Top tier para duelos de poder. | SSR, cut. | `frontend/img/One_Piece/` | Kaido en carta SSR 2:3, presencia imponente, tormenta y dragon, contraste fuerte. |
| Bleach | Yhwach | `yhwach` | Alta | Antagonista final; mejora torneos de villanos. | SSR, cut. | `frontend/img/Bleach/` | Yhwach en carta SSR 2:3, aura oscura, fondo Quincy, dorado frio, recorte limpio. |
| Bleach | Uryu Ishida | `uryu_ishida` | Media | Personaje principal ausente. | SSR, cut, thumb. | `frontend/img/Bleach/` | Uryu Ishida en carta SSR 2:3, arco espiritual, fondo azul blanco, composicion vertical. |
| Bleach | Retsu Unohana | `retsu_unohana` | Media | Personaje fuerte para ranking femenino y captains. | SSR, cut. | `frontend/img/Bleach/` | Retsu Unohana en carta SSR 2:3, serenidad peligrosa, espada, fondo rojo oscuro. |
| Jujutsu Kaisen | Suguru Geto | `suguru_geto` | Alta | Complementa Gojo y Kenjaku; duelo narrativo claro. | SSR, cut, banner opcional. | `frontend/img/Jujutsu_Kaisen/` | Suguru Geto en carta SSR 2:3, maldiciones orbitando, fondo ritual urbano, violeta y negro. |
| Jujutsu Kaisen | Naoya Zenin | `naoya_zenin` | Media | Amplia clan Zenin y duelos internos. | SSR, cut. | `frontend/img/Jujutsu_Kaisen/` | Naoya Zenin en carta SSR 2:3, pose arrogante, lineas de velocidad, fondo clan Zenin. |
| Frieren: Beyond Journey's End | Sein | `sein` | Media | Party member ausente. | SSR, cut. | `frontend/img/Frieren_Beyond_Journeys_End/` | Sein en carta SSR 2:3, sacerdote viajero, fondo de camino fantastico, luz suave. |
| Frieren: Beyond Journey's End | Wirbel | `wirbel` | Media | Buen rival para torneos de magia. | SSR, cut. | `frontend/img/Frieren_Beyond_Journeys_End/` | Wirbel en carta SSR 2:3, mago de combate, fondo nevado y energia magica contenida. |
| Frieren: Beyond Journey's End | Kanne | `kanne` | Baja | Refuerza examen de magos. | SSR, thumb. | `frontend/img/Frieren_Beyond_Journeys_End/` | Kanne en carta SSR 2:3, magia de agua, tono azul sereno, recorte claro. |
| Blue Lock | Shoei Baro | `shoei_baro` | Alta | Rival clave; muy competitivo. | SSR, cut, portrait. | `frontend/img/Blue_Lock/` | Shoei Baro en carta SSR 2:3, energia de delantero rey, fondo estadio neon azul, pose agresiva. |
| Blue Lock | Reo Mikage | `reo_mikage` | Media | Completa dinamica con Nagi. | SSR, cut. | `frontend/img/Blue_Lock/` | Reo Mikage en carta SSR 2:3, balon y aura violeta, estadio oscuro. |
| Blue Lock | Rensuke Kunigami | `rensuke_kunigami` | Media | Popular y util para duelos. | SSR, cut. | `frontend/img/Blue_Lock/` | Kunigami en carta SSR 2:3, disparo potente, fondo naranja y azul de estadio. |
| Dandadan | Evil Eye | `evil_eye` | Alta | Antagonista/forma clave para Impostor y duelos. | SSR, cut. | `frontend/img/Dandadan/` | Evil Eye de Dandadan en carta SSR 2:3, aura sobrenatural, fondo caotico rojo/cian. |
| Dandadan | Kinta Sakata | `kinta_sakata` | Baja | Amplia roster comico. | SSR, thumb. | `frontend/img/Dandadan/` | Kinta Sakata en carta SSR 2:3, energia comica, fondo mecha/sci-fi ligero. |
| Oshi no Ko | Taiki Himekawa | `taiki_himekawa` | Media | Amplia roster drama/idol. | SSR, cut. | `frontend/img/Oshi_no_Ko/` | Taiki Himekawa en carta SSR 2:3, escenario teatral, luces de estudio, tono violeta/dorado. |
| Solo Leveling | Choi Jong-In | `choi_jong_in` | Media | Hunter importante ausente. | SSR, cut. | `frontend/img/Solo_Leveling/` | Choi Jong-In en carta SSR 2:3, magia de fuego, fondo dungeon oscuro. |
| Solo Leveling | Hwang Dongsoo | `hwang_dongsoo` | Media | Rival/antagonista para duelos. | SSR, cut. | `frontend/img/Solo_Leveling/` | Hwang Dongsoo en carta SSR 2:3, hunter agresivo, fondo urbano oscuro y energia roja. |
| Dragon Ball | Son Gohan | `son_gohan` | Alta | Personaje esencial ausente. | SSR, cut, portrait. | `frontend/img/Dragon_Ball/` | Son Gohan en carta SSR 2:3, aura Super Saiyan, fondo de combate, dorado intenso. |
| Dragon Ball | Krillin | `krillin` | Media | Completa cast historico. | SSR, thumb. | `frontend/img/Dragon_Ball/` | Krillin en carta SSR 2:3, pose de combate, fondo naranja y azul, recorte limpio. |
| Dragon Ball | Jiren | `jiren` | Alta | Top tier para ELO Duel. | SSR, cut. | `frontend/img/Dragon_Ball/` | Jiren en carta SSR 2:3, aura roja, torneo de poder, composicion vertical fuerte. |
| Naruto | Might Guy | `might_guy` | Alta | Duelo claro contra Kakashi/Madara. | SSR, cut, portrait. | `frontend/img/Naruto/` | Might Guy en carta SSR 2:3, postura de taijutsu, aura verde, fondo nocturno de guerra ninja. |
| Naruto | Shisui Uchiha | `shisui_uchiha` | Media | Muy popular para fans Uchiha. | SSR, cut. | `frontend/img/Naruto/` | Shisui Uchiha en carta SSR 2:3, sharingan, hojas y luz verde, composicion sobria. |
| Naruto | Kabuto Yakushi | `kabuto_yakushi` | Media | Villano/estratega ausente. | SSR, cut. | `frontend/img/Naruto/` | Kabuto Yakushi en carta SSR 2:3, serpientes y laboratorio oscuro, tono frio. |
| Attack on Titan | Gabi Braun | `gabi_braun` | Media | Debate fuerte de comunidad. | SSR, cut. | `frontend/img/Attack_on_Titan/` | Gabi Braun en carta SSR 2:3, fondo de guerra, mirada intensa, paleta militar. |
| Attack on Titan | Falco Grice | `falco_grice` | Media | Complementa arco Marley. | SSR, cut. | `frontend/img/Attack_on_Titan/` | Falco Grice en carta SSR 2:3, cielo dramatico, tono militar y esperanza. |
| Attack on Titan | Pieck Finger | `pieck_finger` | Alta | Popular y reconocible. | SSR, cut. | `frontend/img/Attack_on_Titan/` | Pieck Finger en carta SSR 2:3, atmosfera militar, humo y luz calida, recorte limpio. |
| Hunter x Hunter | Neferpitou | `neferpitou` | Alta | Antagonista clave ausente. | SSR, cut. | `frontend/img/Hunter_x_Hunter/` | Neferpitou en carta SSR 2:3, aura siniestra, fondo Chimera Ant, verde oscuro y rojo. |
| Hunter x Hunter | Kite | `kite` | Media | Figura clave para Gon. | SSR, cut. | `frontend/img/Hunter_x_Hunter/` | Kite en carta SSR 2:3, arma Crazy Slots, bosque oscuro, composicion dinamica. |
| Chainsaw Man | Quanxi | `quanxi` | Alta | Muy popular y fuerte para duelos. | SSR, cut. | `frontend/img/Chainsaw_Man/` | Quanxi en carta SSR 2:3, espadas, fondo urbano rojo y negro, pose clara. |
| Chainsaw Man | Santa Claus | `santa_claus` | Media | Villano para eventos oscuros. | SSR, banner opcional. | `frontend/img/Chainsaw_Man/` | Santa Claus de Chainsaw Man en carta SSR 2:3, muñecos y sombras, ambiente inquietante. |

## 11. Retratos prioritarios

Prioridad 1 para brackets, votar, ranking compacto y PvP:

- Monkey D. Luffy, Roronoa Zoro, Naruto Uzumaki, Sasuke Uchiha, Kakashi Hatake.
- Satoru Gojo, Ryomen Sukuna, Yuji Itadori, Megumi Fushiguro, Toji Fushiguro.
- Izuku Midoriya, Katsuki Bakugo, Shoto Todoroki, All Might, Tomura Shigaraki, Himiko Toga.
- Tanjiro Kamado si entra en catalogo, Nezuko Kamado, Zenitsu Agatsuma, Inosuke Hashibira, Kyojuro Rengoku, Muzan Kibutsuji.
- Eren Yeager, Mikasa Ackerman, Levi Ackerman, Reiner Braun.
- Light Yagami, L, Misa Amane, Ryuk.
- Goku, Vegeta, Frieza, Gohan si entra en catalogo.
- Frieren, Fern, Stark, Ubel, Himmel.
- Denji, Makima, Power, Aki Hayakawa, Reze, Quanxi si entra en catalogo.

Integracion:

- Si existe `frontend/img/cuts/<slug>.webp`, usar `PersonajeCutImg` en superficies compactas.
- Si no existe cut, mantener fallback a `PersonajeImg`.
- Actualizar `frontend/src/data/cut-slugs.js` cuando se anada un cut nuevo.

## 12. Que hacer con la galeria actual de imagenes multiples

Decision recomendada:

- No usar la galeria como elemento principal.
- Mantenerla colapsada por defecto.
- Mostrarla solo como material secundario.
- Retirar cualquier URL que falle.
- No dejar que una imagen externa rota cambie el hero principal.
- Migrar a retratos propios por personaje cuando el equipo priorice assets.

Plan:

1. Mantener la carta SSR como asset base de la ficha.
2. Usar cut/portrait en brackets, ranking compacto, PvP y votacion si el modo necesita ritmo.
3. Usar banner por anime o personaje solo cuando tenga composicion propia y optimizada.
4. Eliminar dependencia visual de galerias externas en pantallas clave.

## 13. Plan de produccion por tandas

Tanda 1 - Alto impacto inmediato:

- `vote-arena.webp`
- `catalog-offline.webp`
- portraits/cuts prioritarios de top 30.
- banners revisados de Jujutsu Kaisen, One Piece, Naruto, My Hero Academia, Demon Slayer.

Tanda 2 - Competitivo:

- ranking podium.
- PvP live arena.
- portraits para top 100.
- banners de torneos principales.

Tanda 3 - Juegos:

- portadas especificas por juego.
- result cards compartibles por juego.
- empty states de daily completed y perfect clear.

Tanda 4 - Universo:

- banners de todos los animes con mas de 10 personajes.
- collages por universo solo si tienen composicion limpia y reconocible.

## 14. Plan de integracion futura

Commits recomendados:

- `feat(vote): add dedicated duel arena background`
- `feat(characters): add priority portrait cuts`
- `feat(animes): refresh key universe banners`
- `feat(games): add daily trial result visuals`
- `feat(tournaments): add bracket banner set`
- `perf(images): extend responsive variants for portraits`

Componentes afectados:

- `Hero`
- `VotarPage`
- `PersonajeImg`
- `PersonajeCutImg`
- `PersonajeGaleria`
- `RankingPage`
- `Bracket`
- `TorneoCard`
- `GamesHubPage`
- `VisualSystem`

Tests/checks:

- `npm run lint`
- `npm run build:no-images`
- Capturas responsive en `/`, `/votar`, `/ranking`, `/personajes/:slug`, `/animes/:slug`, `/torneos`, `/games`.
- Revisar que no haya overflow horizontal en `320`, `375`, `430`, `768`, `1024`, `1440`.
- Revisar que no aparezcan iconos nativos de imagen rota.

## 15. Checklist final

- [ ] Card SSR sigue siendo el asset principal del personaje.
- [ ] Galerias externas no dominan la ficha.
- [ ] Portrait/cut se usa en ranking compacto, bracket y PvP.
- [ ] Votar muestra el duelo antes que paneles secundarios.
- [ ] Home comunica votar, ranking y juegos en el primer viewport.
- [ ] Cada juego tiene fondo propio y resultado compartible.
- [ ] Cada anime importante tiene banner real de universo.
- [ ] Empty states tienen escena propia.
- [ ] No se usan personajes originales para representar personajes reales.
- [ ] No se usan fondos abstractos cuando hace falta identidad de anime real.
- [ ] Todos los assets nuevos tienen WebP optimizado y variantes si aplica.
- [ ] Los nombres de archivo siguen `snake_case` para personajes y `kebab-case` para public assets.
