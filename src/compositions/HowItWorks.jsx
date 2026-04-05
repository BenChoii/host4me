import { useCurrentFrame, useVideoConfig, interpolate, spring, AbsoluteFill } from 'remotion';

const STEPS = [
  {
    num: '01',
    title: 'Connect',
    desc: 'Link your Airbnb, Vrbo, or property management account',
    icon: '🔗',
    platforms: ['Airbnb', 'Vrbo', 'iCal', 'Guesty'],
  },
  {
    num: '02',
    title: 'Learn',
    desc: 'Alfred analyzes 100+ past messages to learn your voice',
    icon: '🧠',
    metrics: ['Tone: Friendly', 'Style: Casual', 'Response: Detailed', 'Match: 97.3%'],
  },
  {
    num: '03',
    title: 'Automate',
    desc: 'Alfred replies 24/7 — your voice, your rules, zero effort',
    icon: '⚡',
    stats: ['47s avg reply', '24/7 coverage', '312 msgs/mo'],
  },
];

function ConnectAnimation({ frame, fps, startFrame }) {
  const localFrame = Math.max(0, frame - startFrame);
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 12 }}>
      {STEPS[0].platforms.map((p, i) => {
        const delay = i * 8;
        const s = spring({ frame: Math.max(0, localFrame - delay), fps, config: { damping: 12, stiffness: 150 } });
        const connected = localFrame > delay + 25;
        return (
          <div key={i} style={{
            padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
            fontFamily: "'Inter', sans-serif",
            background: connected ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.06)',
            border: `1px solid ${connected ? 'rgba(74,222,128,0.4)' : 'rgba(255,255,255,0.1)'}`,
            color: connected ? '#4ADE80' : 'rgba(255,255,255,0.5)',
            opacity: interpolate(s, [0, 1], [0, 1]),
            transform: `scale(${Math.min(s, 1)})`,
            transition: 'background 0.3s, border-color 0.3s, color 0.3s',
          }}>
            {connected ? '✓ ' : ''}{p}
          </div>
        );
      })}
    </div>
  );
}

function LearnAnimation({ frame, fps, startFrame }) {
  const localFrame = Math.max(0, frame - startFrame);
  return (
    <div style={{ marginTop: 12 }}>
      {STEPS[1].metrics.map((m, i) => {
        const delay = i * 12;
        const progress = interpolate(localFrame - delay, [0, 30], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        return (
          <div key={i} style={{ marginBottom: 8, opacity: localFrame > delay ? 1 : 0 }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', marginBottom: 4,
              fontSize: 12, fontFamily: "'Inter', sans-serif",
              color: 'rgba(255,255,255,0.7)',
            }}>
              <span>{m.split(':')[0]}</span>
              <span style={{ color: '#C67D3B', fontWeight: 600 }}>{m.split(':')[1]}</span>
            </div>
            <div style={{
              height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', borderRadius: 2, width: `${progress * 100}%`,
                background: 'linear-gradient(90deg, #C67D3B, #D4944F)',
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AutomateAnimation({ frame, fps, startFrame }) {
  const localFrame = Math.max(0, frame - startFrame);
  return (
    <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 12, flexWrap: 'wrap' }}>
      {STEPS[2].stats.map((stat, i) => {
        const delay = i * 10;
        const s = spring({ frame: Math.max(0, localFrame - delay), fps, config: { damping: 14, stiffness: 120 } });
        return (
          <div key={i} style={{
            padding: '10px 16px', borderRadius: 12,
            background: 'rgba(198,125,59,0.12)',
            border: '1px solid rgba(198,125,59,0.25)',
            opacity: interpolate(s, [0, 1], [0, 1]),
            transform: `scale(${Math.min(s, 1)})`,
          }}>
            <div style={{
              fontSize: 16, fontWeight: 700, color: '#C67D3B',
              fontFamily: "'Inter', sans-serif",
            }}>{stat.split(' ')[0]}</div>
            <div style={{
              fontSize: 11, color: 'rgba(255,255,255,0.5)',
              fontFamily: "'Inter', sans-serif",
            }}>{stat.split(' ').slice(1).join(' ')}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function HowItWorks() {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Each step gets a phase
  const stepDuration = Math.floor(durationInFrames / 3);
  const activeStep = Math.min(2, Math.floor(frame / stepDuration));

  // Connector line progress
  const lineProgress = interpolate(frame, [0, durationInFrames * 0.85], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '0 60px', gap: 0,
      background: 'transparent',
    }}>
      {/* Steps row */}
      <div style={{
        display: 'flex', gap: 32, alignItems: 'flex-start', width: '100%', justifyContent: 'center',
        position: 'relative',
      }}>
        {STEPS.map((step, i) => {
          const stepStart = i * stepDuration;
          const s = spring({ frame: Math.max(0, frame - stepStart), fps, config: { damping: 14, stiffness: 100 } });
          const isActive = activeStep >= i;
          const isCurrent = activeStep === i;

          return (
            <div key={i} style={{
              flex: 1, textAlign: 'center',
              opacity: interpolate(s, [0, 1], [0, 1]),
              transform: `translateY(${interpolate(s, [0, 1], [40, 0])}px)`,
            }}>
              {/* Step circle */}
              <div style={{
                width: 64, height: 64, borderRadius: '50%', margin: '0 auto 16px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isActive ? 'linear-gradient(135deg, #C67D3B, #D4944F)' : 'rgba(255,255,255,0.06)',
                border: `2px solid ${isActive ? '#C67D3B' : 'rgba(255,255,255,0.1)'}`,
                fontSize: 28,
                boxShadow: isCurrent ? '0 0 30px rgba(198,125,59,0.4)' : 'none',
                transition: 'box-shadow 0.3s',
              }}>
                {step.icon}
              </div>

              {/* Step number */}
              <div style={{
                fontSize: 12, fontWeight: 700, letterSpacing: '0.1em',
                color: isActive ? '#C67D3B' : 'rgba(255,255,255,0.3)',
                fontFamily: "'Inter', sans-serif",
                marginBottom: 6,
              }}>STEP {step.num}</div>

              {/* Title */}
              <div style={{
                fontSize: 20, fontWeight: 700,
                color: isActive ? '#fff' : 'rgba(255,255,255,0.4)',
                fontFamily: "'Inter', sans-serif",
                marginBottom: 8,
              }}>{step.title}</div>

              {/* Description */}
              <div style={{
                fontSize: 13, lineHeight: 1.5,
                color: isActive ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.3)',
                fontFamily: "'Inter', sans-serif",
                marginBottom: 8,
              }}>{step.desc}</div>

              {/* Step-specific animation */}
              {isCurrent && i === 0 && <ConnectAnimation frame={frame} fps={fps} startFrame={stepStart + 20} />}
              {isCurrent && i === 1 && <LearnAnimation frame={frame} fps={fps} startFrame={stepStart + 20} />}
              {isCurrent && i === 2 && <AutomateAnimation frame={frame} fps={fps} startFrame={stepStart + 20} />}
            </div>
          );
        })}
      </div>

      {/* Progress bar underneath */}
      <div style={{
        width: '70%', height: 3, background: 'rgba(255,255,255,0.06)',
        borderRadius: 2, marginTop: 32, overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', borderRadius: 2,
          width: `${lineProgress * 100}%`,
          background: 'linear-gradient(90deg, #C67D3B, #D4944F)',
        }} />
      </div>
    </AbsoluteFill>
  );
}
