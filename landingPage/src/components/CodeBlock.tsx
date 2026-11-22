import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useLiquidInteractive } from 'quick-liquid/react';

/** One-pass tokenizer to React spans. Good enough for our fixed snippets. */
const JS_TOKEN =
  /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|('(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`)|\b(import|from|export|default|const|let|var|function|return|new|await|async|interface|type|extends|implements|class|if|else|for|of|in|true|false|null|undefined)\b|(\b\d+(?:\.\d+)?\b)/g;

const BASH_TOKEN = /(#[^\n]*)|('(?:[^'\\\n])*'|"(?:\\.|[^"\\\n])*")|(^\$\s)/gm;

function highlight(code: string, lang: 'ts' | 'tsx' | 'bash'): ReactNode[] {
  const pattern = lang === 'bash' ? BASH_TOKEN : JS_TOKEN;
  pattern.lastIndex = 0;
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = pattern.exec(code)) !== null) {
    if (m.index > last) out.push(code.slice(last, m.index));
    const cls = m[1] ? 'tok-comment' : m[2] ? 'tok-string' : m[3] ? 'tok-keyword' : 'tok-number';
    out.push(
      <span key={i++} className={cls}>
        {m[0]}
      </span>,
    );
    last = m.index + m[0].length;
  }
  if (last < code.length) out.push(code.slice(last));
  return out;
}

export interface CodeBlockProps {
  code: string;
  lang?: 'ts' | 'tsx' | 'bash';
  title?: string;
  compact?: boolean;
}

async function copyText(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Allow the selection-based fallback if clipboard access is denied.
  }

  const previous = document.activeElement;
  const selection = document.createElement('textarea');
  selection.value = text;
  selection.readOnly = true;
  selection.style.cssText = 'position:fixed; opacity:0; top:0; left:0';
  document.body.append(selection);
  selection.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    selection.remove();
    if (previous instanceof HTMLElement) previous.focus({ preventScroll: true });
  }
}

export function CopyButton({ text, className, label = 'Copy code' }: { text: string; className?: string; label?: string }) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const interactiveRef = useLiquidInteractive<HTMLButtonElement>({
    pressScale: 0.94,
    pressSquish: 0.04,
    hoverLift: 2,
    hoverScale: 1.025,
    ripple: true,
  });

  useEffect(() => {
    if (status === 'idle') return;
    const timer = window.setTimeout(() => setStatus('idle'), status === 'copied' ? 1600 : 4500);
    return () => window.clearTimeout(timer);
  }, [status]);

  return (
    <>
      <button ref={interactiveRef} className={className} type="button" aria-label={label} onClick={async () => {
        setStatus(await copyText(text) ? 'copied' : 'failed');
      }}>
        {status === 'copied' ? 'Copied' : status === 'failed' ? 'Copy failed' : 'Copy'}
      </button>
      <span className="site-sr" role="status">
        {status === 'copied' && 'Copied to clipboard'}
        {status === 'failed' && 'Clipboard access failed. Select the text to copy it manually.'}
      </span>
    </>
  );
}

export function CodeBlock({ code, lang = 'ts', title, compact }: CodeBlockProps) {
  return (
    <div className={`code-block${compact ? ' code-block--compact' : ''}`}>
      <div className="code-block__bar">
        <span className="code-block__dots" aria-hidden>
          <i /> <i /> <i />
        </span>
        <span className="code-block__title">{title ?? lang}</span>
        <CopyButton className="code-block__copy" text={code} />
      </div>
      <pre className="code-block__pre">
        <code>{highlight(code, lang)}</code>
      </pre>
    </div>
  );
}
