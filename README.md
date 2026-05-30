# Desert Run

A 3D browser-based racing game. Built on top of [@pmndrs/racing-game](https://github.com/pmndrs/racing-game) (MIT).

## Stack

- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber) — declarative Three.js in React
- [@react-three/cannon](https://github.com/pmndrs/use-cannon) — Cannon-es physics (raycast vehicle: real suspension, gravity, momentum)
- [Zustand](https://github.com/pmndrs/zustand) — state
- [Vite](https://vitejs.dev/) — dev server and build

## Running locally

```sh
npm install
npm run dev
```

Open http://localhost:5173. The game renders inside a 1920×1080 16:9 frame that scales (letterboxes) to fit the browser window.

## Roadmap

- [x] Working physics-driven car in a customizable scene
- [ ] Desert terrain + props
- [ ] Engine / brake / skid audio
- [ ] Drifting feel
- [ ] Timed quests
- [ ] Power-ups
- [ ] Weapons

## License

MIT. Original work by the @pmndrs racing-game contributors; see `LICENSE.md`.
