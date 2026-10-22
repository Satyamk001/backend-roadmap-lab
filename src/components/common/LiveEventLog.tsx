import React, { useState } from 'react';
import { Terminal, Trash2, Columns2, Rows2, ChevronDown, ChevronUp } from 'lucide-react';

export type LogLayoutMode = 'stacked' | 'side';

export interface LogEntry {
  id: string;
  tick?: number;
  timestamp?: string | number;
  tag?: string;
  type?: 'info' | 'success' | 'warn' | 'warning' | 'error' | 'produce' | 'consume' | 'rebalance';
  message?: string;
  text?: string;
}

export interface LiveEventLogProps {
  entries: LogEntry[];
  onClear?: () => void;
  layout?: LogLayoutMode;
  onLayoutChange?: (mode: LogLayoutMode) => void;
  title?: string;
  maxHeight?: string;
  collapsible?: boolean;
  className?: string;
}

export const LiveEventLog: React.FC<LiveEventLogProps> = ({
  entries,
  onClear,
  layout = 'stacked',
  onLayoutChange,
  title = 'Event Stream Log',
  maxHeight = 'max-h-56',
  collapsible = true,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(true);

  const getTagColor = (type?: string) => {
    switch (type) {
      case 'success':
        return 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10';
      case 'error':
        return 'text-rose-500 border-rose-500/30 bg-rose-500/10';
      case 'warn':
      case 'warning':
      case 'produce':
        return 'text-amber-500 border-amber-500/30 bg-amber-500/10';
      case 'consume':
        return 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10';
      case 'rebalance':
        return 'text-violet-500 border-violet-500/30 bg-violet-500/10';
      default:
        return 'text-theme-muted border-theme-border bg-theme-surface-alt';
    }
  };

  return (
    <div
      role="region"
      aria-label={title}
      className={`rounded-xl border border-theme-border bg-theme-surface shadow-xs transition-all overflow-hidden ${className}`}
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-theme-surface-alt/70 border-b border-theme-border select-none">
        <div className="flex items-center gap-2 min-w-0">
          <Terminal className="w-3.5 h-3.5 text-theme-accent shrink-0" aria-hidden="true" />
          <span className="text-xs font-bold text-theme-text truncate">{title}</span>
          <span className="px-1.5 py-0.2 rounded font-mono text-[10px] font-bold bg-theme-surface border border-theme-border text-theme-muted shrink-0">
            {entries.length}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Layout Switcher buttons */}
          {onLayoutChange && (
            <div className="hidden sm:flex items-center rounded-lg border border-theme-border bg-theme-surface p-0.5 text-theme-muted">
              <button
                type="button"
                onClick={() => onLayoutChange('stacked')}
                className={`p-1 rounded transition-colors ${
                  layout === 'stacked'
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
                onClick={() => onLayoutChange('side')}
                className={`p-1 rounded transition-colors ${
                  layout === 'side'
                    ? 'bg-theme-surface-alt text-theme-text font-bold shadow-2xs'
                    : 'hover:text-theme-text'
                }`}
                title="Split layout (Log on side)"
                aria-label="Split side-by-side layout"
              >
                <Columns2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Clear button */}
          {onClear && entries.length > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="p-1 rounded text-theme-muted hover:text-theme-text hover:bg-theme-surface transition-colors"
              title="Clear event log"
              aria-label="Clear event log"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Collapse/Expand button */}
          {collapsible && (
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className="p-1 rounded text-theme-muted hover:text-theme-text hover:bg-theme-surface transition-colors"
              title={isOpen ? 'Collapse event log' : 'Expand event log'}
              aria-label={isOpen ? 'Collapse event log' : 'Expand event log'}
            >
              {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>

      {/* Log Body */}
      {isOpen && (
        <div
          role="log"
          aria-live="polite"
          className={`p-2.5 font-mono text-[11px] leading-relaxed overflow-y-auto space-y-1 divide-y divide-theme-border/30 bg-theme-surface ${maxHeight}`}
        >
          {entries.length === 0 ? (
            <div className="py-4 text-center text-xs text-theme-muted font-sans italic">
              No events recorded yet. Perform simulation actions to stream events live.
            </div>
          ) : (
            entries.map((entry) => {
              const textContent = entry.message || entry.text || '';
              return (
                <div key={entry.id} className="pt-1 first:pt-0 flex items-start gap-2">
                  {entry.tick !== undefined && (
                    <span className="text-[10px] text-theme-muted font-semibold shrink-0">
                      T+{entry.tick}
                    </span>
                  )}
                  {entry.tag && (
                    <span
                      className={`px-1.5 py-0.2 rounded border text-[9.5px] font-bold shrink-0 ${getTagColor(
                        entry.type
                      )}`}
                    >
                      {entry.tag}
                    </span>
                  )}
                  <span
                    className={`break-words flex-1 ${
                      entry.type === 'error'
                        ? 'text-rose-500'
                        : entry.type === 'warn' || entry.type === 'warning'
                        ? 'text-amber-500'
                        : entry.type === 'success'
                        ? 'text-emerald-500'
                        : 'text-theme-text'
                    }`}
                  >
                    {textContent}
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default LiveEventLog;
