#!/usr/bin/env node
import { mkdir } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FRONTEND = resolve(__dirname, '..')
const ROOT = resolve(FRONTEND, '..')
const OUT_DIR = join(FRONTEND, 'public', 'img', 'stage')
const SEED_PATH = join(ROOT, 'backend', 'src', 'main', 'resources', 'personajes-seed.json')

const personajes = JSON.parse(readFileSync(SEED_PATH, 'utf8'))
const bySlug = new Map(personajes.map((p) => [p.slug, p]))

const THEMES = {
  pink: {
    a: '#be2b38',
    b: '#b33cff',
    c: '#18d6ff',
    dark: '#070912',
    kanji: '#9f1d2c',
  },
  cyan: {
    a: '#22d3ee',
    b: '#be2b38',
    c: '#34d399',
    dark: '#050a12',
    kanji: '#22d3ee',
  },
  amber: {
    a: '#fbbf24',
    b: '#be2b38',
    c: '#fb7185',
    dark: '#0c0910',
    kanji: '#fbbf24',
  },
  purple: {
    a: '#a855f7',
    b: '#be2b38',
    c: '#22d3ee',
    dark: '#080713',
    kanji: '#a855f7',
  },
  emerald: {
    a: '#34d399',
    b: '#22d3ee',
    c: '#be2b38',
    dark: '#050d11',
    kanji: '#34d399',
  },
}

const ASSETS = [
  {
    name: 'home-hero',
    theme: 'pink',
    kanji: '決',
    left: ['miku', 'makima', 'kuroneko', 'momo_ayase'],
    right: ['mai_sakurajima', 'shinobu', 'satoru_gojo', 'deku'],
    centerGlow: true,
  },
  {
    name: 'home-pulse',
    theme: 'emerald',
    kanji: '今',
    left: ['allmight', 'deku', 'bakugo'],
    right: ['tomura_shigaraki', 'sukuna', 'shoto_todoroki'],
    band: true,
  },
  {
    name: 'games-stage',
    theme: 'purple',
    kanji: '影',
    left: ['momo_ayase', 'miku', 'kuroneko'],
    right: ['satoru_gojo', 'shinobu', 'mai_sakurajima'],
    moon: true,
  },
  {
    name: 'anime-reveal',
    theme: 'pink',
    kanji: '謎',
    left: ['riza_hawkeye', 'edward_elric'],
    right: ['roy_mustang', 'alphonse_elric'],
    centralSilhouette: 'roy_mustang',
  },
  {
    name: 'elo-duel',
    theme: 'pink',
    kanji: '対',
    left: ['miku', 'luffy'],
    right: ['go_gunhee', 'sukuna'],
    versus: true,
  },
  {
    name: 'impostor',
    theme: 'purple',
    kanji: '裏',
    left: ['yuri_zahard', 'evan_edrok', 'anaak_jahad'],
    right: ['gyutaro', 'hatsu'],
    band: true,
  },
  {
    name: 'ranking',
    theme: 'amber',
    kanji: '冠',
    left: ['l', 'light_yagami'],
    right: ['luffy', 'zoro', 'naruto'],
    crownGlow: true,
  },
  {
    name: 'animes',
    theme: 'cyan',
    kanji: '界',
    left: ['naruto', 'sasuke', 'sakura_haruno'],
    right: ['luffy', 'zoro', 'nami', 'deku', 'bakugo'],
    band: true,
  },
  {
    name: 'torneos',
    theme: 'cyan',
    kanji: '戦',
    left: ['deku', 'bakugo', 'allmight'],
    right: ['sukuna', 'tomura_shigaraki', 'shoto_todoroki'],
    versus: true,
  },
  {
    name: 'eventos',
    theme: 'pink',
    kanji: '祭',
    left: ['satoru_gojo', 'nezuko', 'sukuna'],
    right: ['luffy', 'zoro', 'nami', 'law'],
    band: true,
  },
  {
    name: 'omikuji',
    theme: 'amber',
    kanji: '吉',
    left: ['mai_sakurajima', 'miku'],
    right: ['shinobu', 'momo_ayase'],
    shrine: true,
  },
]

const escapeXml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

function svgBase({ width, height, theme, kanji, moon, versus, shrine, crownGlow, band }) {
  const t = THEMES[theme]
  const particles = Array.from({ length: 96 }, (_, i) => {
    const x = (i * 997 + 113) % width
    const y = (i * 463 + 211) % height
    const r = 0.8 + ((i * 7) % 22) / 10
    const opacity = 0.16 + ((i * 13) % 60) / 100
    const color = i % 5 === 0 ? t.c : t.a
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" opacity="${opacity}" />`
  }).join('')
  const city = Array.from({ length: 26 }, (_, i) => {
    const w = 30 + ((i * 19) % 76)
    const h = 120 + ((i * 47) % 320)
    const x = (i * 91) % width
    const y = height - h
    const opacity = 0.1 + (i % 4) * 0.025
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="#05060d" opacity="${opacity}" />`
  }).join('')
  const petals = Array.from({ length: 42 }, (_, i) => {
    const x = (i * 149 + 37) % width
    const y = (i * 83 + 81) % height
    const rot = (i * 31) % 360
    const opacity = 0.16 + ((i * 11) % 65) / 100
    return `<ellipse cx="${x}" cy="${y}" rx="7" ry="2.2" fill="${t.a}" opacity="${opacity}" transform="rotate(${rot} ${x} ${y})" />`
  }).join('')
  const moonMarkup = moon
    ? `<circle cx="${width * 0.67}" cy="${height * 0.23}" r="${height * 0.18}" fill="${t.a}" opacity="0.22" />
       <circle cx="${width * 0.67}" cy="${height * 0.23}" r="${height * 0.145}" fill="none" stroke="${t.a}" stroke-width="3" opacity="0.35" />`
    : ''
  const versusMarkup = versus
    ? `<g opacity="0.9">
        <line x1="${width * 0.38}" y1="${height * 0.55}" x2="${width * 0.62}" y2="${height * 0.55}" stroke="${t.a}" stroke-width="3" opacity="0.55" />
        <circle cx="${width / 2}" cy="${height * 0.55}" r="76" fill="#0d0d12" stroke="${t.a}" stroke-width="4" opacity="0.85" />
        <text x="${width / 2}" y="${height * 0.578}" text-anchor="middle" font-family="Arial, sans-serif" font-size="54" font-weight="900" fill="#fff">VS</text>
       </g>`
    : ''
  const shrineMarkup = shrine
    ? `<g opacity="0.28" transform="translate(${width * 0.72} ${height * 0.67}) scale(2.2)">
        <rect x="-62" y="-68" width="124" height="16" rx="3" fill="${t.a}" />
        <rect x="-50" y="-47" width="100" height="10" fill="${t.a}" />
        <rect x="-42" y="-36" width="12" height="90" fill="${t.a}" />
        <rect x="30" y="-36" width="12" height="90" fill="${t.a}" />
       </g>`
    : ''
  const crownMarkup = crownGlow
    ? `<path d="M0 70 L44 28 L86 68 L132 18 L176 68 L220 28 L264 70 L240 138 H24 Z" transform="translate(${width * 0.72} ${height * 0.18}) scale(1.8)" fill="${t.a}" opacity="0.09" />`
    : ''
  const bandMarkup = band
    ? `<path d="M0 ${height * 0.62} C ${width * 0.25} ${height * 0.48}, ${width * 0.52} ${height * 0.76}, ${width} ${height * 0.55} L ${width} ${height} L 0 ${height} Z" fill="${t.a}" opacity="0.10" />`
    : ''

  return Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="g1" cx="50%" cy="34%" r="62%">
          <stop offset="0%" stop-color="${t.a}" stop-opacity="0.28"/>
          <stop offset="45%" stop-color="${t.b}" stop-opacity="0.14"/>
          <stop offset="100%" stop-color="${t.dark}" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="v" x1="0" x2="1">
          <stop offset="0%" stop-color="${t.a}" stop-opacity="0.28"/>
          <stop offset="52%" stop-color="${t.b}" stop-opacity="0.14"/>
          <stop offset="100%" stop-color="${t.c}" stop-opacity="0.24"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="${t.dark}"/>
      <rect width="100%" height="100%" fill="url(#g1)"/>
      <rect width="100%" height="100%" fill="url(#v)" opacity="0.22"/>
      ${city}
      ${bandMarkup}
      ${moonMarkup}
      ${shrineMarkup}
      ${crownMarkup}
      <text x="${width * 0.78}" y="${height * 0.42}" font-family="'Hiragino Sans', 'Noto Sans JP', Arial, sans-serif" font-size="${height * 0.32}" font-weight="900" fill="${t.kanji}" opacity="0.105">${escapeXml(kanji)}</text>
      ${versusMarkup}
      ${particles}
      ${petals}
      <rect width="100%" height="100%" fill="none" stroke="${t.a}" stroke-opacity="0.18" stroke-width="2"/>
    </svg>
  `)
}

function assetPath(slug) {
  const p = bySlug.get(slug)
  if (!p?.imagenUrl) return null
  const relative = decodeURIComponent(p.imagenUrl.replace(/^\/img\//, ''))
  return join(FRONTEND, 'img', relative)
}

async function cardBuffer(slug, height, angle, theme) {
  const file = assetPath(slug)
  if (!file || !existsSync(file)) return null
  const t = THEMES[theme]
  const image = await sharp(file)
    .resize({ height, withoutEnlargement: true })
    .webp({ quality: 84 })
    .toBuffer({ resolveWithObject: true })
  const { width, height: h } = image.info
  const pad = Math.round(height * 0.035)
  const frame = Buffer.from(`
    <svg width="${width + pad * 2}" height="${h + pad * 2}" xmlns="http://www.w3.org/2000/svg">
      <rect x="${pad / 2}" y="${pad / 2}" width="${width + pad}" height="${h + pad}" rx="24" fill="#070912" opacity="0.55"/>
      <rect x="${pad / 2}" y="${pad / 2}" width="${width + pad}" height="${h + pad}" rx="24" fill="none" stroke="${t.a}" stroke-width="3" opacity="0.78"/>
      <rect x="${pad / 2}" y="${pad / 2}" width="${width + pad}" height="${h + pad}" rx="24" fill="none" stroke="white" stroke-width="1" opacity="0.22"/>
    </svg>
  `)
  return sharp(frame)
    .composite([{ input: image.data, left: pad, top: pad }])
    .rotate(angle, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
}

async function silhouette(slug, height, theme) {
  const file = assetPath(slug)
  if (!file || !existsSync(file)) return null
  const t = THEMES[theme]
  return sharp(file)
    .resize({ height, withoutEnlargement: true })
    .blur(8)
    .modulate({ saturation: 1.5, brightness: 0.72 })
    .tint(t.a)
    .png()
    .toBuffer()
}

function cardPlacements(asset, width, height) {
  const left = asset.left.map((slug, i) => ({
    slug,
    height: i % 2 === 0 ? 410 : 360,
    angle: -13 + i * 6,
    left: 42 + i * 74,
    top: 84 + i * 176,
  }))
  const right = asset.right.map((slug, i) => ({
    slug,
    height: i % 2 === 0 ? 420 : 365,
    angle: 12 - i * 5,
    left: width - 360 - i * 68,
    top: 70 + i * 166,
  }))
  if (asset.name === 'elo-duel') {
    return [
      { slug: asset.left[0], height: 650, angle: -2, left: 230, top: 230 },
      { slug: asset.right[0], height: 650, angle: 2, left: width - 640, top: 230 },
    ]
  }
  if (asset.name === 'impostor') {
    return [...asset.left, ...asset.right].map((slug, i) => ({
      slug,
      height: 445,
      angle: -5 + i * 3,
      left: 250 + i * 265,
      top: 300 + (i % 2) * 26,
    }))
  }
  if (asset.name === 'animes') {
    return [...asset.left, ...asset.right].map((slug, i) => ({
      slug,
      height: 340,
      angle: -8 + (i % 4) * 4,
      left: 70 + i * 210,
      top: 360 + (i % 3) * 78,
    }))
  }
  return [...left, ...right]
}

async function makeAsset(asset) {
  const width = 1920
  const height = 1080
  const base = sharp(svgBase({ width, height, ...asset }))
  const composites = []

  if (asset.centralSilhouette) {
    const input = await silhouette(asset.centralSilhouette, 560, asset.theme)
    if (input) composites.push({ input, left: 675, top: 235, blend: 'screen' })
  }

  for (const p of cardPlacements(asset, width, height)) {
    const input = await cardBuffer(p.slug, p.height, p.angle, asset.theme)
    if (!input) continue
    composites.push({ input, left: Math.round(p.left), top: Math.round(p.top), blend: 'over' })
  }

  const veil = Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="focus" cx="50%" cy="42%" r="48%">
          <stop offset="0%" stop-color="#000" stop-opacity="0"/>
          <stop offset="64%" stop-color="#000" stop-opacity="0.30"/>
          <stop offset="100%" stop-color="#000" stop-opacity="0.72"/>
        </radialGradient>
        <linearGradient id="top" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#05060b" stop-opacity="0.72"/>
          <stop offset="28%" stop-color="#05060b" stop-opacity="0.12"/>
          <stop offset="100%" stop-color="#05060b" stop-opacity="0.54"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#focus)"/>
      <rect width="100%" height="100%" fill="url(#top)"/>
    </svg>
  `)
  composites.push({ input: veil, left: 0, top: 0, blend: 'over' })

  await base
    .composite(composites)
    .webp({ quality: 78, effort: 5 })
    .toFile(join(OUT_DIR, `${asset.name}.webp`))
}

await mkdir(OUT_DIR, { recursive: true })
for (const asset of ASSETS) {
  await makeAsset(asset)
  console.log(`stage/${asset.name}.webp`)
}
