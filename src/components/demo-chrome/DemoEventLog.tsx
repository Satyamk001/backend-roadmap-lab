import React, { useState, useRef, useEffect } from 'react';
import { Terminal, Filter, Trash2 } from 'lucide-react';
import { Badge, SemanticType } from '../common/Badge';

export interface LogEntry {
  id: string;
  timestamp: number; // or tick
  formattedTime?: string;
  type: SemanticType;
  category: string;
  message: string;
  targetId?: string; // element to highlight on click
  details?: Record<string, unknown> | string;
}

interface DemoEventLogProps {
  logs: LogEntry[];
  onClearLogs?: () => void;
  onSelectEvent?: (entry: LogEntry) => void;
  selectedEventId?: string;
  maxLogs?: number;
}

export const DemoEventLog: React.FC<DemoEventLogProps> = ({
  logs,
  onClearLogs,
  onSelectEvent,
  selectedEventId,
  maxLogs = 80,
}) => {
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new log if already near bottom
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs.length]);

  const categories = Array.from(new Set(logs.map((l) => l.category)));

  const filteredLogs = logs
    .filter((l) => {
      if (filterType !== 'all' && l.category !== filterType) return false;
      if (searchQuery && !l.message.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    })
    .slice(-maxLogs);

  return (
    <div className="flex flex-col h-full bg-theme-surface border border-theme-border rounded-lg shadow-sm overflow-hidden">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-theme-surface-alt border-b border-theme-border text-xs">
        <div className="flex items-center gap-1.5 font-semibold text-theme-text">
          <Terminal className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <span>Event Stream Log</span>
          <span className="font-mono text-theme-muted font-normal">({logs.length})</span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Category Filter */}
          {categories.length > 1 && (
            <div className="flex items-center gap-1">
              <Filter className="w-3 h-3 text-theme-muted" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="bg-theme-surface border border-theme-border text-theme-text rounded px-1.5 py-0.5 text-xs focus:outline-none"
                aria-label="Filter events by category"
              >
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Search */}
          <input
            type="text"
            placeholder="Search logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-24 sm:w-32 px-1.5 py-0.5 text-xs bg-theme-surface border border-theme-border rounded text-theme-text focus:outline-none focus:ring-1 focus:ring-amber-500"
            aria-label="Search logs"
          />

          {onClearLogs && (
            <button
              onClick={onClearLogs}
              title="Clear Event Log"
              className="p-1 text-theme-muted hover:text-red-500 hover:bg-theme-surface rounded transition-colors"
              aria-label="Clear Event Log"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Log Feed */}
      <div
        ref={logContainerRef}
        aria-live="polite"
        className="flex-1 p-2 overflow-y-auto font-mono text-xs space-y-1 max-h-[300px] select-text"
      >
        {filteredLogs.length === 0 ? (
          <div className="p-6 text-center text-theme-muted font-sans text-xs space-y-1.5 select-none">
            <div className="font-semibold text-theme-text">Abhi koi event log nahi hua</div>
            <div className="text-[11.5px] text-theme-muted flex items-center justify-center gap-1.5">
              <span>Upar koi action karein ya</span>
              <kbd className="px-1.5 py-0.5 rounded bg-theme-surface border border-theme-border font-mono text-[10px] text-theme-text font-bold">Space</kbd>
              <span>dabayein</span>
            </div>
          </div>
        ) : (
          filteredLogs.map((entry) => {
            const isSelected = selectedEventId === entry.id;
            return (
              <div
                key={entry.id}
                onClick={() => onSelectEvent?.(entry)}
                className={`flex items-start gap-2 p-1.5 rounded cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-amber-500/20 border border-amber-500/50'
                    : 'hover:bg-theme-surface-alt border border-transparent'
                }`}
                title={entry.targetId ? `Click to highlight ${entry.targetId}` : undefined}
              >
                <span className="text-theme-muted opacity-60 text-[10px] whitespace-nowrap mt-0.5">
                  T:{entry.timestamp}
                </span>

                <Badge type={entry.type} size="sm">
                  {entry.category}
                </Badge>

                <span className="text-theme-text break-words flex-1 leading-relaxed">
                  {entry.message}
                </span>

                {entry.targetId && (
                  <span className="text-[10px] text-theme-accent bg-amber-500/10 px-1 py-0.5 rounded font-mono">
                    #{entry.targetId}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
