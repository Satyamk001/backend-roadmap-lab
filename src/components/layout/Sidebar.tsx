import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { NavLink, matchPath, useLocation } from 'react-router-dom';
import { ChevronDown, ChevronRight, Map, X } from 'lucide-react';
import { getAllStages } from '../../lib/content';
import type { DayMeta, StageData } from '../../types/content';

interface SidebarProps {
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

const LAST_STAGE_STORAGE_KEY = 'backend_lab_last_stage';
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

// localStorage can throw in private mode or when the quota is exhausted.
// Navigation must still work, so every access is best-effort.
function readLastStage(stageIds: string[]): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const stored = window.localStorage.getItem(LAST_STAGE_STORAGE_KEY);
    return stored && stageIds.includes(stored) ? stored : undefined;
  } catch {
    return undefined;
  }
}

function rememberLastStage(stageId: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LAST_STAGE_STORAGE_KEY, stageId);
  } catch {
    // Ignore storage failures; this is a convenience, not required state.
  }
}

interface StageDayListProps {
  stageId: string;
  days: DayMeta[];
  isStageActive: boolean;
  activeDayNumber?: number;
  onNavigate?: () => void;
}

const StageDayList: React.FC<StageDayListProps> = ({
  stageId,
  days,
  isStageActive,
  activeDayNumber,
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
  }, [activeDayNumber, isStageActive, days.length]);

  // Opening the drawer for a long stage should land on the current day,
  // not at the top of the list.
  useLayoutEffect(() => {
    const link = activeLinkRef.current;
    if (link && typeof link.scrollIntoView === 'function') {
      link.scrollIntoView({ block: 'nearest' });
    }
  }, [activeDayNumber, isStageActive]);

  if (days.length === 0) {
    return (
      <p className="ms-2 my-1 py-2 ps-4 pe-2 text-[13px] leading-relaxed text-theme-muted">
        No days published yet.
      </p>
    );
  }

  return (
    <div className="sidebar-timeline ms-2 my-1">
      <ul role="list" className="m-0 list-none space-y-1 p-0">
        {days.map((day) => {
          const label = day.title?.trim() || day.trackerTask?.trim() || '';
          const isDayActive =
            isStageActive && day.dayNumber === activeDayNumber;
          const fullTask =
            day.trackerTask?.trim() && day.trackerTask.trim() !== label
              ? day.trackerTask.trim()
              : undefined;

          return (
            <li key={day.dayNumber}>
              <NavLink
                ref={isDayActive ? activeLinkRef : undefined}
                to={`/stage/${stageId}/day/${day.dayNumber}`}
                onClick={onNavigate}
                aria-label={`Day ${day.dayNumber}${label ? `: ${label}` : ''}`}
                title={fullTask}
                className={`group relative flex items-start rounded-lg py-2 ps-4 pe-2 text-[15px] transition-colors duration-150 focus-visible:outline-offset-[-3px] ${
                  isDayActive
                    ? 'text-theme-text'
                    : 'text-theme-muted hover:text-theme-text'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none absolute inset-y-0 start-2 end-0 rounded-lg transition-colors duration-150 ${
                    isDayActive
                      ? 'bg-theme-surface-alt'
                      : 'bg-transparent group-hover:bg-theme-surface-alt'
                  }`}
                />
                <span className="relative min-w-0 flex-1">
                  <span
                    className={`block whitespace-normal break-words leading-snug ${
                      isDayActive
                        ? 'font-semibold text-theme-text'
                        : 'font-medium text-theme-text'
                    }`}
                  >
                    {label || `Day ${day.dayNumber}`}
                  </span>
                  {label && (
                    <span className="mt-0.5 block text-[13px] font-normal leading-none text-theme-muted">
                      Day {day.dayNumber}
                    </span>
                  )}
                </span>
              </NavLink>
            </li>
          );
        })}
      </ul>

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

interface StageSectionProps {
  stage: StageData;
  isStageActive: boolean;
  isExpanded: boolean;
  activeDayNumber?: number;
  onToggle: (stageId: string) => void;
  onNavigate?: () => void;
}

const StageSection: React.FC<StageSectionProps> = ({
  stage,
  isStageActive,
  isExpanded,
  activeDayNumber,
  onToggle,
  onNavigate,
}) => {
  const listId = useId();
  const days = stage.days ?? [];

  // Stage titles are authored as "S6: Queues & Async Processing". Splitting
  // the code keeps the number as quiet metadata instead of part of the name.
  const titleMatch = stage.title.match(/^(S\d+):\s*(.+)$/);
  const stageCode = titleMatch?.[1] ?? `Stage ${stage.order}`;
  const stageName = titleMatch?.[2] ?? stage.title;

  // Only claim a current day when the route points at a day this stage
  // actually contains; a stale or malformed day id must not invent one.
  const hiddenCurrentDay =
    isStageActive && !isExpanded
      ? days.find((day) => day.dayNumber === activeDayNumber)
      : undefined;
  const metaLabel = hiddenCurrentDay
    ? `Day ${hiddenCurrentDay.dayNumber}`
    : `${days.length} ${days.length === 1 ? 'day' : 'days'}`;

  return (
    <div className="rounded-lg">
      <button
        type="button"
        onClick={() => onToggle(stage.id)}
        aria-expanded={isExpanded}
        aria-controls={isExpanded ? listId : undefined}
        className={`flex w-full items-start justify-between gap-2 rounded-lg px-2 py-2 text-left transition-colors duration-150 focus-visible:outline-offset-[-3px] ${
          isStageActive && activeDayNumber === undefined
            ? 'bg-theme-surface-alt'
            : 'hover:bg-theme-surface-alt'
        }`}
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-medium leading-tight text-theme-muted">
            {stageCode}
          </span>
          <span className="mt-0.5 block whitespace-normal break-words text-[15px] font-semibold leading-snug text-theme-text">
            {stageName}
          </span>
        </span>
        <span className="flex flex-shrink-0 items-center gap-1.5 pt-0.5">
          {!isExpanded && (
            <span
              className={`text-[13px] font-medium ${
                hiddenCurrentDay ? 'text-theme-accent' : 'text-theme-muted'
              }`}
            >
              {metaLabel}
            </span>
          )}
          {isExpanded ? (
            <ChevronDown
              className="h-3.5 w-3.5 text-theme-muted"
              aria-hidden="true"
            />
          ) : (
            <ChevronRight
              className="h-3.5 w-3.5 text-theme-muted"
              aria-hidden="true"
            />
          )}
        </span>
      </button>

      {isExpanded && (
        <div id={listId}>
          <StageDayList
            stageId={stage.id}
            days={days}
            isStageActive={isStageActive}
            activeDayNumber={activeDayNumber}
            onNavigate={onNavigate}
          />
        </div>
      )}
    </div>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const stages = getAllStages();
  const location = useLocation();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const lastPathRef = useRef(location.pathname);

  // The close callback is recreated by App on every render. Keeping it in a
  // ref stops the dialog effect from tearing down (and stealing focus) when
  // an unrelated parent render happens.
  const onCloseRef = useRef(onCloseMobile);
  useEffect(() => {
    onCloseRef.current = onCloseMobile;
  }, [onCloseMobile]);

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
  const routeStageId = dayMatch?.params.stageId ?? stageMatch?.params.stageId;
  const currentStageId = stages.find((stage) => stage.id === routeStageId)?.id;

  const parsedDayNumber = dayMatch?.params.dayId
    ? Number.parseInt(dayMatch.params.dayId.replace(/^day-/, ''), 10)
    : undefined;
  const activeDayNumber =
    parsedDayNumber !== undefined && Number.isFinite(parsedDayNumber)
      ? parsedDayNumber
      : undefined;

  const [expandedStages, setExpandedStages] = useState<Record<string, boolean>>(
    () => {
      const initialStageId =
        currentStageId ??
        readLastStage(stages.map((stage) => stage.id)) ??
        stages[0]?.id;
      return initialStageId ? { [initialStageId]: true } : {};
    }
  );

  // Keep the current stage expanded when navigating, and remember it for the
  // next visit to the index page.
  useLayoutEffect(() => {
    if (!currentStageId) return;
    rememberLastStage(currentStageId);
    setExpandedStages((prev) =>
      prev[currentStageId] ? prev : { ...prev, [currentStageId]: true }
    );
  }, [currentStageId]);

  // A browser-back navigation while the drawer is open should close it.
  useEffect(() => {
    if (lastPathRef.current === location.pathname) return;
    lastPathRef.current = location.pathname;
    if (isMobileOpen) onCloseRef.current?.();
  }, [location.pathname, isMobileOpen]);

  // Dialog behaviour: focus in, trap Tab, Escape to close, lock body scroll,
  // and restore focus to the trigger on close.
  useEffect(() => {
    if (!isMobileOpen) return;

    const panel = panelRef.current;
    if (!panel) return;

    const activeElement =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const trigger = document.querySelector<HTMLElement>(
      '[data-sidebar-trigger]'
    );
    restoreFocusRef.current =
      activeElement && activeElement !== document.body
        ? activeElement
        : trigger;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current?.();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusables = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      );
      if (focusables.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const current = document.activeElement;

      if (!current || !panel.contains(current)) {
        event.preventDefault();
        first.focus();
        return;
      }

      if (event.shiftKey && current === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.body.style.overflow = previousOverflow;

      const restoreTarget = restoreFocusRef.current;
      if (restoreTarget && document.contains(restoreTarget)) {
        restoreTarget.focus();
      }
    };
  }, [isMobileOpen]);

  // The drawer is only rendered below lg. If the viewport grows while it is
  // open, close it so focus and body scroll are not left in a hidden dialog.
  useEffect(() => {
    if (!isMobileOpen || typeof window.matchMedia !== 'function') return;

    const desktopQuery = window.matchMedia('(min-width: 1024px)');
    const handleChange = () => {
      if (desktopQuery.matches) onCloseRef.current?.();
    };

    handleChange();

    if (typeof desktopQuery.addEventListener === 'function') {
      desktopQuery.addEventListener('change', handleChange);
      return () => desktopQuery.removeEventListener('change', handleChange);
    }

    desktopQuery.addListener(handleChange);
    return () => desktopQuery.removeListener(handleChange);
  }, [isMobileOpen]);

  const toggleStage = (id: string) => {
    setExpandedStages((prev) => {
      const isCurrentlyExpanded = prev[id] ?? id === currentStageId;
      return { ...prev, [id]: !isCurrentlyExpanded };
    });
  };

  const content = (
    <div className="flex h-full w-full flex-col p-3">
      <nav aria-label="Roadmap" className="flex min-h-0 flex-1 flex-col">
        <NavLink
          to="/"
          end
          onClick={onCloseMobile}
          className={({ isActive }) =>
            `flex items-center gap-2 rounded-lg px-2 py-2 text-[15px] transition-colors duration-150 focus-visible:outline-offset-[-3px] ${
              isActive
                ? 'bg-theme-surface-alt font-semibold text-theme-text'
                : 'font-medium text-theme-muted hover:bg-theme-surface-alt hover:text-theme-text'
            }`
          }
        >
          <Map className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <span>Roadmap overview</span>
        </NavLink>

        <div className="px-2 pb-1 pt-4 text-[13px] font-medium text-theme-muted">
          Stages
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pe-0.5">
          {stages.length === 0 ? (
            <p className="rounded-lg border border-dashed border-theme-border px-3 py-4 text-[13px] leading-relaxed text-theme-muted">
              No stages published yet.
            </p>
          ) : (
            <div className="space-y-1.5">
              {stages.map((stage) => {
                const isStageActive = stage.id === currentStageId;
                const isExpanded =
                  expandedStages[stage.id] ?? isStageActive;

                return (
                  <StageSection
                    key={stage.id}
                    stage={stage}
                    isStageActive={isStageActive}
                    isExpanded={isExpanded}
                    activeDayNumber={activeDayNumber}
                    onToggle={toggleStage}
                    onNavigate={onCloseMobile}
                  />
                );
              })}
            </div>
          )}
        </div>
      </nav>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-72 flex-shrink-0 flex-col overflow-hidden border-e border-theme-border bg-theme-surface lg:flex xl:w-80">
        {content}
      </aside>

      {/* Mobile Slide-Over Drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="sidebar-drawer-backdrop fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => onCloseRef.current?.()}
            aria-hidden="true"
          />
          <div
            id="mobile-roadmap-navigation"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Roadmap navigation"
            className="sidebar-drawer-panel relative z-10 flex h-[100dvh] w-80 max-w-[86vw] flex-col border-e border-theme-border bg-theme-surface shadow-2xl dark:shadow-none"
          >
            <div className="flex items-center justify-between gap-2 border-b border-theme-border p-3 pb-2">
              <h2 className="text-base font-semibold text-theme-text">
                Navigation
              </h2>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={() => onCloseRef.current?.()}
                className="-me-1 flex h-11 w-11 items-center justify-center rounded-lg text-theme-muted transition-colors hover:bg-theme-surface-alt hover:text-theme-text focus-visible:outline-offset-[-3px]"
                aria-label="Close navigation menu"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="min-h-0 flex-1">{content}</div>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
