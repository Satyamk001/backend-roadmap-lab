import React, { useState, Suspense, useCallback, useEffect, useRef } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { getStage, getDay } from '../lib/content';
import { Breadcrumbs } from '../components/layout/Breadcrumbs';
import { DayPager } from '../components/layout/DayPager';
import { DayHeader } from '../components/common/DayHeader';
import { getDemoComponent } from '../demos/registry';
import { NotionNotesRenderer } from '../components/notes/NotionNotesRenderer';
import { NotesProvider } from '../components/notes/NotesContext';
import { BookOpen, ExternalLink, ChevronDown, ChevronUp, Maximize2, Minimize2 } from 'lucide-react';

export const DayPage: React.FC = () => {
  const { stageId, dayId } = useParams();
  const stage = getStage(stageId || '');
  const day = getDay(stageId || '', dayId || '');

  const [activeDemoId, setActiveDemoId] = useState<string>(() => {
    return day?.demos?.[0]?.id || '';
  });

  const [showNotesDrawer, setShowNotesDrawer] = useState(false);
  const [isNotesExpanded, setIsNotesExpanded] = useState(false);
  const [pendingNotesAnchor, setPendingNotesAnchor] = useState<string | null>(null);
  const notesDrawerRef = useRef<HTMLDivElement>(null);
  const notesScrollRef = useRef<HTMLDivElement>(null);
  const tabBarRef = useRef<HTMLDivElement>(null);

  const openNotes = useCallback((anchor?: string) => {
    setShowNotesDrawer(true);
    if (anchor) setPendingNotesAnchor(anchor);
  }, []);

  const openNotesFromPager = useCallback(() => {
    setShowNotesDrawer(true);
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    notesDrawerRef.current?.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      block: 'start',
    });
  }, []);

  // DayPage is reused across route changes, so reset per-day UI state when the
  // pager moves to another day or stage.
  useEffect(() => {
    setActiveDemoId(day?.demos?.[0]?.id || '');
    setShowNotesDrawer(false);
  }, [stageId, dayId]);

  // Keep the active demo tab visible when tabs are switched with 1-6 on a
  // narrow screen, where the tab strip scrolls horizontally.
  useEffect(() => {
    const bar = tabBarRef.current;
    if (!bar) return;

    const activeTab = bar.querySelector<HTMLElement>(
      `[data-demo-tab="${activeDemoId}"]`
    );
    if (!activeTab) return;

    const barRect = bar.getBoundingClientRect();
    const tabRect = activeTab.getBoundingClientRect();
    // Left-align the active tab so the next tabs stay visible as a hint that
    // the strip scrolls; centering a long tab hides all of its neighbours.
    const targetLeft =
      bar.scrollLeft + (tabRect.left - barRect.left);
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    bar.scrollTo({
      left: Math.max(0, targetLeft),
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  }, [activeDemoId]);

  useEffect(() => {
    if (!showNotesDrawer || !pendingNotesAnchor) return;

    // The drawer mounts on the same render that opens it. Wait one frame so
    // the heading has a layout box before measuring its position.
    const timer = window.setTimeout(() => {
      const scroller = notesScrollRef.current;
      const target = document.getElementById(pendingNotesAnchor);

      if (scroller && target) {
        const top =
          target.getBoundingClientRect().top -
          scroller.getBoundingClientRect().top +
          scroller.scrollTop -
          16;

        notesDrawerRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
        scroller.scrollTo({ top: Math.max(0, top), behavior: 'auto' });
        target.focus({ preventScroll: true });
      }

      setPendingNotesAnchor(null);
    }, 80);

    return () => window.clearTimeout(timer);
  }, [showNotesDrawer, pendingNotesAnchor]);

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
    <div className="w-full max-w-6xl mx-auto py-1 sm:py-2 space-y-3 sm:space-y-3.5 text-theme-text">
      {/* Breadcrumbs */}
      <Breadcrumbs
        items={[
          { label: stage.title.split(':')[0], path: `/stage/${stage.id}` },
          { label: `Day ${day.dayNumber}` },
        ]}
      />

      {/* Header: Title, Short Definition, 3 Key Takeaway Cards & Collapsible Recap */}
      <DayHeader day={day} />

      {/* Story-Ordered Demo Tab Bar with Keyboard Badges */}
      {day.demos && day.demos.length > 1 && (
        <div className="space-y-1.5">
          <div
            ref={tabBarRef}
            className="flex items-center gap-1.5 overflow-x-auto border-b border-theme-border pb-1.5 select-none no-scrollbar"
          >
            {day.demos.map((d, idx) => {
              const isActive = (currentDemo?.id || '') === d.id;
              return (
                <button
                  key={d.id}
                  data-demo-tab={d.id}
                  type="button"
                  onClick={() => setActiveDemoId(d.id)}
                  className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1 text-[13.5px] sm:text-[14px] font-semibold transition-all duration-150 active:scale-[0.98] ${
                    isActive
                      ? 'bg-theme-primary text-theme-primary-text font-bold shadow-xs'
                      : 'bg-theme-surface hover:bg-theme-surface-alt border border-theme-border text-theme-muted hover:text-theme-text'
                  }`}
                >
                  <span>{idx + 1}. {d.title}</span>
                  <kbd
                    className={`text-[9.5px] font-mono px-1 py-0.2 rounded border max-[380px]:hidden ${
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

          <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[12px] text-theme-muted select-none">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.2 rounded bg-theme-surface border border-theme-border font-mono text-[10px] text-theme-text font-bold">1-6</kbd>
                <span>Switch tabs</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.2 rounded bg-theme-surface border border-theme-border font-mono text-[10px] text-theme-text font-bold">Space</kbd>
                <span>Step / Produce</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.2 rounded bg-theme-surface border border-theme-border font-mono text-[10px] text-theme-text font-bold">R</kbd>
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
            <NotesProvider onOpen={openNotes}>
              <DemoComponent />
            </NotesProvider>
          </Suspense>
        ) : (
          <div className="p-8 text-center bg-theme-surface border border-theme-border rounded-xl text-theme-muted">
            Select a demo above.
          </div>
        )}
      </div>

      {/* Collapsed "Read the notes" Drawer (Notion tags formatted cleanly) */}
      <div
        ref={notesDrawerRef}
        className="scroll-mt-24 border border-theme-border rounded-xl overflow-hidden bg-theme-surface shadow-xs"
      >
        <button
          type="button"
          onClick={() => setShowNotesDrawer(!showNotesDrawer)}
          className="w-full flex items-center justify-between p-3.5 bg-theme-surface-alt hover:bg-theme-border/40 text-[15px] font-semibold text-theme-text transition-colors select-none"
        >
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-theme-accent" />
            <span>Read the notes (Notion study snapshot)</span>
          </div>

          <div className="flex items-center gap-3">
            {showNotesDrawer && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsNotesExpanded(!isNotesExpanded);
                }}
                className="hidden sm:flex items-center gap-1 text-[13px] text-theme-muted hover:text-theme-text p-1 rounded hover:bg-theme-surface transition-colors"
                title={isNotesExpanded ? 'Collapse reader view' : 'Expand reader view'}
              >
                {isNotesExpanded ? (
                  <>
                    <Minimize2 className="w-3.5 h-3.5" />
                    <span>Collapse height</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>Expand view</span>
                  </>
                )}
              </button>
            )}

            {day.notesUrl && (
              <a
                href={day.notesUrl}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-[13px] text-theme-accent hover:underline flex items-center gap-1 font-normal"
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
          <div
            ref={notesScrollRef}
            data-notes-scroller
            className={`p-4 sm:p-6 border-t border-theme-border text-[15px] leading-relaxed overflow-y-auto ${
              isNotesExpanded ? 'max-h-[85vh]' : 'max-h-[550px]'
            }`}
          >
            {day.notesMarkdown ? (
              <NotionNotesRenderer markdown={day.notesMarkdown} />
            ) : (
              <p className="text-theme-muted italic">No notes snapshot saved for this day.</p>
            )}
          </div>
        )}
      </div>

      <DayPager stage={stage} day={day} onOpenNotes={openNotesFromPager} />
    </div>
  );
};

export default DayPage;
