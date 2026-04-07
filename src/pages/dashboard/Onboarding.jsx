import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Mail, MessageSquare, Check, ArrowRight, ArrowLeft } from 'lucide-react';

const STEPS = [
  { id: 'welcome', title: 'Welcome', icon: MessageSquare },
  { id: 'airbnb', title: 'Connect Airbnb', icon: Building2 },
  { id: 'gmail', title: 'Connect Gmail', icon: Mail },
  { id: 'done', title: 'Meet Alfred', icon: Check },
];

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [airbnbEmail, setAirbnbEmail] = useState('');
  const [airbnbPassword, setAirbnbPassword] = useState('');
  const [connecting, setConnecting] = useState(false);
  const navigate = useNavigate();

  const currentStep = STEPS[step];

  const inputStyle = {
    width: '100%',
    padding: '12px 16px',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.05)',
    color: '#fff',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
  };

  const btnPrimary = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 24px',
    borderRadius: 8,
    border: 'none',
    background: '#c67d3b',
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  };

  const btnSecondary = {
    ...btnPrimary,
    background: 'rgba(255,255,255,0.08)',
    color: '#999',
  };

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      {/* Progress */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 48 }}>
        {STEPS.map((s, i) => (
          <div key={s.id} style={{ flex: 1 }}>
            <div style={{
              height: 4,
              borderRadius: 2,
              background: i <= step ? '#c67d3b' : 'rgba(255,255,255,0.1)',
              transition: 'background 0.3s',
            }} />
            <div style={{
              fontSize: 11,
              color: i <= step ? '#c67d3b' : '#666',
              marginTop: 6,
              textAlign: 'center',
            }}>
              {s.title}
            </div>
          </div>
        ))}
      </div>

      {/* Step content */}
      {currentStep.id === 'welcome' && (
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#fff', marginBottom: 12 }}>
            Welcome to Host4Me
          </h1>
          <p style={{ color: '#999', lineHeight: 1.7, marginBottom: 32 }}>
            Let's get Alfred set up to manage your properties. This takes about 3 minutes.
            Alfred will connect to your Airbnb and Gmail to start learning about your
            properties, guests, and communication style.
          </p>
          <button style={btnPrimary} onClick={() => setStep(1)}>
            Let's Go <ArrowRight size={16} />
          </button>
        </div>
      )}

      {currentStep.id === 'airbnb' && (
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#fff', marginBottom: 12 }}>
            Connect Airbnb
          </h1>
          <p style={{ color: '#999', lineHeight: 1.7, marginBottom: 24 }}>
            Alfred needs access to your Airbnb account to monitor guest messages,
            check bookings, and reply on your behalf. Your credentials are encrypted
            and never stored in plain text.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 32 }}>
            <div>
              <label style={{ fontSize: 13, color: '#888', display: 'block', marginBottom: 6 }}>
                Airbnb Email
              </label>
              <input
                type="email"
                style={inputStyle}
                value={airbnbEmail}
                onChange={(e) => setAirbnbEmail(e.target.value)}
                placeholder="your@email.com"
              />
            </div>
            <div>
              <label style={{ fontSize: 13, color: '#888', display: 'block', marginBottom: 6 }}>
                Airbnb Password
              </label>
              <input
                type="password"
                style={inputStyle}
                value={airbnbPassword}
                onChange={(e) => setAirbnbPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button style={btnSecondary} onClick={() => setStep(0)}>
              <ArrowLeft size={16} /> Back
            </button>
            <button
              style={{ ...btnPrimary, opacity: (!airbnbEmail || !airbnbPassword) ? 0.5 : 1 }}
              disabled={!airbnbEmail || !airbnbPassword || connecting}
              onClick={async () => {
                setConnecting(true);
                // TODO: Call Convex action to trigger browser agent login
                // const result = await connectAirbnb({ email: airbnbEmail, password: airbnbPassword });
                setTimeout(() => {
                  setConnecting(false);
                  setStep(2);
                }, 2000);
              }}
            >
              {connecting ? 'Connecting...' : 'Connect Airbnb'} <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {currentStep.id === 'gmail' && (
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#fff', marginBottom: 12 }}>
            Connect Gmail
          </h1>
          <p style={{ color: '#999', lineHeight: 1.7, marginBottom: 24 }}>
            Alfred monitors your Gmail for booking confirmations, guest inquiries, and
            property details like wifi passwords and check-in instructions. We only
            request read access — Alfred never sends emails.
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button style={btnSecondary} onClick={() => setStep(1)}>
              <ArrowLeft size={16} /> Back
            </button>
            <button
              style={btnPrimary}
              onClick={() => {
                // TODO: Redirect to Gmail OAuth consent screen
                // window.location.href = `${CONVEX_HTTP_URL}/auth/gmail/start?state=${clerkUserId}`;
                setStep(3);
              }}
            >
              Connect Gmail <Mail size={16} />
            </button>
            <button
              style={{ ...btnSecondary, fontSize: 13 }}
              onClick={() => setStep(3)}
            >
              Skip for now
            </button>
          </div>
        </div>
      )}

      {currentStep.id === 'done' && (
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: 'rgba(198, 125, 59, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
          }}>
            <Check size={36} color="#c67d3b" />
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#fff', marginBottom: 12 }}>
            Alfred is Ready
          </h1>
          <p style={{ color: '#999', lineHeight: 1.7, marginBottom: 12 }}>
            Your AI property manager is set up and monitoring your accounts.
            Open Telegram to start chatting with Alfred.
          </p>
          <p style={{ color: '#666', fontSize: 13, marginBottom: 32 }}>
            Alfred will send you a daily briefing at 8am and alert you immediately
            for anything urgent.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <a
              href="https://t.me/Host4Me_bot"
              target="_blank"
              rel="noopener noreferrer"
              style={{ ...btnPrimary, textDecoration: 'none' }}
            >
              <MessageSquare size={16} /> Open Telegram
            </a>
            <button
              style={btnSecondary}
              onClick={() => navigate('/dashboard')}
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
