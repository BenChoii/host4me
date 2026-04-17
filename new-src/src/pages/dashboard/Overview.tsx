import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight, Sparkles } from "lucide-react";
import { useEffect, useRef } from "react";

export default function Overview() {
  const navigate = useNavigate();
  const tenant = useQuery(api.tenants.get);
  const getOrCreate = useMutation(api.tenants.getOrCreate);
  const hasTriedCreate = useRef(false);

  // Auto-create tenant record if none exists
  useEffect(() => {
    if (tenant === null && !hasTriedCreate.current) {
      hasTriedCreate.current = true;
      getOrCreate().catch(console.error);
    }
  }, [tenant, getOrCreate]);

  // Check if onboarding is complete
  const isOnboarded = tenant?.onboarded;

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--dash-text)", marginBottom: 24 }}>
          Welcome to Host4Me
        </h2>

        {!isOnboarded && (
          <div
            className="dash-card"
            style={{
              background:
                "linear-gradient(135deg, var(--dash-surface), rgba(198, 125, 59, 0.06))",
              border: "1px solid rgba(198, 125, 59, 0.2)",
              padding: "24px",
              marginBottom: "24px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 8,
                  background: "rgba(242, 125, 38, 0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Sparkles size={20} color="var(--dash-accent)" />
              </div>
              <div style={{ flex: 1 }}>
                <h3
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: "var(--dash-text)",
                    marginBottom: 4,
                  }}
                >
                  Get started with Alfred
                </h3>
                <p style={{ fontSize: 13, color: "var(--dash-text-muted)", marginBottom: 0 }}>
                  Complete the onboarding process to connect your Airbnb and activate
                  your AI property manager.
                </p>
              </div>
              <motion.button
                className="dash-btn dash-btn-primary"
                style={{ whiteSpace: "nowrap" }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate("/dashboard/onboarding")}
              >
                Get Started <ArrowRight size={14} />
              </motion.button>
            </div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div className="dash-card">
            <div style={{ fontSize: 12, color: "var(--dash-text-muted)", marginBottom: 8 }}>
              Properties
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "var(--dash-text)" }}>
              0
            </div>
          </div>
          <div className="dash-card">
            <div style={{ fontSize: 12, color: "var(--dash-text-muted)", marginBottom: 8 }}>
              Messages Today
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "var(--dash-text)" }}>
              0
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
