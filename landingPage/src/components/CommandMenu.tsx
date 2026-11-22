import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, Ref } from 'react';
import { LiquidGlass, LiquidGlassButton, useLiquidFlow } from 'quick-liquid/react';
import { ControlIcon } from './GlassControls';

const DIALOG_GLASS = {
  material: 'regular',
  appearance: 'dark',
  quality: 'medium',
  borderRadius: 24,
  thickness: 24,
  bezelWidth: 20,
  refractionStrength: 18,
  blur: 5,
  saturation: 1.15,
  tint: '23, 32, 53',
  tintOpacity: 0.22,
  chromaticAberration: 0.09,
  edgeHighlight: 0.52,
  specularStrength: 0.24,
  elevation: 0,
} as const;

const DESTINATIONS = [
  { href: '/#liquid', title: 'Live material', keywords: 'lens refraction blur dispersion' },
  { href: '/#controls', title: 'Glass controls', keywords: 'button power play pause slider switch checkbox' },
  { href: '/#flow', title: 'Merging droplets', keywords: 'flow metaball spring morph drag drops' },
  { href: '/#magnify', title: 'Magnifier', keywords: 'zoom lens' },
  { href: '/playground/', title: 'Playground', keywords: 'workspace tune scene presets copy settings animations' },
  { href: '/playground/#animations', title: 'Liquid Animations Studio', keywords: 'ripple switch popover modal spring interactive' },
  { href: '/docs/', title: 'API reference', keywords: 'docs configuration React manual' },
  { href: '/#install', title: 'Install QuickLiquid', keywords: 'npm pnpm yarn bun quickstart' },
];

export function CommandMenu() {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const closingRef = useRef(false);
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const { openFrom, closeTo, cancel } = useLiquidFlow({
    mode: 'drop',
    contentSelector: '.command-dialog__content',
    sheen: true,
  });

  const terms = query.toLowerCase().trim().split(/\s+/);
  const results = DESTINATIONS.filter(({ title, keywords }) =>
    terms.every(term => `${title.toLowerCase()} ${keywords}`.includes(term)),
  );

  const open = useCallback(() => {
    const menu = dialog.current;
    if (!menu) return;
    if (menu.open && !closingRef.current) return;
    if (closingRef.current) {
      cancel();
      closingRef.current = false;
    } else {
      returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
    setIsOpen(true);
    void openFrom(triggerRef.current, menu, () => {
      if (!menu.open) menu.showModal();
    });
    search.current?.focus();
  }, [openFrom, cancel]);

  const closeMenu = useCallback((immediate = false) => {
    const menu = dialog.current;
    if (!menu || !menu.open) return;
    if (immediate) {
      cancel();
      closingRef.current = false;
      setIsOpen(false);
      menu.close();
      return;
    }
    if (closingRef.current) return;
    closingRef.current = true;
    void closeTo(null, menu, () => {
      closingRef.current = false;
      setIsOpen(false);
      if (menu.open) menu.close();
    });
  }, [closeTo, cancel]);

  useEffect(() => {
    function onShortcut(event: globalThis.KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k') return;
      event.preventDefault();
      if (dialog.current?.open && !closingRef.current) closeMenu();
      else open();
    }
    window.addEventListener('keydown', onShortcut);
    return () => window.removeEventListener('keydown', onShortcut);
  }, [open, closeMenu]);

  function onListKeys(event: KeyboardEvent<HTMLDialogElement>) {
    const links = Array.from(event.currentTarget.querySelectorAll<HTMLAnchorElement>('.command-result'));
    if (!links.length || (event.target !== search.current && !links.includes(event.target as HTMLAnchorElement))) return;
    const index = links.indexOf(event.target as HTMLAnchorElement);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const next = event.key === 'ArrowDown' ? index + 1 : index < 0 ? links.length - 1 : index - 1;
      if (next < 0) search.current?.focus();
      else links[Math.min(next, links.length - 1)]?.focus();
    }
    if (event.key === 'Enter' && event.target === search.current) {
      event.preventDefault();
      links[0]?.click();
    }
  }

  return (
    <>
      <LiquidGlassButton
        ref={triggerRef as Ref<HTMLElement>}
        className="glass-button site-command"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        title="Search (Ctrl/⌘ + K)"
        aria-label="Search QuickLiquid"
        onClick={open}
      >
        <ControlIcon name="search" />
      </LiquidGlassButton>
      <dialog
        className="command-dialog glass-pane"
        ref={dialog}
        aria-label="Search QuickLiquid"
        onKeyDown={onListKeys}
        onCancel={event => {
          event.preventDefault();
          closeMenu();
        }}
        onClose={() => {
          closingRef.current = false;
          setIsOpen(false);
          setQuery('');
          returnFocus.current?.focus({ preventScroll: true });
        }}
        onClick={event => {
          if (event.target === event.currentTarget) closeMenu();
        }}
      >
        <div className="card-glass" aria-hidden="true">
          <LiquidGlass className="card-glass__surface" active={isOpen} config={DIALOG_GLASS} />
        </div>
        <div className="command-dialog__content">
          <div className="command-dialog__search">
            <ControlIcon name="search" />
            <input
              ref={search}
              type="search"
              aria-label="Find a page or demo"
              placeholder="Find a page or demo"
              value={query}
              onChange={event => setQuery(event.target.value)}
            />
            <LiquidGlassButton
              className="glass-button"
              aria-label="Close search"
              onClick={() => closeMenu()}
            >
              Esc
            </LiquidGlassButton>
          </div>
          <ul className="command-results">
            {results.map(({ href, title }) => (
              <li key={href}>
                <a className="command-result" href={href} onClick={() => closeMenu(true)}>
                  {title}
                </a>
              </li>
            ))}
          </ul>
          {results.length === 0 && <p className="command-dialog__empty" role="status">No matching page or demo</p>}
        </div>
      </dialog>
    </>
  );
}
