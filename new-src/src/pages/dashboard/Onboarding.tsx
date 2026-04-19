import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { motion } from "motion/react";
import {
  Bot,
  MessageSquare,
  Mail,
  Shield,
  Zap,
  ArrowRight,
  ExternalLink,
  Monitor,
  Loader2,
  Check,
  AlertCircle,
  Globe,
  Puzzle,
  Copy,
  CheckCheck,
} from "lucide-react";

type Platform = "airbnb" | "vrbo" | "booking";

const PLATFORMS: { id: Platform; label: string; color: string }[] = [
  { id: "airbnb", label: "Airbnb", color: "#FF5A5F" },
  { id: "vrbo", label: "VRBO", color: "#3B5998" },
  { id: "booking", label: "Booking.com", color: "#003580" },
];

export default function Onboarding() {
  const [step, setStep] = useState<"activate" | "connect" | "ready">("activate");
  const [platform, setPlatform] = useState<Platform>("airbnb");
  const [connectMethod, setConnectMethod] = useState<"browser" | "script">("browser");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [vncUrl, setVncUrl] = useState<string | null>(null);
  const [launching, setLaunching] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenCopied, setTokenCopied] = useState(false);
  const [scriptDone, setScriptDone] = useState(false);
  const navigate = useNavigate();

  const syncToken = useQuery(api.onboarding.getSyncToken);
  const createLiveSession = useAction(api.onboarding.createLiveSession);
  const finishLiveSession = useAction(api.onboarding.finishLiveSession);
  const completeOnboarding = useMutation(api.tenants.completeOnboarding);

  const handleCopyToken = () => {
    if (syncToken) {
      navigator.clipboard.writeText(syncToken);
      setTokenCopied(true);
      setTimeout(() => setTokenCopied(false), 2000);
    }
  };

  const handleLaunchBrowser = async () => {
    setLaunching(true);
    setError(null);
    try {
      const result = await createLiveSession({ platform });
      setSessionId(result.sessionId);
      setVncUrl(result.vncUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to launch browser");
    } finally {
      setLaunching(false);
    }
  };

  const handleFinishSession = async () => {
    if (!sessionId) return;
    setFinishing(true);
    setError(null);
    try {
      await finishLiveSession({ sessionId, platform });
      await completeOnboarding();
      setStep("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to capture session");
    } finally {
      setFinishing(false);
    }
  };

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", paddingTop: 20 }}>
      {/* ─── Step 1: Meet Alfred ─── */}
      {step === "activate" && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <div
            className="dash-card dash-card-glow"
            style={{
              textAlign: "center",
              padding: "40px 32px",
              background: "linear-gradient(135deg, var(--dash-surface), rgba(198, 125, 59, 0.06))",
              marginBottom: 24,
            }}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
              style={{
                width: 80,
                height: 80,
                borderRadius: 20,
                background: "linear-gradient(135deg, var(--dash-accent), #e8a665)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px",
                boxShadow: "0 8px 32px rgba(198, 125, 59, 0.3)",
              }}
            >
              <Bot size={40} color="white" />
            </motion.div>

            <h2 style={{ fontSize: 26, fontWeight: 700, color: "var(--dash-text)", marginBottom: 8, letterSpacing: "-0.02em" }}>
              Meet Alfred
            </h2>
            <p style={{ color: "var(--dash-text-secondary)", fontSize: 15, lineHeight: 1.7, maxWidth: 420, margin: "0 auto" }}>
              Your AI property manager. Alfred monitors your Airbnb, replies to guests in your voice, and sends you a daily briefing every morning.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 28 }}>
            {[
              { icon: MessageSquare, label: "Replies to guests", desc: "In your tone and style", color: "var(--dash-accent)" },
              { icon: Shield, label: "Shadow mode", desc: "You approve every draft first", color: "var(--dash-success)" },
              { icon: Mail, label: "Learns from Gmail", desc: "WiFi, codes, check-in details", color: "var(--dash-info)" },
              { icon: Zap, label: "Daily briefings", desc: "Every morning at 8am", color: "var(--dash-warning)" },
            ].map(({ icon: Icon, label, desc, color }, i) => (
              <motion.div
                key={label}
                className="dash-card"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.08, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                style={{ padding: 16 }}
              >
                <Icon size={18} style={{ color, marginBottom: 8 }} />
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--dash-text)", marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 12, color: "var(--dash-text-muted)" }}>{desc}</div>
              </motion.div>
            ))}
          </div>

          <motion.button
            className="dash-btn dash-btn-primary"
            style={{ width: "100%", justifyContent: "center", padding: "14px 24px", fontSize: 15 }}
            whileHover={{ scale: 1.02, boxShadow: "0 0 24px rgba(198, 125, 59, 0.3)" }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setStep("connect")}
          >
            Activate Alfred <ArrowRight size={16} />
          </motion.button>

          <p style={{ textAlign: "center", fontSize: 12, color: "var(--dash-text-muted)", marginTop: 12 }}>
            Takes about 2 minutes. You can skip any step and do it later.
          </p>
        </motion.div>
      )}

      {/* ─── Step 2: Connect Platform ─── */}
      {step === "connect" && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--dash-text)", marginBottom: 6, letterSpacing: "-0.02em" }}>
            Connect Your Platform
          </h2>
          <p style={{ color: "var(--dash-text-muted)", fontSize: 13.5, marginBottom: 20, lineHeight: 1.6 }}>
            Alfred needs access to your reservations. Choose how to connect below.
          </p>

          {/* Platform selector — only show before browser launches */}
          {!vncUrl && (
            <div style={{ marginBottom: 16 }}>
              <label className="dash-label" style={{ marginBottom: 8, display: "block" }}>Platform</label>
              <div style={{ display: "flex", gap: 8 }}>
                {PLATFORMS.map((p) => (
                  <button
                    key={p.id}
                    className={`dash-btn ${platform === p.id ? "dash-btn-primary" : "dash-btn-secondary"}`}
                    style={{
                      flex: 1,
                      justifyContent: "center",
                      borderColor: platform === p.id ? p.color : undefined,
                      background: platform === p.id ? p.color : undefined,
                      fontSize: 13,
                    }}
                    onClick={() => {
                      setPlatform(p.id);
                      // Auto-recommend script for VRBO
                      setConnectMethod(p.id === "vrbo" ? "script" : "browser");
                      setScriptDone(false);
                    }}
                  >
                    <Globe size={13} /> {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Method tabs — only show when not in active browser session */}
          {!vncUrl && (
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              <button
                onClick={() => setConnectMethod("script")}
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: `1.5px solid ${connectMethod === "script" ? "var(--dash-accent)" : "var(--dash-border)"}`,
                  background: connectMethod === "script" ? "rgba(198,125,59,0.08)" : "var(--dash-surface)",
                  color: connectMethod === "script" ? "var(--dash-accent)" : "var(--dash-text-secondary)",
                  cursor: "pointer",
                  fontSize: 12.5,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  transition: "all 0.15s",
                }}
              >
                <Puzzle size={13} />
                Browser Extension
                {platform === "vrbo" && (
                  <span style={{
                    fontSize: 10,
                    background: "var(--dash-accent)",
                    color: "white",
                    borderRadius: 4,
                    padding: "1px 5px",
                    fontWeight: 700,
                    marginLeft: 2,
                  }}>
                    Recommended
                  </span>
                )}
              </button>
              <button
                onClick={() => setConnectMethod("browser")}
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: `1.5px solid ${connectMethod === "browser" ? "var(--dash-accent)" : "var(--dash-border)"}`,
                  background: connectMethod === "browser" ? "rgba(198,125,59,0.08)" : "var(--dash-surface)",
                  color: connectMethod === "browser" ? "var(--dash-accent)" : "var(--dash-text-secondary)",
                  cursor: "pointer",
                  fontSize: 12.5,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  transition: "all 0.15s",
                }}
              >
                <Monitor size={13} />
                In-App Browser
              </button>
            </div>
          )}

          {/* Error display */}
          {error && (
            <div style={{
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: 8,
              padding: "10px 14px",
              marginBottom: 16,
              fontSize: 13,
              color: "#ef4444",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}>
              <AlertCircle size={14} /> {error}
            </div>
          )}

          {/* ── Script / Extension method ── */}
          {connectMethod === "script" && !vncUrl && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              {!scriptDone ? (
                <div className="dash-card" style={{ padding: 20, marginBottom: 16 }}>
                  <p style={{ fontSize: 13, color: "var(--dash-text-secondary)", marginBottom: 18, lineHeight: 1.6 }}>
                    Install a tiny browser script that syncs your reservations automatically whenever you visit {platform === "vrbo" ? "VRBO" : platform === "airbnb" ? "Airbnb" : "Booking.com"}. No credentials leave your browser.
                  </p>

                  {/* Step 1 */}
                  <div style={{ display: "flex", gap: 12, marginBottom: 14, alignItems: "flex-start" }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: "50%",
                      background: "var(--dash-accent)", color: "white",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, fontWeight: 700, flexShrink: 0, marginTop: 1,
                    }}>1</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--dash-text)", marginBottom: 4 }}>
                        Install Tampermonkey
                      </div>
                      <div style={{ fontSize: 12, color: "var(--dash-text-muted)", marginBottom: 6 }}>
                        Free browser extension — 10M+ users, trusted for 15 years
                      </div>
                      <a
                        href="https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="dash-btn dash-btn-secondary"
                        style={{ fontSize: 12, display: "inline-flex", padding: "6px 12px" }}
                      >
                        <ExternalLink size={11} /> Install Tampermonkey
                      </a>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div style={{ display: "flex", gap: 12, marginBottom: 14, alignItems: "flex-start" }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: "50%",
                      background: "var(--dash-accent)", color: "white",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, fontWeight: 700, flexShrink: 0, marginTop: 1,
                    }}>2</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--dash-text)", marginBottom: 4 }}>
                        Copy your sync token
                      </div>
                      <div style={{ fontSize: 12, color: "var(--dash-text-muted)", marginBottom: 6 }}>
                        The script needs this to know which account to sync to
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <div style={{
                          flex: 1,
                          background: "var(--dash-bg)",
                          border: "1px solid var(--dash-border)",
                          borderRadius: 6,
                          padding: "7px 10px",
                          fontSize: 11,
                          fontFamily: "monospace",
                          color: "var(--dash-text-secondary)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}>
                          {syncToken ?? "Loading..."}
                        </div>
                        <button
                          className="dash-btn dash-btn-secondary"
                          style={{ fontSize: 12, padding: "7px 12px", flexShrink: 0 }}
                          onClick={handleCopyToken}
                          disabled={!syncToken}
                        >
                          {tokenCopied ? <><CheckCheck size={11} /> Copied!</> : <><Copy size={11} /> Copy</>}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div style={{ display: "flex", gap: 12, marginBottom: 14, alignItems: "flex-start" }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: "50%",
                      background: "var(--dash-accent)", color: "white",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, fontWeight: 700, flexShrink: 0, marginTop: 1,
                    }}>3</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--dash-text)", marginBottom: 4 }}>
                        Install the Host4Me script
                      </div>
                      <div style={{ fontSize: 12, color: "var(--dash-text-muted)", marginBottom: 6 }}>
                        Tampermonkey will ask you to confirm — click Install
                      </div>
                      <a
                        href="https://host4me.vercel.app/scripts/host4me.user.js"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="dash-btn dash-btn-primary"
                        style={{ fontSize: 12, display: "inline-flex", padding: "6px 12px" }}
                      >
                        <ExternalLink size={11} /> Install Host4Me Script
                      </a>
                    </div>
                  </div>

                  {/* Step 4 */}
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: "50%",
                      background: "var(--dash-accent)", color: "white",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, fontWeight: 700, flexShrink: 0, marginTop: 1,
                    }}>4</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--dash-text)", marginBottom: 4 }}>
                        Visit {platform === "vrbo" ? "vrbo.com" : platform === "airbnb" ? "airbnb.com" : "booking.com"} and log in
                      </div>
                      <div style={{ fontSize: 12, color: "var(--dash-text-muted)" }}>
                        The script will auto-sync and ask for your token the first time. Alfred will start seeing your reservations within minutes.
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="dash-card"
                  style={{ padding: 20, marginBottom: 16, textAlign: "center", background: "var(--dash-success-subtle)" }}
                >
                  <Check size={28} color="var(--dash-success)" style={{ margin: "0 auto 8px" }} />
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--dash-text)" }}>Script installed!</div>
                  <div style={{ fontSize: 12, color: "var(--dash-text-muted)", marginTop: 4 }}>
                    Alfred will sync your reservations next time you visit {platform === "vrbo" ? "VRBO" : "the platform"}.
                  </div>
                </motion.div>
              )}

              <div style={{ display: "flex", gap: 10 }}>
                <button className="dash-btn dash-btn-secondary" onClick={() => setStep("activate")}>
                  Back
                </button>
                {!scriptDone ? (
                  <motion.button
                    className="dash-btn dash-btn-primary"
                    style={{ flex: 1, justifyContent: "center" }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setScriptDone(true)}
                  >
                    <Check size={14} /> I've Installed the Script
                  </motion.button>
                ) : (
                  <motion.button
                    className="dash-btn dash-btn-primary"
                    style={{ flex: 1, justifyContent: "center" }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={async () => {
                      await completeOnboarding();
                      setStep("ready");
                    }}
                  >
                    Continue to Dashboard <ArrowRight size={14} />
                  </motion.button>
                )}
                <button
                  className="dash-btn dash-btn-ghost"
                  style={{ fontSize: 12 }}
                  onClick={async () => {
                    await completeOnboarding();
                    setStep("ready");
                  }}
                >
                  Skip
                </button>
              </div>
            </motion.div>
          )}

          {/* ── In-app browser method ── */}
          {connectMethod === "browser" && (
            <>
              {/* Trust bar */}
              <div style={{ display: "flex", gap: 16, marginBottom: 16, fontSize: 12, color: "var(--dash-text-muted)" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <Shield size={11} color="var(--dash-success)" /> No passwords stored
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <Monitor size={11} color="var(--dash-success)" /> Secure browser session
                </span>
              </div>

              {vncUrl ? (
                <>
                  <div
                    style={{
                      border: "1px solid var(--dash-border)",
                      borderRadius: 10,
                      overflow: "hidden",
                      marginBottom: 16,
                      background: "#1a1a1a",
                    }}
                  >
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 12px",
                      background: "var(--dash-surface)",
                      borderBottom: "1px solid var(--dash-border)",
                      fontSize: 12,
                      color: "var(--dash-text-muted)",
                    }}>
                      <div style={{ display: "flex", gap: 4 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#ff5f57" }} />
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#febc2e" }} />
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#28c840" }} />
                      </div>
                      <div style={{
                        flex: 1,
                        background: "var(--dash-bg)",
                        borderRadius: 4,
                        padding: "4px 10px",
                        fontSize: 11,
                        color: "var(--dash-text-muted)",
                      }}>
                        {platform === "airbnb" ? "airbnb.com/login" : platform === "vrbo" ? "vrbo.com" : "booking.com/sign-in"}
                      </div>
                      <Shield size={11} color="var(--dash-success)" />
                    </div>
                    <iframe
                      src={vncUrl}
                      style={{ width: "100%", height: 440, border: "none", display: "block" }}
                      title={`${platform} login`}
                      sandbox="allow-scripts allow-same-origin allow-forms"
                    />
                  </div>

                  <p style={{ fontSize: 12, color: "var(--dash-text-muted)", marginBottom: 16, lineHeight: 1.5 }}>
                    Log in as you normally would. When you see your dashboard or inbox, click the button below.
                  </p>

                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      className="dash-btn dash-btn-secondary"
                      onClick={() => { setVncUrl(null); setSessionId(null); }}
                    >
                      Cancel
                    </button>
                    <motion.button
                      className="dash-btn dash-btn-primary"
                      disabled={finishing}
                      style={{ flex: 1, justifyContent: "center", opacity: finishing ? 0.5 : 1 }}
                      whileHover={!finishing ? { scale: 1.02 } : {}}
                      whileTap={!finishing ? { scale: 0.98 } : {}}
                      onClick={handleFinishSession}
                    >
                      {finishing
                        ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Saving session...</>
                        : <><Check size={14} /> I'm Logged In</>
                      }
                    </motion.button>
                  </div>
                </>
              ) : (
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="dash-btn dash-btn-secondary" onClick={() => setStep("activate")}>
                    Back
                  </button>
                  <motion.button
                    className="dash-btn dash-btn-primary"
                    disabled={launching}
                    style={{ flex: 1, justifyContent: "center", opacity: launching ? 0.5 : 1 }}
                    whileHover={!launching ? { scale: 1.02 } : {}}
                    whileTap={!launching ? { scale: 0.98 } : {}}
                    onClick={handleLaunchBrowser}
                  >
                    {launching
                      ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Launching browser...</>
                      : <><Monitor size={14} /> Open {PLATFORMS.find((p) => p.id === platform)?.label} Login</>
                    }
                  </motion.button>
                  <button
                    className="dash-btn dash-btn-ghost"
                    style={{ fontSize: 12 }}
                    onClick={async () => { await completeOnboarding(); setStep("ready"); }}
                  >
                    Skip
                  </button>
                </div>
              )}
            </>
          )}
        </motion.div>
      )}

      {/* ─── Step 3: Alfred is Ready ─── */}
      {step === "ready" && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          style={{ textAlign: "center" }}
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              background: "var(--dash-success-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 24px",
            }}
          >
            <Check size={32} color="var(--dash-success)" />
          </motion.div>

          <h2 style={{ fontSize: 26, fontWeight: 700, color: "var(--dash-text)", marginBottom: 8, letterSpacing: "-0.02em" }}>
            Alfred is Ready
          </h2>
          <p style={{ color: "var(--dash-text-secondary)", fontSize: 14.5, lineHeight: 1.7, marginBottom: 8 }}>
            Open Telegram to start chatting with Alfred.
          </p>
          <p style={{ color: "var(--dash-text-muted)", fontSize: 13, lineHeight: 1.6, maxWidth: 400, margin: "0 auto 32px" }}>
            Alfred will ask you about your properties, learn your communication style, and start monitoring your inbox. Everything happens in the chat — no forms to fill out.
          </p>

          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <motion.a
              href="https://t.me/Host4Me_bot"
              target="_blank"
              rel="noopener noreferrer"
              className="dash-btn dash-btn-primary"
              style={{ textDecoration: "none", padding: "14px 28px", fontSize: 15 }}
              whileHover={{ scale: 1.03, boxShadow: "0 0 24px rgba(198, 125, 59, 0.3)" }}
              whileTap={{ scale: 0.97 }}
            >
              <MessageSquare size={16} /> Open Telegram <ExternalLink size={12} />
            </motion.a>
          </div>

          <button
            className="dash-btn dash-btn-ghost"
            style={{ marginTop: 16, fontSize: 13 }}
            onClick={() => navigate("/dashboard")}
          >
            Go to Dashboard
          </button>
        </motion.div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
