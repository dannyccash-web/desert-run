// Realistic-feel layer on top of Rapier's raycast vehicle.
// Inspired by VitaVehicle (RCP2) — engine torque curve, gearbox with auto-shift,
// ramped pedals, speed-sensitive steering with counter-steer assist.

import * as THREE from 'three'

// ---------- Engine ----------
// Continuous torque curve. At a given RPM:
//   base    = rpm * BuildUpTorque + OffsetTorque
//   risePart = max(0, rpm - RiseRPM)^2 * TorqueRise / 1e7
//   decline = 1 + max(0, rpm - DeclineRPM)^2 * DeclineRate / 1e7
//   float   = 1 + rpm^2 * FloatRate / 1e7
//   torque  = ((base + risePart) * throttle) / (decline * float)

export const Engine = {
  idleRPM: 800,
  rpmLimit: 7000,
  buildUpTorque: 0.0035,
  offsetTorque: 110,
  torqueRise: 30,
  riseRPM: 1000,
  declineRPM: 3500,
  declineRate: 1.5,
  floatRate: 0.1,
  // Empirical multiplier that maps the VitaVehicle torque scale to Rapier wheel-force.
  // ~9.5 (their RatioMult) × a wheel-radius/inertia fudge.
  outputScale: 1,
  // Off-throttle resistance — engine braking
  engineBrakingScale: 80,
}

export function engineTorque(rpm: number, throttle: number) {
  const r = Math.max(0, rpm)
  const f = Math.max(0, r - Engine.riseRPM)
  const base = r * Engine.buildUpTorque + Engine.offsetTorque
  const rise = (f * f * Engine.torqueRise) / 1e7
  const declineF = Math.max(0, r - Engine.declineRPM)
  const decline = 1 + (declineF * declineF * Engine.declineRate) / 1e7
  const floatT = 1 + (r * r * Engine.floatRate) / 1e7
  const t = ((base + rise) * throttle) / (decline * floatT)
  return Math.max(0, t)
}

// ---------- Gearbox ----------
export const Gearbox = {
  finalDrive: 4.25,
  // VitaVehicle ratios (1st..5th)
  gearRatios: [3.250, 1.894, 1.259, 0.937, 0.771],
  reverseRatio: -3.153,
  // Auto shift thresholds
  upshiftRPM: 5500,
  downshiftRPM: 1500,
  shiftCooldownMs: 350,
}

export type GearboxState = {
  gear: number // -1 reverse, 0 neutral, 1..N forward
  lastShiftAt: number
  // Smoothed throttle cut during a shift, 0..1 (1 = full engagement)
  clutch: number
}

export function gearRatio(g: number) {
  if (g === 0) return 0
  if (g === -1) return Gearbox.reverseRatio
  return Gearbox.gearRatios[g - 1]
}

// Compute engine RPM from wheel angular velocity (rad/s) and current gear.
// When the clutch is disengaged or in neutral, engine free-revs toward throttle.
export function rpmFromWheel(wheelAngVel: number, g: number) {
  const ratio = gearRatio(g)
  if (ratio === 0) return Engine.idleRPM
  // wheel rev/s × ratio × finalDrive → engine rev/s → ×60 for rpm
  const engineRevPerSec = (Math.abs(wheelAngVel) / (2 * Math.PI)) * Math.abs(ratio) * Gearbox.finalDrive
  return Math.max(Engine.idleRPM, engineRevPerSec * 60)
}

export function tryAutoShift(state: GearboxState, rpm: number, throttleInput: number, brakeInput: number, vehicleSpeedMps: number, nowMs: number) {
  if (nowMs - state.lastShiftAt < Gearbox.shiftCooldownMs) return

  // Reverse handling: stationary + brake held + no throttle → reverse
  // Stationary + throttle held + reverse engaged → 1st
  const stationary = vehicleSpeedMps < 1.0
  if (stationary && brakeInput > 0.5 && throttleInput < 0.1 && state.gear >= 0) {
    state.gear = -1
    state.lastShiftAt = nowMs
    return
  }
  if (stationary && throttleInput > 0.5 && state.gear < 1) {
    state.gear = 1
    state.lastShiftAt = nowMs
    return
  }

  if (state.gear < 1) return // no auto upshift from reverse/neutral

  if (rpm > Gearbox.upshiftRPM && state.gear < Gearbox.gearRatios.length) {
    state.gear += 1
    state.lastShiftAt = nowMs
  } else if (rpm < Gearbox.downshiftRPM && state.gear > 1) {
    state.gear -= 1
    state.lastShiftAt = nowMs
  }
}

// ---------- Pedals (input ramping) ----------
// Pedals don't snap — they ramp toward target each tick.
// Rates are per-second (we multiply by dt).
export const Pedals = {
  onThrottleRate: 6.0,
  offThrottleRate: 5.0,
  onBrakeRate: 8.0,
  offBrakeRate: 7.0,
}

export function rampPedal(current: number, target: number, dt: number, onRate: number, offRate: number) {
  const rate = target > current ? onRate : offRate
  const step = rate * dt
  if (Math.abs(target - current) <= step) return target
  return current + Math.sign(target - current) * step
}

// ---------- Steering ----------
// Speed-sensitive maximum steering angle: full lock at low speed,
// reduced toward minSteerFraction at top speed.
export const Steering = {
  maxAngleRad: Math.PI / 6.5,         // ~27° at low speed
  minSteerFraction: 0.30,              // at high speed, only 30% of max
  speedForFullDecay: 35,               // m/s ≈ 126 km/h
  rateRad: 3.2,                        // rad/s while pushing direction
  returnRateRad: 5.5,                  // rad/s when releasing
  reverseRateMult: 2.0,                // snappier when reversing input direction
  // Counter-steer assist — gently nudge steering toward correcting lateral slip
  assistGain: 0.07,
}

export function updateSteering(currentRad: number, dir: number, speedMps: number, lateralSpeedMps: number, dt: number) {
  const speedFactor = Math.min(1, speedMps / Steering.speedForFullDecay)
  const maxAngle = Steering.maxAngleRad * (1 - speedFactor * (1 - Steering.minSteerFraction))
  const target = dir * maxAngle

  // Choose rate
  let rate: number
  if (dir === 0) {
    rate = Steering.returnRateRad
  } else if (Math.sign(currentRad) !== Math.sign(target) && Math.abs(currentRad) > 0.05) {
    rate = Steering.rateRad * Steering.reverseRateMult
  } else {
    rate = Steering.rateRad
  }

  let next = currentRad
  const step = rate * dt
  if (Math.abs(target - currentRad) <= step) next = target
  else next = currentRad + Math.sign(target - currentRad) * step

  // Tiny counter-steer assist: if the body is sliding sideways, nudge steering to recover
  next += -lateralSpeedMps * Steering.assistGain * dt

  if (next > maxAngle) next = maxAngle
  if (next < -maxAngle) next = -maxAngle
  return next
}

// ---------- Brake bias ----------
// 60% front, 40% rear (typical road car bias)
export const BrakeBias = { front: 0.6, rear: 0.4 }
export const MaxBrakeForce = 1.5 // Rapier wheel-brake units per wheel

// ---------- Aero drag ----------
// A tiny linear drag in the chassis longitudinal direction so the car
// doesn't accelerate to infinity.
export const Aero = { linear: 0.6 }

// ---------- High-level update ----------
export type PedalState = {
  throttle: number
  brake: number
  steerRad: number
}

export type ControlInputs = {
  forward: boolean
  back: boolean
  left: boolean
  right: boolean
  brake: boolean
}

export const initialPedalState = (): PedalState => ({ throttle: 0, brake: 0, steerRad: 0 })
export const initialGearboxState = (): GearboxState => ({ gear: 1, lastShiftAt: 0, clutch: 1 })

export type Telemetry = {
  rpm: number
  gear: number
  speedKph: number
  throttle: number
  brake: number
}

const _v = new THREE.Vector3()
const _forward = new THREE.Vector3()
const _lateral = new THREE.Vector3()

export type SimResult = {
  engineForce: number
  brakeFront: number
  brakeRear: number
  steerRad: number
  rpm: number
  gear: number
}

export function step(
  inputs: ControlInputs,
  pedals: PedalState,
  gearbox: GearboxState,
  wheelAngVel: number,  // rad/s of a driven wheel (signed: + = forward)
  worldLinVel: THREE.Vector3,
  chassisQuat: THREE.Quaternion,
  wheelRadius: number,
  dt: number,
  nowMs: number,
): SimResult {
  // 1. Ramp pedals — directional. In reverse gear, the "back" key becomes
  // throttle and "forward" becomes brake.
  const inReverse = gearbox.gear === -1
  const throttleTarget = (inReverse ? inputs.back : inputs.forward) ? 1 : 0
  const brakeTarget = inputs.brake ? 1 : ((inReverse ? inputs.forward : inputs.back) ? 1 : 0)
  pedals.throttle = rampPedal(pedals.throttle, throttleTarget, dt, Pedals.onThrottleRate, Pedals.offThrottleRate)
  pedals.brake = rampPedal(pedals.brake, brakeTarget, dt, Pedals.onBrakeRate, Pedals.offBrakeRate)

  // 2. Project velocity into chassis local space
  _forward.set(0, 0, 1).applyQuaternion(chassisQuat)
  _lateral.set(1, 0, 0).applyQuaternion(chassisQuat)
  const forwardSpeed = _v.copy(worldLinVel).dot(_forward)
  const lateralSpeed = _v.copy(worldLinVel).dot(_lateral)
  const speedMps = worldLinVel.length()

  // 3. Compute engine RPM
  const rpm = Math.min(Engine.rpmLimit, rpmFromWheel(wheelAngVel, gearbox.gear))

  // 4. Auto-shift
  tryAutoShift(gearbox, rpm, pedals.throttle, pedals.brake, forwardSpeed, nowMs)
  // Clutch eases torque during the cooldown window after a shift
  const sinceShift = nowMs - gearbox.lastShiftAt
  gearbox.clutch = Math.min(1, sinceShift / Gearbox.shiftCooldownMs)

  // 5. Engine torque (idle = at least some torque to keep car alive)
  let torque = engineTorque(rpm, Math.max(pedals.throttle, rpm < Engine.idleRPM * 1.1 ? 0.08 : 0))

  // 6. RPM limiter — cut torque when over limit
  if (rpm >= Engine.rpmLimit) torque = 0

  // 7. Map torque → wheel force via gear ratio
  const ratio = gearRatio(gearbox.gear)
  const driveForce = (torque * ratio * Gearbox.finalDrive * gearbox.clutch * Engine.outputScale) / wheelRadius

  // 8. Engine braking: when off-throttle and in gear, apply a small reverse force
  let engineBrake = 0
  if (pedals.throttle < 0.05 && gearbox.gear !== 0 && Math.abs(forwardSpeed) > 0.5) {
    engineBrake = Math.sign(forwardSpeed) * (rpm / Engine.rpmLimit) * Engine.outputScale * Engine.engineBrakingScale
  }

  // 9. Aero drag (mild linear damping along chassis forward axis)
  const aeroForce = -forwardSpeed * Aero.linear

  const engineForce = driveForce - engineBrake + aeroForce

  // 10. Steering
  const dir = (inputs.left ? 1 : 0) - (inputs.right ? 1 : 0)
  pedals.steerRad = updateSteering(pedals.steerRad, dir, Math.abs(forwardSpeed), lateralSpeed, dt)

  // 11. Brakes — front bias
  const brakeFront = pedals.brake * MaxBrakeForce * BrakeBias.front
  const brakeRear = pedals.brake * MaxBrakeForce * BrakeBias.rear

  return {
    engineForce,
    brakeFront,
    brakeRear,
    steerRad: pedals.steerRad,
    rpm,
    gear: gearbox.gear,
  }
}
