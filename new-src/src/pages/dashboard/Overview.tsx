import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Sparkles,
  MessageSquare,
  Search,
  Building2,
  CalendarSync,
  Bot,
  Mail,
  Globe,
  TrendingUp,
  Clock,
  Users,
  Home,
  Send,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  Briefcase,
  Phone,
  DollarSign,
  Eye,
  Pencil,
  X,
} from "lucide-react";

// ─── Agent definitions ──────────────────────────────────────────────────────

interface Agent {
  id: string;
  name: string;
  role: string;
  icon: any;
  color: string;
  colorSubtle: string;
  status: "active" | "idle" | "working";
  currentTask: string;
  tasksCompleted: number;
  lastActive: string;
}

const AGENTS: Agent[] = [
  {
    id: "inbox",
    name: "Inbox Agent",
    role: "Guest Communication",
    icon: MessageSquare,
    color: "var(--dash-accent)",
    colorSubtle: "var(--dash-accent-subtle)",
    status: "active",
    currentTask: "Monitoring Airbnb & VRBO inboxes",
    tasksCompleted: 0,
    lastActive: "Now",
  },
  {
    id: "research",
    name: "Research Agent",
    role: "Property Intelligence",
    icon: Search,
    color: "var(--dash-purple)",
    colorSubtle: "var(--dash-purple-subtle)",
    status: "working",
    currentTask: "Scanning listings for property details",
    tasksCompleted: 0,
    lastActive: "Now",
  },
  {
    id: "outreach",
    name: "Outreach Agent",
    role: "Corporate Sales",
    icon: Briefcase,
    color: "var(--dash-blue)",
    colorSubtle: "var(--dash-blue-subtle)",
    status: "idle",
    currentTask: "Waiting for property data",
    tasksCompleted: 0,
    lastActive: "—",
  },
  {
    id: "calendar",
    name: "Calendar Agent",
    role: "Booking Sync",
    icon: CalendarSync,
    color: "var(--dash-cyan)",
    colorSubtle: "var(--dash-cyan-subtle)",
    status: "active",
    currentTask: "Syncing calendars across platforms",
    tasksCompleted: 0,
    lastActive: "Now",
  },
];

// ─── Mock activity feed ─────────────────────────────────────────────────────

interface ActivityItem {
  id: number;
  agent: string;
  agentColor: string;
  agentIcon: any;
  action: string;
  detail?: string;
  time: string;
  type: "info" | "success" | "warning" | "working";
}

const ACTIVITY_FEED: ActivityItem[] = [
  {
    id: 1,
    agent: "Research",
    agentColor: "var(--dash-purple)",
    agentIcon: Search,
    action: "Scanning your Airbnb listings for property details",
    detail: "Found 0 properties so far",
    time: "Just now",
    type: "working",
  },
  {
    id: 2,
    agent: "Calendar",
    agentColor: "var(--dash-cyan)",
    agentIcon: CalendarSync,
    action: "Calendar sync initialized",
    detail: "Watching for new bookings across all platforms",
    time: "1m ago",
    type: "info",
  },
  {
    id: 3,
    agent: "Inbox",
    agentColor: "var(--dash-accent)",
    agentIcon: MessageSquare,
    action: "Inbox monitoring started",
    detail: "Watching for new guest messages",
    time: "2m ago",
    type: "success",
  },
  {
    id: 4,
    agent: "Outreach",
    agentColor: "var(--dash-blue)",
    agentIcon: Briefcase,
    action: "Standing by for corporate outreach",
    detail: "Will start once properties are cataloged",
    time: "2m ago",
    type: "info",
  },
];

// ─── Mock draft queue ───────────────────────────────────────────────────────

interface DraftReply {
  id: number;
  guestName: string;
  platform: string;
  property: string;
  preview: string;
  time: string;
  urgency: "normal" | "urgent";
}

const DRAFT_QUEUE: DraftReply[] = [];

// ─── Mock pipeline ──────────────────────────────────────────────────────────

interface PipelineLead {
  id: number;
  company: string;
  contact: string;
  stage: "researching" | "drafted" | "sent" | "replied" | "negotiating";
  property: string;
  value: string;
}

const PIPELINE: PipelineLead[] = [];

// ─── Component ──────────────────────────────────────────────────────────────

export default function Overview() {
  const navigate = useNavigate();
  const tenant = useQuery(api.tenants.get);
  const getOrCreate = useMutation(api.tenants.getOrCreate);
  const hasTriedCreate = useRef(false);

  useEffect(() => {
    if (tenant === null && !hasTriedCreate.current) {
      hasTriedCreate.current = true;
      getOrCreate().catch(console.error);
    }
  }, [tenant, getOrCreate]);

  const isOnboarded = tenant?.onboarded;

  return (
    <div>
      {/* ─── Onboarding CTA ─── */}
      {!isOnboarded && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="dash-card"
          style={{
            background: "linear-gradient(135deg, var(--dash-surface), rgba(198, 125, 59, 0.06))",
            border: "1px solid rgba(198, 125, 59, 0.2)",
            padding: "24px",
            marginBottom: "24px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 8,
              background: "rgba(242, 125, 38, 0.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Bot size={20} color="var(--dash-accent)" />
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--dash-text)", marginBottom: 4 }}>
                Activate Alfred's Agent Team
              </h3>
              <p style={{ fontSize: 13, color: "var(--dash-text-muted)", marginBottom: 0 }}>
                Connect your platforms and Alfred will deploy 4 AI agents to manage your properties.
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
        </motion.div>
      )}

      {/* ─── Key Metrics ─── */}
      <div className="dash-metrics" style={{ marginBottom: 24 }}>
        {[
          { label: "Properties", value: "0", icon: Home, change: null },
          { label: "Messages Today", value: "0", icon: MessageSquare, change: null },
          { label: "Avg Response", value: "—", icon: Clock, change: null },
          { label: "Pipeline Value", value: "$0", icon: DollarSign, change: null },
        ].map((metric, i) => (
          <motion.div
            key={metric.label}
            className="dash-metric"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.3 }}
          >
            <div className="dash-metric-label">
              <metric.icon size={12} />
              {metric.label}
            </div>
            <div className="dash-metric-value">{metric.value}</div>
          </motion.div>
        ))}
      </div>

      {/* ─── Agent Team ─── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 14,
        }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--dash-text)", display: "flex", alignItems: "center", gap: 8 }}>
            <Bot size={14} color="var(--dash-accent)" />
            Agent Team
          </h3>
          <span className="dash-status active" style={{ fontSize: 10 }}>
            <span className="dash-status-dot" />
            {AGENTS.filter((a) => a.status !== "idle").length} active
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {AGENTS.map((agent, i) => (
            <motion.div
              key={agent.id}
              className="dash-card dash-card-glow"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.06, duration: 0.3 }}
              style={{ padding: 16, cursor: "pointer" }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: agent.colorSubtle,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <agent.icon size={16} color={agent.color} />
                </div>
                <span
                  className={`dash-status ${agent.status === "active" ? "active" : agent.status === "working" ? "warning" : "idle"}`}
                  style={{ fontSize: 9, padding: "2px 7px" }}
                >
                  <span className="dash-status-dot" />
                  {agent.status === "working" ? "Working" : agent.status === "active" ? "Active" : "Idle"}
                </span>
              </div>

              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--dash-text)", marginBottom: 2 }}>
                {agent.name}
              </div>
              <div style={{ fontSize: 11, color: "var(--dash-text-muted)", marginBottom: 10 }}>
                {agent.role}
              </div>

              <div style={{
                fontSize: 11, color: "var(--dash-text-secondary)",
                background: "rgba(255,255,255,0.02)",
                borderRadius: 6, padding: "6px 8px",
                display: "flex", alignItems: "center", gap: 6,
                lineHeight: 1.4,
              }}>
                {agent.status === "working" && (
                  <Loader2 size={10} color={agent.color} style={{ animation: "spin 1s linear infinite", flexShrink: 0 }} />
                )}
                {agent.status === "active" && (
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: agent.color, flexShrink: 0 }} />
                )}
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {agent.currentTask}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ─── Two-column: Activity Feed + Draft Queue ─── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>

        {/* Activity Feed */}
        <motion.div
          className="dash-card"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          style={{ padding: 0 }}
        >
          <div style={{
            padding: "16px 20px 12px",
            borderBottom: "1px solid var(--dash-border)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--dash-text)", display: "flex", alignItems: "center", gap: 8 }}>
              <Sparkles size={13} color="var(--dash-purple)" />
              Agent Activity
            </h3>
            <span style={{ fontSize: 11, color: "var(--dash-text-muted)" }}>Live</span>
          </div>

          <div style={{ padding: "4px 20px 16px" }}>
            {ACTIVITY_FEED.length > 0 ? (
              <div className="dash-feed">
                {ACTIVITY_FEED.map((item) => (
                  <div key={item.id} className="dash-feed-item">
                    <div
                      className="dash-feed-icon"
                      style={{ background: `${item.agentColor}15` }}
                    >
                      <item.agentIcon size={14} color={item.agentColor} />
                    </div>
                    <div className="dash-feed-content">
                      <div className="dash-feed-title">
                        <span style={{ color: item.agentColor, fontWeight: 550 }}>{item.agent}</span>
                        {" · "}
                        {item.action}
                      </div>
                      {item.detail && (
                        <div style={{ fontSize: 11, color: "var(--dash-text-muted)", marginTop: 2 }}>
                          {item.detail}
                        </div>
                      )}
                      <div className="dash-feed-time">{item.time}</div>
                    </div>
                    {item.type === "working" && (
                      <Loader2 size={12} color="var(--dash-warning)" style={{ animation: "spin 1s linear infinite", marginTop: 4 }} />
                    )}
                    {item.type === "success" && (
                      <CheckCircle2 size={12} color="var(--dash-success)" style={{ marginTop: 4 }} />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="dash-empty" style={{ padding: "32px 24px" }}>
                <div className="dash-empty-icon">
                  <Sparkles size={20} color="var(--dash-purple)" />
                </div>
                <div className="dash-empty-title">No activity yet</div>
                <div className="dash-empty-desc">Complete onboarding to activate your agent team.</div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Draft Reply Queue */}
        <motion.div
          className="dash-card"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          style={{ padding: 0 }}
        >
          <div style={{
            padding: "16px 20px 12px",
            borderBottom: "1px solid var(--dash-border)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--dash-text)", display: "flex", alignItems: "center", gap: 8 }}>
              <Send size={13} color="var(--dash-accent)" />
              Draft Replies
              {DRAFT_QUEUE.length > 0 && (
                <span style={{
                  background: "var(--dash-accent)",
                  color: "white",
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "1px 6px",
                  borderRadius: 99,
                  minWidth: 18,
                  textAlign: "center",
                }}>
                  {DRAFT_QUEUE.length}
                </span>
              )}
            </h3>
            <span style={{ fontSize: 11, color: "var(--dash-text-muted)" }}>Shadow Mode</span>
          </div>

          <div style={{ padding: "4px 20px 16px" }}>
            {DRAFT_QUEUE.length > 0 ? (
              <div className="dash-feed">
                {DRAFT_QUEUE.map((draft) => (
                  <div key={draft.id} className="dash-feed-item" style={{ alignItems: "flex-start" }}>
                    <div className="dash-feed-icon" style={{ background: "var(--dash-accent-subtle)" }}>
                      <MessageSquare size={14} color="var(--dash-accent)" />
                    </div>
                    <div className="dash-feed-content">
                      <div className="dash-feed-title">
                        <span style={{ fontWeight: 550, color: "var(--dash-text)" }}>{draft.guestName}</span>
                        {" · "}
                        {draft.property}
                      </div>
                      <div style={{
                        fontSize: 12, color: "var(--dash-text-secondary)", marginTop: 4,
                        background: "rgba(255,255,255,0.02)", borderRadius: 6, padding: "6px 8px",
                        fontStyle: "italic", lineHeight: 1.5,
                      }}>
                        "{draft.preview}"
                      </div>
                      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                        <button className="dash-btn dash-btn-primary" style={{ fontSize: 11, padding: "4px 10px" }}>
                          <CheckCircle2 size={11} /> Approve
                        </button>
                        <button className="dash-btn dash-btn-secondary" style={{ fontSize: 11, padding: "4px 10px" }}>
                          <Pencil size={11} /> Edit
                        </button>
                        <button className="dash-btn dash-btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }}>
                          <X size={11} />
                        </button>
                      </div>
                      <div className="dash-feed-time">{draft.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="dash-empty" style={{ padding: "32px 24px" }}>
                <div className="dash-empty-icon">
                  <MessageSquare size={20} color="var(--dash-accent)" />
                </div>
                <div className="dash-empty-title">No drafts pending</div>
                <div className="dash-empty-desc">When guests message you, Alfred will draft replies here for your approval.</div>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* ─── Corporate Pipeline ─── */}
      <motion.div
        className="dash-card"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        style={{ padding: 0 }}
      >
        <div style={{
          padding: "16px 20px 12px",
          borderBottom: "1px solid var(--dash-border)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--dash-text)", display: "flex", alignItems: "center", gap: 8 }}>
            <Briefcase size={13} color="var(--dash-blue)" />
            Corporate Pipeline
          </h3>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {PIPELINE.length > 0 && (
              <span style={{ fontSize: 11, color: "var(--dash-text-muted)" }}>
                {PIPELINE.length} leads
              </span>
            )}
          </div>
        </div>

        <div style={{ padding: "4px 20px 16px" }}>
          {PIPELINE.length > 0 ? (
            <>
              {/* Pipeline stages */}
              <div style={{ display: "flex", gap: 4, margin: "12px 0 16px", padding: "0 4px" }}>
                {["Researching", "Drafted", "Sent", "Replied", "Negotiating"].map((stage, i) => {
                  const count = PIPELINE.filter((l) => l.stage === stage.toLowerCase()).length;
                  return (
                    <div key={stage} style={{ flex: 1, textAlign: "center" }}>
                      <div style={{
                        height: 3, borderRadius: 2, marginBottom: 6,
                        background: count > 0
                          ? `linear-gradient(90deg, var(--dash-blue), var(--dash-cyan))`
                          : "rgba(255,255,255,0.04)",
                      }} />
                      <div style={{ fontSize: 10, color: count > 0 ? "var(--dash-text-secondary)" : "var(--dash-text-muted)" }}>
                        {stage} ({count})
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Lead list */}
              <div className="dash-feed">
                {PIPELINE.map((lead) => (
                  <div key={lead.id} className="dash-feed-item">
                    <div className="dash-feed-icon" style={{ background: "var(--dash-blue-subtle)" }}>
                      <Building2 size={14} color="var(--dash-blue)" />
                    </div>
                    <div className="dash-feed-content">
                      <div className="dash-feed-title">
                        <span style={{ fontWeight: 550, color: "var(--dash-text)" }}>{lead.company}</span>
                        {" · "}{lead.contact}
                      </div>
                      <div className="dash-feed-time">{lead.property} · {lead.value}/mo</div>
                    </div>
                    <span
                      className={`dash-status ${lead.stage === "negotiating" ? "active" : lead.stage === "replied" ? "warning" : "idle"}`}
                      style={{ fontSize: 9, padding: "2px 7px" }}
                    >
                      {lead.stage.charAt(0).toUpperCase() + lead.stage.slice(1)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="dash-empty" style={{ padding: "32px 24px" }}>
              <div className="dash-empty-icon">
                <Briefcase size={20} color="var(--dash-blue)" />
              </div>
              <div className="dash-empty-title">Corporate outreach not started</div>
              <div className="dash-empty-desc">
                Once your properties are set up, the Outreach Agent will research companies in your area and draft personalized pitches for corporate long-term stays.
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Spin animation for loading indicators */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
