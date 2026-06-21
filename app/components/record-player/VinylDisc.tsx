"use client";

import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { useRef } from "react";
import type { Mesh } from "three";

type Props = {
  isPlaying: boolean;
  onToggle: () => void;
  title: string;
  artist?: string;
};

const TARGET_RPM = 1.75;

export default function VinylDisc({ isPlaying, onToggle, title, artist }: Props) {
  const discRef = useRef<Mesh>(null);
  const spinSpeed = useRef(0);
  const reducedMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useFrame((_state, delta) => {
    if (!discRef.current) return;
    const target = isPlaying && !reducedMotion ? TARGET_RPM : 0;
    spinSpeed.current += (target - spinSpeed.current) * Math.min(1, delta * 2.5);
    discRef.current.rotation.y -= spinSpeed.current * delta;
  });

  const grooves = Array.from({ length: 14 }, (_, index) => 0.28 + index * 0.07);

  return (
    <group onClick={onToggle}>
      <mesh ref={discRef} position={[0, 0.14, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[1.35, 1.35, 0.05, 64]} />
        <meshStandardMaterial color="#141018" metalness={0.55} roughness={0.28} />
      </mesh>

      {grooves.map((radius) => (
        <mesh key={radius} position={[0, 0.17, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[radius, 0.0025, 8, 64]} />
          <meshStandardMaterial color="#2a2430" metalness={0.8} roughness={0.2} />
        </mesh>
      ))}

      <mesh position={[0, 0.18, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.42, 0.42, 0.02, 48]} />
        <meshStandardMaterial color="#8b1a1a" metalness={0.2} roughness={0.55} />
      </mesh>

      <Text
        anchorX="center"
        anchorY="middle"
        color="#f8e8c8"
        fontSize={0.09}
        maxWidth={0.62}
        position={[0, 0.19, 0.08]}
        rotation={[-Math.PI / 2, 0, 0]}
        textAlign="center"
      >
        {title.slice(0, 28)}
      </Text>
      {artist ? (
        <Text
          anchorX="center"
          anchorY="middle"
          color="#d4c4a8"
          fontSize={0.06}
          maxWidth={0.58}
          position={[0, 0.19, -0.06]}
          rotation={[-Math.PI / 2, 0, 0]}
          textAlign="center"
        >
          {artist.slice(0, 32)}
        </Text>
      ) : null}

      <mesh position={[0, 0.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.03, 24]} />
        <meshStandardMaterial color="#c0c0c0" metalness={0.9} roughness={0.15} />
      </mesh>
    </group>
  );
}
