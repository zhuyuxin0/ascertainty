"use client";

import { useRouter } from "next/navigation";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  Billboard,
  Text,
  Stars,
  Line,
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
  onSelectMarket?: (m: AtlasMarket | null) => void;
  bandLock?: ZoomBand | null;
  onBandChange?: (band: ZoomBand) => void;
};

type AtlasBounty = {
  id: number;
  spec_hash: string;
  amount_usdc: string;
  status: string;
  novelty: number | null;
  difficulty: number | null;
  erdos_class: number | null;
  spec_yaml?: string;
};

/** Distance thresholds that map camera→origin distance to a band. Lower
 *  distance = higher zoom = deeper band. */
const BAND_DISTANCE: Record<ZoomBand, [number, number]> = {
  cosmos: [1100, 4000],
  domain: [600, 1100],
  entity: [250, 600],
  detail: [80, 250],
};

type FlyTarget = {
  x: number;
  y: number;
  z: number;
  distance: number; // mid-band distance the camera should sit at
};

export function CosmosScene(props: Props) {
  const [models, setModels] = useState<AtlasModel[]>([]);
  const [markets, setMarkets] = useState<AtlasMarket[]>([]);
  const [bounties, setBounties] = useState<AtlasBounty[]>([]);
  const [flyTarget, setFlyTarget] = useState<FlyTarget | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/atlas/models`)
      .then((r) => r.json())
      .then((d: { models: AtlasModel[] }) => setModels(d.models ?? []))
      .catch(() => setModels([]));
    fetch(`${API_URL}/atlas/markets`)
      .then((r) => r.json())
      .then((d: { markets: AtlasMarket[] }) => setMarkets(d.markets ?? []))
      .catch(() => setMarkets([]));
    fetch(`${API_URL}/bounties`)
      .then((r) => r.json())
      .then((d: { bounties: AtlasBounty[] }) => setBounties(d.bounties ?? []))
      .catch(() => setBounties([]));
  }, []);

  return (
    <Canvas
      shadows={false}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: false }}
      camera={{ position: [0, 0, 1500], fov: 38, near: 1, far: 4000 }}
      style={{ background: "#04050A" }}
    >
      {/* Volumetric fog gives the cosmos *air* — far regions desaturate
          into the void instead of cardboard-cutting against the black.
          Picked from art-director's atmosphere spec. */}
      <fog attach="fog" args={["#04050A", 1200, 3600]} />

      {/* Cool key light + warm rim. The two-light kit is what separates
          the surfaces from blob-on-black; the rim lifts contour edges. */}
      <ambientLight intensity={0.28} />
      <directionalLight position={[300, 500, 800]} intensity={0.38} color="#9DB7FF" />
      <directionalLight position={[-400, -200, 400]} intensity={0.12} color="#FF8B5C" />

      {/* Distant starfield — smaller, slower, denser (per art-director).
          High count + low factor reads as dust, not floaters. */}
      <Stars
        radius={2400}
        depth={500}
        count={4500}
        factor={3.2}
        fade
        speed={0.08}
      />

      {/* The 6 region planets — dim/hide when band-locked to entity or
          detail (the user explicitly wanted exclusivity: only the locked
          layer's artefacts show, other layers fade out). */}
      {REGIONS.map((r) => (
        <RegionPlanet
          key={r.id}
          region={r}
          onClick={() => {
            props.onActiveRegion?.(r);
            // Fly the camera to a domain-band distance with the region
            // dead-center. Distance 700 is the mid of the domain band.
            setFlyTarget({
              x: r.position[0],
              y: r.position[1],
              z: r.z,
              distance: r.status === "live" ? 520 : 700,
            });
          }}
          dim={
            props.bandLock === "entity" || props.bandLock === "detail"
              ? 0.18
              : 1
          }
          hidden={props.bandLock === "detail"}
        />
      ))}

      {/* AI Models entity nodes. Band lock overrides the distance gate so
          the user can dolly the camera anywhere while keeping nodes mounted. */}
      <ModelNodes
        models={models}
        onClickModel={(m) => props.onSelectModel?.(m)}
        bandLock={props.bandLock ?? null}
      />

      {/* Prediction Markets entity nodes */}
      <MarketNodes
        markets={markets}
        onClickMarket={(m) => props.onSelectMarket?.(m)}
        bandLock={props.bandLock ?? null}
      />

      {/* Math Proofs nodes — deep-zoom into existing /bounty UI */}
      <MathProofsNodes bounties={bounties} bandLock={props.bandLock ?? null} />

      {/* Cross-domain arcs: 2 hand-curated tethers from Polymarket questions
          to AI models. Visual proof that the map IS one connected piece. */}
      <CrossDomainArcs models={models} markets={markets} />

      {/* Wandering persona minions — Andy / Carl / Bea drift between regions */}
      <MinionCapsules />

      {/* Camera distance → zoom band signaller, with optional clamp when locked. */}
      <CameraBandController
        bandLock={props.bandLock ?? null}
        onBandChange={props.onBandChange}
      />

      {/* Region-click fly-to: 1.4s ease-in-out from current camera +
          OrbitControls target to a position framing the clicked region. */}
      <FlyToController target={flyTarget} onDone={() => setFlyTarget(null)} />

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

      {/* Post-processing: tighter bloom (only true emitters bloom) +
          deeper vignette for cinema-grade falloff toward edges. */}
      <EffectComposer>
        <Bloom
          intensity={1.15}
          luminanceThreshold={0.25}
          luminanceSmoothing={0.55}
          radius={0.85}
          mipmapBlur
        />
        <Vignette eskil={false} offset={0.22} darkness={0.72} />
      </EffectComposer>
    </Canvas>
  );
}

/** A single region: glowing icosahedron + halo + 3D billboard label. */
function RegionPlanet({
  region,
  onClick,
  dim = 1,
  hidden = false,
}: {
  region: Region;
  onClick: () => void;
  dim?: number;
  hidden?: boolean;
}) {
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
  // emissive cap dropped per art-director (was 1.4, now 0.9 for live)
  // and modulated by `dim` so band-locked-elsewhere regions recede.
  const emissiveStrength = (isLive ? 0.9 : 0.25) * dim;
  const baseScale = isLive ? 1 : 0.85;

  // Strip the per-frame breathing loop (creative-director Move B). Keep
  // only the very slow group-axis rotation for "the cosmos turns" feel,
  // and a one-time hover scale step (no continuous wiggle).
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (meshRef.current) {
      meshRef.current.rotation.y = t * 0.04; // slowed from 0.06
      meshRef.current.scale.setScalar(baseScale * (hovered ? 1.08 : 1));
    }
    // halo no longer pulses every frame — fixed
  });

  if (hidden) return null;

  return (
    <group position={[region.position[0], region.position[1], region.z]}>
      {/* Halo (additive bloom-friendly) */}
      <mesh ref={haloRef} scale={baseScale * 1.55}>
        <sphereGeometry args={[region.radius, 24, 24]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={(isLive ? 0.07 : 0.025) * dim}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Body */}
      <mesh
        ref={meshRef}
        onPointerEnter={(e) => {
          if (dim < 0.5) return;
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerLeave={() => {
          setHovered(false);
          document.body.style.cursor = "";
        }}
        onClick={(e) => {
          if (dim < 0.5) return;
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
          opacity={(isLive ? 0.95 : 0.55) * dim}
        />
      </mesh>

      {/* Label — billboard always faces camera */}
      <Billboard position={[0, region.radius + 30, 0]}>
        <Text
          fontSize={isLive ? 28 : 24}
          color={isLive ? color : new THREE.Color("#9aa")}
          anchorX="center"
          anchorY="bottom"
          outlineWidth={0.5}
          outlineColor="#030305"
          letterSpacing={0.18}
          fillOpacity={dim}
        >
          {region.name.toUpperCase()}
        </Text>
        <Text
          position={[0, -8, 0]}
          fontSize={11}
          color={isLive ? "#9aa0b5" : "#5c627a"}
          anchorX="center"
          anchorY="top"
          fillOpacity={dim * 0.85}
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

  // No per-frame breathing — only a one-shot hover scale. The vibe-coded
  // "every node wiggles" tell is what made the cosmos feel synthetic.
  useFrame(() => {
    if (ref.current) {
      const target = hovered ? 1.35 : 1;
      const cur = ref.current.scale.x;
      ref.current.scale.setScalar(cur + (target - cur) * 0.18);
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
          emissiveIntensity={0.9}
          roughness={0.45}
          metalness={0.18}
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

/** Eased camera glide. Lerps both `camera.position` and OrbitControls'
 *  internal `target` so the clicked region ends up dead-center. The
 *  destination camera position sits on the line origin→region, scaled
 *  to the band-mid distance so we land in the right zoom band too. */
function FlyToController({
  target,
  onDone,
}: {
  target: FlyTarget | null;
  onDone: () => void;
}) {
  const { camera, controls } = useThree();
  const startRef = useRef<{
    camPos: THREE.Vector3;
    ctrlTarget: THREE.Vector3;
    t0: number;
    finalCamPos: THREE.Vector3;
    finalCtrlTarget: THREE.Vector3;
  } | null>(null);

  useEffect(() => {
    if (!target) {
      startRef.current = null;
      return;
    }
    const ctrls = controls as unknown as { target?: THREE.Vector3 } | null;
    const ctrlTarget = ctrls?.target?.clone() ?? new THREE.Vector3();

    // Where the camera should end up: along the line from the region
    // outward toward the current camera direction, at `distance` units.
    const regionPos = new THREE.Vector3(target.x, target.y, target.z);
    const fromRegion = camera.position.clone().sub(regionPos);
    const len = fromRegion.length();
    const dir = len > 0.001 ? fromRegion.normalize() : new THREE.Vector3(0, 0, 1);
    const finalCamPos = regionPos.clone().add(dir.multiplyScalar(target.distance));

    startRef.current = {
      camPos: camera.position.clone(),
      ctrlTarget,
      t0: performance.now(),
      finalCamPos,
      finalCtrlTarget: regionPos.clone(),
    };
  }, [target, camera, controls]);

  useFrame(() => {
    if (!startRef.current) return;
    const DURATION = 1400;
    const elapsed = performance.now() - startRef.current.t0;
    const t = Math.min(1, elapsed / DURATION);
    // ease-in-out cubic
    const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    camera.position.lerpVectors(
      startRef.current.camPos,
      startRef.current.finalCamPos,
      e,
    );

    const ctrls = controls as unknown as { target?: THREE.Vector3 } | null;
    if (ctrls?.target) {
      ctrls.target.lerpVectors(
        startRef.current.ctrlTarget,
        startRef.current.finalCtrlTarget,
        e,
      );
    }

    if (t >= 1) {
      startRef.current = null;
      onDone();
    }
  });

  return null;
}

/* ---------- Prediction Markets entity nodes ---------- */

const CATEGORY_COLOR: Record<string, [number, number, number]> = {
  politics: [255, 107, 53],
  ai: [0, 212, 170],
  crypto: [250, 204, 21],
  sports: [168, 85, 247],
  entertainment: [236, 72, 153],
  science: [34, 197, 94],
  other: [136, 136, 136],
};

function MarketNodes({
  markets,
  onClickMarket,
  bandLock,
}: {
  markets: AtlasMarket[];
  onClickMarket: (m: AtlasMarket) => void;
  bandLock: ZoomBand | null;
}) {
  const { camera } = useThree();
  const [visible, setVisible] = useState(false);

  useFrame(() => {
    if (bandLock === "entity" || bandLock === "detail") {
      if (!visible) setVisible(true);
      return;
    }
    if (bandLock === "cosmos" || bandLock === "domain") {
      if (visible) setVisible(false);
      return;
    }
    const region = REGIONS.find((r) => r.id === "prediction-markets")!;
    const dx = camera.position.x - region.position[0];
    const dy = camera.position.y - region.position[1];
    const dz = camera.position.z - region.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    setVisible(dist < 700);
  });

  const positions = useMemo(() => computeMarketPositions(markets), [markets]);

  // Cap the render to top 60 by volume so we don't drop FPS at entity zoom.
  // MUST be declared before any early-return so React's hook order stays
  // constant across renders (otherwise the `visible` flip throws a hook
  // count mismatch at runtime).
  const top = useMemo(
    () => [...markets].sort((a, b) => b.volume_usd - a.volume_usd).slice(0, 60),
    [markets],
  );

  if (!visible) return null;

  return (
    <group>
      {top.map((m) => {
        const pos = positions[m.market_id];
        if (!pos) return null;
        const [r, g, b] = CATEGORY_COLOR[m.category] ?? CATEGORY_COLOR.other;
        const color = new THREE.Color(r / 255, g / 255, b / 255);
        // Size by log-volume so a $60M market isn't 60× bigger than $1M
        const radius = 3 + 7 * Math.log10(Math.max(1, m.volume_usd / 1e4));
        return (
          <MarketNode
            key={m.market_id}
            position={pos}
            color={color}
            radius={radius}
            label={m.question}
            probability={m.probability}
            onClick={() => onClickMarket(m)}
          />
        );
      })}
    </group>
  );
}

function MarketNode({
  position,
  color,
  radius,
  label,
  probability,
  onClick,
}: {
  position: [number, number, number];
  color: THREE.Color;
  radius: number;
  label: string;
  probability: number;
  onClick: () => void;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame(() => {
    if (ref.current) {
      const target = hovered ? 1.4 : 1;
      const cur = ref.current.scale.x;
      ref.current.scale.setScalar(cur + (target - cur) * 0.18);
    }
  });

  // Confidence: closer to 50% = more uncertain = more orange tint
  const certainty = Math.abs(probability - 0.5) * 2; // 0..1

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
        <sphereGeometry args={[radius, 14, 14]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.6 + certainty * 0.8}
          roughness={0.5}
          metalness={0.15}
          transparent
          opacity={0.5 + certainty * 0.4}
        />
      </mesh>
      {hovered && (
        <Billboard position={[0, radius + 6, 0]}>
          <Text
            fontSize={9}
            color="#ffffff"
            anchorX="center"
            anchorY="bottom"
            maxWidth={140}
            outlineWidth={0.5}
            outlineColor="#030305"
          >
            {label.slice(0, 80) + (label.length > 80 ? "…" : "")}
          </Text>
          <Text
            position={[0, -10, 0]}
            fontSize={11}
            color={`rgb(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)})`}
            anchorX="center"
            anchorY="top"
          >
            {(probability * 100).toFixed(0)}%
          </Text>
        </Billboard>
      )}
    </group>
  );
}

function computeMarketPositions(
  markets: AtlasMarket[],
): Record<string, [number, number, number]> {
  const region = REGIONS.find((r) => r.id === "prediction-markets")!;
  const cx = region.position[0];
  const cy = region.position[1];
  const cz = region.z;
  const R = region.radius * 0.85;
  const PHI = Math.PI * (3 - Math.sqrt(5));

  const byCat: Record<string, AtlasMarket[]> = {};
  for (const m of markets) {
    (byCat[m.category] ??= []).push(m);
  }

  const catOrder = ["politics", "ai", "crypto", "sports", "entertainment", "science", "other"];
  const sectorAngle = (Math.PI * 2) / catOrder.length;

  const out: Record<string, [number, number, number]> = {};
  catOrder.forEach((cat, ci) => {
    const group = (byCat[cat] ?? []).slice().sort((a, b) => b.volume_usd - a.volume_usd);
    const sectorCenter = -Math.PI / 2 + ci * sectorAngle;
    group.forEach((m, i) => {
      const c = R * 0.18;
      const r = c * Math.sqrt(i + 1);
      const localAngle = (i * PHI) % (sectorAngle * 0.55) - sectorAngle * 0.275;
      const angle = sectorCenter + localAngle;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      const certain = Math.abs(m.probability - 0.5) * 2;
      const z = cz + 20 + certain * 30 + ((m.market_id.charCodeAt(0) % 7) - 3) * 4;
      out[m.market_id] = [x, y, z];
    });
  });
  return out;
}

/* ---------- Math Proofs nodes ---------- */

function MathProofsNodes({
  bounties,
  bandLock,
}: {
  bounties: AtlasBounty[];
  bandLock: ZoomBand | null;
}) {
  const { camera } = useThree();
  const [visible, setVisible] = useState(false);
  const router = useRouter();

  useFrame(() => {
    if (bandLock === "entity" || bandLock === "detail") {
      if (!visible) setVisible(true);
      return;
    }
    if (bandLock === "cosmos" || bandLock === "domain") {
      if (visible) setVisible(false);
      return;
    }
    const region = REGIONS.find((r) => r.id === "math-proofs")!;
    const dx = camera.position.x - region.position[0];
    const dy = camera.position.y - region.position[1];
    const dz = camera.position.z - region.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    setVisible(dist < 700);
  });

  if (!visible) return null;

  const region = REGIONS.find((r) => r.id === "math-proofs")!;
  const cx = region.position[0];
  const cy = region.position[1];
  const cz = region.z;
  const R = region.radius * 0.6;

  return (
    <group>
      {bounties.map((b, i) => {
        const angle = (i / Math.max(1, bounties.length)) * Math.PI * 2 - Math.PI / 2;
        const x = cx + R * Math.cos(angle);
        const y = cy + R * Math.sin(angle);
        const z = cz + 25;
        const settled = b.status === "settled";
        const submitted = b.status === "submitted";
        const color = new THREE.Color(
          settled ? "#00d4aa" : submitted ? "#ff6b35" : "#88c8b6",
        );
        const radius = 8 + (b.difficulty ?? 5) * 0.8;
        const label = bountyLabel(b);
        return (
          <BountyNode
            key={b.id}
            position={[x, y, z]}
            color={color}
            radius={radius}
            label={label}
            status={b.status}
            amount={b.amount_usdc}
            difficulty={b.difficulty}
            erdos={b.erdos_class === 1}
            settled={settled}
            submitted={submitted}
            onClick={() => router.push(`/bounty/${b.id}`)}
          />
        );
      })}
    </group>
  );
}

function BountyNode({
  position,
  color,
  radius,
  label,
  status,
  amount,
  difficulty,
  erdos,
  settled,
  submitted,
  onClick,
}: {
  position: [number, number, number];
  color: THREE.Color;
  radius: number;
  label: string;
  status: string;
  amount: string;
  difficulty: number | null;
  erdos: boolean;
  settled: boolean;
  submitted: boolean;
  onClick: () => void;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  // Slow geometric rotation only — the octahedron form *needs* a touch of
  // turn to read as a 3D object, but no jelly scale. Hover lerps in.
  // For 'submitted' (challenge window open) bounties, pulse a halo so
  // the demo shot reads "this proof is being challenged right now".
  useFrame((state) => {
    if (ref.current) {
      const t = state.clock.elapsedTime;
      ref.current.rotation.y = t * 0.18 + position[0] * 0.01;
      const target = hovered ? 1.28 : 1;
      const cur = ref.current.scale.x;
      ref.current.scale.setScalar(cur + (target - cur) * 0.18);
    }
    if (haloRef.current && submitted) {
      const t = state.clock.elapsedTime;
      const pulse = 1 + Math.sin(t * 2.4) * 0.18;
      haloRef.current.scale.setScalar(pulse);
      const mat = haloRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.18 + Math.sin(t * 2.4) * 0.08;
    }
  });

  const statusLabel =
    status === "settled"
      ? "settled ✓"
      : status === "submitted"
        ? "challenge window"
        : status === "open"
          ? "open"
          : status;
  const statusColor = settled ? "#00d4aa" : submitted ? "#ff6b35" : "#9aa0b5";
  const usdcDisplay = (() => {
    try {
      const n = Number(amount) / 1e6;
      if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
      return `$${n.toFixed(0)}`;
    } catch {
      return amount;
    }
  })();

  return (
    <group position={position}>
      {/* Pulsing halo for "submitted" — challenge window is open */}
      {submitted && (
        <mesh ref={haloRef}>
          <sphereGeometry args={[radius * 1.8, 16, 16]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.2}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}
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
        <octahedronGeometry args={[radius, 0]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.95}
          roughness={0.35}
          metalness={0.42}
          flatShading
        />
      </mesh>
      <Billboard position={[0, radius + 8, 0]}>
        <Text
          fontSize={hovered ? 12 : 10}
          color={erdos ? "#ff6b35" : "#ffffff"}
          anchorX="center"
          anchorY="bottom"
          outlineWidth={0.6}
          outlineColor="#04050A"
        >
          {erdos ? "✨ " : ""}
          {label}
        </Text>
        <Text
          position={[0, -2, 0]}
          fontSize={9}
          color={statusColor}
          anchorX="center"
          anchorY="top"
          letterSpacing={0.1}
          outlineWidth={0.3}
          outlineColor="#04050A"
        >
          {statusLabel} · {usdcDisplay}
          {difficulty != null ? ` · diff ${difficulty}` : ""}
        </Text>
      </Billboard>
    </group>
  );
}

function bountyLabel(b: AtlasBounty): string {
  // Try to extract the bounty_id from spec_yaml first line
  if (b.spec_yaml) {
    const m = /bounty_id:\s*([^\s]+)/.exec(b.spec_yaml);
    if (m) return m[1].split("-").slice(0, 3).join("-");
  }
  return `bounty #${b.id}`;
}

/* ---------- Cross-domain arcs ---------- */

/** Hand-curated arcs from market questions to AI models. The regex-based
 *  auto-detection found 0 matches in current trending Polymarket markets
 *  (most are sports/politics, not AI). We seed 2 demo arcs by category
 *  proxy: the first AI-categorised market → GPT-5.5; the first crypto
 *  market → Llama 4 (since DeFi work often touches LLMs). Tells the
 *  cross-domain story without lying about real connections. */
function CrossDomainArcs({
  models,
  markets,
}: {
  models: AtlasModel[];
  markets: AtlasMarket[];
}) {
  const arcs = useMemo(() => {
    if (models.length === 0 || markets.length === 0) return [];
    const findModel = (id: string) => models.find((m) => m.model_id === id);
    const aiMarket =
      markets.find((m) => m.category === "ai") ??
      markets.find((m) => /\bai|llm|gpt|claude|gemini\b/i.test(m.question));
    const cryptoMarket = markets.find((m) => m.category === "crypto");
    const out: Array<{ from: [number, number, number]; to: [number, number, number]; color: string }> = [];
    const gpt = findModel("gpt-5-5");
    const llama = findModel("llama-4-405b");
    if (aiMarket && gpt && aiMarket.layout_x !== null && gpt.layout_x !== null) {
      const region = REGIONS.find((r) => r.id === "prediction-markets")!;
      const aiR = REGIONS.find((r) => r.id === "ai-models")!;
      out.push({
        from: [aiMarket.layout_x as number, aiMarket.layout_y as number, region.z + 25],
        to: [gpt.layout_x as number, gpt.layout_y as number, aiR.z + 50],
        color: "#00d4aa",
      });
    }
    if (cryptoMarket && llama && cryptoMarket.layout_x !== null && llama.layout_x !== null) {
      const region = REGIONS.find((r) => r.id === "prediction-markets")!;
      const aiR = REGIONS.find((r) => r.id === "ai-models")!;
      out.push({
        from: [cryptoMarket.layout_x as number, cryptoMarket.layout_y as number, region.z + 25],
        to: [llama.layout_x as number, llama.layout_y as number, aiR.z + 50],
        color: "#ff6b35",
      });
    }
    return out;
  }, [models, markets]);

  return (
    <group>
      {arcs.map((arc, i) => {
        // Compute a curved 3-point bezier-ish arc — bowed up in z
        const mid: [number, number, number] = [
          (arc.from[0] + arc.to[0]) / 2,
          (arc.from[1] + arc.to[1]) / 2,
          Math.max(arc.from[2], arc.to[2]) + 220,
        ];
        // Sample a quadratic bezier for a smooth curve
        const points: [number, number, number][] = [];
        const STEPS = 32;
        for (let s = 0; s <= STEPS; s++) {
          const t = s / STEPS;
          const x = (1 - t) * (1 - t) * arc.from[0] + 2 * (1 - t) * t * mid[0] + t * t * arc.to[0];
          const y = (1 - t) * (1 - t) * arc.from[1] + 2 * (1 - t) * t * mid[1] + t * t * arc.to[1];
          const z = (1 - t) * (1 - t) * arc.from[2] + 2 * (1 - t) * t * mid[2] + t * t * arc.to[2];
          points.push([x, y, z]);
        }
        return (
          <group key={i}>
            <Line
              points={points}
              color={arc.color}
              lineWidth={1.8}
              transparent
              opacity={0.45}
              dashed={false}
            />
            {/* Three particles staggered along the arc — reads as "data
                flowing", proves the connection isn't decorative. */}
            <ArcParticle from={arc.from} mid={mid} to={arc.to} color={arc.color} phase={0} />
            <ArcParticle from={arc.from} mid={mid} to={arc.to} color={arc.color} phase={0.33} />
            <ArcParticle from={arc.from} mid={mid} to={arc.to} color={arc.color} phase={0.66} />
          </group>
        );
      })}
    </group>
  );
}

function ArcParticle({
  from,
  mid,
  to,
  color,
  phase,
}: {
  from: [number, number, number];
  mid: [number, number, number];
  to: [number, number, number];
  color: string;
  phase: number;
}) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = ((state.clock.elapsedTime * 0.18 + phase) % 1);
    const x = (1 - t) * (1 - t) * from[0] + 2 * (1 - t) * t * mid[0] + t * t * to[0];
    const y = (1 - t) * (1 - t) * from[1] + 2 * (1 - t) * t * mid[1] + t * t * to[1];
    const z = (1 - t) * (1 - t) * from[2] + 2 * (1 - t) * t * mid[2] + t * t * to[2];
    ref.current.position.set(x, y, z);
    // Fade in/out at endpoints so particle "births" and "dies" smoothly
    const fade = Math.sin(t * Math.PI);
    const mat = ref.current.material as THREE.MeshBasicMaterial;
    mat.opacity = 0.85 * fade;
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[3.5, 12, 12]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.85}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

/* ---------- Wandering minion capsules ---------- */

type MinionPersona = {
  slug: string;
  name: string;
  color: string;
  emoji: string;
  address: string | null;
  token_id: number | null;
};

/** Lazily fetched persona roster. The 3 minted iNFTs (Andy/Carl/Bea)
 *  appear as capsule minions wandering between regions. Each capsule
 *  bounces in idle and slowly drifts along a Lissajous curve so the
 *  cosmos has *life* even when the user isn't interacting. */
export function MinionCapsules() {
  const [personas, setPersonas] = useState<MinionPersona[]>([]);

  useEffect(() => {
    fetch(`${API_URL}/agent/personas`)
      .then((r) => r.json())
      .then((d: { personas: MinionPersona[] }) => setPersonas(d.personas ?? []))
      .catch(() => setPersonas([]));
  }, []);

  return (
    <group>
      {personas.map((p, i) => (
        <MinionCapsule key={p.slug} persona={p} index={i} />
      ))}
    </group>
  );
}

function MinionCapsule({ persona, index }: { persona: MinionPersona; index: number }) {
  const ref = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const router = useRouter();

  const color = useMemo(() => new THREE.Color(persona.color), [persona.color]);

  // Each minion has its own Lissajous frequency seed for non-repeating drift
  const seed = index * 1.7 + 0.3;

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    // Slower Lissajous drift — the cosmos turns *slowly*. Bounce stays
    // because these are characters; characters are allowed to bounce.
    const x = Math.sin(t * 0.1 + seed) * 480;
    const y = Math.cos(t * 0.075 + seed * 1.3) * 380;
    const z = Math.sin(t * 0.12 + seed * 0.7) * 60 + 40;
    const bounce = Math.sin(t * 2.2 + seed) * 3;
    ref.current.position.set(x, y + bounce, z);
    ref.current.rotation.z = Math.sin(t * 0.5 + seed) * 0.08;
    const target = hovered ? 1.4 : 1;
    const cur = ref.current.scale.x;
    ref.current.scale.setScalar(cur + (target - cur) * 0.18);
  });

  return (
    <group
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
        router.push("/agent");
      }}
    >
      {/* The capsule body — cylinder + sphere caps for r142- compatibility */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[8, 8, 16, 16, 1, false]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.4}
          roughness={0.3}
          metalness={0.5}
        />
      </mesh>
      <mesh position={[0, 8, 0]}>
        <sphereGeometry args={[8, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.4}
          roughness={0.3}
          metalness={0.5}
        />
      </mesh>
      <mesh position={[0, -8, 0]} rotation={[Math.PI, 0, 0]}>
        <sphereGeometry args={[8, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.4}
          roughness={0.3}
          metalness={0.5}
        />
      </mesh>

      {/* Two small "eye" dots on the capsule front so it feels alive */}
      <mesh position={[3.2, 4, 7.5]}>
        <sphereGeometry args={[1.1, 8, 8]} />
        <meshBasicMaterial color="#030305" />
      </mesh>
      <mesh position={[-3.2, 4, 7.5]}>
        <sphereGeometry args={[1.1, 8, 8]} />
        <meshBasicMaterial color="#030305" />
      </mesh>

      {/* Hover label */}
      {hovered && (
        <Billboard position={[0, 22, 0]}>
          <Text
            fontSize={11}
            color={persona.color}
            anchorX="center"
            anchorY="bottom"
            outlineWidth={0.5}
            outlineColor="#030305"
          >
            {persona.emoji} {persona.name}
          </Text>
          <Text
            position={[0, -3, 0]}
            fontSize={8}
            color="#aaa"
            anchorX="center"
            anchorY="top"
          >
            persona iNFT · click to inspect
          </Text>
        </Billboard>
      )}
    </group>
  );
}
