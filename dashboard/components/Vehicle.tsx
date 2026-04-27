"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useBox, useRaycastVehicle } from "@react-three/cannon";
import type { WheelInfoOptions } from "@react-three/cannon";
import * as THREE from "three";

import { useKeyboardControls } from "@/lib/keyboard";

/**
 * Minimal RaycastVehicle. Adapted from pmndrs/racing-game (MIT) — see
 * dashboard/lib/ATTRIBUTIONS.md. Wheel-info construction (front/back +
 * chassisConnectionPointLocal) and the engine/steering/brake API call
 * sequence are recognizably the same; everything else is fresh code.
 */

const CHASSIS = { width: 1.6, height: 0.45, length: 3.6 };
const MASS = 500;
const WHEEL_RADIUS = 0.38;

const WHEEL_INFO: WheelInfoOptions = {
  radius: WHEEL_RADIUS,
  directionLocal: [0, -1, 0],
  axleLocal: [-1, 0, 0],
  suspensionStiffness: 30,
  suspensionRestLength: 0.3,
  frictionSlip: 1.4,
  dampingRelaxation: 2.3,
  dampingCompression: 4.4,
  maxSuspensionForce: 100000,
  rollInfluence: 0.01,
  maxSuspensionTravel: 0.3,
  customSlidingRotationalSpeed: -30,
  useCustomSlidingRotationalSpeed: true,
};

const FORCE = 1500;
const MAX_BRAKE = 50;
const MAX_STEER = 0.5;

export type VehicleHandle = {
  applyImpulse: (impulse: [number, number, number]) => void;
  setPosition: (pos: [number, number, number]) => void;
  getPosition: () => [number, number, number];
};

export type VehicleProps = {
  position?: [number, number, number];
  color?: string;
  controllable?: boolean;
};

export const Vehicle = forwardRef<VehicleHandle, VehicleProps>(function Vehicle(
  { position = [0, 1.4, 0], color = "#00d4aa", controllable = true },
  ref,
) {
  const controls = useKeyboardControls();

  const [chassisRef, chassisApi] = useBox(
    () => ({
      mass: MASS,
      position,
      args: [CHASSIS.width, CHASSIS.height, CHASSIS.length],
      allowSleep: false,
      angularDamping: 0.4,
      linearDamping: 0.05,
    }),
    useRef<THREE.Object3D>(null),
  );

  const wheel0 = useRef<THREE.Object3D>(null);
  const wheel1 = useRef<THREE.Object3D>(null);
  const wheel2 = useRef<THREE.Object3D>(null);
  const wheel3 = useRef<THREE.Object3D>(null);
  const wheels = [wheel0, wheel1, wheel2, wheel3];

  const wheelInfos = wheels.map((_, i) => {
    const isFront = i < 2;
    const left = i % 2 === 0;
    return {
      ...WHEEL_INFO,
      chassisConnectionPointLocal: [
        left ? -CHASSIS.width / 2 : CHASSIS.width / 2,
        0,
        isFront ? CHASSIS.length / 2 - 0.6 : -CHASSIS.length / 2 + 0.6,
      ] as [number, number, number],
      isFrontWheel: isFront,
    };
  });

  const [, vehicleApi] = useRaycastVehicle(() => ({
    chassisBody: chassisRef,
    wheels,
    wheelInfos,
    indexRightAxis: 0,
    indexUpAxis: 1,
    indexForwardAxis: 2,
  }));

  // Imperative handle exposes simple controls for the race engine to
  // teleport / nudge the car between scripted checkpoints.
  const positionRef = useRef<[number, number, number]>(position);
  useEffect(() => {
    const unsub = chassisApi.position.subscribe((p) => {
      positionRef.current = [p[0], p[1], p[2]];
    });
    return unsub;
  }, [chassisApi]);

  useImperativeHandle(ref, () => ({
    applyImpulse: (impulse) => {
      chassisApi.applyImpulse(impulse, [0, 0, 0]);
    },
    setPosition: (pos) => chassisApi.position.set(...pos),
    getPosition: () => positionRef.current,
  }));

  useFrame((_state, delta) => {
    if (!controllable) return;
    const c = controls.current;
    const dir = c.forward && !c.backward ? -1 : c.backward && !c.forward ? 1 : 0;
    const turn = c.left && !c.right ? 1 : c.right && !c.left ? -1 : 0;

    // engine on rear wheels (indices 2, 3)
    vehicleApi.applyEngineForce(dir * FORCE, 2);
    vehicleApi.applyEngineForce(dir * FORCE, 3);
    // steering on front wheels (indices 0, 1)
    vehicleApi.setSteeringValue(turn * MAX_STEER, 0);
    vehicleApi.setSteeringValue(turn * MAX_STEER, 1);
    // brake all four
    const brakeForce = c.brake ? MAX_BRAKE : 0;
    for (let i = 0; i < 4; i++) vehicleApi.setBrake(brakeForce, i);
  });

  return (
    <group>
      {/* chassis */}
      <mesh ref={chassisRef as React.Ref<THREE.Mesh>} castShadow>
        <boxGeometry args={[CHASSIS.width, CHASSIS.height, CHASSIS.length]} />
        <meshStandardMaterial
          color="#0a0a10"
          emissive={color}
          emissiveIntensity={0.4}
          metalness={0.7}
          roughness={0.3}
        />
        {/* glowing accent strip on top */}
        <mesh position={[0, CHASSIS.height / 2 + 0.01, 0]}>
          <boxGeometry args={[CHASSIS.width * 0.2, 0.03, CHASSIS.length * 0.7]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      </mesh>

      {/* wheels */}
      {wheels.map((wheelRef, i) => (
        <mesh ref={wheelRef as React.Ref<THREE.Mesh>} key={i} castShadow>
          <cylinderGeometry args={[WHEEL_RADIUS, WHEEL_RADIUS, 0.28, 16]} />
          <meshStandardMaterial color="#181820" roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
});
