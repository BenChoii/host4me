import { useCurrentFrame, useVideoConfig, interpolate, spring, AbsoluteFill } from 'remotion';

/* Simulated live feed of Alfred handling messages across platforms */
const MESSAGES = [
  { platform: 'Airbnb', guest: 'Sarah K.', msg: 'What time is check-in?', reply: 'Check-in is at 3 PM! I\'ll send door codes 2 hours before.', time: '2:14 AM' },
  { platform: 'Vrbo', guest: 'Mike R.', msg: 'Is the hot tub working?', reply: 'Yes! It\'s heated to 102°F and ready for you. Towels are in the deck box.', time: '2:31 AM' },
  { platform: 'SMS', guest: 'Jessica L.', msg: 'Can\'t find the lockbox', reply: 'It\'s to the right of the front door, behind the planter. Code: 4821. Here\'s a video walkthrough...', time: '3:07 AM' },
  { platform: 'Email', guest: 'David W.', msg: 'Best restaurants nearby?', reply: 'Top 3 within walking distance: 1) Sushi Mura (8 min) 2) Cactus Club (5 min) 3) Earls (10 min)', time: '3:22 AM' },
  { platform: 'Airbnb', guest: 'Emma T.', msg: 'WiFi password?', reply: 'WiFi: "CozyStay2024" — password: "welcome123". Router is in the living room if you need to restart it!', time: '4:15 AM' },
];

const PLATFORM_COLORS = {
  Airbnb: '#FF5A5F',
  Vrbo: '#3B5FC0',
  SMS: '#4ADE80',
  Email: '#8B5CF6',
};

function MessageCard({ msg, frame, enterFrame, fps, index }) {
  const localFrame = Math.max(0, frame - enterFrame);
  const entrySpring = spring({ frame: localFrame, fps, config: { damping: 14, stiffness: 100 } });

  const opacity = interpolate(entrySpring, [0, 1], [0, 1]);
  const translateX = interpolate(entrySpring, [0, 1], [-60, 0]);
  const scale = interpolate(entrySpring, [0, 1], [0.9, 1]);

  // Reply appears after a beat
  const replyDelay = 25;
  const replyVisible = localFrame > replyDelay;
  const replySpring = spring({ frame: Math.max(0, localFrame - replyDelay), fps, config: { damping: 12, stiffness: 120 } });

  // Resolved checkmark
  const resolvedDelay = replyDelay + 30;
  const resolved = localFrame > resolvedDelay;
  const resolvedSpring = spring({ frame: Math.max(0, localFrame - resolvedDelay), fps, config: { damping: 10, stiffness: 200 } });

  return (
    <div style={{
      opacity,
      transform: `translateX(${translateX}px) scale(${scale})`,
      marginBottom: 14,
      display: 'flex', gap: 14, alignItems: 'flex-start',
    }}>
      {/* Platform badge */}
      <div style={{
        minWidth: 56, padding: '6px 0', textAlign: 'center',
      }}>
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
          color: PLATFORM_COLORS[msg.platform],
          fontFamily: "'Inter', sans-serif",
          textTransform: 'uppercase',
        }}>{msg.platform}</div>
        <div style={{
          fontSize: 10, color: 'rgba(255,255,255,0.3)',
          fontFamily: "'Inter', sans-serif", marginTop: 2,
        }}>{msg.time}</div>
      </div>

      {/* Card */}
      <div style={{
        flex: 1, borderRadius: 14,
        background: 'rgba(255,255,255,0.04)',
        border: `1px solid ${resolved ? 'rgba(74,222,128,0.2)' : 'rgba(255,255,255,0.06)'}`,
        padding: '14px 18px',
        transition: 'border-color 0.3s',
      }}>
        {/* Guest message */}
        <div style={{
          fontSize: 13, color: 'rgba(255,255,255,0.9)',
          fontFamily: "'Inter', sans-serif", marginBottom: replyVisible ? 10 : 0,
        }}>
          <span style={{ fontWeight: 600, color: '#fff' }}>{msg.guest}:</span> {msg.msg}
        </div>

        {/* Alfred's reply */}
        {replyVisible && (
          <div style={{
            opacity: interpolate(replySpring, [0, 1], [0, 1]),
            transform: `translateY(${interpolate(replySpring, [0, 1], [10, 0])}px)`,
            padding: '10px 14px', borderRadius: 10,
            background: 'linear-gradient(135deg, rgba(198,125,59,0.15), rgba(198,125,59,0.08))',
            border: '1px solid rgba(198,125,59,0.2)',
            fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5,
            fontFamily: "'Inter', sans-serif",
          }}>
            <span style={{ color: '#C67D3B', fontWeight: 600, fontSize: 11 }}>Alfred: </span>
            {msg.reply}
          </div>
        )}
      </div>

      {/* Resolved indicator */}
      <div style={{
        minWidth: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: resolved ? interpolate(resolvedSpring, [0, 1], [0, 1]) : 0,
        transform: `scale(${resolved ? Math.min(resolvedSpring, 1) : 0})`,
      }}>
        <div style={{
          width: 24, height: 24, borderRadius: '50%',
          background: 'rgba(74,222,128,0.15)',
          border: '1px solid rgba(74,222,128,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#4ADE80', fontSize: 14,
        }}>✓</div>
      </div>
    </div>
  );
}

export default function AlfredAtWork() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Counter animation
  const handledCount = Math.min(
    MESSAGES.length,
    Math.floor(interpolate(frame, [60, 240], [0, MESSAGES.length], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }))
  );

  // Header entry
  const headerSpring = spring({ frame, fps, config: { damping: 14, stiffness: 80 } });

  return (
    <AbsoluteFill style={{
      display: 'flex', flexDirection: 'column',
      padding: '30px 50px',
      background: 'transparent',
    }}>
      {/* Header bar */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 24, paddingBottom: 16,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        opacity: interpolate(headerSpring, [0, 1], [0, 1]),
        transform: `translateY(${interpolate(headerSpring, [0, 1], [-20, 0])}px)`,
      }}>
        <div>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.12em',
            color: 'rgba(255,255,255,0.4)', fontFamily: "'Inter', sans-serif",
            textTransform: 'uppercase', marginBottom: 4,
          }}>Alfred — Live Feed</div>
          <div style={{
            fontSize: 20, fontWeight: 700, color: '#fff',
            fontFamily: "'Inter', sans-serif",
          }}>While you were sleeping...</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontSize: 32, fontWeight: 800, color: '#C67D3B',
            fontFamily: "'Inter', sans-serif",
          }}>{handledCount}</div>
          <div style={{
            fontSize: 11, color: 'rgba(255,255,255,0.4)',
            fontFamily: "'Inter', sans-serif",
          }}>messages handled</div>
        </div>
      </div>

      {/* Message feed */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {MESSAGES.map((msg, i) => (
          <MessageCard
            key={i}
            msg={msg}
            frame={frame}
            enterFrame={30 + i * 45}
            fps={fps}
            index={i}
          />
        ))}
      </div>

      {/* Bottom status bar */}
      <div style={{
        display: 'flex', gap: 24, justifyContent: 'center', paddingTop: 16,
        borderTop: '1px solid rgba(255,255,255,0.06)',
        opacity: interpolate(frame, [200, 230], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
      }}>
        {[
          { label: 'Avg Response', value: '47s' },
          { label: 'Platforms', value: '4 active' },
          { label: 'Host Status', value: '😴 Sleeping' },
        ].map((s, i) => (
          <div key={i} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#C67D3B', fontFamily: "'Inter', sans-serif" }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: "'Inter', sans-serif" }}>{s.label}</div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
}
