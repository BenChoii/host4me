import { Canvas } from "@react-three/fiber";
import { Suspense, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Experience from "../components/Experience";
import { Menu, X, Home, MessageSquare, Shield, Zap } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

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

  const scrollToSection = (name: string) => {
    const id = name.toLowerCase().replace(/\s+/g, '-');
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <nav
      className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${
        isScrolled ? "bg-black/80 backdrop-blur-md py-4" : "bg-transparent py-6"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#f27d26] rounded-lg flex items-center justify-center">
            <Zap className="text-white w-5 h-5" />
          </div>
          <span className="text-2xl font-display font-bold tracking-tighter">
            HOST<span className="text-[#f27d26]">4</span>ME
          </span>
        </div>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={`#${link.name.toLowerCase().replace(/\s+/g, '-')}`}
              onClick={(e) => { e.preventDefault(); scrollToSection(link.name); }}
              className="text-sm font-medium text-gray-400 hover:text-white transition-colors"
            >
              {link.name}
            </a>
          ))}
          <button
            onClick={() => navigate("/sign-up")}
            className="bg-white text-black px-6 py-2 rounded-full text-sm font-bold hover:bg-[#f27d26] hover:text-white transition-all"
          >
            Get Started
          </button>
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
                  onClick={() => { setIsMobileMenuOpen(false); scrollToSection(link.name); }}
                >
                  <link.icon className="w-5 h-5 text-[#f27d26]" />
                  {link.name}
                </a>
              ))}
              <button
                onClick={() => { setIsMobileMenuOpen(false); navigate("/sign-up"); }}
                className="bg-[#f27d26] text-white px-6 py-4 rounded-xl text-lg font-bold"
              >
                Get Started Free
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="relative w-full h-screen bg-black">
      <Navbar />

      <div className="fixed inset-0 z-0">
        <Canvas shadows camera={{ position: [0, 0, 5], fov: 35 }}>
          <Suspense fallback={null}>
            <Experience />
          </Suspense>
        </Canvas>
      </div>

      {/* Alfred Online indicator */}
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
