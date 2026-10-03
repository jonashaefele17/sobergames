import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer, MeshReflectorMaterial, PerformanceMonitor } from '@react-three/drei'
import { Bloom, EffectComposer, Noise, Vignette } from '@react-three/postprocessing'
import { motion } from 'motion/react'
import * as THREE from 'three'
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js'
import { LOGO_BOXES, LOGO_PARTS } from '../../lib/logoParts'
import { EASE_OUT } from '../../lib/motion'
import { BEAM_FRAG, EMBER_FRAG, EMBER_VERT, PLANE_VERT, SMOKE_FRAG } from './shaders'

type Part = keyof typeof LOGO_PARTS

// Logo-Koordinaten (viewBox 1200×893) → Welt
const SCALE = 0.0075
const CENTER = { x: 600, y: 458 }
const FLOOR_Y = -(828 - CENTER.y) * SCALE - 0.02

/** Reihenfolge und Startzeit (s), in der die Teile einschlagen. */
const SLAMS: [Part, number][] = [
  ['trophy', 0],
  ['rings', 0.55],
  ['laurelL', 1.05],
  ['laurelR', 1.2],
  ['arcText', 1.75],
  ['title', 2.45],
  ['year', 2.95],
]
const SLAM_DURATION = 0.8
const INTRO_END = 4

const FRONT_STRIPS: [number, number][] = [
  [-10, 2.6],
  [-6, 0.5],
  [-2.4, 1.9],
  [1.2, 0.7],
  [4.6, 2.8],
  [9, 0.6],
]

const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t))

interface PartGeometry {
  key: Part
  geometry: THREE.ExtrudeGeometry
  position: [number, number, number]
  start: number
}

function buildGeometries(): PartGeometry[] {
  const loader = new SVGLoader()
  return SLAMS.map(([key, start]) => {
    const data = loader.parse(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${LOGO_PARTS[key]}" fill-rule="evenodd"/></svg>`)
    const shapes = data.paths.flatMap((p) => SVGLoader.createShapes(p))
    const geometry = new THREE.ExtrudeGeometry(shapes, {
      depth: 16,
      bevelEnabled: true,
      bevelThickness: 1.6,
      bevelSize: 0.8,
      bevelSegments: 2,
      curveSegments: 5,
    })
    // jedes Teil um seinen eigenen Mittelpunkt, damit es beim Einschlag um sich selbst skaliert
    const [x0, x1, y0, y1] = LOGO_BOXES[key]
    const cx = (x0 + x1) / 2
    const cy = (y0 + y1) / 2
    geometry.translate(-cx, -cy, -8)
    return { key, geometry, position: [cx - CENTER.x, cy - CENTER.y, 0], start }
  })
}

function Logo({ parts }: { parts: PartGeometry[] }) {
  const startRef = useRef<number | null>(null)
  const group = useRef<THREE.Group>(null)
  const meshes = useRef<(THREE.Mesh | null)[]>([])
  const flash = useRef<THREE.PointLight>(null)
  const sweep = useRef<THREE.PointLight>(null)

  const materials = useMemo(
    () => [
      new THREE.MeshStandardMaterial({ color: '#f0b93a', metalness: 1, roughness: 0.3, envMapIntensity: 1.2 }),
      new THREE.MeshStandardMaterial({ color: '#8a5e10', metalness: 1, roughness: 0.42, envMapIntensity: 0.9 }),
    ],
    [],
  )

  useFrame(({ clock, camera }) => {
    const now = clock.elapsedTime
    if (startRef.current === null) startRef.current = now + 0.5
    const t = now - startRef.current

    let hit = 0
    parts.forEach((p, i) => {
      const mesh = meshes.current[i]
      if (!mesh) return
      const local = (t - p.start) / SLAM_DURATION
      mesh.visible = local > 0
      const e = easeOutExpo(Math.min(1, Math.max(0, local)))
      mesh.scale.setScalar(1 + (1 - e) * 0.5)
      mesh.position.z = (1 - e) * 620
      if (local > 0) hit += Math.exp(-((t - p.start - 0.18) ** 2) / 0.012)
    })

    // Dauerschleife: ruhiges Pendeln, damit das Metall ständig neu glänzt
    const idle = Math.min(1, Math.max(0, (t - 1) / 3))
    if (group.current) {
      group.current.rotation.y = Math.sin(t * 0.32) * 0.3 * idle
      group.current.rotation.x = Math.sin(t * 0.21) * 0.05 * idle
      group.current.position.y = Math.sin(t * 0.5) * 0.04 * idle
    }

    const push = easeOutExpo(Math.min(1, Math.max(0, t / INTRO_END)))
    camera.position.set(
      Math.sin(t * 0.13) * 0.5 * idle + (Math.random() - 0.5) * 0.05 * hit,
      0.25 + (Math.random() - 0.5) * 0.05 * hit,
      14.2 - push * 2 + Math.sin(t * 0.1) * 0.3 * idle,
    )
    camera.lookAt(0, -0.15, 0)

    if (flash.current) flash.current.intensity = hit * 260
    if (sweep.current) {
      // alle 7 s wandert ein Glanzlicht quer über das Logo
      const c = ((t - INTRO_END) % 7) / 1.8
      const on = t > INTRO_END && c < 1
      sweep.current.position.x = -7 + c * 14
      sweep.current.intensity = on ? Math.sin(c * Math.PI) * 140 : 0
    }
  })

  return (
    <>
      <group ref={group}>
        <group scale={[SCALE, -SCALE, SCALE]}>
          {parts.map((p, i) => (
            <mesh
              key={p.key}
              ref={(m) => {
                meshes.current[i] = m
              }}
              geometry={p.geometry}
              material={materials}
              position={p.position}
              visible={false}
            />
          ))}
        </group>
      </group>
      <pointLight ref={flash} position={[0, 0.5, 4]} color="#ffd98a" intensity={0} distance={30} />
      <pointLight ref={sweep} position={[0, 1.2, 3.2]} color="#fff3d0" intensity={0} distance={14} />
    </>
  )
}

function randomSeeds(length: number) {
  const seeds = new Float32Array(length)
  for (let i = 0; i < length; i++) seeds[i] = Math.random()
  return seeds
}

function Embers({ count = 1400 }: { count?: number }) {
  const material = useRef<THREE.ShaderMaterial>(null)
  const dpr = useThree((s) => s.viewport.dpr)

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const seeds = randomSeeds(count * 4)
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3))
    g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4))
    return g
  }, [count])

  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uPixelRatio: { value: 1 } }), [])

  useFrame(({ clock }) => {
    if (!material.current) return
    material.current.uniforms.uTime.value = clock.elapsedTime
    material.current.uniforms.uPixelRatio.value = dpr
  })

  return (
    <points geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={material}
        vertexShader={EMBER_VERT}
        fragmentShader={EMBER_FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

/** Fläche mit eigenem Shader (Rauch, Lichtkegel), additiv über dem Hintergrund. */
function ShaderPlane({
  fragment,
  position,
  size,
}: {
  fragment: string
  position: [number, number, number]
  size: [number, number]
}) {
  const material = useRef<THREE.ShaderMaterial>(null)
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), [])
  useFrame(({ clock }) => {
    if (material.current) material.current.uniforms.uTime.value = clock.elapsedTime
  })
  return (
    <mesh position={position}>
      <planeGeometry args={size} />
      <shaderMaterial
        ref={material}
        vertexShader={PLANE_VERT}
        fragmentShader={fragment}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  )
}

function Floor({ reflective }: { reflective: boolean }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_Y, 0]}>
      <planeGeometry args={[70, 40]} />
      {reflective ? (
        <MeshReflectorMaterial
          resolution={1024}
          blur={[320, 90]}
          mixBlur={1}
          mixStrength={70}
          roughness={0.55}
          depthScale={0.5}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.3}
          color="#060608"
          metalness={0.9}
          mirror={1}
        />
      ) : (
        <meshStandardMaterial color="#060608" metalness={0.9} roughness={0.5} />
      )}
    </mesh>
  )
}

function Scene({ parts }: { parts: PartGeometry[] | null }) {
  const [quality, setQuality] = useState(true)

  return (
    <>
      <PerformanceMonitor onDecline={() => setQuality(false)} />
      <color attach="background" args={['#030409']} />
      <fog attach="fog" args={['#030409', 14, 34]} />

      {/* Studio aus Lichtflächen statt HDR-Datei: läuft offline und spiegelt sich warm im Gold */}
      <Environment resolution={256} frames={1}>
        <color attach="background" args={['#05060c']} />
        <Lightformer form="rect" intensity={6} color="#fff2d6" position={[0, 7, 2]} rotation-x={Math.PI / 2} scale={[10, 6, 1]} />
        <Lightformer form="rect" intensity={2.4} color="#ffb347" position={[-8, 1, 2]} target={[0, 0, 0]} scale={[7, 3, 1]} />
        <Lightformer form="rect" intensity={2.4} color="#ffd9a0" position={[8, 1.5, 2]} target={[0, 0, 0]} scale={[7, 3, 1]} />
        <Lightformer form="rect" intensity={0.9} color="#3b5bd6" position={[0, -5, 6]} target={[0, 0, 0]} scale={[12, 3, 1]} />
        {/* Lichtstreifen hinter der Kamera: beim Pendeln wandern sie als Glanz über die Frontflächen */}
        {FRONT_STRIPS.map(([x, intensity]) => (
          <Lightformer key={x} form="rect" intensity={intensity} color="#ffe2a6" position={[x, 1.5, 11]} target={[0, 0, 0]} scale={[2.6, 13, 1]} />
        ))}
      </Environment>

      <spotLight position={[0, 9, 3.5]} angle={0.5} penumbra={0.9} intensity={420} color="#ffd89a" />
      <pointLight position={[0, 2.5, -3.5]} intensity={90} color="#ff9a2e" distance={16} />

      <ShaderPlane fragment={SMOKE_FRAG} position={[0, 1.2, -5]} size={[34, 17]} />
      <ShaderPlane fragment={BEAM_FRAG} position={[0, 3.4, -2.2]} size={[13, 9]} />
      <Embers />
      {parts && <Logo parts={parts} />}
      <Floor reflective={quality} />

      <EffectComposer multisampling={quality ? 4 : 0}>
        <Bloom mipmapBlur intensity={0.85} luminanceThreshold={0.72} luminanceSmoothing={0.25} />
        <Noise premultiply opacity={0.35} />
        <Vignette offset={0.28} darkness={0.82} />
      </EffectComposer>
    </>
  )
}

function hasWebGL(): boolean {
  try {
    return Boolean(document.createElement('canvas').getContext('webgl2'))
  } catch {
    return false
  }
}

/** Flaches Gold-Logo, falls der Rechner kein WebGL kann. */
function Fallback() {
  return (
    <div className="intro-fallback">
      <svg viewBox="240 80 720 760" aria-label="The Sober Games 2026">
        <defs>
          <linearGradient id="fallback-gold" x1="0" y1="80" x2="0" y2="840" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#fff1b8" />
            <stop offset="30%" stopColor="#f2c94c" />
            <stop offset="55%" stopColor="#c9971c" />
            <stop offset="75%" stopColor="#f5d46a" />
            <stop offset="100%" stopColor="#a8740a" />
          </linearGradient>
        </defs>
        {SLAMS.map(([key, start]) => (
          <motion.path
            key={key}
            d={LOGO_PARTS[key]}
            fill="url(#fallback-gold)"
            fillRule="evenodd"
            style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
            initial={{ opacity: 0, scale: 1.4 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 + start, duration: SLAM_DURATION, ease: EASE_OUT }}
          />
        ))}
      </svg>
    </div>
  )
}

export default function Intro() {
  const [webgl] = useState(hasWebGL)
  const [parts, setParts] = useState<PartGeometry[] | null>(null)

  // Die Extrusion dauert einen Moment; erst die Funken zeigen, dann rechnen.
  useEffect(() => {
    if (!webgl) return
    let geometries: PartGeometry[] | null = null
    const id = window.setTimeout(() => {
      geometries = buildGeometries()
      setParts(geometries)
    }, 350)
    return () => {
      window.clearTimeout(id)
      geometries?.forEach((p) => p.geometry.dispose())
    }
  }, [webgl])

  return (
    <div className="intro">
      {webgl ? (
        <Canvas dpr={[1, 1.75]} camera={{ fov: 30, position: [0, 0.25, 14.2], near: 0.5, far: 60 }} gl={{ antialias: false }}>
          <Scene parts={parts} />
        </Canvas>
      ) : (
        <Fallback />
      )}
      <motion.div
        className="intro-caption"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 5.2, duration: 1.6, ease: EASE_OUT }}
      >
        23. Oktober 2026 · Möttingen
      </motion.div>
    </div>
  )
}
