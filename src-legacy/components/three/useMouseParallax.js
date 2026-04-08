import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';

export function useMouseParallax(intensity = 0.3) {
  const mouse = useRef({ x: 0, y: 0 });
  const { camera } = useThree();

  useEffect(() => {
    const onMove = (e) => {
      mouse.current.x = (e.clientX / window.innerWidth - 0.5) * 2;
      mouse.current.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  useFrame(() => {
    camera.position.x += (mouse.current.x * intensity - camera.position.x) * 0.05;
    camera.position.y += (-mouse.current.y * intensity - camera.position.y) * 0.05;
  });
}
