"use client"

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useConvexAuth } from 'convex/react'
import { useAuthActions } from '@convex-dev/auth/react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Building2,
  Settings,
  Sparkles,
  MessageSquare,
  Bell,
  Shield,
  Menu,
  X,
  LogOut,
  Loader2,
} from 'lucide-react'
import './dashboard.css'

const NAV_ITEMS = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Overview', exact: true },
  { href: '/dashboard/properties', icon: Building2, label: 'Properties' },
  { href: '/dashboard/settings', icon: Settings, label: 'Settings' },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { isAuthenticated, isLoading } = useConvexAuth()
  const { signOut } = useAuthActions()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Redirect to sign-in if not authenticated
  if (!isLoading && !isAuthenticated) {
    router.replace('/sign-in')
    return null
  }

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#050505' }}>
        <Loader2 size={24} color="#6366f1" style={{ animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href
    return pathname.startsWith(href)
  }

  const pageTitle = () => {
    if (pathname === '/dashboard') return 'Overview'
    if (pathname === '/dashboard/properties') return 'Properties'
    if (pathname === '/dashboard/settings') return 'Settings'
    if (pathname === '/dashboard/onboarding') return 'Get Started'
    return 'Dashboard'
  }

  return (
    <div className="dash">
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileMenuOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 20, display: 'none' }}
            className="dash-mobile-overlay"
          />
        )}
      </AnimatePresence>

      <aside className={`dash-sidebar ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="dash-sidebar-header">
          <div className="dash-logo">host<span style={{ color: 'var(--dash-accent)' }}>4</span>me</div>
          <button className="dash-mobile-close dash-btn dash-btn-ghost" onClick={() => setMobileMenuOpen(false)} style={{ display: 'none', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <nav className="dash-nav">
          <div className="dash-nav-section">Main</div>
          {NAV_ITEMS.map(({ href, icon: Icon, label, exact }) => (
            <Link key={href} href={href} className={`dash-nav-item${isActive(href, exact) ? ' active' : ''}`}>
              <Icon size={16} />{label}
            </Link>
          ))}

          <div className="dash-nav-section">Alfred</div>
          <a href="https://t.me/Host4Me_bot" target="_blank" rel="noopener noreferrer" className="dash-nav-item">
            <MessageSquare size={16} />Chat in Telegram
            <svg width="10" height="10" viewBox="0 0 10 10" style={{ marginLeft: 'auto', opacity: 0.4 }}>
              <path d="M1 9L9 1M9 1H3M9 1V7" stroke="currentColor" strokeWidth="1.5" fill="none" />
            </svg>
          </a>
          <Link href="/dashboard/settings" className="dash-nav-item">
            <Shield size={16} />Shadow Mode
            <span className="dash-status active" style={{ marginLeft: 'auto', padding: '2px 8px', fontSize: 11 }}>
              <span className="dash-status-dot" />ON
            </span>
          </Link>
        </nav>

        <div className="dash-sidebar-footer">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 550, color: 'var(--dash-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>My Account</div>
            <div style={{ fontSize: 11, color: 'var(--dash-text-muted)' }}>Free Plan</div>
          </div>
          <button className="dash-btn dash-btn-ghost" style={{ padding: 6 }} onClick={() => { signOut(); router.push('/'); }} title="Sign out">
            <LogOut size={14} />
          </button>
        </div>
      </aside>

      <div className="dash-main">
        <header className="dash-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="dash-mobile-hamburger dash-btn dash-btn-ghost" onClick={() => setMobileMenuOpen(true)} style={{ display: 'none', padding: 6 }}>
              <Menu size={20} />
            </button>
            <h1>{pageTitle()}</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="dash-btn dash-btn-ghost" style={{ position: 'relative' }}><Bell size={16} /></button>
            <button className="dash-btn dash-btn-primary"><Sparkles size={14} />Upgrade</button>
          </div>
        </header>

        <div className="dash-content">
          <AnimatePresence mode="wait">
            <motion.div key={pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}>
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
