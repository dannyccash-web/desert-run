import { useFrame } from '@react-three/fiber'
import { CuboidCollider, type RapierRigidBody, RigidBody, useRapier } from '@react-three/rapier'
import { useRef, useState } from 'react'
import * as THREE from 'three'
import {
  initialGearboxState,
  initialPedalState,
  step as physicsStep,
  type GearboxState,
  type PedalState,
} from './PhysicsModel'
import { telemetry } from './store'
import { getSpawn } from './Track'
import { useControls } from './useControls'
import { type WheelInfo, useVehicleController } from './useVehicleController'

const spawn = getSpawn(0.0)

// Chassis: wide flat base, low CoG for stability
const CHASSIS_HALF_EXTENTS: [number, number, number] = [1.0, 0.25, 2.0]
const wheelBase = 1.5
const wheelTrack = 0.9
const wheelY = -0.15
const WHEEL_RADIUS = 0.35

const wheelInfo: Omit<WheelInfo, 'position'> = {
  axleCs: new THREE.Vector3(-1, 0, 0),
  suspensionRestLength: 0.3,
  suspensionStiffness: 30,
  maxSuspensionTravel: 0.4,
  sideFrictionStiffness: 1.0,
  frictionSlip: 2.5,
  radius: WHEEL_RADIUS,
}

// front-left, front-right, rear-left, rear-right
const wheels: WheelInfo[] = [
  { position: new THREE.Vector3(-wheelTrack, wheelY, wheelBase), ...wheelInfo },
  { position: new THREE.Vector3(wheelTrack, wheelY, wheelBase), ...wheelInfo },
  { position: new THREE.Vector3(-wheelTrack, wheelY, -wheelBase), ...wheelInfo },
  { position: new THREE.Vector3(wheelTrack, wheelY, -wheelBase), ...wheelInfo },
]

const cameraOffset = new THREE.Vector3(0, 3.5, -8)
const cameraTargetOffset = new THREE.Vector3(0, 1.0, 0)

const _bodyPos = new THREE.Vector3()
const _camPos = new THREE.Vector3()
const _camTarget = new THREE.Vector3()
const _linvel = new THREE.Vector3()
const _quat = new THREE.Quaternion()

export function Vehicle() {
  const { rapier } = useRapier()
  const controls = useControls()
  const chassisMeshRef = useRef<THREE.Mesh>(null!)
  const chassisBodyRef = useRef<RapierRigidBody>(null!)
  const wheelsRef = useRef<(THREE.Object3D | null)[]>([])

  const { vehicleController } = useVehicleController(chassisBodyRef, wheelsRef, wheels)

  const [pedals] = useState<PedalState>(initialPedalState)
  const [gearbox] = useState<GearboxState>(initialGearboxState)
  const [smoothCamPos] = useState(new THREE.Vector3(0, 5, -12))
  const [smoothCamTarget] = useState(new THREE.Vector3())

  useFrame((state, delta) => {
    const controller = vehicleController.current
    if (!controller || !chassisMeshRef.current) return
    const chassisBody = controller.chassis()
    const k = controls.current
    const dt = Math.min(delta, 1 / 30) // cap dt for stability
    const nowMs = state.clock.elapsedTime * 1000

    // Sample a driven (rear) wheel's angular velocity. Rapier doesn't expose this
    // cleanly, so we derive it from the vehicle's forward speed projected onto
    // chassis local -Z (wheel rotation matches ground-speed at the contact point).
    const v = chassisBody.linvel()
    const linvel = _linvel.set(v.x, v.y, v.z)
    const q = chassisBody.rotation()
    _quat.set(q.x, q.y, q.z, q.w)
    const forwardWorld = new THREE.Vector3(0, 0, 1).applyQuaternion(_quat)
    const forwardSpeed = linvel.dot(forwardWorld)
    const wheelAngVel = forwardSpeed / WHEEL_RADIUS

    // Run the realistic physics layer
    const sim = physicsStep(k, pedals, gearbox, wheelAngVel, linvel, _quat, WHEEL_RADIUS, dt, nowMs)

    // Apply to Rapier: engine force on rear wheels, brakes split front/rear, steering on fronts
    controller.setWheelEngineForce(2, sim.engineForce)
    controller.setWheelEngineForce(3, sim.engineForce)
    controller.setWheelBrake(0, sim.brakeFront)
    controller.setWheelBrake(1, sim.brakeFront)
    controller.setWheelBrake(2, sim.brakeRear)
    controller.setWheelBrake(3, sim.brakeRear)
    controller.setWheelSteering(0, sim.steerRad)
    controller.setWheelSteering(1, sim.steerRad)

    // Reset on R or out of world
    const t = chassisBody.translation()
    if (k.reset || t.y < -10 || t.y > 80) {
      chassisBody.setTranslation(new rapier.Vector3(...spawn.position), true)
      const sq = new THREE.Quaternion().setFromEuler(new THREE.Euler(...spawn.rotation))
      chassisBody.setRotation(sq, true)
      chassisBody.setLinvel(new rapier.Vector3(0, 0, 0), true)
      chassisBody.setAngvel(new rapier.Vector3(0, 0, 0), true)
      pedals.throttle = 0
      pedals.brake = 0
      pedals.steerRad = 0
      gearbox.gear = 1
      gearbox.lastShiftAt = 0
    }

    // Telemetry
    telemetry.speedKph = linvel.length() * 3.6
    telemetry.rpm = sim.rpm
    telemetry.gear = sim.gear
    telemetry.throttle = pedals.throttle
    telemetry.brake = pedals.brake

    // Chase camera
    const bodyMatrix = chassisMeshRef.current.matrixWorld
    _camPos.copy(cameraOffset).applyMatrix4(bodyMatrix)
    _camPos.y = Math.max(_camPos.y, chassisBody.translation().y + 2)

    const blend = 1.0 - Math.pow(0.001, dt)
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
      <CuboidCollider args={CHASSIS_HALF_EXTENTS} mass={1500} />
      <mesh ref={chassisMeshRef} castShadow>
        <boxGeometry args={[CHASSIS_HALF_EXTENTS[0] * 2, CHASSIS_HALF_EXTENTS[1] * 2, CHASSIS_HALF_EXTENTS[2] * 2]} />
        <meshStandardMaterial color="#e23d3d" metalness={0.4} roughness={0.4} />
      </mesh>
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
