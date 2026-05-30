import { KeyboardControls, useKeyboardControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { CuboidCollider, type RapierRigidBody, RigidBody, useRapier } from '@react-three/rapier'
import { useRef, useState } from 'react'
import * as THREE from 'three'
import { telemetry } from './store'
import { type WheelInfo, useVehicleController } from './useVehicleController'

export const keyboardControlsMap = [
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

const spawn = {
  position: [0, 2, 0] as [number, number, number],
  rotation: [0, 0, 0] as [number, number, number],
}

// Vehicle tuning
const CHASSIS_HALF_EXTENTS: [number, number, number] = [1.0, 0.25, 2.0] // wide, short, long
const wheelBase = 1.5
const wheelTrack = 0.9
const wheelY = -0.15

const wheelInfo: Omit<WheelInfo, 'position'> = {
  axleCs: new THREE.Vector3(-1, 0, 0),
  suspensionRestLength: 0.3,
  suspensionStiffness: 30,
  maxSuspensionTravel: 0.4,
  sideFrictionStiffness: 1.0,
  frictionSlip: 2.5,
  radius: 0.35,
}

const wheels: WheelInfo[] = [
  // front-left, front-right, rear-left, rear-right
  { position: new THREE.Vector3(-wheelTrack, wheelY, wheelBase), ...wheelInfo },
  { position: new THREE.Vector3(wheelTrack, wheelY, wheelBase), ...wheelInfo },
  { position: new THREE.Vector3(-wheelTrack, wheelY, -wheelBase), ...wheelInfo },
  { position: new THREE.Vector3(wheelTrack, wheelY, -wheelBase), ...wheelInfo },
]

const ACCEL_FORCE = 80
const BRAKE_FORCE = 4
const STEER_ANGLE = Math.PI / 7

const cameraOffset = new THREE.Vector3(0, 3.5, -8)
const cameraTargetOffset = new THREE.Vector3(0, 1.0, 0)

const _bodyPos = new THREE.Vector3()
const _camPos = new THREE.Vector3()
const _camTarget = new THREE.Vector3()
const _linvel = new THREE.Vector3()

function VehicleInner() {
  const { rapier } = useRapier()
  const [, getKeys] = useKeyboardControls<keyof KeyControls>()
  const chassisMeshRef = useRef<THREE.Mesh>(null!)
  const chassisBodyRef = useRef<RapierRigidBody>(null!)
  const wheelsRef = useRef<(THREE.Object3D | null)[]>([])

  const { vehicleController } = useVehicleController(chassisBodyRef, wheelsRef, wheels)

  const [smoothCamPos] = useState(new THREE.Vector3(0, 5, -12))
  const [smoothCamTarget] = useState(new THREE.Vector3())

  useFrame((state, delta) => {
    const controller = vehicleController.current
    if (!controller || !chassisMeshRef.current) return
    const chassisBody = controller.chassis()
    const controls = getKeys()

    // engine force on rear wheels
    const engineForce = (Number(controls.forward) - Number(controls.back)) * ACCEL_FORCE
    controller.setWheelEngineForce(2, engineForce)
    controller.setWheelEngineForce(3, engineForce)

    // brake (all wheels)
    const brake = Number(controls.brake) * BRAKE_FORCE
    for (let i = 0; i < 4; i++) controller.setWheelBrake(i, brake)

    // steering on front wheels
    const steerDir = Number(controls.left) - Number(controls.right)
    const currentSteer = controller.wheelSteering(0) || 0
    const steering = THREE.MathUtils.lerp(currentSteer, STEER_ANGLE * steerDir, 0.25)
    controller.setWheelSteering(0, steering)
    controller.setWheelSteering(1, steering)

    // reset on R or if launched too high
    const t = chassisBody.translation()
    if (controls.reset || t.y < -10 || t.y > 80) {
      chassisBody.setTranslation(new rapier.Vector3(...spawn.position), true)
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...spawn.rotation))
      chassisBody.setRotation(q, true)
      chassisBody.setLinvel(new rapier.Vector3(0, 0, 0), true)
      chassisBody.setAngvel(new rapier.Vector3(0, 0, 0), true)
    }

    // telemetry: speed in kph
    const v = chassisBody.linvel()
    const speed = _linvel.set(v.x, v.y, v.z).length()
    telemetry.speedKph = speed * 3.6

    // follow camera: chase position is behind the car along its forward axis
    const bodyMatrix = chassisMeshRef.current.matrixWorld
    _camPos.copy(cameraOffset).applyMatrix4(bodyMatrix)
    _camPos.y = Math.max(_camPos.y, chassisBody.translation().y + 2)

    const blend = 1.0 - Math.pow(0.001, delta)
    smoothCamPos.lerp(_camPos, blend)
    state.camera.position.copy(smoothCamPos)

    chassisMeshRef.current.getWorldPosition(_bodyPos)
    _camTarget.copy(_bodyPos).add(cameraTargetOffset)
    smoothCamTarget.lerp(_camTarget, blend)
    state.camera.lookAt(smoothCamTarget)
  })

  return (
    <RigidBody
      ref={chassisBodyRef}
      position={spawn.position}
      rotation={spawn.rotation}
      type="dynamic"
      colliders={false}
      canSleep={false}
      mass={1}
    >
      {/* Mass concentrated low for stability */}
      <CuboidCollider args={CHASSIS_HALF_EXTENTS} mass={1500} />
      <mesh ref={chassisMeshRef} castShadow>
        <boxGeometry args={[CHASSIS_HALF_EXTENTS[0] * 2, CHASSIS_HALF_EXTENTS[1] * 2, CHASSIS_HALF_EXTENTS[2] * 2]} />
        <meshStandardMaterial color="#e23d3d" metalness={0.4} roughness={0.4} />
      </mesh>
      {/* Cabin */}
      <mesh position={[0, CHASSIS_HALF_EXTENTS[1] + 0.25, -0.3]} castShadow>
        <boxGeometry args={[1.6, 0.5, 1.8]} />
        <meshStandardMaterial color="#7a1b1b" metalness={0.5} roughness={0.3} />
      </mesh>
      {wheels.map((w, i) => (
        <group
          key={i}
          ref={(ref) => {
            if (wheelsRef.current) wheelsRef.current[i] = ref
          }}
          position={w.position}
        >
          <group rotation={[0, 0, Math.PI / 2]}>
            <mesh castShadow>
              <cylinderGeometry args={[w.radius, w.radius, 0.3, 24]} />
              <meshStandardMaterial color="#1a1a1a" roughness={0.9} />
            </mesh>
            <mesh>
              <cylinderGeometry args={[w.radius * 0.55, w.radius * 0.55, 0.31, 16]} />
              <meshStandardMaterial color="#888" metalness={0.8} roughness={0.3} />
            </mesh>
          </group>
        </group>
      ))}
    </RigidBody>
  )
}

export function Vehicle() {
  return (
    <KeyboardControls map={keyboardControlsMap}>
      <VehicleInner />
    </KeyboardControls>
  )
}
