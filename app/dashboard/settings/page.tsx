"use client"

import { useAuthActions } from '@convex-dev/auth/react'
import { useRouter } from 'next/navigation'
import { Mail, MessageSquare, Building2, CreditCard, Shield, Globe, Sparkles, Check, AlertCircle, ExternalLink, LogOut } from 'lucide-react'

export default function Settings() {
  const { signOut } = useAuthActions()
  const router = useRouter()
  const shadowMode = true
  const plan = 'free'
  const actionsUsed = 0
  const actionsLimit = 100

  return (
    <div style={{ maxWidth: 640 }} className="dash-animate-in">
      <p style={{ fontSize: 13, color: 'var(--dash-text-muted)', margin: '0 0 28px' }}>
        Manage your account, connections, and Alfred&apos;s preferences.
      </p>

      <div className="dash-settings-section" style={{ background: 'linear-gradient(135deg, var(--dash-surface), rgba(99, 102, 241, 0.04))', borderColor: 'rgba(99, 102, 241, 0.15)' }}>
        <div className="dash-settings-title"><Shield size={16} color="var(--dash-accent)" />Shadow Mode</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 13.5, color: 'var(--dash-text)', fontWeight: 500, marginBottom: 4 }}>
              {shadowMode ? 'Alfred drafts replies for your approval' : 'Alfred replies autonomously'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--dash-text-muted)', lineHeight: 1.5 }}>
              {shadowMode ? 'You review and approve every guest reply before it\'s sent.' : 'Alfred sends replies directly to guests.'}
            </div>
          </div>
          <div className={`dash-toggle ${shadowMode ? 'active' : ''}`} role="switch" aria-checked={shadowMode} style={{ cursor: 'pointer', flexShrink: 0, marginLeft: 20 }} />
        </div>
      </div>

      <div className="dash-settings-section">
        <div className="dash-settings-title">Profile</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 13, color: 'var(--dash-text-muted)' }}>Manage your account.</div>
          <button className="dash-btn dash-btn-secondary" style={{ fontSize: 12 }} onClick={() => { signOut(); router.push('/'); }}>
            <LogOut size={12} /> Sign Out
          </button>
        </div>
      </div>

      <div className="dash-settings-section">
        <div className="dash-settings-title"><Building2 size={16} color="var(--dash-accent)" />Airbnb</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={14} color="var(--dash-text-muted)" />
            <span style={{ fontSize: 13, color: 'var(--dash-text-muted)' }}>Not connected</span>
          </div>
          <button className="dash-btn dash-btn-secondary" style={{ fontSize: 12 }}>Connect</button>
        </div>
      </div>

      <div className="dash-settings-section">
        <div className="dash-settings-title"><Mail size={16} color="var(--dash-accent)" />Gmail</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={14} color="var(--dash-text-muted)" />
            <span style={{ fontSize: 13, color: 'var(--dash-text-muted)' }}>Not connected</span>
          </div>
          <button className="dash-btn dash-btn-secondary" style={{ fontSize: 12 }}>Connect</button>
        </div>
      </div>

      <div className="dash-settings-section">
        <div className="dash-settings-title"><MessageSquare size={16} color="var(--dash-accent)" />Telegram</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={14} color="var(--dash-text-muted)" />
            <span style={{ fontSize: 13, color: 'var(--dash-text-muted)' }}>Not connected</span>
          </div>
          <a href="https://t.me/Host4Me_bot" target="_blank" rel="noopener noreferrer" className="dash-btn dash-btn-secondary" style={{ fontSize: 12, textDecoration: 'none' }}>Open Telegram <ExternalLink size={11} /></a>
        </div>
      </div>

      <div className="dash-settings-section">
        <div className="dash-settings-title"><Globe size={16} color="var(--dash-accent)" />Communication Style</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['Casual', 'Friendly', 'Professional', 'Luxury'].map((style) => (
            <button key={style} className={`dash-btn ${style.toLowerCase() === 'friendly' ? 'dash-btn-primary' : 'dash-btn-secondary'}`} style={{ fontSize: 12 }}>
              {style.toLowerCase() === 'friendly' && <Check size={12} />}{style}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 12, color: 'var(--dash-text-muted)', marginTop: 10 }}>Alfred matches this tone in all guest replies.</div>
      </div>

      <div className="dash-settings-section">
        <div className="dash-settings-title"><CreditCard size={16} color="var(--dash-accent)" />Billing</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--dash-text)' }}>Free Plan</div>
            <div style={{ fontSize: 12.5, color: 'var(--dash-text-muted)', marginTop: 2 }}>{actionsUsed} / {actionsLimit} actions used</div>
            <div style={{ width: 200, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', marginTop: 8, overflow: 'hidden' }}>
              <div style={{ width: `${(actionsUsed / actionsLimit) * 100}%`, height: '100%', borderRadius: 2, background: 'var(--dash-accent)' }} />
            </div>
          </div>
          <button className="dash-btn dash-btn-primary" style={{ fontSize: 12 }}><Sparkles size={12} />Upgrade</button>
        </div>
      </div>
    </div>
  )
}
