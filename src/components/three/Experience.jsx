import { Float, MeshDistortMaterial } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useRef, useEffect, useState } from "react";
import * as THREE from "three";
import { motion } from "motion/react";
import { SignedIn, SignedOut, SignInButton } from '@clerk/clerk-react';

function Scene() {
  const groupRef = useRef(null);
  const houseRef = useRef(null);
  const dataNodesRef = useRef(null);
  const waveformRef = useRef(null);
  const scrollRef = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      scrollRef.current = maxScroll > 0 ? window.scrollY / maxScroll : 0;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useFrame((state) => {
    const offset = scrollRef.current;

    const targetZ = 5 + offset * 15;
    const targetY = 1 - offset * 4;
    const targetX = Math.sin(offset * Math.PI) * 2;

    state.camera.position.lerp(new THREE.Vector3(targetX, targetY, targetZ), 0.1);
    state.camera.lookAt(0, 0, 0);

    if (groupRef.current) {
      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, offset * Math.PI * 2, 0.1);
    }

    if (houseRef.current) {
      const scale = 1 + offset * 0.5;
      houseRef.current.scale.setScalar(scale);
      houseRef.current.rotation.z = offset * 0.2;
    }

    if (dataNodesRef.current) {
      dataNodesRef.current.children.forEach((child, i) => {
        const t = state.clock.elapsedTime + i;
        child.position.y += Math.sin(t) * 0.002;
        child.scale.setScalar(0.5 + Math.sin(t * 2) * 0.2);
        child.position.multiplyScalar(0.99);
      });
    }

    if (waveformRef.current) {
      waveformRef.current.children.forEach((child, i) => {
        const scaleY = 0.1 + Math.abs(Math.sin(state.clock.elapsedTime * 5 + i * 0.5)) * (offset * 5);
        child.scale.y = THREE.MathUtils.lerp(child.scale.y, scaleY, 0.1);
      });
      waveformRef.current.position.y = -2 + offset * 2;
      waveformRef.current.visible = offset > 0.1;
    }
  });

  return (
    <>
      <color attach="background" args={["#050505"]} />
      <fog attach="fog" args={["#050505", 5, 25]} />

      <ambientLight intensity={0.2} />
      <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={2} color="#f27d26" />
      <pointLight position={[-10, -10, -10]} intensity={1} color="#ffffff" />

      <group ref={groupRef}>
        <group ref={houseRef}>
          <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.5}>
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[2, 1.2, 1.5]} />
              <MeshDistortMaterial color="#111111" speed={1} distort={0.1} roughness={0.1} metalness={0.8} />
            </mesh>
            <mesh position={[0, 0.9, 0]} rotation={[0, Math.PI / 4, 0]}>
              <coneGeometry args={[1.8, 1, 4]} />
              <meshStandardMaterial color="#f27d26" metalness={0.5} roughness={0.2} />
            </mesh>
            <mesh position={[0.6, 0, 0.76]}>
              <planeGeometry args={[0.4, 0.4]} />
              <meshStandardMaterial color="#f27d26" emissive="#f27d26" emissiveIntensity={5} />
            </mesh>
            <mesh position={[-0.6, 0, 0.76]}>
              <planeGeometry args={[0.4, 0.4]} />
              <meshStandardMaterial color="#f27d26" emissive="#f27d26" emissiveIntensity={5} />
            </mesh>
          </Float>
        </group>

        <group ref={dataNodesRef}>
          {Array.from({ length: 40 }).map((_, i) => (
            <mesh key={i} position={[(Math.random() - 0.5) * 15, (Math.random() - 0.5) * 15, (Math.random() - 0.5) * 15]}>
              <sphereGeometry args={[0.08, 16, 16]} />
              <meshStandardMaterial color={i % 2 === 0 ? "#f27d26" : "#ffffff"} emissive={i % 2 === 0 ? "#f27d26" : "#ffffff"} emissiveIntensity={1} />
            </mesh>
          ))}
        </group>

        <group ref={waveformRef} position={[0, -3, 2]}>
          {Array.from({ length: 30 }).map((_, i) => (
            <mesh key={i} position={[(i - 15) * 0.15, 0, 0]}>
              <boxGeometry args={[0.05, 1, 0.05]} />
              <meshStandardMaterial color="#f27d26" emissive="#f27d26" emissiveIntensity={2} />
            </mesh>
          ))}
        </group>
      </group>

      <gridHelper args={[50, 50, "#111111", "#111111"]} position={[0, -2, 0]} />
    </>
  );
}

export default function Experience() {
  return <Scene />;
}

export function Overlay() {
  return (
    <div className="w-screen font-sans">
      {/* Hero */}
      <section className="h-screen flex flex-col items-center justify-center px-8 md:px-12 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="max-w-4xl">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-8 rounded-full border border-[#f27d26]/30 bg-[#f27d26]/10 text-[10px] font-semibold tracking-[0.2em] uppercase text-[#f27d26]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#f27d26] animate-pulse" />
            AI Property Management
          </div>
          <h1 className="text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-display font-extrabold tracking-[-0.05em] mb-8 leading-[0.9]">
            MEET <span className="text-[#f27d26]">ALFRED</span>
          </h1>
          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto mb-12 font-light leading-relaxed tracking-wide">
            The first AI property manager that learns how you talk, then handles your guests <span className="text-white/80 font-normal">24/7</span> with your unique voice.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <SignedOut>
              <SignInButton mode="modal">
                <button className="bg-[#f27d26] hover:bg-[#d96a1d] text-white px-10 py-4 rounded-full text-sm font-semibold tracking-wide transition-all transform hover:scale-105 shadow-[0_0_30px_rgba(242,125,38,0.3)] cursor-pointer">
                  Start Free Trial
                </button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <a href="/dashboard" className="bg-[#f27d26] hover:bg-[#d96a1d] text-white px-10 py-4 rounded-full text-sm font-semibold tracking-wide transition-all inline-block">
                Go to Dashboard
              </a>
            </SignedIn>
            <button className="bg-white/[0.03] hover:bg-white/[0.06] text-white/70 hover:text-white border border-white/[0.08] px-10 py-4 rounded-full text-sm font-semibold tracking-wide transition-all">
              Watch Demo
            </button>
          </div>
        </motion.div>
      </section>

      {/* Voice */}
      <section className="h-screen flex items-end justify-start px-12 md:px-32 pb-32">
        <motion.div initial={{ opacity: 0, x: -50 }} whileInView={{ opacity: 1, x: 0 }} transition={{ duration: 0.8 }} className="max-w-xl">
          <div className="text-[#f27d26] text-[11px] font-semibold mb-5 tracking-[0.2em] uppercase">Personalization</div>
          <h2 className="text-4xl sm:text-5xl md:text-7xl font-display font-extrabold tracking-[-0.04em] mb-6 leading-[1.05]">
            Your Voice,<br /><span className="text-[#f27d26]">Automated.</span>
          </h2>
          <p className="text-base md:text-lg text-white/50 font-light leading-relaxed mb-10 tracking-wide">
            Alfred analyzes your past guest communications to mirror your hospitality style. Whether you're formal, friendly, or funny — Alfred keeps it consistent.
          </p>
          <ul className="space-y-5">
            {["Tone matching", "Vocabulary learning", "Custom instructions"].map((item, i) => (
              <li key={i} className="flex items-center gap-4 text-white/60 text-sm tracking-wide">
                <div className="w-5 h-[1px] bg-[#f27d26]" />
                {item}
              </li>
            ))}
          </ul>
        </motion.div>
      </section>

      {/* 24/7 */}
      <section className="h-screen flex items-center justify-end px-8 md:px-24">
        <motion.div initial={{ opacity: 0, x: 50 }} whileInView={{ opacity: 1, x: 0 }} transition={{ duration: 0.8 }} className="max-w-xl text-right">
          <div className="text-[#f27d26] text-[11px] font-semibold mb-5 tracking-[0.2em] uppercase">Availability</div>
          <h2 className="text-4xl sm:text-5xl md:text-7xl font-display font-extrabold tracking-[-0.04em] mb-6 leading-[1.05]">
            Always On.<br /><span className="text-[#f27d26]">Always Ready.</span>
          </h2>
          <p className="text-base md:text-lg text-white/50 font-light leading-relaxed mb-10 tracking-wide">
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

      {/* How it Works */}
      <section className="h-screen flex flex-col items-center justify-center px-8 md:px-12">
        <h2 className="text-3xl sm:text-4xl md:text-6xl font-display font-extrabold tracking-[-0.04em] mb-16 text-center leading-[1.05]">
          Three Steps to <span className="text-[#f27d26]">Freedom</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full">
          {[
            { step: "01", title: "Connect", desc: "Link your Airbnb or Vrbo account. Takes 30 seconds." },
            { step: "02", title: "Train", desc: "Alfred reads your message history to learn your voice." },
            { step: "03", title: "Relax", desc: "Alfred handles the rest. You step in only when needed." }
          ].map((item, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.15 }}
              className="p-8 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-[#f27d26]/30 transition-all group">
              <div className="text-6xl font-display font-extrabold text-white/[0.04] group-hover:text-[#f27d26]/10 transition-colors mb-6 leading-none">{item.step}</div>
              <h3 className="text-xl font-display font-bold mb-3 tracking-tight">{item.title}</h3>
              <p className="text-white/40 text-sm font-light leading-relaxed tracking-wide">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="h-screen flex flex-col items-center justify-center px-8 md:px-12 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[#f27d26]/5" />
        <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} className="max-w-3xl relative z-10">
          <h2 className="text-5xl sm:text-6xl md:text-8xl font-display font-extrabold tracking-[-0.05em] mb-8 leading-[0.9]">
            READY TO<br /><span className="text-[#f27d26]">AUTOMATE?</span>
          </h2>
          <p className="text-lg text-white/40 mb-14 font-light max-w-lg mx-auto leading-relaxed tracking-wide">
            Join hosts across British Columbia who have reclaimed their time with Alfred.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <SignedOut>
              <SignInButton mode="modal">
                <button className="bg-[#f27d26] text-white px-12 py-4 rounded-full text-sm font-semibold tracking-wide hover:bg-[#d96a1d] transition-all shadow-[0_0_50px_rgba(242,125,38,0.2)] cursor-pointer">
                  Get Started Now
                </button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <a href="/dashboard" className="bg-[#f27d26] text-white px-12 py-4 rounded-full text-sm font-semibold tracking-wide hover:bg-[#d96a1d] transition-all inline-block">
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
