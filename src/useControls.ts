import { useEffect, useRef } from 'react'

export type ControlsState = {
  forward: boolean
  back: boolean
  left: boolean
  right: boolean
  brake: boolean
  reset: boolean
}

const KEY_MAP: Record<string, keyof ControlsState> = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'back',
  ArrowDown: 'back',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  Space: 'brake',
  KeyR: 'reset',
}

const PREVENT_DEFAULT = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'])

const initialState = (): ControlsState => ({
  forward: false,
  back: false,
  left: false,
  right: false,
  brake: false,
  reset: false,
})

export function useControls() {
  const state = useRef<ControlsState>(initialState())

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const k = KEY_MAP[e.code]
      if (!k) return
      if (PREVENT_DEFAULT.has(e.code)) e.preventDefault()
      state.current[k] = true
    }
    const onKeyUp = (e: KeyboardEvent) => {
      const k = KEY_MAP[e.code]
      if (!k) return
      if (PREVENT_DEFAULT.has(e.code)) e.preventDefault()
      state.current[k] = false
    }
    const onBlur = () => {
      state.current = initialState()
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  return state
}
