// BannerClothScene — el cartel del torneo como estandarte de tela.
//
// Plano R3F subdividido 32×32 con vertex shader de ondulación: suma de senos
// + ruido desfasado por vértice, amplitud creciente hacia el borde libre (el
// superior queda clavado a la barra) y luz especular fingida a partir de la
// normal desplazada (diferencias finitas sobre la función de onda — nada de
// SVG filters ni blur).
//
// Convenciones del proyecto:
//  - No importar directo: TournamentBannerForge lo carga con lazy() solo en
//    desktop con WebGL y sin reduced-motion — el chunk de three no viaja al
//    móvil ni al cartel estático.
//  - Mutaciones de uniforms por REF del material, nunca sobre el objeto del
//    useMemo (regla react-hooks/immutability del compilador — gotcha de la
//    galaxia #463); colores de tokens inyectados en onUpdate (commit de R3F).
//  - frameloop 'never' fuera de viewport / pestaña oculta; dpr capado a 2;
//    CanvasTexture NPOT (clamp + linear); todo el movimiento es GPU.

import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame } from '@react-three/fiber'
import { readTheme } from './banner-painter'

const VERT = /* glsl */ `
uniform float uTime;
uniform float uAmp;
uniform vec2 uSize;             // (ancho, alto) del plano en mundo

varying vec2 vUv;
varying vec3 vWaveNormal;

float waveZ(vec2 p) {
  float x = p.x;                // [-0.5, 0.5]
  float v = p.y;                // 0 = barra, 1 = borde libre
  float amp = uAmp * smoothstep(0.02, 1.0, v);
  float w1 = sin(x * 5.3 + uTime * 1.35 + v * 1.9);
  float w2 = sin(x * 9.8 - uTime * 2.10 + v * 4.7) * 0.45;
  float w3 = sin(v * 6.2 + uTime * 1.05 + x * 2.5) * 0.55;
  float n  = sin(dot(p, vec2(12.9898, 78.233)) + uTime * 0.8) * 0.14;
  return amp * (0.55 * w1 + w2 + w3 + n);
}

void main() {
  vUv = uv;
  // planeGeometry(1,1): position.y = +0.5 arriba → v = 0 arriba (la barra)
  vec2 p = vec2(position.x, 0.5 - position.y);

  float e = 0.012;
  float z = waveZ(p);
  vec3 dx = vec3(2.0 * e * uSize.x, 0.0, waveZ(p + vec2(e, 0.0)) - waveZ(p - vec2(e, 0.0)));
  vec3 dy = vec3(0.0, -2.0 * e * uSize.y, waveZ(p + vec2(0.0, e)) - waveZ(p - vec2(0.0, e)));
  vWaveNormal = normalize(cross(dy, dx));

  float sway = uAmp * 0.4 * p.y * sin(uTime * 0.7 + p.y * 1.6);
  vec3 displaced = vec3(position.x * uSize.x + sway, position.y * uSize.y, z);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
}
`

const FRAG = /* glsl */ `
varying vec2 vUv;
varying vec3 vWaveNormal;
uniform sampler2D uTex;
uniform vec3 uSpecTint;         // especular cálido (oro), leído de los tokens

void main() {
  vec3 N = normalize(vWaveNormal);
  vec3 L = normalize(vec3(-0.35, 0.45, 0.83));
  vec3 V = vec3(0.0, 0.0, 1.0);
  float diff = clamp(dot(N, L), 0.0, 1.0);
  vec3 Hv = normalize(L + V);
  float spec = pow(max(dot(N, Hv), 0.0), 42.0);
  float fold = 1.0 - (1.0 - max(N.z, 0.0)) * 0.55; // falsa oclusión en pliegues

  vec4 tex = texture2D(uTex, vUv);
  vec3 col = tex.rgb * (0.62 + 0.45 * diff) * fold + uSpecTint * spec * 0.5;
  gl_FragColor = vec4(col, 1.0);
}
`

function ClothPlane({ texture, textureVersion, wind, amplitude, active }) {
  const matRef = useRef()
  const lastVersion = useRef(-1)
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uAmp: { value: amplitude },
      uSize: { value: new THREE.Vector2(1, 1.5) }, // 2:3, como el cartel
      uTex: { value: null },
      uSpecTint: { value: new THREE.Color(1, 1, 1) },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- estructura estable; los valores vivos van por ref
    [],
  )

  useFrame((_, dt) => {
    if (!active) return
    const m = matRef.current
    if (!m) return
    m.uniforms.uTime.value += Math.min(dt, 0.05) * wind
    m.uniforms.uAmp.value = amplitude
    // re-subida de la textura cuando el padre bumpea la versión tras
    // repintar el canvas (mutación vía ref del material — regla
    // react-hooks/immutability: nunca sobre el objeto del useMemo)
    if (lastVersion.current !== textureVersion) {
      lastVersion.current = textureVersion
      const tex = m.uniforms.uTex.value
      if (tex) tex.needsUpdate = true
    }
  })

  return (
    <mesh frustumCulled={false}>
      <planeGeometry args={[1, 1, 32, 32]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={uniforms}
        side={THREE.DoubleSide}
        onUpdate={(m) => {
          // lecturas impuras (textura + token) en el commit, fuera del render
          m.uniforms.uTex.value = texture
          m.uniforms.uSpecTint.value.set(readTheme().palette.gold)
        }}
      />
    </mesh>
  )
}

export default function BannerClothScene({
  textureCanvas,
  textureVersion = 0,
  wind = 1,
  amplitude = 0.16,
  className,
}) {
  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(textureCanvas)
    t.colorSpace = THREE.SRGBColorSpace
    t.wrapS = THREE.ClampToEdgeWrapping // NPOT (1024×1536)
    t.wrapT = THREE.ClampToEdgeWrapping
    t.minFilter = THREE.LinearFilter
    return t
  }, [textureCanvas])

  useEffect(() => () => texture.dispose(), [texture])

  // pausa fuera de viewport y con la pestaña oculta
  const hostRef = useRef(null)
  const [inView, setInView] = useState(true)
  const [tabVisible, setTabVisible] = useState(() => {
    if (typeof document === 'undefined') return true
    return document.visibilityState !== 'hidden'
  })
  useEffect(() => {
    const el = hostRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return undefined
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting))
    io.observe(el)
    const onVis = () => setTabVisible(document.visibilityState !== 'hidden')
    document.addEventListener('visibilitychange', onVis)
    return () => {
      io.disconnect()
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])
  const active = inView && tabVisible

  return (
    <div ref={hostRef} className={className}>
      <Canvas
        dpr={[1, 2]}
        camera={{ fov: 30, position: [0, 0, 3.2] }}
        frameloop={active ? 'always' : 'never'}
        gl={{ antialias: true, alpha: true }}
      >
        <ClothPlane
          texture={texture}
          textureVersion={textureVersion}
          wind={wind}
          amplitude={amplitude}
          active={active}
        />
      </Canvas>
    </div>
  )
}
