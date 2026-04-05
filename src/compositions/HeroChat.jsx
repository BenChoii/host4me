import { useCurrentFrame, useVideoConfig, interpolate, spring, Sequence, AbsoluteFill } from 'remotion';

const MESSAGES = [
  {
    type: 'guest',
    text: "Hi there! Can you tell me about parking at the property? We'll have 2 cars.",
    time: '11:47 PM',
  },
  {
    type: 'typing',
    duration: 40,
  },
  {
    type: 'alfred',
    text: "Absolutely — we've got dedicated spaces for each guest on the property grounds. They're just around the back by the garden. You'll get access codes in your check-in email. Any other questions?",
    time: '11:47 PM',
  },
  {
    type: 'guest',
    text: 'Perfect, thanks so much!',
    time: '11:48 PM',
  },
];

/* ─── Typing Indicator ─── */
function TypingIndicator({ frame }) {
  return (
    <div style={{
      display: 'flex', gap: 6, alignItems: 'center',
      padding: '14px 20px',
      background: 'linear-gradient(135deg, #C67D3B 0%, #D4944F 100%)',
      borderRadius: '18px 18px 18px 4px',
      width: 'fit-content',
    }}>
      {[0, 1, 2].map(i => {
        const bounce = Math.sin((frame + i * 8) * 0.15) * 4;
        return (
          <div key={i} style={{
            width: 8, height: 8, borderRadius: '50%',
            background: 'rgba(255,255,255,0.85)',
            transform: `translateY(${bounce}px)`,
          }} />
        );
      })}
    </div>
  );
}

/* ─── Single Chat Bubble ─── */
function ChatBubble({ type, text, time, enterFrame, frame, fps }) {
  const isAlfred = type === 'alfred';
  const localFrame = frame - enterFrame;

  const scale = spring({ frame: localFrame, fps, config: { damping: 14, stiffness: 120, mass: 0.8 } });
  const opacity = interpolate(localFrame, [0, 8], [0, 1], { extrapolateRight: 'clamp' });
  const translateY = interpolate(scale, [0, 1], [30, 0]);

  // Typewriter for Alfred's messages
  let displayText = text;
  if (isAlfred && text) {
    const charsToShow = Math.floor(interpolate(localFrame, [0, text.length * 0.6], [0, text.length], { extrapolateRight: 'clamp' }));
    displayText = text.slice(0, charsToShow);
    if (charsToShow < text.length) {
      displayText += '▌';
    }
  }

  return (
    <div style={{
      display: 'flex',
      justifyContent: isAlfred ? 'flex-start' : 'flex-end',
      marginBottom: 12,
      opacity,
      transform: `translateY(${translateY}px) scale(${Math.min(scale, 1)})`,
    }}>
      <div style={{
        maxWidth: '75%',
        padding: '14px 20px',
        borderRadius: isAlfred ? '18px 18px 18px 4px' : '18px 18px 4px 18px',
        background: isAlfred
          ? 'linear-gradient(135deg, #C67D3B 0%, #D4944F 100%)'
          : 'rgba(255,255,255,0.08)',
        color: isAlfred ? '#fff' : 'rgba(255,255,255,0.9)',
        fontSize: 15,
        lineHeight: 1.5,
        fontFamily: "'Inter', -apple-system, sans-serif",
        border: isAlfred ? 'none' : '1px solid rgba(255,255,255,0.1)',
        boxShadow: isAlfred ? '0 4px 20px rgba(198,125,59,0.3)' : 'none',
      }}>
        {displayText}
      </div>
    </div>
  );
}

/* ─── Response Time Badge ─── */
function ResponseBadge({ frame, enterFrame, fps }) {
  const localFrame = frame - enterFrame;
  const scale = spring({ frame: localFrame, fps, config: { damping: 12, stiffness: 100 } });
  const opacity = interpolate(localFrame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <div style={{
      display: 'flex', justifyContent: 'center', marginTop: 16, opacity,
      transform: `scale(${Math.min(scale, 1)})`,
    }}>
      <div style={{
        padding: '8px 20px',
        borderRadius: 100,
        background: 'rgba(198,125,59,0.15)',
        border: '1px solid rgba(198,125,59,0.3)',
        color: '#C67D3B',
        fontSize: 13,
        fontWeight: 600,
        fontFamily: "'Inter', -apple-system, sans-serif",
        letterSpacing: '0.02em',
      }}>
        ⚡ Response time: 47 seconds
      </div>
    </div>
  );
}

/* ─── Main Composition ─── */
export default function HeroChat() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Schedule: guest1 → typing → alfred → guest2 → badge
  const schedule = [
    { startFrame: 15, type: 'guest', idx: 0 },
    { startFrame: 60, type: 'typing' },
    { startFrame: 100, type: 'alfred', idx: 2 },
    { startFrame: 210, type: 'guest', idx: 3 },
    { startFrame: 255, type: 'badge' },
  ];

  // Phone frame appearance
  const phoneScale = spring({ frame, fps, config: { damping: 16, stiffness: 80, mass: 1 } });
  const phoneOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'transparent',
    }}>
      {/* Phone mockup */}
      <div style={{
        width: 420,
        background: 'rgba(12, 18, 32, 0.95)',
        borderRadius: 24,
        border: '1px solid rgba(255,255,255,0.08)',
        overflow: 'hidden',
        opacity: phoneOpacity,
        transform: `scale(${Math.min(phoneScale, 1)})`,
        boxShadow: '0 30px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)',
      }}>
        {/* Chat header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: '50%',
            background: 'linear-gradient(135deg, #C67D3B, #D4944F)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 700, fontSize: 16,
            fontFamily: "'Inter', sans-serif",
          }}>A</div>
          <div>
            <div style={{ color: '#fff', fontWeight: 600, fontSize: 15, fontFamily: "'Inter', sans-serif" }}>Alfred</div>
            <div style={{ color: '#4ADE80', fontSize: 12, fontFamily: "'Inter', sans-serif" }}>Online</div>
          </div>
          {/* Pulse dot */}
          <div style={{
            marginLeft: 'auto',
            width: 10, height: 10, borderRadius: '50%',
            background: '#4ADE80',
            opacity: 0.6 + Math.sin(frame * 0.12) * 0.4,
            boxShadow: '0 0 8px rgba(74,222,128,0.4)',
          }} />
        </div>

        {/* Messages area */}
        <div style={{ padding: '20px 20px 24px', minHeight: 320 }}>
          {schedule.map((item, i) => {
            if (frame < item.startFrame) return null;

            if (item.type === 'typing') {
              // Show typing only until alfred message appears
              const alfredStart = schedule.find(s => s.type === 'alfred')?.startFrame || 999;
              if (frame >= alfredStart) return null;
              return <TypingIndicator key={i} frame={frame} />;
            }

            if (item.type === 'badge') {
              return <ResponseBadge key={i} frame={frame} enterFrame={item.startFrame} fps={fps} />;
            }

            const msg = MESSAGES[item.idx];
            return (
              <ChatBubble
                key={i}
                type={msg.type}
                text={msg.text}
                time={msg.time}
                enterFrame={item.startFrame}
                frame={frame}
                fps={fps}
              />
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
}
