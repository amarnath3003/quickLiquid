import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';

/** One-pass tokenizer → React spans (no innerHTML). Good enough for our fixed snippets. */
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

export function useCopy(): [boolean, (text: string) => void] {
  const [copied, setCopied] = useState(false);
  const copy = useCallback((text: string) => {
    const done = () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(done);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      done();
    }
  }, []);
  return [copied, copy];
}

export function CodeBlock({ code, lang = 'ts', title, compact }: CodeBlockProps) {
  const [copied, copy] = useCopy();
  return (
    <div className={`code-block${compact ? ' code-block--compact' : ''}`}>
      <div className="code-block__bar">
        <span className="code-block__dots" aria-hidden>
          <i /> <i /> <i />
        </span>
        <span className="code-block__title">{title ?? lang}</span>
        <button className="code-block__copy" onClick={() => copy(code)} type="button">
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      <pre className="code-block__pre">
        <code>{highlight(code, lang)}</code>
      </pre>
    </div>
  );
}
