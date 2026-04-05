import { useRef, lazy, Suspense } from 'react';
import { useFrame } from '@react-three/fiber';

const HeroScene = lazy(() => import('./HeroScene'));

export default function SceneController({ scrollProgress }) {
  const groupRef = useRef();

  useFrame(() => {
    if (!groupRef.current) return;

    const g = scrollProgress.current.global;

    // Scene visible in first ~25% of page (hero + social proof) and last ~15% (CTA)
    let visibility;
    if (g < 0.15) {
      visibility = 1;
    } else if (g < 0.25) {
      // Fade out during social proof → problem transition
      visibility = 1 - (g - 0.15) / 0.1;
    } else if (g > 0.85) {
      // Fade back in for final CTA
      visibility = (g - 0.85) / 0.15;
    } else {
      visibility = 0;
    }

    groupRef.current.visible = visibility > 0.01;

    // Scale for fade effect (avoids needing material opacity changes)
    if (groupRef.current.visible) {
      const s = 0.6 + visibility * 0.4;
      groupRef.current.scale.set(s, s, s);
    }
  });

  return (
    <group ref={groupRef}>
      <Suspense fallback={null}>
        <HeroScene scrollProgress={scrollProgress} />
      </Suspense>
    </group>
  );
}
