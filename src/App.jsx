import { useRef, useState, useEffect, useCallback, Component } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { useGSAP } from '@gsap/react';
import Lenis from 'lenis';
import { motion, AnimatePresence } from 'motion/react';
import { Brain, RefreshCw, Zap, BarChart3, Moon, CalendarX, MessageSquareOff, Check } from 'lucide-react';
import SceneCanvas from './components/three/SceneCanvas';

import HeroChat from './compositions/HeroChat';
import Comparison from './compositions/Comparison';
import HowItWorksComp from './compositions/HowItWorks';
import AlfredAtWork from './compositions/AlfredAtWork';
import AgentOffice from './compositions/AgentOffice';
import NightShift from './compositions/NightShift';

/* ─── Error Boundary so Remotion issues don't white-screen the site ─── */
class PlayerErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
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

  useEffect(() => {
    import('@remotion/player').then(m => setPlayer(() => m.Player));
  }, []);

  if (!Player) return <div style={{ minHeight: 300 }} />;
  return <Player {...props} />;
}

gsap.registerPlugin(ScrollTrigger, SplitText);

/* ═══════════════════════════════════════════
   DATA
   ═══════════════════════════════════════════ */
const CALENDLY_URL = 'https://calendly.com/benchoi-oktd/30min';

const FEATURES = [
  { icon: Brain, title: 'Learns Your Voice', desc: "Analyzes 100+ of your past messages to reply exactly how you would—same tone, same personality, same helpfulness." },
  { icon: RefreshCw, title: 'Cross-Platform Sync', desc: "Replies to guests from Airbnb, Vrbo, iCal, and direct SMS all in one inbox. Alfred keeps everything in sync." },
  { icon: Zap, title: 'Smart Escalation', desc: "Complex issues or billing disputes? Alfred knows to flag them. You review the draft and send with your approval." },
  { icon: BarChart3, title: 'Mission Control Dashboard', desc: "See reply times, guest sentiment, and calendar conflicts at a glance. Real data, not AI theater." },
];

const STEPS = [
  { num: '01', title: 'Connect', desc: "Link your Airbnb, Vrbo, or property management account. Alfred sees your guest messages and calendar." },
  { num: '02', title: 'Learn', desc: "Over 24–48 hours, Alfred analyzes your past messages to understand your style, preferences, and responses." },
  { num: '03', title: 'Automate', desc: "Alfred replies to guests in real-time, handles FAQs, and escalates complex issues to you for final approval." },
];

const PRICING = [
  {
    tier: 'Starter', desc: '1–3 listings', price: '$149', period: '/month + $499 setup',
    features: ['Up to 3 properties', 'Message learning', 'Email & SMS support', 'Dashboard access'],
    featured: false,
  },
  {
    tier: 'Growth', desc: '4–15 listings', price: '$299', period: '/month + $999 setup',
    features: ['Up to 15 properties', 'Advanced message learning', 'Priority support', 'Analytics dashboard', 'Twilio SMS integration'],
    featured: true, badge: 'Most Popular',
  },
  {
    tier: 'Portfolio', desc: '15+ listings', price: '$499', period: '/month + $1,999 setup',
    features: ['Unlimited properties', 'Custom AI fine-tuning', 'Dedicated account manager', 'Advanced reporting', 'API access'],
    featured: false,
  },
];

const FAQ_ITEMS = [
  { q: "How long does setup take?", a: "Most setups are complete within 24-48 hours. We integrate with your existing booking platform (Airbnb, Vrbo, etc.) and Alfred learns from your message history—no manual configuration required." },
  { q: "Is Alfred's AI accurate for my property?", a: "Alfred learns your unique communication style by analyzing past messages. The first week includes learning; after that, accuracy typically exceeds 95% for common guest inquiries. You always have the final say before messages send." },
  { q: "Can Alfred work with our existing tools?", a: "Yes. Alfred integrates with Airbnb, Vrbo, iCal, Stripe, and Twilio. If you use Hostaway or Guesty, we can migrate your data and message history seamlessly." },
  { q: "What if Alfred makes a mistake?", a: "You control when Alfred sends replies. Every outgoing message is reviewed by you first—think of Alfred as a highly accurate draft writer, not a complete replacement." },
  { q: "Can you scale to 50+ listings?", a: "Absolutely. Many of our Portfolio clients (15+ listings) manage hundreds across multiple properties. Alfred scales without extra cost per listing once you're on our Portfolio plan." },
  { q: "How does pricing work? Are there hidden fees?", a: "Clear pricing: Starter ($149/mo), Growth ($299/mo), Portfolio ($499/mo). Setup is one-time ($499–$1,999). No per-listing fees, no overage charges. What you see is what you pay." },
];

const HERO_CHAT = [
  { type: 'guest', text: "Hi there! Can you tell me about parking at the property? We'll have 2 cars.", time: '11:47 PM' },
  { type: 'alfred', text: "Absolutely—we've got dedicated spaces for each guest on the property grounds. They're just around the back by the garden. You'll get access codes in your check-in email. Any other questions?", time: '11:47 PM' },
  { type: 'guest', text: "Perfect, thanks so much!", time: '11:48 PM' },
];

const MARQUEE_ITEMS = ['Airbnb', 'Vrbo', 'iCal', 'Stripe', 'Twilio', 'SMS', 'Email', 'Guesty', 'Hostaway'];

const STATS = [
  { value: '10x', label: 'Faster Replies' },
  { value: '24/7', label: 'Availability' },
  { value: '60%', label: 'Cost Savings' },
];

/* ═══════════════════════════════════════════
   TEXT SCRAMBLE ENGINE
   ═══════════════════════════════════════════ */
const SCRAMBLE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*';

function scrambleElement(el, finalText, duration = 1200) {
  const len = finalText.length;
  let startTime = null;

  function frame(ts) {
    if (!startTime) startTime = ts;
    const elapsed = ts - startTime;
    const progress = Math.min(elapsed / duration, 1);

    let html = '';
    for (let i = 0; i < len; i++) {
      if (finalText[i] === ' ' || finalText[i] === '/') {
        html += finalText[i];
        continue;
      }
      const charThreshold = (i / len) * 0.7 + 0.15;
      if (progress >= charThreshold) {
        html += `<span class="char resolved">${finalText[i]}</span>`;
      } else {
        html += `<span class="char scrambling">${SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)]}</span>`;
      }
    }
    el.innerHTML = html;
    if (progress < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

/* ═══════════════════════════════════════════
   KINETIC MARQUEE COMPONENT
   ═══════════════════════════════════════════ */
function KineticMarquee() {
  const row1Ref = useRef(null);
  const row2Ref = useRef(null);

  useEffect(() => {
    const rows = [
      { ref: row1Ref.current, direction: -1, speed: 1 },
      { ref: row2Ref.current, direction: 1, speed: 0.7 },
    ];

    let scrollVelocity = 0;
    const baseSpeed = 60;

    const st = ScrollTrigger.create({
      onUpdate: (self) => {
        scrollVelocity = Math.abs(self.getVelocity());
      },
    });

    const positions = rows.map((r) => (r.direction === -1 ? 0 : -(r.ref.querySelector('.marquee-content').offsetWidth)));
    let animId;

    function animate() {
      rows.forEach((r, idx) => {
        const content = r.ref.querySelector('.marquee-content');
        const contentWidth = content.offsetWidth;
        const speed = (baseSpeed + scrollVelocity * 0.12) * r.speed;
        positions[idx] += r.direction * -1 * speed / 60;

        if (r.direction === -1 && positions[idx] <= -contentWidth) positions[idx] += contentWidth;
        if (r.direction === 1 && positions[idx] >= 0) positions[idx] -= contentWidth;

        r.ref.style.transform = `translateX(${positions[idx]}px)`;
      });
      animId = requestAnimationFrame(animate);
    }
    animate();

    return () => {
      cancelAnimationFrame(animId);
      st.kill();
    };
  }, []);

  const items = MARQUEE_ITEMS.map((item, i) => (
    <span key={i}>
      <span className="marquee-item">{item}</span>
      <span className="marquee-dot" />
    </span>
  ));

  return (
    <section className="marquee-band">
      <div className="marquee-row marquee-giant" ref={row1Ref}>
        <div className="marquee-content">{items}</div>
        <div className="marquee-content">{items}</div>
      </div>
      <div className="marquee-row marquee-outline" ref={row2Ref}>
        <div className="marquee-content">{items}</div>
        <div className="marquee-content">{items}</div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════
   APP COMPONENT
   ═══════════════════════════════════════════ */
export default function App() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);
  const [activeFeature, setActiveFeature] = useState(1);
  const containerRef = useRef(null);

  /* ─── 3D Scene Scroll Progress ─── */
  const scrollProgress = useRef({ hero: 0, global: 0, cta: 0 });
  const canvasInvalidate = useRef(null);

  /* ─── Lenis Smooth Scroll ─── */
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 2,
    });

    lenis.on('scroll', () => {
      ScrollTrigger.update();
      // Invalidate R3F canvas on every scroll tick (for frameloop="demand")
      if (canvasInvalidate.current) canvasInvalidate.current();
    });
    const rafCallback = (time) => lenis.raf(time * 1000);
    gsap.ticker.add(rafCallback);
    gsap.ticker.lagSmoothing(0);

    // Scroll progress triggers for 3D scenes
    ScrollTrigger.create({
      trigger: '.hero',
      start: 'top top',
      end: 'bottom top',
      onUpdate: (self) => { scrollProgress.current.hero = self.progress; },
    });
    ScrollTrigger.create({
      trigger: 'body',
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => { scrollProgress.current.global = self.progress; },
    });
    ScrollTrigger.create({
      trigger: '.final-cta',
      start: 'top bottom',
      end: 'bottom bottom',
      onUpdate: (self) => { scrollProgress.current.cta = self.progress; },
    });

    // Anchor link smooth scroll
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', (e) => {
        e.preventDefault();
        const target = document.querySelector(anchor.getAttribute('href'));
        if (target) lenis.scrollTo(target);
      });
    });

    return () => {
      gsap.ticker.remove(rafCallback);
      lenis.destroy();
    };
  }, []);

  /* ─── Nav scroll detection ─── */
  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 60);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  /* ─── GSAP Animations ─── */
  useGSAP(() => {
    const splits = [];

    /* Hero headline split text */
    const heroSplit = new SplitText('.hero-headline', { type: 'chars,words', autoSplit: true });
    splits.push(heroSplit);
    gsap.fromTo(heroSplit.chars,
      { y: 80, opacity: 0, rotateX: -60 },
      { y: 0, opacity: 1, rotateX: 0, stagger: 0.025, duration: 1, ease: 'back.out(1.4)', delay: 0.3, clearProps: 'transform,opacity' }
    );

    /* Hero subhead */
    gsap.fromTo('.hero-subhead',
      { y: 30, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out', delay: 0.8, clearProps: 'all' }
    );

    /* Hero buttons */
    gsap.fromTo('.hero-buttons',
      { y: 20, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.6, ease: 'power2.out', delay: 1.1, clearProps: 'all' }
    );

    /* Hero chat mockup */
    gsap.fromTo('.chat-mockup',
      { y: 60, opacity: 0, scale: 0.95 },
      { y: 0, opacity: 1, scale: 1, duration: 1, ease: 'power3.out', delay: 1.3, clearProps: 'all' }
    );

    /* Chat messages stagger */
    gsap.fromTo('.chat-message-animated',
      { y: 20, opacity: 0 },
      { y: 0, opacity: 1, stagger: 0.3, duration: 0.6, ease: 'power2.out', delay: 1.8, clearProps: 'all' }
    );

    /* ─── Text Scramble Stats ─── */
    document.querySelectorAll('.stat-number-scramble').forEach((el) => {
      const finalText = el.dataset.value;
      // Show scrambled placeholder initially
      el.innerHTML = finalText.split('').map(c =>
        c === '/' ? '/' : `<span class="char scrambling">${SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)]}</span>`
      ).join('');

      ScrollTrigger.create({
        trigger: el,
        start: 'top 85%',
        once: true,
        onEnter: () => scrambleElement(el, finalText, 1500),
      });
    });

    /* ─── Text Mask Reveal ─── */
    const maskSection = document.querySelector('.mask-section');
    if (maskSection) {
      gsap.to('.mask-reveal', {
        clipPath: 'inset(0% 0 0 0)',
        ease: 'none',
        scrollTrigger: {
          trigger: maskSection,
          start: 'top top',
          end: '60% bottom',
          scrub: 0.3,
          pin: false,
        },
      });

      gsap.to('.mask-subtext', {
        opacity: 1,
        y: 0,
        scrollTrigger: {
          trigger: maskSection,
          start: '55% top',
          end: '70% top',
          scrub: true,
        },
      });
    }

    /* ─── Sticky Stack Feature Activation ─── */
    document.querySelectorAll('.stack-feature-card').forEach((card) => {
      ScrollTrigger.create({
        trigger: card,
        start: 'top 60%',
        end: 'bottom 40%',
        onEnter: () => activateStackFeature(card.dataset.feature),
        onEnterBack: () => activateStackFeature(card.dataset.feature),
      });
    });

    function activateStackFeature(num) {
      document.querySelectorAll('.stack-feature-card').forEach(c => {
        c.classList.toggle('active', c.dataset.feature === num);
      });
      document.querySelectorAll('.mockup-state').forEach(s => {
        s.classList.toggle('active', s.dataset.state === num);
      });
      setActiveFeature(Number(num));
    }

    /* ─── Scroll-triggered section reveals ─── */
    gsap.utils.toArray('.section-heading').forEach(heading => {
      const split = new SplitText(heading, { type: 'words', autoSplit: true });
      splits.push(split);
      gsap.fromTo(split.words,
        { y: 40, opacity: 0 },
        { y: 0, opacity: 1, stagger: 0.04, duration: 0.8, ease: 'power3.out', clearProps: 'transform,opacity',
          scrollTrigger: { trigger: heading, start: 'top 85%', toggleActions: 'play none none none' },
        }
      );
    });

    gsap.utils.toArray('.reveal').forEach(el => {
      gsap.fromTo(el,
        { y: 50, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.8, ease: 'power2.out', clearProps: 'all',
          scrollTrigger: { trigger: el, start: 'top 88%', toggleActions: 'play none none none' },
        }
      );
    });

    /* Steps staggered */
    gsap.fromTo('.step',
      { y: 40, opacity: 0 },
      { y: 0, opacity: 1, stagger: 0.2, duration: 0.8, ease: 'power2.out', clearProps: 'all',
        scrollTrigger: { trigger: '.steps-grid', start: 'top 85%', toggleActions: 'play none none none' },
      }
    );

    /* Pricing cards staggered */
    gsap.fromTo('.pricing-card',
      { y: 40, opacity: 0, scale: 0.96 },
      { y: 0, opacity: 1, scale: 1, stagger: 0.15, duration: 0.8, ease: 'power2.out', clearProps: 'all',
        scrollTrigger: { trigger: '.pricing-grid', start: 'top 85%', toggleActions: 'play none none none' },
      }
    );

    /* FAQ items staggered */
    gsap.fromTo('.faq-item',
      { y: 30, opacity: 0 },
      { y: 0, opacity: 1, stagger: 0.08, duration: 0.6, ease: 'power2.out', clearProps: 'all',
        scrollTrigger: { trigger: '.faq-container', start: 'top 85%', toggleActions: 'play none none none' },
      }
    );

    /* Pain points staggered */
    gsap.fromTo('.pain-point',
      { x: -40, opacity: 0 },
      { x: 0, opacity: 1, stagger: 0.15, duration: 0.8, ease: 'power3.out', clearProps: 'all',
        scrollTrigger: { trigger: '.pain-points', start: 'top 85%', toggleActions: 'play none none none' },
      }
    );

    /* Comparison cards */
    gsap.fromTo('.comparison-card',
      { y: 40, opacity: 0 },
      { y: 0, opacity: 1, stagger: 0.2, duration: 0.8, ease: 'power2.out', clearProps: 'all',
        scrollTrigger: { trigger: '.comparison-grid', start: 'top 85%', toggleActions: 'play none none none' },
      }
    );

    /* Final CTA text reveal */
    const ctaSplit = new SplitText('.cta-headline', { type: 'words', autoSplit: true });
    splits.push(ctaSplit);
    gsap.fromTo(ctaSplit.words,
      { y: 40, opacity: 0 },
      { y: 0, opacity: 1, stagger: 0.05, duration: 0.8, ease: 'power3.out', clearProps: 'transform,opacity',
        scrollTrigger: { trigger: '.cta-headline', start: 'top 85%', toggleActions: 'play none none none' },
      }
    );

    /* ─── Color Shift ─── */
    const colorSections = [
      { trigger: '.social-proof', bg: '#FAF8F5' },
      { trigger: '.marquee-band', bg: '#F5F0EB' },
      { trigger: '.mask-section', bg: '#2D2B3D' },
      { trigger: '.solution-section', bg: '#FAF8F5' },
      { trigger: '.features-section', bg: '#F7F2ED' },
      { trigger: '.how-it-works', bg: '#FAF8F5' },
      { trigger: '.pricing-section', bg: '#F5F0EB' },
      { trigger: '.faq-section', bg: '#FAF8F5' },
    ];

    colorSections.forEach(({ trigger, bg }) => {
      const el = document.querySelector(trigger);
      if (el) {
        ScrollTrigger.create({
          trigger: el,
          start: 'top 80%',
          end: 'bottom 20%',
          onEnter: () => gsap.to('body', { backgroundColor: bg, duration: 0.6, ease: 'power2.out' }),
          onEnterBack: () => gsap.to('body', { backgroundColor: bg, duration: 0.6, ease: 'power2.out' }),
        });
      }
    });

    return () => splits.forEach(s => s.revert());
  }, { scope: containerRef });

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div ref={containerRef}>
      {/* ════════ 3D SCENE CANVAS ════════ */}
      <SceneCanvas scrollProgress={scrollProgress} onInvalidateReady={(fn) => { canvasInvalidate.current = fn; }} />

      {/* ════════ NAVIGATION ════════ */}
      <nav className={`nav ${isScrolled ? 'scrolled' : ''}`}>
        <div className="nav-logo">Host4Me</div>
        <ul className="nav-links">
          <li><a href="#features">Features</a></li>
          <li><a href="#pricing">Pricing</a></li>
          <li><a href="#faq">FAQ</a></li>
        </ul>
        <motion.a
          href={CALENDLY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="nav-cta"
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
        >
          Book a Demo
        </motion.a>
      </nav>

      {/* ════════ HERO ════════ */}
      <section className="hero">
        <div className="hero-grid-bg" />
        <div className="hero-content">
          <h1 className="hero-headline">Your AI Property Manager That Never Sleeps</h1>
          <p className="hero-subhead">
            Alfred learns how you talk. Then handles your guests 24/7 with your voice.
          </p>
          <div className="hero-buttons">
            <motion.a
              href={CALENDLY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary"
              whileHover={{ scale: 1.05, boxShadow: '0 16px 40px rgba(198, 125, 59, 0.4)' }}
              whileTap={{ scale: 0.97 }}
            >
              Book a Demo
            </motion.a>
            <motion.button
              className="btn btn-secondary"
              onClick={() => scrollToSection('how-it-works')}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              See How It Works
            </motion.button>
          </div>

          {/* Chat Mockup — Remotion Player */}
          <div className="chat-mockup remotion-player-wrap">
            <SafePlayer
              component={HeroChat}
              durationInFrames={320}
              fps={30}
              compositionWidth={480}
              compositionHeight={520}
              loop
              autoPlay
              style={{ width: '100%', height: 'auto' }}
            />
          </div>
        </div>
      </section>

      {/* ════════ SOCIAL PROOF + TEXT SCRAMBLE STATS ════════ */}
      <section className="social-proof">
        <p className="social-proof-label">Trusted by property managers across British Columbia</p>
        <div className="stats-grid">
          {STATS.map((stat, i) => (
            <div key={i} className="stat-item reveal">
              <div className="stat-number-scramble" data-value={stat.value} />
              <div className="stat-label">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ════════ KINETIC MARQUEE ════════ */}
      <KineticMarquee />

      {/* ════════ TEXT MASK REVEAL → PROBLEM SECTION ════════ */}
      <section className="mask-section">
        <div className="mask-sticky">
          <div className="mask-bg" />
          <div className="mask-overlay">
            <div className="mask-text">NEVER<br />SLEEPS</div>
          </div>
          <div className="mask-reveal">
            <div className="mask-text-filled">NEVER<br />SLEEPS</div>
          </div>
          <div className="mask-subtext">
            <p>Alfred handles your guests at 2 AM, during holidays, and across time zones — so you don't have to.</p>
          </div>
        </div>
      </section>

      {/* ════════ PROBLEM SECTION (after mask) ════════ */}
      <section className="section problem-section">
        <div className="section-container">
          <span className="section-label reveal">The Problem</span>
          <h2 className="section-heading">Managing guests shouldn't feel like a second job</h2>
          <div className="pain-points">
            <div className="pain-point">
              <div className="pain-icon"><Moon size={22} strokeWidth={2} color="var(--copper)" /></div>
              <div>
                <h3>Late-night messages</h3>
                <p>Guests ask questions at 2 AM. You're asleep. By morning, they've left a bad review.</p>
              </div>
            </div>
            <div className="pain-point">
              <div className="pain-icon"><CalendarX size={22} strokeWidth={2} color="var(--copper)" /></div>
              <div>
                <h3>Calendar conflicts</h3>
                <p>Managing check-ins, cleanings, and maintenance across multiple properties becomes a spreadsheet nightmare.</p>
              </div>
            </div>
            <div className="pain-point">
              <div className="pain-icon"><MessageSquareOff size={22} strokeWidth={2} color="var(--copper)" /></div>
              <div>
                <h3>Inconsistent responses</h3>
                <p>You're tired. Your responses get shorter and less helpful. Guests feel it. Your ratings suffer.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════ SOLUTION / COMPARISON ════════ */}
      <section className="section solution-section">
        <div className="section-wide">
          <span className="section-label reveal" style={{ textAlign: 'center', display: 'block' }}>The Solution</span>
          <h2 className="section-heading">Meet Alfred. He learns how you talk.</h2>
          <div className="comparison-grid remotion-player-wrap">
            <SafePlayer
              component={Comparison}
              durationInFrames={360}
              fps={30}
              compositionWidth={900}
              compositionHeight={420}
              loop
              autoPlay
              style={{ width: '100%', height: 'auto', borderRadius: 20 }}
            />
          </div>
          <p className="comparison-caption reveal">
            Alfred analyzes your past 100+ messages to replicate your tone, humor, and helpfulness. No training required.
          </p>
        </div>
      </section>

      {/* ════════ AGENT OFFICE — REMOTION ════════ */}
      <section className="section agent-office-section">
        <div className="section-wide">
          <span className="section-label reveal" style={{ textAlign: 'center', display: 'block' }}>The Team</span>
          <h2 className="section-heading">Meet Alfred's Office</h2>
          <p className="comparison-caption reveal">
            Four specialized AI agents working together. Each one handles a different part of your property management.
          </p>
          <div className="remotion-player-wrap" style={{ maxWidth: 940, margin: '40px auto 0' }}>
            <SafePlayer
              component={AgentOffice}
              durationInFrames={360}
              fps={30}
              compositionWidth={900}
              compositionHeight={480}
              loop
              autoPlay
              style={{ width: '100%', height: 'auto', borderRadius: 20 }}
            />
          </div>
        </div>
      </section>

      {/* ════════ FEATURES — STICKY STACK NARRATIVE ════════ */}
      <section className="section features-section" id="features">
        <div className="section-wide">
          <span className="section-label reveal" style={{ textAlign: 'center', display: 'block' }}>Capabilities</span>
          <h2 className="section-heading">What Alfred Handles</h2>

          <div className="stack-section">
            <div className="stack-container">
              {/* Left: Sticky mockup */}
              <div className="stack-visual">
                <div className="mockup">
                  <div className="mockup-bar">
                    <div className="mockup-dot" />
                    <div className="mockup-dot" />
                    <div className="mockup-dot" />
                  </div>
                  <div className="mockup-body">
                    {/* State 1: Voice learning metric */}
                    <div className={`mockup-state ${activeFeature === 1 ? 'active' : ''}`} data-state="1">
                      <div className="mock-metric">97.3%</div>
                      <div className="mock-label">Voice match accuracy</div>
                      <div className="mock-bar-row">
                        <div className="mock-bar filled" style={{ flex: 4.8 }} />
                        <div className="mock-bar" style={{ flex: 0.2 }} />
                      </div>
                    </div>
                    {/* State 2: Cross-platform grid */}
                    <div className={`mockup-state ${activeFeature === 2 ? 'active' : ''}`} data-state="2">
                      <div className="mock-grid">
                        <div className="mock-card">
                          <div className="mock-card-num">Airbnb</div>
                          <div className="mock-card-label">14 messages today</div>
                        </div>
                        <div className="mock-card">
                          <div className="mock-card-num">Vrbo</div>
                          <div className="mock-card-label">8 messages today</div>
                        </div>
                        <div className="mock-card">
                          <div className="mock-card-num">SMS</div>
                          <div className="mock-card-label">3 messages today</div>
                        </div>
                        <div className="mock-card">
                          <div className="mock-card-num">Email</div>
                          <div className="mock-card-label">6 messages today</div>
                        </div>
                      </div>
                    </div>
                    {/* State 3: Escalation checklist */}
                    <div className={`mockup-state ${activeFeature === 3 ? 'active' : ''}`} data-state="3">
                      <ul className="mock-list">
                        <li><div className="mock-check">✓</div> Billing dispute flagged</li>
                        <li><div className="mock-check">✓</div> Draft response created</li>
                        <li><div className="mock-check">✓</div> Owner notified via SMS</li>
                        <li><div className="mock-check">✓</div> Guest sees "escalated" status</li>
                        <li><div className="mock-check">✓</div> Resolution logged</li>
                      </ul>
                    </div>
                    {/* State 4: Dashboard analytics */}
                    <div className={`mockup-state ${activeFeature === 4 ? 'active' : ''}`} data-state="4" style={{ alignItems: 'center', textAlign: 'center' }}>
                      <div className="mock-grid">
                        <div className="mock-card">
                          <div className="mock-card-num">47s</div>
                          <div className="mock-card-label">Avg reply time</div>
                        </div>
                        <div className="mock-card">
                          <div className="mock-card-num">4.9★</div>
                          <div className="mock-card-label">Guest sentiment</div>
                        </div>
                        <div className="mock-card">
                          <div className="mock-card-num">0</div>
                          <div className="mock-card-label">Calendar conflicts</div>
                        </div>
                        <div className="mock-card">
                          <div className="mock-card-num">312</div>
                          <div className="mock-card-label">Messages this month</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Scrolling feature cards */}
              <div className="stack-features">
                {FEATURES.map((f, i) => (
                  <div
                    key={i}
                    className={`stack-feature-card ${activeFeature === i + 1 ? 'active' : ''}`}
                    data-feature={String(i + 1)}
                  >
                    <div className="stack-feature-num">0{i + 1}</div>
                    <h3>{f.title}</h3>
                    <p>{f.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════ HOW IT WORKS ════════ */}
      <section className="section how-it-works" id="how-it-works">
        <div className="section-wide">
          <span className="section-label reveal" style={{ textAlign: 'center', display: 'block' }}>Getting Started</span>
          <h2 className="section-heading">Three Steps to Effortless Guest Management</h2>
          <div className="steps-grid remotion-player-wrap">
            <SafePlayer
              component={HowItWorksComp}
              durationInFrames={300}
              fps={30}
              compositionWidth={900}
              compositionHeight={380}
              loop
              autoPlay
              style={{ width: '100%', height: 'auto', borderRadius: 20 }}
            />
          </div>
        </div>
      </section>

      {/* ════════ PRICING ════════ */}
      <section className="section pricing-section" id="pricing">
        <div className="section-wide">
          <span className="section-label reveal" style={{ textAlign: 'center', display: 'block' }}>Pricing</span>
          <h2 className="section-heading">Simple, Transparent Pricing</h2>
          <p className="pricing-subhead reveal">No per-listing fees. No overage charges. Pricing that scales with you.</p>
          <div className="pricing-grid">
            {PRICING.map((p, i) => (
              <motion.div
                key={i}
                className={`pricing-card ${p.featured ? 'featured' : ''}`}
                whileHover={p.featured ? { scale: 1.06 } : { y: -6 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              >
                {p.badge && <div className="pricing-badge">{p.badge}</div>}
                <h3>{p.tier}</h3>
                <p className="pricing-tier-desc">{p.desc}</p>
                <div className="pricing-price">{p.price}</div>
                <div className="pricing-period">{p.period}</div>
                <ul className="pricing-features">
                  {p.features.map((f, j) => <li key={j}><Check size={16} strokeWidth={2.5} className="pricing-check" />{f}</li>)}
                </ul>
                <motion.a
                  href={CALENDLY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`btn ${p.featured ? 'btn-primary' : 'btn-outline'}`}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                >
                  Book a Demo
                </motion.a>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════ FAQ ════════ */}
      <section className="section faq-section" id="faq">
        <div className="faq-container">
          <h2 className="section-heading">Frequently Asked Questions</h2>
          {FAQ_ITEMS.map((item, idx) => (
            <div key={idx} className={`faq-item ${openFaq === idx ? 'open' : ''}`}>
              <div className="faq-question" onClick={() => setOpenFaq(openFaq === idx ? null : idx)}>
                <h3>{item.q}</h3>
                <div className="faq-toggle">+</div>
              </div>
              <AnimatePresence>
                {openFaq === idx && (
                  <motion.div
                    className="faq-answer"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    style={{ overflow: 'hidden' }}
                  >
                    <p>{item.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </section>

      {/* ════════ NIGHT SHIFT — REMOTION ════════ */}
      <section className="section night-shift-section">
        <div className="section-wide">
          <span className="section-label reveal" style={{ textAlign: 'center', display: 'block', color: 'rgba(255,255,255,0.4)' }}>See It In Action</span>
          <h2 className="section-heading" style={{ color: 'white' }}>Alfred Works While You Sleep</h2>
          <div className="remotion-player-wrap" style={{ maxWidth: 940, margin: '40px auto 0', borderRadius: 20, border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 30px 80px rgba(0,0,0,0.3)' }}>
            <SafePlayer
              component={NightShift}
              durationInFrames={420}
              fps={30}
              compositionWidth={900}
              compositionHeight={520}
              loop
              autoPlay
              style={{ width: '100%', height: 'auto', borderRadius: 20 }}
            />
          </div>
        </div>
      </section>

      {/* ════════ ALFRED DASHBOARD — REMOTION ════════ */}
      <section className="section alfred-work-section">
        <div className="section-wide">
          <span className="section-label reveal" style={{ textAlign: 'center', display: 'block' }}>Your Dashboard</span>
          <h2 className="section-heading">Everything at a Glance</h2>
          <div className="remotion-player-wrap" style={{ maxWidth: 940, margin: '40px auto 0', borderRadius: 20, border: '1px solid rgba(45,43,61,0.06)', boxShadow: '0 12px 40px rgba(45,43,61,0.06)' }}>
            <SafePlayer
              component={AlfredAtWork}
              durationInFrames={300}
              fps={30}
              compositionWidth={900}
              compositionHeight={480}
              loop
              autoPlay
              style={{ width: '100%', height: 'auto', borderRadius: 20 }}
            />
          </div>
        </div>
      </section>

      {/* ════════ FINAL CTA ════════ */}
      <section className="final-cta">
        <div className="hero-grid-bg" />
        <div style={{ position: 'relative', zIndex: 2 }}>
          <h2 className="cta-headline">Ready to let Alfred handle your guests?</h2>
          <p className="reveal">Stop losing sleep over guest messages. Start free with 100 actions.</p>
          <motion.a
            href={CALENDLY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
            whileHover={{ scale: 1.06, boxShadow: '0 16px 48px rgba(198, 125, 59, 0.5)' }}
            whileTap={{ scale: 0.97 }}
          >
            Book a Demo
          </motion.a>
        </div>
      </section>

      {/* ════════ FOOTER ════════ */}
      <footer className="footer">
        <div className="footer-brand">Host4Me.ca</div>
        <p style={{ marginBottom: 20 }}>AI property management for short-term rental hosts.</p>
        <div style={{ paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <p>© 2026 Host4Me.ca. All rights reserved. | <a href="mailto:info@oktd.ca">Contact</a></p>
        </div>
      </footer>
    </div>
  );
}
