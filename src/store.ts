// Simple shared mutable state for cross-component HUD updates without re-renders.
// HUD polls this each frame via requestAnimationFrame.
export const telemetry = {
  speedKph: 0,
}
