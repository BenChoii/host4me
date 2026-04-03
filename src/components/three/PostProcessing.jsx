import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';

export default function PostProcessing({ scrollProgress }) {
  const bloomRef = useRef();
  const vignetteRef = useRef();

  useFrame(() => {
    if (!bloomRef.current || !vignetteRef.current) return;

    const g = scrollProgress.current.global;
    const inHero = g < 0.25;
    const inCta = g > 0.85;
    const active = inHero || inCta;

    // Bloom: strong in hero, off in middle, returns at CTA
    if (active) {
      const t = inHero ? 1 - g * 4 : (g - 0.85) / 0.15;
      bloomRef.current.intensity = 1.5 * Math.max(0, t);
    } else {
      bloomRef.current.intensity = 0;
    }

    // Vignette: subtle always, stronger in hero/CTA
    vignetteRef.current.darkness = active ? 0.7 : 0.4;
  });

  return (
    <EffectComposer>
      <Bloom
        ref={bloomRef}
        luminanceThreshold={0.8}
        luminanceSmoothing={0.9}
        intensity={1.5}
        mipmapBlur
      />
      <Vignette ref={vignetteRef} offset={0.3} darkness={0.5} />
    </EffectComposer>
  );
}
