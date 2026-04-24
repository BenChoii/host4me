import { motion } from "motion/react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";

export default function Properties() {
  const properties = useQuery(api.queries.getProperties);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--dash-text)", marginBottom: 24 }}>
        Properties
      </h2>

      {properties === undefined && (
        <div style={{ color: "var(--dash-text-muted)", fontSize: 14 }}>Loading…</div>
      )}

      {properties !== undefined && properties.length === 0 && (
        <div className="dash-card" style={{ padding: "32px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🏠</div>
          <p style={{ color: "var(--dash-text)", fontWeight: 600, marginBottom: 8 }}>No properties yet</p>
          <p style={{ color: "var(--dash-text-muted)", fontSize: 13, maxWidth: 360, margin: "0 auto" }}>
            Visit your VRBO inbox or reservations page with the Host4Me browser extension installed — your properties will sync automatically.
          </p>
        </div>
      )}

      {properties && properties.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
          {properties.map((p: any) => (
            <div key={p._id} className="dash-card" style={{ padding: "20px 24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 22 }}>🏠</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "var(--dash-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {p.name}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--dash-text-muted)", marginTop: 2 }}>
                    {p.platform?.toUpperCase()} {p.location ? `· ${p.location}` : ""}
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {p.bedrooms > 0 && (
                  <div style={{ fontSize: 12, color: "var(--dash-text-muted)" }}>
                    🛏 {p.bedrooms} bedroom{p.bedrooms !== 1 ? "s" : ""}
                  </div>
                )}
                {p.maxGuests > 0 && (
                  <div style={{ fontSize: 12, color: "var(--dash-text-muted)" }}>
                    👥 {p.maxGuests} guests max
                  </div>
                )}
                {p.checkInTime && (
                  <div style={{ fontSize: 12, color: "var(--dash-text-muted)" }}>
                    ✅ Check-in {p.checkInTime}
                  </div>
                )}
                {p.checkOutTime && (
                  <div style={{ fontSize: 12, color: "var(--dash-text-muted)" }}>
                    🚪 Check-out {p.checkOutTime}
                  </div>
                )}
              </div>

              {p.wifiPassword && (
                <div style={{ marginTop: 10, fontSize: 12, color: "var(--dash-text-muted)", borderTop: "1px solid var(--dash-border)", paddingTop: 10 }}>
                  📦 WiFi: <code style={{ fontFamily: "monospace", color: "var(--dash-text)" }}>{p.wifiPassword}</code>
                </div>
              )}
              {p.gateCode && (
                <div style={{ marginTop: 6, fontSize: 12, color: "var(--dash-text-muted)" }}>
                  🔐 Gate code: <code style={{ fontFamily: "monospace", color: "var(--dash-text)" }}>{p.gateCode}</code>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
