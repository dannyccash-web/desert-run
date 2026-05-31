import { RigidBody, TrimeshCollider } from '@react-three/rapier'
import { useMemo } from 'react'
import { buildCenterLineGeometry, buildRoadColliderArrays, buildRoadGeometry } from './Track'

export function Track() {
  const road = useMemo(() => buildRoadGeometry(), [])
  const line = useMemo(() => buildCenterLineGeometry(), [])
  const collider = useMemo(() => buildRoadColliderArrays(), [])

  return (
    <>
      {/* Trimesh collider for the road surface — car drives on this so it can
          follow the road's rises and falls. Higher friction than the off-road
          grass below. */}
      <RigidBody type="fixed" colliders={false} friction={1.5} restitution={0.0}>
        <TrimeshCollider args={[collider.vertices, collider.indices]} friction={1.5} restitution={0.0} />
      </RigidBody>

      <mesh receiveShadow geometry={road}>
        <meshStandardMaterial color="#2a2a2e" roughness={0.95} metalness={0.0} />
      </mesh>
      <mesh geometry={line}>
        <meshStandardMaterial color="#f4c83f" emissive="#aa8a20" emissiveIntensity={0.15} roughness={0.8} />
      </mesh>
    </>
  )
}
