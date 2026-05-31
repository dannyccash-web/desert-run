import * as THREE from 'three'

// 8m wide road (4x the 2m car width)
export const ROAD_HALF_WIDTH = 4.0
export const ROAD_WIDTH = ROAD_HALF_WIDTH * 2

// Closed-loop control points: [x, y, z]. Y gives the road gentle rises and dips
// like a real road. Hairpins relaxed to wider sweeping radii.
const CONTROL_POINTS_3D: [number, number, number][] = [
  [0, 0, 0],
  [50, 0, -10],
  [95, 1.5, 5],     // gentle rise
  [130, 4, 40],     // climbing hill
  [145, 6, 85],     // hill peak
  [135, 4.5, 130],
  [105, 2, 165],    // sweeping right
  [60, 0.5, 180],
  [10, 0, 175],
  [-40, -1, 155],   // shallow dip
  [-85, 0, 125],
  [-125, 1, 80],    // wider apex (was the tight hairpin)
  [-150, 2, 25],    // big sweep around the far side
  [-145, 1.5, -30],
  [-115, 0, -75],   // wider bottom-left turn
  [-65, -0.5, -85], // gentle valley
  [-10, 0, -65],
  [40, -0.5, -35],  // small dip back to start
]

export const trackCurve = new THREE.CatmullRomCurve3(
  CONTROL_POINTS_3D.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
  true,
  'catmullrom',
  0.4,
)

const SAMPLES = 800

// Generate left/right edge points per sample. The perpendicular stays in the XZ
// plane so the road surface remains horizontal across its width (no banking),
// even when the road rises or falls along its length.
function sampleRibbon() {
  const positions: number[] = []
  const uvs: number[] = []
  for (let i = 0; i <= SAMPLES; i++) {
    const t = i / SAMPLES
    const pt = trackCurve.getPointAt(t)
    const tan = trackCurve.getTangentAt(t)
    // perpendicular in XZ plane (drop Y, normalize)
    const px = -tan.z
    const pz = tan.x
    const plen = Math.hypot(px, pz) || 1
    const nx = px / plen
    const nz = pz / plen
    positions.push(pt.x - nx * ROAD_HALF_WIDTH, pt.y, pt.z - nz * ROAD_HALF_WIDTH)
    positions.push(pt.x + nx * ROAD_HALF_WIDTH, pt.y, pt.z + nz * ROAD_HALF_WIDTH)
    uvs.push(0, t * 200)
    uvs.push(1, t * 200)
  }
  return { positions, uvs }
}

function buildIndices(closed = true) {
  const indices: number[] = []
  for (let i = 0; i < SAMPLES; i++) {
    const a = i * 2
    const b = a + 1
    const c = a + 2
    const d = a + 3
    indices.push(a, b, c)
    indices.push(b, d, c)
  }
  return indices
}

export function buildRoadGeometry(): THREE.BufferGeometry {
  const { positions, uvs } = sampleRibbon()
  // Raise visual mesh slightly to avoid z-fighting with the trimesh collider
  for (let i = 1; i < positions.length; i += 3) positions[i] += 0.02
  const indices = buildIndices()
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

/** Float32 positions + Uint32 indices for Rapier's trimesh collider. */
export function buildRoadColliderArrays(): { vertices: Float32Array; indices: Uint32Array } {
  const { positions } = sampleRibbon()
  const indices = buildIndices()
  return {
    vertices: new Float32Array(positions),
    indices: new Uint32Array(indices),
  }
}

// Yellow dashed-looking center line: a narrow solid stripe down the middle.
export function buildCenterLineGeometry(): THREE.BufferGeometry {
  const HALF = 0.1
  const positions: number[] = []
  for (let i = 0; i <= SAMPLES; i++) {
    const t = i / SAMPLES
    const pt = trackCurve.getPointAt(t)
    const tan = trackCurve.getTangentAt(t)
    const px = -tan.z
    const pz = tan.x
    const plen = Math.hypot(px, pz) || 1
    const nx = px / plen
    const nz = pz / plen
    positions.push(pt.x - nx * HALF, pt.y + 0.04, pt.z - nz * HALF)
    positions.push(pt.x + nx * HALF, pt.y + 0.04, pt.z + nz * HALF)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setIndex(buildIndices())
  geo.computeVertexNormals()
  return geo
}

// Spawn position + heading from the curve. Returns a point slightly above the
// road so the car drops onto it under gravity. Yaw aligns chassis +Z with the
// tangent's XZ projection.
export function getSpawn(t = 0.0) {
  const pt = trackCurve.getPointAt(t)
  const tan = trackCurve.getTangentAt(t)
  const yaw = Math.atan2(tan.x, tan.z)
  return {
    position: [pt.x, pt.y + 1.2, pt.z] as [number, number, number],
    rotation: [0, yaw, 0] as [number, number, number],
  }
}
