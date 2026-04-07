import { useRef, useState, useEffect, useCallback, Component } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { useGSAP } from '@gsap/react';
import Lenis from 'lenis';
import { motion, AnimatePresence } from 'motion/react';
import { Brain, RefreshCw, Zap, BarChart3, Moon, CalendarX, MessageSquareOff, Check } from 'lucide-react';
import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/clerk-react';

import HeroChat from '../compositions/HeroChat';
import Comparison from '../compositions/Comparison';
import HowItWorksComp from '../compositions/HowItWorks';
import AlfredAtWork from '../compositions/AlfredAtWork';
import AgentOffice from '../compositions/AgentOffice';
import NightShift from '../compositions/NightShift';

/* ─── Error Boundary so Remotion issues don't white-screen the site ─── */
class PlayerErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('[Remotion Player Error]', error.message, info.componentStack);
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
  { icon: Brain, title: 'Learns Your Voice', desc: "Alfred analyzes your past messages and replies exactly how you would — same tone, same personality. No templates." },
  { icon: RefreshCw, title: 'Learns from Gmail', desc: "WiFi passwords, gate codes, check-in instructions — Alfred extracts property details from your emails automatically." },
  { icon: Zap, title: 'Shadow Mode', desc: "Alfred drafts every reply for your approval first. After a week of trust, he suggests going fully autonomous." },
  { icon: BarChart3, title: 'Daily Briefings', desc: "Every morning at 8am, Alfred sends you a Telegram summary — messages handled, bookings, issues, and strategic insights." },
];

const STEPS = [
  { num: '01', title: 'Connect', desc: "Sign up, connect your Airbnb and Gmail. Alfred starts learning your properties, style, and house rules." },
  { num: '02', title: 'Shadow', desc: "Alfred drafts guest replies and sends them to you in Telegram for approval. You train him by approving or editing." },
  { num: '03', title: 'Autonomous', desc: "After a week of trust, Alfred handles everything. You get a morning briefing and only hear about issues that need you." },
];

const PRICING = [
  {
    tier: 'Trial', desc: 'See Alfred in action', price: '$0', period: '14 days free',
    features: ['1 property', 'Full Alfred access', 'Shadow mode (you approve replies)', 'Daily briefings via Telegram', 'No credit card required'],
    featured: false, badge: 'Start Here',
  },
  {
    tier: 'Solo', desc: '1–2 listings', price: '$49', period: '/month',
    features: ['Up to 2 properties', 'Autonomous Alfred', 'Guest messaging + escalations', 'Daily & weekly reports', 'Email support'],
    featured: false,
  },
  {
    tier: 'Pro', desc: '3–5 listings', price: '$99', period: '/month',
    features: ['Up to 5 properties', 'Everything in Solo', 'Gmail learning (auto-extracts WiFi, codes)', 'Style customization', 'Priority support', 'Strategic pricing insights'],
    featured: true, badge: 'Most Popular',
  },
  {
    tier: 'Portfolio', desc: '6+ listings', price: '$199', period: '/month + $29/property over 10',
    features: ['Up to 30 properties', 'Everything in Pro', 'Custom escalation rules', 'Dedicated onboarding', 'API access', 'Multi-platform (Airbnb + VRBO)'],
    featured: false,
  },
];

const FAQ_ITEMS = [
  { q: "How long does setup take?", a: "Most setups are complete within 24-48 hours. We integrate with your existing booking platform (Airbnb, Vrbo, etc.) and Alfred learns from your message history—no manual configuration required." },
  { q: "Is Alfred's AI accurate for my property?", a: "Alfred learns your unique communication style by analyzing past messages. The first week includes learning; after that, accuracy typically exceeds 95% for common guest inquiries. You always have the final say before messages send." },
  { q: "Can Alfred work with our existing tools?", a: "Yes. Alfred integrates with Airbnb, Vrbo, iCal, Stripe, and Twilio. If you use Hostaway or Guesty, we can migrate your data and message history seamlessly." },
  { q: "What if Alfred makes a mistake?", a: "You control when Alfred sends replies. Every outgoing message is reviewed by you first—think of Alfred as a highly accurate draft writer, not a complete replacement." },
  { q: "Can you scale to 50+ listings?", a: "Absolutely. Many of our Portfolio clients (15+ listings) manage hundreds across multiple properties. Alfred scales without extra cost per listing once you're on our Portfolio plan." },
  { q: "How does the free trial work?", a: "You get 14 days of full access to Alfred — shadow mode, daily briefings, guest messaging, Gmail learning. No credit card required. After 14 days, choose the plan that fits your portfolio." },
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
export default function LandingPage() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);
  const [activeFeature, setActiveFeature] = useState(1);
  const containerRef = useRef(null);

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
    });
    const rafCallback = (time) => lenis.raf(time * 1000);
    gsap.ticker.add(rafCallback);
    gsap.ticker.lagSmoothing(0);

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
      // Click handler as fallback
      card.addEventListener('click', () => activateStackFeature(card.dataset.feature));

      ScrollTrigger.create({
        trigger: card,
        start: 'top 70%',
        end: 'bottom 30%',
        onEnter: () => activateStackFeature(card.dataset.feature),
        onEnterBack: () => activateStackFeature(card.dataset.feature),
        onToggle: (self) => { if (self.isActive) activateStackFeature(card.dataset.feature); },
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
      { trigger: '.social-proof', bg: '#fafafa' },
      { trigger: '.marquee-band', bg: '#f4f4f5' },
      { trigger: '.mask-section', bg: '#09090b' },
      { trigger: '.solution-section', bg: '#fafafa' },
      { trigger: '.features-section', bg: '#f4f4f5' },
      { trigger: '.how-it-works', bg: '#fafafa' },
      { trigger: '.pricing-section', bg: '#f4f4f5' },
      { trigger: '.faq-section', bg: '#fafafa' },
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
      {/* ════════ NAVIGATION ════════ */}
      <nav className={`nav ${isScrolled ? 'scrolled' : ''}`}>
        <div className="nav-logo">Host4Me</div>
        <ul className="nav-links">
          <li><a href="#features">Features</a></li>
          <li><a href="#pricing">Pricing</a></li>
          <li><a href="#faq">FAQ</a></li>
        </ul>
        <div className="nav-auth">
          <SignedOut>
            <SignInButton mode="modal">
              <motion.button
                className="nav-cta"
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
              >
                Try Alfred Free
              </motion.button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <UserButton
              appearance={{
                elements: { avatarBox: { width: 36, height: 36 } }
              }}
            />
          </SignedIn>
        </div>
      </nav>

      {/* ════════ HERO ════════ */}
      <section className="hero">
        <div className="hero-grid-bg" />
        <div className="hero-content">
          <h1 className="hero-headline">Meet Alfred. Your AI Property Manager.</h1>
          <p className="hero-subhead">
            Alfred lives in your Telegram. He replies to guests in your voice, learns your properties from Gmail, and sends you a daily briefing every morning. Set up in 60 seconds.
          </p>
          <div className="hero-buttons">
            <SignedOut>
              <SignInButton mode="modal">
                <motion.button
                  className="btn btn-primary"
                  whileHover={{ scale: 1.05, boxShadow: '0 16px 40px rgba(99, 102, 241, 0.35)' }}
                  whileTap={{ scale: 0.97 }}
                >
                  Try Alfred Free — 14 Days
                </motion.button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <motion.a
                href="/dashboard"
                className="btn btn-primary"
                whileHover={{ scale: 1.05, boxShadow: '0 16px 40px rgba(99, 102, 241, 0.35)' }}
                whileTap={{ scale: 0.97 }}
              >
                Go to Dashboard
              </motion.a>
            </SignedIn>
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
              <div className="pain-icon"><Moon size={22} strokeWidth={2} color="var(--primary)" /></div>
              <div>
                <h3>Late-night messages</h3>
                <p>Guests ask questions at 2 AM. You're asleep. By morning, they've left a bad review.</p>
              </div>
            </div>
            <div className="pain-point">
              <div className="pain-icon"><CalendarX size={22} strokeWidth={2} color="var(--primary)" /></div>
              <div>
                <h3>Calendar conflicts</h3>
                <p>Managing check-ins, cleanings, and maintenance across multiple properties becomes a spreadsheet nightmare.</p>
              </div>
            </div>
            <div className="pain-point">
              <div className="pain-icon"><MessageSquareOff size={22} strokeWidth={2} color="var(--primary)" /></div>
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

      {/* ════════ AGENT TEAM — STATIC CARDS ════════ */}
      <section className="section agent-office-section">
        <div className="section-wide">
          <span className="section-label reveal" style={{ textAlign: 'center', display: 'block' }}>Under the Hood</span>
          <h2 className="section-heading">Alfred's Specialist Team</h2>
          <p className="comparison-caption reveal">
            Behind Alfred is a team of specialist agents. You just talk to Alfred — he delegates to the right specialist automatically.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20, maxWidth: 940, margin: '40px auto 0' }}>
            {[
              { emoji: '💬', name: 'Guest Comms', desc: 'Handles all guest messaging across platforms. Replies in your voice.' },
              { emoji: '🚨', name: 'Escalation', desc: 'Detects urgent issues — safety, refunds, angry guests — and alerts you.' },
              { emoji: '📊', name: 'Reporting', desc: 'Compiles daily briefings, weekly reports, and performance analytics.' },
              { emoji: '💰', name: 'Market Research', desc: 'Monitors competitor pricing and suggests rate adjustments.' },
            ].map((agent, i) => (
              <div key={i} className="reveal" style={{
                background: 'var(--glass-bg)',
                border: '1px solid var(--border)',
                borderRadius: 16,
                padding: '28px 24px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>{agent.emoji}</div>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>{agent.name}</h3>
                <p style={{ fontSize: 14, color: 'var(--text-light)', margin: 0, lineHeight: 1.6 }}>{agent.desc}</p>
              </div>
            ))}
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
                    {/* State 1: Voice learning */}
                    <div className={`mockup-state ${activeFeature === 1 ? 'active' : ''}`} data-state="1">
                      <div className="mock-metric">97.3%</div>
                      <div className="mock-label">Voice match accuracy</div>
                      <div className="mock-bar-row">
                        <div className="mock-bar filled" style={{ flex: 4.8 }} />
                        <div className="mock-bar" style={{ flex: 0.2 }} />
                      </div>
                    </div>
                    {/* State 2: Gmail learning */}
                    <div className={`mockup-state ${activeFeature === 2 ? 'active' : ''}`} data-state="2">
                      <ul className="mock-list">
                        <li><div className="mock-check">✓</div> WiFi: BeachLife2024</li>
                        <li><div className="mock-check">✓</div> Gate code: #4521</li>
                        <li><div className="mock-check">✓</div> Check-in: 3 PM, lockbox</li>
                        <li><div className="mock-check">✓</div> Parking: 2 spots, rear</li>
                        <li><div className="mock-check">✓</div> Cleaning: Tuesdays 10 AM</li>
                      </ul>
                    </div>
                    {/* State 3: Shadow mode */}
                    <div className={`mockup-state ${activeFeature === 3 ? 'active' : ''}`} data-state="3">
                      <div className="mock-grid">
                        <div className="mock-card">
                          <div className="mock-card-num">23</div>
                          <div className="mock-card-label">Drafts sent</div>
                        </div>
                        <div className="mock-card">
                          <div className="mock-card-num">21</div>
                          <div className="mock-card-label">Approved</div>
                        </div>
                        <div className="mock-card">
                          <div className="mock-card-num">91%</div>
                          <div className="mock-card-label">Approval rate</div>
                        </div>
                        <div className="mock-card">
                          <div className="mock-card-num">2</div>
                          <div className="mock-card-label">Edited</div>
                        </div>
                      </div>
                    </div>
                    {/* State 4: Daily briefing */}
                    <div className={`mockup-state ${activeFeature === 4 ? 'active' : ''}`} data-state="4" style={{ alignItems: 'center', textAlign: 'center' }}>
                      <div className="mock-grid">
                        <div className="mock-card">
                          <div className="mock-card-num">14</div>
                          <div className="mock-card-label">Messages handled</div>
                        </div>
                        <div className="mock-card">
                          <div className="mock-card-num">47s</div>
                          <div className="mock-card-label">Avg reply time</div>
                        </div>
                        <div className="mock-card">
                          <div className="mock-card-num">2</div>
                          <div className="mock-card-label">New bookings</div>
                        </div>
                        <div className="mock-card">
                          <div className="mock-card-num">$0</div>
                          <div className="mock-card-label">Escalations</div>
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
          <p className="pricing-subhead reveal">Try Alfred free for 14 days. No credit card required.</p>
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
                <SignedOut>
                  <SignInButton mode="modal">
                    <motion.button
                      className={`btn ${p.featured ? 'btn-primary' : 'btn-outline'}`}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                    >
                      {p.tier === 'Trial' ? 'Start Free Trial' : 'Get Started'}
                    </motion.button>
                  </SignInButton>
                </SignedOut>
                <SignedIn>
                  <motion.a
                    href="/dashboard"
                    className={`btn ${p.featured ? 'btn-primary' : 'btn-outline'}`}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    Go to Dashboard
                  </motion.a>
                </SignedIn>
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
          <h2 className="cta-headline">Stop losing sleep over guest messages</h2>
          <p className="reveal">Alfred handles your guests at 2 AM, during holidays, and across time zones. Try free for 14 days — set up in 60 seconds.</p>
          <SignedOut>
            <SignInButton mode="modal">
              <motion.button
                className="btn btn-primary"
                whileHover={{ scale: 1.06, boxShadow: '0 16px 48px rgba(99, 102, 241, 0.4)' }}
                whileTap={{ scale: 0.97 }}
              >
                Try Alfred Free
              </motion.button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <motion.a
              href="/dashboard"
              className="btn btn-primary"
              whileHover={{ scale: 1.06, boxShadow: '0 16px 48px rgba(99, 102, 241, 0.4)' }}
              whileTap={{ scale: 0.97 }}
            >
              Go to Dashboard
            </motion.a>
          </SignedIn>
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
