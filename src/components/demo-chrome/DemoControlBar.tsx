import React from 'react';
import { Play, Pause, StepForward, RotateCcw, Shuffle, FastForward, Clock } from 'lucide-react';
import { Button } from '../common/Button';

export interface PresetScenario {
  id: string;
  name: string;
  description: string;
}

interface DemoControlBarProps {
  isRunning: boolean;
  onTogglePlay: () => void;
  onStep: () => void;
  onReset: () => void;
  speed: number;
  onChangeSpeed: (speed: number) => void;
  seed: number;
  onChangeSeed: (seed: number) => void;
  onRandomizeSeed: () => void;
  presets?: PresetScenario[];
  activePresetId?: string;
  onSelectPreset?: (id: string) => void;
  currentTick?: number;
  tickDurationMs?: number;
}

export const DemoControlBar: React.FC<DemoControlBarProps> = ({
  isRunning,
  onTogglePlay,
  onStep,
  onReset,
  speed,
  onChangeSpeed,
  seed,
  onChangeSeed,
  onRandomizeSeed,
  presets = [],
  activePresetId,
  onSelectPreset,
  currentTick = 0,
  tickDurationMs = 500,
}) => {
  const simulatedSeconds = ((currentTick * tickDurationMs) / 1000).toFixed(1);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-theme-surface border border-theme-border rounded-lg shadow-sm">
      {/* Primary Execution Controls */}
      <div className="flex items-center gap-2">
        <Button
          variant="primary"
          size="sm"
          onClick={onTogglePlay}
          icon={isRunning ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
          title={isRunning ? 'Pause Simulation (Space)' : 'Start Simulation (Space)'}
          aria-label={isRunning ? 'Pause Simulation' : 'Start Simulation'}
        >
          {isRunning ? 'Pause' : 'Play'}
        </Button>

        <Button
          variant="secondary"
          size="sm"
          onClick={onStep}
          disabled={isRunning}
          icon={<StepForward className="w-4 h-4" />}
          title="Single Step Forward"
          aria-label="Single Step Forward"
        >
          Step
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={onReset}
          icon={<RotateCcw className="w-4 h-4" />}
          title="Reset Simulation"
          aria-label="Reset Simulation"
        >
          Reset
        </Button>

        {/* Virtual Clock Display */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono bg-theme-surface-alt border border-theme-border rounded-md text-theme-muted ml-1">
          <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          <span>T:{currentTick}</span>
          <span className="opacity-60">({simulatedSeconds}s)</span>
        </div>
      </div>

      {/* Speed Slider */}
      <div className="flex items-center gap-2">
        <FastForward className="w-3.5 h-3.5 text-theme-muted" />
        <span className="text-xs font-medium text-theme-muted">Speed:</span>
        <input
          type="range"
          min="0.25"
          max="4"
          step="0.25"
          value={speed}
          onChange={(e) => onChangeSpeed(parseFloat(e.target.value))}
          className="w-20 accent-amber-500 cursor-pointer h-1.5 bg-theme-border rounded-lg"
          aria-label="Simulation Speed"
        />
        <span className="text-xs font-mono text-theme-accent w-9 text-right font-semibold">{speed}x</span>
      </div>

      {/* Seed Controls */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-theme-muted">Seed:</span>
        <input
          type="number"
          value={seed}
          onChange={(e) => onChangeSeed(parseInt(e.target.value, 10) || 1)}
          className="w-16 px-2 py-1 text-xs font-mono bg-theme-surface-alt border border-theme-border rounded text-theme-text focus:outline-none focus:ring-1 focus:ring-amber-500"
          aria-label="PRNG Seed"
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={onRandomizeSeed}
          title="Randomize Seed"
          icon={<Shuffle className="w-3.5 h-3.5" />}
          className="p-1 px-1.5"
          aria-label="Randomize Seed"
        >
          Rand
        </Button>
      </div>

      {/* Scenario Presets */}
      {presets.length > 0 && onSelectPreset && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-theme-muted">Preset:</span>
          <select
            value={activePresetId || ''}
            onChange={(e) => onSelectPreset(e.target.value)}
            className="px-2.5 py-1 text-xs font-medium bg-theme-surface-alt border border-theme-border rounded-md text-theme-text focus:outline-none focus:ring-2 focus:ring-amber-500/50 cursor-pointer"
            aria-label="Select Scenario Preset"
          >
            <option value="" disabled>Choose scenario...</option>
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
};
