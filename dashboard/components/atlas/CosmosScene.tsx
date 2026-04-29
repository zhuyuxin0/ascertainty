"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  Billboard,
  Text,
  Stars,
} from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { REGIONS, type Region } from "@/lib/atlas/regions";
import { bandFromZoom, type ZoomBand } from "@/lib/atlas/zoomLevels";
import type { AtlasModel, AtlasMarket } from "@/lib/atlas/types";
import { providerColorRGB } from "@/lib/atlas/types";
import { API_URL } from "@/lib/api";

/**
 * The 3D cosmos. Each region is a glowing icosahedron-blob floating at
 * its own z-depth, framed by stars + bloom. OrbitControls give the
 * mouse-rotate / cmd-pan interaction the founder asked for. The camera's
 * distance from origin maps to a "zoom"-like value that drives the
 * semantic-zoom band engine the same way deck.gl's `zoom` did.
 *
 * Camera distance → zoom band:
 *    far   (1500+)  → cosmos
 *    mid   (700)    → domain
 *    close (350)    → entity
 *    very close     → detail
 *
 * The zoom-band lock prevents the band from changing when the user
 * dollies the camera, so they can pan around at a fixed band.
 */

type Props = {
  onActiveRegion?: (r: Region | null) => void;
  onSelectModel?: (m: AtlasModel | null) => void;
  bandLock?: ZoomBand | null;
  onBandChange?: (band: ZoomBand) => void;
};

/** Distance thresholds that map camera→origin distance to a band. Lower
 *  distance = higher zoom = deeper band. */
const BAND_DISTANCE: Record<ZoomBand, [number, number]> = {
  cosmos: [1100, 4000],
  domain: [600, 1100],
  entity: [250, 600],
  detail: [80, 250],
};

export function CosmosScene(props: Props) {
  const [models, setModels] = useState<AtlasModel[]>([]);
  const [markets, setMarkets] = useState<AtlasMarket[]>([]);

  useEffect(() => {
    fetch(`${API_URL}/atlas/models`)
      .then((r) => r.json())
      .then((d: { models: AtlasModel[] }) => setModels(d.models ?? []))
      .catch(() => setModels([]));
    fetch(`${API_URL}/atlas/markets`)
      .then((r) => r.json())
      .then((d: { markets: AtlasMarket[] }) => setMarkets(d.markets ?? []))
      .catch(() => setMarkets([]));
  }, []);

  return (
    <Canvas
      shadows={false}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: false }}
      camera={{ position: [0, 0, 1500], fov: 45, near: 1, far: 4000 }}
      style={{ background: "#030305" }}
    >
      {/* Ambient + key light: mostly the bloom does the heavy lift */}
      <ambientLight intensity={0.35} />
      <directionalLight position={[300, 500, 800]} intensity={0.4} />

      {/* Distant starfield */}
      <Stars
        radius={2400}
        depth={400}
        count={2400}
        factor={6}
        fade
        speed={0.3}
      />

      {/* The 6 region planets */}
      {REGIONS.map((r) => (
        <RegionPlanet
          key={r.id}
          region={r}
          onClick={() => props.onActiveRegion?.(r)}
        />
      ))}

      {/* AI Models entity nodes. Band lock overrides the distance gate so
          the user can dolly the camera anywhere while keeping nodes mounted. */}
      <ModelNodes
        models={models}
        onClickModel={(m) => props.onSelectModel?.(m)}
        bandLock={props.bandLock ?? null}
      />

      {/* Camera distance → zoom band signaller, with optional clamp when locked. */}
      <CameraBandController
        bandLock={props.bandLock ?? null}
        onBandChange={props.onBandChange}
      />

      {/* Orbit controls — rotate, pan (cmd/ctrl-drag), dolly */}
      <OrbitControls
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.6}
        zoomSpeed={0.8}
        panSpeed={1.2}
        minDistance={120}
        maxDistance={2400}
        // Allow wide rotation but stay roughly above-the-equator so layout reads
        minPolarAngle={Math.PI * 0.18}
        maxPolarAngle={Math.PI * 0.82}
        makeDefault
      />

      {/* Post-processing: subtle bloom + vignette */}
      <EffectComposer>
        <Bloom
          intensity={0.85}
          luminanceThreshold={0.18}
          luminanceSmoothing={0.5}
          radius={0.7}
        />
        <Vignette eskil={false} offset={0.18} darkness={0.55} />
      </EffectComposer>
    </Canvas>
  );
}

/** A single region: glowing icosahedron + halo + 3D billboard label. */
function RegionPlanet({ region, onClick }: { region: Region; onClick: () => void }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const color = useMemo(
    () =>
      new THREE.Color(
        region.color[0] / 255,
        region.color[1] / 255,
        region.color[2] / 255,
      ),
    [region.color],
  );

  const isLive = region.status === "live";
  const emissiveStrength = isLive ? 1.4 : 0.5;
  const baseScale = isLive ? 1 : 0.85;

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (meshRef.current) {
      // Slow rotate + breathing
      meshRef.current.rotation.y = t * 0.06;
      meshRef.current.rotation.x = Math.sin(t * 0.4) * 0.05;
      const breathe = 1 + Math.sin(t * 0.8 + region.position[0] * 0.01) * 0.02;
      meshRef.current.scale.setScalar(baseScale * (hovered ? 1.08 : 1) * breathe);
    }
    if (haloRef.current) {
      haloRef.current.scale.setScalar(
        baseScale * (1.55 + Math.sin(t * 0.6 + region.position[1] * 0.01) * 0.04) * (hovered ? 1.1 : 1),
      );
    }
  });

  return (
    <group position={[region.position[0], region.position[1], region.z]}>
      {/* Halo (additive bloom-friendly) */}
      <mesh ref={haloRef}>
        <sphereGeometry args={[region.radius, 24, 24]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={isLive ? 0.06 : 0.03}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Body */}
      <mesh
        ref={meshRef}
        onPointerEnter={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerLeave={() => {
          setHovered(false);
          document.body.style.cursor = "";
        }}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        <icosahedronGeometry args={[region.radius * 0.65, 2]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={emissiveStrength}
          roughness={0.55}
          metalness={0.15}
          flatShading
          transparent
          opacity={isLive ? 0.95 : 0.55}
        />
      </mesh>

      {/* Label — billboard always faces camera */}
      <Billboard position={[0, region.radius + 30, 0]}>
        <Text
          fontSize={isLive ? 28 : 24}
          color={isLive ? color : "#9aa"}
          anchorX="center"
          anchorY="bottom"
          outlineWidth={0.5}
          outlineColor="#030305"
          letterSpacing={0.06}
        >
          {region.name.toUpperCase()}
        </Text>
        <Text
          position={[0, -8, 0]}
          fontSize={11}
          color={isLive ? "#cccccc" : "#777"}
          anchorX="center"
          anchorY="top"
        >
          {isLive
            ? region.subtitle
            : `${region.subtitle} · ${region.comingWhen ?? "coming"}`}
        </Text>
      </Billboard>
    </group>
  );
}

/** Individual model nodes within the AI Models region. Mounted only when
 *  the camera is close enough (entity band). Phyllotaxis-spread within
 *  per-provider arms to remove the prior overlap mess. */
function ModelNodes({
  models,
  onClickModel,
  bandLock,
}: {
  models: AtlasModel[];
  onClickModel: (m: AtlasModel) => void;
  bandLock: ZoomBand | null;
}) {
  const { camera } = useThree();
  const [visible, setVisible] = useState(false);

  // When the band is locked to entity or detail, force-mount the nodes
  // regardless of camera distance. Otherwise gate by distance to AI Models.
  useFrame(() => {
    if (bandLock === "entity" || bandLock === "detail") {
      if (!visible) setVisible(true);
      return;
    }
    if (bandLock === "cosmos" || bandLock === "domain") {
      if (visible) setVisible(false);
      return;
    }
    const aiRegion = REGIONS.find((r) => r.id === "ai-models")!;
    const dx = camera.position.x - aiRegion.position[0];
    const dy = camera.position.y - aiRegion.position[1];
    const dz = camera.position.z - aiRegion.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    setVisible(dist < 700);
  });

  const positions = useMemo(() => computePhyllotaxisPositions(models), [models]);

  if (!visible) return null;

  return (
    <group>
      {models.map((m) => {
        const pos = positions[m.model_id];
        if (!pos) return null;
        const [r, g, b] = providerColorRGB(m.provider);
        const color = new THREE.Color(r / 255, g / 255, b / 255);
        const radius = 4 + 12 * Math.max(0, Math.min(1, (m.aggregate - 50) / 45));
        return (
          <ModelNode
            key={m.model_id}
            position={pos}
            color={color}
            radius={radius}
            label={m.name}
            onClick={() => onClickModel(m)}
          />
        );
      })}
    </group>
  );
}

function ModelNode({
  position,
  color,
  radius,
  label,
  onClick,
}: {
  position: [number, number, number];
  color: THREE.Color;
  radius: number;
  label: string;
  onClick: () => void;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state) => {
    if (ref.current) {
      const t = state.clock.elapsedTime;
      ref.current.scale.setScalar(hovered ? 1.4 : 1 + Math.sin(t * 1.5 + position[0]) * 0.04);
    }
  });

  return (
    <group position={position}>
      <mesh
        ref={ref}
        onPointerEnter={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerLeave={() => {
          setHovered(false);
          document.body.style.cursor = "";
        }}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        <sphereGeometry args={[radius, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.2}
          roughness={0.4}
          metalness={0.2}
        />
      </mesh>
      {hovered && (
        <Billboard position={[0, radius + 8, 0]}>
          <Text fontSize={11} color="#ffffff" anchorX="center" anchorY="bottom">
            {label}
          </Text>
        </Billboard>
      )}
    </group>
  );
}

/** Compute phyllotaxis-spread positions for models grouped by provider.
 *  Each provider gets its own spiral arm; within an arm, models are placed
 *  along a Fibonacci/golden-angle spiral so they never visually overlap. */
function computePhyllotaxisPositions(
  models: AtlasModel[],
): Record<string, [number, number, number]> {
  const aiRegion = REGIONS.find((r) => r.id === "ai-models")!;
  const cx = aiRegion.position[0];
  const cy = aiRegion.position[1];
  const cz = aiRegion.z;
  const R = aiRegion.radius * 0.85;
  const PHI = Math.PI * (3 - Math.sqrt(5)); // golden angle ~137.5°

  const byProvider: Record<string, AtlasModel[]> = {};
  for (const m of models) {
    (byProvider[m.provider] ??= []).push(m);
  }

  const providerOrder = [
    "OpenAI",
    "Anthropic",
    "Google",
    "Meta",
    "DeepSeek",
    "Mistral",
    "xAI",
    "Alibaba",
    "Cohere",
    "Open-source",
  ];
  const providerCount = providerOrder.length;
  const sectorAngle = (Math.PI * 2) / providerCount;

  const out: Record<string, [number, number, number]> = {};
  providerOrder.forEach((provider, pIdx) => {
    const group = (byProvider[provider] ?? []).slice().sort(
      (a, b) => b.aggregate - a.aggregate,
    );
    const sectorCenter = -Math.PI / 2 + pIdx * sectorAngle;

    group.forEach((m, i) => {
      // Phyllotaxis: r = c * sqrt(i+1), angle offset within sector
      const c = R * 0.18; // spiral spacing
      const r = c * Math.sqrt(i + 1);
      // Rotate by golden angle but keep within ±sector/3 of sector center
      const localAngle = (i * PHI) % (sectorAngle * 0.55) - sectorAngle * 0.275;
      const angle = sectorCenter + localAngle;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      // Slight z jitter for parallax depth: better models forward, weaker back
      const aggN = Math.max(0, Math.min(1, (m.aggregate - 50) / 45));
      const z = cz + 30 + aggN * 30 + ((m.model_id.charCodeAt(0) % 7) - 3) * 4;
      out[m.model_id] = [x, y, z];
    });
  });
  return out;
}

/** Reports the current band based on camera distance. When `bandLock` is
 *  set, snaps the camera into the band's range on lock-in (so the user
 *  immediately sees the right content) and clamps the distance so they
 *  can rotate/pan freely without dollying out of the band. Scroll-zoom
 *  still works *within* the band's range. */
function CameraBandController({
  bandLock,
  onBandChange,
}: {
  bandLock: ZoomBand | null;
  onBandChange?: (band: ZoomBand) => void;
}) {
  const { camera } = useThree();
  const lastBand = useRef<ZoomBand | null>(null);
  const lastLock = useRef<ZoomBand | null>(null);
  const snapTarget = useRef<number | null>(null);

  // When lock changes, queue a one-time camera distance snap to the
  // middle of the new band's range. This is what makes the lock feel
  // responsive — clicking 'entity' actually flies you to entity distance.
  useEffect(() => {
    if (bandLock !== lastLock.current) {
      lastLock.current = bandLock;
      if (bandLock) {
        const [minD, maxD] = BAND_DISTANCE[bandLock];
        snapTarget.current = (minD + maxD) / 2;
      } else {
        snapTarget.current = null;
      }
    }
  }, [bandLock]);

  useFrame(() => {
    let dist = camera.position.length();

    // One-shot snap on lock change — eased over a few frames
    if (snapTarget.current !== null) {
      const target = snapTarget.current;
      const next = dist + (target - dist) * 0.18;
      const dir = camera.position.clone().normalize();
      camera.position.copy(dir.multiplyScalar(next));
      dist = next;
      if (Math.abs(next - target) < 4) {
        snapTarget.current = null;
      }
    } else if (bandLock) {
      const [minD, maxD] = BAND_DISTANCE[bandLock];
      if (dist < minD - 1 || dist > maxD + 1) {
        const clamped = Math.max(minD, Math.min(maxD, dist));
        const dir = camera.position.clone().normalize();
        camera.position.copy(dir.multiplyScalar(clamped));
        dist = clamped;
      }
    }

    const pseudoZoom = Math.log2(1500 / Math.max(dist, 1)) - 0.5;
    const band = bandLock ?? bandFromZoom(pseudoZoom);
    if (onBandChange && band !== lastBand.current) {
      lastBand.current = band;
      onBandChange(band);
    }
  });
  return null;
}
