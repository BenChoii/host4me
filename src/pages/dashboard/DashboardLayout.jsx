import { Outlet, NavLink } from 'react-router-dom';
import { UserButton } from '@clerk/clerk-react';
import { BarChart3, Home as HomeIcon, Settings, Building2 } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/dashboard', icon: HomeIcon, label: 'Overview', end: true },
  { to: '/dashboard/properties', icon: Building2, label: 'Properties' },
  { to: '/dashboard/settings', icon: Settings, label: 'Settings' },
];

export default function DashboardLayout() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0a0a0a', color: '#e0e0e0' }}>
      {/* Sidebar */}
      <aside style={{
        width: 240,
        borderRight: '1px solid rgba(255,255,255,0.08)',
        padding: '24px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32, padding: '0 8px' }}>
          <BarChart3 size={22} color="#c67d3b" />
          <span style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>Host4Me</span>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
          {NAV_ITEMS.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 8,
                textDecoration: 'none',
                color: isActive ? '#fff' : '#999',
                background: isActive ? 'rgba(198, 125, 59, 0.15)' : 'transparent',
                fontSize: 14,
                fontWeight: isActive ? 600 : 400,
                transition: 'all 0.15s',
              })}
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div style={{ padding: '12px 8px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <UserButton
            appearance={{
              elements: { avatarBox: { width: 32, height: 32 } },
            }}
          />
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, padding: 32, overflowY: 'auto' }}>
        <Outlet />
      </main>
    </div>
  );
}
