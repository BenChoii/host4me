import { UserButton } from '@clerk/clerk-react';
import { Mail, MessageSquare, Building2, CreditCard } from 'lucide-react';

const cardStyle = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 12,
  padding: 24,
  marginBottom: 16,
};

const sectionTitle = {
  fontSize: 16,
  fontWeight: 600,
  color: '#fff',
  marginBottom: 16,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

export default function Settings() {
  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#fff', marginBottom: 8 }}>
        Settings
      </h1>
      <p style={{ color: '#666', marginBottom: 32 }}>
        Manage your account, connections, and Alfred's preferences.
      </p>

      {/* Profile */}
      <div style={cardStyle}>
        <h2 style={sectionTitle}>Profile</h2>
        <UserButton
          appearance={{
            elements: { avatarBox: { width: 48, height: 48 } },
          }}
        />
        <p style={{ color: '#888', fontSize: 13, marginTop: 8 }}>
          Manage your profile and account via Clerk.
        </p>
      </div>

      {/* Connected Platforms */}
      <div style={cardStyle}>
        <h2 style={sectionTitle}>
          <Building2 size={18} color="#c67d3b" /> Connected Platforms
        </h2>
        <div style={{ color: '#888', fontSize: 14 }}>
          No platforms connected yet. Complete onboarding to connect Airbnb.
        </div>
      </div>

      {/* Gmail */}
      <div style={cardStyle}>
        <h2 style={sectionTitle}>
          <Mail size={18} color="#c67d3b" /> Gmail
        </h2>
        <div style={{ color: '#888', fontSize: 14 }}>
          Not connected. Connect Gmail so Alfred can learn property details from your emails.
        </div>
      </div>

      {/* Telegram */}
      <div style={cardStyle}>
        <h2 style={sectionTitle}>
          <MessageSquare size={18} color="#c67d3b" /> Telegram
        </h2>
        <div style={{ color: '#888', fontSize: 14 }}>
          Not connected. Open Telegram to start chatting with Alfred.
        </div>
      </div>

      {/* Billing */}
      <div style={cardStyle}>
        <h2 style={sectionTitle}>
          <CreditCard size={18} color="#c67d3b" /> Billing
        </h2>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ color: '#fff', fontWeight: 600 }}>Free Plan</div>
            <div style={{ color: '#888', fontSize: 13 }}>0 / 100 actions used</div>
          </div>
          <button style={{
            padding: '8px 16px',
            borderRadius: 8,
            border: '1px solid rgba(198, 125, 59, 0.3)',
            background: 'transparent',
            color: '#c67d3b',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}>
            Upgrade
          </button>
        </div>
      </div>
    </div>
  );
}
