import { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { UserButton } from '@clerk/clerk-react';
import { motion, AnimatePresence } from 'motion/react';
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
} from 'lucide-react';
import '../../dashboard.css';

const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Overview', end: true },
  { to: '/dashboard/properties', icon: Building2, label: 'Properties' },
  { to: '/dashboard/settings', icon: Settings, label: 'Settings' },
];

export default function DashboardLayout() {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="dash">
      {/* Mobile menu overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileMenuOpen(false)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
              zIndex: 20, display: 'none',
            }}
            className="dash-mobile-overlay"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={`dash-sidebar ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="dash-sidebar-header">
          <div className="dash-logo">
            <div className="dash-logo-icon">H</div>
            Host4Me
          </div>
          <button
            className="dash-mobile-close dash-btn dash-btn-ghost"
            onClick={() => setMobileMenuOpen(false)}
            style={{ display: 'none', padding: 4 }}
          >
            <X size={18} />
          </button>
        </div>

        <nav className="dash-nav">
          <div className="dash-nav-section">Main</div>
          {NAV_ITEMS.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `dash-nav-item${isActive ? ' active' : ''}`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}

          <div className="dash-nav-section">Alfred</div>
          <a
            href="https://t.me/Host4Me_bot"
            target="_blank"
            rel="noopener noreferrer"
            className="dash-nav-item"
          >
            <MessageSquare size={16} />
            Chat in Telegram
            <svg width="10" height="10" viewBox="0 0 10 10" style={{ marginLeft: 'auto', opacity: 0.4 }}>
              <path d="M1 9L9 1M9 1H3M9 1V7" stroke="currentColor" strokeWidth="1.5" fill="none" />
            </svg>
          </a>
          <NavLink to="/dashboard/settings" className="dash-nav-item">
            <Shield size={16} />
            Shadow Mode
            <span className="dash-status active" style={{ marginLeft: 'auto', padding: '2px 8px', fontSize: 11 }}>
              <span className="dash-status-dot" />
              ON
            </span>
          </NavLink>
        </nav>

        <div className="dash-sidebar-footer">
          <UserButton
            appearance={{
              elements: { avatarBox: { width: 30, height: 30 } },
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 550, color: 'var(--dash-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              My Account
            </div>
            <div style={{ fontSize: 11, color: 'var(--dash-text-muted)' }}>Free Plan</div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="dash-main">
        <header className="dash-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              className="dash-mobile-hamburger dash-btn dash-btn-ghost"
              onClick={() => setMobileMenuOpen(true)}
              style={{ display: 'none', padding: 6 }}
            >
              <Menu size={20} />
            </button>
          <h1>
            {location.pathname === '/dashboard' && 'Overview'}
            {location.pathname === '/dashboard/properties' && 'Properties'}
            {location.pathname === '/dashboard/settings' && 'Settings'}
            {location.pathname === '/dashboard/onboarding' && 'Get Started'}
          </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="dash-btn dash-btn-ghost" style={{ position: 'relative' }}>
              <Bell size={16} />
            </button>
            <button className="dash-btn dash-btn-primary">
              <Sparkles size={14} />
              Upgrade
            </button>
          </div>
        </header>

        <div className="dash-content">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
