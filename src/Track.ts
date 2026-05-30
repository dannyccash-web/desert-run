import * as THREE from 'three'

// Half the road width (full width = 4m = 2x car width of 2m)
export const ROAD_HALF_WIDTH = 2.0
export const ROAD_WIDTH = ROAD_HALF_WIDTH * 2

// Closed-loop control points in the XZ plane. Designed as a rough oval
// with chicanes and a sweeping hairpin for variety.
const CONTROL_POINTS_2D: [number, number][] = [
  [0, 0],
  [30, -5],
  [60, 10],
  [85, 45],
  [95, 90],
  [80, 130],   // top straight
  [40, 145],
  [-5, 130],
  [-35, 100],  // chicane left
  [-20, 70],
  [-50, 45],
  [-90, 30],   // hairpin out
  [-110, -10],
  [-80, -40],
  [-30, -45],
  [10, -25],
]

export const trackCurve = new THREE.CatmullRomCurve3(
  CONTROL_POINTS_2D.map(([x, z]) => new THREE.Vector3(x, 0, z)),
  true,
  'catmullrom',
  0.4,
)

const SAMPLES = 600

export function buildRoadGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []

  for (let i = 0; i <= SAMPLES; i++) {
    const t = i / SAMPLES
    const pt = trackCurve.getPointAt(t)
    const tan = trackCurve.getTangentAt(t)
    // perpendicular in XZ plane (rotate tangent 90° around Y)
    const nx = -tan.z
    const nz = tan.x
    const left = { x: pt.x - nx * ROAD_HALF_WIDTH, z: pt.z - nz * ROAD_HALF_WIDTH }
    const right = { x: pt.x + nx * ROAD_HALF_WIDTH, z: pt.z + nz * ROAD_HALF_WIDTH }
    positions.push(left.x, 0.02, left.z)
    positions.push(right.x, 0.02, right.z)
    uvs.push(0, t * 200)
    uvs.push(1, t * 200)
  }
  for (let i = 0; i < SAMPLES; i++) {
    const a = i * 2
    const b = a + 1
    const c = a + 2
    const d = a + 3
    indices.push(a, b, c)
    indices.push(b, d, c)
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

// Yellow dashed center line: a narrower ribbon down the middle,
// alternating gaps via UV-driven fragment discard would be more complex —
// keep it simple with a solid thin stripe.
export function buildCenterLineGeometry(): THREE.BufferGeometry {
  const HALF = 0.05
  const positions: number[] = []
  const indices: number[] = []
  for (let i = 0; i <= SAMPLES; i++) {
    const t = i / SAMPLES
    const pt = trackCurve.getPointAt(t)
    const tan = trackCurve.getTangentAt(t)
    const nx = -tan.z
    const nz = tan.x
    const l = { x: pt.x - nx * HALF, z: pt.z - nz * HALF }
    const r = { x: pt.x + nx * HALF, z: pt.z + nz * HALF }
    positions.push(l.x, 0.03, l.z)
    positions.push(r.x, 0.03, r.z)
  }
  for (let i = 0; i < SAMPLES; i++) {
    const a = i * 2
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

// Sample a spawn position + direction from the curve. The car spawns
// just above the track at parameter t with the chassis facing along the
// tangent (yaw only).
export function getSpawn(t = 0.0) {
  const pt = trackCurve.getPointAt(t)
  const tan = trackCurve.getTangentAt(t)
  const yaw = Math.atan2(tan.x, tan.z) // align chassis -Z forward with tangent
  return {
    position: [pt.x, 1.0, pt.z] as [number, number, number],
    rotation: [0, yaw, 0] as [number, number, number],
  }
}
