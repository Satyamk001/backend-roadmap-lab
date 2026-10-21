import React from 'react';
import { DemoWhatHappened } from './DemoWhatHappened';
import { DemoEventLog, LogEntry } from './DemoEventLog';
import { DemoStateInspector } from './DemoStateInspector';
import { DemoChallengeMode, Challenge } from './DemoChallengeMode';
import { Badge } from '../common/Badge';

interface DemoContainerProps {
  demoId: string;
  title: string;
  summary: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  notesAnchor?: string;
  notesRefTitle?: string;
  notesUrl?: string;
  whatHappened: string;
  challenges?: Challenge[];
  logs?: LogEntry[];
  onClearLogs?: () => void;
  onSelectEvent?: (entry: LogEntry) => void;
  selectedEventId?: string;
  state?: Record<string, unknown>;
  controls: React.ReactNode;
  children: React.ReactNode;
}

export const DemoContainer: React.FC<DemoContainerProps> = ({
  demoId,
  title,
  summary,
  difficulty = 'medium',
  notesAnchor,
  notesRefTitle,
  notesUrl,
  whatHappened,
  challenges = [],
  logs = [],
  onClearLogs,
  onSelectEvent,
  selectedEventId,
  state,
  controls,
  children,
}) => {
  const difficultyMap = {
    easy: { label: 'Easy', type: 'success' as const },
    medium: { label: 'Medium', type: 'inflight' as const },
    hard: { label: 'Hard', type: 'error' as const },
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-theme-border">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-xl font-bold text-theme-text tracking-tight">{title}</h2>
            <Badge type={difficultyMap[difficulty].type} size="sm">
              {difficultyMap[difficulty].label}
            </Badge>
          </div>
          <p className="text-sm text-theme-muted">{summary}</p>
        </div>
      </div>

      {/* Unified Playback Control Bar */}
      {controls}

      {/* What Just Happened Hinglish Banner */}
      <DemoWhatHappened
        explanation={whatHappened}
        notesAnchor={notesAnchor}
        notesRefTitle={notesRefTitle}
        notesUrl={notesUrl}
      />

      {/* Main Interactive Stage */}
      <div className="bg-theme-surface border border-theme-border rounded-xl p-4 sm:p-6 shadow-sm min-h-[350px]">
        {children}
      </div>

      {/* Bottom Grid: Event Log + Challenges + State Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="flex flex-col gap-4">
          <DemoEventLog
            logs={logs}
            onClearLogs={onClearLogs}
            onSelectEvent={onSelectEvent}
            selectedEventId={selectedEventId}
          />
        </div>

        <div className="flex flex-col gap-4">
          {challenges.length > 0 && (
            <DemoChallengeMode challenges={challenges} demoId={demoId} />
          )}

          {state && <DemoStateInspector state={state} />}
        </div>
      </div>
    </div>
  );
};
