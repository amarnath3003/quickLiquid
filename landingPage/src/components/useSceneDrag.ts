import { useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';

export type Point = [number, number];

const STEPS: Record<string, Point> = {
  ArrowLeft: [-12, 0], ArrowRight: [12, 0], ArrowUp: [0, -12], ArrowDown: [0, 12],
};

export function useSceneBounds() {
  const stage = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const element = stage.current;
    if (!element) return;

    function measure() {
      if (!element) return;
      const width = element.clientWidth;
      const height = element.clientHeight;
      setBounds(previous => previous.width === width && previous.height === height ? previous : { width, height });
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { stage, ...bounds };
}

export function useSceneDrag(move: (index: number, point: Point) => void, onGrab?: () => void) {
  const drag = useRef<{ id: number; start: Point; point: Point } | null>(null);

  return (index: number, point: Point) => ({
    onPointerDown(event: PointerEvent<HTMLDivElement>) {
      if (event.button !== 0 || drag.current) return;
      onGrab?.();
      drag.current = { id: event.pointerId, start: [event.clientX, event.clientY], point };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove(event: PointerEvent<HTMLDivElement>) {
      const current = drag.current;
      if (current?.id !== event.pointerId) return;
      move(index, [
        current.point[0] + event.clientX - current.start[0],
        current.point[1] + event.clientY - current.start[1],
      ]);
    },
    onLostPointerCapture(event: PointerEvent<HTMLDivElement>) {
      if (drag.current?.id === event.pointerId) drag.current = null;
    },
    onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
      if (!Object.prototype.hasOwnProperty.call(STEPS, event.key)) return;
      const [x, y] = STEPS[event.key];
      event.preventDefault();
      move(index, [point[0] + x, point[1] + y]);
    },
  });
}
