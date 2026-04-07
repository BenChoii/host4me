import { MessageSquare, Building2, AlertTriangle, Activity } from 'lucide-react';

const cardStyle = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 12,
  padding: 24,
};

export default function Overview() {
  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#fff', marginBottom: 8 }}>
        Dashboard
      </h1>
      <p style={{ color: '#666', marginBottom: 32 }}>
        Alfred is monitoring your properties. Here's what's happening.
      </p>

      {/* Metric cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
        {[
          { icon: MessageSquare, label: 'Messages Today', value: '—', color: '#c67d3b' },
          { icon: Building2, label: 'Properties', value: '—', color: '#4a9eff' },
          { icon: AlertTriangle, label: 'Escalations', value: '—', color: '#ff6b6b' },
          { icon: Activity, label: 'Actions Used', value: '—', color: '#51cf66' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Icon size={16} color={color} />
              <span style={{ fontSize: 13, color: '#888' }}>{label}</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#fff' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Activity feed */}
      <div style={cardStyle}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: '#fff', marginBottom: 16 }}>
          Recent Activity
        </h2>
        <div style={{ color: '#666', fontSize: 14, textAlign: 'center', padding: 32 }}>
          Complete onboarding to see Alfred's activity here.
        </div>
      </div>
    </div>
  );
}
