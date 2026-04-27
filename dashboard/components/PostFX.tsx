"use client";

import {
  EffectComposer,
  Bloom,
  Vignette,
  ChromaticAberration,
  BrightnessContrast,
  HueSaturation,
} from "@react-three/postprocessing";
import { BlendFunction, KernelSize } from "postprocessing";
import { Vector2 } from "three";

// @ts-expect-error vendored JSX, default-exported in source
import LensFlare from "./lens-flare/LensFlare.jsx";

/**
 * Cinematic post-processing stack — tuned for the dark + cyan palette.
 * Order matters: bloom early so the glow blooms before color grading;
 * lens flare blends with screen; chromatic + vignette last for the
 * movie-frame feel.
 */
export function PostFX() {
  return (
    <EffectComposer multisampling={8}>
      <Bloom
        intensity={1.7}
        luminanceThreshold={0.1}
        luminanceSmoothing={0.5}
        kernelSize={KernelSize.HUGE}
        mipmapBlur
      />
      <LensFlare
        dirtTextureFile="/textures/lens-dirt.jpg"
        starPoints={6}
        glareSize={0.32}
        flareSize={0.012}
        flareSpeed={0.4}
        flareShape={0.1}
        haloScale={0.48}
        opacity={0.85}
        ghostScale={0.12}
        animated={true}
        anamorphic={false}
        followMouse={false}
        secondaryGhosts={true}
        starBurst={true}
        enabled={true}
      />
      <HueSaturation hue={0} saturation={0.18} blendFunction={BlendFunction.NORMAL} />
      <BrightnessContrast brightness={-0.04} contrast={0.22} />
      <ChromaticAberration
        offset={new Vector2(0.001, 0.001)}
        radialModulation={true}
        modulationOffset={0.45}
        blendFunction={BlendFunction.NORMAL}
      />
      <Vignette
        offset={0.25}
        darkness={0.75}
        eskil={false}
        blendFunction={BlendFunction.NORMAL}
      />
    </EffectComposer>
  );
}
