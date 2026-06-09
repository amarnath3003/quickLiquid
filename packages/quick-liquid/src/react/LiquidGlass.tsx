import React, { useRef, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
import { LiquidGlassEngine, LiquidGlassConfig } from '../core/engine';

export interface LiquidGlassProps extends React.HTMLAttributes<HTMLDivElement> {
  config?: Partial<LiquidGlassConfig>;
  as?: keyof React.JSX.IntrinsicElements;
  active?: boolean;
  children?: React.ReactNode;
  /** Enable liquid press animation (scale + bounce on press) */
  liquidPress?: boolean | { scale?: number; squish?: number };
  /** Animate in on mount (spring scale-up) */
  animateIn?: boolean | number; // boolean or delay in ms
  /** Jiggle on mount or on change */
  jiggle?: boolean | number; // boolean or intensity
  onPerformanceUpdate?: (metrics: ReturnType<LiquidGlassEngine['getPerformanceMetrics']>) => void;
}

export interface LiquidGlassRef {
  engine: LiquidGlassEngine | null;
  getMetrics: () => ReturnType<LiquidGlassEngine['getPerformanceMetrics']> | null;
  /** Trigger jiggle animation */
  jiggle: (intensity?: number) => void;
  /** Trigger appear animation */
  animateIn: (delay?: number) => void;
  /** Trigger disappear animation */
  animateOut: () => Promise<void>;
}

export const LiquidGlass = forwardRef<LiquidGlassRef, LiquidGlassProps>(
  ({ config = {}, as: Component = 'div', active = true, children, liquidPress, animateIn: animateInProp, jiggle: jiggleProp, onPerformanceUpdate, style, ...props }, ref) => {
    const elementRef = useRef<HTMLDivElement>(null);
    const engineRef = useRef<LiquidGlassEngine | null>(null);
    const mountedRef = useRef(false);
    
    const configStr = useMemo(() => JSON.stringify(config), [config]);
    
    // Main effect: engine lifecycle tied to config changes
    useEffect(() => {
      if (!elementRef.current || !active) {
        engineRef.current?.destroy();
        engineRef.current = null;
        return;
      }
      
      const parsedConfig = JSON.parse(configStr);
      
      if (!engineRef.current) {
        // Create new engine
        engineRef.current = new LiquidGlassEngine(elementRef.current, parsedConfig);
      } else {
        // Update existing engine config (much faster, no DOM remount)
        engineRef.current.updateConfig(parsedConfig);
      }
      
      // Enable liquid press if requested
      if (liquidPress) {
        const pressConfig = typeof liquidPress === 'object' ? liquidPress : undefined;
        engineRef.current.enableLiquidPress(pressConfig);
      }
      
      // Animate in ONLY on first mount — not on config updates
      if (!mountedRef.current) {
        mountedRef.current = true;
        
        if (animateInProp !== false && animateInProp !== undefined) {
          const delay = typeof animateInProp === 'number' ? animateInProp : 0;
          engineRef.current.animateIn(delay);
        }
        
        if (jiggleProp) {
          const intensity = typeof jiggleProp === 'number' ? jiggleProp : 1;
          setTimeout(() => engineRef.current?.jiggle(intensity), 100);
        }
      }
      
      // Performance reporting
      let interval: ReturnType<typeof setInterval> | undefined;
      if (onPerformanceUpdate) {
        interval = setInterval(() => {
          if (engineRef.current) {
            onPerformanceUpdate(engineRef.current.getPerformanceMetrics());
          }
        }, 1000);
      }
      
      return () => {
        if (interval) clearInterval(interval);
        engineRef.current?.destroy();
        engineRef.current = null;
      };
    }, [active, configStr, onPerformanceUpdate]);
    
    useImperativeHandle(ref, () => ({
      engine: engineRef.current,
      getMetrics: () => engineRef.current?.getPerformanceMetrics() ?? null,
      jiggle: (intensity?: number) => engineRef.current?.jiggle(intensity),
      animateIn: (delay?: number) => engineRef.current?.animateIn(delay),
      animateOut: () => engineRef.current?.animateOut() ?? Promise.resolve(),
    }));
    
    return React.createElement(
      Component as string,
      {
        ref: elementRef,
        style,
        ...props,
      },
      // Wrap children in a content layer that sits above ALL effect layers (z:0-6)
      React.createElement('div', {
        style: { position: 'relative', zIndex: 10 },
        className: 'ql-content',
      }, children)
    );
  }
);

LiquidGlass.displayName = 'LiquidGlass';
