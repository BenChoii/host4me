import { Component, type ReactNode, useState } from "react";
import { motion } from "motion/react";
import { useAction, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";

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

type SyncDebug = {
  pageText?: string;
  urlsVisited?: Array<{ attempted: string; landed?: string; error?: string }>;
  finalUrl?: string;
};

type PlatformSyncState = {
  status: "idle" | "syncing" | "success" | "error";
  message?: string;
  reservations?: number;
  listings?: number;
  debug?: SyncDebug;
  showDebug?: boolean;
};

// ── Sync token inner component — can throw if Convex fn not deployed yet ──
function SyncTokenInner() {
  const syncToken = useQuery(api.onboarding.getSyncToken);
  const [tokenCopied, setTokenCopied] = useState(false);

  const handleCopyToken = () => {
    if (syncToken) {
      navigator.clipboard.writeText(syncToken);
      setTokenCopied(true);
      setTimeout(() => setTokenCopied(false), 2000);
    }
  };

  if (syncToken === undefined) {
    return <div style={{ fontSize: 13, color: "var(--dash-text-muted)" }}>Loading token…</div>;
  }

  if (!syncToken) {
    return <div style={{ fontSize: 13, color: "var(--dash-text-muted)" }}>No token available. Make sure you’re logged in.</div>;
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <code style={{
        flex: 1,
        fontSize: 13,
        fontFamily: "monospace",
        background: "var(--dash-bg)",
        border: "1px solid var(--dash-border)",
        borderRadius: 8,
        padding: "10px 14px",
        color: "var(--dash-text)",
        wordBreak: "break-all",
        userSelect: "all",
      }}>
        {syncToken}
      </code>
      <button
        onClick={handleCopyToken}
        style={{
          padding: "8px 16px",
          borderRadius: 8,
          border: "none",
          background: tokenCopied ? "#10b98120" : "var(--dash-text)",
          color: tokenCopied ? "#059669" : "white",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          flexShrink: 0,
          transition: "all 0.2s",
          minWidth: 80,
        }}
      >
        {tokenCopied ? "✓ Copied" : "Copy"}
      </button>
    </div>
  );
}

// ── Error boundary scoped only to the token section ──
class SyncTokenBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: false };
  }
  static getDerivedStateFromError() { return { error: true }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ fontSize: 13, color: "var(--dash-text-muted)", fontStyle: "italic" }}>
          Token unavailable — run <code style={{ fontSize: 12 }}>npx convex deploy</code> to enable this feature.
        </div>
      );
    }
    return this.props.children;
  }
}

export default function Settings() {
  const syncReservations = useAction(api.reservations.syncReservations);

  const [syncState, setSyncState] = useState<Record<string, PlatformSyncState>>({});

  const handleSync = async (platform: string) => {
    setSyncState(prev => ({ ...prev, [platform]: { status: "syncing" } }));
    try {
      const result = await syncReservations({ platform });
      const noData = result.reservations === 0 && result.listings === 0;
      setSyncState(prev => ({
        ...prev,
        [platform]: {
          status: noData ? "error" : "success",
          message: noData
            ? "No data found — see diagnostic below"
            : `Synced ${result.reservations} reservations and ${result.listings} listings`,
          reservations: result.reservations,
          listings: result.listings,
          debug: result.debug as SyncDebug,
          showDebug: noData,
        },
      }));
    } catch (err: any) {
      setSyncState(prev => ({
        ...prev,
        [platform]: {
          status: "error",
          message: err.message || "Sync failed",
          showDebug: true,
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
        Manage platform connections and sync Alfred’s data
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
              <div key={platform.id} style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                <div
                  className="dash-card"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    padding: "16px 20px",
                    borderBottomLeftRadius: state.showDebug ? 0 : undefined,
                    borderBottomRightRadius: state.showDebug ? 0 : undefined,
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
                         state.status === "error" ? "⚠ Issue" :
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

                {/* Diagnostic panel */}
                {state.showDebug && (
                  <div style={{
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    borderTop: "none",
                    borderBottomLeftRadius: 12,
                    borderBottomRightRadius: 12,
                    padding: "14px 20px",
                    fontSize: 12,
                    color: "#7f1d1d",
                  }}>
                    <div style={{ fontWeight: 700, marginBottom: 8, color: "#dc2626" }}>
                      🔍 Alfred Diagnostic Report
                    </div>
                    {state.debug?.finalUrl && (
                      <div style={{ marginBottom: 8 }}>
                        <span style={{ fontWeight: 600 }}>Last page: </span>
                        <code style={{ background: "#fee2e2", padding: "1px 4px", borderRadius: 3 }}>
                          {state.debug.finalUrl}
                        </code>
                        {(state.debug.finalUrl.includes("login") || state.debug.finalUrl.includes("auth")) && (
                          <span style={{ marginLeft: 8, fontWeight: 700, color: "#dc2626" }}>
                            ← SESSION EXPIRED — please reconnect VRBO
                          </span>
                        )}
                      </div>
                    )}
                    {state.debug?.urlsVisited && state.debug.urlsVisited.length > 0 && (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>Pages tried:</div>
                        {state.debug.urlsVisited.map((v: any, i: number) => (
                          <div key={i} style={{ marginLeft: 8, marginBottom: 2 }}>
                            {v.error
                              ? <span>❌ {v.attempted} — {v.error}</span>
                              : <span>
                                  {v.landed?.includes("login") || v.landed?.includes("auth") ? "🔒" : "✓"}{" "}
                                  {v.attempted}
                                  {v.landed && v.landed !== v.attempted && (
                                    <span style={{ color: "#991b1b" }}> → {v.landed}</span>
                                  )}
                                </span>
                            }
                          </div>
                        ))}
                      </div>
                    )}
                    {state.debug?.pageText && (
                      <div>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>Page content preview:</div>
                        <pre style={{
                          background: "#fee2e2",
                          padding: "8px",
                          borderRadius: 6,
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-all",
                          maxHeight: 120,
                          overflow: "auto",
                          fontSize: 11,
                          margin: 0,
                        }}>
                          {state.debug.pageText.slice(0, 600)}
                        </pre>
                      </div>
                    )}
                    {!state.debug?.finalUrl && !state.debug?.pageText && (
                      <div>No additional details available. Check that your VRBO session is still active.</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Browser Extension Sync Token */}
      <div style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--dash-text)", marginBottom: 4 }}>
          Browser Extension Sync Token
        </h3>
        <p style={{ fontSize: 13, color: "var(--dash-text-muted)", marginBottom: 16 }}>
          Use this token when setting up the Tampermonkey script to link your browser to Alfred.
        </p>
        <div className="dash-card" style={{ padding: "16px 20px" }}>
          <SyncTokenBoundary>
            <SyncTokenInner />
          </SyncTokenBoundary>
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
