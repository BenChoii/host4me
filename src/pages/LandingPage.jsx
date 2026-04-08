import { Canvas } from "@react-three/fiber";
import { Suspense, useState, useEffect } from "react";
import Experience from "../components/three/Experience";
import { Menu, X, Zap, MessageSquare, Shield, Home } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/clerk-react';

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
          <div className="w-8 h-8 bg-[#6366f1] rounded-lg flex items-center justify-center">
            <Zap className="text-white w-5 h-5" />
          </div>
          <span className="text-2xl font-display font-bold tracking-tighter">
            HOST<span className="text-[#6366f1]">4</span>ME
          </span>
        </div>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={`#${link.name.toLowerCase().replace(/\s+/g, '-')}`}
              className="text-sm font-medium text-gray-400 hover:text-white transition-colors"
            >
              {link.name}
            </a>
          ))}
          <SignedOut>
            <SignInButton mode="modal">
              <button className="bg-white text-black px-6 py-2 rounded-full text-sm font-bold hover:bg-[#6366f1] hover:text-white transition-all cursor-pointer">
                Get Started
              </button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <a href="/dashboard" className="bg-[#6366f1] text-white px-6 py-2 rounded-full text-sm font-bold hover:bg-[#4f46e5] transition-all">
              Dashboard
            </a>
            <UserButton appearance={{ elements: { avatarBox: { width: 32, height: 32 } } }} />
          </SignedIn>
        </div>

        {/* Mobile Toggle */}
        <button
          className="md:hidden text-white"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-full left-0 w-full bg-black border-t border-white/10 p-6 md:hidden"
          >
            <div className="flex flex-col gap-6">
              {navLinks.map((link) => (
                <a
                  key={link.name}
                  href={`#${link.name.toLowerCase().replace(/\s+/g, '-')}`}
                  className="flex items-center gap-3 text-lg font-medium text-gray-400"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <link.icon className="w-5 h-5 text-[#6366f1]" />
                  {link.name}
                </a>
              ))}
              <SignedOut>
                <SignInButton mode="modal">
                  <button className="bg-[#6366f1] text-white px-6 py-4 rounded-xl text-lg font-bold cursor-pointer">
                    Get Started Free
                  </button>
                </SignInButton>
              </SignedOut>
              <SignedIn>
                <a href="/dashboard" className="bg-[#6366f1] text-white px-6 py-4 rounded-xl text-lg font-bold text-center">
                  Go to Dashboard
                </a>
              </SignedIn>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

export default function LandingPage() {
  return (
    <div className="relative w-full h-screen bg-black text-white">
      <Navbar />

      <div className="fixed inset-0 z-0">
        <Canvas shadows camera={{ position: [0, 0, 5], fov: 35 }}>
          <Suspense fallback={null}>
            <Experience />
          </Suspense>
        </Canvas>
      </div>

      {/* Alfred status badge */}
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
