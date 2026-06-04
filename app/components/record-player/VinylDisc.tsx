"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Mesh } from "three";

type Props = {
  isPlaying: boolean;
  onToggle: () => void;
};

export default function VinylDisc({ isPlaying, onToggle }: Props) {
  const discRef = useRef<Mesh>(null);
  const reducedMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useFrame((_state, delta) => {
    if (!discRef.current || !isPlaying || reducedMotion) return;
    discRef.current.rotation.y += delta * 1.8;
  });

  return (
    <group onClick={onToggle}>
      <mesh ref={discRef} position={[0, 0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[1.35, 1.35, 0.06, 64]} />
        <meshStandardMaterial color="#1a1410" metalness={0.35} roughness={0.45} />
      </mesh>
      <mesh position={[0, 0.16, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.42, 0.42, 0.02, 48]} />
        <meshStandardMaterial color="#c9a962" metalness={0.6} roughness={0.25} />
      </mesh>
      <mesh position={[0, 0.17, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.03, 32]} />
        <meshStandardMaterial color="#0e0c10" metalness={0.2} roughness={0.8} />
      </mesh>
    </group>
  );
}
