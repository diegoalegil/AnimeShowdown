import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, invalidate } from '@react-three/fiber'
import { mulberry32 } from '../../animes/galaxy/galaxy-layout.js'

/**
 * KanjiInkAssembly — tinta que se ensambla en el kanji del reto del día.
 *
 * ~4000 partículas (UN solo THREE.Points, shader de punto suave) flotan en
 * caos browniano y convergen en 1.2 s para FORMAR el glifo (posiciones
 * objetivo muestreadas de un canvas 2D offscreen). Al completarse: pulso
 * dorado y jitter sutil infinito (tinta viva, no congelada). Al cambiar la
 * prop `kanji` —el hub recalcula el reto del día al completar uno— el glifo
 * se desarma (0.5 s) y se rearma sobre el nuevo.
 *
 * Reglas de marca:
 *  - Cero hex en JSX: colores leídos en runtime de var(--color-accent) /
 *    var(--color-gold); glifo muestreado con var(--font-kanji-serif).
 *  - Paleta: tinta carmesí + 5 % de chispas oro.
 *  - GPU-only: las posiciones viven en el vertex shader → solo se "anima"
 *    transform/opacity en el sentido del presupuesto de 60 fps.
 *  - prefers-reduced-motion: estado final estático (sin caos ni jitter) y
 *    frameloop bajo demanda.
 *
 * No importar directo: KanjiInkSplash lo carga con lazy() tras decidir que
 * hay WebGL (mismo patrón que UniverseGalaxy — el chunk de three solo viaja
 * cuando va a usarse) y mantiene el KanjiBackdrop estático como fallback.
 */

const COUNT = 4000 // partículas totales
const GOLD_RATIO = 0.05 // 5 % de chispas oro
const ASSEMBLE_S = 1.2 // convergencia caos → kanji
const SCATTER_S = 0.5 // desarme al cambiar de reto
const GLYPH_SPAN = 8.4 // alto del kanji en unidades de mundo
const GRID = 224 // resolución del canvas de muestreo
const CAM_Z = 14
const CAM_FOV = 40

/* ------------------------------------------------------------------ shaders */

const VERT = /* glsl */ `
  uniform float uTime;
  uniform float uProgress;   // 0 = caos browniano, 1 = kanji ensamblado
  uniform float uPulse;      // envolvente del pulso dorado (decae exp.)
  uniform float uPxScale;    // dpr * altoPx / (2*tan(fov/2)) — tamaño de punto correcto
  attribute vec3 aSeed;
  attribute float aDelay;    // stagger 0..0.55 → la tinta "llega" por oleadas
  attribute float aSize;
  attribute float aGold;
  varying float vGold;
  varying float vP;
  varying float vTw;

  // deriva pseudo-browniana barata (suma de senos desincronizados por semilla)
  vec3 drift(vec3 s, float t) {
    return vec3(
      sin(t * 0.90 + s.x * 7.0)  + sin(t * 0.43 + s.z * 11.0),
      cos(t * 0.70 + s.y * 7.0)  + sin(t * 0.31 + s.x * 9.0),
      sin(t * 0.50 + s.z * 7.0)  + cos(t * 0.27 + s.y * 8.0)
    );
  }

  void main() {
    float p = clamp((uProgress - aDelay) / max(1.0 - aDelay, 0.001), 0.0, 1.0);
    p = p * p * (3.0 - 2.0 * p); // smoothstep por partícula
    vP = p;
    vGold = aGold;
    vTw = 0.75 + 0.25 * sin(uTime * 2.5 + aSeed.x * 40.0); // titilar sutil del oro

    // nube de caos alrededor del encuadre + deriva viva
    vec3 chaos = (aSeed * 2.0 - 1.0) * vec3(8.5, 5.5, 3.0) + drift(aSeed, uTime) * 0.8;
    // jitter de "tinta viva" una vez asentada
    vec3 jit = drift(aSeed + 3.7, uTime * 1.7) * 0.03;
    // 'position' ES el objetivo (se reescribe al cambiar de kanji)
    vec3 pos = mix(chaos, position + jit, p);

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = aSize * (1.0 + uPulse * 0.9 * aGold) * uPxScale / max(-mv.z, 0.1);
    gl_Position = projectionMatrix * mv;
  }
`

const FRAG = /* glsl */ `
  uniform vec3 uInk;     // --color-accent (carmesí)
  uniform vec3 uGold;    // --color-gold
  uniform float uPulse;
  varying float vGold;
  varying float vP;
  varying float vTw;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    float a = smoothstep(0.5, 0.06, d); // punto suave de tinta
    a *= a;                             // núcleo denso, borde difuso
    vec3 col = mix(uInk, uGold, max(vGold, uPulse * 0.4));
    col *= 1.0 + uPulse * 0.7;          // el pulso calienta toda la masa
    float alpha = a * mix(0.3, 0.85, vP) * mix(1.0, vTw, vGold);
    if (alpha < 0.012) discard;
    gl_FragColor = vec4(col, alpha);
  }
`

/* ------------------------------------------------------- muestreo del glifo */

function readToken(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

const glyphCache = new Map()

/** Muestrea COUNT posiciones (Float32Array xyz) dentro del trazo del kanji. */
async function sampleGlyph(kanji) {
  if (glyphCache.has(kanji)) return glyphCache.get(kanji)
  const family = readToken('--font-kanji-serif') || readToken('--font-jp') || 'serif'
  try {
    await document.fonts.load(`800 ${Math.round(GRID * 0.82)}px ${family}`, kanji)
  } catch {
    // seguimos con lo que haya cargado el stack de fuentes
  }

  const c = document.createElement('canvas')
  c.width = c.height = GRID
  const ctx = c.getContext('2d', { willReadFrequently: true })
  // canvas offscreen de muestreo: nunca llega al DOM; 'white' = máscara de alfa
  ctx.fillStyle = 'white'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `800 ${Math.round(GRID * 0.82)}px ${family}`
  ctx.fillText(kanji, GRID / 2, GRID / 2 + GRID * 0.03)

  const data = ctx.getImageData(0, 0, GRID, GRID).data
  const px = []
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (data[(y * GRID + x) * 4 + 3] > 100) px.push(x, y)
    }
  }
  const out = new Float32Array(COUNT * 3)
  if (px.length) {
    for (let i = 0; i < COUNT; i++) {
      const j = ((Math.random() * px.length * 0.5) | 0) * 2
      out[i * 3] = ((px[j] + Math.random()) / GRID - 0.5) * GLYPH_SPAN
      out[i * 3 + 1] = -(((px[j + 1] + Math.random()) / GRID - 0.5) * GLYPH_SPAN)
      out[i * 3 + 2] = (Math.random() - 0.5) * 0.7 // ligera profundidad de tinta
    }
  }
  glyphCache.set(kanji, out)
  return out
}

function applyTargets(geo, pts) {
  if (!geo) return
  geo.attributes.position.array.set(pts)
  geo.attributes.position.needsUpdate = true
}

/* ------------------------------------------------------------------- puntos */

function InkPoints({ kanji, reducedMotion, onAssembled }) {
  const geoRef = useRef()
  const ptsRef = useRef()
  // máquina de estados fuera de React: cero re-renders por frame
  const fx = useRef({
    phase: 'waiting',
    t0: -1,
    progress: 0,
    pulseAt: -1e9,
    shown: null,
    pending: null,
    pendingPts: null,
  })

  // PRNG determinista (el mismo mulberry32 de la galaxia): puro para la regla
  // react-hooks/purity y estable entre montajes — la nube de caos no cambia
  // de forma si React re-monta el canvas.
  const attrs = useMemo(() => {
    const rand = mulberry32(0x1a2b3c)
    const targets = new Float32Array(COUNT * 3)
    const seeds = new Float32Array(COUNT * 3)
    const delays = new Float32Array(COUNT)
    const sizes = new Float32Array(COUNT)
    const golds = new Float32Array(COUNT)
    for (let i = 0; i < COUNT; i++) {
      seeds[i * 3] = rand()
      seeds[i * 3 + 1] = rand()
      seeds[i * 3 + 2] = rand()
      delays[i] = rand() * 0.55
      const g = rand() < GOLD_RATIO ? 1 : 0
      golds[i] = g
      sizes[i] = (0.05 + rand() * 0.07) * (g ? 1.5 : 1)
    }
    return { targets, seeds, delays, sizes, golds }
  }, [])

  // Estructura pura en render; los colores reales (lectura de tokens del DOM,
  // impura) se inyectan en onUpdate del material — callback del commit de R3F,
  // fuera del render y de los efectos, así que la regla de inmutabilidad no
  // congela el objeto para useFrame.
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uPulse: { value: 0 },
      uPxScale: { value: 1 },
      uInk: { value: new THREE.Color(1, 1, 1) },
      uGold: { value: new THREE.Color(1, 1, 1) },
    }),
    [],
  )

  // primer montaje + cambios de kanji → muestrear y (des/re)ensamblar
  useEffect(() => {
    let alive = true
    sampleGlyph(kanji).then((pts) => {
      if (!alive) return
      const f = fx.current
      if (f.shown === null) {
        applyTargets(geoRef.current, pts)
        f.shown = kanji
        if (reducedMotion) {
          f.progress = 1
          f.phase = 'idle'
          invalidate()
        } else {
          f.phase = 'assembling'
          f.t0 = -1
        }
      } else if (kanji !== f.shown) {
        if (reducedMotion) {
          applyTargets(geoRef.current, pts)
          f.shown = kanji
          f.progress = 1
          f.phase = 'idle'
          invalidate()
        } else {
          f.pending = kanji
          f.pendingPts = pts
          f.phase = 'scattering'
          f.t0 = -1
        }
      }
    })
    return () => {
      alive = false
    }
  }, [kanji, reducedMotion])

  useFrame((st) => {
    const f = fx.current
    // mutaciones SOLO a través del ref del objeto 3D (patrón UniverseGalaxy)
    const u = ptsRef.current?.material?.uniforms
    if (!u) return
    const t = st.clock.elapsedTime
    if (f.t0 < 0) f.t0 = t

    u.uTime.value = reducedMotion ? 0 : t
    u.uPxScale.value =
      (st.gl.getPixelRatio() * st.size.height) / (2 * Math.tan((CAM_FOV * Math.PI) / 360))
    // que el kanji nunca desborde a 390px: escala al ancho visible
    if (ptsRef.current) {
      ptsRef.current.scale.setScalar(Math.min(1, (st.viewport.width * 0.86) / GLYPH_SPAN))
    }

    if (f.phase === 'assembling') {
      f.progress = Math.min(1, (t - f.t0) / ASSEMBLE_S)
      if (f.progress >= 1) {
        f.phase = 'idle'
        f.pulseAt = t // ← pulso dorado al completarse
        if (onAssembled) onAssembled(f.shown)
      }
    } else if (f.phase === 'scattering') {
      f.progress = Math.max(0, 1 - (t - f.t0) / SCATTER_S)
      if (f.progress <= 0 && f.pendingPts) {
        applyTargets(geoRef.current, f.pendingPts)
        f.shown = f.pending
        f.pending = null
        f.pendingPts = null
        f.phase = 'assembling'
        f.t0 = t
      }
    }

    u.uProgress.value = f.progress
    u.uPulse.value = f.pulseAt > -1e8 ? Math.exp(-Math.max(0, t - f.pulseAt) * 2.6) : 0
  })

  return (
    <points ref={ptsRef} frustumCulled={false}>
      <bufferGeometry ref={geoRef}>
        <bufferAttribute
          attach="attributes-position"
          args={[attrs.targets, 3]}
          usage={THREE.DynamicDrawUsage}
        />
        <bufferAttribute attach="attributes-aSeed" args={[attrs.seeds, 3]} />
        <bufferAttribute attach="attributes-aDelay" args={[attrs.delays, 1]} />
        <bufferAttribute attach="attributes-aSize" args={[attrs.sizes, 1]} />
        <bufferAttribute attach="attributes-aGold" args={[attrs.golds, 1]} />
      </bufferGeometry>
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={VERT}
        fragmentShader={FRAG}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        onUpdate={(m) => {
          m.uniforms.uInk.value.setStyle(readToken('--color-accent'))
          m.uniforms.uGold.value.setStyle(readToken('--color-gold'))
        }}
      />
    </points>
  )
}

/* ------------------------------------------------------------------ wrapper */

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () =>
      typeof matchMedia !== 'undefined' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    if (typeof matchMedia !== 'function') return undefined
    const mq = matchMedia('(prefers-reduced-motion: reduce)')
    const cb = (e) => setReduced(e.matches)
    mq.addEventListener('change', cb)
    return () => mq.removeEventListener('change', cb)
  }, [])
  return reduced
}

/**
 * @param {string}   kanji         glifo del reto del día (影/謎/心…)
 * @param {string}   className     clases del contenedor del canvas
 * @param {function} onAssembled   (kanji) => void — al completarse el ensamblado
 * @param {function} onUnsupported () => void — contexto WebGL perdido → fallback estático
 */
export default function KanjiInkAssembly({ kanji = '戦', className = '', onAssembled, onUnsupported }) {
  const reduced = usePrefersReducedMotion()
  const [supported, setSupported] = useState(true)

  useEffect(() => {
    if (!supported && onUnsupported) onUnsupported()
  }, [supported, onUnsupported])

  if (!supported) return null

  return (
    <Canvas
      className={className}
      dpr={[1, 1.75]}
      frameloop={reduced ? 'demand' : 'always'}
      camera={{ fov: CAM_FOV, position: [0, 0, CAM_Z], near: 0.1, far: 100 }}
      gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener(
          'webglcontextlost',
          (e) => {
            e.preventDefault()
            setSupported(false)
          },
          { once: true },
        )
      }}
    >
      <InkPoints kanji={kanji} reducedMotion={reduced} onAssembled={onAssembled} />
    </Canvas>
  )
}
