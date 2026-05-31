import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { DefaultLoadingManager } from 'three'

export const useLoadingAssets = () => {
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    const orig = DefaultLoadingManager.onProgress
    DefaultLoadingManager.onProgress = (item, loaded, total) => {
      if (typeof orig === 'function') orig(item, loaded, total)
      setProgress((loaded / total) * 100)
    }
    return () => { DefaultLoadingManager.onProgress = orig }
  }, [])
  return progress !== 100
}

export const usePageVisible = () => {
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const on = () => {
      if (document.visibilityState === 'visible') requestAnimationFrame(() => setVisible(true))
      else setVisible(false)
    }
    document.addEventListener('visibilitychange', on)
    return () => document.removeEventListener('visibilitychange', on)
  }, [])
  return visible
}

const INSTRUCTIONS_STYLES: CSSProperties = {
  color: 'white', fontSize: '0.95em',
  left: '4%', position: 'absolute', bottom: '4%',
  lineHeight: '1.5', fontFamily: 'monospace',
  whiteSpace: 'pre', textShadow: '1px 1px 1px black',
  pointerEvents: 'none', zIndex: 10,
}
export const Instructions = ({ children }: { children: ReactNode }) =>
  <div style={INSTRUCTIONS_STYLES}>{children}</div>
