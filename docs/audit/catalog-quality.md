# Auditoría de calidad del catálogo

> Generado: 2026-05-22T02:15:53.850Z
> Script: `scripts/audit/catalog-quality.mjs`

## Resumen

| Métrica | Valor |
|---|---|
| Personajes en seed | 1052 |
| Slugs duplicados | 0 ✓ |
| Slugs con caracteres inválidos | 1 ⚠ |
| Personajes sin imagen accesible | 0 ✓ |
| Tags huérfanos (slug no existe) | 7 ⚠ |
| Imágenes huérfanas (slug sin seed) | 36 ⚠ |
| Términos glossary linkados con tag | 4 / 30 |
| Términos glossary sin tag cross-link | 26 ⚠ |
| Animes en disco | 105 |
| Tags definidos | 85 |

## ⚠ Slugs con caracteres inválidos

Slugs que no matchean `[a-z0-9_-]+`. Causa problemas en URLs y queries.

| Slug | Nombre |
|---|---|
| `L` | L |

## ⚠ Tags huérfanos

Slugs en `personajes-tags.js` que NO existen en `personajes-seed.json`.

| Slug | Tags |
|---|---|
| `roronoa_zoro` | rival, hero, husbando |
| `jiraiya` | mentor |
| `hinata_hyuga` | waifu |
| `katsuki_bakugou` | rival |
| `tanjiro_kamado` | hero, protagonist |
| `shinobu_kocho` | waifu |
| `yuji_itadori` | hero, protagonist |

## ⚠ Términos glossary sin cross-link a personajes

Estos términos del glossary no aparecen como tag en `personajes-tags.js`.
Si añadiéramos `/personajes?tag=<term>`, estos no devolverían resultados.

| Término |
|---|
| `himedere` |
| `shounen` |
| `seinen` |
| `shoujo` |
| `josei` |
| `isekai` |
| `mecha` |
| `slice of life` |
| `harem` |
| `mahou shoujo` |
| `sports anime` |
| `sentai` |
| `senpai / kouhai` |
| `bakugeisha` |
| `op / ed` |
| `filler` |
| `ova / ona` |
| `sakuga` |
| `seiyuu` |
| `ecchi` |
| `moe` |
| `otaku` |
| `weeb / weeaboo` |
| `tier list` |
| `best girl / best boy` |
| `power scaling` |

## ⚠ Imágenes huérfanas (slug en disco sin entry en seed)

Total: 36. Mostrando los primeros 30.

Posibles causas: personajes borrados del seed sin borrar imágenes, slugs renombrados con archivo viejo quedó, archivo de variant (-300, -600) mal capturado.

| Anime | Slug |
|---|---|
| 86_Eighty-Six | `.DS_Store` |
| Angel_Beats | `yui` |
| Another | `.DS_Store` |
| Ao_no_Exorcist | `.DS_Store` |
| Aoashi | `.DS_Store` |
| Code_Geass | `.DS_Store` |
| Cyberpunk_Edgerunners | `lucy` |
| Date_a_Live | `kurumi_tokisaki` |
| Dr_Stone | `.DS_Store` |
| Dr_Stone | `kohaku` |
| Elfen_Lied | `lucy` |
| Fullmetal_Alchemist | `.DS_Store` |
| Fumetsu_no_Anata_e | `.DS_Store` |
| Gachiakuta | `.DS_Store` |
| Gintama | `.DS_Store` |
| Hunter_x_Hunter | `.DS_Store` |
| Inazuma_Eleven | `.DS_Store` |
| Inuyasha | `.DS_Store` |
| Inuyasha | `kohaku` |
| Kaoru_Hana_wa_Rin_to_Saku | `.DS_Store` |
| Kill_la_Kill | `.DS_Store` |
| Koe_no_Katachi | `.DS_Store` |
| Komi_san_wa_Komyushou_Desu | `.DS_Store` |
| Madoka_Magica | `.DS_Store` |
| Mob_Psycho_100 | `.DS_Store` |
| Monogatari_Series | `.DS_Store` |
| Monster | `.DS_Store` |
| Mushishi | `.DS_Store` |
| One_Piece | `boa_hancock_alt` |
| One_Piece | `monkey_d_luffy` |
| ... | ... 6 más |

## Cobertura por anime (top 20 con más personajes)

| Anime | Personajes |
|---|---|
| My Hero Academia | 55 |
| Naruto | 42 |
| Demon Slayer | 39 |
| Jujutsu Kaisen | 29 |
| Chainsaw Man | 20 |
| Fullmetal Alchemist | 20 |
| Haikyuu | 20 |
| Mazinger Z | 20 |
| One Piece | 19 |
| Re:Zero | 19 |
| Black Clover | 18 |
| Pokémon | 17 |
| Charlotte | 16 |
| Inazuma Eleven | 16 |
| Sword Art Online | 16 |
| Dragon Ball | 15 |
| Uma Musume | 15 |
| Gintama | 14 |
| Hunter x Hunter | 14 |
| Inuyasha | 14 |

## Veredicto

**8 issues** detectados que merecen atención. Priorizar duplicados y missing images primero — son lo que se rompe en runtime.
