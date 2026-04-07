import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useAction, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import {
  Building2, Mail, MessageSquare, Check, ArrowRight, ArrowLeft,
  Shield, Lock, Eye, EyeOff, Loader2, ExternalLink, Sparkles,
} from 'lucide-react';

const STEPS = [
  { id: 'welcome', title: 'Welcome' },
  { id: 'airbnb', title: 'Airbnb' },
  { id: 'gmail', title: 'Gmail' },
  { id: 'done', title: 'Ready' },
];

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [airbnbEmail, setAirbnbEmail] = useState('');
  const [airbnbPassword, setAirbnbPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [loginResult, setLoginResult] = useState(null);
  const navigate = useNavigate();
  const connectAirbnb = useAction(api.onboarding.connectAirbnb);
  const completeOnboarding = useMutation(api.tenants.completeOnboarding);

  return (
    <div className="dash-onboarding">
      {/* Progress */}
      <div className="dash-progress dash-animate-in">
        {STEPS.map((s, i) => (
          <div key={s.id} className={`dash-progress-step ${i < step ? 'complete' : ''} ${i === step ? 'active' : ''}`}>
            <div className={`dash-progress-bar ${i < step ? 'complete' : ''} ${i === step ? 'active' : ''}`} />
            <div className="dash-progress-label">{s.title}</div>
          </div>
        ))}
      </div>

      {/* Step content with animated transitions */}
      <AnimatePresence mode="wait">
      {STEPS[step].id === 'welcome' && (
        <motion.div
          key="welcome"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          <div style={{
            width: 56,
            height: 56,
            borderRadius: 'var(--dash-radius-lg)',
            background: 'var(--dash-accent-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 24,
          }}>
            <Sparkles size={26} color="var(--dash-accent)" />
          </div>
          <h2 style={{ fontSize: 26, fontWeight: 700, color: 'var(--dash-text)', marginBottom: 8, fontFamily: 'inherit', letterSpacing: '-0.02em' }}>
            Welcome to Host4Me
          </h2>
          <p style={{ color: 'var(--dash-text-secondary)', lineHeight: 1.7, marginBottom: 8, fontSize: 14.5 }}>
            Let's get Alfred set up. This takes about 3 minutes.
          </p>
          <p style={{ color: 'var(--dash-text-muted)', lineHeight: 1.7, marginBottom: 32, fontSize: 13 }}>
            Alfred will connect to your Airbnb and Gmail to start learning about your
            properties, guests, and communication style. He starts in <strong style={{ color: 'var(--dash-text-secondary)' }}>shadow mode</strong> —
            drafting replies for your approval before sending anything.
          </p>
          <motion.button
            className="dash-btn dash-btn-primary"
            onClick={() => setStep(1)}
            whileHover={{ scale: 1.03, boxShadow: '0 0 20px rgba(198, 125, 59, 0.25)' }}
            whileTap={{ scale: 0.97 }}
          >
            Let's Go <ArrowRight size={14} />
          </motion.button>
        </motion.div>
      )}

      {/* ─── Airbnb ─── */}
      {STEPS[step].id === 'airbnb' && (
        <motion.div
          key="airbnb"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          <div style={{
            width: 56,
            height: 56,
            borderRadius: 'var(--dash-radius-lg)',
            background: 'var(--dash-danger-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 24,
          }}>
            <Building2 size={26} color="var(--dash-danger)" />
          </div>
          <h2 style={{ fontSize: 26, fontWeight: 700, color: 'var(--dash-text)', marginBottom: 8, fontFamily: 'inherit', letterSpacing: '-0.02em' }}>
            Connect Airbnb
          </h2>
          <p style={{ color: 'var(--dash-text-secondary)', lineHeight: 1.7, marginBottom: 24, fontSize: 14.5 }}>
            Alfred needs access to monitor guest messages and respond on your behalf.
          </p>

          {/* Trust signals */}
          <div className="dash-card" style={{ marginBottom: 24, padding: 16 }}>
            <div style={{ display: 'flex', gap: 12, fontSize: 12.5, color: 'var(--dash-text-muted)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Lock size={12} color="var(--dash-success)" />
                AES-256 encrypted
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Shield size={12} color="var(--dash-success)" />
                Never stored in plain text
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Eye size={12} color="var(--dash-success)" />
                Shadow mode by default
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 28 }}>
            <div>
              <label className="dash-label">Airbnb Email</label>
              <input
                type="email"
                className="dash-input"
                value={airbnbEmail}
                onChange={(e) => setAirbnbEmail(e.target.value)}
                placeholder="your@email.com"
                autoFocus
              />
            </div>
            <div>
              <label className="dash-label">Airbnb Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="dash-input"
                  style={{ paddingRight: 44 }}
                  value={airbnbPassword}
                  onChange={(e) => setAirbnbPassword(e.target.value)}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="dash-btn dash-btn-ghost"
                  style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', padding: 6 }}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="dash-btn dash-btn-secondary" onClick={() => setStep(0)}>
              <ArrowLeft size={14} /> Back
            </button>
            <button
              className="dash-btn dash-btn-primary"
              disabled={!airbnbEmail || !airbnbPassword || connecting}
              style={{ opacity: (!airbnbEmail || !airbnbPassword || connecting) ? 0.5 : 1 }}
              onClick={async () => {
                setConnecting(true);
                try {
                  const result = await connectAirbnb({ email: airbnbEmail, password: airbnbPassword });
                  setLoginResult(result);
                  if (result.status === 'logged_in') {
                    setStep(2);
                  } else if (result.status === '2fa_required') {
                    alert('Airbnb requires a verification code. Check your email/phone and send it to Alfred in Telegram via /auth airbnb YOUR_CODE');
                    setStep(2);
                  } else {
                    alert(`Login issue: ${result.message || result.status}. You can retry or skip for now.`);
                  }
                } catch (err) {
                  alert(`Connection error: ${err.message}. You can skip and try again later.`);
                } finally {
                  setConnecting(false);
                }
              }}
            >
              {connecting ? (
                <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Connecting...</>
              ) : (
                <>Connect Airbnb <ArrowRight size={14} /></>
              )}
            </button>
            <button className="dash-btn dash-btn-ghost" style={{ fontSize: 12 }} onClick={() => setStep(2)}>
              Skip
            </button>
          </div>
        </motion.div>
      )}

      {/* ─── Gmail ─── */}
      {STEPS[step].id === 'gmail' && (
        <motion.div
          key="gmail"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          <div style={{
            width: 56,
            height: 56,
            borderRadius: 'var(--dash-radius-lg)',
            background: 'var(--dash-info-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 24,
          }}>
            <Mail size={26} color="var(--dash-info)" />
          </div>
          <h2 style={{ fontSize: 26, fontWeight: 700, color: 'var(--dash-text)', marginBottom: 8, fontFamily: 'inherit', letterSpacing: '-0.02em' }}>
            Connect Gmail
          </h2>
          <p style={{ color: 'var(--dash-text-secondary)', lineHeight: 1.7, marginBottom: 12, fontSize: 14.5 }}>
            Alfred reads your Gmail to automatically learn property details.
          </p>
          <p style={{ color: 'var(--dash-text-muted)', lineHeight: 1.7, marginBottom: 28, fontSize: 13 }}>
            WiFi passwords, gate codes, check-in instructions, parking details — Alfred extracts
            these from your booking confirmation emails so you never have to type them in manually.
            <strong style={{ color: 'var(--dash-text-secondary)' }}> Read-only access</strong> — Alfred never sends emails.
          </p>

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="dash-btn dash-btn-secondary" onClick={() => setStep(1)}>
              <ArrowLeft size={14} /> Back
            </button>
            <button
              className="dash-btn dash-btn-primary"
              onClick={() => {
                // TODO: Redirect to Gmail OAuth consent screen
                setStep(3);
              }}
            >
              Connect Gmail <Mail size={14} />
            </button>
            <button className="dash-btn dash-btn-ghost" style={{ fontSize: 12 }} onClick={() => setStep(3)}>
              Skip for now
            </button>
          </div>
        </motion.div>
      )}

      {/* ─── Done ─── */}
      {STEPS[step].id === 'done' && (
        <motion.div
          key="done"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          style={{ textAlign: 'center' }}
        >
          <div style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: 'var(--dash-success-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
          }}>
            <Check size={32} color="var(--dash-success)" />
          </div>
          <h2 style={{ fontSize: 26, fontWeight: 700, color: 'var(--dash-text)', marginBottom: 8, fontFamily: 'inherit', letterSpacing: '-0.02em' }}>
            Alfred is Ready
          </h2>
          <p style={{ color: 'var(--dash-text-secondary)', lineHeight: 1.7, marginBottom: 8, fontSize: 14.5 }}>
            Open Telegram to meet Alfred and start managing your properties.
          </p>
          <p style={{ color: 'var(--dash-text-muted)', fontSize: 13, marginBottom: 32, lineHeight: 1.6 }}>
            Alfred will send you a daily briefing at 8am and alert you immediately for anything urgent. He's in shadow mode — every guest reply draft needs your OK first.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <a
              href="https://t.me/Host4Me_bot"
              target="_blank"
              rel="noopener noreferrer"
              className="dash-btn dash-btn-primary"
              style={{ textDecoration: 'none' }}
            >
              <MessageSquare size={14} /> Open Telegram <ExternalLink size={11} />
            </a>
            <button
              className="dash-btn dash-btn-secondary"
              onClick={async () => {
                await completeOnboarding();
                navigate('/dashboard');
              }}
            >
              Go to Dashboard
            </button>
          </div>
        </motion.div>
      )}
      </AnimatePresence>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
