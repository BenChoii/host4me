import { Suspense, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Preload } from '@react-three/drei';
import { useDeviceCapability } from './useDeviceCapability';
import SceneController from './SceneController';
import PostProcessing from './PostProcessing';

/** Bridges R3F's invalidate() to the parent DOM world */
function InvalidateBridge({ onReady }) {
  const { invalidate } = useThree();
  useEffect(() => {
    if (onReady) onReady(invalidate);
  }, [invalidate, onReady]);
  return null;
}

export default function SceneCanvas({ scrollProgress, onInvalidateReady }) {
  const canRender3D = useDeviceCapability();

  if (!canRender3D) return null;

  return (
    <Canvas
      className="scene-canvas"
      frameloop="demand"
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 8], fov: 45 }}
      gl={{ antialias: true, alpha: true }}
    >
      <InvalidateBridge onReady={onInvalidateReady} />
      <Suspense fallback={null}>
        <SceneController scrollProgress={scrollProgress} />
        <PostProcessing scrollProgress={scrollProgress} />
        <Preload all />
      </Suspense>
    </Canvas>
  );
}
