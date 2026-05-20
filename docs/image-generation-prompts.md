# Image Generation Prompts

Este documento define los assets editoriales finales de AnimeShowdown. Las rutas ya existen en `frontend/public/assets/**` con placeholders SVG premium; cuando se genere una imagen final, exportarla como WebP o AVIF con el mismo slug. El resolver de `frontend/src/data/visual-assets.js` prioriza `webp`/`avif` antes que `svg`, así que no hace falta tocar componentes.

Reglas globales para todos los prompts:

- Anime-inspired cinematic illustration, original characters only.
- No copyrighted characters, no logos, no readable text.
- Designed as website UI background with safe dark overlay area for text.
- Premium dark tournament platform aesthetic, obsidian blue/black base, deep crimson, muted gold, subtle cyan/violet accents.
- High contrast, atmospheric particles, fog/smoke/rain/energy as appropriate.
- Leave negative space for UI copy. Avoid busy detail in the left third unless noted.

## Home Hero
Route: `/`
Usage: first viewport hero.
Path: `/assets/brand/backgrounds/home-hero.webp`
Aspect ratio: 21:9
Prompt: Wide cinematic anime-style website hero, original anime tournament arena at night, distant neon city skyline, subtle rain and drifting ember particles, one serious original fighter silhouette in the middle distance, crimson and muted gold energy arcs forming a competitive stage, deep obsidian blue shadows, premium dark UI background, no text, no logos, no copyrighted characters, center composition with safe text area in the middle, 21:9.

## Global Dark Background
Route: all pages
Usage: atmospheric fallback layer.
Path: `/assets/brand/backgrounds/global-dark-atmosphere.webp`
Aspect ratio: 21:9
Prompt: Abstract cinematic anime night atmosphere, obsidian blue-black gradient, soft fog, floating crimson petals, tiny gold particles, faint city lights in the far background, subtle film grain, no characters, no text, no logos, designed as website background overlay, 21:9.

## Ranking Hero
Route: `/ranking`
Usage: ranking hero and hall of fame.
Path: `/assets/brand/backgrounds/ranking-hero.webp`
Aspect ratio: 21:9
Prompt: Wide cinematic anime hall of fame, dark tournament podium under a huge muted gold trophy light, empty arena seats fading into darkness, crimson banners and subtle kanji shapes, premium competitive ranking UI background, dramatic gold rim light, no text, no logos, no copyrighted characters, safe text space left, 21:9.

## Personajes Hero
Route: `/personajes`
Usage: character archive landing.
Path: `/assets/brand/backgrounds/personajes-hero.webp`
Aspect ratio: 21:9
Prompt: Wide cinematic anime archive room, holographic character dossiers floating in dark air, obsidian walls, muted crimson interface lines, gold dust, soft blue scanner light, original silhouettes only, no readable text, no logos, no copyrighted characters, premium character database UI background, 21:9.

## Anime Catalog Hero
Route: `/animes`
Usage: anime universes catalog.
Path: `/assets/brand/backgrounds/anime-catalog.webp`
Aspect ratio: 21:9
Prompt: Wide cinematic anime universe archive, multiple portal-like windows to different worlds seen as abstract silhouettes, night sky, fog, crimson and gold accents, no recognizable copyrighted characters, no text, no logos, elegant premium catalog background with safe left text area, 21:9.

## Tournament Catalog Hero
Route: `/torneos`
Usage: tournament index hero.
Path: `/assets/brand/backgrounds/tournament-catalog.webp`
Aspect ratio: 21:9
Prompt: Wide anime tournament bracket arena at night, two abstract teams facing each other across a glowing VS lane, smoke, sparks, cyan energy on one side and dark crimson energy on the other, premium competitive UI background, no text, no logos, original silhouettes only, 21:9.

## Events Hero
Route: `/eventos`
Usage: seasonal campaigns index.
Path: `/assets/brand/backgrounds/events-hero.webp`
Aspect ratio: 21:9
Prompt: Wide cinematic anime seasonal campaign board, night festival atmosphere, torii silhouettes, event banners without readable text, crimson lantern glow, violet fog, drifting petals, premium dark campaign UI background, no logos, no copyrighted characters, 21:9.

## Games Hub Hero
Route: `/games`
Usage: games hub hero.
Path: `/assets/brand/backgrounds/games-hub.webp`
Aspect ratio: 21:9
Prompt: Wide cinematic anime daily trials hub, shrine gate at night merging with futuristic game interface panels, moonlight, crimson particles, subtle puzzle symbols, silhouettes of original challengers, premium dark minigame UI background, no text, no logos, 21:9.

## Shadow Guess Cover
Route: `/games`, `/games/shadow-guess`
Usage: game cover and page background.
Path: `/assets/game-covers/shadow-guess.webp`
Aspect ratio: 16:9
Prompt: Wide cinematic anime-style website banner, mysterious original character silhouette standing in front of a large crimson moon, dark rainy night, floating red petals and particles, large translucent Japanese kanji 影 in background, smoky fog, premium dark mystery game UI aesthetic, high contrast, no readable text, no logos, no copyrighted character, space on left side for UI text overlay, 16:9.

## Anime Reveal Cover
Route: `/games`, `/games/anime-reveal`
Usage: game cover and page background.
Path: `/assets/game-covers/anime-reveal.webp`
Aspect ratio: 16:9
Prompt: Wide cinematic anime mystery reveal banner, blurred original anime character in the center with distorted glass and light refraction, dark violet and crimson energy around the figure, soft fog, UI-friendly negative space left, no readable text, no logos, no copyrighted character, 16:9.

## AniGrid Cover
Route: `/games`, `/games/anigrid`
Usage: game cover and page background.
Path: `/assets/game-covers/anigrid.webp`
Aspect ratio: 16:9
Prompt: Wide anime puzzle UI banner, glowing grid panels floating in a dark room, teal and cyan clue symbols, subtle character silhouettes hidden behind panels, clean logical Wordle-like mood, premium dark interface, no readable text, no logos, no copyrighted characters, safe left text area, 16:9.

## Impostor Trial Cover
Route: `/games`, `/games/impostor-trial`
Usage: game cover and page background.
Path: `/assets/game-covers/impostor-trial.webp`
Aspect ratio: 16:9
Prompt: Wide cinematic anime trial scene, four original character silhouettes standing under dim spotlights, one silhouette has a subtle violet/crimson aura that feels suspicious, dark courtroom/arena background, smoke and particles, kanji 裏 faint in background, no text, no logos, no copyrighted characters, 16:9.

## ELO Duel Cover
Route: `/games`, `/games/elo-duel`
Usage: game cover and page background.
Path: `/assets/game-covers/elo-duel.webp`
Aspect ratio: 16:9
Prompt: Wide anime VS arena banner, two original fighters facing each other from opposite sides, cyan energy on the left and crimson energy on the right, central glowing VS shape without readable letters, dark battlefield floor, sparks, premium competitive mood, no logos, no copyrighted characters, safe top/left overlay space, 16:9.

## Omikuji Cover
Route: `/games`, `/omikuji`
Usage: daily ritual cover.
Path: `/assets/game-covers/omikuji.webp`
Aspect ratio: 16:9
Prompt: Wide cinematic anime shrine at night, torii gate, omikuji paper strips moving in gentle wind, muted gold lanterns, crimson accents, rain-slick stone path, spiritual calm, premium dark UI background, no readable text, no logos, no copyrighted characters, 16:9.

## Naruto Anime Banner
Route: `/animes`, `/animes/naruto`
Usage: universe banner.
Path: `/assets/anime-banners/naruto.webp`
Aspect ratio: 16:9
Prompt: Wide cinematic anime-inspired banner for a ninja universe, hidden village at night, orange chakra glow, blue lightning traces, paper scrolls, silhouettes of three original ninja figures, dramatic clouds, subtle Japanese patterns, premium dark UI background, no readable text, no logos, no copyrighted characters, space for title overlay, 16:9.

## One Piece Anime Banner
Route: `/animes`, `/animes/one-piece`
Usage: universe banner.
Path: `/assets/anime-banners/one-piece.webp`
Aspect ratio: 16:9
Prompt: Wide cinematic anime-inspired adventure banner, dark ocean at sunset/night, sailing ship silhouette, warm gold lantern light, wind, waves, crew silhouettes as original figures, sense of freedom and treasure, premium dark UI background, no text, no logos, no copyrighted characters, 16:9.

## My Hero Academia Anime Banner
Route: `/animes`, `/animes/my-hero-academia`
Usage: universe banner.
Path: `/assets/anime-banners/my-hero-academia.webp`
Aspect ratio: 16:9
Prompt: Wide cinematic anime superhero academy banner, modern city at night, green-blue heroic lightning versus dark red villain smoke, silhouettes of original students and villains on rooftops, dramatic action energy, premium dark UI background, no text, no logos, no copyrighted characters, 16:9.

## Demon Slayer Anime Banner
Route: `/animes`, `/animes/demon-slayer`
Usage: universe banner.
Path: `/assets/anime-banners/demon-slayer.webp`
Aspect ratio: 16:9
Prompt: Wide cinematic anime sword-hunter banner, moonlit forest, mist, sparks of flame and water-like trails, traditional Japanese patterns, silhouettes of original swordsmen, dark elegant atmosphere, no text, no logos, no copyrighted characters, 16:9.

## Jujutsu Kaisen Anime Banner
Route: `/animes`, `/animes/jujutsu-kaisen`
Usage: universe banner.
Path: `/assets/anime-banners/jujutsu-kaisen.webp`
Aspect ratio: 16:9
Prompt: Wide cinematic supernatural anime banner, abandoned urban street at night, violet and blue cursed energy, ritual symbols, shadowy original figures, smoke and fractured glass, premium dark UI mood, no text, no logos, no copyrighted characters, 16:9.

## Attack on Titan Anime Banner
Route: `/animes`, `/animes/attack-on-titan`
Usage: universe banner.
Path: `/assets/anime-banners/attack-on-titan.webp`
Aspect ratio: 16:9
Prompt: Wide cinematic dark war anime banner, massive stone walls, smoke, dust, dramatic sunset through clouds, tiny original soldier silhouettes with capes, tension and scale, muted amber and crimson accents, no text, no logos, no copyrighted characters, 16:9.

## Chainsaw Man Anime Banner
Route: `/animes`, `/animes/chainsaw-man`
Usage: universe banner.
Path: `/assets/anime-banners/chainsaw-man.webp`
Aspect ratio: 16:9
Prompt: Wide cinematic urban dark anime banner, rain-slick alley, red neon reflections, abstract saw-like energy shapes without gore, chaotic city atmosphere, original silhouettes only, premium dark UI background, no text, no logos, no copyrighted characters, 16:9.

## Fullmetal Alchemist Anime Banner
Route: `/animes`, `/animes/fullmetal-alchemist`
Usage: universe banner.
Path: `/assets/anime-banners/fullmetal-alchemist.webp`
Aspect ratio: 16:9
Prompt: Wide cinematic alchemy anime banner, glowing transmutation circles, brass and steel laboratory, blue sparks, gold dust, two original alchemist silhouettes, dark premium archive mood, no readable text, no logos, no copyrighted characters, 16:9.

## Haikyuu Anime Banner
Route: `/animes`, `/animes/haikyuu`
Usage: universe banner.
Path: `/assets/anime-banners/haikyuu.webp`
Aspect ratio: 16:9
Prompt: Wide cinematic sports anime banner, indoor volleyball court at night with dramatic overhead lights, orange and blue motion streaks, original athlete silhouettes jumping, energetic but premium dark UI background, no text, no logos, no copyrighted characters, 16:9.

## Copa Villanos Event Cover
Route: `/eventos`, `/eventos/copa-villanos`
Usage: event campaign cover.
Path: `/assets/event-covers/copa-villanos.webp`
Aspect ratio: 16:9
Prompt: Wide dark anime villain cup banner, threatening original antagonist silhouettes in smoke, crimson and violet aura, fractured crown symbol, heavy shadows, premium seasonal campaign mood, no readable text, no logos, no copyrighted characters, 16:9.

## Semana One Piece Event Cover
Route: `/eventos`, `/eventos/semana-one-piece`
Usage: event campaign cover.
Path: `/assets/event-covers/semana-one-piece.webp`
Aspect ratio: 16:9
Prompt: Wide anime adventure campaign banner, night sea, ship deck, warm lanterns, original crew silhouettes, gold and navy palette, wind and waves, premium event cover, no text, no logos, no copyrighted characters, 16:9.

## Arco Husbandos Event Cover
Route: `/eventos`, `/eventos/arco-husbandos`
Usage: event campaign cover.
Path: `/assets/event-covers/arco-husbandos.webp`
Aspect ratio: 16:9
Prompt: Wide elegant anime premium event banner, stylish original male fighter silhouettes, dark violet-blue lighting, muted gold rim light, rain and smoke, refined tournament presentation, no text, no logos, no copyrighted characters, 16:9.

## Top Waifus Event Cover
Route: `/eventos`, `/eventos/top-waifus`
Usage: event campaign cover.
Path: `/assets/event-covers/top-waifus.webp`
Aspect ratio: 16:9
Prompt: Wide premium anime event banner, elegant original female silhouettes, dark floral background, soft crimson petals, muted gold highlights, tasteful and cinematic, no fanservice, no text, no logos, no copyrighted characters, 16:9.

## MHA Heroes vs Villains Tournament Banner
Route: `/torneos`, `/torneos/mha-heroes-vs-villains`
Usage: tournament cover.
Path: `/assets/tournament-banners/mha-heroes-vs-villains.webp`
Aspect ratio: 16:9
Prompt: Wide anime tournament banner, two original teams facing each other in a ruined modern city arena, left side green-blue heroic energy, right side dark red villain energy, central lightning split, smoke and debris, no text, no logos, no copyrighted characters, 16:9.

## Slayers vs Sorcerers Tournament Banner
Route: `/torneos`, `/torneos/slayers-vs-sorcerers`
Usage: tournament cover.
Path: `/assets/tournament-banners/slayers-vs-sorcerers.webp`
Aspect ratio: 16:9
Prompt: Wide cinematic anime battle banner, sword fighters on one side and sorcerers on the other, fire and arcane blue-violet magic clashing in the center, dark arena, sparks and smoke, original silhouettes, no text, no logos, no copyrighted characters, 16:9.

## Demon Slayer Internal Tournament Banner
Route: `/torneos`, `/torneos/demon-slayer-internal`
Usage: tournament cover.
Path: `/assets/tournament-banners/demon-slayer-internal.webp`
Aspect ratio: 16:9
Prompt: Wide elegant anime tournament banner, moonlit Japanese courtyard, swords planted in wet stone, flame/water/mist breath trails, dark crimson accents, elite internal competition mood, original silhouettes, no text, no logos, no copyrighted characters, 16:9.

## Jujutsu Sorcerer Cup Tournament Banner
Route: `/torneos`, `/torneos/jujutsu-sorcerer-cup`
Usage: tournament cover.
Path: `/assets/tournament-banners/jujutsu-sorcerer-cup.webp`
Aspect ratio: 16:9
Prompt: Wide supernatural anime cup banner, cursed urban arena at midnight, violet ritual circles, blue sparks, smoke and shadow figures, intense tournament energy, no readable text, no logos, no copyrighted characters, 16:9.

## Generic Error Scene
Route: global error boundary.
Usage: error screen background.
Path: `/assets/error-scenes/rainy-rooftop.webp`
Aspect ratio: 16:9
Prompt: Cinematic anime night scene, original young warrior sitting on a rainy rooftop looking down over a dark city, melancholic mood, obsidian blue palette, soft crimson UI glow area on left for error card, rain streaks, high contrast but readable, no text, no logos, no copyrighted characters, 16:9.

## 404 Scene
Route: `*`
Usage: not found page.
Path: `/assets/error-scenes/not-found-lost-shinobi.webp`
Aspect ratio: 16:9
Prompt: Cinematic anime lost traveler scene, original hooded figure standing in foggy city alley at night, distant neon, muted gold lantern, lonely mood, clear empty space for 404 UI card, no text, no logos, no copyrighted characters, 16:9.

## Empty Ranking Scene
Route: ranking empty state.
Usage: no ranking data.
Path: `/assets/empty-states/empty-ranking-arena.webp`
Aspect ratio: 16:9
Prompt: Empty anime tournament podium in a dark arena, trophy light off, faint dust and smoke, muted gold rim light, quiet anticipation, premium UI empty state background, no text, no logos, no copyrighted characters, 16:9.

## Empty Search Scene
Route: search empty states.
Usage: no results.
Path: `/assets/empty-states/empty-search-night-city.webp`
Aspect ratio: 16:9
Prompt: Cinematic anime night city search scene, misty street, faint holographic search grid, one original small silhouette looking at floating panels, obsidian palette, crimson and cyan accents, no readable text, no logos, no copyrighted characters, 16:9.
