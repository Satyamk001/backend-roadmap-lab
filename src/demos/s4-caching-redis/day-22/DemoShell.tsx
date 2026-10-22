import React, { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Code,
  RotateCcw,
  Target,
  Terminal,
} from 'lucide-react';
import { useNotes } from '../../../components/notes/NotesContext';

export type DemoLogType = 'success' | 'error' | 'info';

export interface DemoLogEntry {
  id: string;
  tick: number;
  label: string;
  message: string;
  type?: DemoLogType;
  /** data-highlight-id of the canvas element this log line points at. */
  target?: string;
}

export interface DemoChallenge {
  id: string;
  title: string;
  description: string;
  passed: boolean;
}

export type DemoDifficulty = 'easy' | 'medium' | 'hard';

interface DemoShellProps {
  title: string;
  summary: string;
  difficulty: DemoDifficulty;
  notesAnchor: string;
  whatJustHappened: string;
  whyItMatters: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  logs: DemoLogEntry[];
  challenges: DemoChallenge[];
  stateSnapshot?: unknown;
  onReset?: () => void;
  onPrimaryAction?: () => void;
  resetLabel?: string;
  extraOptions?: React.ReactNode;
  /** Optional min-height so state changes do not move the content below the canvas. */
  canvasClassName?: string;
}

const difficultyLabel: Record<DemoDifficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

const logTypeStyles: Record<DemoLogType, string> = {
  success: 'text-semantic-success',
  error: 'text-semantic-error',
  info: 'text-semantic-info',
};

/**
 * Renders simulation narrative text with terminal-style code pills for Redis keys,
 * commands, values, and quoted/backticked tokens.
 */
function renderLiveNarrative(text: string): React.ReactNode {
  if (!text) return null;
  const regex =
    /(`[^`]+`|'[^']+'|"[^"]+"|\b[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+\b|\b(?:INCRBY|INCR|DECR|HGETALL|HSET|HGET|LPUSH|RPUSH|LPOP|RPOP|SMEMBERS|SISMEMBER|SADD|ZRANGE|ZREVRANGE|ZADD|BGREWRITEAOF|BGSAVE|SAVE|EXPIRE|TTL|RDB|AOF)\b|#[0-9]+|\+[0-9]+|\b[0-9]+(?:s|ms)\b|\b(?:value|score)\s+[0-9]+\b|\b[0-9]+\s*→\s*[0-9]+\b)/g;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const raw = match[0];
    if (raw.startsWith('value ') || raw.startsWith('score ')) {
      const prefix = raw.startsWith('value ') ? 'value ' : 'score ';
      const num = raw.slice(prefix.length);
      parts.push(prefix);
      parts.push(
        <code
          key={match.index}
          className="mx-0.5 inline-block rounded border border-theme-border bg-theme-surface px-1.5 py-0.5 font-mono text-[13px] font-semibold text-theme-accent shadow-2xs"
        >
          {num}
        </code>
      );
    } else {
      const displayToken =
        (raw.startsWith('`') && raw.endsWith('`')) ||
        (raw.startsWith("'") && raw.endsWith("'")) ||
        (raw.startsWith('"') && raw.endsWith('"'))
          ? raw.slice(1, -1)
          : raw;

      parts.push(
        <code
          key={match.index}
          className="mx-0.5 inline-block rounded border border-theme-border bg-theme-surface px-1.5 py-0.5 font-mono text-[13px] font-semibold text-theme-accent shadow-2xs"
        >
          {displayToken}
        </code>
      );
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

export const DemoActionButton: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  }
> = ({ variant = 'secondary', className = '', children, type = 'button', ...props }) => {
  const variantClasses = {
    primary:
      'bg-theme-primary text-theme-primary-text font-semibold hover:brightness-105 active:scale-[0.98] shadow-xs border border-transparent',
    secondary:
      'bg-theme-surface text-theme-text border border-theme-border hover:bg-theme-surface-alt hover:border-theme-border/80 active:scale-[0.98] shadow-2xs font-medium',
    danger:
      'bg-theme-surface text-semantic-error border border-semantic-error/40 hover:bg-semantic-error-bg active:scale-[0.98] font-medium',
    ghost:
      'text-theme-muted hover:text-theme-text hover:bg-theme-surface-alt font-medium',
  }[variant];

  return (
    <button
      type={type}
      className={`inline-flex min-h-[2.35rem] items-center justify-center gap-2 rounded-lg px-3.5 py-1.5 text-[14px] sm:text-[14.5px] transition-all disabled:cursor-not-allowed disabled:opacity-50 select-none ${variantClasses} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export const DemoShell: React.FC<DemoShellProps> = ({
  title,
  summary,
  difficulty,
  notesAnchor,
  whatJustHappened,
  whyItMatters,
  actions,
  children,
  logs,
  challenges,
  stateSnapshot,
  onReset,
  onPrimaryAction,
  resetLabel = 'Reset scenario',
  extraOptions,
  canvasClassName = '',
}) => {
  const { openNotes } = useNotes();
  const rootRef = useRef<HTMLDivElement>(null);
  const [showLog, setShowLog] = useState<boolean>(
    () => typeof window === 'undefined' || window.innerWidth >= 640
  );
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);

  useEffect(() => {
    const onPrimary = () => onPrimaryAction?.();
    const onResetEvent = () => onReset?.();

    window.addEventListener('lab:primary-action', onPrimary);
    window.addEventListener('lab:reset', onResetEvent);
    return () => {
      window.removeEventListener('lab:primary-action', onPrimary);
      window.removeEventListener('lab:reset', onResetEvent);
    };
  }, [onPrimaryAction, onReset]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    root.querySelectorAll<HTMLElement>('[data-highlight-id]').forEach((element) => {
      const isMatch =
        selectedTarget !== null && element.dataset.highlightId === selectedTarget;
      element.classList.toggle('demo-highlight', isMatch);
    });
  }, [selectedTarget, logs]);

  const visibleLogs = logs.slice(0, 100);

  return (
    <div ref={rootRef} className="w-full space-y-3.5 text-theme-text">
      {/* The demo title already lives in the active tab; keep it for screen
          readers without repeating it visually. */}
      <h2 className="sr-only">{title}</h2>

      <header className="flex flex-col gap-2.5 border-b border-theme-border pb-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
          <span className="w-fit rounded-full border border-theme-border bg-theme-surface-alt px-2.5 py-0.5 text-[12.5px] font-semibold text-theme-muted">
            {difficultyLabel[difficulty]}
          </span>
          <p className="min-w-0 flex-1 text-[14.5px] sm:text-[15px] leading-relaxed text-theme-muted">
            {summary}
          </p>
        </div>

        <button
          type="button"
          onClick={() => openNotes(notesAnchor)}
          className="inline-flex min-h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-theme-border bg-theme-surface px-3 py-1.5 text-[13.5px] sm:text-[14px] font-semibold text-theme-accent transition-colors hover:bg-theme-surface-alt sm:w-auto sm:justify-start"
        >
          <BookOpen className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <span>Read this in notes</span>
        </button>
      </header>

      {/* Live State Monitor */}
      <section
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="rounded-xl border border-theme-border bg-theme-surface-alt/40 p-3 sm:p-3.5 shadow-2xs"
      >
        <div className="flex items-center justify-between gap-2 border-b border-theme-border/60 pb-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="font-mono text-[11px] font-bold tracking-wider uppercase text-theme-muted">
              Live State Monitor
            </span>
          </div>
          <span className="font-mono text-[11px] text-theme-muted">
            redis-cli · live
          </span>
        </div>

        <div className="space-y-1">
          <p className="text-[15px] sm:text-[15.5px] font-semibold leading-snug text-theme-text">
            {renderLiveNarrative(whatJustHappened)}
          </p>
          <div className="flex items-start gap-1.5 text-[13.5px] sm:text-[14px] leading-relaxed text-theme-muted">
            <span className="font-mono text-theme-accent select-none font-bold pt-0.5" aria-hidden="true">
              ↳
            </span>
            <div className="min-w-0">{renderLiveNarrative(whyItMatters)}</div>
          </div>
        </div>
      </section>

      {actions && (
        <div
          role="group"
          aria-label="Simulation actions"
          className="flex flex-wrap items-center gap-2 py-0.5"
        >
          {actions}
        </div>
      )}

      <section
        aria-label="Demo canvas"
        className={`rounded-xl border border-theme-border bg-theme-surface p-4 sm:p-5 ${canvasClassName}`}
      >
        {children}
      </section>

      <div className="overflow-hidden rounded-xl border border-theme-border bg-theme-surface">
        <button
          type="button"
          onClick={() => setShowLog((value) => !value)}
          aria-expanded={showLog}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-theme-surface-alt/60"
        >
          <span className="flex items-center gap-2 text-[16px] font-semibold text-theme-text">
            <Terminal className="h-4 w-4 text-theme-muted" aria-hidden="true" />
            <span>Event log</span>
            <span className="rounded-full border border-theme-border bg-theme-surface-alt px-2 py-0.5 font-mono text-[12px] font-normal text-theme-muted">
              {logs.length}
            </span>
          </span>
          <span className="flex items-center gap-1 text-[15px] text-theme-muted">
            <span>{showLog ? 'Hide' : 'Show'}</span>
            {showLog ? (
              <ChevronUp className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            )}
          </span>
        </button>

        {showLog && (
          <div className="border-t border-theme-border">
            <p className="px-4 py-2 text-[15px] text-theme-muted">
              Kisi line par click karo to canvas me uska key highlight hoga.
            </p>
            <ol aria-live="polite" className="max-h-56 overflow-y-auto border-t border-theme-border">
              {visibleLogs.length === 0 ? (
                <li className="px-4 py-4 text-[15px] text-theme-muted">
                  Abhi koi action nahi hua. Upar ka pehla button dabao.
                </li>
              ) : (
                visibleLogs.map((log) => (
                  <li key={log.id} className="border-b border-theme-border/60 last:border-b-0">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedLogId(log.id);
                        setSelectedTarget(log.target ?? null);
                      }}
                      className={`flex w-full items-start gap-3 px-4 py-2 text-left transition-colors ${
                        selectedLogId === log.id
                          ? 'bg-theme-surface-alt/80'
                          : 'hover:bg-theme-surface-alt/40'
                      }`}
                    >
                      <span className="pt-0.5 font-mono text-[12px] text-theme-muted">
                        t{log.tick}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block font-mono text-[13px] font-semibold ${
                            logTypeStyles[log.type ?? 'info']
                          }`}
                        >
                          {log.label}
                        </span>
                        <span className="mt-0.5 block text-[15px] leading-snug text-theme-text">
                          {log.message}
                        </span>
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ol>
          </div>
        )}
      </div>

      <details className="group overflow-hidden rounded-xl border border-theme-border bg-theme-surface">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[16px] font-semibold text-theme-text transition-colors hover:bg-theme-surface-alt/60">
          <span className="flex items-center gap-2">
            <Code className="h-4 w-4 text-theme-muted" aria-hidden="true" />
            <span>More options</span>
          </span>
          <ChevronDown
            className="h-4 w-4 text-theme-muted transition-transform duration-200 group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>

        <div className="space-y-4 border-t border-theme-border p-4">
          {(onReset || extraOptions) && (
            <div className="flex flex-wrap items-center gap-2">
              {onReset && (
                <DemoActionButton variant="secondary" onClick={onReset}>
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  <span>{resetLabel}</span>
                </DemoActionButton>
              )}
              {extraOptions}
            </div>
          )}

          <section aria-labelledby="demo-challenges-heading">
            <h3
              id="demo-challenges-heading"
              className="flex items-center gap-2 text-[16px] font-semibold text-theme-text"
            >
              <Target className="h-4 w-4 text-theme-accent" aria-hidden="true" />
              <span>Challenges</span>
            </h3>
            <ul className="mt-2 space-y-2">
              {challenges.map((challenge) => (
                <li
                  key={challenge.id}
                  className="flex items-start gap-3 rounded-lg border border-theme-border bg-theme-bg p-3"
                >
                  {challenge.passed ? (
                    <CheckCircle2
                      className="mt-0.5 h-4 w-4 flex-shrink-0 text-semantic-success"
                      aria-hidden="true"
                    />
                  ) : (
                    <Circle
                      className="mt-0.5 h-4 w-4 flex-shrink-0 text-theme-muted"
                      aria-hidden="true"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="text-[16px] font-semibold leading-snug text-theme-text">
                      {challenge.title}
                    </p>
                    <p className="mt-0.5 text-[15px] leading-relaxed text-theme-muted">
                      {challenge.description}
                    </p>
                    <p
                      className={`mt-1 text-[13px] font-semibold ${
                        challenge.passed ? 'text-semantic-success' : 'text-theme-muted'
                      }`}
                    >
                      {challenge.passed ? 'Passed' : 'Not yet'}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {stateSnapshot !== undefined && (
            <details className="rounded-lg border border-theme-border bg-theme-bg">
              <summary className="cursor-pointer list-none px-3 py-2 text-[15px] font-semibold text-theme-text">
                State inspector
              </summary>
              <pre className="max-h-64 overflow-auto border-t border-theme-border p-3 font-mono text-[12px] leading-relaxed text-theme-text">
                {JSON.stringify(stateSnapshot, null, 2)}
              </pre>
            </details>
          )}
        </div>
      </details>
    </div>
  );
};
