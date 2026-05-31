import { useEffect, useState } from 'react'
import { telemetry } from './store'

function formatGear(g: number) {
  if (g === -1) return 'R'
  if (g === 0) return 'N'
  return String(g)
}

export function HUD() {
  const [t, setT] = useState({ speedKph: 0, rpm: 800, gear: 1 })

  useEffect(() => {
    let raf = 0
    const tick = () => {
      setT({
        speedKph: telemetry.speedKph,
        rpm: telemetry.rpm,
        gear: telemetry.gear,
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const rpmPct = Math.min(100, (t.rpm / 7000) * 100)
  const rpmRed = t.rpm > 5500
  return (
    <>
      <div className="speedometer">
        <div className="gear">Gear <span>{formatGear(t.gear)}</span></div>
        <div className="value">{Math.round(t.speedKph)}</div>
        <div className="unit">KPH</div>
        <div className="rpm-bar"><div className="rpm-fill" style={{ width: `${rpmPct}%`, background: rpmRed ? '#ff4040' : '#f4c83f' }} /></div>
        <div className="rpm-text">{Math.round(t.rpm).toLocaleString()} RPM</div>
      </div>
      <div className="controls-hint">
        <div><kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> or arrows</div>
        <div><kbd>Space</kbd> brake</div>
        <div><kbd>R</kbd> reset</div>
        <div style={{ marginTop: 8, opacity: 0.6 }}>Automatic transmission</div>
      </div>
    </>
  )
}
