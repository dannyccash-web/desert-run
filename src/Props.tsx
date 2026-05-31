import { useGLTF } from '@react-three/drei'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { useMemo } from 'react'
import * as THREE from 'three'
import { getTerrain } from './TerrainMesh'
import { ROAD_HALF_WIDTH } from './Track'

// Bounding-box data extracted from the GLBs (source units). `scale` is chosen
// so each model lands at a reasonable Southwest-landscape size in metres.
// world size = source size × scale
type ModelDef = {
  url: string
  scale: number
  size: [number, number, number]   // source-unit XYZ extent
  center: [number, number, number] // source-unit bbox center (offset from model origin)
}

const MODELS: ModelDef[] = [
  { url: 'models/Hill_desert_003.glb',     scale: 0.0050, size: [5565,  787, 1862], center: [ 30,  393,  -27] }, // long ridge, ~28m
  { url: 'models/Hill_desert_005.glb',     scale: 0.0055, size: [3536,  880, 2669], center: [ 13,  440, -184] }, // hill, ~19m
  { url: 'models/Mountain_desert_001.glb', scale: 0.0110, size: [2300, 1663, 2300], center: [  0,  832,    0] }, // 25m peak
  { url: 'models/Mountain_desert_005.glb', scale: 0.0120, size: [2470, 2151, 2432], center: [-14, 1076,   66] }, // 30m peak
  { url: 'models/Mountain_desert_008.glb', scale: 0.0090, size: [5606, 2588, 2382], center: [-26, 1275,   41] }, // 50m ridge
  { url: 'models/Plateau_desert_002.glb',  scale: 0.0095, size: [4921, 2273, 2624], center: [ 17, 1137, -162] }, // 47m plateau
  { url: 'models/Plateau_desert_004.glb',  scale: 0.0095, size: [5388, 2125, 2820], center: [-94, 1063,  -77] }, // 51m plateau
]

const NUM_PROPS = 110
const ROAD_SAFETY = 4                          // metres between asphalt edge and any prop
const TERRAIN_HALF = 380                       // keep within visible terrain

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
  // Half-extents in world space (already includes scale jitter)
  halfExtents: [number, number, number]
  // Bbox-center offset in world space (relative to placement position)
  centerOffset: [number, number, number]
}

function placeProps(): Placement[] {
  const rand = mulberry32(20250531)
  const terrain = getTerrain()
  const placements: Placement[] = []
  let attempts = 0
  const MAX_ATTEMPTS = NUM_PROPS * 60

  while (placements.length < NUM_PROPS && attempts < MAX_ATTEMPTS) {
    attempts++
    // Bias positions outward — uniform area sampling in a disc
    const r = Math.sqrt(rand()) * TERRAIN_HALF
    const a = rand() * Math.PI * 2
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    if (Math.abs(x) > TERRAIN_HALF || Math.abs(z) > TERRAIN_HALF) continue

    // Pick model — hills favoured close to road, mountains further out
    const { distToRoad, y } = terrain.sample(x, z)
    const farFactor = Math.min(1, distToRoad / 70)
    let pickIdx: number
    if (farFactor > 0.6) {
      pickIdx = Math.floor(rand() * MODELS.length)
    } else {
      pickIdx = rand() < 0.75 ? Math.floor(rand() * 2) : Math.floor(rand() * MODELS.length)
    }
    const model = MODELS[pickIdx]

    const scaleJitter = 0.7 + rand() * 0.6
    const scale = model.scale * scaleJitter
    const hx = (model.size[0] * scale) / 2
    const hy = (model.size[1] * scale) / 2
    const hz = (model.size[2] * scale) / 2

    // Conservative "after any rotation" horizontal half-radius:
    const circRadius = Math.hypot(hx, hz)

    // Reject if the prop's bbox would reach the road
    if (distToRoad - circRadius < ROAD_HALF_WIDTH + ROAD_SAFETY) continue

    // Reject if the prop would poke past terrain edges
    if (Math.abs(x) + circRadius > TERRAIN_HALF || Math.abs(z) + circRadius > TERRAIN_HALF) continue

    const centerOffset: [number, number, number] = [
      model.center[0] * scale,
      model.center[1] * scale,
      model.center[2] * scale,
    ]

    placements.push({
      modelIndex: pickIdx,
      position: [x, y - 0.15, z],
      rotationY: rand() * Math.PI * 2,
      scale,
      halfExtents: [hx, hy, hz],
      centerOffset,
    })
  }
  return placements
}

const sandMaterial = new THREE.MeshStandardMaterial({ color: '#a87a4d', roughness: 1, metalness: 0 })

function PropInstance({ placement }: { placement: Placement }) {
  const url = `${import.meta.env.BASE_URL}${MODELS[placement.modelIndex].url}`
  const { scene } = useGLTF(url) as any
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
    <RigidBody
      type="fixed"
      position={placement.position}
      rotation={[0, placement.rotationY, 0]}
      colliders={false}
    >
      <CuboidCollider args={placement.halfExtents} position={placement.centerOffset} friction={0.9} />
      <primitive object={cloned} scale={placement.scale} />
    </RigidBody>
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
