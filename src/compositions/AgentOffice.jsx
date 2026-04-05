import { useCurrentFrame, useVideoConfig, interpolate, spring, AbsoluteFill } from 'remotion';
import {
  AlfredAvatar, CommsAvatar, EscalationAvatar, ReportingAvatar,
  AGENT_COLORS,
} from '../components/agents/AgentAvatars';

/*
  Alfred's Office — Agent Command Center

  Shows Alfred at the center with his team of agents around him.
  Tasks flow in, get routed to the right agent, and get resolved.
  Pastel, clean, command-center aesthetic.
*/

const AGENTS = [
  { name: 'Guest Comms', role: 'Replies to guests', Avatar: CommsAvatar, color: AGENT_COLORS.comms },
  { name: 'Escalation', role: 'Handles emergencies', Avatar: EscalationAvatar, color: AGENT_COLORS.escalation },
  { name: 'Reporting', role: 'Tracks analytics', Avatar: ReportingAvatar, color: AGENT_COLORS.reporting },
];

const TASKS = [
  { text: 'Parking question', platform: 'Airbnb', agent: 0, color: '#A3C4E4' },
  { text: 'Lockbox issue', platform: 'SMS', agent: 1, color: '#E2B0B0' },
  { text: 'Weekly report', platform: 'System', agent: 2, color: '#A8C5B8' },
  { text: 'Check-in info', platform: 'Vrbo', agent: 0, color: '#A3C4E4' },
  { text: 'Noise complaint', platform: 'Airbnb', agent: 1, color: '#E2B0B0' },
];

function ConnectionLine({ fromX, fromY, toX, toY, progress, color }) {
  const midX = (fromX + toX) / 2;
  const midY = Math.min(fromY, toY) - 30;
  const dashOffset = 100 - progress * 100;

  return (
    <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
      <path
        d={`M ${fromX} ${fromY} Q ${midX} ${midY} ${toX} ${toY}`}
        stroke={color}
        strokeWidth="2"
        fill="none"
        strokeDasharray="6 4"
        strokeDashoffset={dashOffset}
        opacity={progress * 0.5}
      />
      {/* Data packet */}
      {progress > 0.1 && progress < 0.9 && (
        <circle r="4" fill={color} opacity="0.8">
          <animateMotion
            dur="2s"
            repeatCount="indefinite"
            path={`M ${fromX} ${fromY} Q ${midX} ${midY} ${toX} ${toY}`}
          />
        </circle>
      )}
    </svg>
  );
}

function TaskCard({ task, frame, enterFrame, fps, index }) {
  const localFrame = Math.max(0, frame - enterFrame);
  const s = spring({ frame: localFrame, fps, config: { damping: 14, stiffness: 100 } });
  const resolved = localFrame > 60;
  const resolveS = resolved ? spring({ frame: Math.max(0, localFrame - 60), fps, config: { damping: 10, stiffness: 200 } }) : 0;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 14px', borderRadius: 12,
      background: 'white',
      border: `1px solid ${resolved ? 'rgba(168,197,184,0.3)' : 'rgba(45,43,61,0.06)'}`,
      boxShadow: '0 2px 8px rgba(45,43,61,0.04)',
      opacity: interpolate(s, [0, 1], [0, 1]),
      transform: `translateX(${interpolate(s, [0, 1], [30, 0])}px) scale(${Math.min(s, 1)})`,
      fontSize: 12, fontFamily: "'Inter', sans-serif",
      marginBottom: 6,
    }}>
      <div style={{
        width: 6, height: 6, borderRadius: '50%', background: task.color, flexShrink: 0,
      }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, color: '#2D2B3D', fontSize: 11 }}>{task.text}</div>
        <div style={{ color: '#9994AB', fontSize: 10 }}>{task.platform}</div>
      </div>
      {resolved && (
        <div style={{
          width: 18, height: 18, borderRadius: '50%',
          background: 'rgba(168,197,184,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: interpolate(resolveS, [0, 1], [0, 1]),
          transform: `scale(${Math.min(resolveS, 1)})`,
        }}>
          <span style={{ color: '#7FA695', fontSize: 10 }}>✓</span>
        </div>
      )}
    </div>
  );
}

export default function AgentOffice() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Alfred enters center
  const alfredS = spring({ frame, fps, config: { damping: 16, stiffness: 70 } });

  // Agent positions (relative to center)
  const agentPositions = [
    { x: -250, y: -60 },  // Comms — top left
    { x: 250, y: -60 },   // Escalation — top right
    { x: 0, y: 160 },     // Reporting — bottom center
  ];

  return (
    <AbsoluteFill style={{
      background: 'linear-gradient(135deg, #FAF8F5 0%, #F0EBF5 50%, #EDF2F7 100%)',
      fontFamily: "'Inter', -apple-system, sans-serif",
      overflow: 'hidden',
    }}>
      {/* Subtle radial glow behind Alfred */}
      <div style={{
        position: 'absolute',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 300, height: 300,
        background: 'radial-gradient(circle, rgba(200,182,226,0.15) 0%, transparent 70%)',
        borderRadius: '50%',
      }} />

      {/* Connection lines from Alfred to agents */}
      {AGENTS.map((agent, i) => {
        const agentDelay = 20 + i * 15;
        const progress = interpolate(frame, [agentDelay, agentDelay + 40], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        return (
          <ConnectionLine
            key={i}
            fromX={450}
            fromY={200}
            toX={450 + agentPositions[i].x}
            toY={200 + agentPositions[i].y}
            progress={progress}
            color={agent.color.primary}
          />
        );
      })}

      {/* Alfred — center */}
      <div style={{
        position: 'absolute',
        top: '50%', left: '50%',
        transform: `translate(-50%, -60%) scale(${Math.min(alfredS, 1)})`,
        opacity: interpolate(alfredS, [0, 1], [0, 1]),
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        zIndex: 10,
      }}>
        <AlfredAvatar size={90} animated frame={frame} />
        <div style={{ fontSize: 14, fontWeight: 700, color: '#2D2B3D', marginTop: 6 }}>Alfred</div>
        <div style={{
          fontSize: 10, color: '#9994AB', fontWeight: 500,
          letterSpacing: '0.05em', textTransform: 'uppercase',
        }}>Lead Agent</div>
      </div>

      {/* Sub-agents */}
      {AGENTS.map((agent, i) => {
        const delay = 15 + i * 12;
        const s = spring({ frame: Math.max(0, frame - delay), fps, config: { damping: 14, stiffness: 90 } });
        const pos = agentPositions[i];

        return (
          <div key={i} style={{
            position: 'absolute',
            top: `calc(50% + ${pos.y - 40}px)`,
            left: `calc(50% + ${pos.x - 45}px)`,
            opacity: interpolate(s, [0, 1], [0, 1]),
            transform: `scale(${Math.min(s, 1)}) translateY(${interpolate(s, [0, 1], [20, 0])}px)`,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
          }}>
            <agent.Avatar size={70} animated frame={frame} />
            <div style={{ fontSize: 12, fontWeight: 600, color: '#2D2B3D', marginTop: 4 }}>{agent.name}</div>
            <div style={{ fontSize: 10, color: '#9994AB' }}>{agent.role}</div>
          </div>
        );
      })}

      {/* Task feed — right side */}
      <div style={{
        position: 'absolute', right: 20, top: 20, width: 180,
      }}>
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
          color: '#9994AB', textTransform: 'uppercase', marginBottom: 8,
        }}>Incoming Tasks</div>
        {TASKS.map((task, i) => (
          <TaskCard
            key={i}
            task={task}
            frame={frame}
            enterFrame={50 + i * 40}
            fps={fps}
            index={i}
          />
        ))}
      </div>

      {/* Status bar — bottom */}
      <div style={{
        position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', gap: 32,
        opacity: interpolate(frame, [80, 110], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
      }}>
        {[
          { label: 'Active Agents', value: '4' },
          { label: 'Tasks Handled', value: String(Math.min(TASKS.length, Math.floor(interpolate(frame, [100, 280], [0, TASKS.length], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })))) },
          { label: 'Avg Response', value: '47s' },
        ].map((stat, i) => (
          <div key={i} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#2D2B3D' }}>{stat.value}</div>
            <div style={{ fontSize: 10, color: '#9994AB' }}>{stat.label}</div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
}
