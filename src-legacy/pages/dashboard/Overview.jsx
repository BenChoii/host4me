import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  MessageSquare, Building2, Zap, Clock, Bot, ArrowRight,
  CheckCircle2, Mail, Shield, ExternalLink, TrendingUp,
} from 'lucide-react';
import AlfredIcon from '../../components/agents/AlfredIcon';

const MotionCard = ({ children, delay = 0, className = '', ...props }) => (
  <motion.div
    className={className}
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] }}
    whileHover={{ y: -2, transition: { duration: 0.15 } }}
    {...props}
  >
    {children}
  </motion.div>
);

// Show this when user hasn't completed onboarding
function WelcomeView() {
  const navigate = useNavigate();

  return (
    <div>
      {/* Hero welcome card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="dash-card dash-card-glow"
        style={{
          padding: '36px 32px',
          background: 'linear-gradient(135deg, var(--dash-surface), rgba(99, 102, 241, 0.06))',
          marginBottom: 24,
          textAlign: 'center',
        }}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
          style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            margin: '0 auto 16px',
          }}
        >
          <AlfredIcon size={64} />
        </motion.div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--dash-text)', marginBottom: 6, fontFamily: 'inherit' }}>
          Your AI Company
        </h2>
        <p style={{ color: 'var(--dash-text-secondary)', fontSize: 14, marginBottom: 20, maxWidth: 400, margin: '0 auto 20px' }}>
          Alfred is ready to manage your properties. Activate him to get started.
        </p>
        <motion.button
          className="dash-btn dash-btn-primary"
          style={{ padding: '12px 28px', fontSize: 14 }}
          whileHover={{ scale: 1.03, boxShadow: '0 0 24px rgba(99, 102, 241, 0.3)' }}
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate('/dashboard/onboarding')}
        >
          Activate Alfred <ArrowRight size={14} />
        </motion.button>
      </motion.div>

      {/* Setup checklist */}
      <div className="dash-card" style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--dash-text)', marginBottom: 16, fontFamily: 'inherit' }}>
          Setup Checklist
        </h3>
        {[
          { label: 'Create account', done: true, icon: CheckCircle2 },
          { label: 'Activate Alfred', done: false, icon: Bot, action: () => navigate('/dashboard/onboarding') },
          { label: 'Connect Airbnb', done: false, icon: Building2 },
          { label: 'Connect Gmail (optional)', done: false, icon: Mail },
          { label: 'Open Telegram', done: false, icon: MessageSquare },
        ].map(({ label, done, icon: Icon, action }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + i * 0.06, duration: 0.3 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 0',
              borderBottom: i < 4 ? '1px solid var(--dash-border)' : 'none',
              cursor: action ? 'pointer' : 'default',
            }}
            onClick={action}
          >
            <div style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: done ? 'var(--dash-success-subtle)' : 'var(--dash-surface-hover)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {done ? <CheckCircle2 size={14} color="var(--dash-success)" /> : <Icon size={14} color="var(--dash-text-muted)" />}
            </div>
            <span style={{
              fontSize: 13.5,
              color: done ? 'var(--dash-text-muted)' : 'var(--dash-text)',
              textDecoration: done ? 'line-through' : 'none',
              flex: 1,
            }}>
              {label}
            </span>
            {!done && action && <ArrowRight size={12} color="var(--dash-text-muted)" />}
          </motion.div>
        ))}
      </div>

      {/* What to expect */}
      <div className="dash-card" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--dash-text)', marginBottom: 12, fontFamily: 'inherit' }}>
          What to Expect
        </h3>
        <div style={{ fontSize: 13, color: 'var(--dash-text-muted)', lineHeight: 1.8 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}><span style={{ color: 'var(--dash-accent)' }}>1.</span> Alfred monitors your Airbnb inbox every 3 minutes</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}><span style={{ color: 'var(--dash-accent)' }}>2.</span> When a guest messages, Alfred drafts a reply in your style</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}><span style={{ color: 'var(--dash-accent)' }}>3.</span> You get the draft in Telegram — approve, edit, or reject</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}><span style={{ color: 'var(--dash-accent)' }}>4.</span> Every morning at 8am, Alfred sends a daily briefing</div>
          <div style={{ display: 'flex', gap: 8 }}><span style={{ color: 'var(--dash-accent)' }}>5.</span> After a week, Alfred suggests going fully autonomous</div>
        </div>
      </div>
    </div>
  );
}

// Show this after onboarding is complete
function ActiveDashboard() {
  const MOCK_ACTIVITY = [
    { icon: '📨', iconBg: 'var(--dash-info-subtle)', title: 'Alfred checked Airbnb inbox', time: '2 min ago' },
    { icon: '✉️', iconBg: 'var(--dash-success-subtle)', title: 'Replied to Sarah about check-in time for Sunset Villa', time: '15 min ago' },
    { icon: '🔐', iconBg: 'var(--dash-warning-subtle)', title: 'Gmail sync — 3 new property details extracted', time: '1 hour ago' },
    { icon: '📊', iconBg: 'var(--dash-accent-subtle)', title: 'Daily briefing delivered via Telegram', time: '8:00 AM' },
  ];

  return (
    <div>
      {/* Alfred status */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="dash-card dash-card-glow"
        style={{
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '16px 20px',
          background: 'linear-gradient(135deg, var(--dash-surface), rgba(99, 102, 241, 0.04))',
        }}
      >
        <AlfredIcon size={40} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--dash-text)', marginBottom: 2 }}>Alfred is active</div>
          <div style={{ fontSize: 12.5, color: 'var(--dash-text-muted)' }}>
            Monitoring your properties. Shadow mode on — drafts require your approval.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a
            href="https://t.me/Host4Me_bot"
            target="_blank"
            rel="noopener noreferrer"
            className="dash-btn dash-btn-secondary"
            style={{ textDecoration: 'none', fontSize: 12 }}
          >
            <MessageSquare size={12} /> Telegram <ExternalLink size={10} />
          </a>
          <span className="dash-status active">
            <span className="dash-status-dot" />
            Running
          </span>
        </div>
      </motion.div>

      {/* Metrics */}
      <div className="dash-metrics" style={{ marginBottom: 24 }}>
        {[
          { icon: MessageSquare, label: 'Messages Today', value: '0', color: 'var(--dash-accent)' },
          { icon: Clock, label: 'Avg Response', value: '—', color: 'var(--dash-info)' },
          { icon: Building2, label: 'Properties', value: '0', color: 'var(--dash-success)' },
          { icon: Zap, label: 'Actions Used', value: '0 / 100', color: 'var(--dash-warning)' },
        ].map(({ icon: Icon, label, value, color }, i) => (
          <MotionCard key={label} delay={0.1 + i * 0.06} className="dash-metric">
            <div className="dash-metric-label"><Icon size={13} style={{ color }} />{label}</div>
            <div className="dash-metric-value">{value}</div>
          </MotionCard>
        ))}
      </div>

      {/* Activity Feed */}
      <motion.div
        className="dash-card"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--dash-text)', fontFamily: 'inherit' }}>Recent Activity</h2>
        </div>
        <div className="dash-feed">
          {MOCK_ACTIVITY.map((item, i) => (
            <motion.div
              key={i}
              className="dash-feed-item"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.4 + i * 0.06 }}
            >
              <div className="dash-feed-icon" style={{ background: item.iconBg, fontSize: 16 }}>{item.icon}</div>
              <div className="dash-feed-content">
                <div className="dash-feed-title">{item.title}</div>
                <div className="dash-feed-time">{item.time}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

export default function Overview() {
  // TODO: Wire to Convex — check if tenant is onboarded
  // const tenant = useQuery(api.tenants.get);
  const isOnboarded = false; // Change to tenant?.onboarded when wired

  return isOnboarded ? <ActiveDashboard /> : <WelcomeView />;
}
