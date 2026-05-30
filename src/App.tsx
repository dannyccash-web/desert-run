import { Sky } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { Ground } from './Ground'
import { Vehicle } from './Vehicle'

export function App() {
  return (
    <Canvas shadows camera={{ position: [0, 5, -12], fov: 60 }} dpr={[1, 1.5]}>
      <color attach="background" args={['#f0d9a8']} />
      <fog attach="fog" args={['#f0d9a8', 80, 500]} />

      <Sky sunPosition={[100, 60, 100]} distance={1000} turbidity={6} rayleigh={1} />

      <ambientLight intensity={0.45} />
      <directionalLight
        position={[80, 100, 50]}
        intensity={1.4}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-80}
        shadow-camera-right={80}
        shadow-camera-top={80}
        shadow-camera-bottom={-80}
        shadow-bias={-0.0005}
      />
      <hemisphereLight args={['#e8c897', '#604a30', 0.5]} />

      <Physics gravity={[0, -9.81, 0]}>
        <Ground />
        <Vehicle />
      </Physics>
    </Canvas>
  )
}
