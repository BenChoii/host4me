/*
  Agent Avatar Components

  Friendly, geometric AI agent characters in pastel style.
  Each agent has a distinct silhouette and color identity.
  Designed to feel modern, approachable — like Linear/Notion illustrations.
*/

/* ─── Shared palette for agent avatars ─── */
const AGENT_COLORS = {
  alfred: {
    primary: '#818cf8',    // Indigo light
    secondary: '#e0e7ff',  // Indigo 100
    accent: '#4f46e5',     // Indigo deep
    skin: '#F5E6D3',       // Warm skin
    glow: 'rgba(99, 102, 241, 0.2)',
  },
  comms: {
    primary: '#A3C4E4',    // Sky blue
    secondary: '#D0E4F5',  // Light sky
    accent: '#7BA7CC',     // Deep sky
    skin: '#F0E4D8',
    glow: 'rgba(163, 196, 228, 0.3)',
  },
  escalation: {
    primary: '#E2B0B0',    // Rose
    secondary: '#F5D6D6',  // Light rose
    accent: '#C48888',     // Deep rose
    skin: '#F5E2D6',
    glow: 'rgba(226, 176, 176, 0.3)',
  },
  reporting: {
    primary: '#A8C5B8',    // Sage
    secondary: '#D0E4D9',  // Light sage
    accent: '#7FA695',     // Deep sage
    skin: '#F2E6DA',
    glow: 'rgba(168, 197, 184, 0.3)',
  },
  research: {
    primary: '#F2C4A0',    // Peach
    secondary: '#FAE0CC',  // Light peach
    accent: '#CC9A6E',     // Deep peach
    skin: '#F5E6D3',
    glow: 'rgba(242, 196, 160, 0.3)',
  },
  optimizer: {
    primary: '#B5D8CC',    // Mint
    secondary: '#D6EDE5',  // Light mint
    accent: '#7FB8A6',     // Deep mint
    skin: '#F0E4D8',
    glow: 'rgba(181, 216, 204, 0.3)',
  },
};

/* ─── Alfred — Lead Agent ─── */
export function AlfredAvatar({ size = 80, animated = false, frame = 0 }) {
  const breathe = animated ? Math.sin(frame * 0.06) * 1.5 : 0;
  const blink = animated && (frame % 90 > 85);
  const c = AGENT_COLORS.alfred;

  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      {/* Glow */}
      <circle cx="60" cy="60" r="56" fill={c.glow} />

      {/* Body */}
      <ellipse cx="60" cy="88" rx="28" ry={18 + breathe * 0.3} fill={c.primary} />

      {/* Tie / badge */}
      <path d="M54 76 L60 84 L66 76" stroke={c.accent} strokeWidth="2.5" fill="none" strokeLinecap="round" />

      {/* Head */}
      <circle cx="60" cy="48" r="24" fill={c.skin} />

      {/* Hair */}
      <path d="M36 44 Q38 24 60 22 Q82 24 84 44 Q82 32 60 30 Q38 32 36 44Z" fill={c.accent} />

      {/* Eyes */}
      <ellipse cx="50" cy="48" rx="3.5" ry={blink ? 0.5 : 4} fill={c.accent} />
      <ellipse cx="70" cy="48" rx="3.5" ry={blink ? 0.5 : 4} fill={c.accent} />

      {/* Eye shine */}
      {!blink && <>
        <circle cx="51.5" cy="46" r="1.2" fill="white" />
        <circle cx="71.5" cy="46" r="1.2" fill="white" />
      </>}

      {/* Smile */}
      <path d="M52 56 Q60 62 68 56" stroke={c.accent} strokeWidth="2" fill="none" strokeLinecap="round" />

      {/* Headset */}
      <path d="M36 42 Q34 34 40 28" stroke={c.primary} strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="34" cy="44" r="4" fill={c.primary} />
      <circle cx="34" cy="44" r="2" fill={c.accent} />

      {/* Star badge */}
      <circle cx="80" cy="80" r="10" fill={c.secondary} stroke={c.primary} strokeWidth="1.5" />
      <path d="M80 73 L81.5 77.5 L86 78 L82.5 81 L83.5 85.5 L80 83 L76.5 85.5 L77.5 81 L74 78 L78.5 77.5Z" fill={c.accent} />
    </svg>
  );
}

/* ─── Guest Comms Agent ─── */
export function CommsAvatar({ size = 80, animated = false, frame = 0 }) {
  const breathe = animated ? Math.sin(frame * 0.07) * 1.5 : 0;
  const blink = animated && (frame % 80 > 76);
  const c = AGENT_COLORS.comms;

  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      <circle cx="60" cy="60" r="56" fill={c.glow} />

      {/* Body */}
      <ellipse cx="60" cy="88" rx="26" ry={17 + breathe * 0.3} fill={c.primary} />

      {/* Head */}
      <circle cx="60" cy="48" r="22" fill={c.skin} />

      {/* Hair — short, friendly */}
      <path d="M38 44 Q40 26 60 24 Q80 26 82 44 Q80 34 60 32 Q40 34 38 44Z" fill={c.accent} />

      {/* Eyes — rounder, friendlier */}
      <circle cx="50" cy="48" r={blink ? 0.5 : 3.5} fill={c.accent} />
      <circle cx="70" cy="48" r={blink ? 0.5 : 3.5} fill={c.accent} />

      {!blink && <>
        <circle cx="51" cy="46.5" r="1" fill="white" />
        <circle cx="71" cy="46.5" r="1" fill="white" />
      </>}

      {/* Big smile */}
      <path d="M50 55 Q60 63 70 55" stroke={c.accent} strokeWidth="2" fill="none" strokeLinecap="round" />

      {/* Chat bubble accessory */}
      <g transform="translate(78, 30)">
        <rect x="0" y="0" width="24" height="16" rx="8" fill={c.primary} />
        <path d="M6 14 L2 20 L10 14" fill={c.primary} />
        <circle cx="7" cy="8" r="1.5" fill="white" />
        <circle cx="12" cy="8" r="1.5" fill="white" />
        <circle cx="17" cy="8" r="1.5" fill="white" />
      </g>

      {/* Headset — both ears */}
      <path d="M38 40 Q36 32 42 26" stroke={c.primary} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M82 40 Q84 32 78 26" stroke={c.primary} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <circle cx="36" cy="42" r="3.5" fill={c.primary} />
      <circle cx="84" cy="42" r="3.5" fill={c.primary} />
    </svg>
  );
}

/* ─── Escalation Agent ─── */
export function EscalationAvatar({ size = 80, animated = false, frame = 0 }) {
  const breathe = animated ? Math.sin(frame * 0.065) * 1.5 : 0;
  const blink = animated && (frame % 95 > 90);
  const c = AGENT_COLORS.escalation;

  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      <circle cx="60" cy="60" r="56" fill={c.glow} />

      {/* Body */}
      <ellipse cx="60" cy="88" rx="27" ry={17 + breathe * 0.3} fill={c.primary} />

      {/* Head */}
      <circle cx="60" cy="48" r="23" fill={c.skin} />

      {/* Hair — more structured */}
      <path d="M37 46 Q38 24 60 22 Q82 24 83 46 Q80 32 60 30 Q40 32 37 46Z" fill={c.accent} />

      {/* Eyes — determined, slightly narrowed */}
      <ellipse cx="50" cy="48" rx="3.5" ry={blink ? 0.5 : 3} fill={c.accent} />
      <ellipse cx="70" cy="48" rx="3.5" ry={blink ? 0.5 : 3} fill={c.accent} />

      {!blink && <>
        <circle cx="51" cy="46.5" r="1.2" fill="white" />
        <circle cx="71" cy="46.5" r="1.2" fill="white" />
      </>}

      {/* Focused expression */}
      <path d="M54 56 Q60 60 66 56" stroke={c.accent} strokeWidth="2" fill="none" strokeLinecap="round" />

      {/* Shield badge */}
      <g transform="translate(76, 72)">
        <path d="M12 2 L22 6 L22 14 Q22 22 12 26 Q2 22 2 14 L2 6Z" fill={c.primary} stroke={c.accent} strokeWidth="1.5" />
        <path d="M9 13 L12 16 L17 10" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      {/* Alert indicator */}
      <g transform="translate(18, 28)">
        <circle cx="8" cy="8" r="8" fill={c.secondary} />
        <text x="8" y="12" textAnchor="middle" fontSize="12" fontWeight="700" fill={c.accent}>!</text>
      </g>
    </svg>
  );
}

/* ─── Reporting Agent ─── */
export function ReportingAvatar({ size = 80, animated = false, frame = 0 }) {
  const breathe = animated ? Math.sin(frame * 0.055) * 1.5 : 0;
  const blink = animated && (frame % 100 > 95);
  const c = AGENT_COLORS.reporting;

  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      <circle cx="60" cy="60" r="56" fill={c.glow} />

      {/* Body */}
      <ellipse cx="60" cy="88" rx="26" ry={17 + breathe * 0.3} fill={c.primary} />

      {/* Head */}
      <circle cx="60" cy="48" r="22" fill={c.skin} />

      {/* Hair — neat, analytical */}
      <path d="M38 42 Q40 24 60 22 Q80 24 82 42 Q78 30 60 28 Q42 30 38 42Z" fill={c.accent} />

      {/* Glasses */}
      <circle cx="50" cy="48" r="7" stroke={c.accent} strokeWidth="1.5" fill="none" />
      <circle cx="70" cy="48" r="7" stroke={c.accent} strokeWidth="1.5" fill="none" />
      <line x1="57" y1="48" x2="63" y2="48" stroke={c.accent} strokeWidth="1.5" />

      {/* Eyes behind glasses */}
      <circle cx="50" cy="48" r={blink ? 0.3 : 2.5} fill={c.accent} />
      <circle cx="70" cy="48" r={blink ? 0.3 : 2.5} fill={c.accent} />

      {!blink && <>
        <circle cx="51" cy="47" r="0.8" fill="white" />
        <circle cx="71" cy="47" r="0.8" fill="white" />
      </>}

      {/* Thoughtful smile */}
      <path d="M54 57 Q60 61 66 57" stroke={c.accent} strokeWidth="1.8" fill="none" strokeLinecap="round" />

      {/* Chart accessory */}
      <g transform="translate(76, 30)">
        <rect x="0" y="0" width="26" height="20" rx="4" fill={c.secondary} stroke={c.primary} strokeWidth="1" />
        <rect x="4" y="12" width="4" height="4" fill={c.accent} rx="1" />
        <rect x="10" y="8" width="4" height="8" fill={c.primary} rx="1" />
        <rect x="16" y="4" width="4" height="12" fill={c.accent} rx="1" />
      </g>
    </svg>
  );
}

/* ─── Market Research Agent ─── */
export function ResearchAvatar({ size = 80, animated = false, frame = 0 }) {
  const breathe = animated ? Math.sin(frame * 0.058) * 1.5 : 0;
  const blink = animated && (frame % 85 > 80);
  const c = AGENT_COLORS.research;

  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      <circle cx="60" cy="60" r="56" fill={c.glow} />

      {/* Body */}
      <ellipse cx="60" cy="88" rx="27" ry={17 + breathe * 0.3} fill={c.primary} />

      {/* Head */}
      <circle cx="60" cy="48" r="23" fill={c.skin} />

      {/* Hair — explorer style, slightly messy */}
      <path d="M37 44 Q38 22 60 20 Q82 22 83 44 Q80 28 60 26 Q40 28 37 44Z" fill={c.accent} />
      <path d="M78 30 Q82 26 84 32" stroke={c.accent} strokeWidth="2" fill="none" />

      {/* Eyes — curious, alert */}
      <ellipse cx="50" cy="47" rx="3.5" ry={blink ? 0.5 : 3.5} fill={c.accent} />
      <ellipse cx="70" cy="47" rx="3.5" ry={blink ? 0.5 : 3.5} fill={c.accent} />

      {!blink && <>
        <circle cx="51.5" cy="45.5" r="1.2" fill="white" />
        <circle cx="71.5" cy="45.5" r="1.2" fill="white" />
      </>}

      {/* Interested smile */}
      <path d="M53 56 Q60 61 67 56" stroke={c.accent} strokeWidth="2" fill="none" strokeLinecap="round" />

      {/* Magnifying glass accessory */}
      <g transform="translate(76, 28)">
        <circle cx="10" cy="10" r="9" stroke={c.accent} strokeWidth="2" fill={c.secondary} />
        <circle cx="10" cy="10" r="5" stroke={c.primary} strokeWidth="1.5" fill="none" />
        <line x1="17" y1="17" x2="24" y2="24" stroke={c.accent} strokeWidth="2.5" strokeLinecap="round" />
      </g>

      {/* Trend arrow */}
      <g transform="translate(14, 72)">
        <rect x="0" y="0" width="22" height="16" rx="4" fill={c.secondary} stroke={c.primary} strokeWidth="1" />
        <path d="M4 12 L8 6 L12 9 L18 4" stroke={c.accent} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M15 4 L18 4 L18 7" stroke={c.accent} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

/* ─── Profile Optimizer Agent ─── */
export function OptimizerAvatar({ size = 80, animated = false, frame = 0 }) {
  const breathe = animated ? Math.sin(frame * 0.062) * 1.5 : 0;
  const blink = animated && (frame % 92 > 87);
  const c = AGENT_COLORS.optimizer;

  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      <circle cx="60" cy="60" r="56" fill={c.glow} />

      {/* Body */}
      <ellipse cx="60" cy="88" rx="26" ry={17 + breathe * 0.3} fill={c.primary} />

      {/* Head */}
      <circle cx="60" cy="48" r="22" fill={c.skin} />

      {/* Hair — creative, styled */}
      <path d="M38 43 Q39 23 60 21 Q81 23 82 43 Q79 30 60 28 Q41 30 38 43Z" fill={c.accent} />
      <path d="M42 28 Q38 22 42 20" stroke={c.accent} strokeWidth="2" fill="none" />

      {/* Eyes — creative, warm */}
      <circle cx="50" cy="48" r={blink ? 0.4 : 3.2} fill={c.accent} />
      <circle cx="70" cy="48" r={blink ? 0.4 : 3.2} fill={c.accent} />

      {!blink && <>
        <circle cx="51" cy="46.5" r="1" fill="white" />
        <circle cx="71" cy="46.5" r="1" fill="white" />
      </>}

      {/* Confident smile */}
      <path d="M52 56 Q60 62 68 56" stroke={c.accent} strokeWidth="2" fill="none" strokeLinecap="round" />

      {/* Pencil/edit accessory */}
      <g transform="translate(78, 30)">
        <rect x="2" y="0" width="18" height="22" rx="3" fill={c.secondary} stroke={c.primary} strokeWidth="1" />
        <line x1="6" y1="6" x2="16" y2="6" stroke={c.accent} strokeWidth="1.5" strokeLinecap="round" />
        <line x1="6" y1="10" x2="14" y2="10" stroke={c.primary} strokeWidth="1.5" strokeLinecap="round" />
        <line x1="6" y1="14" x2="12" y2="14" stroke={c.accent} strokeWidth="1" strokeLinecap="round" opacity="0.5" />
      </g>

      {/* Star rating */}
      <g transform="translate(14, 74)">
        <circle cx="12" cy="10" r="12" fill={c.secondary} stroke={c.primary} strokeWidth="1" />
        <path d="M12 4 L13.5 8 L18 8.5 L14.5 11 L15.5 15.5 L12 13 L8.5 15.5 L9.5 11 L6 8.5 L10.5 8Z" fill={c.accent} />
      </g>
    </svg>
  );
}

export { AGENT_COLORS };
