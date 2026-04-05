import { useCurrentFrame, useVideoConfig, interpolate, spring, AbsoluteFill } from 'remotion';
import { AlfredAvatar, AGENT_COLORS } from '../components/agents/AgentAvatars';

/*
  Meet Alfred — Hero Composition

  Alfred appears, introduces himself, then demonstrates handling a
  guest conversation. Warm pastels, character-driven storytelling.
*/

const CAPABILITIES = [
  { icon: '🎯', text: 'Learns your voice' },
  { icon: '🌙', text: 'Works while you sleep' },
  { icon: '💬', text: 'Replies in seconds' },
  { icon: '🛡️', text: 'Escalates what matters' },
];

const GUEST_MSG = "Hi! Can you tell me about parking? We'll have 2 cars.";
const ALFRED_REPLY = "Hey! We've got dedicated spaces out front — your access code is in your check-in email. Need anything else?";

function FloatingParticle({ x, y, size, color, frame, speed = 1 }) {
  const drift = Math.sin(frame * 0.02 * speed + x) * 8;
  const float = Math.cos(frame * 0.015 * speed + y) * 6;
  return (
    <div style={{
      position: 'absolute', left: x + drift, top: y + float,
      width: size, height: size, borderRadius: '50%',
      background: color, opacity: 0.4,
    }} />
  );
}

export default function HeroChat() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const c = AGENT_COLORS.alfred;

  // Phase 1: Alfred appears (0-60)
  const alfredEntry = spring({ frame, fps, config: { damping: 14, stiffness: 80 } });
  const alfredScale = interpolate(alfredEntry, [0, 1], [0.5, 1]);
  const alfredOpacity = interpolate(alfredEntry, [0, 1], [0, 1]);

  // Phase 2: Capabilities appear (40-100)
  // Phase 3: Demo conversation (100-280)
  const guestMsgStart = 110;
  const typingStart = 145;
  const alfredReplyStart = 175;
  const badgeStart = 270;

  return (
    <AbsoluteFill style={{
      background: 'linear-gradient(160deg, #F7F2ED 0%, #FAF8F5 50%, #F0EBF5 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Inter', -apple-system, sans-serif",
      overflow: 'hidden',
    }}>
      {/* Ambient particles */}
      <FloatingParticle x={50} y={30} size={12} color={c.primary} frame={frame} speed={0.8} />
      <FloatingParticle x={380} y={60} size={8} color="#A3C4E4" frame={frame} speed={1.2} />
      <FloatingParticle x={420} y={350} size={10} color="#E2B0B0" frame={frame} speed={0.6} />
      <FloatingParticle x={30} y={300} size={14} color="#A8C5B8" frame={frame} speed={1} />
      <FloatingParticle x={250} y={20} size={6} color="#F2C4A0" frame={frame} speed={1.4} />

      <div style={{
        display: 'flex', gap: 40, alignItems: 'center', padding: '0 40px', width: '100%',
      }}>
        {/* Left: Alfred + capabilities */}
        <div style={{
          flex: '0 0 200px', display: 'flex', flexDirection: 'column', alignItems: 'center',
          opacity: alfredOpacity,
          transform: `scale(${alfredScale}) translateY(${interpolate(alfredEntry, [0, 1], [30, 0])}px)`,
        }}>
          <AlfredAvatar size={120} animated frame={frame} />

          <div style={{
            marginTop: 12, fontSize: 18, fontWeight: 700, color: '#2D2B3D',
            textAlign: 'center',
          }}>Alfred</div>
          <div style={{
            fontSize: 11, color: '#9994AB', fontWeight: 500,
            letterSpacing: '0.05em', textTransform: 'uppercase', marginTop: 2,
          }}>Lead Agent</div>

          {/* Capability pills */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 16, width: '100%' }}>
            {CAPABILITIES.map((cap, i) => {
              const delay = 40 + i * 12;
              const s = spring({ frame: Math.max(0, frame - delay), fps, config: { damping: 12, stiffness: 120 } });
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 12px', borderRadius: 100,
                  background: 'rgba(200, 182, 226, 0.12)',
                  border: '1px solid rgba(200, 182, 226, 0.2)',
                  opacity: interpolate(s, [0, 1], [0, 1]),
                  transform: `translateX(${interpolate(s, [0, 1], [-20, 0])}px)`,
                }}>
                  <span style={{ fontSize: 12 }}>{cap.icon}</span>
                  <span style={{ fontSize: 11, color: '#6B6880', fontWeight: 500 }}>{cap.text}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Demo conversation */}
        <div style={{
          flex: 1, background: 'white', borderRadius: 20,
          border: '1px solid rgba(45, 43, 61, 0.06)',
          boxShadow: '0 12px 40px rgba(45, 43, 61, 0.06)',
          overflow: 'hidden',
          opacity: interpolate(frame, [60, 80], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
          transform: `translateY(${interpolate(frame, [60, 80], [20, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}px)`,
        }}>
          {/* Chat header */}
          <div style={{
            padding: '14px 20px', borderBottom: '1px solid rgba(45,43,61,0.06)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <AlfredAvatar size={32} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#2D2B3D' }}>Alfred</div>
              <div style={{ fontSize: 10, color: '#A8C5B8', fontWeight: 500 }}>Online</div>
            </div>
            <div style={{
              marginLeft: 'auto', fontSize: 10, color: '#9994AB', fontWeight: 500,
            }}>11:47 PM</div>
          </div>

          {/* Messages */}
          <div style={{ padding: '16px 20px', minHeight: 250 }}>
            {/* Guest message */}
            {frame >= guestMsgStart && (() => {
              const s = spring({ frame: Math.max(0, frame - guestMsgStart), fps, config: { damping: 12, stiffness: 120 } });
              return (
                <div style={{
                  display: 'flex', justifyContent: 'flex-end', marginBottom: 12,
                  opacity: interpolate(s, [0, 1], [0, 1]),
                  transform: `translateY(${interpolate(s, [0, 1], [15, 0])}px)`,
                }}>
                  <div style={{
                    maxWidth: '75%', padding: '10px 16px', borderRadius: '16px 16px 4px 16px',
                    background: '#F5F0EB', color: '#2D2B3D', fontSize: 13, lineHeight: 1.5,
                  }}>{GUEST_MSG}</div>
                </div>
              );
            })()}

            {/* Typing indicator */}
            {frame >= typingStart && frame < alfredReplyStart && (
              <div style={{
                display: 'flex', gap: 5, padding: '10px 16px', width: 'fit-content',
                borderRadius: '16px 16px 16px 4px',
                background: c.secondary,
              }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: c.accent,
                    transform: `translateY(${Math.sin((frame + i * 8) * 0.15) * 3}px)`,
                    opacity: 0.7,
                  }} />
                ))}
              </div>
            )}

            {/* Alfred's reply */}
            {frame >= alfredReplyStart && (() => {
              const s = spring({ frame: Math.max(0, frame - alfredReplyStart), fps, config: { damping: 12, stiffness: 120 } });
              const localFrame = frame - alfredReplyStart;
              const charsToShow = Math.floor(localFrame * 1.2);
              const text = ALFRED_REPLY.slice(0, Math.min(charsToShow, ALFRED_REPLY.length));
              const showCursor = charsToShow < ALFRED_REPLY.length;
              return (
                <div style={{
                  display: 'flex', justifyContent: 'flex-start', marginBottom: 12,
                  opacity: interpolate(s, [0, 1], [0, 1]),
                  transform: `translateY(${interpolate(s, [0, 1], [15, 0])}px)`,
                }}>
                  <div style={{
                    maxWidth: '80%', padding: '10px 16px', borderRadius: '16px 16px 16px 4px',
                    background: `linear-gradient(135deg, ${c.primary}, ${c.secondary})`,
                    color: '#2D2B3D', fontSize: 13, lineHeight: 1.5,
                  }}>{text}{showCursor ? '▌' : ''}</div>
                </div>
              );
            })()}

            {/* Response time badge */}
            {frame >= badgeStart && (() => {
              const s = spring({ frame: Math.max(0, frame - badgeStart), fps, config: { damping: 10, stiffness: 150 } });
              return (
                <div style={{
                  display: 'flex', justifyContent: 'center', marginTop: 12,
                  opacity: interpolate(s, [0, 1], [0, 1]),
                  transform: `scale(${Math.min(s, 1)})`,
                }}>
                  <div style={{
                    padding: '6px 16px', borderRadius: 100,
                    background: 'rgba(168, 197, 184, 0.15)',
                    border: '1px solid rgba(168, 197, 184, 0.3)',
                    color: '#7FA695', fontSize: 11, fontWeight: 600,
                  }}>⚡ Replied in 47 seconds</div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}
