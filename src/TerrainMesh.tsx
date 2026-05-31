import { RigidBody, TrimeshCollider } from '@react-three/rapier'
import { useMemo } from 'react'
import * as THREE from 'three'
import { buildTerrain, type TerrainData } from './Terrain'

let cached: TerrainData | null = null
export function getTerrain(): TerrainData {
  if (!cached) cached = buildTerrain()
  return cached
}

export function Terrain() {
  const terrain = useMemo(() => getTerrain(), [])
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(terrain.positions, 3))
    g.setAttribute('uv', new THREE.BufferAttribute(terrain.uvs, 2))
    g.setIndex(new THREE.BufferAttribute(terrain.indices, 1))
    g.computeVertexNormals()
    return g
  }, [terrain])

  return (
    <RigidBody type="fixed" colliders={false} friction={1.0} restitution={0.0}>
      <TrimeshCollider args={[terrain.positions, terrain.indices]} friction={1.0} restitution={0.0} />
      <mesh receiveShadow geometry={geometry}>
        <meshStandardMaterial color="#c89a6a" roughness={1} metalness={0} />
      </mesh>
    </RigidBody>
  )
}
