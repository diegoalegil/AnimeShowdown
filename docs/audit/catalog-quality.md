# Auditoría de calidad del catálogo

> Generado: 2026-05-22T08:28:21.464Z
> Script: `scripts/audit/catalog-quality.mjs`

## Resumen

| Métrica | Valor |
|---|---|
| Personajes en seed | 1052 |
| Slugs duplicados | 0 ✓ |
| Slugs con caracteres inválidos | 1 ⚠ |
| Personajes sin imagen accesible | 0 ✓ |
| Tags huérfanos (slug no existe) | 0 ✓ |
| Imágenes huérfanas (slug sin seed) | 11 ⚠ |
| Términos glossary linkados con tag | 4 / 30 |
| Términos glossary sin tag cross-link | 26 ⚠ |
| Animes en disco | 105 |
| Tags definidos | 83 |

## ⚠ Slugs con caracteres inválidos

Slugs que no matchean `[a-z0-9_-]+`. Causa problemas en URLs y queries.

| Slug | Nombre |
|---|---|
| `L` | L |

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

Total: 11. Mostrando los primeros 30.

Posibles causas: personajes borrados del seed sin borrar imágenes, slugs renombrados con archivo viejo quedó, archivo de variant (-300, -600) mal capturado.

| Anime | Slug |
|---|---|
| Angel_Beats | `yui` |
| Cyberpunk_Edgerunners | `lucy` |
| Date_a_Live | `kurumi_tokisaki` |
| Dr_Stone | `kohaku` |
| Elfen_Lied | `lucy` |
| Inuyasha | `kohaku` |
| One_Piece | `boa_hancock_alt` |
| One_Piece | `monkey_d_luffy` |
| One_Piece | `roronoa_zoro` |
| Pokemon | `lucy` |
| Sword_Art_Online | `yui` |

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

**1 issues** detectados que merecen atención. Priorizar duplicados y missing images primero — son lo que se rompe en runtime.
