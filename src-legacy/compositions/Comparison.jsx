import { useCurrentFrame, useVideoConfig, interpolate, spring, AbsoluteFill } from 'remotion';
import { AlfredAvatar, AGENT_COLORS } from '../components/agents/AgentAvatars';

/*
  Comparison — Side-by-side: Without Alfred vs With Alfred

  Clean pastel panels showing the contrast. Not just chat bubbles —
  shows the full experience difference with visual storytelling.
*/

const WITHOUT_ITEMS = [
  { icon: '😴', text: 'Guest messages at 2 AM', status: 'Missed for 6 hours' },
  { icon: '😤', text: 'Guest left bad review', status: '★★☆☆☆' },
  { icon: '📱', text: 'Check 4 apps manually', status: '45 min/day' },
  { icon: '💸', text: 'Lost booking from slow reply', status: '-$320' },
];

const WITH_ITEMS = [
  { icon: '⚡', text: 'Guest messages at 2 AM', status: 'Replied in 47 seconds' },
  { icon: '⭐', text: 'Guest felt taken care of', status: '★★★★★' },
  { icon: '🤖', text: 'Alfred handles all platforms', status: 'Automatic' },
  { icon: '💰', text: 'Every inquiry captured', status: '+$320 saved' },
];

export default function Comparison() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const panelEntry = spring({ frame, fps, config: { damping: 14, stiffness: 80 } });

  return (
    <AbsoluteFill style={{
      background: 'linear-gradient(135deg, #FAF8F5 0%, #F7F2ED 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '0 30px', gap: 20,
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      {/* WITHOUT panel */}
      <div style={{
        flex: 1, background: 'white', borderRadius: 20, padding: '24px 20px',
        border: '1px solid rgba(45,43,61,0.06)',
        boxShadow: '0 8px 30px rgba(45,43,61,0.04)',
        opacity: interpolate(panelEntry, [0, 1], [0, 1]),
        transform: `translateX(${interpolate(panelEntry, [0, 1], [-30, 0])}px)`,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'rgba(226,176,176,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18,
          }}>😩</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#2D2B3D' }}>Without Alfred</div>
            <div style={{ fontSize: 10, color: '#E2B0B0', fontWeight: 500 }}>Manual management</div>
          </div>
        </div>

        {WITHOUT_ITEMS.map((item, i) => {
          const delay = 30 + i * 20;
          const s = spring({ frame: Math.max(0, frame - delay), fps, config: { damping: 12, stiffness: 120 } });
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 12, marginBottom: 8,
              background: 'rgba(226,176,176,0.06)',
              border: '1px solid rgba(226,176,176,0.1)',
              opacity: interpolate(s, [0, 1], [0, 1]),
              transform: `translateX(${interpolate(s, [0, 1], [-15, 0])}px)`,
            }}>
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#2D2B3D' }}>{item.text}</div>
                <div style={{ fontSize: 10, color: '#E2B0B0', fontWeight: 500 }}>{item.status}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* VS divider */}
      <div style={{
        width: 40, height: 40, borderRadius: '50%',
        background: 'white', border: '2px solid rgba(45,43,61,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 700, color: '#9994AB',
        boxShadow: '0 4px 12px rgba(45,43,61,0.06)',
        flexShrink: 0, zIndex: 2,
        opacity: interpolate(frame, [20, 40], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
      }}>vs</div>

      {/* WITH ALFRED panel */}
      <div style={{
        flex: 1, background: 'white', borderRadius: 20, padding: '24px 20px',
        border: '1px solid rgba(168,197,184,0.2)',
        boxShadow: '0 8px 30px rgba(168,197,184,0.1)',
        opacity: interpolate(panelEntry, [0, 1], [0, 1]),
        transform: `translateX(${interpolate(panelEntry, [0, 1], [30, 0])}px)`,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20,
        }}>
          <AlfredAvatar size={36} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#2D2B3D' }}>With Alfred</div>
            <div style={{ fontSize: 10, color: '#A8C5B8', fontWeight: 500 }}>AI-powered management</div>
          </div>
        </div>

        {WITH_ITEMS.map((item, i) => {
          const delay = 40 + i * 20;
          const s = spring({ frame: Math.max(0, frame - delay), fps, config: { damping: 12, stiffness: 120 } });
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 12, marginBottom: 8,
              background: 'rgba(168,197,184,0.06)',
              border: '1px solid rgba(168,197,184,0.15)',
              opacity: interpolate(s, [0, 1], [0, 1]),
              transform: `translateX(${interpolate(s, [0, 1], [15, 0])}px)`,
            }}>
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#2D2B3D' }}>{item.text}</div>
                <div style={{ fontSize: 10, color: '#7FA695', fontWeight: 500 }}>{item.status}</div>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}
