import {
  Float, Sparkles, Environment,
  Scroll, ScrollControls, useScroll
} from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef, useMemo } from "react";
import * as THREE from "three";
import { motion } from "motion/react";
import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/clerk-react';
import PostProcessing from "./PostProcessing";
import { useMouseParallax } from "./useMouseParallax";

/* ═══════════════════════════════════════════
   GLASS ORB — The core visual element
   ═══════════════════════════════════════════ */
function GlassOrb({ position = [0, 0, 0], scale = 1, emissiveIntensity = 2 }) {
  return (
    <Float speed={1.5} rotationIntensity={0.15} floatIntensity={0.3}>
      <group position={position} scale={scale}>
        {/* Outer glass shell — subtle, dark, not dominant */}
        <mesh>
          <sphereGeometry args={[1, 64, 64]} />
          <meshStandardMaterial
            color="#0a0a1a"
            metalness={0.9}
            roughness={0.15}
            envMapIntensity={0.4}
            transparent
            opacity={0.6}
          />
        </mesh>
        {/* Inner emissive core — the main visual */}
        <mesh scale={0.3}>
          <sphereGeometry args={[1, 32, 32]} />
          <meshStandardMaterial
            color="#818cf8"
            emissive="#6366f1"
            emissiveIntensity={emissiveIntensity}
            toneMapped={false}
          />
        </mesh>
        {/* Glow halo ring */}
        <mesh rotation={[Math.PI / 2, 0, 0]} scale={1.1}>
          <torusGeometry args={[1, 0.01, 16, 64]} />
          <meshStandardMaterial
            color="#6366f1"
            emissive="#6366f1"
            emissiveIntensity={1}
            transparent
            opacity={0.3}
            toneMapped={false}
          />
        </mesh>
      </group>
    </Float>
  );
}

/* ═══════════════════════════════════════════
   SOUND RING — Expanding rings for Act 2
   ═══════════════════════════════════════════ */
function SoundRings({ active, progress }) {
  const groupRef = useRef();

  useFrame((state) => {
    if (!groupRef.current || !active) return;
    groupRef.current.children.forEach((ring, i) => {
      const phase = (state.clock.elapsedTime * 0.5 + i * 0.8) % 3;
      const s = 1 + phase * 1.5;
      ring.scale.set(s, s, s);
      ring.material.opacity = Math.max(0, 0.4 - phase * 0.15);
    });
  });

  return (
    <group ref={groupRef}>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1, 0.02, 16, 64]} />
          <meshStandardMaterial
            color="#818cf8"
            emissive="#6366f1"
            emissiveIntensity={3}
            transparent
            opacity={0}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

/* ═══════════════════════════════════════════
   NETWORK LINES — Connections for Act 3
   ═══════════════════════════════════════════ */
function NetworkLines({ positions, opacity }) {
  const linesRef = useRef();

  const lineGeometries = useMemo(() => {
    const geos = [];
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const points = [
          new THREE.Vector3(...positions[i]),
          new THREE.Vector3(...positions[j]),
        ];
        geos.push(new THREE.BufferGeometry().setFromPoints(points));
      }
    }
    return geos;
  }, [positions]);

  return (
    <group ref={linesRef}>
      {lineGeometries.map((geo, i) => (
        <line key={i} geometry={geo}>
          <lineBasicMaterial
            color="#6366f1"
            transparent
            opacity={opacity * 0.3}
            toneMapped={false}
          />
        </line>
      ))}
    </group>
  );
}

/* ═══════════════════════════════════════════
   MAIN SCENE — 4-act scroll-driven narrative
   ═══════════════════════════════════════════ */
function Scene() {
  const scroll = useScroll();
  const mainOrbRef = useRef();
  const smallOrbsRef = useRef();

  useMouseParallax(0.15);

  // Positions for Act 3 satellite orbs
  const satellitePositions = useMemo(() => [
    [-2.5, 1, -1],
    [2.5, -0.5, -1],
    [0, 2.5, -2],
    [-1.5, -2, -1.5],
  ], []);

  useFrame((state) => {
    const offset = scroll.offset;
    const act = offset < 0.25 ? 1 : offset < 0.5 ? 2 : offset < 0.75 ? 3 : 4;
    const actProgress = (offset % 0.25) / 0.25;

    // === CAMERA PATH — gentle movement, orb stays background ===
    let targetPos;
    if (act === 1) {
      targetPos = new THREE.Vector3(0, 0, 8);
    } else if (act === 2) {
      targetPos = new THREE.Vector3(
        THREE.MathUtils.lerp(0, -1.5, actProgress),
        THREE.MathUtils.lerp(0, 0.3, actProgress),
        8
      );
    } else if (act === 3) {
      targetPos = new THREE.Vector3(
        THREE.MathUtils.lerp(-1.5, 1.5, actProgress),
        THREE.MathUtils.lerp(0.3, 0.2, actProgress),
        8
      );
    } else {
      targetPos = new THREE.Vector3(
        THREE.MathUtils.lerp(1.5, 0, actProgress),
        THREE.MathUtils.lerp(0.2, 0, actProgress),
        THREE.MathUtils.lerp(8, 10, actProgress)
      );
    }
    state.camera.position.lerp(targetPos, 0.04);
    state.camera.lookAt(0, 0, 0);

    // === MAIN ORB — breathing + pulse ===
    if (mainOrbRef.current) {
      const breathe = 1 + Math.sin(state.clock.elapsedTime * 0.8) * 0.02;
      const voicePulse = act === 2 ? 1 + Math.sin(state.clock.elapsedTime * 4) * 0.05 * actProgress : 1;
      // In Act 3, shrink the main orb
      const networkShrink = act === 3 ? THREE.MathUtils.lerp(1, 0.6, actProgress) : act === 4 ? THREE.MathUtils.lerp(0.6, 1.1, actProgress) : 1;
      const s = breathe * voicePulse * networkShrink;
      mainOrbRef.current.scale.set(s, s, s);
    }

    // === SATELLITE ORBS — drift out in Act 3, converge in Act 4 ===
    if (smallOrbsRef.current) {
      smallOrbsRef.current.children.forEach((child, i) => {
        const target = satellitePositions[i];
        let drift;
        if (act < 3) {
          drift = 0;
        } else if (act === 3) {
          drift = actProgress;
        } else {
          drift = 1 - actProgress;
        }
        child.position.x = THREE.MathUtils.lerp(0, target[0], drift);
        child.position.y = THREE.MathUtils.lerp(0, target[1], drift);
        child.position.z = THREE.MathUtils.lerp(0, target[2], drift);
        child.visible = drift > 0.05;
      });
    }
  });

  const offset = scroll?.offset ?? 0;
  const act = offset < 0.25 ? 1 : offset < 0.5 ? 2 : offset < 0.75 ? 3 : 4;
  const actProgress = (offset % 0.25) / 0.25;
  const networkOpacity = act === 3 ? actProgress : act === 4 ? 1 - actProgress : 0;

  return (
    <>
      <color attach="background" args={["#050505"]} />
      <fog attach="fog" args={["#050505", 5, 20]} />

      <ambientLight intensity={0.08} />
      <spotLight position={[5, 8, 5]} angle={0.2} penumbra={1} intensity={2} color="#6366f1" />
      <pointLight position={[0, 0, 0]} intensity={1} color="#818cf8" distance={8} />

      <Environment preset="warehouse" environmentIntensity={0.1} />

      {/* Main orb — pushed back so text is readable */}
      <group ref={mainOrbRef} position={[0, -0.5, -2]}>
        <GlassOrb scale={0.8} emissiveIntensity={act === 4 ? 3 + actProgress * 2 : 2} />
      </group>

      {/* Sound rings — Act 2 */}
      <SoundRings active={act === 2} progress={actProgress} />

      {/* Satellite orbs — Acts 3 & 4 */}
      <group ref={smallOrbsRef}>
        {satellitePositions.map((pos, i) => (
          <GlassOrb key={i} scale={0.35} emissiveIntensity={1.5} />
        ))}
      </group>

      {/* Network connection lines — Act 3 */}
      <NetworkLines
        positions={[[0, 0, 0], ...satellitePositions]}
        opacity={networkOpacity}
      />

      {/* Sparkles — always present, spread in Act 3 */}
      <Sparkles
        count={200}
        scale={act >= 3 ? 16 : 10}
        size={2.5}
        speed={0.3}
        color="#6366f1"
        opacity={0.5}
      />
      <Sparkles
        count={100}
        scale={18}
        size={1.5}
        speed={0.15}
        color="#a5b4fc"
        opacity={0.2}
      />

      <PostProcessing />
    </>
  );
}

/* ═══════════════════════════════════════════
   EXPERIENCE — ScrollControls wrapper
   ═══════════════════════════════════════════ */
export default function Experience() {
  return (
    <ScrollControls pages={4} damping={0.1}>
      <Scene />
      <Scroll html>
        <Overlay />
      </Scroll>
    </ScrollControls>
  );
}

/* ═══════════════════════════════════════════
   OVERLAY — HTML content over 3D
   ═══════════════════════════════════════════ */
function Overlay() {
  return (
    <div className="w-screen font-sans">
      {/* Act 1: Hero */}
      <section className="h-screen flex flex-col items-center justify-center px-8 md:px-12 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-5xl"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-8 rounded-full border border-white/10 bg-white/5 text-[10px] font-semibold tracking-[0.2em] uppercase text-white/50">
            <span className="w-1.5 h-1.5 rounded-full bg-[#6366f1] animate-pulse" />
            AI Property Management
          </div>
          <h1 className="text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-display font-extrabold tracking-[-0.05em] mb-8 leading-[0.9]">
            Meet{' '}
            <span className="bg-gradient-to-r from-[#a5b4fc] via-[#818cf8] to-[#6366f1] bg-clip-text text-transparent">
              Alfred
            </span>
          </h1>
          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto mb-12 font-light leading-relaxed tracking-wide">
            The first AI property manager that learns how you talk,
            then handles your guests <span className="text-white/80 font-normal">24/7</span> with your unique voice.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <SignedOut>
              <SignInButton mode="modal">
                <button className="bg-[#6366f1] hover:bg-[#4f46e5] text-white px-10 py-4 rounded-full text-sm font-semibold tracking-wide transition-all transform hover:scale-105 shadow-[0_0_40px_rgba(99,102,241,0.25)] cursor-pointer">
                  Start Free Trial
                </button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <a href="/dashboard" className="bg-[#6366f1] hover:bg-[#4f46e5] text-white px-10 py-4 rounded-full text-sm font-semibold tracking-wide transition-all inline-block">
                Go to Dashboard
              </a>
            </SignedIn>
            <button className="bg-white/[0.03] hover:bg-white/[0.06] text-white/70 hover:text-white border border-white/[0.08] px-10 py-4 rounded-full text-sm font-semibold tracking-wide transition-all">
              Watch Demo
            </button>
          </div>
        </motion.div>
      </section>

      {/* Act 2: Voice */}
      <section className="h-screen flex items-center justify-start px-8 md:px-24">
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-xl"
        >
          <div className="text-[#818cf8] text-[11px] font-semibold mb-5 tracking-[0.2em] uppercase">Personalization</div>
          <h2 className="text-4xl sm:text-5xl md:text-7xl font-display font-extrabold tracking-[-0.04em] mb-6 leading-[1.05]">
            Your Voice,<br />
            <span className="bg-gradient-to-r from-[#a5b4fc] to-[#6366f1] bg-clip-text text-transparent">Automated.</span>
          </h2>
          <p className="text-base md:text-lg text-white/45 font-light leading-relaxed mb-10 tracking-wide">
            Alfred analyzes your past guest communications to mirror your hospitality style. Whether you're formal, friendly, or funny — Alfred keeps it consistent.
          </p>
          <ul className="space-y-5">
            {["Tone matching", "Vocabulary learning", "Custom instructions"].map((item, i) => (
              <li key={i} className="flex items-center gap-4 text-white/60 text-sm tracking-wide">
                <div className="w-5 h-[1px] bg-[#6366f1]" />
                {item}
              </li>
            ))}
          </ul>
        </motion.div>
      </section>

      {/* Act 3: Network */}
      <section className="h-screen flex items-center justify-end px-8 md:px-24">
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-xl text-right"
        >
          <div className="text-[#818cf8] text-[11px] font-semibold mb-5 tracking-[0.2em] uppercase">Availability</div>
          <h2 className="text-4xl sm:text-5xl md:text-7xl font-display font-extrabold tracking-[-0.04em] mb-6 leading-[1.05]">
            Always On.<br />
            <span className="bg-gradient-to-r from-[#6366f1] to-[#a5b4fc] bg-clip-text text-transparent">Always Ready.</span>
          </h2>
          <p className="text-base md:text-lg text-white/45 font-light leading-relaxed mb-10 tracking-wide">
            While you sleep, Alfred is working. From check-in instructions at 3 AM to troubleshooting Wi-Fi at noon — your guests are always taken care of.
          </p>
          <div className="flex gap-4 justify-end">
            <div className="bg-white/[0.03] px-6 py-5 rounded-2xl border border-white/[0.06]">
              <div className="text-3xl font-display font-extrabold text-white tracking-tight">0s</div>
              <div className="text-[10px] text-white/30 uppercase tracking-[0.15em] mt-1">Response Time</div>
            </div>
            <div className="bg-white/[0.03] px-6 py-5 rounded-2xl border border-white/[0.06]">
              <div className="text-3xl font-display font-extrabold text-white tracking-tight">100%</div>
              <div className="text-[10px] text-white/30 uppercase tracking-[0.15em] mt-1">Satisfaction</div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Act 4: CTA */}
      <section className="h-screen flex flex-col items-center justify-center px-8 md:px-12 text-center relative overflow-hidden">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          className="max-w-3xl relative z-10"
        >
          <div className="text-[#818cf8] text-[11px] font-semibold mb-5 tracking-[0.2em] uppercase">Getting Started</div>
          <h2 className="text-5xl sm:text-6xl md:text-8xl font-display font-extrabold tracking-[-0.05em] mb-6 leading-[0.9]">
            Ready to{' '}
            <span className="bg-gradient-to-r from-[#a5b4fc] via-[#818cf8] to-[#6366f1] bg-clip-text text-transparent">
              automate?
            </span>
          </h2>
          <p className="text-lg text-white/40 mb-14 font-light max-w-lg mx-auto leading-relaxed tracking-wide">
            Join hosts across British Columbia who have reclaimed their time with Alfred.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <SignedOut>
              <SignInButton mode="modal">
                <button className="bg-[#6366f1] text-white px-12 py-4 rounded-full text-sm font-semibold tracking-wide hover:bg-[#4f46e5] transition-all shadow-[0_0_60px_rgba(99,102,241,0.3)] cursor-pointer">
                  Get Started Now
                </button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <a href="/dashboard" className="bg-[#6366f1] text-white px-12 py-4 rounded-full text-sm font-semibold tracking-wide hover:bg-[#4f46e5] transition-all inline-block">
                Go to Dashboard
              </a>
            </SignedIn>
            <button className="bg-white text-black px-12 py-4 rounded-full text-sm font-semibold tracking-wide hover:bg-white/90 transition-all">
              View Pricing
            </button>
          </div>
          <div className="mt-20 pt-10 border-t border-white/[0.06] flex flex-wrap justify-center gap-10">
            {["AIRBNB", "VRBO", "BOOKING.COM", "EXPEDIA"].map((name) => (
              <div key={name} className="text-sm font-semibold tracking-[0.1em] text-white/15">{name}</div>
            ))}
          </div>
        </motion.div>
      </section>

      <footer className="py-16 px-8 border-t border-white/[0.06] text-center">
        <p className="text-xs text-white/25 tracking-[0.15em] uppercase">© 2026 Host4Me.ca — Built for Hosts in British Columbia</p>
      </footer>
    </div>
  );
}
