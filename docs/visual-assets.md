# Sistema de assets visuales de AnimeShowdown

AnimeShowdown ya no debe usar cards SSR como portada universal. Las cards son una pieza coleccionable para personajes, ranking y ciertos duelos, pero las secciones editoriales usan assets propios.

## Estructura

- `frontend/public/assets/brand/backgrounds/`
- `frontend/public/assets/anime-banners/`
- `frontend/public/assets/tournament-banners/`
- `frontend/public/assets/event-covers/`
- `frontend/public/assets/game-covers/`
- `frontend/public/assets/error-scenes/`
- `frontend/public/assets/empty-states/`
- `frontend/public/assets/particles/`
- `frontend/public/assets/overlays/`

El registro vive en `frontend/src/data/visual-assets.js`. Cada entrada tiene `expectedPath`, `fallbackImage`, paleta, kanji y prompt. Mientras el archivo final no exista, el componente `EditorialCover` usa una escena cinematografica de marca como fallback.

Despues de meter nuevos `.webp` en `frontend/public/assets`, ejecuta:

```bash
node scripts/sync-visual-assets.mjs
```

Ese script regenera `frontend/src/data/visual-assets-manifest.js` para que el frontend empiece a usar los archivos reales sin pedir URLs inexistentes ni generar 404 masivos.

## Reglas de arte

- Genera personajes originales o siluetas genericas. No copies personajes, logos ni outfits reconocibles.
- No metas texto dentro de la imagen. La UI ya pone titulos, badges y CTAs encima.
- Deja zona segura a la izquierda o abajo para copy.
- Usa WebP final.
- Mantén una misma identidad: obsidiana, carmesi oscuro, dorado apagado, azul electrico sutil, lluvia/humo/particulas.
- Evita collage de cards. La imagen debe parecer portada editorial o key art, no album de thumbnails.

## Tamaños

- Home / fondos principales: `2400x1350`
- Anime banners: `1600x640`
- Tournament banners: `1600x640`
- Event covers: `1600x640`
- Game covers: `1600x900`
- Error / empty states: `2400x1350` o `1600x900`

## Prompts base

Anade siempre esta restriccion al final:

```text
Original anime-inspired characters only, not recognizable copyrighted characters, no logos, no readable text, cinematic dark tournament platform art.
```

## Home

Path: `frontend/public/assets/brand/backgrounds/home-hero.webp`

```text
Full hero background for a premium anime tournament platform, cinematic rainy night city, obsidian blue-black atmosphere, subtle crimson tournament lights, floating abstract energy panels instead of character cards, distant arena glow, dramatic depth, left and center safe area for headline, high contrast but readable, 2400x1350. Original anime-inspired characters only, not recognizable copyrighted characters, no logos, no readable text.
```

Path: `frontend/public/assets/brand/backgrounds/home-pulse.webp`

```text
Live activity dashboard background for a premium anime tournament platform, dark arena at night, fog, subtle crowd lights, crimson smoke and electric blue energy crossing in the distance, small particles and ash, no characters in foreground, safe readable center, 2400x1350. Original anime-inspired characters only, not recognizable copyrighted characters, no logos, no readable text.
```

## Anime banners

Path: `frontend/public/assets/anime-banners/naruto.webp`

```text
Wide editorial banner of a hidden ninja village at night, rain on rooftops, orange chakra trails, lantern light, three original ninja silhouettes moving across the skyline, cinematic premium anime key art, no card collage, no text, 1600x640. Original anime-inspired characters only, not recognizable copyrighted characters.
```

Path: `frontend/public/assets/anime-banners/one-piece.webp`

```text
Wide cinematic pirate adventure banner, moonlit sea, ship sails, warm gold lanterns, storm clouds breaking, ocean spray, original adventurous crew silhouettes on deck, premium anime key art, no card collage, no text, 1600x640. Original anime-inspired characters only, not recognizable copyrighted characters.
```

Path: `frontend/public/assets/anime-banners/my-hero-academia.webp`

```text
Wide hero academy battle banner, blue-green lightning versus dark crimson smoke, night city training arena, original young hero silhouettes facing masked villain silhouettes, energetic but premium, no card collage, no text, 1600x640. Original anime-inspired characters only, not recognizable copyrighted characters.
```

Path: `frontend/public/assets/anime-banners/demon-slayer.webp`

```text
Wide dark mountain night banner, mist, embers, red moon, elegant sword trails, original demon hunter silhouettes in patterned robes, cinematic anime poster mood, no card collage, no text, 1600x640. Original anime-inspired characters only, not recognizable copyrighted characters.
```

Path: `frontend/public/assets/anime-banners/jujutsu-kaisen.webp`

```text
Wide supernatural school rooftop at night, purple-blue cursed energy, black smoke, red sparks, original sorcerer silhouettes, ominous premium anime composition, no card collage, no text, 1600x640. Original anime-inspired characters only, not recognizable copyrighted characters.
```

Path: `frontend/public/assets/anime-banners/attack-on-titan.webp`

```text
Wide dramatic walled city battlefield, smoke, rain, military silhouettes with grappling gear, flares, a colossal abstract shadow behind fog, no recognizable characters, cinematic tension, no card collage, no text, 1600x640. Original anime-inspired characters only.
```

## Tournament banners

Path: `frontend/public/assets/tournament-banners/mha-heroes-vs-villains.webp`

```text
Horizontal tournament banner, two opposing teams of original hero and villain silhouettes, blue-green lightning on the left, crimson smoke on the right, central VS energy, night arena, premium anime competition poster, no card collage, no text, 1600x640. Original anime-inspired characters only, not recognizable copyrighted characters.
```

Path: `frontend/public/assets/tournament-banners/one-piece-strawhats.webp`

```text
Horizontal tournament banner, pirate crew adventure energy, ship deck under moonlight, ocean spray, warm lantern glow, original silhouettes, premium anime event key art, no card collage, no text, 1600x640. Original anime-inspired characters only.
```

Path: `frontend/public/assets/tournament-banners/slayers-vs-sorcerers.webp`

```text
Horizontal versus banner, sword embers and cursed blue magic colliding, dark forest shrine arena, original fighter silhouettes, smoke and sparks, cinematic anime tournament style, no card collage, no text, 1600x640. Original anime-inspired characters only.
```

Path: `frontend/public/assets/tournament-banners/demon-slayer-internal.webp`

```text
Horizontal elite swordsman tournament banner, moonlit training courtyard, flame and water sword trails, fog, original robed hunter silhouettes, premium dramatic composition, no card collage, no text, 1600x640. Original anime-inspired characters only.
```

Path: `frontend/public/assets/tournament-banners/pillars-of-the-corps.webp`

```text
Horizontal premium elite corps banner, elegant lineup of original swordsman silhouettes, black-gold ceremonial stage, red petals, fog, cinematic anime event poster, no card collage, no text, 1600x640. Original anime-inspired characters only.
```

## Event covers

Path: `frontend/public/assets/event-covers/copa-villanos.webp`

```text
Horizontal seasonal campaign cover, ominous villain silhouettes in fog, crimson moon, purple shadows, fractured tournament crown, dark premium anime poster, no card collage, no text, 1600x640. Original anime-inspired characters only, not recognizable copyrighted characters.
```

Path: `frontend/public/assets/event-covers/semana-one-piece.webp`

```text
Horizontal anime campaign cover, moonlit ocean adventure, ship silhouettes, warm lanterns, sea spray, treasure-map glow, premium cinematic composition, no card collage, no text, 1600x640. Original anime-inspired characters only.
```

Path: `frontend/public/assets/event-covers/arco-husbandos.webp`

```text
Horizontal premium character campaign cover, elegant male anime-inspired silhouettes in rain, violet and gold rim light, ceremonial arena, dramatic and tasteful, no text, 1600x640. Original anime-inspired characters only.
```

## Game covers

Path: `frontend/public/assets/game-covers/shadow-guess.webp`

```text
Game cover, mysterious original character silhouette before a huge crimson moon, black city skyline, drifting petals, subtle kanji shapes as abstract background, no text, 1600x900. Original anime-inspired characters only, not recognizable copyrighted characters.
```

Path: `frontend/public/assets/game-covers/anime-reveal.webp`

```text
Game cover, blurred original anime figure emerging from distortion, warm amber and crimson energy, mystery reveal mood, cinematic depth of field, no text, 1600x900. Original anime-inspired characters only, not recognizable copyrighted characters.
```

Path: `frontend/public/assets/game-covers/anigrid.webp`

```text
Game cover, anime puzzle interface in a dark control room, glowing grid panels, blue-green hint symbols, small original character silhouette, premium logic-game mood, no text, 1600x900. Original anime-inspired characters only.
```

Path: `frontend/public/assets/game-covers/impostor-trial.webp`

```text
Game cover, four original anime silhouettes in a dark trial room, one has a different crimson aura, suspicious spotlight, fog, premium mystery anime scene, no text, 1600x900. Original anime-inspired characters only.
```

Path: `frontend/public/assets/game-covers/elo-duel.webp`

```text
Game cover, two original fighters facing each other in a dark arena, split crimson and electric blue energy, central VS-shaped light, ash particles, no text, 1600x900. Original anime-inspired characters only, not recognizable copyrighted characters.
```

## Error y vacios

Path: `frontend/public/assets/error-scenes/rainy-rooftop.webp`

```text
Emotional error page background, original melancholic anime figure sitting on a rooftop under heavy rain, distant night city, dark blue-gray palette, left side safe for glass error card, cinematic, no text, 2400x1350. Original anime-inspired character only, not recognizable copyrighted characters.
```

Path: `frontend/public/assets/empty-states/quiet-arena.webp`

```text
Empty state illustration, quiet dark tournament arena before opening, fog, soft gold lights, vacant bracket board, emotional premium anime mood, no text, 1600x900. Original anime-inspired environment, no recognizable copyrighted characters.
```
