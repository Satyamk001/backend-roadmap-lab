import React from 'react';
import { Sparkles, BookOpen } from 'lucide-react';

interface DemoWhatHappenedProps {
  explanation: string;
  notesAnchor?: string;
  notesRefTitle?: string;
  notesUrl?: string;
}

export const DemoWhatHappened: React.FC<DemoWhatHappenedProps> = ({
  explanation,
  notesAnchor,
  notesRefTitle,
  notesUrl,
}) => {
  return (
    <div className="relative overflow-hidden p-3.5 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 rounded-lg">
      <div className="flex items-start gap-2.5">
        <div className="p-1.5 bg-amber-500/20 text-amber-700 dark:text-amber-400 rounded-md flex-shrink-0 mt-0.5">
          <Sparkles className="w-4 h-4" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-xs font-semibold tracking-wider uppercase text-amber-800 dark:text-amber-400 font-mono">
              Abhi kya hua? (What just happened?)
            </span>

            {notesRefTitle && (
              <div className="flex items-center gap-1 text-xs text-theme-muted">
                <BookOpen className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                {notesUrl ? (
                  <a
                    href={notesAnchor ? `${notesUrl}#${notesAnchor}` : notesUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:underline text-theme-accent font-medium truncate max-w-[200px]"
                    title={`Open Notion notes: ${notesRefTitle}`}
                  >
                    Notes ref: {notesRefTitle}
                  </a>
                ) : (
                  <span className="font-medium truncate max-w-[200px]">Notes ref: {notesRefTitle}</span>
                )}
              </div>
            )}
          </div>

          <p className="text-sm font-medium text-theme-text leading-relaxed">
            {explanation || 'Koi action trigger karein ya "Play" dabayein to see simulation in action.'}
          </p>
        </div>
      </div>
    </div>
  );
};
