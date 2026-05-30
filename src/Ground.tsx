import { RigidBody, CuboidCollider } from '@react-three/rapier'

const GROUND_SIZE = 800
const HALF = GROUND_SIZE / 2

/** Flat grassy/sandy ground around the track. The track sits 0.02m above this. */
export function Ground() {
  return (
    <RigidBody type="fixed" colliders={false} friction={1.0}>
      <CuboidCollider args={[HALF, 0.5, HALF]} position={[0, -0.5, 0]} friction={1.0} />
      <mesh receiveShadow position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[GROUND_SIZE, GROUND_SIZE, 1, 1]} />
        <meshStandardMaterial color="#6f8f47" roughness={1} />
      </mesh>
    </RigidBody>
  )
}
