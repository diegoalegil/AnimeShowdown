/**
 * UniverseGalaxy.jsx — AnimeShowdown
 * Galaxia 3D navegable de ~100 universos · React 19 + @react-three/fiber 9.
 * Sin drei: los OrbitControls salen de three/examples y la ficha de hover es un
 * overlay DOM proyectado a mano cada frame (cero dependencia nueva).
 *
 * Presupuesto de draw calls (objetivo < 30, real ≈ 7):
 *   1  InstancedMesh de symbols (atlas de texturas, billboard en shader)
 *   1  InstancedMesh de halos oro (solo los top, blending aditivo)
 *   1  Points de polvo estelar (~2000)
 *   3  sprites de nebulosa fingida (aditivo carmesí/cian MUY tenue)
 *   1  sprite de núcleo galáctico
 *
 * Tokens: TODOS los colores de la escena se leen de var(--color-*) en runtime.
 * Los literales rgba() que quedan son del pintado en canvas 2D del atlas/glow
 * (sistema visual procedural; el archivo está en el allowlist del guard).
 * prefers-reduced-motion: sin auto-rotación, sin bobbing, springs instantáneos.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls as ThreeOrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { buildGalaxyLayout, glyphFor, mulberry32 } from './galaxy/galaxy-layout.js'

const isBrowser = typeof window !== 'undefined'
const ATLAS_TILE = 256

/* ───────────────────────── utilidades ───────────────────────── */

function cssToken(name, fallback) {
  if (!isBrowser) return fallback
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

/** Parsea CUALQUIER color CSS (incl. oklch) vía canvas 2D → THREE.Color sRGB. */
function linearColor(cssValue) {
  const c = document.createElement('canvas')
  c.width = c.height = 1
  const ctx = c.getContext('2d', { willReadFrequently: true })
  ctx.fillStyle = cssValue
  ctx.fillRect(0, 0, 1, 1)
  const d = ctx.getImageData(0, 0, 1, 1).data
  return new THREE.Color().setRGB(d[0] / 255, d[1] / 255, d[2] / 255, THREE.SRGBColorSpace)
}

function useBrandTokens() {
  return useMemo(() => {
    if (!isBrowser) return null
    const bgCss = cssToken('--color-bg', 'rgb(4, 7, 12)')
    const surfaceCss = cssToken('--color-surface', 'rgb(8, 11, 18)')
    const accentCss = cssToken('--color-accent', 'rgb(159, 29, 44)')
    const goldCss = cssToken('--color-gold', 'rgb(197, 161, 90)')
    const electricCss = cssToken('--color-electric', 'rgb(102, 196, 235)')
    return {
      bgCss, surfaceCss, accentCss, goldCss, electricCss,
      fontJp: cssToken('--font-jp', 'serif'),
      bg: linearColor(bgCss),
      accent: linearColor(accentCss),
      gold: linearColor(goldCss),
      electric: linearColor(electricCss),
    }
  }, [])
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => isBrowser && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const fn = (e) => setReduced(e.matches)
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [])
  return reduced
}

/* ───────────────────── atlas de symbols (1 textura) ───────────────────── */

function roundedPath(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function tileRect(i, cols) {
  return { x: (i % cols) * ATLAS_TILE, y: Math.floor(i / cols) * ATLAS_TILE, s: ATLAS_TILE }
}

function drawPlaceholderTile(ctx, u, i, cols, tokens) {
  const { x, y, s } = tileRect(i, cols)
  const pad = s * 0.05
  const r = s * 0.18
  ctx.save()
  ctx.clearRect(x, y, s, s)
  roundedPath(ctx, x + pad, y + pad, s - pad * 2, s - pad * 2, r)
  ctx.fillStyle = tokens.surfaceCss
  ctx.fill()
  ctx.lineWidth = s * 0.014
  ctx.strokeStyle = u.top ? tokens.goldCss : 'rgba(255, 255, 255, 0.18)'
  ctx.stroke()
  ctx.clip()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = u.top ? tokens.goldCss : 'rgba(255, 255, 255, 0.88)'
  ctx.font = `600 ${s * 0.46}px ${tokens.fontJp}`
  ctx.fillText(glyphFor(u), x + s / 2, y + s * 0.52)
  ctx.restore()
}

function drawImageTile(ctx, img, u, i, cols, tokens) {
  const { x, y, s } = tileRect(i, cols)
  const pad = s * 0.05
  const r = s * 0.18
  ctx.save()
  ctx.clearRect(x, y, s, s)
  roundedPath(ctx, x + pad, y + pad, s - pad * 2, s - pad * 2, r)
  ctx.clip()
  ctx.drawImage(img, x + pad, y + pad, s - pad * 2, s - pad * 2)
  ctx.restore()
  ctx.save()
  roundedPath(ctx, x + pad, y + pad, s - pad * 2, s - pad * 2, r)
  ctx.lineWidth = s * 0.014
  ctx.strokeStyle = u.top ? tokens.goldCss : 'rgba(255, 255, 255, 0.14)'
  ctx.stroke()
  ctx.restore()
}

function useSymbolAtlas(universes, getSymbolUrl, tokens) {
  const cols = Math.ceil(Math.sqrt(universes.length))
  const atlas = useMemo(() => {
    if (!isBrowser || !tokens) return null
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = cols * ATLAS_TILE
    const ctx = canvas.getContext('2d')
    universes.forEach((u, i) => drawPlaceholderTile(ctx, u, i, cols, tokens))
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 4
    return { ctx, texture }
  }, [universes, cols, tokens])

  // carga progresiva del arte real (el placeholder queda si el webp falla)
  useEffect(() => {
    if (!atlas || !getSymbolUrl) return undefined
    let alive = true
    let dirty = false
    const flush = setInterval(() => {
      if (dirty) { atlas.texture.needsUpdate = true; dirty = false }
    }, 180)
    universes.forEach((u, i) => {
      const url = getSymbolUrl(u)
      if (!url) return
      const img = new Image()
      img.crossOrigin = 'anonymous' // el CDN de marca sirve CORS
      img.onload = () => {
        if (!alive) return
        drawImageTile(atlas.ctx, img, u, i, cols, tokens)
        dirty = true
      }
      img.src = url
    })
    return () => { alive = false; clearInterval(flush) }
  }, [atlas, universes, getSymbolUrl, cols, tokens])

  useEffect(() => () => atlas && atlas.texture.dispose(), [atlas])
  return { texture: atlas ? atlas.texture : null, cols }
}

/* ───────────────────── shaders (billboard instanciado) ───────────────────── */

const SYMBOL_VERT = /* glsl */ `
  attribute vec2 aUvOffset;
  attribute float aSeed;
  uniform float uTime;
  uniform float uCols;
  varying vec2 vUv;
  varying float vFog;
  void main() {
    vUv = aUvOffset + uv / uCols;
    vec4 wp = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    wp.y += sin(uTime * 0.55 + aSeed * 6.2831) * 0.22;
    float s = length(vec3(instanceMatrix[0].x, instanceMatrix[0].y, instanceMatrix[0].z));
    vec4 mv = viewMatrix * wp;
    mv.xy += position.xy * s;
    vFog = smoothstep(44.0, 100.0, -mv.z) * 0.88;
    gl_Position = projectionMatrix * mv;
  }
`

const SYMBOL_FRAG = /* glsl */ `
  uniform sampler2D uAtlas;
  uniform vec3 uFog;
  varying vec2 vUv;
  varying float vFog;
  void main() {
    vec4 tex = texture2D(uAtlas, vUv);
    if (tex.a < 0.4) discard;
    gl_FragColor = vec4(mix(tex.rgb, uFog, vFog), 1.0);
    #include <colorspace_fragment>
  }
`

const HALO_VERT = /* glsl */ `
  attribute float aSeed;
  uniform float uTime;
  varying vec2 vUv;
  varying float vSeed;
  void main() {
    vUv = uv;
    vSeed = aSeed;
    vec4 wp = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    wp.y += sin(uTime * 0.55 + aSeed * 6.2831) * 0.22;
    float s = length(vec3(instanceMatrix[0].x, instanceMatrix[0].y, instanceMatrix[0].z));
    vec4 mv = viewMatrix * wp;
    mv.xy += position.xy * s;
    mv.z -= 0.5;
    gl_Position = projectionMatrix * mv;
  }
`

const HALO_FRAG = /* glsl */ `
  uniform vec3 uGold;
  uniform float uTime;
  varying vec2 vUv;
  varying float vSeed;
  void main() {
    float d = distance(vUv, vec2(0.5));
    float ring = exp(-pow((d - 0.30) * 9.0, 2.0));
    float glow = smoothstep(0.5, 0.06, d) * 0.22;
    float pulse = 0.82 + 0.18 * sin(uTime * 1.1 + vSeed * 6.2831);
    float a = (ring * 0.55 + glow) * pulse;
    if (a < 0.01) discard;
    gl_FragColor = vec4(uGold * a, a);
    #include <colorspace_fragment>
  }
`

/* ───────────────────── campo de symbols instanciado ───────────────────── */

function SymbolField({ layout, texture, cols, tokens, reduced, hoverIndex, onHoverIndex, onPick }) {
  const N = layout.length
  const meshRef = useRef(null)
  const hitRef = useRef(null)
  const haloRef = useRef(null)
  const hoverAtRef = useRef(0)
  const popsRef = useRef(new Float32Array(0))
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const tmpV = useMemo(() => new THREE.Vector3(), [])
  const tmpDir = useMemo(() => new THREE.Vector3(), [])
  const tops = useMemo(() => layout.filter((l) => l.top), [layout])
  const haloIndexOf = useMemo(() => {
    const m = new Map()
    tops.forEach((l, j) => m.set(l.index, j))
    return m
  }, [tops])

  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(1, 1)
    const uvOff = new Float32Array(N * 2)
    const seeds = new Float32Array(N)
    layout.forEach((l, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      uvOff[i * 2] = col / cols
      uvOff[i * 2 + 1] = 1 - (row + 1) / cols // CanvasTexture flipY
      seeds[i] = l.seed
    })
    g.setAttribute('aUvOffset', new THREE.InstancedBufferAttribute(uvOff, 2))
    g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1))
    return g
  }, [layout, cols, N])

  const haloGeometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(1, 1)
    g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(new Float32Array(tops.map((l) => l.seed)), 1))
    return g
  }, [tops])

  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uAtlas: { value: texture },
      uCols: { value: cols },
      uTime: { value: 0 },
      uFog: { value: tokens.bg },
    },
    vertexShader: SYMBOL_VERT,
    fragmentShader: SYMBOL_FRAG,
  }), [texture, cols, tokens])

  const haloMaterial = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { uGold: { value: tokens.gold }, uTime: { value: 0 } },
    vertexShader: HALO_VERT,
    fragmentShader: HALO_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), [tokens])

  const hitMaterial = useMemo(() => new THREE.MeshBasicMaterial({ visible: false }), [])
  const hitGeometry = useMemo(() => new THREE.SphereGeometry(0.62, 6, 5), [])

  useEffect(() => {
    if (popsRef.current.length !== N) popsRef.current = new Float32Array(N)
    layout.forEach((l, i) => {
      dummy.position.set(l.x, l.y, l.z)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.setScalar(l.scale)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
      hitRef.current.setMatrixAt(i, dummy.matrix)
    })
    tops.forEach((l, j) => {
      dummy.position.set(l.x, l.y, l.z)
      dummy.scale.setScalar(l.scale * 2.3)
      dummy.updateMatrix()
      haloRef.current.setMatrixAt(j, dummy.matrix)
    })
    meshRef.current.instanceMatrix.needsUpdate = true
    hitRef.current.instanceMatrix.needsUpdate = true
    haloRef.current.instanceMatrix.needsUpdate = true
  }, [layout, tops, dummy, N])

  useFrame((state, dt) => {
    if (!meshRef.current || !haloRef.current || !hitRef.current) return
    const pops = popsRef.current
    if (pops.length !== N) return
    const t = reduced ? 0 : state.clock.elapsedTime
    meshRef.current.material.uniforms.uTime.value = t
    haloRef.current.material.uniforms.uTime.value = t
    let dirty = false
    for (let i = 0; i < N; i++) {
      const target = i === hoverIndex ? 1 : 0
      let p = pops[i]
      if (p === 0 && target === 0) continue
      p = reduced ? target : THREE.MathUtils.damp(p, target, 9, Math.min(dt, 0.05))
      if (Math.abs(p - target) < 0.002) p = target
      pops[i] = p
      dirty = true
      const l = layout[i]
      tmpV.set(l.x, l.y, l.z)
      if (p > 0) {
        tmpDir.copy(state.camera.position).sub(tmpV).normalize()
        tmpV.addScaledVector(tmpDir, p * 2.6)
      }
      dummy.position.copy(tmpV)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.setScalar(l.scale * (1 + 0.42 * p))
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
      hitRef.current.setMatrixAt(i, dummy.matrix)
      if (l.top) {
        dummy.scale.setScalar(l.scale * 2.3 * (1 + 0.42 * p))
        dummy.updateMatrix()
        haloRef.current.setMatrixAt(haloIndexOf.get(i), dummy.matrix)
        haloRef.current.instanceMatrix.needsUpdate = true
      }
    }
    if (dirty) {
      meshRef.current.instanceMatrix.needsUpdate = true
      hitRef.current.instanceMatrix.needsUpdate = true
    }
  })

  const handleMove = (e) => {
    e.stopPropagation()
    if (e.instanceId == null) return
    if (e.instanceId !== hoverIndex) {
      onHoverIndex(e.instanceId)
      hoverAtRef.current = performance.now()
    }
  }
  const handleOut = (e) => {
    if (e.nativeEvent && e.nativeEvent.pointerType === 'touch') return
    onHoverIndex(null)
  }
  const handleClick = (e) => {
    if (e.delta > 8) return // era un drag de órbita, no un click
    e.stopPropagation()
    if (e.instanceId == null) return
    const touch = e.nativeEvent && e.nativeEvent.pointerType === 'touch'
    // táctil: 1er tap = acercar + ficha; 2º tap = navegar
    if (touch && performance.now() - hoverAtRef.current < 500) return
    onPick(layout[e.instanceId].universe)
  }

  return (
    <group>
      <instancedMesh ref={meshRef} args={[geometry, material, N]} frustumCulled={false} renderOrder={2} />
      <instancedMesh ref={haloRef} args={[haloGeometry, haloMaterial, tops.length]} frustumCulled={false} renderOrder={3} />
      <instancedMesh
        ref={hitRef}
        args={[hitGeometry, hitMaterial, N]}
        frustumCulled={false}
        onPointerOver={handleMove}
        onPointerMove={handleMove}
        onPointerOut={handleOut}
        onClick={handleClick}
      />
    </group>
  )
}

/* ───────────────────── polvo estelar (1 draw call) ───────────────────── */

function StarDust({ count = 2000, tokens, reduced }) {
  const groupRef = useRef(null)
  const { positions, colors } = useMemo(() => {
    const rand = mulberry32(42)
    const pos = new Float32Array(count * 3)
    const col = new Float32Array(count * 3)
    const white = new THREE.Color().setRGB(1, 1, 1, THREE.SRGBColorSpace)
    const c = new THREE.Color()
    for (let i = 0; i < count; i++) {
      const r = 2 + Math.pow(rand(), 0.62) * 44
      const a = rand() * Math.PI * 2
      const thick = 0.7 + (1 - r / 46) * 2.4
      pos[i * 3] = Math.cos(a) * r
      pos[i * 3 + 1] = (rand() + rand() + rand() - 1.5) * thick
      pos[i * 3 + 2] = Math.sin(a) * r
      const roll = rand()
      const tint = roll < 0.72 ? white : roll < 0.88 ? tokens.electric : tokens.gold
      c.copy(white).lerp(tint, 0.6).multiplyScalar(0.35 + rand() * 0.65)
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b
    }
    return { positions: pos, colors: col }
  }, [count, tokens])

  useFrame((state) => {
    if (reduced || !groupRef.current) return
    groupRef.current.rotation.y = state.clock.elapsedTime * 0.006
  })

  return (
    <group ref={groupRef}>
      <points frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.07} sizeAttenuation vertexColors transparent opacity={0.9} depthWrite={false} />
      </points>
    </group>
  )
}

/* ───────────────── nebulosa volumétrica fingida (sprites aditivos) ───────────────── */

function makeGlowTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128)
  g.addColorStop(0, 'rgba(255, 255, 255, 1)')
  g.addColorStop(0.35, 'rgba(255, 255, 255, 0.42)')
  g.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 256, 256)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function Nebula({ tokens, reduced }) {
  const texture = useMemo(() => makeGlowTexture(), [])
  const matRefs = [useRef(null), useRef(null), useRef(null)]
  useEffect(() => () => texture.dispose(), [texture])
  useFrame((state) => {
    if (reduced) return
    const t = state.clock.elapsedTime
    matRefs.forEach((r, i) => {
      if (r.current) r.current.rotation = t * 0.012 * (i % 2 === 0 ? 1 : -1)
    })
  })
  const sprites = [
    { scale: [54, 34, 1], position: [0, -1.5, 0], color: tokens.accent, opacity: 0.1 },
    { scale: [36, 24, 1], position: [11, 2.5, -9], color: tokens.electric, opacity: 0.055 },
    { scale: [28, 18, 1], position: [-13, 1, 10], color: tokens.accent, opacity: 0.075 },
  ]
  return (
    <group>
      {sprites.map((s, i) => (
        <sprite key={i} scale={s.scale} position={s.position} renderOrder={4}>
          <spriteMaterial
            ref={matRefs[i]}
            map={texture}
            color={s.color}
            opacity={s.opacity}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
      ))}
      {/* núcleo galáctico: brasa oro tenue */}
      <sprite scale={[7, 7, 1]} position={[0, 0, 0]} renderOrder={4}>
        <spriteMaterial
          map={texture}
          color={tokens.gold}
          opacity={0.16}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
    </group>
  )
}

/* ─────────────── OrbitControls de three/examples envuelto en R3F ─────────────── */

function Controls({ autoRotate, onStart, onEnd }) {
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const ref = useRef(null)

  useEffect(() => {
    const controls = new ThreeOrbitControls(camera, gl.domElement)
    controls.target.set(0, 0.5, 0)
    controls.enableDamping = true
    controls.dampingFactor = 0.07
    controls.enablePan = false
    controls.minDistance = 10
    controls.maxDistance = 48
    controls.minPolarAngle = 0.4
    controls.maxPolarAngle = 2.2
    controls.autoRotateSpeed = 0.4
    controls.addEventListener('start', onStart)
    controls.addEventListener('end', onEnd)
    ref.current = controls
    return () => {
      controls.removeEventListener('start', onStart)
      controls.removeEventListener('end', onEnd)
      controls.dispose()
      ref.current = null
    }
  }, [camera, gl, onStart, onEnd])

  useEffect(() => {
    if (ref.current) ref.current.autoRotate = autoRotate
  }, [autoRotate])

  useFrame(() => ref.current && ref.current.update())
  return null
}

/* ─────────────── ficha de hover: overlay DOM proyectado cada frame ─────────────── */

function LabelProjector({ hoverIndex, layout, labelRef }) {
  const v = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ camera, size }) => {
    const node = labelRef.current
    if (hoverIndex == null || !node) return
    const it = layout[hoverIndex]
    v.set(it.x, it.y + it.scale * 0.95 + 0.7, it.z)
    v.project(camera)
    const x = (v.x * 0.5 + 0.5) * size.width
    const y = (-v.y * 0.5 + 0.5) * size.height
    node.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -100%)`
    node.style.opacity = v.z < 1 ? '1' : '0'
  })
  return null
}

function HoverCard({ universe }) {
  return (
    <div className="w-max max-w-60 rounded-lg border border-gold/30 bg-surface/90 px-3 py-2 backdrop-blur-sm">
      <p className="text-sm font-semibold leading-tight text-white">{universe.name}</p>
      {universe.characters?.length ? (
        <p className="mt-1 font-mono text-[11px] leading-snug text-gold">
          {universe.characters.join(' · ')}
        </p>
      ) : null}
      <p className="mt-1.5 font-mono text-[10px] text-white/40">/animes/{universe.slug} →</p>
    </div>
  )
}

/* ───────────────────────── escena ───────────────────────── */

function GalaxyScene({ layout, texture, cols, tokens, reduced, hover, onHover, onPick }) {
  const [idle, setIdle] = useState(true)
  const idleTimer = useRef(null)

  useEffect(() => {
    document.body.style.cursor = hover != null ? 'pointer' : ''
    return () => { document.body.style.cursor = '' }
  }, [hover])

  useEffect(() => () => clearTimeout(idleTimer.current), [])

  const onStart = useCallback(() => {
    setIdle(false)
    clearTimeout(idleTimer.current)
  }, [])
  const onEnd = useCallback(() => {
    clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(() => setIdle(true), 4000)
  }, [])

  return (
    <>
      <StarDust tokens={tokens} reduced={reduced} />
      <Nebula tokens={tokens} reduced={reduced} />
      <SymbolField
        layout={layout}
        texture={texture}
        cols={cols}
        tokens={tokens}
        reduced={reduced}
        hoverIndex={hover}
        onHoverIndex={onHover}
        onPick={onPick}
      />
      <Controls
        autoRotate={idle && !reduced && hover == null}
        onStart={onStart}
        onEnd={onEnd}
      />
    </>
  )
}

/* ───────────────────────── componente raíz ───────────────────────── */

export default function UniverseGalaxy({
  universes,
  getSymbolUrl,
  onSelect,
  glOptions,
  className = '',
}) {
  const tokens = useBrandTokens()
  const reduced = usePrefersReducedMotion()
  const layout = useMemo(() => buildGalaxyLayout(universes), [universes])
  const { texture, cols } = useSymbolAtlas(universes, getSymbolUrl, tokens)
  const [hover, setHover] = useState(null)
  const labelRef = useRef(null)

  const handlePick = (u) => {
    if (onSelect) onSelect(u)
    else if (isBrowser) window.location.assign(`/animes/${u.slug}`)
  }

  if (!tokens || !texture) {
    return <div className={`h-full w-full bg-bg ${className}`} aria-hidden="true" />
  }

  return (
    <div className={`relative h-full w-full overflow-hidden bg-bg ${className}`}>
      <Canvas
        dpr={[1, 2]}
        flat
        camera={{ position: [0, 17, 33], fov: 48, near: 0.1, far: 220 }}
        gl={{ antialias: true, powerPreference: 'high-performance', ...glOptions }}
        onCreated={({ gl }) => gl.setClearColor(tokens.bg, 1)}
      >
        <GalaxyScene
          layout={layout}
          texture={texture}
          cols={cols}
          tokens={tokens}
          reduced={reduced}
          hover={hover}
          onHover={setHover}
          onPick={handlePick}
        />
        <LabelProjector hoverIndex={hover} layout={layout} labelRef={labelRef} />
      </Canvas>
      {/* ficha de hover proyectada sobre el canvas (fuera del árbol WebGL) */}
      <div
        ref={labelRef}
        className="pointer-events-none absolute left-0 top-0 z-10"
        style={{ opacity: 0, willChange: 'transform' }}
      >
        {hover != null ? <HoverCard universe={layout[hover].universe} /> : null}
      </div>
    </div>
  )
}
