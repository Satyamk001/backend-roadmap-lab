import React, { useEffect } from 'react';
import { Trophy, CheckCircle2, Circle, Lightbulb } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useSettingsStore } from '../../store/useSettingsStore';

export interface Challenge {
  id: string;
  title: string;
  description: string;
  hint?: string;
  isCompleted: boolean;
}

interface DemoChallengeModeProps {
  challenges: Challenge[];
  demoId?: string;
}

export const DemoChallengeMode: React.FC<DemoChallengeModeProps> = ({
  challenges,
}) => {
  const { completedChallenges, markChallengeCompleted } = useSettingsStore();

  useEffect(() => {
    challenges.forEach((ch) => {
      if (ch.isCompleted && !completedChallenges[ch.id]) {
        markChallengeCompleted(ch.id);
        // Trigger celebratory confetti
        try {
          confetti({
            particleCount: 50,
            spread: 60,
            origin: { y: 0.8 },
            colors: ['#F59E0B', '#10B981', '#3B82F6'],
          });
        } catch (e) {}
      }
    });
  }, [challenges, completedChallenges, markChallengeCompleted]);

  if (challenges.length === 0) return null;

  const totalPassed = challenges.filter(
    (c) => c.isCompleted || completedChallenges[c.id]
  ).length;

  return (
    <div className="p-3 bg-theme-surface border border-theme-border rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-500" />
          <span className="text-xs font-bold uppercase tracking-wider text-theme-text font-mono">
            Challenge Mode
          </span>
        </div>
        <span className="text-xs font-mono font-semibold text-theme-accent">
          {totalPassed} / {challenges.length} Complete
        </span>
      </div>

      <div className="space-y-2">
        {challenges.map((c, idx) => {
          const isDone = c.isCompleted || completedChallenges[c.id];
          return (
            <div
              key={c.id}
              className={`p-2.5 rounded-md border text-xs transition-all ${
                isDone
                  ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                  : 'bg-theme-surface-alt border-theme-border text-theme-text'
              }`}
            >
              <div className="flex items-start gap-2">
                <span className="mt-0.5 flex-shrink-0">
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Circle className="w-4 h-4 text-theme-muted" />
                  )}
                </span>

                <div className="flex-1">
                  <div className="font-semibold mb-0.5">
                    Task {idx + 1}: {c.title}
                  </div>
                  <div className="text-theme-muted leading-relaxed">{c.description}</div>
                  {c.hint && !isDone && (
                    <div className="flex items-center gap-1 mt-1 text-[11px] text-amber-700 dark:text-amber-400">
                      <Lightbulb className="w-3 h-3 flex-shrink-0" />
                      <span>Hint: {c.hint}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
