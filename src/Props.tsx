import { useGLTF } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'
import { getTerrain } from './TerrainMesh'
import { ROAD_HALF_WIDTH } from './Track'

const MODELS = [
  { url: 'models/Mountain_desert_001.glb', scale: 4.5, weight: 1 },
  { url: 'models/Mountain_desert_005.glb', scale: 4.0, weight: 1 },
  { url: 'models/Mountain_desert_008.glb', scale: 5.5, weight: 1 },
  { url: 'models/Plateau_desert_002.glb', scale: 3.5, weight: 1 },
  { url: 'models/Plateau_desert_004.glb', scale: 3.5, weight: 1 },
  { url: 'models/Hill_desert_003.glb', scale: 2.5, weight: 1.5 },
  { url: 'models/Hill_desert_005.glb', scale: 3.0, weight: 1.5 },
]

const NUM_PROPS = 110
const MIN_DIST_FROM_ROAD = ROAD_HALF_WIDTH + 8 // never inside road or right at its edge
const TERRAIN_HALF = 380                       // keep props inside the visible terrain bounds

// Deterministic seedable PRNG (Mulberry32). Fixed seed → fixed prop layout.
function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Placement = {
  modelIndex: number
  position: [number, number, number]
  rotationY: number
  scale: number
}

function placeProps(): Placement[] {
  const rand = mulberry32(20250531)
  const terrain = getTerrain()
  const placements: Placement[] = []
  let attempts = 0
  while (placements.length < NUM_PROPS && attempts < NUM_PROPS * 30) {
    attempts++
    // Sample in a ring around the track centre, biased outward
    const r = Math.sqrt(rand()) * TERRAIN_HALF
    const a = rand() * Math.PI * 2
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r

    const { y, distToRoad } = terrain.sample(x, z)
    if (distToRoad < MIN_DIST_FROM_ROAD) continue
    if (Math.abs(x) > TERRAIN_HALF || Math.abs(z) > TERRAIN_HALF) continue

    // No props in the small fade band touching the road
    if (distToRoad < MIN_DIST_FROM_ROAD + 2) continue

    // Pick a model weighted toward smaller hills near the road, big mountains far
    const farFactor = Math.min(1, distToRoad / 80)
    let pickIdx: number
    if (farFactor > 0.6) {
      pickIdx = Math.floor(rand() * MODELS.length)
    } else {
      // Closer to road, prefer hills (last two)
      pickIdx = rand() < 0.7 ? 5 + Math.floor(rand() * 2) : Math.floor(rand() * MODELS.length)
    }

    const model = MODELS[pickIdx]
    const scaleJitter = 0.7 + rand() * 0.6
    placements.push({
      modelIndex: pickIdx,
      position: [x, y - 0.3, z],
      rotationY: rand() * Math.PI * 2,
      scale: model.scale * scaleJitter,
    })
  }
  return placements
}

const sandMaterial = new THREE.MeshStandardMaterial({ color: '#a87a4d', roughness: 1, metalness: 0 })

function PropInstance({ placement }: { placement: Placement }) {
  const { scene } = useGLTF(`${import.meta.env.BASE_URL}${MODELS[placement.modelIndex].url}`) as any
  // Clone the scene per-instance so each transform is independent
  const cloned = useMemo(() => {
    const c = (scene as THREE.Group).clone(true)
    c.traverse((obj) => {
      const m = obj as THREE.Mesh
      if (m.isMesh) {
        m.material = sandMaterial
        m.castShadow = true
        m.receiveShadow = true
      }
    })
    return c
  }, [scene])
  return (
    <primitive
      object={cloned}
      position={placement.position}
      rotation={[0, placement.rotationY, 0]}
      scale={placement.scale}
    />
  )
}

export function Props() {
  const placements = useMemo(() => placeProps(), [])
  return (
    <group>
      {placements.map((p, i) => (
        <PropInstance key={i} placement={p} />
      ))}
    </group>
  )
}

// Preload models so they're ready when Props mounts
MODELS.forEach((m) => useGLTF.preload(`${import.meta.env.BASE_URL}${m.url}`))
