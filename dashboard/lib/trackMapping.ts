/**
 * Procedural track generator: dependency graph → racing track geometry.
 *
 * Per CLAUDE.md mapping:
 *   depth (chain length)        → track length
 *   width (parallel sub-goals)  → lane count (visual width)
 *   branching (case splits)     → track forks
 *   convergence                 → merge points
 *   known-hard lemmas           → elevation / tight curves
 *
 * Output is consumed by `dashboard/components/Track.tsx`. The Catmull-Rom
 * spline through the centerline drives the road mesh; lane-marker
 * positions are sampled along the same curve. Spawn / finish are the two
 * endpoints.
 */
import * as THREE from "three";

export type GraphNode = {
  id: string;
  depth: number;        // 0 = root; higher = further along
  branchFactor: number; // >1 means a fork emerges here
  hardness?: number;    // 0..1; bumps elevation + tightens curve
};

export type GraphEdge = {
  from: string;
  to: string;
};

export type DependencyGraph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

export type TrackGeometry = {
  centerlinePoints: THREE.Vector3[];     // ordered, evenly-spaced
  roadMesh: THREE.BufferGeometry;        // ribbon along the spline
  laneMarkers: THREE.Vector3[];          // edge marker positions (left+right pairs)
  centerlineDashes: { position: THREE.Vector3; rotation: number }[]; // dashed midline
  spawnPoint: THREE.Vector3;
  spawnHeading: THREE.Vector3;           // unit vector pointing along the start
  finishPoint: THREE.Vector3;
  totalLength: number;                   // world units
};

const ROAD_WIDTH = 6;
const SAMPLES_PER_SEGMENT = 16;
const MARKER_SPACING = 4;

/**
 * Build a complete track from a dependency graph. The algorithm:
 *  1. Sort nodes by depth → walk in order.
 *  2. Emit one control point per node along an outward-spiraling polyline.
 *     Branching factor sweeps the heading sideways (forks). Hardness
 *     adds elevation and a sharper turn.
 *  3. Catmull-Rom through control points → smooth centerline.
 *  4. Extrude a ribbon (road) and sample lane markers along the centerline.
 */
export function buildTrack(graph: DependencyGraph): TrackGeometry {
  const nodes = [...graph.nodes].sort((a, b) => a.depth - b.depth);
  if (nodes.length < 2) {
    throw new Error("track requires at least 2 nodes");
  }

  const controlPoints = computeControlPoints(nodes);
  const curve = new THREE.CatmullRomCurve3(controlPoints, false, "centripetal", 0.5);
  const totalLength = curve.getLength();
  const sampleCount = Math.max(64, Math.floor(totalLength / 1.5));
  const centerlinePoints = curve.getSpacedPoints(sampleCount);

  const roadMesh = buildRoadGeometry(centerlinePoints, ROAD_WIDTH);
  const laneMarkers = sampleLaneMarkers(centerlinePoints, MARKER_SPACING, ROAD_WIDTH);
  const centerlineDashes = sampleCenterlineDashes(centerlinePoints, 3.5);

  const spawnPoint = centerlinePoints[0];
  const finishPoint = centerlinePoints[centerlinePoints.length - 1];
  const spawnHeading = centerlinePoints[1].clone().sub(spawnPoint).normalize();

  return {
    centerlinePoints,
    roadMesh,
    laneMarkers,
    centerlineDashes,
    spawnPoint,
    spawnHeading,
    finishPoint,
    totalLength,
  };
}

function computeControlPoints(nodes: GraphNode[]): THREE.Vector3[] {
  // Walk along +Z, perturbed by branchFactor (sideways) and hardness (up).
  const stepZ = 8; // spacing between depth steps
  let x = 0;
  let yawDeg = 0;
  const points: THREE.Vector3[] = [];

  nodes.forEach((node, i) => {
    // sideways drift driven by branchFactor (alternates left/right)
    const sideSign = i % 2 === 0 ? 1 : -1;
    const sideMagnitude = (node.branchFactor - 1) * 4 * sideSign;
    x += sideMagnitude * 0.4;

    // tighten heading on hard nodes
    yawDeg += (node.hardness ?? 0) * 30 * sideSign;

    const yaw = THREE.MathUtils.degToRad(yawDeg);
    const z = node.depth * stepZ;
    const y = (node.hardness ?? 0) * 1.8; // small elevation on hard nodes

    // small perpendicular offset by yaw to avoid pure straight line
    const offX = Math.sin(yaw) * 1.5;
    points.push(new THREE.Vector3(x + offX, y, z));
  });

  return points;
}

function buildRoadGeometry(
  centerline: THREE.Vector3[],
  width: number,
): THREE.BufferGeometry {
  const half = width / 2;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];

  const up = new THREE.Vector3(0, 1, 0);
  const tangent = new THREE.Vector3();
  const binormal = new THREE.Vector3();

  for (let i = 0; i < centerline.length; i++) {
    const cur = centerline[i];
    const next = centerline[Math.min(i + 1, centerline.length - 1)];
    const prev = centerline[Math.max(i - 1, 0)];
    tangent.copy(next).sub(prev).normalize();
    binormal.copy(tangent).cross(up).normalize();

    const left = cur.clone().addScaledVector(binormal, -half);
    const right = cur.clone().addScaledVector(binormal, half);
    positions.push(left.x, left.y, left.z);
    positions.push(right.x, right.y, right.z);
    const v = i / (centerline.length - 1);
    uvs.push(0, v);
    uvs.push(1, v);
    normals.push(0, 1, 0, 0, 1, 0);
  }

  for (let i = 0; i < centerline.length - 1; i++) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, c, b);
    indices.push(b, c, d);
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geom.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geom.setIndex(indices);
  return geom;
}

function sampleCenterlineDashes(
  centerline: THREE.Vector3[],
  spacing: number,
): { position: THREE.Vector3; rotation: number }[] {
  const dashes: { position: THREE.Vector3; rotation: number }[] = [];
  let accumulated = 0;
  for (let i = 1; i < centerline.length; i++) {
    const seg = centerline[i].clone().sub(centerline[i - 1]).length();
    accumulated += seg;
    if (accumulated >= spacing) {
      const cur = centerline[i];
      const next = centerline[Math.min(i + 1, centerline.length - 1)];
      const heading = next.clone().sub(cur).normalize();
      const rot = Math.atan2(heading.x, heading.z);
      dashes.push({
        position: cur.clone().add(new THREE.Vector3(0, 0.025, 0)),
        rotation: rot,
      });
      accumulated = 0;
    }
  }
  return dashes;
}

function sampleLaneMarkers(
  centerline: THREE.Vector3[],
  spacing: number,
  roadWidth: number,
): THREE.Vector3[] {
  const markers: THREE.Vector3[] = [];
  const half = roadWidth / 2 - 0.15;
  const up = new THREE.Vector3(0, 1, 0);
  const tangent = new THREE.Vector3();
  const binormal = new THREE.Vector3();

  let accumulated = 0;
  for (let i = 1; i < centerline.length; i++) {
    const seg = centerline[i].clone().sub(centerline[i - 1]).length();
    accumulated += seg;
    if (accumulated >= spacing) {
      const cur = centerline[i];
      const next = centerline[Math.min(i + 1, centerline.length - 1)];
      const prev = centerline[Math.max(i - 1, 0)];
      tangent.copy(next).sub(prev).normalize();
      binormal.copy(tangent).cross(up).normalize();
      markers.push(cur.clone().addScaledVector(binormal, -half).add(new THREE.Vector3(0, 0.02, 0)));
      markers.push(cur.clone().addScaledVector(binormal, half).add(new THREE.Vector3(0, 0.02, 0)));
      accumulated = 0;
    }
  }
  return markers;
}
