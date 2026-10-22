import React, { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Code,
  Columns2,
  RotateCcw,
  Rows2,
  Target,
  Terminal,
} from 'lucide-react';
import { useNotes } from '../../../components/notes/NotesContext';
import { DemoChallenge, EventLogEntry } from '../../../engine/node/types';

export type DemoDifficulty = 'easy' | 'medium' | 'hard';

interface NodeDemoShellProps {
  title: string;
  summary: string;
  difficulty: DemoDifficulty;
  notesAnchor: string;
  whatJustHappened: string;
  whyItMatters: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  logs: EventLogEntry[];
  challenges: DemoChallenge[];
  stateSnapshot?: unknown;
  onReset?: () => void;
  onPrimaryAction?: () => void;
  resetLabel?: string;
  extraOptions?: React.ReactNode;
  canvasClassName?: string;
}

const difficultyLabel: Record<DemoDifficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

const logTypeStyles: Record<string, string> = {
  success: 'text-semantic-success',
  error: 'text-semantic-error',
  warning: 'text-semantic-inflight',
  info: 'text-semantic-info',
};

/**
 * Renders simulation narrative text with terminal-style code pills for JS tokens,
 * methods, phases, and quoted/backticked tokens.
 */
function renderLiveNarrative(text: string): React.ReactNode {
  if (!text) return null;
  const regex =
    /(`[^`]+`|'[^']+'|"[^"]+"|\b(?:process\.nextTick|nextTick|setImmediate|setTimeout|setInterval|fs\.readFile|crypto\.pbkdf2|dns\.lookup|epoll|kqueue|IOCP|libuv|V8|Call Stack|GEC|TDZ|Timers|Pending|Poll|Check|Close|Wave 1|Wave 2)\b|#[0-9]+|\+[0-9]+|\b[0-9]+(?:ms|s)\b|\b(?:value|score)\s+[0-9]+\b|\b[0-9]+\s*→\s*[0-9]+\b)/g;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const raw = match[0];
    const displayToken =
      (raw.startsWith('`') && raw.endsWith('`')) ||
      (raw.startsWith("'") && raw.endsWith("'")) ||
      (raw.startsWith('"') && raw.endsWith('"'))
        ? raw.slice(1, -1)
        : raw;

    parts.push(
      <code
        key={match.index}
        className="mx-0.5 inline-block rounded border border-theme-border bg-theme-surface px-1.5 py-0.5 font-mono text-[12px] font-semibold text-theme-accent shadow-2xs"
      >
        {displayToken}
      </code>
    );
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
      'bg-theme-surface text-theme-text border border-theme-border hover:bg-theme-surface-alt hover:border-theme-border/90 active:scale-[0.98] shadow-2xs font-semibold',
    danger:
      'bg-theme-surface text-semantic-error border border-semantic-error/40 hover:bg-semantic-error-bg active:scale-[0.98] font-semibold',
    ghost:
      'text-theme-muted hover:text-theme-text hover:bg-theme-surface-alt font-medium',
  }[variant];

  return (
    <button
      type={type}
      className={`inline-flex min-h-[2.1rem] sm:min-h-[2.2rem] items-center justify-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-1 text-[13px] sm:text-[13.5px] transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-40 select-none ${variantClasses} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export const NodeDemoShell: React.FC<NodeDemoShellProps> = ({
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
  // Default to collapsed event log on mobile so the canvas starts above the fold
  const [showLog, setShowLog] = useState<boolean>(() =>
    typeof window !== 'undefined' && window.innerWidth >= 1024
  );
  const [layoutMode, setLayoutMode] = useState<'split' | 'stacked'>(() =>
    typeof window !== 'undefined' && window.innerWidth >= 1024 ? 'split' : 'stacked'
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
    <div ref={rootRef} className="w-full space-y-2.5 sm:space-y-3 text-theme-text">
      {/* Accessible header matching test expectations */}
      <h2 className="sr-only">{title}</h2>

      {/* Unified Compact Command & Status Deck */}
      <div className="rounded-xl border border-theme-border bg-theme-surface p-2.5 sm:p-3 shadow-xs space-y-2">
        {/* Top line: Status line + Controls & Badges */}
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between">
          {/* Status Live Narrative with pulsing dot */}
          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="flex items-start gap-2.5 min-w-0 flex-1 pt-0.5"
          >
            <span className="relative flex h-2.5 w-2.5 flex-shrink-0 mt-1" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            <div className="min-w-0 text-[15px] sm:text-[16px] font-semibold leading-snug text-theme-text break-words">
              {renderLiveNarrative(whatJustHappened)}
            </div>
          </div>

          {/* Right badges & controls */}
          <div className="flex items-center gap-1.5 flex-shrink-0 self-end sm:self-auto">
            <span className="inline-flex items-center rounded-md border border-theme-border bg-theme-surface-alt px-2.5 py-0.5 text-[12.5px] sm:text-[13px] font-semibold text-theme-muted">
              {difficultyLabel[difficulty]}
            </span>

            <button
              type="button"
              onClick={() => openNotes(notesAnchor)}
              className="inline-flex items-center gap-1 rounded-md border border-theme-border bg-theme-surface px-2.5 py-0.5 text-[12.5px] sm:text-[13px] font-semibold text-theme-accent transition-all duration-150 hover:bg-theme-surface-alt active:scale-[0.98]"
              title="Open Notion notes snapshot"
            >
              <BookOpen className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
              <span>Notes</span>
            </button>

            {/* Layout Split / Stack switcher */}
            <div className="hidden sm:flex items-center rounded-lg border border-theme-border bg-theme-surface p-0.5 text-theme-muted">
              <button
                type="button"
                onClick={() => setLayoutMode('stacked')}
                className={`p-1 rounded transition-colors ${
                  layoutMode === 'stacked'
                    ? 'bg-theme-surface-alt text-theme-text font-bold shadow-2xs'
                    : 'hover:text-theme-text'
                }`}
                title="Stacked layout (Log at bottom)"
                aria-label="Stacked layout"
              >
                <Rows2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode('split')}
                className={`p-1 rounded transition-colors ${
                  layoutMode === 'split'
                    ? 'bg-theme-surface-alt text-theme-text font-bold shadow-2xs'
                    : 'hover:text-theme-text'
                }`}
                title="Split layout (Log on side)"
                aria-label="Split side-by-side layout"
              >
                <Columns2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Sub-line: Why it matters */}
        {whyItMatters && (
          <div className="flex items-start gap-1.5 text-[14px] sm:text-[15px] leading-snug text-theme-muted border-t border-theme-border/50 pt-1.5">
            <span className="font-mono text-theme-accent select-none font-bold" aria-hidden="true">
              ↳
            </span>
            <div className="min-w-0 break-words">{renderLiveNarrative(whyItMatters)}</div>
          </div>
        )}

        {/* Primary Action Buttons Bar */}
        {actions && (
          <div
            role="group"
            aria-label="Simulation actions"
            className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-theme-border/50"
          >
            {actions}
          </div>
        )}

        {/* Active Demo Goal / Learner Objective */}
        {summary && (
          <div className="text-[13.5px] sm:text-[14px] leading-snug text-theme-muted border-t border-theme-border/40 pt-1.5">
            <span className="font-semibold text-theme-text">Objective: </span>
            <span>{summary}</span>
          </div>
        )}
      </div>

      {/* Main Interactive Stage & Event Log */}
      {layoutMode === 'split' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
          {/* Main Simulation Canvas (8 cols on lg) */}
          <section
            aria-label="Demo canvas"
            className={`lg:col-span-8 rounded-xl border border-theme-border bg-theme-surface p-3.5 sm:p-4 shadow-xs ${canvasClassName}`}
          >
            {children}
          </section>

          {/* Side-by-Side Live Event Log (4 cols on lg) */}
          <aside
            aria-label="Simulation event log"
            className="lg:col-span-4 rounded-xl border border-theme-border bg-theme-surface shadow-xs flex flex-col overflow-hidden max-h-[560px]"
          >
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-theme-border bg-theme-surface-alt/40">
              <div className="flex items-center gap-1.5">
                <Terminal className="h-3.5 w-3.5 text-theme-accent" aria-hidden="true" />
                <span className="text-[13px] font-bold text-theme-text">Event log</span>
                <span className="rounded-full border border-theme-border bg-theme-surface px-1.5 py-0.2 font-mono text-[10.5px] font-semibold text-theme-muted">
                  {logs.length}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="hidden sm:flex items-center rounded-lg border border-theme-border bg-theme-surface p-0.5 text-theme-muted">
                  <button
                    type="button"
                    onClick={() => setLayoutMode('stacked')}
                    className="p-1 rounded transition-colors hover:text-theme-text"
                    title="Stacked layout"
                    aria-label="Stacked layout"
                  >
                    <Rows2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setLayoutMode('split')}
                    className="p-1 rounded transition-colors bg-theme-surface-alt text-theme-text font-bold shadow-2xs"
                    title="Split layout"
                    aria-label="Split layout"
                  >
                    <Columns2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <span className="font-mono text-[10px] text-theme-muted">live</span>
              </div>
            </div>

            <p className="px-2.5 py-1 text-[11px] text-theme-muted border-b border-theme-border/60 bg-theme-surface">
              Click line to highlight in canvas
            </p>

            <ol aria-live="polite" className="flex-1 overflow-y-auto divide-y divide-theme-border/60">
              {visibleLogs.length === 0 ? (
                <li className="px-3 py-6 text-center text-[12.5px] text-theme-muted">
                  Abhi koi action nahi hua. Upar ka button dabao.
                </li>
              ) : (
                visibleLogs.map((log) => (
                  <li key={log.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedLogId(log.id);
                        setSelectedTarget(log.target ?? null);
                      }}
                      className={`flex w-full items-start gap-2 px-2.5 py-1.5 text-left transition-colors ${
                        selectedLogId === log.id
                          ? 'bg-theme-surface-alt font-medium'
                          : 'hover:bg-theme-surface-alt/40'
                      }`}
                    >
                      <span className="pt-0.5 font-mono text-[11px] text-theme-muted flex-shrink-0">
                        t{log.tick}
                      </span>
                      <div className="min-w-0 flex-1">
                        <span
                          className={`inline-block font-mono text-[11.5px] font-semibold ${
                            logTypeStyles[log.type ?? 'info']
                          }`}
                        >
                          {log.label}
                        </span>
                        <span className="block text-[12px] leading-tight text-theme-text truncate">
                          {log.message}
                        </span>
                      </div>
                    </button>
                  </li>
                ))
              )}
            </ol>
          </aside>
        </div>
      ) : (
        /* Stacked Layout Mode */
        <div className="space-y-2.5">
          <section
            aria-label="Demo canvas"
            className={`w-full rounded-xl border border-theme-border bg-theme-surface p-3.5 sm:p-4 shadow-xs ${canvasClassName}`}
          >
            {children}
          </section>

          {/* Collapsible Event Log under Canvas */}
          <div className="overflow-hidden rounded-xl border border-theme-border bg-theme-surface shadow-xs">
            <div className="flex items-center justify-between gap-3 px-3.5 py-2 bg-theme-surface-alt/40 border-b border-theme-border/60">
              <button
                type="button"
                onClick={() => setShowLog((value) => !value)}
                aria-expanded={showLog}
                className="flex items-center gap-2 text-left transition-colors hover:text-theme-accent select-none"
              >
                <Terminal className="h-4 w-4 text-theme-accent" aria-hidden="true" />
                <span className="text-[14px] font-semibold text-theme-text">Event log</span>
                <span className="rounded-full border border-theme-border bg-theme-surface px-1.5 py-0.2 font-mono text-[11px] font-semibold text-theme-muted">
                  {logs.length}
                </span>
                <span className="ml-1 text-[12px] text-theme-muted">
                  ({showLog ? 'Hide' : 'Show'})
                </span>
                {showLog ? (
                  <ChevronUp className="h-3.5 w-3.5 text-theme-muted" aria-hidden="true" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 text-theme-muted" aria-hidden="true" />
                )}
              </button>

              <div className="hidden sm:flex items-center rounded-lg border border-theme-border bg-theme-surface p-0.5 text-theme-muted">
                <button
                  type="button"
                  onClick={() => setLayoutMode('stacked')}
                  className="p-1 rounded transition-colors bg-theme-surface-alt text-theme-text font-bold shadow-2xs"
                  title="Stacked layout (Log at bottom)"
                  aria-label="Stacked layout"
                >
                  <Rows2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setLayoutMode('split')}
                  className="p-1 rounded transition-colors hover:text-theme-text"
                  title="Split layout (Log on side)"
                  aria-label="Split side-by-side layout"
                >
                  <Columns2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {showLog && (
              <div>
                <p className="px-3.5 py-1 text-[11.5px] text-theme-muted border-b border-theme-border/60">
                  Kisi line par click karo to canvas me uska target highlight hoga.
                </p>
                <ol aria-live="polite" className="max-h-48 overflow-y-auto divide-y divide-theme-border/60">
                  {visibleLogs.length === 0 ? (
                    <li className="px-3.5 py-3 text-[13px] text-theme-muted">
                      Abhi koi action nahi hua. Upar ka button dabao.
                    </li>
                  ) : (
                    visibleLogs.map((log) => (
                      <li key={log.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedLogId(log.id);
                            setSelectedTarget(log.target ?? null);
                          }}
                          className={`flex w-full items-start gap-2.5 px-3 py-1.5 text-left transition-colors ${
                            selectedLogId === log.id
                              ? 'bg-theme-surface-alt'
                              : 'hover:bg-theme-surface-alt/40'
                          }`}
                        >
                          <span className="pt-0.5 font-mono text-[11px] text-theme-muted">
                            t{log.tick}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span
                              className={`block font-mono text-[12px] font-semibold ${
                                logTypeStyles[log.type ?? 'info']
                              }`}
                            >
                              {log.label}
                            </span>
                            <span className="block text-[12.5px] leading-snug text-theme-text">
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
        </div>
      )}

      {/* More Options Accordion */}
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
