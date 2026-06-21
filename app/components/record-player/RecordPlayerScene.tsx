"use client";

import { Canvas } from "@react-three/fiber";
import { ContactShadows, Environment, OrbitControls } from "@react-three/drei";
import VinylDisc from "./VinylDisc";
import Tonearm from "./Tonearm";

type Props = {
  isPlaying: boolean;
  onTogglePlay: () => void;
  title: string;
  artist?: string;
};

function TurntableScene({ isPlaying, onTogglePlay, title, artist }: Props) {
  return (
    <>
      <ambientLight intensity={0.45} />
      <directionalLight castShadow intensity={1.2} position={[2.5, 4, 2]} />
      <directionalLight intensity={0.35} position={[-3, 2, -1]} />
      <Environment preset="city" />

      <mesh position={[0, -0.02, 0]} receiveShadow>
        <boxGeometry args={[3.8, 0.32, 3.4]} />
        <meshStandardMaterial color="#2a2420" metalness={0.35} roughness={0.72} />
      </mesh>

      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[1.58, 1.58, 0.05, 64]} />
        <meshStandardMaterial color="#1c1814" metalness={0.4} roughness={0.65} />
      </mesh>

      <mesh position={[0, 0.13, 0]}>
        <cylinderGeometry args={[1.42, 1.42, 0.02, 64]} />
        <meshStandardMaterial color="#3d3530" metalness={0.2} roughness={0.85} />
      </mesh>

      <VinylDisc artist={artist} isPlaying={isPlaying} onToggle={onTogglePlay} title={title} />
      <Tonearm isPlaying={isPlaying} />

      <ContactShadows blur={2.5} opacity={0.55} position={[0, 0.01, 0]} scale={8} />

      <OrbitControls enablePan={false} enableZoom={false} maxPolarAngle={Math.PI / 2.05} minPolarAngle={Math.PI / 4.2} />
    </>
  );
}

export default function RecordPlayerScene({ isPlaying, onTogglePlay, title, artist }: Props) {
  return (
    <div className="record-player-canvas-wrap">
      <Canvas camera={{ position: [0, 2.6, 3.2], fov: 40 }} dpr={[1, 2]} shadows>
        <TurntableScene artist={artist} isPlaying={isPlaying} onTogglePlay={onTogglePlay} title={title} />
      </Canvas>
      <p className="muted record-player-hint">Click the vinyl to play or pause</p>
    </div>
  );
}
