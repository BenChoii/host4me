import React, { useRef, useState, useEffect, Component } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import Lenis from 'lenis';

/* ─── TEMPORARY MOCK CLERK FOR FRONTEND PREVIEW ─── */
const SignedIn = () => null;
const SignedOut = ({ children }) => <>{children}</>;
const SignInButton = ({ children }) => <div className="nav-link">{children}</div>;
const UserButton = () => null;

import HeroChat from '../compositions/HeroChat';
import AgentOffice from '../compositions/AgentOffice';

class PlayerErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { console.error('[Remotion Error]', error, info); }
  render() {
    if (this.state.hasError) return this.props.fallback || null;
    return this.props.children;
  }
}

function SafePlayer({ fallback, ...props }) {
  return (
    <PlayerErrorBoundary fallback={fallback}>
      <LazyPlayer {...props} />
    </PlayerErrorBoundary>
  );
}

function LazyPlayer(props) {
  const [Player, setPlayer] = useState(null);
  useEffect(() => { import('@remotion/player').then(m => setPlayer(() => m.Player)); }, []);
  if (!Player) return <div style={{ minHeight: 100 }} />;
  return <Player {...props} />;
}

gsap.registerPlugin(ScrollTrigger);

export default function LandingPage() {
  const containerRef = useRef(null);

  useGSAP(() => {
    // 1. Setup minimal smooth scrolling with Lenis 
    const lenis = new Lenis({
      duration: 1.5,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });
    lenis.on('scroll', ScrollTrigger.update);
    const rafCallback = (time) => lenis.raf(time * 1000);
    gsap.ticker.add(rafCallback);
    gsap.ticker.lagSmoothing(0);

    // 2. The Core Scrollytelling Timeline
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: '.scrolly-container',
        start: 'top top',
        end: 'bottom bottom',
        scrub: 1.2,
      }
    });

    // SCENE 1: Introduction (The Hook fades and shrinks into background)
    tl.to('.hook-text', { opacity: 0, scale: 0.8, duration: 1 }, 0);
    tl.fromTo('.layer-img-1', { scale: 1, opacity: 1 }, { scale: 1.1, opacity: 0.15, duration: 2 }, 0);
    
    // SCENE 2: The Agent (HeroChat HUD fades in over the luxury property)
    tl.fromTo('.hud-scene-1', { opacity: 0, scale: 0.95 }, { opacity: 1, scale: 1, duration: 1 }, 1);
    tl.to('.hud-scene-1', { opacity: 0, scale: 1.05, duration: 1 }, 3);
    
    // SCENE 3: The Tech (Background shifts to neural grid, AgentOffice HUD powers up)
    tl.to('.layer-img-2', { opacity: 1, duration: 1 }, 3);
    tl.fromTo('.layer-img-2', { scale: 1 }, { scale: 1.1, filter: 'brightness(0.3)', duration: 3 }, 3);
    tl.fromTo('.hud-scene-2', { opacity: 0, scale: 0.95, y: 50 }, { opacity: 1, scale: 1, y: 0, duration: 1 }, 4);
    tl.to('.hud-scene-2', { opacity: 0, y: -100, duration: 1 }, 6);

    // SCENE 4: The Final Void (Punchy high-contrast Pricing CTA)
    tl.to('.layer-solid', { opacity: 1, duration: 0.8 }, 6.2);
    tl.to('.final-layer', { opacity: 1, duration: 1 }, 6.5);

    return () => {
      lenis.destroy();
      gsap.ticker.remove(rafCallback);
    };
  }, { scope: containerRef });

  return (
    <div ref={containerRef}>
      
      {/* ─── Cinematic Glass Pill Navigation ─── */}
      <nav className="cinematic-nav">
        <div className="logo">Host4Me</div>
        <SignedOut>
          <SignInButton>Start Free Trial</SignInButton>
        </SignedOut>
        <SignedIn><UserButton /></SignedIn>
      </nav>

      {/* ─── The Cinematic Scroll Journey ─── */}
      <div className="scrolly-container">
        
        {/* Fixed Viewport Window */}
        <div className="scene-wrapper">

          {/* BACKGROUND LAYERS */}
          <div className="bg-layer layer-img-1" />
          <div className="bg-layer layer-img-2" />
          <div className="bg-layer layer-solid" />

          {/* FOREGROUND HUD LAYERS */}
          
          <div className="hud-layer active hook-text" style={{ opacity: 1 }}>
            <h1>Meet Alfred.</h1>
            <p className="mono-sub">Your AI Property Manager</p>
          </div>

          {/* Inline styles mapped for timeline stability */}
          <div className="hud-layer hud-scene-1" style={{ opacity: 0, transform: 'scale(0.95)' }}>
            <div className="hud-remotion-container">
              {/* Note: I swapped HeroChat for true cinematic full width rendering */}
              <SafePlayer
                component={HeroChat}
                durationInFrames={320}
                fps={30}
                compositionWidth={1000}
                compositionHeight={600}
                loop autoPlay
                style={{ width: '100%', height: '100%', filter: 'drop-shadow(0 30px 80px rgba(0,0,0,0.9))' }}
              />
            </div>
          </div>

          <div className="hud-layer hud-scene-2" style={{ opacity: 0, transform: 'scale(0.95)' }}>
            <div className="hud-remotion-container">
              <SafePlayer
                component={AgentOffice}
                durationInFrames={300}
                fps={30}
                compositionWidth={1000}
                compositionHeight={600}
                loop autoPlay
                style={{ width: '100%', height: '100%', filter: 'drop-shadow(0 30px 80px rgba(0,0,0,0.9))' }}
              />
            </div>
          </div>

          {/* FINAL CTA LAYER */}
          <div className="final-layer">
            <h2>Let's Talk.</h2>
            <p className="mono-sub" style={{color: '#050505', marginTop: '20px'}}>Autonomous guest routing starting at $49/mo</p>
            <button className="cinematic-btn" onClick={() => window.location.href='/#sign-up'}>
              Initialize Alfred
            </button>
          </div>

        </div>
      </div>
      
    </div>
  );
}
