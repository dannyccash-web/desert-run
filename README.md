# Desert Run

A 3D browser racing game with real raycast vehicle physics.

## Stack

- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber) — declarative Three.js in React
- [@react-three/rapier](https://github.com/pmndrs/react-three-rapier) — Rapier physics, including `DynamicRayCastVehicleController` (real suspension, gravity, momentum, friction)
- [Vite](https://vitejs.dev/) — dev server and build

## Controls

| Action | Key |
| --- | --- |
| Accelerate | `W` / `↑` |
| Reverse | `S` / `↓` |
| Steer | `A` `D` / `←` `→` |
| Brake | `Space` |
| Reset | `R` |

## Run locally

```sh
npm install
npm run dev
```

Open http://localhost:5173/desert-run/. The game renders inside a 1920×1080 16:9 frame that letterboxes to fit the browser window.

## Deploy

The repo deploys to GitHub Pages from the `gh-pages` branch.

```sh
npm run build
# copy dist/* to gh-pages branch root
```

## Roadmap

- [x] Real raycast vehicle physics (Rapier)
- [x] Desert ground + scattered rocks
- [x] 1920×1080 letterboxed frame
- [x] Speedometer HUD
- [ ] Better chassis model (replace placeholder box)
- [ ] Engine + tire audio
- [ ] Terrain heightmap
- [ ] Timed quests / power-ups / weapons

## License

MIT.
