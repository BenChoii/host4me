import { useCurrentFrame, useVideoConfig, interpolate, spring, AbsoluteFill } from 'remotion';
import {
  AlfredAvatar, CommsAvatar, EscalationAvatar, ReportingAvatar,
  ResearchAvatar, OptimizerAvatar, AGENT_COLORS,
} from '../components/agents/AgentAvatars';

/*
  Alfred's Office — Full 6-Agent Command Center

  Alfred at the center orchestrating 5 specialized agents.
  Tasks flow in with time-saved estimates. Each agent handles
  their domain independently.
*/

const AGENTS = [
  { name: 'Guest Comms', role: 'Replies to guests 24/7', Avatar: CommsAvatar, color: AGENT_COLORS.comms },
  { name: 'Escalation', role: 'Handles emergencies', Avatar: EscalationAvatar, color: AGENT_COLORS.escalation },
  { name: 'Reporting', role: 'Tracks analytics', Avatar: ReportingAvatar, color: AGENT_COLORS.reporting },
  { name: 'Market Research', role: 'Pricing & competitors', Avatar: ResearchAvatar, color: AGENT_COLORS.research },
  { name: 'Profile Optimizer', role: 'Listings & SEO', Avatar: OptimizerAvatar, color: AGENT_COLORS.optimizer },
];

const TASKS = [
  { text: 'Reply to parking question', agent: 0, timeSaved: '3 min', color: AGENT_COLORS.comms.primary },
  { text: 'Guest locked out — escalate', agent: 1, timeSaved: '15 min', color: AGENT_COLORS.escalation.primary },
  { text: 'Morning pricing scan', agent: 3, timeSaved: '20 min', color: AGENT_COLORS.research.primary },
  { text: 'Rewrite listing description', agent: 4, timeSaved: '30 min', color: AGENT_COLORS.optimizer.primary },
  { text: 'Weekly performance report', agent: 2, timeSaved: '12 min', color: AGENT_COLORS.reporting.primary },
  { text: 'Coordinate cleaning crew', agent: 0, timeSaved: '8 min', color: AGENT_COLORS.comms.primary },
];

function TaskCard({ task, frame, enterFrame, fps }) {
  const localFrame = Math.max(0, frame - enterFrame);
  const s = spring({ frame: localFrame, fps, config: { damping: 14, stiffness: 100 } });
  const resolved = localFrame > 50;
  const resolveS = resolved ? spring({ frame: Math.max(0, localFrame - 50), fps, config: { damping: 10, stiffness: 200 } }) : 0;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '7px 10px', borderRadius: 10,
      background: 'white',
      border: `1px solid ${resolved ? 'rgba(168,197,184,0.25)' : 'rgba(45,43,61,0.05)'}`,
      boxShadow: '0 1px 4px rgba(45,43,61,0.03)',
      opacity: interpolate(s, [0, 1], [0, 1]),
      transform: `translateX(${interpolate(s, [0, 1], [20, 0])}px)`,
      marginBottom: 5, fontSize: 10, fontFamily: "'Inter', sans-serif",
    }}>
      <div style={{
        width: 5, height: 5, borderRadius: '50%', background: task.color, flexShrink: 0,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, color: '#2D2B3D', fontSize: 9, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{task.text}</div>
      </div>
      <div style={{
        fontSize: 8, fontWeight: 600, color: '#7FA695',
        padding: '2px 6px', borderRadius: 100,
        background: 'rgba(168,197,184,0.1)',
        flexShrink: 0, whiteSpace: 'nowrap',
        opacity: resolved ? interpolate(resolveS, [0, 1], [0, 1]) : 0,
      }}>⏱ {task.timeSaved}</div>
      {resolved && (
        <span style={{
          color: '#7FA695', fontSize: 9, flexShrink: 0,
          opacity: interpolate(resolveS, [0, 1], [0, 1]),
        }}>✓</span>
      )}
    </div>
  );
}

export default function AgentOffice() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const alfredS = spring({ frame, fps, config: { damping: 16, stiffness: 70 } });

  // Circular positions for 5 agents around Alfred
  const radius = 155;
  const centerX = 420;
  const centerY = 220;
  const agentPositions = AGENTS.map((_, i) => {
    const angle = (i / AGENTS.length) * Math.PI * 2 - Math.PI / 2;
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius * 0.7,
    };
  });

  // Total time saved counter
  const resolvedCount = Math.min(TASKS.length, Math.floor(interpolate(frame, [60, 340], [0, TASKS.length], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })));
  const totalTimeSaved = TASKS.slice(0, resolvedCount).reduce((sum, t) => sum + parseInt(t.timeSaved), 0);

  return (
    <AbsoluteFill style={{
      background: 'linear-gradient(135deg, #FAF8F5 0%, #F0EBF5 50%, #EDF2F7 100%)',
      fontFamily: "'Inter', -apple-system, sans-serif",
      overflow: 'hidden',
    }}>
      {/* Subtle radial glow */}
      <div style={{
        position: 'absolute', top: '46%', left: '47%', transform: 'translate(-50%, -50%)',
        width: 280, height: 280,
        background: 'radial-gradient(circle, rgba(200,182,226,0.12) 0%, transparent 70%)',
        borderRadius: '50%',
      }} />

      {/* Connection lines */}
      <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
        {agentPositions.map((pos, i) => {
          const progress = interpolate(frame, [15 + i * 10, 50 + i * 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          const toX = centerX + pos.x;
          const toY = centerY + pos.y;
          return (
            <line key={i}
              x1={centerX} y1={centerY} x2={toX} y2={toY}
              stroke={AGENTS[i].color.primary}
              strokeWidth="1.5"
              strokeDasharray="4 3"
              opacity={progress * 0.35}
            />
          );
        })}
      </svg>

      {/* Alfred — center */}
      <div style={{
        position: 'absolute',
        top: centerY - 55, left: centerX - 40,
        opacity: interpolate(alfredS, [0, 1], [0, 1]),
        transform: `scale(${Math.min(alfredS, 1)})`,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        zIndex: 10,
      }}>
        <AlfredAvatar size={80} animated frame={frame} />
        <div style={{ fontSize: 12, fontWeight: 700, color: '#2D2B3D', marginTop: 4 }}>Alfred</div>
        <div style={{ fontSize: 9, color: '#9994AB', fontWeight: 500, letterSpacing: '0.04em' }}>Lead Agent</div>
      </div>

      {/* 5 Sub-agents in circular layout */}
      {AGENTS.map((agent, i) => {
        const delay = 12 + i * 8;
        const s = spring({ frame: Math.max(0, frame - delay), fps, config: { damping: 14, stiffness: 90 } });
        const pos = agentPositions[i];

        return (
          <div key={i} style={{
            position: 'absolute',
            top: centerY + pos.y - 38,
            left: centerX + pos.x - 35,
            opacity: interpolate(s, [0, 1], [0, 1]),
            transform: `scale(${Math.min(s, 1)})`,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            width: 70,
          }}>
            <agent.Avatar size={52} animated frame={frame} />
            <div style={{ fontSize: 9, fontWeight: 600, color: '#2D2B3D', marginTop: 3, textAlign: 'center', lineHeight: 1.2 }}>{agent.name}</div>
            <div style={{ fontSize: 8, color: '#9994AB', textAlign: 'center' }}>{agent.role}</div>
          </div>
        );
      })}

      {/* Task feed — right side */}
      <div style={{ position: 'absolute', right: 16, top: 16, width: 185 }}>
        <div style={{
          fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
          color: '#9994AB', textTransform: 'uppercase', marginBottom: 6,
        }}>Live Tasks</div>
        {TASKS.map((task, i) => (
          <TaskCard key={i} task={task} frame={frame} enterFrame={45 + i * 40} fps={fps} />
        ))}
      </div>

      {/* Time saved counter — bottom center */}
      <div style={{
        position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', gap: 28, alignItems: 'center',
        opacity: interpolate(frame, [60, 90], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#2D2B3D' }}>6</div>
          <div style={{ fontSize: 9, color: '#9994AB' }}>Agents Active</div>
        </div>
        <div style={{
          width: 1, height: 28, background: 'rgba(45,43,61,0.08)',
        }} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#7FA695' }}>{totalTimeSaved} min</div>
          <div style={{ fontSize: 9, color: '#9994AB' }}>Time Saved</div>
        </div>
        <div style={{
          width: 1, height: 28, background: 'rgba(45,43,61,0.08)',
        }} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#2D2B3D' }}>{resolvedCount}/{TASKS.length}</div>
          <div style={{ fontSize: 9, color: '#9994AB' }}>Tasks Done</div>
        </div>
      </div>
    </AbsoluteFill>
  );
}
