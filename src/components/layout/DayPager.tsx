import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, ChevronLeft, ChevronRight, Home, Layers } from 'lucide-react';
import { getAllStages } from '../../lib/content';
import { DayMeta, StageData } from '../../types/content';

interface DayPagerProps {
  stage: StageData;
  day: DayMeta;
  onOpenNotes?: () => void;
}

interface DayEntry {
  stage: StageData;
  day: DayMeta;
}

interface PagerLinkProps {
  direction: 'previous' | 'next';
  entry?: DayEntry;
  stage: StageData;
}

const stageLabel = (stage: StageData) =>
  `Stage ${stage.order} · ${stage.title.replace(/^S\d+:\s*/, '')}`;

const PagerLink: React.FC<PagerLinkProps> = ({ direction, entry, stage }) => {
  const isNext = direction === 'next';

  const target = entry
    ? `/stage/${entry.stage.id}/day/${entry.day.dayNumber}`
    : isNext
      ? '/'
      : `/stage/${stage.id}`;

  const eyebrow = entry
    ? isNext
      ? 'Next day'
      : 'Previous day'
    : isNext
      ? 'Roadmap home'
      : 'Stage overview';

  const title = entry
    ? `Day ${entry.day.dayNumber}: ${entry.day.title}`
    : isNext
      ? 'All roadmap stages'
      : stage.title;

  const meta = entry
    ? stageLabel(entry.stage)
    : isNext
      ? 'Pick another study day'
      : 'Browse all days in this stage';

  const Icon = entry ? (isNext ? ChevronRight : ChevronLeft) : isNext ? Home : Layers;

  return (
    <Link
      to={target}
      aria-label={`${eyebrow}: ${title}`}
      title={title}
      className={`group flex min-h-[92px] min-w-0 items-start gap-3 rounded-xl border border-theme-border bg-theme-surface p-4 transition-colors hover:border-theme-primary/60 hover:bg-theme-surface-alt/40 ${
        isNext ? 'flex-row-reverse text-right' : ''
      }`}
    >
      <Icon
        className={`mt-0.5 h-5 w-5 flex-shrink-0 text-theme-accent transition-transform ${
          isNext ? 'group-hover:translate-x-0.5' : 'group-hover:-translate-x-0.5'
        }`}
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold text-theme-muted">{eyebrow}</span>
        <span className="mt-1 block truncate text-[15px] font-bold text-theme-text">{title}</span>
        <span className="mt-0.5 block truncate text-[13px] text-theme-muted">{meta}</span>
      </span>
    </Link>
  );
};

export const DayPager: React.FC<DayPagerProps> = ({ stage, day, onOpenNotes }) => {
  const orderedDays = getAllStages().flatMap((orderedStage) =>
    (orderedStage.days ?? []).map((orderedDay) => ({
      stage: orderedStage,
      day: orderedDay,
    }))
  );

  const index = orderedDays.findIndex(
    (entry) => entry.stage.id === stage.id && entry.day.dayNumber === day.dayNumber
  );

  const previous = index > 0 ? orderedDays[index - 1] : undefined;
  const next = index >= 0 && index < orderedDays.length - 1 ? orderedDays[index + 1] : undefined;

  const stageDays = stage.days ?? [];
  const stagePosition = stageDays.findIndex((entry) => entry.dayNumber === day.dayNumber) + 1;

  return (
    <nav aria-label="Day navigation" className="border-t border-theme-border pt-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <PagerLink direction="previous" entry={previous} stage={stage} />
        <PagerLink direction="next" entry={next} stage={stage} />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[13px] text-theme-muted">
        <span>
          Stage {stage.order} · Day {day.dayNumber}
          {stagePosition > 0 && ` · ${stagePosition} of ${stageDays.length} ${
            stageDays.length === 1 ? 'day' : 'days'
          }`}
        </span>

        {onOpenNotes && (
          <>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={onOpenNotes}
              className="inline-flex min-h-8 items-center gap-1 rounded-md font-semibold text-theme-accent hover:underline"
            >
              <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Read notes</span>
            </button>
          </>
        )}
      </div>
    </nav>
  );
};

export default DayPager;
