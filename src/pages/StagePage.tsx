import React from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { getStage } from '../lib/content';
import { Breadcrumbs } from '../components/layout/Breadcrumbs';
import { Calendar, PlayCircle, ArrowRight, ExternalLink, BookOpen } from 'lucide-react';

export const StagePage: React.FC = () => {
  const { stageId } = useParams();
  const stage = getStage(stageId || '');

  if (!stage) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto py-2">
      <Breadcrumbs items={[{ label: stage.title }]} />

      <div className="p-6 bg-theme-surface border border-theme-border rounded-xl shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-theme-accent">
            Stage {stage.order} Overview
          </span>
          {stage.notionPageId && (
            <a
              href={`https://app.notion.com/p/${stage.notionPageId.replace(/-/g, '')}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-theme-accent hover:underline font-medium"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Notion Folder</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-theme-text">{stage.title}</h1>
        <p className="text-sm text-theme-muted leading-relaxed max-w-3xl">
          {stage.description}
        </p>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-bold text-theme-text flex items-center gap-2">
          <Calendar className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <span>Stage Days & Notes</span>
        </h2>

        <div className="space-y-4">
          {stage.days?.map((day) => (
            <div
              key={day.dayNumber}
              className="p-5 bg-theme-surface border border-theme-border rounded-xl hover:border-amber-500/40 transition-all shadow-sm space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="px-2 py-0.5 text-xs font-mono font-bold bg-theme-primary/20 text-theme-accent rounded">
                    Day {day.dayNumber}
                  </span>
                  <h3 className="text-base font-bold text-theme-text">{day.title}</h3>
                </div>

                <Link
                  to={`/stage/${stage.id}/day/${day.dayNumber}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-theme-accent hover:underline"
                >
                  <span>Open Day & Notes</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {/* Concepts Covered */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {day.concepts.map((concept, i) => (
                  <span
                    key={i}
                    className="text-[11px] font-mono px-2 py-0.5 bg-theme-surface-alt border border-theme-border rounded text-theme-muted"
                  >
                    {concept}
                  </span>
                ))}
              </div>

              {/* Demos List */}
              {day.demos && day.demos.length > 0 && (
                <div className="pt-2 border-t border-theme-border/60">
                  <div className="text-[11px] font-mono font-semibold text-theme-muted uppercase mb-2">
                    Interactive Demos ({day.demos.length})
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {day.demos.map((d) => (
                      <Link
                        key={d.id}
                        to={`/stage/${stage.id}/day/${day.dayNumber}/${d.id}`}
                        className="flex items-start gap-2.5 p-2.5 rounded-lg bg-theme-surface-alt hover:bg-amber-200/50 dark:hover:bg-stone-800 transition-colors text-xs"
                      >
                        <PlayCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="font-semibold text-theme-text">{d.title}</div>
                          <div className="text-[11px] text-theme-muted line-clamp-1">{d.summary}</div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
