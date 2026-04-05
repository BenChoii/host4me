import { useCurrentFrame, useVideoConfig, interpolate, spring, AbsoluteFill } from 'remotion';
import { AlfredAvatar, CommsAvatar, EscalationAvatar, AGENT_COLORS } from '../components/agents/AgentAvatars';

/*
  Night Shift — A Story of Properties Being Managed

  Shows a timeline from 11PM to 4AM. Guest messages arrive.
  Alfred and his agents handle each one. The host sleeps peacefully.
  Cinematic, story-driven, pastel.
*/

const EVENTS = [
  {
    time: '11:47 PM', platform: 'Airbnb', guest: 'Sarah K.',
    issue: 'Parking question',
    resolution: 'Sent access codes + directions',
    agent: 'comms', severity: 'low',
  },
  {
    time: '1:14 AM', platform: 'Vrbo', guest: 'Mike R.',
    issue: 'Hot tub not heating',
    resolution: 'Sent troubleshooting guide',
    agent: 'comms', severity: 'medium',
  },
  {
    time: '2:32 AM', platform: 'SMS', guest: 'Jessica L.',
    issue: "Can't find lockbox",
    resolution: 'Sent video walkthrough + escalated to host',
    agent: 'escalation', severity: 'high',
  },
  {
    time: '3:07 AM', platform: 'Email', guest: 'David W.',
    issue: 'Restaurant recommendations',
    resolution: 'Sent 3 options with walking directions',
    agent: 'comms', severity: 'low',
  },
  {
    time: '4:15 AM', platform: 'Airbnb', guest: 'Emma T.',
    issue: 'WiFi password',
    resolution: 'Sent credentials + router restart guide',
    agent: 'comms', severity: 'low',
  },
];

const PLATFORM_COLORS = {
  Airbnb: '#E2B0B0',
  Vrbo: '#A3C4E4',
  SMS: '#A8C5B8',
  Email: '#C8B6E2',
};

const SEVERITY_COLORS = {
  low: '#A8C5B8',
  medium: '#F2C4A0',
  high: '#E2B0B0',
};

function MoonIcon({ frame }) {
  const glow = 0.3 + Math.sin(frame * 0.03) * 0.1;
  return (
    <svg width="32" height="32" viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="12" fill="#D5C6E0" opacity={glow + 0.4} />
      <circle cx="16" cy="16" r="10" fill="#E8DFF5" />
      <circle cx="20" cy="12" r="7" fill="#D5C6E0" opacity="0.3" />
    </svg>
  );
}

function Star({ x, y, size, frame, delay }) {
  const twinkle = 0.3 + Math.sin(frame * 0.05 + delay) * 0.7;
  return (
    <div style={{
      position: 'absolute', left: x, top: y,
      width: size, height: size, borderRadius: '50%',
      background: '#D5C6E0', opacity: twinkle * 0.6,
    }} />
  );
}

function EventCard({ event, frame, enterFrame, fps, index }) {
  const localFrame = Math.max(0, frame - enterFrame);
  const entryS = spring({ frame: localFrame, fps, config: { damping: 14, stiffness: 100 } });

  const resolveDelay = 35;
  const resolved = localFrame > resolveDelay;
  const resolveS = resolved
    ? spring({ frame: Math.max(0, localFrame - resolveDelay), fps, config: { damping: 12, stiffness: 140 } })
    : 0;

  const AgentIcon = event.agent === 'escalation' ? EscalationAvatar : CommsAvatar;

  return (
    <div style={{
      display: 'flex', gap: 12, alignItems: 'flex-start',
      opacity: interpolate(entryS, [0, 1], [0, 1]),
      transform: `translateY(${interpolate(entryS, [0, 1], [20, 0])}px)`,
      marginBottom: 10,
    }}>
      {/* Timeline dot + time */}
      <div style={{ width: 52, textAlign: 'right', flexShrink: 0, paddingTop: 6 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: '#6B6880' }}>{event.time}</div>
      </div>

      {/* Timeline line */}
      <div style={{
        width: 2, minHeight: 56, background: 'rgba(45,43,61,0.06)',
        position: 'relative', flexShrink: 0,
      }}>
        <div style={{
          position: 'absolute', top: 6, left: -4,
          width: 10, height: 10, borderRadius: '50%',
          background: SEVERITY_COLORS[event.severity],
          border: '2px solid white',
        }} />
      </div>

      {/* Card */}
      <div style={{
        flex: 1, background: 'white', borderRadius: 14, padding: '10px 14px',
        border: `1px solid ${resolved ? 'rgba(168,197,184,0.25)' : 'rgba(45,43,61,0.06)'}`,
        boxShadow: '0 2px 8px rgba(45,43,61,0.03)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <div style={{
            padding: '2px 8px', borderRadius: 100, fontSize: 9, fontWeight: 600,
            background: `${PLATFORM_COLORS[event.platform]}30`,
            color: PLATFORM_COLORS[event.platform],
          }}>{event.platform}</div>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#2D2B3D' }}>{event.guest}</span>
        </div>
        <div style={{ fontSize: 12, color: '#6B6880', marginBottom: 4 }}>{event.issue}</div>

        {resolved && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, marginTop: 6,
            opacity: interpolate(resolveS, [0, 1], [0, 1]),
            transform: `translateY(${interpolate(resolveS, [0, 1], [8, 0])}px)`,
          }}>
            <AgentIcon size={20} />
            <span style={{ fontSize: 10, color: '#7FA695', fontWeight: 500 }}>
              ✓ {event.resolution}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function NightShift() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerS = spring({ frame, fps, config: { damping: 14, stiffness: 80 } });

  return (
    <AbsoluteFill style={{
      background: 'linear-gradient(170deg, #2D2B3D 0%, #3D3A52 40%, #4A4563 100%)',
      fontFamily: "'Inter', -apple-system, sans-serif",
      overflow: 'hidden',
    }}>
      {/* Stars */}
      {[
        [80, 40, 3, 0], [200, 25, 2, 1], [350, 50, 2.5, 2],
        [450, 35, 2, 3], [550, 55, 3, 4], [120, 70, 2, 5],
        [680, 40, 2.5, 6], [750, 60, 2, 7], [400, 15, 3, 8],
      ].map(([x, y, size, delay], i) => (
        <Star key={i} x={x} y={y} size={size} frame={frame} delay={delay} />
      ))}

      <div style={{ display: 'flex', height: '100%', padding: '24px 30px' }}>
        {/* Left: Header + Host sleeping */}
        <div style={{
          width: 200, display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 16,
          opacity: interpolate(headerS, [0, 1], [0, 1]),
          transform: `translateY(${interpolate(headerS, [0, 1], [20, 0])}px)`,
        }}>
          <MoonIcon frame={frame} />
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontSize: 18, fontWeight: 700, color: 'white', marginBottom: 4,
            }}>While You Sleep</div>
            <div style={{
              fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5,
            }}>Alfred's team handles<br />every guest message</div>
          </div>

          <div style={{
            marginTop: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          }}>
            <AlfredAvatar size={64} animated frame={frame} />
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
              {Math.min(EVENTS.length, Math.floor(interpolate(frame, [50, 300], [0, EVENTS.length], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })))} messages handled
            </div>
          </div>

          {/* Host status */}
          <div style={{
            padding: '8px 16px', borderRadius: 100,
            background: 'rgba(168,197,184,0.1)',
            border: '1px solid rgba(168,197,184,0.2)',
            fontSize: 11, color: '#A8C5B8',
            opacity: interpolate(frame, [40, 60], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
          }}>😴 Host is sleeping</div>
        </div>

        {/* Right: Event timeline */}
        <div style={{ flex: 1, paddingLeft: 20, overflow: 'hidden' }}>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
            color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase',
            marginBottom: 12,
            opacity: interpolate(frame, [20, 40], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
          }}>Live Activity</div>

          {EVENTS.map((event, i) => (
            <EventCard
              key={i}
              event={event}
              frame={frame}
              enterFrame={40 + i * 50}
              fps={fps}
              index={i}
            />
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
}
