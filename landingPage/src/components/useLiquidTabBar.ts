import { useCallback, useEffect, useRef } from 'react';
import { LiquidTabBar } from 'quick-liquid';

/**
 * Wires a LiquidTabBar to a container of `.lt-item` buttons and keeps the
 * indicator honest:
 *  - re-aligns after webfonts load (initial widths are measured too early)
 *  - re-aligns on resize
 *  - survives React StrictMode double-mount (destroy removes the indicator)
 *
 * The container MUST have a border-radius — the indicator inherits it —
 * and should have no horizontal padding (the indicator's translateX is
 * measured from the container edge).
 */
export function useLiquidTabBar(initialIndex = 0) {
  const containerRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<LiquidTabBar | null>(null);
  const indexRef = useRef(initialIndex);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const items = [...el.querySelectorAll<HTMLElement>('.lt-item')];
    if (items.length === 0) return;

    const bar = new LiquidTabBar(el, items, { spring: 'default' });
    bar.selectImmediate(indexRef.current);
    barRef.current = bar;

    const realign = () => bar.selectImmediate(indexRef.current);
    document.fonts?.ready.then(realign).catch(() => {});
    window.addEventListener('resize', realign);

    return () => {
      window.removeEventListener('resize', realign);
      bar.destroy();
      barRef.current = null;
    };
  }, []);

  const select = useCallback((index: number) => {
    indexRef.current = index;
    barRef.current?.select(index);
  }, []);

  return { containerRef, select };
}
