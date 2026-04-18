import { useState } from "react";
import { motion } from "motion/react";
import { useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";

const PLATFORMS = [
  {
    id: "vrbo",
    name: "VRBO",
    logo: "🏠",
    color: "#1d5cff",
    description: "Sync reservations, listings, and guest data from VRBO",
  },
  {
    id: "airbnb",
    name: "Airbnb",
    logo: "🌐",
    color: "#ff5a5f",
    description: "Sync reservations and messages from Airbnb",
  },
];

export default function Settings() {
  const syncReservations = useAction(api.reservations.syncReservations);

  const [syncState, setSyncState] = useState<Record<string, {
    status: "idle" | "syncing" | "success" | "error";
    message?: string;
    reservations?: number;
    listings?: number;
  }>>({});

  const handleSync = async (platform: string) => {
    setSyncState(prev => ({ ...prev, [platform]: { status: "syncing" } }));
    try {
      const result = await syncReservations({ platform });
      setSyncState(prev => ({
        ...prev,
        [platform]: {
          status: "success",
          message: `Synced ${result.reservations} reservations and ${result.listings} listings`,
          reservations: result.reservations,
          listings: result.listings,
        },
      }));
    } catch (err: any) {
      setSyncState(prev => ({
        ...prev,
        [platform]: {
          status: "error",
          message: err.message || "Sync failed",
        },
      }));
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--dash-text)", marginBottom: 8 }}>
        Settings
      </h2>
      <p style={{ color: "var(--dash-text-muted)", marginBottom: 32, fontSize: 14 }}>
        Manage platform connections and sync Alfred's data
      </p>

      {/* Platform Connections */}
      <div style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--dash-text)", marginBottom: 16 }}>
          Connected Platforms
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {PLATFORMS.map(platform => {
            const state = syncState[platform.id] || { status: "idle" };
            const isSyncing = state.status === "syncing";

            return (
              <div
                key={platform.id}
                className="dash-card"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  padding: "16px 20px",
                }}
              >
                {/* Logo */}
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: `${platform.color}18`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 22,
                  flexShrink: 0,
                }}>
                  {platform.logo}
                </div>

                {/* Info */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: "var(--dash-text)" }}>
                      {platform.name}
                    </span>
                    {/* Status badge */}
                    <span style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: 20,
                      background: state.status === "success"
                        ? "#10b98120"
                        : state.status === "error"
                        ? "#ef444420"
                        : "#6b728020",
                      color: state.status === "success"
                        ? "#059669"
                        : state.status === "error"
                        ? "#dc2626"
                        : "var(--dash-text-muted)",
                    }}>
                      {state.status === "success" ? "✓ Synced" :
                       state.status === "error" ? "Error" :
                       state.status === "syncing" ? "Syncing..." :
                       "Connected"}
                    </span>
                  </div>
                  <p style={{ fontSize: 13, color: "var(--dash-text-muted)", margin: 0 }}>
                    {state.status === "success"
                      ? state.message
                      : state.status === "error"
                      ? state.message
                      : platform.description}
                  </p>
                </div>

                {/* Sync button */}
                <button
                  onClick={() => handleSync(platform.id)}
                  disabled={isSyncing}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 8,
                    border: "none",
                    background: isSyncing ? "var(--dash-border)" : "var(--dash-text)",
                    color: isSyncing ? "var(--dash-text-muted)" : "white",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: isSyncing ? "default" : "pointer",
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    transition: "all 0.2s",
                  }}
                >
                  {isSyncing ? (
                    <>
                      <span style={{
                        display: "inline-block",
                        width: 12,
                        height: 12,
                        border: "2px solid var(--dash-text-muted)",
                        borderTopColor: "transparent",
                        borderRadius: "50%",
                        animation: "spin 0.8s linear infinite",
                      }} />
                      Syncing...
                    </>
                  ) : (
                    <>↻ Sync Now</>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Alfred Preferences */}
      <div style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--dash-text)", marginBottom: 16 }}>
          Alfred Preferences
        </h3>
        <div className="dash-card" style={{ padding: "20px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[
              { label: "Auto-reply to guest messages", defaultOn: false },
              { label: "Notify me on new bookings via Telegram", defaultOn: true },
              { label: "Shadow Mode (Alfred suggests, you approve)", defaultOn: true },
              { label: "Learn from reservation patterns", defaultOn: true },
            ].map(pref => (
              <div key={pref.label} style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}>
                <span style={{ fontSize: 14, color: "var(--dash-text)" }}>{pref.label}</span>
                <div style={{
                  width: 40,
                  height: 22,
                  borderRadius: 11,
                  background: pref.defaultOn ? "var(--dash-text)" : "var(--dash-border)",
                  position: "relative",
                  cursor: "pointer",
                  flexShrink: 0,
                }}>
                  <div style={{
                    position: "absolute",
                    width: 16,
                    height: 16,
                    background: "white",
                    borderRadius: "50%",
                    top: 3,
                    left: pref.defaultOn ? 21 : 3,
                    transition: "left 0.2s",
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </motion.div>
  );
}
