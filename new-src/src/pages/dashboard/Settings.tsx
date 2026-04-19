import { useState, Component } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useAction, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";

// Catches Convex "function not found" errors so a missing query doesn't blank the page
class QueryErrorBoundary extends Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

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

type PlatformSyncState = {
  status: "idle" | "syncing" | "success" | "error";
  message?: string;
  showDebug?: boolean;
};

type ReconnectState = {
  platform: string;
  step: "idle" | "launching" | "browser" | "finishing" | "done" | "error";
  sessionId?: string;
  vncUrl?: string;
  error?: string;
};

// Fetches the (potentially-missing) query and passes it down
function SettingsWithSession() {
  const sessionStatuses = useQuery(api.onboarding.getBrowserSessionStatus);
  return <SettingsCore sessionStatuses={sessionStatuses ?? undefined} />;
}

// Default export: wraps with ErrorBoundary so a missing Convex function doesn't crash the page
export default function Settings() {
  return (
    <QueryErrorBoundary fallback={<SettingsCore sessionStatuses={undefined} />}>
      <SettingsWithSession />
    </QueryErrorBoundary>
  );
}

function SettingsCore({ sessionStatuses }: { sessionStatuses?: Array<{ platform: string; hasSession: boolean; isValid: boolean; finalUrl?: string }> }) {
  // Use the new AI agent sync (Browser Use + Gemma) instead of old proxy method
  const agentBrowseSyncForUser = useAction(api.reservations.agentBrowseSyncForUser);
  const syncToken = useQuery(api.onboarding.getSyncToken);
  const createLiveSession = useAction(api.onboarding.createLiveSession);
  const finishLiveSession = useAction(api.onboarding.finishLiveSession);

  const [syncState, setSyncState] = useState<Record<string, PlatformSyncState>>({});
  const [tokenCopied, setTokenCopied] = useState(false);
  const [reconnect, setReconnect] = useState<ReconnectState | null>(null);

  const getSessionStatus = (platformId: string) =>
    sessionStatuses?.find((s) => s.platform === platformId);

  const handleCopyToken = () => {
    if (syncToken) {
      navigator.clipboard.writeText(syncToken);
      setTokenCopied(true);
      setTimeout(() => setTokenCopied(false), 2000);
    }
  };

  const handleSync = async (platform: string) => {
    setSyncState(prev => ({ ...prev, [platform]: { status: "syncing" } }));
    try {
      const result = await agentBrowseSyncForUser({ platform });
      if (result.status === "auth_required") {
        setSyncState(prev => ({
          ...prev,
          [platform]: {
            status: "error",
            message: "Session expired — click Re-connect to log in again",
            showDebug: true,
          },
        }));
      } else if (result.status === "no_session") {
        setSyncState(prev => ({
          ...prev,
          [platform]: {
            status: "error",
            message: "No session found — click Connect to log in first",
            showDebug: true,
          },
        }));
      } else {
        const count = (result.reservations ?? 0) + (result.inbox ?? 0) + (result.properties ?? 0);
        setSyncState(prev => ({
          ...prev,
          [platform]: {
            status: count > 0 ? "success" : "error",
            message: count > 0
              ? `Synced ${result.reservations ?? 0} reservations, ${result.inbox ?? 0} messages, ${result.properties ?? 0} listings`
              : "No data returned — session may need a refresh",
            showDebug: count === 0,
          },
        }));
      }
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

  const handleOpenReconnect = (platformId: string) => {
    setReconnect({ platform: platformId, step: "idle" });
  };

  const handleLaunchBrowser = async () => {
    if (!reconnect) return;
    setReconnect(prev => prev ? { ...prev, step: "launching" } : null);
    try {
      const result = await createLiveSession({ platform: reconnect.platform as any });
      setReconnect(prev => prev ? {
        ...prev,
        step: "browser",
        sessionId: result.sessionId,
        vncUrl: result.vncUrl,
      } : null);
    } catch (err: any) {
      setReconnect(prev => prev ? {
        ...prev,
        step: "error",
        error: err.message || "Failed to launch browser",
      } : null);
    }
  };

  const handleFinishSession = async () => {
    if (!reconnect?.sessionId) return;
    setReconnect(prev => prev ? { ...prev, step: "finishing" } : null);
    try {
      await finishLiveSession({ sessionId: reconnect.sessionId!, platform: reconnect.platform });
      setReconnect(prev => prev ? { ...prev, step: "done" } : null);
      setSyncState(prev => ({ ...prev, [reconnect.platform]: { status: "idle" } }));
    } catch (err: any) {
      setReconnect(prev => prev ? {
        ...prev,
        step: "error",
        error: err.message || "Failed to capture session",
      } : null);
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
            const sessionInfo = getSessionStatus(platform.id);
            const hasValidSession = sessionInfo?.hasSession && sessionInfo?.isValid;
            const sessionExpired = sessionInfo?.hasSession && !sessionInfo?.isValid;

            return (
              <div key={platform.id} style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                <div
                  className="dash-card"
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
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
                    marginTop: 2,
                  }}>
                    {platform.logo}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 15, fontWeight: 600, color: "var(--dash-text)" }}>
                        {platform.name}
                      </span>
                      {/* Session status badge */}
                      <span style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "2px 8px",
                        borderRadius: 20,
                        background: state.status === "success"
                          ? "#10b98120"
                          : state.status === "error"
                          ? "#ef444420"
                          : state.status === "syncing"
                          ? "#6b728020"
                          : hasValidSession
                          ? "#10b98120"
                          : sessionExpired
                          ? "#f59e0b20"
                          : "#6b728020",
                        color: state.status === "success"
                          ? "#059669"
                          : state.status === "error"
                          ? "#dc2626"
                          : state.status === "syncing"
                          ? "var(--dash-text-muted)"
                          : hasValidSession
                          ? "#059669"
                          : sessionExpired
                          ? "#d97706"
                          : "var(--dash-text-muted)",
                      }}>
                        {state.status === "success" ? "✓ Synced" :
                         state.status === "error" ? "⚠ Issue" :
                         state.status === "syncing" ? "Syncing..." :
                         hasValidSession ? "✓ Connected" :
                         sessionExpired ? "⚠ Session expired" :
                         "Not connected"}
                      </span>
                    </div>
                    <p style={{ fontSize: 13, color: "var(--dash-text-muted)", margin: 0 }}>
                      {state.status === "success"
                        ? state.message
                        : state.status === "error"
                        ? state.message
                        : sessionExpired
                        ? "Your session has expired. Re-connect to sync fresh data."
                        : platform.description}
                    </p>
                    {/* Final URL hint */}
                    {sessionInfo?.finalUrl && (
                      <p style={{ fontSize: 11, color: "var(--dash-text-muted)", margin: "4px 0 0", fontFamily: "monospace" }}>
                        Last seen: {sessionInfo.finalUrl.slice(0, 60)}{sessionInfo.finalUrl.length > 60 ? "…" : ""}
                      </p>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, flexShrink: 0, alignItems: "flex-end" }}>
                    {/* Sync button — only when connected */}
                    {hasValidSession && (
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
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          transition: "all 0.2s",
                          whiteSpace: "nowrap",
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
                    )}

                    {/* Re-connect button */}
                    <button
                      onClick={() => handleOpenReconnect(platform.id)}
                      style={{
                        padding: "8px 16px",
                        borderRadius: 8,
                        border: "1px solid var(--dash-border)",
                        background: "transparent",
                        color: sessionExpired ? "#d97706" : "var(--dash-text-muted)",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "all 0.2s",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {hasValidSession ? "🔄 Re-connect" : sessionExpired ? "🔑 Re-connect" : "🔑 Connect"}
                    </button>
                  </div>
                </div>

                {/* Error / diagnostic panel */}
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
                    <div style={{ fontWeight: 700, marginBottom: 4, color: "#dc2626" }}>
                      ⚠ {state.message}
                    </div>
                    <div style={{ color: "#991b1b" }}>
                      Use the Re-connect button above to refresh your session, then try syncing again.
                    </div>
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
          {syncToken === undefined ? (
            <div style={{ fontSize: 13, color: "var(--dash-text-muted)" }}>Loading token…</div>
          ) : syncToken === null ? (
            <div style={{ fontSize: 13, color: "var(--dash-text-muted)" }}>No token available. Make sure you're logged in.</div>
          ) : (
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
          )}
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

      {/* ── Reconnect Modal ── */}
      <AnimatePresence>
        {reconnect && (
          <motion.div
            key="reconnect-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
              padding: 20,
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget && reconnect.step !== "finishing") {
                setReconnect(null);
              }
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              style={{
                background: "var(--dash-surface)",
                borderRadius: 16,
                padding: reconnect.step === "browser" ? 0 : 32,
                width: reconnect.step === "browser" ? "min(1000px, 95vw)" : "min(480px, 95vw)",
                boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
                overflow: "hidden",
              }}
            >
              {/* Header */}
              {reconnect.step !== "browser" && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--dash-text)", margin: 0 }}>
                      {reconnect.step === "done"
                        ? "✓ Session Captured"
                        : reconnect.step === "error"
                        ? "⚠ Connection Failed"
                        : `Connect ${PLATFORMS.find(p => p.id === reconnect.platform)?.name}`}
                    </h3>
                    <button
                      onClick={() => setReconnect(null)}
                      style={{
                        background: "none",
                        border: "none",
                        fontSize: 20,
                        cursor: "pointer",
                        color: "var(--dash-text-muted)",
                        lineHeight: 1,
                        padding: "0 4px",
                      }}
                    >×</button>
                  </div>
                </div>
              )}

              {/* Step: idle */}
              {reconnect.step === "idle" && (
                <div>
                  <p style={{ fontSize: 14, color: "var(--dash-text-muted)", marginBottom: 24 }}>
                    Alfred will open a live browser window. Log into{" "}
                    <strong>{PLATFORMS.find(p => p.id === reconnect.platform)?.name}</strong> normally,
                    then click "Capture Session" to save your login.
                  </p>
                  <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                    <button
                      onClick={() => setReconnect(null)}
                      style={{
                        padding: "10px 20px",
                        borderRadius: 8,
                        border: "1px solid var(--dash-border)",
                        background: "transparent",
                        color: "var(--dash-text-muted)",
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >Cancel</button>
                    <button
                      onClick={handleLaunchBrowser}
                      style={{
                        padding: "10px 24px",
                        borderRadius: 8,
                        border: "none",
                        background: "var(--dash-text)",
                        color: "white",
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >🖥 Launch Browser</button>
                  </div>
                </div>
              )}

              {/* Step: launching */}
              {reconnect.step === "launching" && (
                <div style={{ textAlign: "center", padding: "16px 0" }}>
                  <div style={{
                    width: 40,
                    height: 40,
                    border: "3px solid var(--dash-border)",
                    borderTopColor: "var(--dash-text)",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                    margin: "0 auto 16px",
                  }} />
                  <p style={{ color: "var(--dash-text-muted)", fontSize: 14 }}>
                    Starting browser session…
                  </p>
                </div>
              )}

              {/* Step: browser — show noVNC iframe */}
              {reconnect.step === "browser" && reconnect.vncUrl && (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{
                    padding: "12px 20px",
                    borderBottom: "1px solid var(--dash-border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "var(--dash-surface)",
                  }}>
                    <div>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "var(--dash-text)" }}>
                        Log into {PLATFORMS.find(p => p.id === reconnect.platform)?.name}
                      </span>
                      <span style={{ fontSize: 13, color: "var(--dash-text-muted)", marginLeft: 12 }}>
                        When fully logged in, click "Capture Session" →
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => setReconnect(null)}
                        style={{
                          padding: "8px 16px",
                          borderRadius: 8,
                          border: "1px solid var(--dash-border)",
                          background: "transparent",
                          color: "var(--dash-text-muted)",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >Cancel</button>
                      <button
                        onClick={handleFinishSession}
                        style={{
                          padding: "8px 20px",
                          borderRadius: 8,
                          border: "none",
                          background: "#10b981",
                          color: "white",
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >✓ Capture Session</button>
                    </div>
                  </div>
                  <iframe
                    src={reconnect.vncUrl}
                    style={{
                      width: "100%",
                      height: "65vh",
                      border: "none",
                      display: "block",
                    }}
                    title="Live Browser"
                    allow="clipboard-read; clipboard-write"
                  />
                </div>
              )}

              {/* Step: finishing */}
              {reconnect.step === "finishing" && (
                <div style={{ textAlign: "center", padding: "16px 0" }}>
                  <div style={{
                    width: 40,
                    height: 40,
                    border: "3px solid var(--dash-border)",
                    borderTopColor: "#10b981",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                    margin: "0 auto 16px",
                  }} />
                  <p style={{ color: "var(--dash-text-muted)", fontSize: 14 }}>
                    Capturing session cookies…
                  </p>
                </div>
              )}

              {/* Step: done */}
              {reconnect.step === "done" && (
                <div>
                  <div style={{
                    width: 56,
                    height: 56,
                    borderRadius: "50%",
                    background: "#10b98120",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 28,
                    margin: "0 auto 16px",
                  }}>✓</div>
                  <p style={{ fontSize: 14, color: "var(--dash-text-muted)", textAlign: "center", marginBottom: 24 }}>
                    {PLATFORMS.find(p => p.id === reconnect.platform)?.name} session saved.
                    Alfred will use it to sync your data automatically every hour.
                  </p>
                  <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
                    <button
                      onClick={() => {
                        setReconnect(null);
                        handleSync(reconnect.platform);
                      }}
                      style={{
                        padding: "10px 24px",
                        borderRadius: 8,
                        border: "none",
                        background: "var(--dash-text)",
                        color: "white",
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >↻ Sync Now</button>
                    <button
                      onClick={() => setReconnect(null)}
                      style={{
                        padding: "10px 20px",
                        borderRadius: 8,
                        border: "1px solid var(--dash-border)",
                        background: "transparent",
                        color: "var(--dash-text-muted)",
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >Close</button>
                  </div>
                </div>
              )}

              {/* Step: error */}
              {reconnect.step === "error" && (
                <div>
                  <p style={{ fontSize: 14, color: "#dc2626", marginBottom: 16 }}>
                    {reconnect.error}
                  </p>
                  <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                    <button
                      onClick={() => setReconnect(null)}
                      style={{
                        padding: "10px 20px",
                        borderRadius: 8,
                        border: "1px solid var(--dash-border)",
                        background: "transparent",
                        color: "var(--dash-text-muted)",
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >Close</button>
                    <button
                      onClick={() => setReconnect(prev => prev ? { ...prev, step: "idle" } : null)}
                      style={{
                        padding: "10px 24px",
                        borderRadius: 8,
                        border: "none",
                        background: "var(--dash-text)",
                        color: "white",
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >Try Again</button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </motion.div>
  );
}
