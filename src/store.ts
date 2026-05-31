// Shared mutable state for cross-component HUD updates without re-renders.
// HUD polls this each frame via requestAnimationFrame.
export const telemetry = {
  speedKph: 0,
  rpm: 800,
  gear: 1,
  throttle: 0,
  brake: 0,
}
