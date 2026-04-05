import { useCurrentFrame, useVideoConfig, interpolate, spring, Sequence, AbsoluteFill } from 'remotion';

const GENERIC_REPLY = 'Thank you for your inquiry. Parking information can be found in the Property Rules document. Best regards, Management.';
const ALFRED_REPLY = "Hey! Yeah, we've got covered parking right out front. Just use the code from your check-in email and you're good. Hit me up if you need anything else!";
const GUEST_MSG = 'Hi, is there parking available?';

function TypewriterText({ text, frame, startFrame, speed = 0.7, style }) {
  const localFrame = frame - startFrame;
  if (localFrame < 0) return null;
  const chars = Math.floor(localFrame * speed);
  const displayText = text.slice(0, Math.min(chars, text.length));
  const showCursor = chars < text.length;
  return <span style={style}>{displayText}{showCursor ? '▌' : ''}</span>;
}

function ChatPanel({ title, isAlfred, guestStart, replyStart, typingStart, frame, fps, label, labelColor }) {
  const panelEntry = spring({ frame, fps, config: { damping: 14, stiffness: 80 } });
  const replyText = isAlfred ? ALFRED_REPLY : GENERIC_REPLY;

  // Timing
  const guestVisible = frame >= guestStart;
  const typingVisible = frame >= typingStart && frame < replyStart;
  const replyVisible = frame >= replyStart;

  const guestSpring = spring({ frame: Math.max(0, frame - guestStart), fps, config: { damping: 12, stiffness: 120 } });
  const replySpring = spring({ frame: Math.max(0, frame - replyStart), fps, config: { damping: 12, stiffness: 120 } });

  return (
    <div style={{
      flex: 1,
      background: isAlfred ? 'rgba(12,18,32,0.95)' : 'rgba(30,30,35,0.9)',
      borderRadius: 20,
      overflow: 'hidden',
      opacity: interpolate(panelEntry, [0, 1], [0, 1]),
      transform: `translateY(${interpolate(panelEntry, [0, 1], [40, 0])}px)`,
      border: isAlfred ? '1px solid rgba(198,125,59,0.3)' : '1px solid rgba(255,255,255,0.08)',
      boxShadow: isAlfred ? '0 20px 60px rgba(198,125,59,0.15)' : '0 20px 60px rgba(0,0,0,0.3)',
    }}>
      {/* Panel header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{
          color: '#fff', fontSize: 14, fontWeight: 600,
          fontFamily: "'Inter', sans-serif",
        }}>{title}</span>
        <span style={{
          padding: '4px 12px', borderRadius: 100, fontSize: 11, fontWeight: 600,
          background: labelColor, color: '#fff',
          fontFamily: "'Inter', sans-serif",
        }}>{label}</span>
      </div>

      {/* Messages */}
      <div style={{ padding: 20, minHeight: 240 }}>
        {/* Guest message */}
        {guestVisible && (
          <div style={{
            display: 'flex', justifyContent: 'flex-end', marginBottom: 14,
            opacity: interpolate(guestSpring, [0, 1], [0, 1]),
            transform: `translateY(${interpolate(guestSpring, [0, 1], [20, 0])}px)`,
          }}>
            <div style={{
              padding: '12px 18px', borderRadius: '16px 16px 4px 16px',
              background: 'rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.9)', fontSize: 14, lineHeight: 1.5,
              fontFamily: "'Inter', sans-serif",
              border: '1px solid rgba(255,255,255,0.06)',
              maxWidth: '85%',
            }}>
              {GUEST_MSG}
            </div>
          </div>
        )}

        {/* Typing indicator */}
        {typingVisible && (
          <div style={{ display: 'flex', gap: 5, padding: '12px 18px', width: 'fit-content',
            borderRadius: '16px 16px 16px 4px',
            background: isAlfred ? 'linear-gradient(135deg, #C67D3B, #D4944F)' : '#555',
          }}>
            {[0,1,2].map(i => (
              <div key={i} style={{
                width: 7, height: 7, borderRadius: '50%',
                background: 'rgba(255,255,255,0.8)',
                transform: `translateY(${Math.sin((frame + i * 8) * 0.15) * 3}px)`,
              }} />
            ))}
          </div>
        )}

        {/* Reply */}
        {replyVisible && (
          <div style={{
            display: 'flex', justifyContent: 'flex-start', marginBottom: 12,
            opacity: interpolate(replySpring, [0, 1], [0, 1]),
            transform: `translateY(${interpolate(replySpring, [0, 1], [20, 0])}px)`,
          }}>
            <div style={{
              padding: '12px 18px', borderRadius: '16px 16px 16px 4px',
              background: isAlfred ? 'linear-gradient(135deg, #C67D3B, #D4944F)' : '#555',
              color: '#fff', fontSize: 14, lineHeight: 1.5,
              fontFamily: "'Inter', sans-serif",
              maxWidth: '85%',
            }}>
              <TypewriterText
                text={replyText}
                frame={frame}
                startFrame={replyStart}
                speed={isAlfred ? 1.2 : 0.5}
              />
            </div>
          </div>
        )}

        {/* Sentiment indicator (appears after reply finishes) */}
        {frame >= replyStart + replyText.length / (isAlfred ? 1.2 : 0.5) + 15 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginTop: 12,
            opacity: interpolate(
              frame - (replyStart + replyText.length / (isAlfred ? 1.2 : 0.5) + 15),
              [0, 15], [0, 1], { extrapolateRight: 'clamp' }
            ),
          }}>
            <span style={{ fontSize: 18 }}>{isAlfred ? '😊' : '😐'}</span>
            <span style={{
              fontSize: 12, color: isAlfred ? '#4ADE80' : '#F59E0B',
              fontFamily: "'Inter', sans-serif", fontWeight: 500,
            }}>
              {isAlfred ? 'Guest feels welcomed' : 'Guest feels ignored'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Comparison() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '0 40px', gap: 24, background: 'transparent',
    }}>
      <ChatPanel
        title="Generic Chatbot"
        isAlfred={false}
        guestStart={10}
        typingStart={50}
        replyStart={90}
        frame={frame}
        fps={fps}
        label="Typical Bot"
        labelColor="rgba(100,100,100,0.6)"
      />
      <ChatPanel
        title="Alfred — Your AI Concierge"
        isAlfred={true}
        guestStart={10}
        typingStart={50}
        replyStart={75}
        frame={frame}
        fps={fps}
        label="Personalized"
        labelColor="rgba(198,125,59,0.8)"
      />
    </AbsoluteFill>
  );
}
