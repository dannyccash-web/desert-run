import { Canvas } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { Ground } from './Ground'
import { SkyGradient } from './SkyGradient'
import { Track } from './TrackMesh'
import { Vehicle } from './Vehicle'

export function App() {
  return (
    <Canvas shadows camera={{ position: [0, 5, -12], fov: 60 }} dpr={[1, 1.5]}>
      <SkyGradient />
      <fog attach="fog" args={['#bedcf5', 120, 600]} />

      <ambientLight intensity={0.55} />
      <directionalLight
        position={[80, 120, 60]}
        intensity={1.3}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-120}
        shadow-camera-right={120}
        shadow-camera-top={120}
        shadow-camera-bottom={-120}
        shadow-bias={-0.0005}
      />
      <hemisphereLight args={['#cfe6ff', '#3a5230', 0.45]} />

      <Physics gravity={[0, -9.81, 0]}>
        <Ground />
        <Track />
        <Vehicle />
      </Physics>
    </Canvas>
  )
}
