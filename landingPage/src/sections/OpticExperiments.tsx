import { CardGlass } from '../components/CardGlass';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { LiquidGroup } from 'quick-liquid';
import { LiquidSegmented } from 'quick-liquid/react';
import { drawFocusChart, drawLens, makeLens } from './focus-optics';
import { flowBeamY, paintFlowScene } from './flow-scene';
import { useSceneBounds, useSceneDrag, type Point } from '../components/useSceneDrag';

function clampPoint([x, y]: Point, width: number, height: number, inset: number): Point {
  return [
    Math.max(inset, Math.min(width - inset, x)),
    Math.max(inset, Math.min(height - inset, y)),
  ];
}

export function FlowExperiment() {
  const { stage, width, height } = useSceneBounds();
  const backdrop = useRef<HTMLCanvasElement>(null);
  const groupRef = useRef<LiquidGroup | null>(null);
  const first = useRef<HTMLDivElement>(null);
  const second = useRef<HTMLDivElement>(null);
  const [positions, setPositions] = useState<[Point, Point] | null>(null);
  const diameter = Math.min(108, width * 0.29);
  const inset = diameter / 2 + 8;

  function initialPair(): [Point, Point] {
    const gap = width * 0.29;
    const left = width / 2 - gap;
    const right = width / 2 + gap;
    return [
      clampPoint([left, flowBeamY(left / (width || 1)) * height], width, height, inset),
      clampPoint([right, flowBeamY(right / (width || 1)) * height], width, height, inset),
    ];
  }

  const points = positions
    ? [clampPoint(positions[0], width, height, inset), clampPoint(positions[1], width, height, inset)] as const
    : initialPair();

  useEffect(() => {
    const viewport = stage.current;
    if (!viewport || !backdrop.current || !first.current || !second.current) return;
    const group = new LiquidGroup(viewport, {
      backdrop: backdrop.current, blendRadius: 32, mergeDistance: 24, resolution: 1 / Math.min(1.5, window.devicePixelRatio || 1),
      bridgeOpacity: 0.72, bridgeColor: 'rgba(122, 166, 214, 0.19)',
      bridgeRimColor: 'rgba(228, 246, 255, 0.96)', bridgeRimWidth: 1.3,
    });
    groupRef.current = group;
    group.add(first.current);
    group.add(second.current);
    return () => {
      groupRef.current = null;
      group.destroy();
    };
  }, [stage]);

  useEffect(() => {
    if (!backdrop.current || !width || !height) return;
    paintFlowScene(backdrop.current, width, height);
    groupRef.current?.updatePositions();
  }, [width, height]);

  const grip = useSceneDrag((index, point) => {
    setPositions(index === 0 ? [point, points[1]] : [points[0], point]);
  });

  return (
    <section className="experiment glass-pane" id="flow" aria-labelledby="flow-title">
      <CardGlass />
      <div className="experiment__head">
        <h3 id="flow-title">Merging droplets</h3>
      </div>
      <div className="experiment__stage flow-stage" ref={stage}>
        <canvas ref={backdrop} className="flow-stage__scene" aria-hidden />
        {[first, second].map((ref, index) => (
          <div
            key={index} ref={ref} tabIndex={0} role="group"
            aria-label={index === 0 ? 'First droplet' : 'Second droplet'}
            className="experiment__drag flow-drop"
            style={{ left: points[index][0], top: points[index][1], width: diameter, height: diameter, borderRadius: diameter / 2 }}
            {...grip(index, points[index])}
          />
        ))}
      </div>
    </section>
  );
}

const ZOOM_LEVELS = ['1.5', '2', '3'] as const;
const ZOOM_OPTIONS = ZOOM_LEVELS.map(v => ({ value: v, label: `${v}×` }));

export function ZoomExperiment() {
  const { stage, width, height } = useSceneBounds();
  const [position, setPosition] = useState<Point>();
  const [zoomKey, setZoomKey] = useState<(typeof ZOOM_LEVELS)[number]>('2');
  const zoom = Number(zoomKey);
  const chartCanvas = useRef<HTMLCanvasElement>(null);
  const lensCanvas = useRef<HTMLCanvasElement>(null);
  const chart = useRef<ImageData | null>(null);
  const diameter = Math.min(180, width * 0.46);
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const lens = useMemo(() => makeLens(diameter, zoom, pixelRatio), [diameter, zoom, pixelRatio]);
  const point = clampPoint(position ?? [width * 0.12 + 49, height * 0.51 - 7], width, height, diameter / 2 + 7);
  const grip = useSceneDrag((_, updated) => setPosition(updated));

  const [cx, cy] = point;
  useLayoutEffect(() => {
    if (chartCanvas.current && width && height) chart.current = drawFocusChart(chartCanvas.current, width, height);
  }, [width, height]);

  useLayoutEffect(() => {
    if (lensCanvas.current && chart.current && width && height) {
      drawLens(lensCanvas.current, lens, chart.current, width, height, cx, cy);
    }
  }, [lens, width, height, cx, cy]);

  return (
    <section className="experiment glass-pane" id="magnify" aria-labelledby="magnify-title">
      <CardGlass />
      <div className="experiment__head">
        <h3 id="magnify-title">Magnifier</h3>
        <LiquidSegmented
          options={ZOOM_OPTIONS}
          value={zoomKey}
          onChange={setZoomKey}
          glass
          ariaLabel="Magnification"
          className="experiment__zoom"
        />
      </div>
      <div className="experiment__stage focus-stage" ref={stage}>
        <canvas className="focus-chart" ref={chartCanvas} aria-hidden />
        <div className="experiment__drag focus-lens" tabIndex={0} role="group" aria-label="Magnifying lens"
          style={{ left: point[0], top: point[1], width: diameter, height: diameter }}
          {...grip(0, point)}>
          <canvas className="focus-lens__image" ref={lensCanvas} aria-hidden />
        </div>
      </div>
    </section>
  );
}
