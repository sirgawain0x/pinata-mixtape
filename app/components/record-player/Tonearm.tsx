"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group } from "three";

type Props = {
  isPlaying: boolean;
};

const REST_ANGLE = -0.62;
const PLAY_ANGLE = -0.22;

export default function Tonearm({ isPlaying }: Props) {
  const armRef = useRef<Group>(null);
  const targetCue = isPlaying ? PLAY_ANGLE : REST_ANGLE;

  useFrame((_state, delta) => {
    if (!armRef.current) return;
    armRef.current.rotation.z += (targetCue - armRef.current.rotation.z) * Math.min(1, delta * 3.5);
  });

  return (
    <group position={[0.95, 0.38, -0.35]}>
      <mesh position={[0, -0.02, 0]}>
        <cylinderGeometry args={[0.14, 0.16, 0.1, 24]} />
        <meshStandardMaterial color="#6a5a48" metalness={0.85} roughness={0.25} />
      </mesh>

      <group ref={armRef} rotation={[0, 0, REST_ANGLE]}>
        <mesh position={[0, 0.02, 0.52]}>
          <boxGeometry args={[0.07, 0.07, 1.05]} />
          <meshStandardMaterial color="#d8ccb4" metalness={0.75} roughness={0.28} />
        </mesh>
        <mesh position={[0, 0.01, 1.08]} rotation={[0.4, 0, 0]}>
          <boxGeometry args={[0.09, 0.06, 0.18]} />
          <meshStandardMaterial color="#1a1410" metalness={0.5} roughness={0.45} />
        </mesh>
        <mesh position={[0, -0.02, 1.18]} rotation={[0.55, 0, 0]}>
          <coneGeometry args={[0.015, 0.05, 8]} />
          <meshStandardMaterial color="#c0c0c0" metalness={0.95} roughness={0.1} />
        </mesh>
      </group>
    </group>
  );
}
