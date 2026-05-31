// Builds a heightmapped terrain that follows the road's elevation in a
// corridor on either side of the curve, then smoothly returns to the
// base ground height. The terrain always sits just below the road so the
// asphalt is never buried.

import * as THREE from 'three'
import { ROAD_HALF_WIDTH, trackCurve } from './Track'

// Terrain extents
const TERRAIN_SIZE = 800
const TERRAIN_GRID = 200       // 200x200 quads = 4m per cell over 800m
const TERRAIN_STEP = TERRAIN_SIZE / TERRAIN_GRID

// Road corridor: terrain matches road height inside this band, blends out by FADE
const CORRIDOR = ROAD_HALF_WIDTH + 1.0  // just outside the road edge
const FADE = 24                         // metres over which terrain blends back to base
const TERRAIN_OFFSET_BELOW_ROAD = 0.25  // terrain sits this far below the road centreline

// Spatial-hash bins of curve samples for fast nearest-point lookup.
const SAMPLES = 800
const BIN = 64                          // 64x64 spatial bins (~12.5m each)
const BIN_SIZE = TERRAIN_SIZE / BIN

function deterministicNoise(x: number, z: number): number {
  // Cheap layered sine noise — desert dune feel, not perlin-grade
  return (
    Math.sin(x * 0.043) * Math.cos(z * 0.039) * 0.6 +
    Math.sin(x * 0.11 + z * 0.07) * 0.3 +
    Math.sin(x * 0.21 - z * 0.17) * 0.15
  )
}

export type TerrainData = {
  positions: Float32Array
  indices: Uint32Array
  uvs: Float32Array
  // Closure that returns terrain height + distance-to-road for any (x, z).
  // Used by the prop scatterer to place models at the right height + outside the road.
  sample: (x: number, z: number) => { y: number; distToRoad: number }
}

export function buildTerrain(): TerrainData {
  // 1. Sample the curve densely
  const samples: { x: number; y: number; z: number }[] = []
  for (let i = 0; i < SAMPLES; i++) {
    const p = trackCurve.getPointAt(i / SAMPLES)
    samples.push({ x: p.x, y: p.y, z: p.z })
  }

  // 2. Bin samples for spatial lookup
  const bins: number[][] = Array.from({ length: BIN * BIN }, () => [])
  const HALF = TERRAIN_SIZE / 2
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i]
    const bx = Math.floor((s.x + HALF) / BIN_SIZE)
    const bz = Math.floor((s.z + HALF) / BIN_SIZE)
    if (bx >= 0 && bx < BIN && bz >= 0 && bz < BIN) {
      bins[bz * BIN + bx].push(i)
    }
  }

  // For each (x, z) find closest curve sample (and its y).
  const lookup = (x: number, z: number) => {
    const bx = Math.floor((x + HALF) / BIN_SIZE)
    const bz = Math.floor((z + HALF) / BIN_SIZE)
    let minDist2 = Infinity
    let closestY = 0
    // Search nearby bins — radius depends on how far the corridor reaches
    const R = 3
    for (let dz = -R; dz <= R; dz++) {
      for (let dx = -R; dx <= R; dx++) {
        const cbx = bx + dx
        const cbz = bz + dz
        if (cbx < 0 || cbx >= BIN || cbz < 0 || cbz >= BIN) continue
        const bin = bins[cbz * BIN + cbx]
        for (let k = 0; k < bin.length; k++) {
          const s = samples[bin[k]]
          const ddx = s.x - x
          const ddz = s.z - z
          const d2 = ddx * ddx + ddz * ddz
          if (d2 < minDist2) {
            minDist2 = d2
            closestY = s.y
          }
        }
      }
    }
    // Fallback: brute force if nothing in the bins (e.g. very far edges)
    if (minDist2 === Infinity) {
      for (let k = 0; k < samples.length; k++) {
        const s = samples[k]
        const ddx = s.x - x
        const ddz = s.z - z
        const d2 = ddx * ddx + ddz * ddz
        if (d2 < minDist2) {
          minDist2 = d2
          closestY = s.y
        }
      }
    }
    return { dist: Math.sqrt(minDist2), closestRoadY: closestY }
  }

  // 3. Sample function for terrain Y at any point (used by prop placement too)
  const sample = (x: number, z: number) => {
    const { dist, closestRoadY } = lookup(x, z)
    let y: number
    if (dist <= CORRIDOR) {
      // inside corridor: match road, slightly below
      y = closestRoadY - TERRAIN_OFFSET_BELOW_ROAD
    } else if (dist >= CORRIDOR + FADE) {
      // beyond fade: base terrain with noise
      y = deterministicNoise(x, z)
    } else {
      // smoothstep blend from road height → base ground (with noise)
      const t = (dist - CORRIDOR) / FADE
      const sm = t * t * (3 - 2 * t)
      const insideY = closestRoadY - TERRAIN_OFFSET_BELOW_ROAD
      const outsideY = deterministicNoise(x, z)
      y = insideY * (1 - sm) + outsideY * sm
    }
    return { y, distToRoad: dist }
  }

  // 4. Build the grid mesh
  const N = TERRAIN_GRID + 1
  const positions = new Float32Array(N * N * 3)
  const uvs = new Float32Array(N * N * 2)
  let p = 0
  let u = 0
  for (let gz = 0; gz < N; gz++) {
    for (let gx = 0; gx < N; gx++) {
      const x = gx * TERRAIN_STEP - HALF
      const z = gz * TERRAIN_STEP - HALF
      const { y } = sample(x, z)
      positions[p++] = x
      positions[p++] = y
      positions[p++] = z
      uvs[u++] = gx / TERRAIN_GRID
      uvs[u++] = gz / TERRAIN_GRID
    }
  }
  const indices = new Uint32Array(TERRAIN_GRID * TERRAIN_GRID * 6)
  let ii = 0
  for (let gz = 0; gz < TERRAIN_GRID; gz++) {
    for (let gx = 0; gx < TERRAIN_GRID; gx++) {
      const a = gz * N + gx
      const b = a + 1
      const c = a + N
      const d = c + 1
      indices[ii++] = a
      indices[ii++] = c
      indices[ii++] = b
      indices[ii++] = b
      indices[ii++] = c
      indices[ii++] = d
    }
  }

  return { positions, indices, uvs, sample }
}

export const TERRAIN_DEFAULTS = { TERRAIN_SIZE, CORRIDOR, FADE }
