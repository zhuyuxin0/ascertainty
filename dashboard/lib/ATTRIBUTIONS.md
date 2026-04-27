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

## Classic Muscle Car — Sketchfab (CC-BY-4.0)

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
