# Open Source Attributions

The Ascertainty dashboard's racing visualization is adapted from open
source projects. This document records the attributions required by
those licenses.

## pmndrs/racing-game (MIT)

Source: https://github.com/pmndrs/racing-game
License: MIT

The `RaycastVehicle` setup pattern in
`dashboard/components/Vehicle.tsx` (chassis + 4 wheels + steering / engine
force / brake mapping) follows the architecture of
`pmndrs/racing-game/src/models/vehicle/Vehicle.tsx`. The Ascertainty
implementation is a fresh, minimal port — no audio, no dust effects, no
store coupling, geometric chassis instead of GLTF — but the wheel-info
construction (front/back distinction, chassisConnectionPointLocal) and
the engine/steering/brake API call sequence are recognizably the same
as the pmndrs reference.

```
MIT License

Copyright (c) 2021 Poimandres

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## @react-three/* ecosystem (MIT)

`@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`,
`@react-three/cannon` — all MIT, all @ Poimandres. Used as published
npm packages, listed in `dashboard/package.json`.

## three.js (MIT)

Used as published. https://github.com/mrdoob/three.js

## Kenney Car Kit (CC0)

Source: https://kenney.nl/assets/car-kit
Author: Kenney (https://kenney.nl)
License: **CC0 1.0 Universal** — public domain dedication, no attribution required (this entry is for documentation only)

Used as the primary car GLBs in `dashboard/public/models/cars/`:
- `race-future.glb` (futuristic open-wheel racer)
- `race.glb` (classic open-wheel racer)
- `sedan-sports.glb` (sporty sedan)
- `wheel-racing.glb` (extra wheel asset)

The `RaceCarKenney` component clones each model per car instance and tints the body panel material with the solver's brand color. Headlights and glass are emissive-tinted to bloom-friendly intensity.

## Bruno Simon — folio-2019 (MIT)

Source: https://github.com/brunosimon/folio-2019
Author: Bruno Simon (https://bruno-simon.com)
License: MIT

The fullscreen 4-corner gradient backdrop in `dashboard/components/BrunoFloor.tsx` is a direct port of `src/javascript/World/Floor.js` + `src/shaders/floor/{vertex,fragment}.glsl`, recolored to a cyberpunk palette (cyan/dark/black/amber). The per-object fake shadow plane in `dashboard/components/FakeShadow.tsx` is inspired by `src/javascript/World/Shadows.js` (radial gradient texture, alpha falloff by distance), simplified for our kinematic cars.

```
MIT License
Copyright (c) 2019 Bruno SIMON
[full text omitted; standard MIT terms apply]
```

## PolyHaven — Rooftop Night HDRI (CC0)

Source: https://polyhaven.com/a/rooftop_night
License: CC0 (no attribution required)
Path: `dashboard/public/hdri/rooftop_night_2k.exr`

Used as the `Environment` IBL for car body reflections in the race scene (Day 2 work).

## Classic Muscle Car — Sketchfab (CC-BY-4.0)

(No longer used — replaced by Kenney Car Kit. Kept here as historical record since the GLB was committed in an earlier branch.)

Source: https://sketchfab.com/3d-models/classic-muscle-car-641efc889e5f4543bae51d0922e6f4b3
Author: Alexus16 (https://sketchfab.com/Alexus16)
License: CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)

Used as the chassis + wheel GLTF assets in
`dashboard/public/models/chassis-draco.glb` and
`dashboard/public/models/wheel-draco.glb`. The body paint material is
tinted per car instance (one solver = one color); all other materials
(chrome, glass, brake lights, undercarriage) are stock from the model.

The draco-compressed `.glb` files are byte-for-byte identical to the
versions distributed in the open-source pmndrs/racing-game repo (MIT)
under `public/models/`, which itself attributed them to Alexus16.

Per CC-BY-4.0: this attribution is required when using the model in a
public-facing demo. No further restrictions on commercial use or
modification.
