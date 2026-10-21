import React, { useState } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { ChevronDown, ChevronRight, Layers, Calendar, X } from 'lucide-react';
import { getAllStages } from '../../lib/content';

interface SidebarProps {
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isMobileOpen, onCloseMobile }) => {
  const stages = getAllStages();
  const { stageId, dayId } = useParams();

  // Collapsed by default except the current active stage
  const [expandedStages, setExpandedStages] = useState<Record<string, boolean>>({
    [stageId || 's6-queues-async']: true,
  });

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
            <div key={stage.id} className="rounded-lg overflow-hidden">
              {/* Stage Header */}
              <button
                type="button"
                onClick={() => toggleStage(stage.id)}
                className={`w-full flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all duration-150 text-xs font-semibold text-left active:scale-[0.99] ${
                  isStageActive
                    ? 'bg-theme-surface-alt text-theme-text font-bold shadow-xs'
                    : 'text-theme-text hover:bg-theme-surface-alt'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <Layers className="w-4 h-4 text-theme-accent flex-shrink-0" />
                  <span className="truncate">{stage.title}</span>
                </div>
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-theme-muted flex-shrink-0" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-theme-muted flex-shrink-0" />
                )}
              </button>

              {/* Days inside Stage (Stage > Day ONLY, demos are on day page) */}
              {isExpanded && stage.days && (
                <div className="ml-3 pl-2 border-l border-theme-border my-1 space-y-1">
                  {stage.days.map((day) => {
                    const isDayActive =
                      isStageActive && (dayId === `day-${day.dayNumber}` || dayId === `${day.dayNumber}`);

                    return (
                      <NavLink
                        key={day.dayNumber}
                        to={`/stage/${stage.id}/day/${day.dayNumber}`}
                        onClick={onCloseMobile}
                        className={`flex items-start gap-2.5 p-2 rounded-lg text-xs transition-all duration-150 active:scale-[0.98] ${
                          isDayActive
                            ? 'bg-theme-primary text-theme-primary-text font-bold shadow-xs ring-1 ring-black/10 dark:ring-white/10'
                            : 'text-theme-muted hover:text-theme-text hover:bg-theme-surface-alt'
                        }`}
                        title={`Day ${day.dayNumber}: ${day.trackerTask || day.title}`}
                      >
                        <Calendar className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                        <div className="min-w-0 flex-1 leading-snug">
                          <div className={`font-semibold truncate ${isDayActive ? 'text-theme-primary-text' : 'text-theme-text'}`}>
                            {day.trackerTask || day.title}
                          </div>
                          <div className={`text-[10px] ${isDayActive ? 'text-theme-primary-text/80' : 'text-theme-muted'}`}>
                            Day {day.dayNumber}
                          </div>
                        </div>
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 flex-shrink-0 bg-theme-surface border-r border-theme-border flex-col h-[calc(100vh-3.5rem)] sticky top-14 overflow-hidden">
        {content}
      </aside>

      {/* Mobile Slide-Over Drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in"
            onClick={onCloseMobile}
          />
          <div className="relative w-72 max-w-[80vw] bg-theme-surface h-full shadow-2xl z-10 animate-in slide-in-from-left">
            {content}
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
