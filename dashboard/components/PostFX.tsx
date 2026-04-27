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

/**
 * Cinematic post-processing stack — tuned for the dark + cyan palette.
 * Order matters: bloom early so the glow blooms before color grading;
 * chromatic + vignette last for that movie-frame feel.
 */
export function PostFX() {
  return (
    <EffectComposer multisampling={8}>
      <Bloom
        intensity={1.6}
        luminanceThreshold={0.12}
        luminanceSmoothing={0.5}
        kernelSize={KernelSize.HUGE}
        mipmapBlur
      />
      <HueSaturation hue={0} saturation={0.12} blendFunction={BlendFunction.NORMAL} />
      <BrightnessContrast brightness={-0.02} contrast={0.18} />
      <ChromaticAberration
        offset={new Vector2(0.0008, 0.0008)}
        radialModulation={true}
        modulationOffset={0.45}
        blendFunction={BlendFunction.NORMAL}
      />
      <Vignette
        offset={0.28}
        darkness={0.7}
        eskil={false}
        blendFunction={BlendFunction.NORMAL}
      />
    </EffectComposer>
  );
}
