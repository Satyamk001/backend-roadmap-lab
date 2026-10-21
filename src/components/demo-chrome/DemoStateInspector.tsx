import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Copy, Check, Braces } from 'lucide-react';

interface DemoStateInspectorProps {
  state: Record<string, unknown>;
  defaultExpanded?: boolean;
}

export const DemoStateInspector: React.FC<DemoStateInspectorProps> = ({
  state,
  defaultExpanded = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [copied, setCopied] = useState(false);

  const jsonString = JSON.stringify(state, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-theme-surface border border-theme-border rounded-lg shadow-sm overflow-hidden">
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between p-2.5 bg-theme-surface-alt cursor-pointer hover:bg-amber-200/30 dark:hover:bg-stone-800 transition-colors select-none"
      >
        <div className="flex items-center gap-2 text-xs font-semibold text-theme-text">
          <Braces className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <span>State Inspector (Simulation Snapshot)</span>
        </div>

        <div className="flex items-center gap-2">
          {isExpanded && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCopy();
              }}
              className="p-1 text-xs text-theme-muted hover:text-theme-text flex items-center gap-1 rounded bg-theme-surface px-2 border border-theme-border"
              title="Copy JSON State"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-emerald-600" />
                  <span className="text-[10px] text-emerald-600">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span className="text-[10px]">Copy JSON</span>
                </>
              )}
            </button>
          )}

          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-theme-muted" />
          ) : (
            <ChevronRight className="w-4 h-4 text-theme-muted" />
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="p-3 bg-stone-900 text-amber-400/90 font-mono text-xs overflow-x-auto max-h-[300px]">
          <pre>{jsonString}</pre>
        </div>
      )}
    </div>
  );
};
