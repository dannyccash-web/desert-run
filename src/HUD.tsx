import { useEffect, useState } from 'react'
import { telemetry } from './store'

export function HUD() {
  const [speed, setSpeed] = useState(0)

  useEffect(() => {
    let raf = 0
    const tick = () => {
      setSpeed(Math.round(telemetry.speedKph))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <>
      <div className="speedometer">
        <div className="value">{speed}</div>
        <div className="unit">KPH</div>
      </div>
      <div className="controls-hint">
        <div><kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> drive</div>
        <div><kbd>Space</kbd> brake</div>
        <div><kbd>R</kbd> reset</div>
      </div>
    </>
  )
}
