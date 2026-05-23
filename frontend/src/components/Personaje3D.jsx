import { Suspense, useMemo, useRef } from 'react'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import { TextureLoader } from 'three'
import { imagenPersonaje } from '../lib/personajes-core'

const SPARKLE_COUNT = 70

function CardMesh({ slug }) {
  const texture = useLoader(TextureLoader, imagenPersonaje(slug))
  const meshRef = useRef()
  const { mouse } = useThree()

  useFrame((state) => {
    if (!meshRef.current) return
    const targetY = mouse.x * 0.45
    const targetX = -mouse.y * 0.28
    meshRef.current.rotation.y +=
      (targetY - meshRef.current.rotation.y) * 0.06
    meshRef.current.rotation.x +=
      (targetX - meshRef.current.rotation.x) * 0.06
    meshRef.current.position.y =
      Math.sin(state.clock.elapsedTime * 0.9) * 0.08
  })

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[2.4, 3.6]} />
      <meshBasicMaterial map={texture} transparent />
    </mesh>
  )
}

function SparkleField({ color }) {
  const pointsRef = useRef()
  const positions = useMemo(() => {
    const values = new Float32Array(SPARKLE_COUNT * 3)
    const goldenAngle = Math.PI * (3 - Math.sqrt(5))

    for (let i = 0; i < SPARKLE_COUNT; i++) {
      const radius = 1.2 + (((i * 37) % 100) / 100) * 1.8
      const angle = i * goldenAngle
      const z = -0.35 + (((i * 19) % 100) / 100) * 0.7

      values[i * 3] = Math.cos(angle) * radius
      values[i * 3 + 1] = Math.sin(angle) * radius * 1.35
      values[i * 3 + 2] = z
    }

    return values
  }, [])

  useFrame((state) => {
    if (!pointsRef.current) return
    pointsRef.current.rotation.z = state.clock.elapsedTime * 0.04
    pointsRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.08
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color={color}
        depthWrite={false}
        opacity={0.72}
        size={0.055}
        sizeAttenuation
        transparent
      />
    </points>
  )
}

function getAccent() {
  if (typeof window === 'undefined') return '#9f1d2c'
  return (
    getComputedStyle(document.documentElement)
      .getPropertyValue('--color-accent')
      .trim() || '#9f1d2c'
  )
}

function Personaje3D({ slug }) {
  const accent = getAccent()
  return (
    <Canvas
      camera={{ position: [0, 0, 5], fov: 50 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      className="rounded-2xl"
    >
      <Suspense fallback={null}>
        <CardMesh slug={slug} />
      </Suspense>
      <SparkleField color={accent} />
    </Canvas>
  )
}

export default Personaje3D
