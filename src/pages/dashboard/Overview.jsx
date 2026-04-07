import { motion } from 'motion/react';
import { MessageSquare, Building2, AlertTriangle, Zap, ArrowUpRight, ArrowDownRight, Clock, CheckCircle2, Bot } from 'lucide-react';

const MotionCard = ({ children, delay = 0, ...props }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] }}
    whileHover={{ y: -2, transition: { duration: 0.15 } }}
    {...props}
  >
    {children}
  </motion.div>
);

const MOCK_ACTIVITY = [
  { icon: '📨', iconBg: 'var(--dash-info-subtle)', title: 'Alfred checked Airbnb inbox', time: '2 min ago', type: 'inbox_check' },
  { icon: '✉️', iconBg: 'var(--dash-success-subtle)', title: 'Replied to Sarah about check-in time for Sunset Villa', time: '15 min ago', type: 'reply_sent' },
  { icon: '🔐', iconBg: 'var(--dash-warning-subtle)', title: 'Gmail sync completed — 3 new property details extracted', time: '1 hour ago', type: 'gmail_sync' },
  { icon: '📊', iconBg: 'var(--dash-accent-subtle)', title: 'Daily briefing delivered via Telegram', time: '8:00 AM', type: 'briefing' },
  { icon: '🟡', iconBg: 'var(--dash-warning-subtle)', title: 'Escalation: Guest requesting early check-in at Beach House', time: 'Yesterday', type: 'escalation' },
];

export default function Overview() {
  return (
    <div>
      {/* Alfred status bar */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="dash-card dash-card-glow" style={{
        marginBottom: 24,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '16px 20px',
        background: 'linear-gradient(135deg, var(--dash-surface), rgba(198, 125, 59, 0.04))',
      }}>
        <div style={{
          width: 40,
          height: 40,
          borderRadius: 'var(--dash-radius)',
          background: 'var(--dash-accent-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Bot size={20} color="var(--dash-accent)" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--dash-text)', marginBottom: 2 }}>
            Alfred is active
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--dash-text-muted)' }}>
            Monitoring 0 properties across Airbnb. Shadow mode is on — drafts require your approval.
          </div>
        </div>
        <span className="dash-status active">
          <span className="dash-status-dot" />
          Running
        </span>
      </motion.div>

      {/* Metrics */}
      <div className="dash-metrics" style={{ marginBottom: 24 }}>
        {[
          { icon: MessageSquare, label: 'Messages Today', value: '0', change: null, color: 'var(--dash-accent)' },
          { icon: Clock, label: 'Avg Response', value: '—', change: null, color: 'var(--dash-info)' },
          { icon: Building2, label: 'Properties', value: '0', change: null, color: 'var(--dash-success)' },
          { icon: Zap, label: 'Actions Used', value: '0 / 100', change: null, color: 'var(--dash-warning)' },
        ].map(({ icon: Icon, label, value, change, color }, i) => (
          <MotionCard key={label} delay={0.1 + i * 0.06} className="dash-metric">
            <div className="dash-metric-label">
              <Icon size={13} style={{ color }} />
              {label}
            </div>
            <div className="dash-metric-value">{value}</div>
            {change && (
              <div className={`dash-metric-change ${change > 0 ? 'up' : 'down'}`}>
                {change > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                {Math.abs(change)}% vs last week
              </div>
            )}
          </MotionCard>
        ))}
      </div>

      {/* Activity Feed */}
      <div className="dash-card dash-animate-in" style={{ animationDelay: '250ms' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--dash-text)', fontFamily: 'inherit' }}>
            Recent Activity
          </h2>
          <button className="dash-btn dash-btn-ghost" style={{ fontSize: 12 }}>
            View All
          </button>
        </div>

        <div className="dash-feed">
          {MOCK_ACTIVITY.map((item, i) => (
            <motion.div
              key={i}
              className="dash-feed-item"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.3 + i * 0.06, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="dash-feed-icon" style={{ background: item.iconBg, fontSize: 16 }}>
                {item.icon}
              </div>
              <div className="dash-feed-content">
                <div className="dash-feed-title">{item.title}</div>
                <div className="dash-feed-time">{item.time}</div>
              </div>
            </motion.div>
          ))}
        </div>

        {MOCK_ACTIVITY.length === 0 && (
          <div className="dash-empty">
            <div className="dash-empty-icon">
              <CheckCircle2 size={20} color="var(--dash-text-muted)" />
            </div>
            <div className="dash-empty-title">No activity yet</div>
            <div className="dash-empty-desc">
              Complete onboarding to connect your accounts and Alfred will start monitoring.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
