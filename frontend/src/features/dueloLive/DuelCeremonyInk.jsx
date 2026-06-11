import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, invalidate } from '@react-three/fiber'
import { mulberry32 } from '../animes/galaxy/galaxy-layout.js'

/**
 * DuelCeremonyInk — disolución de tinta del kanji 勝/敗 (cierre del PvP).
 *
 * UN plano con fragment shader: el glifo se materializa por threshold de
 * ruido fbm sangrando desde los BORDES del trazo (la máscara lleva el
 * interior difuminado en el canal R: el centro exige más progreso), con
 * temblor de tinta fresca que se apaga al asentarse. Salpicaduras: un solo
 * THREE.Points desde píxeles de borde del trazo, solo gl_Position/alpha.
 *
 * Convenciones del proyecto (mismo patrón que KanjiInkAssembly):
 *  - No importar directo: DuelCeremony lo carga con lazy() tras decidir que
 *    hay WebGL y no hay reduced-motion — el chunk de three solo viaja
 *    cuando va a usarse.
 *  - Cero hex: tinta y salpicadura leídas en runtime de var(--color-*)
 *    (oro para 勝, ceniza fg-muted para 敗, carmesí para las gotas).
 *  - frameloop="demand": cada frame activo invalida el siguiente; al
 *    asentarse el kanji deja de pedir frames (frame final congelado).
 *    Con la pestaña oculta el reloj no acumula.
 *  - PRNG mulberry32 determinista (regla react-hooks/purity).
 */

const GRID = 512 // canvas de la máscara
const GLYPH_SPAN = 8.4 // alto del kanji en unidades de mundo
const CAM_Z = 14
const CAM_FOV = 40
const SPLAT_COUNT = 140
const INK_MS = 900
const SPLAT_AT = 420
const SPLAT_MS = 700

function readToken(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

const INK_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uMask;   // a = glifo nítido · r = interior difuminado
  uniform float uP;          // progreso 0..1
  uniform vec3 uInk;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p){
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float fbm(vec2 p){ float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
  void main() {
    // temblor de tinta fresca — se apaga al asentarse
    float wob = (fbm(vUv * 15.0) - 0.5) * 0.014 * (1.0 - uP);
    vec4 m = texture2D(uMask, vUv + wob);
    float n = fbm(vUv * 5.5);
    float th = n * 0.55 + m.r * 0.55;  // los bordes (r bajo) sangran primero
    float reveal = smoothstep(th - 0.08, th + 0.05, uP * 1.25);
    float front = 1.0 - smoothstep(0.0, 0.10, abs(uP * 1.25 - th)); // encharcado del frente
    float alpha = m.a * reveal;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(uInk * (0.82 + 0.35 * front), alpha);
  }`

const SPLAT_VERT = /* glsl */ `
  uniform float uT;        // 0..1 de la vida de las salpicaduras
  uniform float uPxScale;
  attribute vec3 aDir;
  attribute float aDelay;
  attribute float aSize;
  varying float vA;
  void main() {
    float t = clamp((uT - aDelay) / max(1.0 - aDelay, 0.001), 0.0, 1.0);
    float e = 1.0 - (1.0 - t) * (1.0 - t); // ease-out
    vec3 pos = position + aDir * e * 1.9;
    vA = (1.0 - t) * step(0.001, uT);
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = aSize * (1.0 - 0.5 * t) * uPxScale / max(-mv.z, 0.1);
    gl_Position = projectionMatrix * mv;
  }`

const SPLAT_FRAG = /* glsl */ `
  precision highp float;
  uniform vec3 uSplat;
  varying float vA;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    float a = smoothstep(0.5, 0.1, d) * vA;
    if (a < 0.015) discard;
    gl_FragColor = vec4(uSplat, a * 0.9);
  }`

const maskCache = new Map()

/** Máscara del glifo: a = trazo nítido, r = interior difuminado (blur 14px
 *  pre-horneado UNA vez en canvas 2D — nada de filtros vivos en runtime).
 *  Devuelve también los píxeles de borde (origen de las salpicaduras). */
async function buildKanjiMask(glyph) {
  if (maskCache.has(glyph)) return maskCache.get(glyph)
  const family = readToken('--font-kanji-serif') || readToken('--font-jp') || 'serif'
  const font = `800 ${Math.round(GRID * 0.78)}px ${family}`
  try {
    await document.fonts.load(font, glyph)
  } catch {
    // seguimos con el stack que haya
  }
  const draw = (blur) => {
    const c = document.createElement('canvas')
    c.width = c.height = GRID
    const ctx = c.getContext('2d', { willReadFrequently: true })
    if (blur) ctx.filter = `blur(${blur}px)`
    ctx.fillStyle = 'white'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = font
    ctx.fillText(glyph, GRID / 2, GRID / 2 + GRID * 0.04)
    return ctx.getImageData(0, 0, GRID, GRID)
  }
  const sharp = draw(0)
  const soft = draw(14)
  const out = new ImageData(GRID, GRID)
  const edges = []
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const i = (y * GRID + x) * 4
      const a = sharp.data[i + 3]
      out.data[i] = soft.data[i + 3] // r = interior difuminado
      out.data[i + 3] = a
      if (a > 100 && (x % 3 === 0) && (y % 3 === 0)) {
        const left = sharp.data[i - 4 + 3] ?? 0
        const right = sharp.data[i + 4 + 3] ?? 0
        if (left < 50 || right < 50) edges.push(x, y)
      }
    }
  }
  const c = document.createElement('canvas')
  c.width = c.height = GRID
  c.getContext('2d').putImageData(out, 0, 0)
  const texture = new THREE.CanvasTexture(c)
  texture.colorSpace = THREE.NoColorSpace
  const result = { texture, edges }
  maskCache.set(glyph, result)
  return result
}

function InkScene({ glyph, win, skipNonce, onSettled }) {
  const matRef = useRef()
  const splatMatRef = useRef()
  const [mask, setMask] = useState(null)
  const fx = useRef({ t: 0, settled: false, skipped: false, notified: false })
  const pageVisible = useRef(true)
  const onSettledRef = useRef(onSettled)
  useEffect(() => {
    onSettledRef.current = onSettled
  }, [onSettled])

  useEffect(() => {
    let alive = true
    buildKanjiMask(glyph).then((m) => {
      if (alive) {
        setMask(m)
        invalidate()
      }
    })
    return () => {
      alive = false
    }
  }, [glyph])

  useEffect(() => {
    const update = () => {
      pageVisible.current = document.visibilityState !== 'hidden'
      if (pageVisible.current) invalidate()
    }
    document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [])

  useEffect(() => {
    if (skipNonce > 0) {
      fx.current.skipped = true
      invalidate()
    }
  }, [skipNonce])

  // Salpicaduras: origen en píxeles de borde reales del trazo, dirección
  // hacia fuera del centro. Determinista (mulberry32).
  const splat = useMemo(() => {
    if (!mask) return null
    const rand = mulberry32(0xd0e1)
    const px = mask.edges
    const n = Math.min(SPLAT_COUNT, px.length / 2)
    const origins = new Float32Array(n * 3)
    const dirs = new Float32Array(n * 3)
    const delays = new Float32Array(n)
    const sizes = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      const j = (Math.floor(rand() * (px.length / 2)) | 0) * 2
      const wx = (px[j] / GRID - 0.5) * GLYPH_SPAN
      const wy = -((px[j + 1] / GRID - 0.5) * GLYPH_SPAN)
      origins[i * 3] = wx
      origins[i * 3 + 1] = wy
      origins[i * 3 + 2] = 0.1
      const len = Math.hypot(wx, wy) || 1
      const jitter = 0.55
      dirs[i * 3] = wx / len + (rand() - 0.5) * jitter
      dirs[i * 3 + 1] = wy / len + (rand() - 0.5) * jitter + 0.18
      dirs[i * 3 + 2] = (rand() - 0.5) * 0.3
      delays[i] = rand() * 0.4
      sizes[i] = 0.045 + rand() * 0.075
    }
    return { origins, dirs, delays, sizes, count: n }
  }, [mask])

  const uniforms = useMemo(
    () => ({
      uMask: { value: null },
      uP: { value: 0 },
      uInk: { value: new THREE.Color(1, 1, 1) },
    }),
    [],
  )
  const splatUniforms = useMemo(
    () => ({
      uT: { value: 0 },
      uPxScale: { value: 1 },
      uSplat: { value: new THREE.Color(1, 1, 1) },
    }),
    [],
  )

  useFrame((state, delta) => {
    const f = fx.current
    if (f.settled || !mask) return
    if (pageVisible.current) f.t += Math.min(delta, 0.064) * 1000
    if (f.skipped) f.t = Math.max(f.t, SPLAT_AT + SPLAT_MS)
    const p = Math.min(1, f.t / INK_MS)
    const st = Math.min(1, Math.max(0, (f.t - SPLAT_AT) / SPLAT_MS))
    const mat = matRef.current
    if (mat) mat.uniforms.uP.value = f.skipped ? 1 : p
    const sm = splatMatRef.current
    if (sm) {
      sm.uniforms.uT.value = f.skipped ? 1 : st
      sm.uniforms.uPxScale.value =
        (state.viewport.dpr * state.size.height) / (2 * Math.tan((CAM_FOV * Math.PI) / 360))
    }
    if (p >= 1 && st >= 1) {
      f.settled = true
      if (!f.notified) {
        f.notified = true
        onSettledRef.current?.()
      }
    }
    invalidate()
  })

  if (!mask) return null
  return (
    <>
      <mesh>
        <planeGeometry args={[GLYPH_SPAN, GLYPH_SPAN]} />
        <shaderMaterial
          ref={matRef}
          transparent
          depthWrite={false}
          fragmentShader={INK_FRAG}
          vertexShader={'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }'}
          uniforms={uniforms}
          onUpdate={(m) => {
            // Lecturas impuras (tokens del DOM, textura) en el commit de R3F,
            // fuera del render — patrón KanjiInkAssembly.
            m.uniforms.uMask.value = mask.texture
            m.uniforms.uInk.value.set(
              readToken(win ? '--color-gold' : '--color-fg-muted') || '#fff',
            )
          }}
        />
      </mesh>
      {splat && (
        <points>
          <bufferGeometry
            onUpdate={(g) => {
              g.setAttribute('position', new THREE.BufferAttribute(splat.origins, 3))
              g.setAttribute('aDir', new THREE.BufferAttribute(splat.dirs, 3))
              g.setAttribute('aDelay', new THREE.BufferAttribute(splat.delays, 1))
              g.setAttribute('aSize', new THREE.BufferAttribute(splat.sizes, 1))
            }}
          />
          <shaderMaterial
            ref={splatMatRef}
            transparent
            depthWrite={false}
            vertexShader={SPLAT_VERT}
            fragmentShader={SPLAT_FRAG}
            uniforms={splatUniforms}
            onUpdate={(m) => {
              m.uniforms.uSplat.value.set(readToken('--color-accent') || '#fff')
            }}
          />
        </points>
      )}
    </>
  )
}

export default function DuelCeremonyInk({ glyph, win, skipNonce = 0, onSettled }) {
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
      camera={{ fov: CAM_FOV, position: [0, 0, CAM_Z] }}
      style={{ width: '100%', height: '100%' }}
      aria-hidden="true"
    >
      <InkScene glyph={glyph} win={win} skipNonce={skipNonce} onSettled={onSettled} />
    </Canvas>
  )
}
