import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { NavLink, matchPath, useLocation } from 'react-router-dom';
import { ChevronDown, ChevronRight, Layers, Calendar, X } from 'lucide-react';
import { getAllStages } from '../../lib/content';
import { DayMeta } from '../../types/content';

interface SidebarProps {
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

interface StageDayListProps {
  stageId: string;
  days: DayMeta[];
  isStageActive: boolean;
  activeDayId?: string;
  expandedStages: Record<string, boolean>;
  onNavigate?: () => void;
}

const StageDayList: React.FC<StageDayListProps> = ({
  stageId,
  days,
  isStageActive,
  activeDayId,
  expandedStages,
  onNavigate,
}) => {
  const activeLinkRef = useRef<HTMLAnchorElement | null>(null);
  const [nodeY, setNodeY] = useState<number | null>(null);

  // The node is shared by every row, so measure the active row and move it
  // with a CSS transform instead of mounting one node per row.
  useLayoutEffect(() => {
    const link = activeLinkRef.current;
    if (!link) {
      setNodeY(null);
      return;
    }

    const measure = () => {
      if (link.isConnected) {
        setNodeY(link.offsetTop + link.offsetHeight / 2);
      }
    };

    measure();

    const observer =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(link);
    window.addEventListener('resize', measure);

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [activeDayId, isStageActive, days.length, expandedStages]);

  return (
    <div className="sidebar-timeline ml-4 my-1">
      <div className="space-y-1">
        {days.map((day) => {
          const isDayActive =
            isStageActive && (activeDayId === `day-${day.dayNumber}` || activeDayId === `${day.dayNumber}`);

          return (
            <NavLink
              key={day.dayNumber}
              ref={isDayActive ? activeLinkRef : undefined}
              to={`/stage/${stageId}/day/${day.dayNumber}`}
              onClick={onNavigate}
              className={`group relative flex items-start gap-2.5 py-2 pl-4 pr-2 rounded-lg text-[13px] transition-all duration-150 ${
                isDayActive ? 'text-theme-text' : 'text-theme-muted hover:text-theme-text'
              }`}
              title={`Day ${day.dayNumber}: ${day.trackerTask || day.title}`}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none absolute inset-y-0 left-3 right-0 rounded-lg transition-colors duration-150 ${
                  isDayActive ? 'bg-theme-surface-alt' : 'bg-transparent group-hover:bg-theme-surface-alt'
                }`}
              />
              <Calendar className="relative w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <div className="relative min-w-0 flex-1 leading-snug">
                <div className={`whitespace-normal break-words ${isDayActive ? 'font-bold text-theme-text' : 'font-semibold text-theme-text'}`}>
                  {day.trackerTask || day.title}
                </div>
                <div className={`mt-0.5 text-[11px] ${isDayActive ? 'font-medium text-theme-accent' : 'text-theme-muted'}`}>
                  Day {day.dayNumber}
                </div>
              </div>
            </NavLink>
          );
        })}
      </div>

      {isStageActive && nodeY !== null && (
        <span
          aria-hidden="true"
          className="sidebar-timeline-node"
          style={{ transform: `translateY(${nodeY}px)` }}
        />
      )}
    </div>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({ isMobileOpen, onCloseMobile }) => {
  const stages = getAllStages();
  const location = useLocation();

  // The sidebar lives above <Routes>, so useParams() is empty here.
  // Match the location directly to keep stage/day highlighting in sync.
  const dayMatch = matchPath(
    { path: '/stage/:stageId/day/:dayId', end: false },
    location.pathname
  );
  const stageMatch = matchPath(
    { path: '/stage/:stageId', end: true },
    location.pathname
  );
  const stageId = dayMatch?.params.stageId ?? stageMatch?.params.stageId;
  const dayId = dayMatch?.params.dayId;

  // Collapsed by default except the current active stage
  const [expandedStages, setExpandedStages] = useState<Record<string, boolean>>({
    [stageId || 's6-queues-async']: true,
  });

  // Keep the current stage visible when navigating between stages.
  useEffect(() => {
    if (!stageId) return;
    setExpandedStages((prev) => (prev[stageId] ? prev : { ...prev, [stageId]: true }));
  }, [stageId]);

  const toggleStage = (id: string) => {
    setExpandedStages((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const content = (
    <div className="w-full h-full flex flex-col p-3 select-none">
      {/* Mobile close button header */}
      {isMobileOpen && (
        <div className="flex items-center justify-between pb-3 mb-2 border-b border-theme-border lg:hidden">
          <span className="text-sm font-bold text-theme-text">Roadmap Navigation</span>
          <button
            type="button"
            onClick={onCloseMobile}
            className="p-1 rounded-md text-theme-muted hover:text-theme-text hover:bg-theme-surface-alt"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      <div className="text-xs font-bold uppercase tracking-wider text-theme-muted font-mono px-2 py-1 mb-2">
        Stages &amp; Days
      </div>

      <div className="space-y-1.5 overflow-y-auto flex-1">
        {stages.map((stage) => {
          const isStageActive = stage.id === stageId;
          const isExpanded = expandedStages[stage.id] ?? isStageActive;

          return (
            <div key={stage.id} className="rounded-lg">
              {/* Stage Header */}
              <button
                type="button"
                onClick={() => toggleStage(stage.id)}
                title={stage.title}
                aria-expanded={isExpanded}
                className={`w-full flex items-start justify-between gap-2 p-2 rounded-lg cursor-pointer transition-all duration-150 text-[13px] font-semibold text-left active:scale-[0.99] ${
                  isStageActive
                    ? 'bg-theme-surface-alt text-theme-text font-bold shadow-xs'
                    : 'text-theme-text hover:bg-theme-surface-alt'
                }`}
              >
                <div className="flex min-w-0 flex-1 items-start gap-2">
                  <Layers className="w-4 h-4 mt-0.5 text-theme-accent flex-shrink-0" />
                  <span className="min-w-0 whitespace-normal break-words leading-snug">{stage.title}</span>
                </div>
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 mt-0.5 text-theme-muted flex-shrink-0" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 mt-0.5 text-theme-muted flex-shrink-0" />
                )}
              </button>

              {/* Days inside Stage (Stage > Day ONLY, demos are on day page) */}
              {isExpanded && stage.days && (
                <StageDayList
                  stageId={stage.id}
                  days={stage.days}
                  isStageActive={isStageActive}
                  activeDayId={dayId}
                  expandedStages={expandedStages}
                  onNavigate={onCloseMobile}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-3 shrink-0 border-t border-theme-border px-2 pb-1 pt-3">
        <p className="text-[11px] font-semibold text-theme-text">
          {stages.length} {stages.length === 1 ? 'stage' : 'stages'} in the library
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-theme-muted">
          Missing stage numbers aren&apos;t filtered out—they haven&apos;t been added yet.
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-72 xl:w-80 flex-shrink-0 bg-theme-surface border-r border-theme-border flex-col h-[calc(100vh-3.5rem)] sticky top-14 overflow-hidden">
        {content}
      </aside>

      {/* Mobile Slide-Over Drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in"
            onClick={onCloseMobile}
          />
          <div className="relative w-80 max-w-[86vw] bg-theme-surface h-full shadow-2xl z-10 animate-in slide-in-from-left">
            {content}
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
