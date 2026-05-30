import { RigidBody, CuboidCollider } from '@react-three/rapier'
import * as THREE from 'three'

const GROUND_SIZE = 800
const HALF = GROUND_SIZE / 2

// A few simple props to give the desert visual reference
const props = [
  // [x, z, size]
  ...Array.from({ length: 60 }, (_, i) => {
    // pseudo-random but stable rocks scattered around
    const a = (i * 137.508 * Math.PI) / 180
    const r = 30 + ((i * 17) % 200)
    return [Math.cos(a) * r, Math.sin(a) * r, 0.8 + ((i * 7) % 10) / 10] as [number, number, number]
  }),
]

export function Ground() {
  return (
    <>
      {/* Drivable ground */}
      <RigidBody type="fixed" colliders={false} friction={1.2}>
        <CuboidCollider args={[HALF, 0.5, HALF]} position={[0, -0.5, 0]} friction={1.2} />
        <mesh receiveShadow position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[GROUND_SIZE, GROUND_SIZE, 1, 1]} />
          <meshStandardMaterial color="#d2a36b" roughness={1} />
        </mesh>
      </RigidBody>

      {/* Scattered rocks (collidable props) */}
      {props.map((p, i) => (
        <RigidBody key={i} type="fixed" position={[p[0], p[2] / 2, p[1]]} colliders="cuboid">
          <mesh castShadow receiveShadow>
            <boxGeometry args={[p[2], p[2], p[2]]} />
            <meshStandardMaterial color={i % 3 === 0 ? '#6b4a2b' : '#8a6a4a'} roughness={0.9} />
          </mesh>
        </RigidBody>
      ))}

      {/* Distant dunes — visual only */}
      <mesh position={[0, 4, -200]}>
        <coneGeometry args={[40, 8, 24]} />
        <meshStandardMaterial color="#b8884d" roughness={1} />
      </mesh>
      <mesh position={[120, 5, -160]}>
        <coneGeometry args={[55, 10, 24]} />
        <meshStandardMaterial color="#a87838" roughness={1} />
      </mesh>
      <mesh position={[-150, 6, -180]}>
        <coneGeometry args={[60, 12, 24]} />
        <meshStandardMaterial color="#b8884d" roughness={1} />
      </mesh>
    </>
  )
}
