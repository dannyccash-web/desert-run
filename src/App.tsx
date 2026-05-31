import { Canvas } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { Suspense } from 'react'
import { Props } from './Props'
import { SkyGradient } from './SkyGradient'
import { Terrain } from './TerrainMesh'
import { Track } from './TrackMesh'
import { Vehicle } from './Vehicle'

export function App() {
  return (
    <Canvas shadows camera={{ position: [0, 5, -12], fov: 60 }} dpr={[1, 1.5]}>
      <SkyGradient top="#3aa1d4" horizon="#f3d4a5" />
      <fog attach="fog" args={['#f3d4a5', 140, 700]} />

      <ambientLight intensity={0.5} />
      <directionalLight
        position={[80, 130, 60]}
        intensity={1.55}
        color="#ffe7c4"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-150}
        shadow-camera-right={150}
        shadow-camera-top={150}
        shadow-camera-bottom={-150}
        shadow-bias={-0.0005}
      />
      <hemisphereLight args={['#f6e1bd', '#5a3a20', 0.55]} />

      <Physics gravity={[0, -9.81, 0]}>
        <Terrain />
        <Track />
        <Vehicle />
      </Physics>

      <Suspense fallback={null}>
        <Props />
      </Suspense>
    </Canvas>
  )
}
