import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

type Props = { top?: string; horizon?: string }

/** Sets scene.background to a vertical canvas-gradient texture. */
export function SkyGradient({ top = '#1d62b8', horizon = '#bedcf5' }: Props) {
  const { scene } = useThree()

  const texture = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 2
    c.height = 1024
    const ctx = c.getContext('2d')!
    const g = ctx.createLinearGradient(0, 0, 0, c.height)
    g.addColorStop(0.0, top)
    g.addColorStop(0.6, '#6fa8dc')
    g.addColorStop(1.0, horizon)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, c.width, c.height)
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [top, horizon])

  useEffect(() => {
    const prev = scene.background
    scene.background = texture
    return () => {
      scene.background = prev
      texture.dispose()
    }
  }, [scene, texture])

  return null
}
