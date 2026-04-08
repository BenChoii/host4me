import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Float, MeshTransmissionMaterial, Sparkles, Environment } from '@react-three/drei';
import { useMouseParallax } from './useMouseParallax';

const PRIMARY = '#6366f1';
const PRIMARY_LIGHT = '#a5b4fc';

function GlassShape({ geometry, position, scale = 1, floatSpeed = 2, floatIntensity = 0.5, rotationIntensity = 0.3 }) {
  return (
    <Float speed={floatSpeed} rotationIntensity={rotationIntensity} floatIntensity={floatIntensity}>
      <mesh position={position} scale={scale}>
        {geometry}
        <MeshTransmissionMaterial
          backside
          thickness={0.5}
          chromaticAberration={0.3}
          anisotropy={0.3}
          color={PRIMARY}
          transmission={0.92}
          roughness={0.1}
          envMapIntensity={1.5}
          ior={1.5}
        />
      </mesh>
    </Float>
  );
}

export default function HeroScene({ scrollProgress }) {
  const groupRef = useRef();

  useMouseParallax(0.3);

  useFrame(() => {
    if (!groupRef.current) return;
    const p = scrollProgress.current.hero;
    // Scale down and drift as user scrolls past hero
    const s = 1 - p * 0.4;
    groupRef.current.scale.set(s, s, s);
    groupRef.current.position.y = -p * 3;
    groupRef.current.rotation.y = p * 0.5;
  });

  return (
    <group ref={groupRef}>
      {/* Main torus knot — left side */}
      <GlassShape
        position={[-2.5, 0.8, -3]}
        scale={0.9}
        floatSpeed={2}
        floatIntensity={0.5}
        rotationIntensity={0.4}
        geometry={<torusKnotGeometry args={[0.8, 0.25, 128, 32]} />}
      />

      {/* Icosahedron — right side */}
      <GlassShape
        position={[2.8, -0.3, -4]}
        scale={1.1}
        floatSpeed={1.5}
        floatIntensity={0.8}
        rotationIntensity={0.2}
        geometry={<icosahedronGeometry args={[1, 0]} />}
      />

      {/* Octahedron — top center-right */}
      <GlassShape
        position={[1, 2, -5]}
        scale={0.7}
        floatSpeed={1.8}
        floatIntensity={0.6}
        rotationIntensity={0.5}
        geometry={<octahedronGeometry args={[1, 0]} />}
      />

      {/* Small sphere — bottom left */}
      <GlassShape
        position={[-1.5, -1.8, -2]}
        scale={0.5}
        floatSpeed={2.5}
        floatIntensity={0.4}
        rotationIntensity={0.3}
        geometry={<sphereGeometry args={[1, 32, 32]} />}
      />

      {/* Dodecahedron — far back center */}
      <GlassShape
        position={[0, 0.5, -7]}
        scale={1.3}
        floatSpeed={1.2}
        floatIntensity={0.3}
        rotationIntensity={0.15}
        geometry={<dodecahedronGeometry args={[1, 0]} />}
      />

      {/* Copper particle field */}
      <Sparkles
        count={200}
        scale={14}
        size={2.5}
        speed={0.3}
        color={PRIMARY}
        opacity={0.5}
      />

      {/* Secondary subtle white particles */}
      <Sparkles
        count={100}
        scale={16}
        size={1.5}
        speed={0.2}
        color={PRIMARY_LIGHT}
        opacity={0.25}
      />

      {/* Copper point light — top right, matching CSS radial glow */}
      <pointLight position={[5, 4, 3]} color={PRIMARY} intensity={3} distance={20} />

      {/* Subtle fill light */}
      <ambientLight intensity={0.08} />

      {/* Dark environment for moody reflections */}
      <Environment preset="night" />
    </group>
  );
}
