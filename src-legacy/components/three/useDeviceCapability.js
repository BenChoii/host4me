import { useState, useEffect } from 'react';

export function useDeviceCapability() {
  const [canRender3D, setCanRender3D] = useState(false);

  useEffect(() => {
    const webgl = (() => {
      try {
        const c = document.createElement('canvas');
        return !!(c.getContext('webgl2') || c.getContext('webgl'));
      } catch {
        return false;
      }
    })();

    const cores = (navigator.hardwareConcurrency || 2) >= 4;
    const memory = (navigator.deviceMemory || 4) >= 4;
    const noReducedMotion = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const notMobile = window.innerWidth > 768;

    setCanRender3D(webgl && cores && memory && noReducedMotion && notMobile);
  }, []);

  return canRender3D;
}
