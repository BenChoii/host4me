import { Float, MeshDistortMaterial, Scroll, ScrollControls, useScroll } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { motion } from "motion/react";

function Scene() {
  const scroll = useScroll();
  const groupRef = useRef(null);
  const houseRef = useRef(null);
  const dataNodesRef = useRef(null);
  const waveformRef = useRef(null);

  useFrame((state) => {
    const offset = scroll.offset;
    
    // Smooth camera path
    const targetZ = 5 + offset * 15;
    const targetY = 1 - offset * 4;
    const targetX = Math.sin(offset * Math.PI) * 2;
    
    state.camera.position.lerp(new THREE.Vector3(targetX, targetY, targetZ), 0.1);
    state.camera.lookAt(0, 0, 0);

    if (groupRef.current) {
      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, offset * Math.PI * 2, 0.1);
    }

    if (houseRef.current) {
      // House "opens up" or transforms
      const scale = 1 + offset * 0.5;
      houseRef.current.scale.setScalar(scale);
      houseRef.current.rotation.z = offset * 0.2;
    }

    if (dataNodesRef.current) {
      dataNodesRef.current.children.forEach((child, i) => {
        const t = state.clock.elapsedTime + i;
        child.position.y += Math.sin(t) * 0.002;
        child.scale.setScalar(0.5 + Math.sin(t * 2) * 0.2);
        
        // Nodes cluster towards the center as we scroll
        const dist = 1 - offset;
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
      <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={2} color="#6366f1" />
      <pointLight position={[-10, -10, -10]} intensity={1} color="#ffffff" />

      <group ref={groupRef}>
        {/* Abstract "House" representation */}
        <group ref={houseRef}>
          <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.5}>
            {/* Main Body */}
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[2, 1.2, 1.5]} />
              <MeshDistortMaterial 
                color="#111111" 
                speed={1} 
                distort={0.1} 
                roughness={0.1}
                metalness={0.8}
              />
            </mesh>
            {/* Roof */}
            <mesh position={[0, 0.9, 0]} rotation={[0, Math.PI / 4, 0]}>
              <coneGeometry args={[1.8, 1, 4]} />
              <meshStandardMaterial color="#6366f1" metalness={0.5} roughness={0.2} />
            </mesh>
            {/* Windows (Glow) */}
            <mesh position={[0.6, 0, 0.76]}>
              <planeGeometry args={[0.4, 0.4]} />
              <meshStandardMaterial color="#6366f1" emissive="#6366f1" emissiveIntensity={5} />
            </mesh>
            <mesh position={[-0.6, 0, 0.76]}>
              <planeGeometry args={[0.4, 0.4]} />
              <meshStandardMaterial color="#6366f1" emissive="#6366f1" emissiveIntensity={5} />
            </mesh>
          </Float>
        </group>

        {/* Floating "AI Data" nodes */}
        <group ref={dataNodesRef}>
          {Array.from({ length: 40 }).map((_, i) => (
            <mesh
              key={i}
              position={[
                (Math.random() - 0.5) * 15,
                (Math.random() - 0.5) * 15,
                (Math.random() - 0.5) * 15,
              ]}
            >
              <sphereGeometry args={[0.08, 16, 16]} />
              <meshStandardMaterial 
                color={i % 2 === 0 ? "#6366f1" : "#ffffff"} 
                emissive={i % 2 === 0 ? "#6366f1" : "#ffffff"} 
                emissiveIntensity={1} 
              />
            </mesh>
          ))}
        </group>

        {/* Voice Waveform */}
        <group ref={waveformRef} position={[0, -3, 2]}>
          {Array.from({ length: 30 }).map((_, i) => (
            <mesh key={i} position={[(i - 15) * 0.15, 0, 0]}>
              <boxGeometry args={[0.05, 1, 0.05]} />
              <meshStandardMaterial color="#6366f1" emissive="#6366f1" emissiveIntensity={2} />
            </mesh>
          ))}
        </group>
      </group>

      {/* Grid Floor */}
      <gridHelper args={[50, 50, "#111111", "#111111"]} position={[0, -2, 0]} />
    </>
  );
}

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

function Overlay() {
  return (
    <div className="w-screen font-sans">
      {/* Hero Section */}
      <section className="h-screen flex flex-col items-center justify-center px-8 md:px-12 text-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-4xl"
        >
          <div className="inline-block px-4 py-1.5 mb-6 rounded-full border border-[#6366f1]/30 bg-[#6366f1]/10 text-[#6366f1] text-xs font-bold tracking-widest uppercase">
            AI Property Management
          </div>
          <h1 className="text-6xl md:text-9xl font-display font-extrabold tracking-tighter mb-6 leading-none">
            MEET <span className="text-[#6366f1]">ALFRED</span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 max-w-2xl mx-auto mb-10 font-light leading-relaxed">
            The first AI Property Manager that learns how you talk, then handles your guests 24/7 with your unique voice.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="bg-[#6366f1] hover:bg-[#4f46e5] text-white px-10 py-5 rounded-full text-lg font-bold transition-all transform hover:scale-105 shadow-[0_0_30px_rgba(99,102,241,0.3)]">
              Start Free Trial
            </button>
            <button className="bg-white/5 hover:bg-white/10 text-white border border-white/10 px-10 py-5 rounded-full text-lg font-bold transition-all">
              Watch Demo
            </button>
          </div>
        </motion.div>
      </section>

      {/* Feature 1: Voice */}
      <section className="h-screen flex items-center justify-start px-8 md:px-24">
        <motion.div 
          initial={{ opacity: 0, x: -50 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-xl"
        >
          <div className="text-[#6366f1] font-bold mb-4 tracking-widest uppercase text-sm">Personalization</div>
          <h2 className="text-5xl md:text-7xl font-display font-bold mb-6 leading-tight">
            Your Voice, <br />
            <span className="text-[#6366f1]">Automated.</span>
          </h2>
          <p className="text-xl text-gray-300 font-light leading-relaxed mb-8">
            Alfred analyzes your past guest communications to mirror your hospitality style. Whether you're formal, friendly, or funny, Alfred keeps it consistent.
          </p>
          <ul className="space-y-4">
            {["Tone matching", "Vocabulary learning", "Custom instructions"].map((item, i) => (
              <li key={i} className="flex items-center gap-3 text-gray-300">
                <div className="w-1.5 h-1.5 rounded-full bg-[#6366f1]" />
                {item}
              </li>
            ))}
          </ul>
        </motion.div>
      </section>

      {/* Feature 2: 24/7 */}
      <section className="h-screen flex items-center justify-end px-8 md:px-24">
        <motion.div 
          initial={{ opacity: 0, x: 50 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-xl text-right"
        >
          <div className="text-[#6366f1] font-bold mb-4 tracking-widest uppercase text-sm">Availability</div>
          <h2 className="text-5xl md:text-7xl font-display font-bold mb-6 leading-tight">
            Always On. <br />
            <span className="text-[#6366f1]">Always Ready.</span>
          </h2>
          <p className="text-xl text-gray-300 font-light leading-relaxed mb-8">
            While you sleep, Alfred is working. From check-in instructions at 3 AM to troubleshooting Wi-Fi at noon, your guests are always taken care of.
          </p>
          <div className="flex gap-4 justify-end">
            <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
              <div className="text-2xl font-bold text-white">0s</div>
              <div className="text-xs text-gray-400 uppercase tracking-widest">Response Time</div>
            </div>
            <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
              <div className="text-2xl font-bold text-white">100%</div>
              <div className="text-xs text-gray-400 uppercase tracking-widest">Guest Satisfaction</div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* How it Works */}
      <section className="h-screen flex flex-col items-center justify-center px-8 md:px-12">
        <h2 className="text-4xl md:text-6xl font-display font-bold mb-16 text-center">
          Three Steps to <span className="text-[#6366f1]">Freedom</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl w-full">
          {[
            { step: "01", title: "Connect", desc: "Link your Airbnb or Vrbo account in seconds." },
            { step: "02", title: "Train", desc: "Alfred reads your history to learn your style." },
            { step: "03", title: "Relax", desc: "Alfred handles the rest. You only step in when needed." }
          ].map((item, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.2 }}
              className="p-8 rounded-3xl bg-white/5 border border-white/10 hover:border-[#6366f1]/50 transition-colors group"
            >
              <div className="text-5xl font-display font-black text-white/10 group-hover:text-[#6366f1]/20 transition-colors mb-4">{item.step}</div>
              <h3 className="text-2xl font-bold mb-4">{item.title}</h3>
              <p className="text-gray-300 font-light">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="h-screen flex flex-col items-center justify-center px-8 md:px-12 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[#6366f1]/5 radial-gradient" />
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          className="max-w-3xl relative z-10"
        >
          <h2 className="text-6xl md:text-8xl font-display font-bold mb-8 tracking-tighter">
            READY TO <br />
            <span className="text-[#6366f1]">AUTOMATE?</span>
          </h2>
          <p className="text-xl text-gray-300 mb-12 font-light max-w-xl mx-auto">
            Join hosts across British Columbia who have reclaimed their time with Alfred.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="bg-[#6366f1] text-white px-12 py-5 rounded-full text-xl font-bold hover:bg-[#4f46e5] transition-all shadow-[0_0_50px_rgba(99,102,241,0.2)]">
              Get Started Now
            </button>
            <button className="bg-white text-black px-12 py-5 rounded-full text-xl font-bold hover:bg-gray-200 transition-all">
              View Pricing
            </button>
          </div>
          <div className="mt-16 pt-16 border-t border-white/10 flex flex-wrap justify-center gap-8 opacity-50 grayscale">
            {/* Placeholder for partner logos */}
            <div className="text-xl font-bold tracking-tighter">AIRBNB</div>
            <div className="text-xl font-bold tracking-tighter">VRBO</div>
            <div className="text-xl font-bold tracking-tighter">BOOKING.COM</div>
            <div className="text-xl font-bold tracking-tighter">EXPEDIA</div>
          </div>
        </motion.div>
      </section>
      
      <footer className="py-12 px-8 border-t border-white/10 text-center text-gray-400 text-sm">
        <p>© 2026 Host4Me.ca — Built for Hosts in British Columbia</p>
      </footer>
    </div>
  );
}
