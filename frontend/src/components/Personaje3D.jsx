import { Suspense, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Sparkles, useTexture } from '@react-three/drei'
import { imagenPersonaje } from '../data/personajes'

function CardMesh({ slug }) {
  const texture = useTexture(imagenPersonaje(slug))
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
      <Sparkles count={70} scale={6} size={2.5} speed={0.5} color={accent} />
    </Canvas>
  )
}

export default Personaje3D
