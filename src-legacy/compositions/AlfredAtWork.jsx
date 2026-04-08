import { useCurrentFrame, useVideoConfig, interpolate, spring, AbsoluteFill } from 'remotion';
import { AlfredAvatar, CommsAvatar, EscalationAvatar, AGENT_COLORS } from '../components/agents/AgentAvatars';

/*
  Alfred At Work — CTA Section Composition

  Shows a live dashboard of Alfred managing properties.
  Clean, data-driven, pastel. Makes property managers want this.
*/

const PROPERTIES = [
  { name: 'Sunset Cottage', location: 'Vancouver', guests: 2, status: 'checked-in' },
  { name: 'Mountain View Suite', location: 'Whistler', guests: 4, status: 'arriving' },
  { name: 'Harbour Loft', location: 'Victoria', guests: 1, status: 'checked-in' },
];

const ACTIVITY = [
  { text: 'Replied to parking question', time: '2m ago', agent: 'comms' },
  { text: 'Escalated noise complaint', time: '8m ago', agent: 'escalation' },
  { text: 'Sent check-in instructions', time: '15m ago', agent: 'comms' },
  { text: 'Generated weekly report', time: '1h ago', agent: 'reporting' },
];

const STATUS_COLORS = {
  'checked-in': '#A8C5B8',
  'arriving': '#F2C4A0',
};

export default function AlfredAtWork() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerS = spring({ frame, fps, config: { damping: 14, stiffness: 80 } });

  return (
    <AbsoluteFill style={{
      background: 'linear-gradient(160deg, #FAF8F5 0%, #F7F2ED 50%, #F0EBF5 100%)',
      fontFamily: "'Inter', -apple-system, sans-serif",
      padding: 24,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 20, paddingBottom: 14,
        borderBottom: '1px solid rgba(45,43,61,0.06)',
        opacity: interpolate(headerS, [0, 1], [0, 1]),
        transform: `translateY(${interpolate(headerS, [0, 1], [-15, 0])}px)`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlfredAvatar size={36} animated frame={frame} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#2D2B3D' }}>Alfred's Dashboard</div>
            <div style={{ fontSize: 10, color: '#A8C5B8', fontWeight: 500 }}>All systems active</div>
          </div>
        </div>
        <div style={{
          padding: '6px 14px', borderRadius: 100, fontSize: 10, fontWeight: 600,
          background: 'rgba(168,197,184,0.12)', color: '#7FA695',
          border: '1px solid rgba(168,197,184,0.2)',
        }}>● Live</div>
      </div>

      <div style={{ display: 'flex', gap: 16, flex: 1 }}>
        {/* Left: Properties */}
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
            color: '#9994AB', textTransform: 'uppercase', marginBottom: 10,
          }}>Properties</div>

          {PROPERTIES.map((prop, i) => {
            const delay = 20 + i * 18;
            const s = spring({ frame: Math.max(0, frame - delay), fps, config: { damping: 12, stiffness: 120 } });
            return (
              <div key={i} style={{
                background: 'white', borderRadius: 14, padding: '12px 14px',
                border: '1px solid rgba(45,43,61,0.06)', marginBottom: 8,
                boxShadow: '0 2px 8px rgba(45,43,61,0.03)',
                opacity: interpolate(s, [0, 1], [0, 1]),
                transform: `translateX(${interpolate(s, [0, 1], [-20, 0])}px)`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#2D2B3D' }}>{prop.name}</div>
                    <div style={{ fontSize: 10, color: '#9994AB' }}>{prop.location} · {prop.guests} guests</div>
                  </div>
                  <div style={{
                    padding: '3px 10px', borderRadius: 100, fontSize: 9, fontWeight: 600,
                    background: `${STATUS_COLORS[prop.status]}20`,
                    color: STATUS_COLORS[prop.status],
                    textTransform: 'capitalize',
                  }}>{prop.status.replace('-', ' ')}</div>
                </div>
              </div>
            );
          })}

          {/* Stats row */}
          <div style={{
            display: 'flex', gap: 8, marginTop: 12,
            opacity: interpolate(frame, [80, 100], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
          }}>
            {[
              { label: 'Response', value: '47s', color: AGENT_COLORS.comms.primary },
              { label: 'Rating', value: '4.9★', color: AGENT_COLORS.alfred.primary },
              { label: 'Saved', value: '$960', color: AGENT_COLORS.reporting.primary },
            ].map((stat, i) => (
              <div key={i} style={{
                flex: 1, textAlign: 'center', padding: '10px 8px', borderRadius: 12,
                background: `${stat.color}12`, border: `1px solid ${stat.color}25`,
              }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#2D2B3D' }}>{stat.value}</div>
                <div style={{ fontSize: 9, color: '#9994AB' }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Activity feed */}
        <div style={{ width: 220 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
            color: '#9994AB', textTransform: 'uppercase', marginBottom: 10,
          }}>Recent Activity</div>

          {ACTIVITY.map((item, i) => {
            const delay = 40 + i * 25;
            const s = spring({ frame: Math.max(0, frame - delay), fps, config: { damping: 12, stiffness: 120 } });
            const AgentIcon = item.agent === 'escalation' ? EscalationAvatar : CommsAvatar;

            return (
              <div key={i} style={{
                display: 'flex', gap: 8, alignItems: 'flex-start',
                padding: '8px 10px', borderRadius: 10, marginBottom: 6,
                background: 'white',
                border: '1px solid rgba(45,43,61,0.04)',
                opacity: interpolate(s, [0, 1], [0, 1]),
                transform: `translateX(${interpolate(s, [0, 1], [15, 0])}px)`,
              }}>
                <AgentIcon size={22} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, fontWeight: 500, color: '#2D2B3D', lineHeight: 1.4 }}>{item.text}</div>
                  <div style={{ fontSize: 9, color: '#9994AB' }}>{item.time}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
}
