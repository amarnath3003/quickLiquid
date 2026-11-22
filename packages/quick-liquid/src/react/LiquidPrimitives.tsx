import React, {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';
import type { LiquidGlassConfig } from '../core/engine';
import type { SpringConfig, SpringPreset } from '../animations/spring';
import { LiquidTabBar } from '../animations/group';
import {
  LiquidContentSwap,
  LiquidInteractive,
  LiquidMorphModal,
  LiquidSwitch,
  type LiquidInteractiveConfig,
  type LiquidMorphModalConfig,
} from '../animations/interactive';
import { LiquidGlass } from './LiquidGlass';

const BTN_GLASS: Partial<LiquidGlassConfig> = {
  quality: 'medium',
  appearance: 'dark',
  blur: 5,
  refractionStrength: 14,
  bezelWidth: 12,
  thickness: 14,
  tintOpacity: 0.14,
  edgeHighlight: 0.85,
  specularStrength: 0.36,
  elevation: 0,
};

const SWITCH_GLASS: Partial<LiquidGlassConfig> = {
  quality: 'low',
  appearance: 'dark',
  borderRadius: 999,
  blur: 1,
  refractionStrength: 10,
  bezelWidth: 9,
  thickness: 12,
  tintOpacity: 0.12,
  saturation: 1.25,
  edgeHighlight: 0.92,
  specularStrength: 0.48,
  elevation: 0,
};

function mergeRefs<T>(...refs: (React.Ref<T> | undefined)[]): React.RefCallback<T> {
  return (value: T | null) => {
    for (const ref of refs) {
      if (!ref) continue;
      if (typeof ref === 'function') ref(value);
      else (ref as React.MutableRefObject<T | null>).current = value;
    }
  };
}

/* ─────────────────────────── useLiquidInteractive ─────────────────────────── */

export function useLiquidInteractive<T extends HTMLElement = HTMLElement>(
  config?: Partial<LiquidInteractiveConfig> | false,
) {
  const ref = useRef<T | null>(null);
  const ctrlRef = useRef<LiquidInteractive | null>(null);
  const enabled = config !== false;
  const serialized = useMemo(
    () => (enabled ? JSON.stringify(config ?? {}) : ''),
    [enabled, config],
  );

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    const ctrl = new LiquidInteractive(el, JSON.parse(serialized || '{}'));
    ctrlRef.current = ctrl;
    return () => {
      ctrl.destroy();
      ctrlRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  useEffect(() => {
    if (ctrlRef.current && enabled) {
      ctrlRef.current.updateConfig(JSON.parse(serialized || '{}'));
    }
  }, [serialized, enabled]);

  return ref;
}

/* ─────────────────────────── LiquidGlassButton ─────────────────────────── */

type BaseButtonOwnProps = {
  glass?: boolean | Partial<LiquidGlassConfig>;
  interactive?: boolean | Partial<LiquidInteractiveConfig>;
  className?: string;
  children?: ReactNode;
};

export type LiquidGlassButtonProps =
  | (BaseButtonOwnProps & { href: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof BaseButtonOwnProps>)
  | (BaseButtonOwnProps & { href?: undefined } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof BaseButtonOwnProps>);

export const LiquidGlassButton = forwardRef<HTMLElement, LiquidGlassButtonProps>(
  function LiquidGlassButton(
    { glass = false, interactive = true, className = '', children, ...rest },
    forwardedRef,
  ) {
    const interactiveCfg = interactive === false ? false : interactive === true ? {} : interactive;
    const innerRef = useLiquidInteractive<HTMLElement>(interactiveCfg);
    const combinedRef = mergeRefs(innerRef, forwardedRef);

    const glassConfig = useMemo(() => {
      if (!glass) return null;
      return typeof glass === 'object' ? { ...BTN_GLASS, ...glass } : BTN_GLASS;
    }, [glass]);

    const content = glassConfig ? (
      <>
        <span
          className="ql-btn-glass"
          aria-hidden="true"
          style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none' }}
        >
          <LiquidGlass
            className="ql-btn-glass__surface"
            config={{ borderRadius: 12, ...glassConfig }}
            style={{ width: '100%', height: '100%' }}
          />
        </span>
        <span className="ql-btn-label" style={{ position: 'relative', zIndex: 3, display: 'inline-flex', alignItems: 'center', gap: 'inherit' }}>
          {children}
        </span>
      </>
    ) : (
      children
    );

    if ('href' in rest && rest.href !== undefined) {
      const anchorProps = rest as AnchorHTMLAttributes<HTMLAnchorElement>;
      return (
        <a
          ref={combinedRef as React.RefCallback<HTMLAnchorElement>}
          className={`ql-glass-btn${className ? ` ${className}` : ''}`}
          {...anchorProps}
        >
          {content}
        </a>
      );
    }

    const { type = 'button', ...buttonProps } = rest as ButtonHTMLAttributes<HTMLButtonElement>;
    return (
      <button
        ref={combinedRef as React.RefCallback<HTMLButtonElement>}
        type={type}
        className={`ql-glass-btn${className ? ` ${className}` : ''}`}
        {...buttonProps}
      >
        {content}
      </button>
    );
  },
);

/* ─────────────────────────── LiquidSegmented ─────────────────────────── */

export interface LiquidSegmentedOption<T extends string = string> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
}

export interface LiquidSegmentedProps<T extends string = string> {
  options: readonly LiquidSegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  orientation?: 'horizontal' | 'vertical';
  glass?: boolean | Partial<LiquidGlassConfig>;
  spring?: Partial<SpringConfig> | SpringPreset;
  hoverFollower?: boolean;
  stretch?: number;
  ariaLabel: string;
  role?: 'group' | 'tablist';
  className?: string;
}

export function LiquidSegmented<T extends string = string>({
  options,
  value,
  onChange,
  orientation = 'horizontal',
  glass = true,
  spring,
  hoverFollower = false,
  stretch = 0.18,
  ariaLabel,
  role = 'group',
  className = '',
}: LiquidSegmentedProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<LiquidTabBar | null>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const activeIndex = Math.max(0, options.findIndex(opt => opt.value === value));
  const indexRef = useRef(activeIndex);
  indexRef.current = activeIndex;

  const springStr = useMemo(() => (spring !== undefined ? JSON.stringify(spring) : ''), [spring]);
  const glassStr = useMemo(() => JSON.stringify(glass), [glass]);
  const optionKeys = options.map(o => o.value).join('|');

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const items = itemRefs.current.slice(0, options.length).filter((b): b is HTMLButtonElement => b !== null);
    if (items.length === 0) return;

    const bar = new LiquidTabBar(el, items, {
      ...(springStr ? { spring: JSON.parse(springStr) } : {}),
      orientation,
      glass: JSON.parse(glassStr),
      hoverFollower,
      stretch,
    });
    bar.selectImmediate(indexRef.current);
    barRef.current = bar;

    let alive = true;
    document.fonts?.ready.then(() => {
      if (alive) bar.selectImmediate(indexRef.current);
    }).catch(() => {});

    return () => {
      alive = false;
      bar.destroy();
      barRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const items = itemRefs.current.slice(0, options.length).filter((b): b is HTMLButtonElement => b !== null);
    if (items.length > 0) bar.updateItems(items, indexRef.current);
  }, [optionKeys, options.length]);

  useEffect(() => {
    barRef.current?.updateConfig({
      ...(springStr ? { spring: JSON.parse(springStr) } : {}),
      orientation,
      glass: JSON.parse(glassStr),
      hoverFollower,
      stretch,
    });
  }, [springStr, orientation, glassStr, hoverFollower, stretch]);

  useEffect(() => {
    barRef.current?.select(activeIndex);
  }, [activeIndex]);

  const isTablist = role === 'tablist';

  return (
    <div
      ref={containerRef}
      role={role}
      aria-label={ariaLabel}
      aria-orientation={isTablist ? orientation : undefined}
      className={`glass-segments liquid-segmented liquid-segmented--${orientation}${className ? ` ${className}` : ''}`}
    >
      {options.map((opt, idx) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            ref={el => { itemRefs.current[idx] = el; }}
            type="button"
            disabled={opt.disabled}
            role={isTablist ? 'tab' : undefined}
            aria-selected={isTablist ? selected : undefined}
            aria-pressed={!isTablist ? selected : undefined}
            className="liquid-segmented__item"
            onClick={() => {
              if (opt.value !== value) onChange(opt.value);
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/* ─────────────────────────── LiquidToggle ─────────────────────────── */

export interface LiquidToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  spring?: Partial<SpringConfig> | SpringPreset;
  maxStretch?: number;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export function LiquidToggle({
  checked,
  onChange,
  label,
  spring,
  maxStretch = 0.28,
  disabled = false,
  className = '',
  id,
}: LiquidToggleProps) {
  const trackRef = useRef<HTMLSpanElement>(null);
  const thumbRef = useRef<HTMLSpanElement>(null);
  const switchRef = useRef<LiquidSwitch | null>(null);
  const springStr = useMemo(() => (spring ? JSON.stringify(spring) : ''), [spring]);

  useEffect(() => {
    if (!trackRef.current || !thumbRef.current) return;
    const ctrl = new LiquidSwitch(trackRef.current, thumbRef.current, checked, {
      ...(springStr ? { spring: JSON.parse(springStr) } : {}),
      maxStretch,
    });
    switchRef.current = ctrl;
    return () => {
      ctrl.destroy();
      switchRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    switchRef.current?.setChecked(checked);
  }, [checked]);

  useEffect(() => {
    if (!switchRef.current) return;
    switchRef.current.updateConfig({
      ...(springStr ? { spring: JSON.parse(springStr) } : {}),
      maxStretch,
    });
  }, [springStr, maxStretch]);

  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={`liquid-toggle${className ? ` ${className}` : ''}`}
      data-checked={checked}
      onClick={() => onChange(!checked)}
      onPointerDown={() => switchRef.current?.press(true)}
      onPointerUp={() => switchRef.current?.press(false)}
      onPointerLeave={() => switchRef.current?.press(false)}
      onPointerCancel={() => switchRef.current?.press(false)}
    >
      <span className="liquid-toggle__track" ref={trackRef} aria-hidden="true">
        <span className="liquid-toggle__thumb" ref={thumbRef}>
          <LiquidGlass className="liquid-toggle__glass" config={SWITCH_GLASS} />
        </span>
      </span>
    </button>
  );
}

/* ─────────────────────────── useLiquidFlow ─────────────────────────── */

export function useLiquidFlow(config?: Partial<LiquidMorphModalConfig>) {
  const modalRef = useRef<LiquidMorphModal | null>(null);
  const cfgStr = useMemo(() => JSON.stringify(config ?? {}), [config]);

  const ensure = useCallback(() => {
    if (!modalRef.current) {
      modalRef.current = new LiquidMorphModal(JSON.parse(cfgStr || '{}'));
    }
    return modalRef.current;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    modalRef.current?.updateConfig(JSON.parse(cfgStr || '{}'));
  }, [cfgStr]);

  useEffect(() => () => {
    modalRef.current?.destroy();
    modalRef.current = null;
  }, []);

  const openFrom = useCallback(
    (trigger: HTMLElement | null, target: HTMLElement, show?: () => void) =>
      ensure().openFrom(trigger, target, show),
    [ensure],
  );

  const closeTo = useCallback(
    (trigger: HTMLElement | null, target: HTMLElement, hide?: () => void) =>
      ensure().closeTo(trigger, target, hide),
    [ensure],
  );

  const cancel = useCallback(() => {
    modalRef.current?.cancel();
  }, []);

  return { openFrom, closeTo, cancel };
}

/* ─────────────────────────── LiquidSwitcher ─────────────────────────── */

export interface LiquidSwitcherProps {
  activeKey: string | number;
  direction?: -1 | 0 | 1;
  spring?: Partial<SpringConfig> | SpringPreset;
  className?: string;
  children: ReactNode;
}

export function LiquidSwitcher({
  activeKey,
  direction = 1,
  spring,
  className = '',
  children,
}: LiquidSwitcherProps) {
  const ref = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (!ref.current) return;
    return LiquidContentSwap.animateSwap(ref.current, direction, spring);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey]);

  return (
    <div ref={ref} className={`ql-switcher${className ? ` ${className}` : ''}`}>
      {children}
    </div>
  );
}
