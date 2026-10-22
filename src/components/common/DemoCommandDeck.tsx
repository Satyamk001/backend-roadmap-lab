import React from 'react';
import { BookOpen, RotateCcw } from 'lucide-react';
import { useNotes } from '../notes/NotesContext';

export interface DemoCommandDeckProps {
  /** Title matching meta.json tab title. Rendered as sr-only to satisfy tests and accessibility without vertical bloat. */
  title: string;
  /** Primary Hinglish narrative: What just happened? */
  statusMessage?: string;
  statusWhat?: string;
  /** Technical rationale: Why it matters */
  whyItMatters?: string;
  statusWhy?: string;
  /** Optional badge label (e.g. 'Easy', 'BullMQ', 'Direct', 'Kafka') */
  badge?: string;
  /** Optional anchor ID inside Notion study notes */
  notesAnchor?: string;
  /** Optional reset handler */
  onReset?: () => void;
  /** Reset button label */
  resetLabel?: string;
  /** Primary action controls row (max 5 buttons) */
  actions?: React.ReactNode;
  /** Optional extra controls placed on the right of the header bar */
  rightControls?: React.ReactNode;
  /** Optional container class */
  className?: string;
}

/**
 * Formats keys, tokens, commands, and numbers in the status narrative with monospace code pills.
 */
function renderLiveNarrative(text: string): React.ReactNode {
  if (!text) return null;
  const regex =
    /(`[^`]+`|'[^']+'|"[^"]+"|\b[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+\b|\b(?:INCRBY|INCR|DECR|HGETALL|HSET|HGET|LPUSH|RPUSH|LPOP|RPOP|SMEMBERS|SISMEMBER|SADD|ZRANGE|ZREVRANGE|ZADD|BGREWRITEAOF|BGSAVE|SAVE|EXPIRE|TTL|RDB|AOF|ACK|NACK|REJECT|PUBLISH|PRODUCE|CONSUME|FETCH)\b|#[0-9]+|\+[0-9]+|\b[0-9]+(?:s|ms|B|KB|MB|%)\b|\b(?:value|score|partition|offset|lag|job|retry)\s+[0-9a-zA-Z_-]+\b|\b[0-9]+\s*→\s*[0-9]+\b)/g;

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
        className="mx-0.5 inline-block rounded border border-theme-border bg-theme-surface px-1.5 py-0.2 font-mono text-[11.5px] sm:text-[12px] font-semibold text-theme-accent shadow-2xs"
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

export interface DemoActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  icon?: React.ReactNode;
}

export const DemoActionButton: React.FC<DemoActionButtonProps> = ({
  variant = 'secondary',
  icon,
  className = '',
  children,
  type = 'button',
  ...props
}) => {
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
      {icon && <span className="inline-flex shrink-0">{icon}</span>}
      {children}
    </button>
  );
};

export const DemoCommandDeck: React.FC<DemoCommandDeckProps> = ({
  title,
  statusMessage,
  statusWhat,
  whyItMatters,
  statusWhy,
  badge,
  notesAnchor,
  onReset,
  resetLabel = 'Reset',
  actions,
  rightControls,
  className = '',
}) => {
  const { openNotes } = useNotes();
  const liveMessage = statusMessage ?? statusWhat ?? '';
  const liveWhy = whyItMatters ?? statusWhy;

  return (
    <div className={`space-y-1.5 text-theme-text ${className}`}>
      {/* Tab title for screen readers and registry tests */}
      <h2 className="sr-only">{title}</h2>

      {/* Unified Compact Command & Status Deck */}
      <div className="rounded-xl border border-theme-border bg-theme-surface p-2.5 sm:p-3 shadow-xs space-y-2">
        {/* Top row: Status narrative + Badges & Controls */}
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
          {/* Status Live Narrative with pulsing emerald dot */}
          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="flex items-center gap-2 min-w-0 flex-1"
          >
            <span className="relative flex h-2 w-2 flex-shrink-0" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <div className="min-w-0 text-[13.5px] sm:text-[14.5px] font-semibold leading-snug text-theme-text truncate">
              {renderLiveNarrative(liveMessage)}
            </div>
          </div>

          {/* Right badges & controls */}
          <div className="flex items-center gap-1.5 flex-shrink-0 self-end sm:self-auto">
            {badge && (
              <span className="inline-flex items-center rounded-md border border-theme-border bg-theme-surface-alt px-1.5 py-0.5 font-mono text-[10.5px] font-bold uppercase tracking-wider text-theme-muted">
                {badge}
              </span>
            )}

            {notesAnchor && (
              <button
                type="button"
                onClick={() => openNotes(notesAnchor)}
                className="inline-flex items-center gap-1 rounded-md border border-theme-border bg-theme-surface px-2 py-0.5 text-[11.5px] sm:text-[12px] font-semibold text-theme-accent transition-all duration-150 hover:bg-theme-surface-alt active:scale-[0.98]"
                title="Open Notion notes snapshot"
              >
                <BookOpen className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
                <span>Notes</span>
              </button>
            )}

            {onReset && (
              <button
                type="button"
                onClick={onReset}
                className="inline-flex items-center gap-1 rounded-md border border-theme-border bg-theme-surface px-2 py-0.5 text-[11.5px] sm:text-[12px] font-medium text-theme-muted hover:text-theme-text hover:bg-theme-surface-alt transition-all active:scale-[0.98]"
                title="Reset simulation"
              >
                <RotateCcw className="h-3 w-3" aria-hidden="true" />
                <span>{resetLabel}</span>
              </button>
            )}

            {rightControls}
          </div>
        </div>

        {/* Sub-line: Why it matters */}
        {liveWhy && (
          <div className="flex items-start gap-1.5 text-[12px] sm:text-[12.5px] leading-tight text-theme-muted border-t border-theme-border/50 pt-1.5">
            <span className="font-mono text-theme-accent select-none font-bold" aria-hidden="true">
              ↳
            </span>
            <div className="min-w-0">{renderLiveNarrative(liveWhy)}</div>
          </div>
        )}

        {/* Primary Action Buttons Bar */}
        {actions && (
          <div
            role="group"
            aria-label="Simulation actions"
            className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-theme-border/50"
          >
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};

export default DemoCommandDeck;
