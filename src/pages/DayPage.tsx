import React, { useState, Suspense } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { getStage, getDay } from '../lib/content';
import { Breadcrumbs } from '../components/layout/Breadcrumbs';
import { getDemoComponent } from '../demos/registry';
import { BookOpen, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';

function cleanNotionMarkdown(raw: string): string {
  return raw
    .replace(/<callout[^>]*>([\s\S]*?)<\/callout>/gi, '$1\n')
    .replace(/<mention-page[^>]*\/>/gi, '')
    .replace(/<mention-page[^>]*>([\s\S]*?)<\/mention-page>/gi, '$1')
    .replace(/<database[^>]*>([\s\S]*?)<\/database>/gi, '')
    .replace(/<empty-block\/>/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export const DayPage: React.FC = () => {
  const { stageId, dayId } = useParams();
  const stage = getStage(stageId || '');
  const day = getDay(stageId || '', dayId || '');

  const [activeDemoId, setActiveDemoId] = useState<string>(() => {
    return day?.demos?.[0]?.id || '';
  });

  const [showNotesDrawer, setShowNotesDrawer] = useState(false);

  // Keyboard shortcuts: 1-6 for tabs, Space for primary action, R for reset
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      const isInput = activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select';

      // 1 to 9: Switch tabs if not typing in input
      if (!isInput && e.key >= '1' && e.key <= '9') {
        const index = parseInt(e.key, 10) - 1;
        if (day?.demos && index < day.demos.length) {
          e.preventDefault();
          setActiveDemoId(day.demos[index].id);
          return;
        }
      }

      // Space: Primary action if not typing in input/textarea and not focused on a button
      if (e.code === 'Space' && !isInput && activeTag !== 'button') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('lab:primary-action'));
        return;
      }

      // R or r: Reset if not typing in input
      if ((e.key === 'r' || e.key === 'R') && !isInput) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('lab:reset'));
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [day?.demos]);

  if (!stage || !day) {
    return <Navigate to="/" replace />;
  }

  // Active demo object & Component
  const currentDemo = day.demos.find((d) => d.id === activeDemoId) || day.demos[0];
  const DemoComponent = currentDemo ? getDemoComponent(currentDemo.id) : null;

  return (
    <div className="w-full max-w-[1000px] mx-auto py-2 space-y-6 text-theme-text">
      {/* Breadcrumbs */}
      <Breadcrumbs
        items={[
          { label: stage.title.split(':')[0], path: `/stage/${stage.id}` },
          { label: `Day ${day.dayNumber}` },
        ]}
      />

      {/* Header: Title & Hand-Written 2-3 Sentence Recap */}
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-theme-text">
          Day {day.dayNumber}: {day.title}
        </h1>

        <p className="text-[15px] sm:text-base text-theme-muted leading-relaxed max-w-3xl">
          {day.recap || day.trackerTask}
        </p>
      </div>

      {/* Story-Ordered Demo Tab Bar with Keyboard Badges */}
      {day.demos && day.demos.length > 1 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-theme-border no-scrollbar select-none">
            {day.demos.map((d, idx) => {
              const isActive = (currentDemo?.id || '') === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setActiveDemoId(d.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-all duration-150 active:scale-[0.98] flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-theme-primary text-theme-primary-text font-bold shadow-xs'
                      : 'bg-theme-surface hover:bg-theme-surface-alt border border-theme-border text-theme-muted hover:text-theme-text'
                  }`}
                >
                  <span>{idx + 1}. {d.title}</span>
                  <kbd
                    className={`text-[10px] font-mono px-1 py-0.2 rounded border ${
                      isActive
                        ? 'bg-black/15 text-stone-900 border-black/20'
                        : 'bg-theme-surface-alt text-theme-muted border-theme-border'
                    }`}
                  >
                    {idx + 1}
                  </kbd>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-[11px] text-theme-muted px-1 select-none">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-theme-surface border border-theme-border font-mono text-[10px] text-theme-text font-bold">1-6</kbd>
                <span>Switch tabs</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-theme-surface border border-theme-border font-mono text-[10px] text-theme-text font-bold">Space</kbd>
                <span>Step / Produce</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-theme-surface border border-theme-border font-mono text-[10px] text-theme-text font-bold">R</kbd>
                <span>Reset</span>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main Single-Column Demo Stage */}
      <div className="w-full">
        {DemoComponent ? (
          <Suspense
            fallback={
              <div className="flex items-center justify-center p-16 bg-theme-surface border border-theme-border rounded-xl">
                <span className="text-sm font-mono text-theme-muted">
                  Loading demo...
                </span>
              </div>
            }
          >
            <DemoComponent />
          </Suspense>
        ) : (
          <div className="p-8 text-center bg-theme-surface border border-theme-border rounded-xl text-theme-muted">
            Select a demo above.
          </div>
        )}
      </div>

      {/* Collapsed "Read the notes" Drawer (Notion tags stripped and formatted cleanly) */}
      <div className="border border-theme-border rounded-xl overflow-hidden bg-theme-surface">
        <button
          type="button"
          onClick={() => setShowNotesDrawer(!showNotesDrawer)}
          className="w-full flex items-center justify-between p-3.5 bg-theme-surface-alt hover:bg-theme-border/40 text-sm font-semibold text-theme-text transition-colors select-none"
        >
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-theme-accent" />
            <span>Read the notes (Notion study snapshot)</span>
          </div>

          <div className="flex items-center gap-3">
            {day.notesUrl && (
              <a
                href={day.notesUrl}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-xs text-theme-accent hover:underline flex items-center gap-1 font-normal"
              >
                <span>Open in Notion</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
            {showNotesDrawer ? (
              <ChevronUp className="w-4 h-4 text-theme-muted" />
            ) : (
              <ChevronDown className="w-4 h-4 text-theme-muted" />
            )}
          </div>
        </button>

        {showNotesDrawer && (
          <div className="p-5 border-t border-theme-border text-sm leading-relaxed max-h-[500px] overflow-y-auto space-y-4">
            {day.notesMarkdown ? (
              <div className="font-sans whitespace-pre-wrap text-theme-text leading-relaxed select-text">
                {cleanNotionMarkdown(day.notesMarkdown)}
              </div>
            ) : (
              <p className="text-theme-muted italic">No notes snapshot saved for this day.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DayPage;
