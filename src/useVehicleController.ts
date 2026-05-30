import type { DynamicRayCastVehicleController } from '@dimforge/rapier3d-compat'
import { type RapierRigidBody, useAfterPhysicsStep, useRapier } from '@react-three/rapier'
import { type RefObject, useEffect, useRef } from 'react'
import * as THREE from 'three'

const up = new THREE.Vector3(0, 1, 0)
const _wheelSteeringQuat = new THREE.Quaternion()
const _wheelRotationQuat = new THREE.Quaternion()

export type WheelInfo = {
  axleCs: THREE.Vector3
  suspensionRestLength: number
  suspensionStiffness: number
  maxSuspensionTravel: number
  frictionSlip: number
  sideFrictionStiffness: number
  position: THREE.Vector3
  radius: number
}

export const useVehicleController = (
  chassisRef: RefObject<RapierRigidBody | null>,
  wheelsRef: RefObject<(THREE.Object3D | null)[]>,
  wheelsInfo: WheelInfo[],
) => {
  const { world } = useRapier()
  const vehicleController = useRef<DynamicRayCastVehicleController | null>(null)

  useEffect(() => {
    const chassis = chassisRef.current
    if (!chassis) return

    const vehicle = world.createVehicleController(chassis)
    const suspensionDirection = new THREE.Vector3(0, -1, 0)

    for (const [i, w] of wheelsInfo.entries()) {
      vehicle.addWheel(w.position, suspensionDirection, w.axleCs, w.suspensionRestLength, w.radius)
      vehicle.setWheelSuspensionStiffness(i, w.suspensionStiffness)
      vehicle.setWheelMaxSuspensionTravel(i, w.maxSuspensionTravel)
      vehicle.setWheelFrictionSlip(i, w.frictionSlip)
      vehicle.setWheelSideFrictionStiffness(i, w.sideFrictionStiffness)
    }

    vehicleController.current = vehicle
    return () => {
      vehicleController.current = null
      world.removeVehicleController(vehicle)
    }
  }, [chassisRef, wheelsInfo, wheelsRef, world])

  useAfterPhysicsStep((w) => {
    const controller = vehicleController.current
    if (!controller) return
    controller.updateVehicle(w.timestep)

    const wheels = wheelsRef.current
    if (!wheels) return

    for (let i = 0; i < wheels.length; i++) {
      const wheel = wheels[i]
      if (!wheel) continue
      const wheelAxleCs = controller.wheelAxleCs(i)!
      const connection = controller.wheelChassisConnectionPointCs(i)?.y || 0
      const suspension = controller.wheelSuspensionLength(i) || 0
      const steering = controller.wheelSteering(i) || 0
      const rotationRad = controller.wheelRotation(i) || 0

      wheel.position.y = connection - suspension
      _wheelSteeringQuat.setFromAxisAngle(up, steering)
      _wheelRotationQuat.setFromAxisAngle(wheelAxleCs as unknown as THREE.Vector3, rotationRad)
      wheel.quaternion.multiplyQuaternions(_wheelSteeringQuat, _wheelRotationQuat)
    }
  })

  return { vehicleController }
}
