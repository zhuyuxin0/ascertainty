"use client";

import { useMemo } from "react";
import * as THREE from "three";

/**
 * Fullscreen background gradient plane. Ported from
 * brunosimon/folio-2019/src/javascript/World/Floor.js + shaders/floor/.
 *
 * The plane sits in clip space (z=1) so it's drawn before everything
 * else as a 4-corner gradient backdrop. A 2x2 DataTexture with
 * LinearFilter gives smooth interpolation across the entire screen.
 *
 * Bruno's writeup quote: "A simple 2x2 texture created directly in JS
 * is sent and the shaders uses the UVs to color each corner." This is
 * ~70% of the mood.
 */

const VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 newPosition = position;
    newPosition.z = 1.0;
    gl_Position = vec4(newPosition, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  uniform sampler2D tBackground;
  varying vec2 vUv;
  void main() {
    gl_FragColor = texture2D(tBackground, vUv);
  }
`;

type FloorColors = {
  topLeft: string;
  topRight: string;
  bottomRight: string;
  bottomLeft: string;
};

const CYBERPUNK: FloorColors = {
  topLeft: "#04323b",      // deep cyan
  topRight: "#0c0c20",     // dark blue-black
  bottomRight: "#080812",  // near-black
  bottomLeft: "#1f0a05",   // dark amber
};

export function BrunoFloor({ colors = CYBERPUNK }: { colors?: FloorColors }) {
  const { material, geometry } = useMemo(() => {
    const tl = new THREE.Color(colors.topLeft).convertLinearToSRGB();
    const tr = new THREE.Color(colors.topRight).convertLinearToSRGB();
    const br = new THREE.Color(colors.bottomRight).convertLinearToSRGB();
    const bl = new THREE.Color(colors.bottomLeft).convertLinearToSRGB();

    const data = new Uint8Array([
      Math.round(bl.r * 255), Math.round(bl.g * 255), Math.round(bl.b * 255), 255,
      Math.round(br.r * 255), Math.round(br.g * 255), Math.round(br.b * 255), 255,
      Math.round(tl.r * 255), Math.round(tl.g * 255), Math.round(tl.b * 255), 255,
      Math.round(tr.r * 255), Math.round(tr.g * 255), Math.round(tr.b * 255), 255,
    ]);
    const tex = new THREE.DataTexture(data, 2, 2);
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;

    const material = new THREE.ShaderMaterial({
      uniforms: { tBackground: { value: tex } },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: false,
      depthTest: false,
      depthWrite: false,
    });

    const geometry = new THREE.PlaneGeometry(2, 2, 1, 1);
    return { material, geometry };
  }, [colors]);

  return (
    <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={-1000} />
  );
}
