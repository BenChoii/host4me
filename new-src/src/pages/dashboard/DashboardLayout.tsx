import { Outlet, NavLink, useLocation } from "react-router-dom";
import { useAuthActions } from "@convex-dev/auth/react";
import { motion, AnimatePresence } from "motion/react";
import {
  LayoutDashboard,
  Building2,
  Settings,
  Sparkles,
  MessageSquare,
  Bell,
  Shield,
  LogOut,
} from "lucide-react";
import "./dashboard.css";

const NAV_ITEMS = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Overview", end: true },
  { to: "/dashboard/properties", icon: Building2, label: "Properties" },
  { to: "/dashboard/settings", icon: Settings, label: "Settings" },
];

export default function DashboardLayout() {
  const location = useLocation();
  const { signOut } = useAuthActions();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="dash">
      {/* Sidebar */}
      <aside className="dash-sidebar">
        <div className="dash-sidebar-header">
          <div className="dash-logo">
            <div className="dash-logo-icon">H</div>
            Host4Me
          </div>
        </div>

        <nav className="dash-nav">
          <div className="dash-nav-section">Main</div>
          {NAV_ITEMS.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `dash-nav-item${isActive ? " active" : ""}`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}

          <div className="dash-nav-section">Alfred</div>
          <a
            href="https://t.me/host4me_alfred_bot"
            target="_blank"
            rel="noopener noreferrer"
            className="dash-nav-item"
          >
            <MessageSquare size={16} />
            Chat in Telegram
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              style={{ marginLeft: "auto", opacity: 0.4 }}
            >
              <path
                d="M1 9L9 1M9 1H3M9 1V7"
                stroke="currentColor"
                strokeWidth="1.5"
                fill="none"
              />
            </svg>
          </a>
          <NavLink to="/dashboard/settings" className="dash-nav-item">
            <Shield size={16} />
            Shadow Mode
            <span
              className="dash-status active"
              style={{
                marginLeft: "auto",
                padding: "2px 8px",
                fontSize: 11,
              }}
            >
              <span className="dash-status-dot" />
              ON
            </span>
          </NavLink>
        </nav>

        <div className="dash-sidebar-footer">
          <div className="dash-user-avatar">H</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 550,
                color: "var(--dash-text)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              My Account
            </div>
            <div style={{ fontSize: 11, color: "var(--dash-text-muted)" }}>
              Free Plan
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="dash-btn dash-btn-ghost"
            style={{ padding: "4px 8px" }}
            title="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="dash-main">
        <header className="dash-header">
          <h1>
            {location.pathname === "/dashboard" && "Overview"}
            {location.pathname === "/dashboard/properties" && "Properties"}
            {location.pathname === "/dashboard/settings" && "Settings"}
            {location.pathname === "/dashboard/onboarding" && "Get Started"}
          </h1>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button className="dash-btn dash-btn-ghost" style={{ position: "relative" }}>
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
