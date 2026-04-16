import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAction, useMutation } from "convex/react";
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
  Lock,
  Eye,
  EyeOff,
  Loader2,
  Check,
} from "lucide-react";

export default function Onboarding() {
  const [airbnbEmail, setAirbnbEmail] = useState("");
  const [airbnbPassword, setAirbnbPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"activate" | "connect" | "ready">("activate");
  const navigate = useNavigate();

  const connectAirbnb = useAction(api.onboarding.connectAirbnb);
  const completeOnboarding = useMutation(api.tenants.completeOnboarding);

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);
    try {
      await connectAirbnb({ email: airbnbEmail, password: airbnbPassword });
      await completeOnboarding();
      setStep("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setConnecting(false);
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

      {/* ─── Step 2: Connect Airbnb ─── */}
      {step === "connect" && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--dash-text)", marginBottom: 6, letterSpacing: "-0.02em" }}>
            Connect Airbnb
          </h2>
          <p style={{ color: "var(--dash-text-muted)", fontSize: 13.5, marginBottom: 24, lineHeight: 1.6 }}>
            Alfred needs your Airbnb access to monitor guest messages. Your credentials are encrypted and only used to maintain a browser session.
          </p>

          <div style={{ display: "flex", gap: 16, marginBottom: 24, fontSize: 12, color: "var(--dash-text-muted)" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <Lock size={11} color="var(--dash-success)" /> AES-256 encrypted
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <Shield size={11} color="var(--dash-success)" /> Shadow mode on
            </span>
          </div>

          {error && (
            <div style={{
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: 8,
              padding: "10px 14px",
              marginBottom: 16,
              fontSize: 13,
              color: "#ef4444",
            }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 24 }}>
            <div>
              <label className="dash-label">Email</label>
              <input
                type="email"
                className="dash-input"
                value={airbnbEmail}
                onChange={(e) => setAirbnbEmail(e.target.value)}
                placeholder="your@email.com"
                autoFocus
              />
            </div>
            <div>
              <label className="dash-label">Password</label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  className="dash-input"
                  style={{ paddingRight: 44 }}
                  value={airbnbPassword}
                  onChange={(e) => setAirbnbPassword(e.target.value)}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="dash-btn dash-btn-ghost"
                  style={{ position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)", padding: 6 }}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button className="dash-btn dash-btn-secondary" onClick={() => setStep("activate")}>
              Back
            </button>
            <button
              className="dash-btn dash-btn-primary"
              disabled={!airbnbEmail || !airbnbPassword || connecting}
              style={{ opacity: !airbnbEmail || !airbnbPassword || connecting ? 0.5 : 1, flex: 1, justifyContent: "center" }}
              onClick={handleConnect}
            >
              {connecting ? (
                <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Connecting...</>
              ) : (
                <>Connect</>
              )}
            </button>
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
