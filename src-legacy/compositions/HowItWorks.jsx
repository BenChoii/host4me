import { useCurrentFrame, useVideoConfig, interpolate, spring, AbsoluteFill } from 'remotion';
import { AlfredAvatar, CommsAvatar, EscalationAvatar, ReportingAvatar, AGENT_COLORS } from '../components/agents/AgentAvatars';

/*
  How It Works — 3 Steps: Try → Love → Subscribe

  Visual story of the free trial flow:
  1. Start free — 100 actions included
  2. Alfred learns & handles guests
  3. Love it? Upgrade for unlimited
*/

const STEPS = [
  {
    num: '01',
    title: 'Start Free',
    desc: 'Connect your property. Get 100 free actions — no card needed.',
    visual: 'connect',
    color: AGENT_COLORS.comms,
  },
  {
    num: '02',
    title: 'Watch Alfred Work',
    desc: 'Alfred learns your voice and handles guests in real-time.',
    visual: 'learn',
    color: AGENT_COLORS.alfred,
  },
  {
    num: '03',
    title: 'Love It? Upgrade',
    desc: 'Unlock unlimited actions and the full agent team.',
    visual: 'upgrade',
    color: AGENT_COLORS.reporting,
  },
];

function ConnectVisual({ frame, fps, startFrame }) {
  const localFrame = Math.max(0, frame - startFrame);
  const platforms = ['Airbnb', 'Vrbo', 'iCal'];
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {platforms.map((p, i) => {
        const delay = i * 10;
        const s = spring({ frame: Math.max(0, localFrame - delay), fps, config: { damping: 12, stiffness: 140 } });
        const connected = localFrame > delay + 20;
        return (
          <div key={i} style={{
            padding: '6px 12px', borderRadius: 8, fontSize: 10, fontWeight: 600,
            background: connected ? 'rgba(168,197,184,0.15)' : 'rgba(45,43,61,0.04)',
            border: `1px solid ${connected ? 'rgba(168,197,184,0.3)' : 'rgba(45,43,61,0.08)'}`,
            color: connected ? '#7FA695' : '#9994AB',
            opacity: interpolate(s, [0, 1], [0, 1]),
            transform: `scale(${Math.min(s, 1)})`,
          }}>{connected ? '✓ ' : ''}{p}</div>
        );
      })}
    </div>
  );
}

function LearnVisual({ frame, fps, startFrame }) {
  const localFrame = Math.max(0, frame - startFrame);
  const metrics = [
    { label: 'Voice Match', value: '97%', color: AGENT_COLORS.alfred.primary },
    { label: 'Actions Used', value: '23/100', color: AGENT_COLORS.comms.primary },
  ];
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {metrics.map((m, i) => {
        const delay = i * 12;
        const s = spring({ frame: Math.max(0, localFrame - delay), fps, config: { damping: 12, stiffness: 120 } });
        return (
          <div key={i} style={{
            padding: '8px 12px', borderRadius: 10,
            background: `${m.color}15`, border: `1px solid ${m.color}30`,
            opacity: interpolate(s, [0, 1], [0, 1]),
            transform: `translateY(${interpolate(s, [0, 1], [10, 0])}px)`,
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#2D2B3D' }}>{m.value}</div>
            <div style={{ fontSize: 9, color: '#9994AB' }}>{m.label}</div>
          </div>
        );
      })}
    </div>
  );
}

function UpgradeVisual({ frame, fps, startFrame }) {
  const localFrame = Math.max(0, frame - startFrame);
  const s = spring({ frame: localFrame, fps, config: { damping: 14, stiffness: 100 } });
  return (
    <div style={{
      display: 'flex', gap: 6, alignItems: 'center',
      opacity: interpolate(s, [0, 1], [0, 1]),
      transform: `scale(${Math.min(s, 1)})`,
    }}>
      <AlfredAvatar size={24} />
      <CommsAvatar size={24} />
      <EscalationAvatar size={24} />
      <ReportingAvatar size={24} />
      <span style={{ fontSize: 10, color: '#7FA695', fontWeight: 600, marginLeft: 4 }}>Full team unlocked</span>
    </div>
  );
}

export default function HowItWorks() {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const stepDuration = Math.floor(durationInFrames / 3);
  const activeStep = Math.min(2, Math.floor(frame / stepDuration));

  return (
    <AbsoluteFill style={{
      background: 'linear-gradient(160deg, #FAF8F5 0%, #F0EBF5 50%, #EDF2F7 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '0 40px', gap: 24,
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      {STEPS.map((step, i) => {
        const stepStart = i * stepDuration;
        const s = spring({ frame: Math.max(0, frame - stepStart), fps, config: { damping: 14, stiffness: 90 } });
        const isActive = activeStep >= i;
        const isCurrent = activeStep === i;

        return (
          <div key={i} style={{
            flex: 1, textAlign: 'center',
            background: 'white',
            borderRadius: 20, padding: '28px 20px',
            border: `1.5px solid ${isCurrent ? step.color.primary + '40' : 'rgba(45,43,61,0.06)'}`,
            boxShadow: isCurrent ? `0 8px 30px ${step.color.primary}15` : '0 4px 12px rgba(45,43,61,0.03)',
            opacity: interpolate(s, [0, 1], [0.4, 1]),
            transform: `translateY(${interpolate(s, [0, 1], [20, isCurrent ? -4 : 0])}px) scale(${isCurrent ? 1.02 : 1})`,
            transition: 'border-color 0.3s, box-shadow 0.3s',
          }}>
            {/* Step number */}
            <div style={{
              width: 36, height: 36, borderRadius: '50%', margin: '0 auto 14px',
              background: isActive ? step.color.primary : 'rgba(45,43,61,0.04)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700,
              color: isActive ? 'white' : '#9994AB',
            }}>{step.num}</div>

            <div style={{
              fontSize: 16, fontWeight: 700, color: '#2D2B3D', marginBottom: 6,
            }}>{step.title}</div>
            <div style={{
              fontSize: 11, color: '#9994AB', lineHeight: 1.5, marginBottom: 14,
            }}>{step.desc}</div>

            {/* Step-specific visual */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              {isCurrent && i === 0 && <ConnectVisual frame={frame} fps={fps} startFrame={stepStart + 15} />}
              {isCurrent && i === 1 && <LearnVisual frame={frame} fps={fps} startFrame={stepStart + 15} />}
              {isCurrent && i === 2 && <UpgradeVisual frame={frame} fps={fps} startFrame={stepStart + 15} />}
            </div>
          </div>
        );
      })}

      {/* Progress dots */}
      <div style={{
        position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', gap: 8,
      }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: activeStep === i ? 20 : 8, height: 8, borderRadius: 100,
            background: activeStep >= i ? STEPS[i].color.primary : 'rgba(45,43,61,0.1)',
            transition: 'width 0.3s, background 0.3s',
          }} />
        ))}
      </div>
    </AbsoluteFill>
  );
}
