import { Canvas } from "@react-three/fiber";
import { Suspense, useState, useEffect } from "react";
import Experience, { Overlay } from "../components/three/Experience";
import { Menu, X, Zap, MessageSquare, Shield, Home } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/clerk-react';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.innerWidth < 1024 || 'ontouchstart' in window;
  });
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024 || 'ontouchstart' in window);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  return isMobile;
}

function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { name: "Features", icon: Zap },
    { name: "How it Works", icon: MessageSquare },
    { name: "Security", icon: Shield },
    { name: "Pricing", icon: Home },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${
        isScrolled ? "bg-black/80 backdrop-blur-md py-4" : "bg-transparent py-6"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="text-xl font-display font-extrabold tracking-tight">
            host<span className="text-[#f27d26]">4</span>me
          </span>
        </div>

        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a key={link.name} href={`#${link.name.toLowerCase().replace(/\s+/g, '-')}`}
              className="text-sm font-medium text-gray-400 hover:text-white transition-colors">
              {link.name}
            </a>
          ))}
          <SignedOut>
            <SignInButton mode="modal">
              <button className="bg-white text-black px-6 py-2 rounded-full text-sm font-bold hover:bg-[#f27d26] hover:text-white transition-all cursor-pointer">
                Get Started
              </button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <a href="/dashboard" className="bg-[#f27d26] text-white px-6 py-2 rounded-full text-sm font-bold hover:bg-[#4f46e5] transition-all">Dashboard</a>
            <UserButton appearance={{ elements: { avatarBox: { width: 32, height: 32 } } }} />
          </SignedIn>
        </div>

        <button className="md:hidden text-white" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          {isMobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="absolute top-full left-0 w-full bg-black border-t border-white/10 p-6 md:hidden">
            <div className="flex flex-col gap-6">
              {navLinks.map((link) => (
                <a key={link.name} href={`#${link.name.toLowerCase().replace(/\s+/g, '-')}`}
                  className="flex items-center gap-3 text-lg font-medium text-gray-400"
                  onClick={() => setIsMobileMenuOpen(false)}>
                  <link.icon className="w-5 h-5 text-[#f27d26]" />
                  {link.name}
                </a>
              ))}
              <SignedOut>
                <SignInButton mode="modal">
                  <button className="bg-[#f27d26] text-white px-6 py-4 rounded-xl text-lg font-bold cursor-pointer">Get Started Free</button>
                </SignInButton>
              </SignedOut>
              <SignedIn>
                <a href="/dashboard" className="bg-[#f27d26] text-white px-6 py-4 rounded-xl text-lg font-bold text-center">Go to Dashboard</a>
              </SignedIn>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

/* Mobile CSS atmospheric fallback */
function MobileAtmosphere() {
  return (
    <div className="fixed inset-0 z-0 bg-[#050505] overflow-hidden">
      {/* Main glow orb */}
      <div className="absolute top-[25%] left-1/2 -translate-x-1/2 w-[300px] h-[300px] rounded-full opacity-80"
        style={{
          background: 'radial-gradient(circle, rgba(242,125,38,0.2) 0%, rgba(242,125,38,0.05) 40%, transparent 70%)',
          animation: 'mobile-glow 6s ease-in-out infinite',
        }}
      />
      {/* Secondary glow */}
      <div className="absolute top-[60%] left-[30%] w-[200px] h-[200px] rounded-full opacity-50"
        style={{
          background: 'radial-gradient(circle, rgba(242,155,80,0.1) 0%, transparent 60%)',
          animation: 'mobile-glow 8s ease-in-out infinite reverse',
        }}
      />
      {/* CSS sparkle dots */}
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="absolute rounded-full bg-[#f27d26]"
          style={{
            width: 2 + Math.random() * 3,
            height: 2 + Math.random() * 3,
            left: `${10 + Math.random() * 80}%`,
            top: `${10 + Math.random() * 80}%`,
            opacity: 0.15 + Math.random() * 0.25,
            animation: `mobile-sparkle ${3 + Math.random() * 4}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 3}s`,
          }}
        />
      ))}
      <style>{`
        @keyframes mobile-glow {
          0%, 100% { opacity: 0.8; transform: translate(-50%, 0) scale(1); }
          50% { opacity: 0.5; transform: translate(-50%, 0) scale(1.15); }
        }
        @keyframes mobile-sparkle {
          0%, 100% { opacity: 0.15; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.5); }
        }
      `}</style>
    </div>
  );
}

export default function LandingPage() {
  const isMobile = useIsMobile();

  return (
    <div className="relative w-full min-h-screen bg-[#050505] text-white">
      <Navbar />

      {/* 3D scene on desktop, CSS fallback + static overlay on mobile */}
      {isMobile ? (
        <>
          <MobileAtmosphere />
          <div className="relative z-10">
            <Overlay />
          </div>
        </>
      ) : (
        <div className="fixed inset-0 z-0">
          <Canvas camera={{ position: [0, 0, 8], fov: 45 }} dpr={[1, 1.5]}>
            <Suspense fallback={null}>
              <Experience />
            </Suspense>
          </Canvas>
        </div>
      )}

      {/* Alfred status badge — desktop only */}
      <div className="fixed bottom-8 left-8 z-50 pointer-events-none hidden md:block">
        <div className="flex items-center gap-3 bg-white/5 backdrop-blur-sm border border-white/10 px-4 py-2 rounded-full">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">
            Alfred is Online
          </span>
        </div>
      </div>
    </div>
  );
}
