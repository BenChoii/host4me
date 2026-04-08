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
    tier: 'Solo',
    audience: 'For hosts with 1–2 properties',
    price: '$49',
    period: '/mo',
    features: [
      { text: 'Up to 2 properties', included: true },
      { text: 'Alfred guest messaging (24/7)', included: true },
      { text: 'Shadow mode + autonomous', included: true },
      { text: 'Daily & weekly briefings', included: true },
      { text: 'Smart escalations', included: true },
      { text: 'Email support', included: true },
      { text: 'Gmail learning', included: false },
      { text: 'Pricing insights', included: false },
    ],
    featured: false,
  },
  {
    tier: 'Pro',
    audience: 'For growing portfolios',
    price: '$99',
    period: '/mo',
    features: [
      { text: 'Up to 5 properties', included: true },
      { text: 'Everything in Solo', included: true },
      { text: 'Gmail auto-learning', included: true },
      { text: 'Communication style matching', included: true },
      { text: 'Strategic pricing insights', included: true },
      { text: 'Priority support', included: true },
      { text: 'Market research agent', included: true },
      { text: 'Listing optimization', included: false },
    ],
    featured: true,
    badge: 'Most Popular',
  },
  {
    tier: 'Portfolio',
    audience: 'For professional managers',
    price: '$199',
    period: '/mo',
    features: [
      { text: 'Up to 30 properties', included: true },
      { text: 'Everything in Pro', included: true },
      { text: 'Multi-platform (Airbnb + VRBO)', included: true },
      { text: 'Listing optimization agent', included: true },
      { text: 'Custom escalation rules', included: true },
      { text: 'Dedicated onboarding', included: true },
      { text: 'API access', included: true },
      { text: 'White-label reports', included: true },
    ],
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
   ALFRED IN ACTION — ANIMATED DEMO SHOWCASE
   ═══════════════════════════════════════════ */
const DEMO_SCENARIOS = [
  {
    id: 'messaging', label: 'Guest Messaging', icon: '💬', time: '2:47 AM',
    content: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '14px 14px 14px 4px', padding: '10px 14px', maxWidth: '85%', fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 }}>
          Hi! We're arriving late, around 11 PM. Is self check-in available? Also what's the WiFi?
        </div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 2 }}>Alfred is typing...</div>
        <div style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '14px 14px 4px 14px', padding: '10px 14px', maxWidth: '85%', alignSelf: 'flex-end', fontSize: 13, color: 'rgba(255,255,255,0.9)', lineHeight: 1.5 }}>
          Absolutely! Self check-in is 24/7 — the lockbox code is in your confirmation. WiFi: <strong>BeachLife2024</strong>. See you tomorrow! 🏡
        </div>
        <div style={{ fontSize: 10, color: 'rgba(99,102,241,0.6)', textAlign: 'right' }}>✓ Replied in 23 seconds</div>
      </div>
    ),
  },
  {
    id: 'pricing', label: 'Smart Pricing', icon: '📊', time: 'Monday 8 AM',
    content: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>PRICING INSIGHT</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5, marginBottom: 8 }}>
            🎯 <strong>3-night gap</strong> this Fri–Sun at Sunset Villa. Competitors 80% booked.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <span style={{ color: 'rgba(255,255,255,0.4)', textDecoration: 'line-through' }}>$220</span>
            <span style={{ color: 'rgba(255,255,255,0.3)' }}>→</span>
            <span style={{ color: '#22c55e', fontWeight: 700 }}>$179/night</span>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '10px', textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'white' }}>87%</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>Market occupancy</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '10px', textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#22c55e' }}>+$537</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>Potential revenue</div>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'turnover', label: 'Turnovers', icon: '🏠', time: 'Today 11 AM',
    content: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[
          { done: true, text: 'Checkout confirmed — Sarah K. (Beach House)', t: '10:02 AM' },
          { done: true, text: 'Cleaning crew notified — Maria (ETA 11:30)', t: '10:03 AM' },
          { done: true, text: 'Check-in instructions sent to next guest', t: '10:05 AM' },
          { done: false, text: 'Monitoring cleaning completion...', t: 'Now' },
          { done: null, text: 'Send "all ready" to next guest', t: 'Pending' },
        ].map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '5px 0' }}>
            <div style={{
              width: 16, height: 16, borderRadius: '50%', flexShrink: 0, marginTop: 1,
              background: item.done === true ? 'rgba(34,197,94,0.2)' : item.done === false ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9, color: item.done === true ? '#22c55e' : item.done === false ? '#818cf8' : 'rgba(255,255,255,0.15)',
            }}>
              {item.done === true ? '✓' : item.done === false ? '◉' : '○'}
            </div>
            <div>
              <div style={{ fontSize: 12, color: item.done === null ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.75)', lineHeight: 1.4 }}>{item.text}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>{item.t}</div>
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: 'briefing', label: 'Daily Briefing', icon: '☀️', time: '8:00 AM',
    content: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 }}>
          Good morning! Here's your briefing:
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            { v: '12', l: 'Messages handled', c: '#818cf8' },
            { v: '34s', l: 'Avg response', c: '#22c55e' },
            { v: '2', l: 'New bookings', c: '#fbbf24' },
            { v: '0', l: 'Escalations', c: '#22c55e' },
          ].map((s, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: s.c }}>{s.v}</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>{s.l}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.03)', padding: '8px 10px', borderRadius: 8, lineHeight: 1.5 }}>
          💡 Beach House has a 4-night gap next week. Consider a 10% discount to fill it.
        </div>
      </div>
    ),
  },
];

function AlfredShowcase() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setActive(p => (p + 1) % DEMO_SCENARIOS.length), 5000);
    return () => clearInterval(timer);
  }, []);

  const s = DEMO_SCENARIOS[active];

  return (
    <div style={{ marginTop: 56, maxWidth: 500, margin: '56px auto 0' }}>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 3, marginBottom: 14 }}>
        {DEMO_SCENARIOS.map((d, i) => (
          <button key={d.id} onClick={() => setActive(i)} style={{
            flex: 1, padding: '7px 4px', borderRadius: 8, border: 'none',
            background: active === i ? 'rgba(99,102,241,0.2)' : 'transparent',
            color: active === i ? 'white' : 'rgba(255,255,255,0.35)',
            fontSize: 11, fontWeight: active === i ? 600 : 400, cursor: 'pointer',
            transition: 'all 0.2s', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
          }}>
            <span style={{ fontSize: 12 }}>{d.icon}</span>
            <span className="hero-tab-label">{d.label}</span>
          </button>
        ))}
      </div>

      {/* Card */}
      <AnimatePresence mode="wait">
        <motion.div key={s.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, overflow: 'hidden' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 22, height: 22, borderRadius: 6, background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>{s.icon}</div>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}>{s.label}</span>
            </div>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>{s.time}</span>
          </div>
          <div style={{ padding: 14, minHeight: 200 }}>{s.content}</div>
          <div style={{ height: 2, background: 'rgba(255,255,255,0.03)' }}>
            <motion.div key={`p-${active}`} initial={{ width: '0%' }} animate={{ width: '100%' }}
              transition={{ duration: 5, ease: 'linear' }}
              style={{ height: '100%', background: 'rgba(99,102,241,0.4)', borderRadius: 1 }}
            />
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Dots */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 14 }}>
        {DEMO_SCENARIOS.map((_, i) => (
          <div key={i} onClick={() => setActive(i)} style={{
            width: active === i ? 18 : 6, height: 6, borderRadius: 3,
            background: active === i ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.12)',
            cursor: 'pointer', transition: 'all 0.3s',
          }} />
        ))}
      </div>
    </div>
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

    /* Hero chat mockup — removed (replaced with AlfredShowcase React component) */

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
    const pricingSection = document.querySelector('.pricing-section');
    if (pricingSection) {
      gsap.fromTo('.pricing-card',
        { y: 40, opacity: 0, scale: 0.96 },
        { y: 0, opacity: 1, scale: 1, stagger: 0.15, duration: 0.8, ease: 'power2.out', clearProps: 'all',
          scrollTrigger: { trigger: pricingSection, start: 'top 85%', toggleActions: 'play none none none' },
        }
      );
    }

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
      if (el && document.body) {
        ScrollTrigger.create({
          trigger: el,
          start: 'top 80%',
          end: 'bottom 20%',
          onEnter: () => gsap.to(document.body, { backgroundColor: bg, duration: 0.6, ease: 'power2.out' }),
          onEnterBack: () => gsap.to(document.body, { backgroundColor: bg, duration: 0.6, ease: 'power2.out' }),
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

          {/* Alfred In Action — Animated Demo Showcase */}
          <AlfredShowcase />
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, maxWidth: 800, margin: '40px auto 0' }}>
            <div className="reveal" style={{ background: 'var(--bg-alt)', borderRadius: 16, padding: 28, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Without Alfred</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: 14, color: 'var(--text-secondary)', display: 'flex', gap: 8 }}><span style={{ color: '#ef4444' }}>✗</span> You reply at 2 AM half-asleep</div>
                <div style={{ fontSize: 14, color: 'var(--text-secondary)', display: 'flex', gap: 8 }}><span style={{ color: '#ef4444' }}>✗</span> Inconsistent tone across messages</div>
                <div style={{ fontSize: 14, color: 'var(--text-secondary)', display: 'flex', gap: 8 }}><span style={{ color: '#ef4444' }}>✗</span> Forget property details mid-thread</div>
                <div style={{ fontSize: 14, color: 'var(--text-secondary)', display: 'flex', gap: 8 }}><span style={{ color: '#ef4444' }}>✗</span> Slow response = lower rankings</div>
              </div>
            </div>
            <div className="reveal" style={{ background: 'var(--bg-alt)', borderRadius: 16, padding: 28, border: '1px solid var(--primary)', boxShadow: '0 0 0 1px var(--primary-subtle)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.1em' }}>With Alfred</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: 14, color: 'var(--text-secondary)', display: 'flex', gap: 8 }}><span style={{ color: '#22c55e' }}>✓</span> Replies in 47 seconds, 24/7</div>
                <div style={{ fontSize: 14, color: 'var(--text-secondary)', display: 'flex', gap: 8 }}><span style={{ color: '#22c55e' }}>✓</span> Matches your exact voice and style</div>
                <div style={{ fontSize: 14, color: 'var(--text-secondary)', display: 'flex', gap: 8 }}><span style={{ color: '#22c55e' }}>✓</span> Remembers every property detail</div>
                <div style={{ fontSize: 14, color: 'var(--text-secondary)', display: 'flex', gap: 8 }}><span style={{ color: '#22c55e' }}>✓</span> Faster replies = better search ranking</div>
              </div>
            </div>
          </div>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, maxWidth: 900, margin: '48px auto 0', textAlign: 'left' }}>
            {STEPS.map((step, i) => (
              <div key={i} className="reveal" style={{
                background: 'white',
                borderRadius: 16,
                padding: '32px 24px',
                border: '1px solid var(--border)',
                position: 'relative',
                overflow: 'hidden',
              }}>
                <div style={{
                  fontSize: 48,
                  fontWeight: 800,
                  color: 'var(--primary)',
                  opacity: 0.1,
                  position: 'absolute',
                  top: 12,
                  right: 16,
                  lineHeight: 1,
                }}>{step.num}</div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>{step.title}</h3>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.7 }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════ PRICING ════════ */}
      <section className="section pricing-section" id="pricing">
        <div className="section-wide">
          <span className="section-label reveal">Pricing</span>
          <h2 className="section-heading">Plans that grow with your portfolio</h2>

          {/* Free trial banner */}
          <div className="reveal" style={{
            background: 'var(--primary-subtle)',
            border: '1px solid rgba(99, 102, 241, 0.15)',
            borderRadius: 12,
            padding: '16px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            maxWidth: 600,
            margin: '0 auto 40px',
          }}>
            <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
              <strong style={{ color: 'var(--primary)' }}>14 days free</strong> on any plan. No credit card required.
            </span>
            <SignedOut>
              <SignInButton mode="modal">
                <button style={{
                  background: 'var(--primary)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  padding: '8px 20px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}>
                  Start Free Trial
                </button>
              </SignInButton>
            </SignedOut>
          </div>

          {/* 3-column pricing grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 20,
            maxWidth: 960,
            margin: '0 auto',
            alignItems: 'stretch',
            textAlign: 'left',
          }}>
            {PRICING.map((p, i) => (
              <motion.div
                key={i}
                className="pricing-card"
                style={{
                  background: 'white',
                  border: p.featured ? '2px solid var(--primary)' : '1px solid var(--border)',
                  borderRadius: 16,
                  padding: '32px 28px',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                  boxShadow: p.featured ? '0 8px 32px var(--primary-glow)' : 'none',
                }}
                whileHover={{ y: -4, boxShadow: p.featured ? '0 12px 40px var(--primary-glow)' : '0 8px 24px rgba(0,0,0,0.06)' }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              >
                {p.badge && (
                  <div style={{
                    position: 'absolute',
                    top: -12,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'var(--primary)',
                    color: 'white',
                    padding: '4px 14px',
                    borderRadius: 20,
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}>
                    {p.badge}
                  </div>
                )}

                <div style={{ marginBottom: 20 }}>
                  <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{p.tier}</h3>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>{p.audience}</p>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <span style={{ fontSize: 40, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>{p.price}</span>
                  <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>{p.period}</span>
                </div>

                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {p.features.map((f, j) => (
                    <li key={j} style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                      fontSize: 13.5,
                      color: f.included ? 'var(--text-secondary)' : 'var(--text-muted)',
                      opacity: f.included ? 1 : 0.45,
                    }}>
                      <Check size={15} strokeWidth={2.5} style={{
                        color: f.included ? 'var(--primary)' : 'var(--text-muted)',
                        flexShrink: 0,
                        marginTop: 2,
                      }} />
                      {f.text}
                    </li>
                  ))}
                </ul>

                <SignedOut>
                  <SignInButton mode="modal">
                    <motion.button
                      style={{
                        width: '100%',
                        padding: '12px 20px',
                        borderRadius: 10,
                        border: p.featured ? 'none' : '1px solid var(--border)',
                        background: p.featured ? 'var(--primary)' : 'white',
                        color: p.featured ? 'white' : 'var(--text-primary)',
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      Get Started
                    </motion.button>
                  </SignInButton>
                </SignedOut>
                <SignedIn>
                  <motion.a
                    href="/dashboard"
                    style={{
                      width: '100%',
                      padding: '12px 20px',
                      borderRadius: 10,
                      border: p.featured ? 'none' : '1px solid var(--border)',
                      background: p.featured ? 'var(--primary)' : 'white',
                      color: p.featured ? 'white' : 'var(--text-primary)',
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: 'pointer',
                      textDecoration: 'none',
                      textAlign: 'center',
                      display: 'block',
                      boxSizing: 'border-box',
                    }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
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

      {/* ════════ NIGHT SHIFT — STATIC ════════ */}
      <section className="section night-shift-section">
        <div className="section-wide" style={{ textAlign: 'center' }}>
          <span className="section-label reveal" style={{ color: 'rgba(255,255,255,0.35)' }}>While You Sleep</span>
          <h2 className="section-heading" style={{ color: 'white' }}>Alfred Never Clocks Out</h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', maxWidth: 550, margin: '0 auto 40px', fontSize: 16 }}>
            2 AM guest message? Alfred replies in 47 seconds. Holiday weekend? Alfred handles it. You wake up to a briefing, not a backlog.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, maxWidth: 700, margin: '0 auto' }}>
            {[
              { value: '47s', label: 'Average reply time' },
              { value: '24/7', label: 'Always available' },
              { value: '8am', label: 'Daily briefing' },
            ].map((stat, i) => (
              <div key={i} className="reveal" style={{
                background: 'rgba(255,255,255,0.04)',
                borderRadius: 14,
                padding: '28px 20px',
                border: '1px solid rgba(255,255,255,0.06)',
              }}>
                <div style={{ fontSize: 32, fontWeight: 800, color: 'white', marginBottom: 4, fontFamily: "'JetBrains Mono', monospace" }}>{stat.value}</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>{stat.label}</div>
              </div>
            ))}
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
