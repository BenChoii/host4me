import { useState, useEffect } from 'react';
import { AlfredAvatar } from './AgentAvatars';

/**
 * Animated Alfred avatar with blinking + breathing.
 * Drop-in replacement for the Bot icon wherever Alfred appears.
 *
 * Usage: <AlfredIcon size={64} />
 */
export default function AlfredIcon({ size = 64, style = {} }) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    let raf;
    let f = 0;
    function tick() {
      f++;
      setFrame(f);
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: size * 0.25,
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      ...style,
    }}>
      <AlfredAvatar size={size} animated frame={frame} />
    </div>
  );
}
