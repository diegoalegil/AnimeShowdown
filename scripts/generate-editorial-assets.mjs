#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const repoRoot = new URL('..', import.meta.url).pathname
const publicDir = join(repoRoot, 'frontend/public')

const W = 1600
const H = 900

const PALETTES = {
  crimson: ['#070a12', '#9f1d2c', '#c5a15a', '#24c6dc', '#1a2133'],
  gold: ['#080b12', '#b9862e', '#f0c46a', '#1f6b83', '#151b2a'],
  teal: ['#071019', '#1f6b83', '#24c6dc', '#9f1d2c', '#101522'],
  violet: ['#090817', '#4b327f', '#c5a15a', '#9f1d2c', '#151426'],
  danger: ['#08070f', '#7f1d1d', '#9f1d2c', '#4b327f', '#16111f'],
  ember: ['#090a10', '#8a5a16', '#c5a15a', '#9f1d2c', '#19140d'],
}

const ASSETS = [
  ['assets/brand/backgrounds/home-hero.svg', '決', 'crimson', 'arena', 'hero'],
  ['assets/brand/backgrounds/home-pulse.svg', '今', 'teal', 'city', 'dashboard'],
  ['assets/brand/backgrounds/ranking-hero.svg', '冠', 'gold', 'hall', 'ranking'],
  ['assets/brand/backgrounds/anime-catalog.svg', '界', 'crimson', 'archive', 'anime'],
  ['assets/brand/backgrounds/tournament-catalog.svg', '戦', 'teal', 'versus', 'tournament'],
  ['assets/brand/backgrounds/events-hero.svg', '祭', 'violet', 'campaign', 'event'],
  ['assets/brand/backgrounds/games-hub.svg', '遊', 'crimson', 'moon', 'games'],
  ['assets/brand/backgrounds/global-night.svg', '夜', 'crimson', 'city', 'global'],

  ['assets/fallbacks/anime-fallback.svg', '界', 'crimson', 'archive', 'fallback'],
  ['assets/fallbacks/tournament-fallback.svg', '戦', 'teal', 'versus', 'fallback'],
  ['assets/fallbacks/event-fallback.svg', '祭', 'violet', 'campaign', 'fallback'],
  ['assets/fallbacks/game-fallback.svg', '遊', 'crimson', 'moon', 'fallback'],

  ['assets/anime-banners/naruto.svg', '忍', 'ember', 'village', 'anime'],
  ['assets/anime-banners/one-piece.svg', '海', 'gold', 'sea', 'anime'],
  ['assets/anime-banners/my-hero-academia.svg', '英', 'teal', 'city-clash', 'anime'],
  ['assets/anime-banners/demon-slayer.svg', '滅', 'danger', 'forest-fire', 'anime'],
  ['assets/anime-banners/jujutsu-kaisen.svg', '呪', 'violet', 'curse-city', 'anime'],
  ['assets/anime-banners/attack-on-titan.svg', '壁', 'ember', 'wall-smoke', 'anime'],
  ['assets/anime-banners/chainsaw-man.svg', '鋸', 'danger', 'street-chaos', 'anime'],
  ['assets/anime-banners/fullmetal-alchemist.svg', '錬', 'gold', 'alchemy', 'anime'],
  ['assets/anime-banners/haikyuu.svg', '翔', 'teal', 'court', 'anime'],
  ['assets/anime-banners/death-note.svg', '裁', 'danger', 'judgement', 'anime'],
  ['assets/anime-banners/bleach.svg', '魂', 'teal', 'blade-moon', 'anime'],
  ['assets/anime-banners/black-clover.svg', '魔', 'violet', 'grimoire', 'anime'],

  ['assets/tournament-banners/mha-heroes-vs-villains.svg', '対', 'teal', 'versus-city', 'tournament'],
  ['assets/tournament-banners/one-piece-strawhats.svg', '航', 'gold', 'sea', 'tournament'],
  ['assets/tournament-banners/slayers-vs-sorcerers.svg', '術', 'danger', 'blade-magic', 'tournament'],
  ['assets/tournament-banners/demon-slayer-internal.svg', '柱', 'danger', 'forest-fire', 'tournament'],
  ['assets/tournament-banners/pillars-of-the-corps.svg', '柱', 'gold', 'elite-hall', 'tournament'],
  ['assets/tournament-banners/shonen-showdown.svg', '王', 'crimson', 'arena', 'tournament'],
  ['assets/tournament-banners/jujutsu-sorcerer-cup.svg', '呪', 'violet', 'curse-city', 'tournament'],
  ['assets/tournament-banners/random-showdown.svg', '乱', 'crimson', 'fragment-arena', 'tournament'],

  ['assets/event-covers/copa-villanos.svg', '悪', 'danger', 'villain-smoke', 'event'],
  ['assets/event-covers/semana-one-piece.svg', '航', 'gold', 'sea', 'event'],
  ['assets/event-covers/arco-husbandos.svg', '剣', 'violet', 'elite-hall', 'event'],
  ['assets/event-covers/top-waifus.svg', '華', 'crimson', 'sakura-stage', 'event'],

  ['assets/game-covers/shadow-guess.svg', '影', 'crimson', 'moon-silhouette', 'game'],
  ['assets/game-covers/anime-reveal.svg', '謎', 'violet', 'reveal-blur', 'game'],
  ['assets/game-covers/anigrid.svg', '格', 'teal', 'puzzle-grid', 'game'],
  ['assets/game-covers/impostor-trial.svg', '裏', 'violet', 'impostor', 'game'],
  ['assets/game-covers/elo-duel.svg', '対', 'crimson', 'versus', 'game'],
  ['assets/game-covers/omikuji.svg', '吉', 'gold', 'torii', 'game'],

  ['assets/error-scenes/rainy-rooftop.svg', '雨', 'danger', 'rain-rooftop', 'error'],
  ['assets/error-scenes/not-found-lost-shinobi.svg', '迷', 'violet', 'fog-path', 'error'],
  ['assets/error-scenes/generic-error-rain.svg', '雨', 'danger', 'rain-rooftop', 'error'],

  ['assets/empty-states/quiet-arena.svg', '待', 'crimson', 'empty-arena', 'empty'],
  ['assets/empty-states/empty-ranking-arena.svg', '冠', 'gold', 'empty-podium', 'empty'],
  ['assets/empty-states/empty-search-night-city.svg', '探', 'teal', 'fog-path', 'empty'],
  ['assets/empty-states/no-duels-arena.svg', '休', 'violet', 'empty-arena', 'empty'],

  ['assets/particles/embers.svg', '火', 'danger', 'particles', 'overlay'],
  ['assets/particles/sakura-dark.svg', '花', 'crimson', 'sakura-stage', 'overlay'],
  ['assets/overlays/noise-grid.svg', '格', 'teal', 'puzzle-grid', 'overlay'],
]

function particles(accent, glow, count = 70) {
  let out = ''
  for (let i = 0; i < count; i += 1) {
    const x = (37 * i * 17) % W
    const y = (91 * i * 23) % H
    const r = 0.8 + ((i * 13) % 28) / 10
    const c = i % 5 === 0 ? glow : accent
    const o = 0.12 + ((i * 7) % 28) / 100
    out += `<circle cx="${x}" cy="${y}" r="${r.toFixed(1)}" fill="${c}" opacity="${o.toFixed(2)}"/>`
  }
  return out
}

function skyline(glow) {
  let out = ''
  for (let i = 0; i < 18; i += 1) {
    const w = 42 + (i % 4) * 18
    const h = 120 + ((i * 47) % 210)
    const x = i * 92 - 60
    const y = H - h - 72
    out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="#050810" opacity="0.82"/>`
    if (i % 3 === 0) out += `<rect x="${x + 10}" y="${y + 28}" width="${w - 20}" height="3" fill="${glow}" opacity="0.22"/>`
  }
  return out
}

function motif(name, colors, kanji) {
  const [, accent, glow, electric] = colors
  const common =
    `<g opacity="0.78">${particles(accent, glow)}</g>` +
    `<text x="1320" y="260" class="kanji" fill="${glow}" opacity="0.09">${kanji}</text>`

  switch (name) {
    case 'moon':
    case 'moon-silhouette':
      return `${common}<circle cx="1110" cy="300" r="190" fill="${accent}" opacity="0.34"/><circle cx="1110" cy="300" r="132" fill="${glow}" opacity="0.12"/><path d="M1005 655c56-170 168-170 224 0z" fill="#050810" opacity="0.9"/><circle cx="1117" cy="430" r="48" fill="#050810" opacity="0.9"/>`
    case 'versus':
    case 'versus-city':
      return `${common}${skyline(electric)}<path d="M782 155v590" stroke="${glow}" stroke-width="2" opacity="0.28"/><circle cx="800" cy="450" r="92" fill="none" stroke="${accent}" stroke-width="8" opacity="0.7"/><path d="M90 670C270 430 430 320 675 260" stroke="${electric}" stroke-width="10" opacity="0.34" fill="none"/><path d="M1510 670C1330 430 1170 320 925 260" stroke="${accent}" stroke-width="10" opacity="0.42" fill="none"/>`
    case 'sea':
      return `${common}<path d="M0 610c180-68 300 52 482-18 204-78 350 38 544-24 204-66 352 22 574-48v380H0z" fill="${glow}" opacity="0.15"/><path d="M0 700c210-56 340 46 540-10 220-62 360 28 540-12 240-54 356 22 520-30v252H0z" fill="${electric}" opacity="0.13"/><path d="M1090 222l110 50 110-50-54 120 54 120-110-50-110 50 54-120z" fill="${glow}" opacity="0.20"/>`
    case 'village':
      return `${common}${skyline(glow)}<circle cx="1130" cy="280" r="150" fill="${glow}" opacity="0.10"/><path d="M250 650l160-210 160 210zM490 650l130-170 130 170z" fill="#050810" opacity="0.8"/><path d="M260 505c180 36 298-58 482-4" stroke="${accent}" stroke-width="6" opacity="0.33" fill="none"/>`
    case 'forest-fire':
      return `${common}<path d="M0 730c210-210 364-160 502-330 120 168 268 112 430 330z" fill="#050810" opacity="0.82"/><path d="M880 760c90-230 170-210 190-430 56 176 180 230 134 430z" fill="${accent}" opacity="0.34"/><path d="M1010 770c40-140 92-168 86-280 58 100 112 150 108 280z" fill="${glow}" opacity="0.22"/>`
    case 'curse-city':
      return `${common}${skyline(electric)}<path d="M920 210c100 66 120 194 18 260s-242 16-282-94 56-232 168-202" fill="none" stroke="${accent}" stroke-width="9" opacity="0.34"/><path d="M680 610c190-128 380-128 570 0" stroke="${electric}" stroke-width="5" opacity="0.30" fill="none"/>`
    case 'wall-smoke':
      return `${common}<rect x="0" y="545" width="1600" height="165" fill="#050810" opacity="0.82"/><path d="M0 545h1600" stroke="${glow}" stroke-width="7" opacity="0.28"/><g opacity="0.24"><circle cx="1030" cy="412" r="190" fill="${accent}"/><circle cx="1200" cy="365" r="130" fill="${glow}"/><circle cx="760" cy="390" r="160" fill="${electric}"/></g>`
    case 'alchemy':
      return `${common}<circle cx="1080" cy="450" r="250" fill="none" stroke="${glow}" stroke-width="6" opacity="0.32"/><circle cx="1080" cy="450" r="156" fill="none" stroke="${accent}" stroke-width="4" opacity="0.38"/><path d="M1080 206l210 365H870z" fill="none" stroke="${glow}" stroke-width="4" opacity="0.30"/><path d="M830 450h500M1080 200v500" stroke="${electric}" stroke-width="3" opacity="0.22"/>`
    case 'court':
      return `${common}<path d="M0 720h1600v180H0z" fill="${accent}" opacity="0.12"/><path d="M190 720h1220M420 720v155M1180 720v155M800 720v180" stroke="${glow}" stroke-width="5" opacity="0.26"/><circle cx="800" cy="760" r="92" fill="none" stroke="${electric}" stroke-width="5" opacity="0.24"/>`
    case 'puzzle-grid':
      return `${common}<g transform="translate(870 190)" opacity="0.55">${Array.from({ length: 20 }, (_, i) => {
        const x = (i % 5) * 92
        const y = Math.floor(i / 5) * 92
        const fill = i % 3 === 0 ? accent : i % 3 === 1 ? electric : glow
        return `<rect x="${x}" y="${y}" width="72" height="72" rx="12" fill="${fill}" opacity="0.18" stroke="${fill}" stroke-width="2"/>`
      }).join('')}</g>`
    case 'impostor':
      return `${common}<g transform="translate(850 250)">${[0, 1, 2, 3].map((i) => `<path d="M${i * 130} 330c22-90 76-90 98 0z" fill="${i === 2 ? accent : '#050810'}" opacity="${i === 2 ? 0.48 : 0.82}"/><circle cx="${i * 130 + 49}" cy="218" r="42" fill="${i === 2 ? glow : '#050810'}" opacity="${i === 2 ? 0.36 : 0.82}"/>`).join('')}</g><path d="M760 660h620" stroke="${accent}" stroke-width="4" opacity="0.28"/>`
    case 'torii':
      return `${common}<path d="M930 260h420v48H930zM990 308h300v44H990zM1028 352h48v305h-48zM1205 352h48v305h-48zM960 640h360v40H960z" fill="${accent}" opacity="0.40"/><circle cx="1140" cy="240" r="170" fill="${glow}" opacity="0.13"/>`
    case 'rain-rooftop':
      return `${common}${skyline(glow)}<path d="M0 730h1600v170H0z" fill="#02040a" opacity="0.78"/><path d="M980 630c60-180 180-180 240 0z" fill="#02040a" opacity="0.92"/><circle cx="1100" cy="415" r="58" fill="#02040a" opacity="0.92"/><g opacity="0.20">${Array.from({ length: 55 }, (_, i) => `<path d="M${(i * 83) % W} ${((i * 191) % H) - 120}l-18 108" stroke="${glow}" stroke-width="2"/>`).join('')}</g>`
    case 'empty-podium':
      return `${common}<rect x="955" y="550" width="180" height="170" rx="12" fill="${glow}" opacity="0.20"/><rect x="765" y="620" width="180" height="100" rx="12" fill="${accent}" opacity="0.18"/><rect x="1145" y="650" width="180" height="70" rx="12" fill="${electric}" opacity="0.18"/>`
    default:
      return `${common}${skyline(glow)}<path d="M910 690c72-220 268-220 340 0z" fill="${accent}" opacity="0.22"/><circle cx="1080" cy="430" r="96" fill="${glow}" opacity="0.11"/>`
  }
}

function svg({ kanji, paletteName, motifName }) {
  const colors = PALETTES[paletteName] ?? PALETTES.crimson
  const [bg, accent, glow, electric, surface] = colors
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="AnimeShowdown editorial visual">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${bg}"/>
      <stop offset="0.48" stop-color="${surface}"/>
      <stop offset="1" stop-color="#03050a"/>
    </linearGradient>
    <radialGradient id="r1" cx="78%" cy="26%" r="58%">
      <stop offset="0" stop-color="${accent}" stop-opacity="0.38"/>
      <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="r2" cx="20%" cy="18%" r="58%">
      <stop offset="0" stop-color="${glow}" stop-opacity="0.22"/>
      <stop offset="1" stop-color="${glow}" stop-opacity="0"/>
    </radialGradient>
    <filter id="blur"><feGaussianBlur stdDeviation="42"/></filter>
    <style>
      .kanji{font-family:"Noto Sans JP","Hiragino Sans","Yu Gothic",sans-serif;font-size:360px;font-weight:900}
    </style>
  </defs>
  <rect width="1600" height="900" fill="url(#bg)"/>
  <rect width="1600" height="900" fill="url(#r1)"/>
  <rect width="1600" height="900" fill="url(#r2)"/>
  <circle cx="1260" cy="240" r="250" fill="${accent}" opacity="0.18" filter="url(#blur)"/>
  <circle cx="280" cy="620" r="280" fill="${electric}" opacity="0.08" filter="url(#blur)"/>
  ${motif(motifName, colors, kanji)}
  <rect width="1600" height="900" fill="#03050a" opacity="0.08"/>
</svg>`
}

for (const [path, kanji, paletteName, motifName] of ASSETS) {
  const fullPath = join(publicDir, path)
  await mkdir(dirname(fullPath), { recursive: true })
  await writeFile(fullPath, svg({ kanji, paletteName, motifName }))
}

console.log(`editorial-assets: ${ASSETS.length} SVG asset(s) generated`)
