import React from 'react';
import { Link } from 'react-router-dom';
import { Layers, Calendar } from 'lucide-react';
import { getAllStages } from '../lib/content';
import { Badge } from '../components/common/Badge';

export const HomePage: React.FC = () => {
  const stages = getAllStages();

  return (
    <div className="space-y-6 max-w-5xl mx-auto py-2">
      {/* Direct, Clean Page Header */}
      <div className="space-y-1.5 pb-2 border-b border-theme-border">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-theme-text flex items-center gap-2.5">
          <Layers className="w-6 h-6 text-theme-accent shrink-0" />
          <span>Roadmap Stages</span>
        </h1>
        <p className="text-sm text-theme-muted">
          Stage aur study day select karein in-browser interactive demos shuru karne ke liye.
        </p>
      </div>

      {/* Stage Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {stages.map((stage) => {
          const daysCount = stage.days?.length || 0;
          const demoCount = stage.days?.reduce((acc, d) => acc + (d.demos?.length || 0), 0) || 0;

          return (
            <div
              key={stage.id}
              className="flex flex-col justify-between p-5 bg-theme-surface border border-theme-border rounded-xl hover:border-amber-500/50 hover:shadow-md transition-all group"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-theme-accent">
                    Stage {stage.order}
                  </span>
                  <Badge type="inflight" size="sm">
                    {daysCount} Days · {demoCount} Demos
                  </Badge>
                </div>

                <h2 className="text-lg font-bold text-theme-text group-hover:text-theme-accent transition-colors mb-2">
                  {stage.title}
                </h2>

                <p className="text-xs text-theme-muted leading-relaxed line-clamp-3 mb-4">
                  {stage.description}
                </p>
              </div>

              <div className="space-y-2 pt-3 border-t border-theme-border">
                {stage.days?.map((day) => (
                  <Link
                    key={day.dayNumber}
                    to={`/stage/${stage.id}/day/${day.dayNumber}`}
                    className="flex items-center justify-between p-2 rounded-lg bg-theme-surface-alt hover:bg-amber-200/40 dark:hover:bg-stone-800 active:scale-[0.98] transition-all text-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Calendar className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                      <span className="font-semibold truncate" title={`Day ${day.dayNumber}: ${day.trackerTask || day.title}`}>
                        Day {day.dayNumber}: {day.trackerTask || day.title}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-theme-muted shrink-0">
                      {day.demos?.length || 0} demos →
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default HomePage;
