import { useEffect, useRef, useState } from 'react';
import { LiquidGlass } from 'quick-liquid/react';

const CARD = {
  material: 'regular', appearance: 'dark', quality: 'medium',
  thickness: 24, bezelWidth: 19, refractionStrength: 15, blur: 3,
  saturation: 1.12, tint: '23, 32, 53', tintOpacity: 0.24,
  chromaticAberration: 0.06, edgeHighlight: 0.36, specularStrength: 0.12,
  elevation: 0,
} as const;

/** Keep the optical backing independent of the card's semantic and layout box. */
export function CardGlass() {
  const layer = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [radius, setRadius] = useState(24);
  useEffect(() => {
    const card = layer.current?.parentElement;
    if (!card) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setRadius(parseFloat(getComputedStyle(card).borderTopLeftRadius) || 0);
      setVisible(entry.isIntersecting);
    }, { rootMargin: '220px' });
    observer.observe(card);
    return () => observer.disconnect();
  }, []);
  return (
    <div className="card-glass" ref={layer} aria-hidden="true">
      <LiquidGlass className="card-glass__surface" active={visible} config={{ ...CARD, borderRadius: radius }} />
    </div>
  );
}
