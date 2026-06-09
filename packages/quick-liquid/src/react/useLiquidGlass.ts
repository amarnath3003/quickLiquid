/**
 * quick-liquid/react/useLiquidGlass.ts
 * 
 * Hook-based API for applying liquid glass to any ref.
 */

import { useRef, useEffect, useCallback } from 'react';
import { LiquidGlassEngine, LiquidGlassConfig } from '../core/engine';

/**
 * Hook to apply liquid glass effect to any element ref.
 * 
 * Usage:
 * ```tsx
 * function MyComponent() {
 *   const { ref, metrics } = useLiquidGlass({ blur: 20 });
 *   return <div ref={ref}>Glassy content</div>;
 * }
 * ```
 */
export function useLiquidGlass<T extends HTMLElement = HTMLDivElement>(
  config: Partial<LiquidGlassConfig> = {}
) {
  const ref = useRef<T>(null);
  const engineRef = useRef<LiquidGlassEngine | null>(null);
  
  useEffect(() => {
    if (!ref.current) return;
    
    engineRef.current = new LiquidGlassEngine(ref.current, config);
    
    return () => {
      engineRef.current?.destroy();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Config updates
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.updateConfig(config);
    }
  }, [config]);
  
  const getMetrics = useCallback(() => {
    return engineRef.current?.getPerformanceMetrics() ?? null;
  }, []);
  
  return { ref, engine: engineRef, getMetrics };
}
