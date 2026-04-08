import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { useScroll } from '@react-three/drei';

export default function PostProcessing() {
  const scroll = useScroll();

  // Bloom intensifies in Act 4 (convergence)
  const offset = scroll?.offset ?? 0;
  const bloomIntensity = 0.6 + (offset > 0.75 ? (offset - 0.75) * 4 : 0);

  return (
    <EffectComposer>
      <Bloom
        intensity={bloomIntensity}
        luminanceThreshold={0.5}
        luminanceSmoothing={0.9}
        mipmapBlur
      />
      <Vignette offset={0.25} darkness={0.6} />
    </EffectComposer>
  );
}
