"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group } from "three";

type Props = {
  isPlaying: boolean;
};

export default function Tonearm({ isPlaying }: Props) {
  const armRef = useRef<Group>(null);
  const targetCue = isPlaying ? -0.28 : -0.55;

  useFrame((_state, delta) => {
    if (!armRef.current) return;
    armRef.current.rotation.z += (targetCue - armRef.current.rotation.z) * Math.min(1, delta * 4);
  });

  return (
    <group position={[0.95, 0.35, -0.35]}>
      <group ref={armRef} rotation={[0, 0, -0.55]}>
        <mesh position={[0, 0, 0.55]}>
          <boxGeometry args={[0.08, 0.08, 1.1]} />
          <meshStandardMaterial color="#d4c4a8" metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh position={[0, -0.04, 1.12]} rotation={[0.35, 0, 0]}>
          <boxGeometry args={[0.06, 0.12, 0.22]} />
          <meshStandardMaterial color="#2a2430" metalness={0.4} roughness={0.5} />
        </mesh>
      </group>
      <mesh position={[0, -0.02, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 0.08, 24]} />
        <meshStandardMaterial color="#8a7a62" metalness={0.8} roughness={0.25} />
      </mesh>
    </group>
  );
}
