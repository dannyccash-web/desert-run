import type { Collider } from '@dimforge/rapier3d-compat'
import { KeyboardControls, OrbitControls, useGLTF, useKeyboardControls } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { CuboidCollider, Physics, type RapierRigidBody, RigidBody, useRapier } from '@react-three/rapier'
import { type RefObject, useRef, useState } from 'react'
import * as THREE from 'three'
import { Instructions, useLoadingAssets, usePageVisible } from './helpers'
import { type WheelInfo, useVehicleController } from './use-vehicle-controller'

const racetrackGlbUrl = `${import.meta.env.BASE_URL}racetrack.glb`

const spawn = {
  position: [-7, 2, -130] as [number, number, number],
  rotation: [0, Math.PI / 2, 0] as [number, number, number],
}

const controlsMap = [
  { name: 'forward', keys: ['ArrowUp', 'KeyW'] },
  { name: 'back', keys: ['ArrowDown', 'KeyS'] },
  { name: 'left', keys: ['ArrowLeft', 'KeyA'] },
  { name: 'right', keys: ['ArrowRight', 'KeyD'] },
  { name: 'brake', keys: ['Space'] },
  { name: 'reset', keys: ['KeyR'] },
]

type KeyControls = {
  forward: boolean
  back: boolean
  left: boolean
  right: boolean
  brake: boolean
  reset: boolean
}

const wheelInfo: Omit<WheelInfo, 'position'> = {
  axleCs: new THREE.Vector3(0, 0, -1),
  suspensionRestLength: 0.125,
  suspensionStiffness: 24,
  maxSuspensionTravel: 1,
  sideFrictionStiffness: 3,
  frictionSlip: 1.5,
  radius: 0.15,
}

const wheels: WheelInfo[] = [
  { position: new THREE.Vector3(-0.65, -0.15, -0.45), ...wheelInfo }, // front
  { position: new THREE.Vector3(-0.65, -0.15, 0.45), ...wheelInfo },
  { position: new THREE.Vector3(0.65, -0.15, -0.45), ...wheelInfo },  // rear
  { position: new THREE.Vector3(0.65, -0.15, 0.45), ...wheelInfo },
]

const cameraOffset = new THREE.Vector3(7, 3, 0)
const cameraTargetOffset = new THREE.Vector3(0, 1.5, 0)

const _bodyPosition = new THREE.Vector3()
const _airControlAngVel = new THREE.Vector3()
const _cameraPosition = new THREE.Vector3()
const _cameraTarget = new THREE.Vector3()

// Hardcoded tuning (were leva knobs in original)
const accelerateForce = 2
const brakeForce = 0.05
const steerAngle = Math.PI / 24

type VehicleProps = {
  position: [number, number, number]
  rotation: [number, number, number]
}

const Vehicle = ({ position, rotation }: VehicleProps) => {
  const { world, rapier } = useRapier()
  const threeControls = useThree((s) => s.controls)
  const [, getKeyboardControls] = useKeyboardControls<keyof KeyControls>()

  const chasisMeshRef = useRef<THREE.Mesh>(null!)
  const chasisBodyRef = useRef<RapierRigidBody>(null!)
  const wheelsRef: RefObject<(THREE.Object3D | null)[]> = useRef([])

  const { vehicleController } = useVehicleController(
    chasisBodyRef,
    wheelsRef as RefObject<THREE.Object3D[]>,
    wheels,
  )

  const [smoothedCameraPosition] = useState(new THREE.Vector3(0, 100, -300))
  const [smoothedCameraTarget] = useState(new THREE.Vector3())

  const ground = useRef<Collider | null>(null)

  useFrame((state, delta) => {
    if (!chasisMeshRef.current || !vehicleController.current || !!threeControls) return

    const t = 1.0 - 0.01 ** delta

    const controller = vehicleController.current
    const chassisRigidBody = controller.chassis()
    const controls = getKeyboardControls()

    let outOfBounds = false
    const ray = new rapier.Ray(chassisRigidBody.translation(), { x: 0, y: -1, z: 0 })
    const raycastResult = world.castRay(ray, 1, false, undefined, undefined, undefined, chassisRigidBody)
    ground.current = null
    if (raycastResult) {
      const collider = raycastResult.collider
      const userData = collider.parent()?.userData as any
      outOfBounds = userData?.outOfBounds
      ground.current = collider
    }

    const engineForce = Number(controls.forward) * accelerateForce - Number(controls.back)
    controller.setWheelEngineForce(0, engineForce)
    controller.setWheelEngineForce(1, engineForce)

    const wheelBrake = Number(controls.brake) * brakeForce
    controller.setWheelBrake(0, wheelBrake)
    controller.setWheelBrake(1, wheelBrake)
    controller.setWheelBrake(2, wheelBrake)
    controller.setWheelBrake(3, wheelBrake)

    const currentSteering = controller.wheelSteering(0) || 0
    const steerDirection = Number(controls.left) - Number(controls.right)
    const steering = THREE.MathUtils.lerp(currentSteering, steerAngle * steerDirection, 0.5)
    controller.setWheelSteering(0, steering)
    controller.setWheelSteering(1, steering)

    // Air control
    if (!ground.current) {
      const forwardAngVel = Number(controls.forward) - Number(controls.back)
      const sideAngVel = Number(controls.left) - Number(controls.right)
      const angvel = _airControlAngVel.set(0, sideAngVel * t, forwardAngVel * t)
      angvel.applyQuaternion(chassisRigidBody.rotation() as any)
      const curr = chassisRigidBody.angvel()
      angvel.add(new THREE.Vector3(curr.x, curr.y, curr.z))
      chassisRigidBody.setAngvel(new rapier.Vector3(angvel.x, angvel.y, angvel.z), true)
    }

    if (controls.reset || outOfBounds) {
      const chassis = controller.chassis()
      chassis.setTranslation(new rapier.Vector3(...spawn.position), true)
      const spawnRot = new THREE.Euler(...spawn.rotation)
      const spawnQuat = new THREE.Quaternion().setFromEuler(spawnRot)
      chassis.setRotation(spawnQuat, true)
      chassis.setLinvel(new rapier.Vector3(0, 0, 0), true)
      chassis.setAngvel(new rapier.Vector3(0, 0, 0), true)
    }

    // Camera
    const cameraPosition = _cameraPosition
    if (ground.current) {
      cameraPosition.copy(cameraOffset)
      cameraPosition.applyMatrix4(chasisMeshRef.current.matrixWorld)
    } else {
      const velocity = chassisRigidBody.linvel()
      cameraPosition.set(velocity.x, velocity.y, velocity.z)
      cameraPosition.normalize().multiplyScalar(-10)
      const tr = chassisRigidBody.translation()
      cameraPosition.add(new THREE.Vector3(tr.x, tr.y, tr.z))
    }
    cameraPosition.y = Math.max(cameraPosition.y, (vehicleController.current?.chassis().translation().y ?? 0) + 1)
    smoothedCameraPosition.lerp(cameraPosition, t)
    state.camera.position.copy(smoothedCameraPosition)

    const bodyPosition = chasisMeshRef.current.getWorldPosition(_bodyPosition)
    const cameraTarget = _cameraTarget
    cameraTarget.copy(bodyPosition)
    cameraTarget.add(cameraTargetOffset)
    smoothedCameraTarget.lerp(cameraTarget, t)
    state.camera.lookAt(smoothedCameraTarget)
  })

  return (
    <RigidBody
      position={position}
      rotation={rotation}
      canSleep={false}
      ref={chasisBodyRef}
      colliders={false}
      type="dynamic"
    >
      <CuboidCollider args={[0.8, 0.2, 0.4]} />
      <mesh ref={chasisMeshRef} castShadow>
        <boxGeometry args={[1.6, 0.4, 0.8]} />
        <meshStandardMaterial color="#c83232" />
      </mesh>
      {wheels.map((wheel, index) => (
        <group
          key={String(index)}
          ref={(ref) => { if (wheelsRef.current) wheelsRef.current[index] = ref }}
          position={wheel.position}
        >
          <group rotation-x={-Math.PI / 2}>
            <mesh castShadow>
              <cylinderGeometry args={[0.15, 0.15, 0.25, 16]} />
              <meshStandardMaterial color="#222" />
            </mesh>
            <mesh scale={1.01}>
              <cylinderGeometry args={[0.15, 0.15, 0.25, 6]} />
              <meshStandardMaterial color="#fff" wireframe />
            </mesh>
          </group>
        </group>
      ))}
    </RigidBody>
  )
}

const Scene = () => {
  const { scene } = useGLTF(racetrackGlbUrl)
  return (
    <>
      {/* Out-of-bounds floor — falling off the track triggers a reset */}
      <RigidBody type="fixed" colliders="cuboid" position={[0, -0.5, 0]} userData={{ outOfBounds: true }}>
        <mesh receiveShadow>
          <boxGeometry args={[600, 1, 600]} />
          <meshStandardMaterial color="#553322" />
        </mesh>
      </RigidBody>

      {/* Track mesh */}
      <RigidBody type="fixed" colliders="trimesh" position={[-50, 0, -150]}>
        <primitive object={scene} scale={0.6} />
      </RigidBody>
    </>
  )
}

export function Sketch() {
  const pageVisible = usePageVisible()
  const loading = useLoadingAssets()

  return (
    <>
      <Canvas shadows camera={{ position: [0, 30, -30], fov: 60 }}>
        <color attach="background" args={['#87b7e4']} />
        <ambientLight intensity={0.9} />
        <hemisphereLight args={['#b8d8ff', '#3a2a1a', 0.5]} />
        <directionalLight
          position={[60, 80, 30]}
          intensity={1.2}
          castShadow
          shadow-mapSize={[2048, 2048]}
        />

        <Physics paused={!pageVisible || loading}>
          <KeyboardControls map={controlsMap}>
            <Vehicle position={spawn.position} rotation={spawn.rotation} />
          </KeyboardControls>
          <Scene />
        </Physics>
      </Canvas>

      <Instructions>
        WASD / arrows to drive{'\n'}
        Space to brake{'\n'}
        R to reset
      </Instructions>
    </>
  )
}

useGLTF.preload(racetrackGlbUrl)
