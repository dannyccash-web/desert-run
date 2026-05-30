import { useMemo } from 'react'
import { buildCenterLineGeometry, buildRoadGeometry } from './Track'

export function Track() {
  const road = useMemo(() => buildRoadGeometry(), [])
  const line = useMemo(() => buildCenterLineGeometry(), [])

  return (
    <>
      <mesh receiveShadow geometry={road}>
        <meshStandardMaterial color="#2a2a2e" roughness={0.95} metalness={0.0} />
      </mesh>
      <mesh geometry={line}>
        <meshStandardMaterial color="#f4c83f" emissive="#aa8a20" emissiveIntensity={0.15} roughness={0.8} />
      </mesh>
    </>
  )
}
