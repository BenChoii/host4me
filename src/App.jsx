import { useRef, useState, useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { useGSAP } from '@gsap/react';
import Lenis from 'lenis';
import { motion, AnimatePresence } from 'motion/react';
import { Brain, RefreshCw, Zap, BarChart3, Moon, CalendarX, MessageSquareOff, Check } from 'lucide-react';
import SceneCanvas from './components/three/SceneCanvas';

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

/* ═══════════════════════════════════════════
   CHAT MESSAGES (animated)
   ═══════════════════════════════════════════ */
const HERO_CHAT = [
  { type: 'guest', text: "Hi there! Can you tell me about parking at the property? We'll have 2 cars.", time: '11:47 PM' },
  { type: 'alfred', text: "Absolutely—we've got dedicated spaces for each guest on the property grounds. They're just around the back by the garden. You'll get access codes in your check-in email. Any other questions?", time: '11:47 PM' },
  { type: 'guest', text: "Perfect, thanks so much!", time: '11:48 PM' },
];

/* ═══════════════════════════════════════════
   APP COMPONENT
   ═══════════════════════════════════════════ */
export default function App() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);
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
    // Track SplitText instances for cleanup (GSAP skill: always revert SplitText)
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

    /* ─── Scroll-triggered section reveals ─── */

    // Section headings — SplitText reveal
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

    // Generic scroll reveals
    gsap.utils.toArray('.reveal').forEach(el => {
      gsap.fromTo(el,
        { y: 50, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.8, ease: 'power2.out', clearProps: 'all',
          scrollTrigger: { trigger: el, start: 'top 88%', toggleActions: 'play none none none' },
        }
      );
    });

    // Feature cards staggered
    gsap.fromTo('.feature-card',
      { y: 60, opacity: 0, scale: 0.96 },
      { y: 0, opacity: 1, scale: 1, stagger: { each: 0.12, from: 'start' }, duration: 0.8, ease: 'power2.out', clearProps: 'all',
        scrollTrigger: { trigger: '.features-grid', start: 'top 85%', toggleActions: 'play none none none' },
      }
    );

    // Steps staggered
    gsap.fromTo('.step',
      { y: 40, opacity: 0 },
      { y: 0, opacity: 1, stagger: 0.2, duration: 0.8, ease: 'power2.out', clearProps: 'all',
        scrollTrigger: { trigger: '.steps-grid', start: 'top 85%', toggleActions: 'play none none none' },
      }
    );

    // Pricing cards staggered
    gsap.fromTo('.pricing-card',
      { y: 40, opacity: 0, scale: 0.96 },
      { y: 0, opacity: 1, scale: 1, stagger: 0.15, duration: 0.8, ease: 'power2.out', clearProps: 'all',
        scrollTrigger: { trigger: '.pricing-grid', start: 'top 85%', toggleActions: 'play none none none' },
      }
    );

    // FAQ items staggered
    gsap.fromTo('.faq-item',
      { y: 30, opacity: 0 },
      { y: 0, opacity: 1, stagger: 0.08, duration: 0.6, ease: 'power2.out', clearProps: 'all',
        scrollTrigger: { trigger: '.faq-container', start: 'top 85%', toggleActions: 'play none none none' },
      }
    );

    // Pain points staggered
    gsap.fromTo('.pain-point',
      { x: -40, opacity: 0 },
      { x: 0, opacity: 1, stagger: 0.15, duration: 0.8, ease: 'power3.out', clearProps: 'all',
        scrollTrigger: { trigger: '.pain-points', start: 'top 85%', toggleActions: 'play none none none' },
      }
    );

    // Comparison cards
    gsap.fromTo('.comparison-card',
      { y: 40, opacity: 0 },
      { y: 0, opacity: 1, stagger: 0.2, duration: 0.8, ease: 'power2.out', clearProps: 'all',
        scrollTrigger: { trigger: '.comparison-grid', start: 'top 85%', toggleActions: 'play none none none' },
      }
    );

    // Final CTA text reveal
    const ctaSplit = new SplitText('.cta-headline', { type: 'words', autoSplit: true });
    splits.push(ctaSplit);
    gsap.fromTo(ctaSplit.words,
      { y: 40, opacity: 0 },
      { y: 0, opacity: 1, stagger: 0.05, duration: 0.8, ease: 'power3.out', clearProps: 'transform,opacity',
        scrollTrigger: { trigger: '.cta-headline', start: 'top 85%', toggleActions: 'play none none none' },
      }
    );

    // CRITICAL: Revert SplitText on cleanup (restores original DOM)
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

          {/* Chat Mockup */}
          <div className="chat-mockup">
            <div className="chat-header">
              <div className="chat-avatar">A</div>
              <div className="chat-name">Alfred</div>
              <div className="chat-status">Online</div>
            </div>
            <div className="chat-messages">
              {HERO_CHAT.map((msg, i) => (
                <div key={i} className={`message ${msg.type} chat-message-animated`}>
                  <div className="message-bubble">
                    {msg.text}
                  </div>
                </div>
              ))}
              <div className="message-time">Response time: 47 seconds</div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════ SOCIAL PROOF ════════ */}
      <section className="social-proof">
        <p className="social-proof-label">Trusted by property managers across British Columbia</p>
        <div className="stats-grid">
          <div className="stat-item reveal">
            <div className="stat-number">10x</div>
            <div className="stat-label">Faster Replies</div>
          </div>
          <div className="stat-item reveal">
            <div className="stat-number">24/7</div>
            <div className="stat-label">Availability</div>
          </div>
          <div className="stat-item reveal">
            <div className="stat-number">60%</div>
            <div className="stat-label">Cost Savings</div>
          </div>
        </div>
      </section>

      {/* ════════ PROBLEM SECTION ════════ */}
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
          <div className="comparison-grid">
            <div className="comparison-card">
              <h4>Generic Bot Response</h4>
              <div className="chat-messages">
                <div className="message guest">
                  <div className="message-bubble" style={{ background: 'rgba(0,0,0,0.05)', color: 'var(--text-dark)' }}>
                    Hi, is there parking available?
                  </div>
                </div>
                <div className="message alfred">
                  <div className="message-bubble" style={{ background: '#ccc', color: 'var(--text-dark)' }}>
                    Thank you for your inquiry. Parking information can be found in the Property Rules document. Best regards, Management.
                  </div>
                </div>
              </div>
            </div>
            <div className="comparison-card alfred">
              <h4>Alfred's Personalized Response</h4>
              <div className="chat-messages">
                <div className="message guest">
                  <div className="message-bubble" style={{ background: 'rgba(0,0,0,0.05)', color: 'var(--text-dark)' }}>
                    Hi, is there parking available?
                  </div>
                </div>
                <div className="message alfred">
                  <div className="message-bubble">
                    Hey! Yeah, we've got covered parking right out front. Just use the code from your check-in email and you're good. Hit me up if you need anything else!
                  </div>
                </div>
              </div>
            </div>
          </div>
          <p className="comparison-caption reveal">
            Alfred analyzes your past 100+ messages to replicate your tone, humor, and helpfulness. No training required.
          </p>
        </div>
      </section>

      {/* ════════ FEATURES ════════ */}
      <section className="section features-section" id="features">
        <div className="section-wide">
          <span className="section-label reveal" style={{ textAlign: 'center', display: 'block' }}>Capabilities</span>
          <h2 className="section-heading">What Alfred Handles</h2>
          <div className="features-grid">
            {FEATURES.map((f, i) => (
              <motion.div
                key={i}
                className="feature-card"
                whileHover={{ y: -6, boxShadow: '0 20px 60px rgba(0,0,0,0.08)' }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              >
                <div className="feature-icon"><f.icon size={24} strokeWidth={2} color="white" /></div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════ HOW IT WORKS ════════ */}
      <section className="section how-it-works" id="how-it-works">
        <div className="section-wide">
          <span className="section-label reveal" style={{ textAlign: 'center', display: 'block' }}>Getting Started</span>
          <h2 className="section-heading">Three Steps to Effortless Guest Management</h2>
          <div className="steps-grid">
            {STEPS.map((s, i) => (
              <div key={i} className="step">
                <motion.div
                  className="step-number"
                  whileHover={{ scale: 1.15, backgroundColor: '#C67D3B', color: '#fff' }}
                  transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                >
                  {s.num}
                </motion.div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            ))}
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

      {/* ════════ FINAL CTA ════════ */}
      <section className="final-cta">
        <div className="hero-grid-bg" />
        <div style={{ position: 'relative', zIndex: 2 }}>
          <h2 className="cta-headline">Ready to let Alfred handle your guests?</h2>
          <p className="reveal">Stop losing sleep over guest messages. Start your free demo today.</p>
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
