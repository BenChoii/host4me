import { motion } from "motion/react";

export default function Properties() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--dash-text)", marginBottom: 24 }}>
        Properties
      </h2>
      <div className="dash-card">
        <p style={{ color: "var(--dash-text-muted)" }}>
          Your properties will appear here once you connect your Airbnb account.
        </p>
      </div>
    </motion.div>
  );
}
