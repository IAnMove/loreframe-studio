import type { Scene3DCamera, Vec3 } from './types.ts'

export function vecAdd(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}

export function vecSub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

export function vecScale(a: Vec3, s: number): Vec3 {
  return [a[0] * s, a[1] * s, a[2] * s]
}

export function vecDot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

export function vecCross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}

export function vecLength(a: Vec3): number {
  return Math.hypot(a[0], a[1], a[2])
}

export function vecNormalize(a: Vec3): Vec3 {
  const len = vecLength(a)
  if (len < 1e-8) return [0, 1, 0]
  return vecScale(a, 1 / len)
}

export function orbitEye(look: Vec3, radius: number, height: number, azimuthRad: number): Vec3 {
  const r = Number.isFinite(radius) && radius > 0 ? radius : 4
  const h = Number.isFinite(height) ? height : 1.6
  return [
    look[0] + Math.sin(azimuthRad) * r,
    look[1] + h,
    look[2] + Math.cos(azimuthRad) * r,
  ]
}

export function cameraEyeAtTime(camera: Scene3DCamera, sceneSeconds: number, duration: number): Vec3 {
  if (camera.family !== 'orbit') return camera.eye
  const turns = Number.isFinite(camera.orbitTurns) ? camera.orbitTurns! : 1
  const span = duration > 1e-6 ? duration : 1
  const azimuth = (sceneSeconds / span) * turns * Math.PI * 2
  return orbitEye(camera.look, camera.orbitRadius ?? 4, camera.orbitHeight ?? 1.6, azimuth)
}

export function projectPoint(
  point: Vec3,
  eye: Vec3,
  look: Vec3,
  fovDeg: number,
  aspect: number,
): { x: number; y: number; depth: number } | null {
  const forward = vecNormalize(vecSub(look, eye))
  const worldUp: Vec3 = [0, 1, 0]
  let right = vecCross(forward, worldUp)
  if (vecLength(right) < 1e-6) right = [1, 0, 0]
  right = vecNormalize(right)
  const up = vecNormalize(vecCross(right, forward))
  const rel = vecSub(point, eye)
  const camX = vecDot(rel, right)
  const camY = vecDot(rel, up)
  const camZ = vecDot(rel, forward)
  if (camZ <= 1e-4) return null
  const fov = (Number.isFinite(fovDeg) && fovDeg > 1 ? fovDeg : 50) * Math.PI / 180
  const f = 1 / Math.tan(fov / 2)
  const ndcX = (camX * f) / (aspect * camZ)
  const ndcY = (camY * f) / camZ
  return { x: (ndcX + 1) / 2, y: 1 - (ndcY + 1) / 2, depth: camZ }
}
