"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import VinylDisc from "./VinylDisc";
import Tonearm from "./Tonearm";

type Props = {
  isPlaying: boolean;
  onTogglePlay: () => void;
};

function TurntableScene({ isPlaying, onTogglePlay }: Props) {
  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight castShadow intensity={1.1} position={[2.5, 4, 2]} />
      <directionalLight intensity={0.35} position={[-3, 2, -1]} />
      <mesh position={[0, 0, 0]} receiveShadow>
        <boxGeometry args={[3.6, 0.28, 3.2]} />
        <meshStandardMaterial color="#3d2f28" metalness={0.15} roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[1.55, 1.55, 0.04, 64]} />
        <meshStandardMaterial color="#121018" metalness={0.25} roughness={0.7} />
      </mesh>
      <VinylDisc isPlaying={isPlaying} onToggle={onTogglePlay} />
      <Tonearm isPlaying={isPlaying} />
      <OrbitControls enablePan={false} enableZoom={false} maxPolarAngle={Math.PI / 2.1} minPolarAngle={Math.PI / 4} />
    </>
  );
}

export default function RecordPlayerScene({ isPlaying, onTogglePlay }: Props) {
  return (
    <div className="record-player-canvas-wrap">
      <Canvas camera={{ position: [0, 2.8, 3.4], fov: 42 }} dpr={[1, 2]}>
        <TurntableScene isPlaying={isPlaying} onTogglePlay={onTogglePlay} />
      </Canvas>
      <p className="muted record-player-hint">Click the vinyl to play or pause</p>
    </div>
  );
}
