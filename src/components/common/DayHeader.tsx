import React, { useState } from 'react';
import { DayMeta, KeyPoint } from '../../types/content';
import { ChevronDown, Sparkles } from 'lucide-react';

interface DayHeaderProps {
  day: DayMeta;
}

function getFallbackDefinition(day: DayMeta): string {
  if (day.definition) return day.definition;
  if (day.recap) {
    const firstSentence = day.recap.split(/[.?!]/)[0]?.trim();
    if (firstSentence) return `${firstSentence}.`;
  }
  return day.trackerTask || day.title;
}

function getFallbackKeyPoints(day: DayMeta): KeyPoint[] {
  if (day.keyPoints && day.keyPoints.length > 0) {
    return day.keyPoints;
  }
  // Auto-generate key points from demos or concepts if not explicitly declared
  if (day.demos && day.demos.length > 0) {
    return day.demos.slice(0, 3).map((demo, idx) => {
      const icons = ['⚡', '⏱️', '💾', '📦', '🔀'];
      return {
        icon: icons[idx % icons.length],
        title: demo.title,
        description: demo.summary,
      };
    });
  }
  return [];
}

export const DayHeader: React.FC<DayHeaderProps> = ({ day }) => {
  const [showRecap, setShowRecap] = useState(false);

  const definition = getFallbackDefinition(day);
  const keyPoints = getFallbackKeyPoints(day);

  return (
    <header className="space-y-4">
      {/* Title */}
      <h1 className="text-[30px] font-extrabold leading-[1.12] tracking-tight text-theme-text sm:text-[38px]">
        Day {day.dayNumber}: {day.title}
      </h1>

      {/* 1-Line Core Mental Model / Definition */}
      <div className="flex items-start gap-3 rounded-xl border border-theme-border border-l-4 border-l-theme-primary bg-theme-surface p-4 text-[16px] leading-snug text-theme-text shadow-xs sm:text-[17px]">
        <span className="text-lg flex-shrink-0 select-none pt-0.5 leading-none" aria-hidden="true">
          💡
        </span>
        <p className="font-semibold text-theme-text">{definition}</p>
      </div>

      {/* 3 Scannable Key Takeaway Cards */}
      {keyPoints.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {keyPoints.map((point, idx) => (
            <div
              key={idx}
              className="p-4 rounded-xl border border-theme-border bg-theme-surface shadow-xs space-y-1.5 transition-all duration-150 hover:border-theme-accent/40"
            >
              <div className="flex items-center gap-2">
                <span className="text-base select-none leading-none" aria-hidden="true">
                  {point.icon || '📌'}
                </span>
                <h3 className="text-[16px] font-bold leading-snug tracking-tight text-theme-text">
                  {point.title}
                </h3>
              </div>
              <p className="text-[15px] text-theme-muted leading-relaxed">
                {point.description}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Collapsible Hinglish Narrative Recap */}
      {day.recap && (
        <div className="pt-0.5">
          <button
            type="button"
            onClick={() => setShowRecap(!showRecap)}
            className="text-[15px] text-theme-muted hover:text-theme-text flex items-center gap-1.5 select-none transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-theme-accent" />
            <span>
              {showRecap ? 'Hide detailed narrative recap' : 'Read detailed narrative recap'}
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-200 ${
                showRecap ? 'rotate-180' : ''
              }`}
            />
          </button>

          {showRecap && (
            <div className="mt-2.5 p-4 rounded-xl bg-theme-surface border border-theme-border text-[15px] text-theme-muted leading-relaxed select-text animate-in fade-in duration-150">
              <p>{day.recap}</p>
            </div>
          )}
        </div>
      )}
    </header>
  );
};

export default DayHeader;
