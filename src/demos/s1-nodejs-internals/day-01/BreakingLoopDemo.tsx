import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Play, Pause, RotateCcw, AlertTriangle, ShieldCheck } from 'lucide-react';
import { NodeEventLoopEngine } from '../../../engine/node/engine';
import {
  breakingSyncLoopTrace,
  breakingTickStarvationTrace,
  breakingPoolSaturationTrace,
} from '../../../engine/node/traces/breakingLoopTrace';
import { TracePreset } from '../../../engine/node/types';
import { NodeDemoShell, DemoActionButton } from './NodeDemoShell';
import { SharedNodeCanvas } from './SharedNodeCanvas';

const PRESETS: Record<string, TracePreset> = {
  'sync-block': breakingSyncLoopTrace,
  'tick-starve': breakingTickStarvationTrace,
  'pool-saturate': breakingPoolSaturationTrace,
};

export const BreakingLoopDemo: React.FC = () => {
  const [selectedKey, setSelectedKey] = useState<string>('sync-block');
  const engine = useMemo(() => new NodeEventLoopEngine(PRESETS['sync-block']), []);
  const [snapshot, setSnapshot] = useState(() => engine.getSnapshot());
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const unsub = engine.subscribe((snap) => {
      setSnapshot(snap);
      setIsPlaying(engine.isPlaying());
    });
    return unsub;
  }, [engine]);

  const handleSelectMode = (key: string) => {
    setSelectedKey(key);
    engine.loadPreset(PRESETS[key]);
  };

  const handleStep = useCallback(() => {
    engine.step();
  }, [engine]);

  const handleStepBack = useCallback(() => {
    engine.stepBack();
  }, [engine]);

  const handleTogglePlay = useCallback(() => {
    engine.togglePlay();
  }, [engine]);

  const handleReset = useCallback(() => {
    engine.reset();
  }, [engine]);

  const challenges = useMemo(() => {
    const currChallenges = PRESETS[selectedKey]?.challenges ?? [];
    return currChallenges.map((ch) => {
      if (ch.id === 'break-sync-freeze') {
        return { ...ch, passed: snapshot.stepIndex >= 2 };
      }
      if (ch.id === 'break-tick-starvation') {
        return { ...ch, passed: snapshot.stepIndex >= 2 };
      }
      if (ch.id === 'break-pool-delay') {
        return { ...ch, passed: snapshot.stepIndex >= 1 };
      }
      return ch;
    });
  }, [selectedKey, snapshot.stepIndex]);

  const failureModeControls = (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-semantic-error">
        <AlertTriangle className="h-3.5 w-3.5" />
        <span>Failure Modes</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
        <button
          type="button"
          onClick={() => handleSelectMode('sync-block')}
          className={`rounded border p-1.5 text-left font-mono text-[11px] transition-colors ${
            selectedKey === 'sync-block'
              ? 'border-semantic-error bg-semantic-error-bg text-semantic-error font-bold'
              : 'border-theme-border bg-theme-bg text-theme-muted hover:bg-theme-surface-alt'
          }`}
        >
          1. Sync Loop Freeze
        </button>
        <button
          type="button"
          onClick={() => handleSelectMode('tick-starve')}
          className={`rounded border p-1.5 text-left font-mono text-[11px] transition-colors ${
            selectedKey === 'tick-starve'
              ? 'border-semantic-error bg-semantic-error-bg text-semantic-error font-bold'
              : 'border-theme-border bg-theme-bg text-theme-muted hover:bg-theme-surface-alt'
          }`}
        >
          2. nextTick Starvation
        </button>
        <button
          type="button"
          onClick={() => handleSelectMode('pool-saturate')}
          className={`rounded border p-1.5 text-left font-mono text-[11px] transition-colors ${
            selectedKey === 'pool-saturate'
              ? 'border-semantic-error bg-semantic-error-bg text-semantic-error font-bold'
              : 'border-theme-border bg-theme-bg text-theme-muted hover:bg-theme-surface-alt'
          }`}
        >
          3. Pool Saturation
        </button>
      </div>

      <div className="rounded-lg border border-theme-border bg-theme-surface-alt/40 p-2 text-[11.5px] text-theme-muted flex items-start gap-1.5">
        <ShieldCheck className="h-4 w-4 text-theme-accent flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-theme-text">Production Remedy: </span>
          {selectedKey === 'sync-block' && 'Offload to worker_threads or chunk CPU work with setImmediate.'}
          {selectedKey === 'tick-starve' && 'Never recurse with nextTick. Use setImmediate so I/O gets turns.'}
          {selectedKey === 'pool-saturate' && 'Increase UV_THREADPOOL_SIZE or isolate crypto into a dedicated worker pool.'}
        </div>
      </div>
    </div>
  );

  return (
    <NodeDemoShell
      title="Breaking the Loop: Freeze, starvation & saturation"
      summary="Sync infinite loop event loop ko freeze karta hai, recursive nextTick I/O starve karta hai, aur pool saturation fs calls delay karti hai."
      difficulty="hard"
      notesAnchor="production-concerns-failure-modes"
      whatJustHappened={snapshot.whatJustHappened}
      whyItMatters={snapshot.whyItMatters}
      logs={snapshot.eventLog}
      challenges={challenges}
      stateSnapshot={{
        stepIndex: snapshot.stepIndex,
        selectedMode: selectedKey,
        isBlocked: snapshot.isBlocked,
        blockedReason: snapshot.blockedReason,
        consoleOutput: snapshot.consoleOutput,
      }}
      onReset={handleReset}
      onPrimaryAction={handleStep}
      resetLabel="Reset Failure Mode"
      actions={
        <>
          <DemoActionButton variant="primary" onClick={handleStep}>
            <span>Step</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </DemoActionButton>
          <DemoActionButton onClick={handleStepBack} disabled={snapshot.stepIndex === 0}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Back</span>
          </DemoActionButton>
          <DemoActionButton onClick={handleTogglePlay}>
            {isPlaying ? (
              <>
                <Pause className="h-4 w-4" aria-hidden="true" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="h-4 w-4" aria-hidden="true" />
                <span>Play</span>
              </>
            )}
          </DemoActionButton>
          <DemoActionButton onClick={handleReset}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            <span>Reset (R)</span>
          </DemoActionButton>
          <select
            value={selectedKey}
            onChange={(e) => handleSelectMode(e.target.value)}
            className="rounded-lg border border-theme-border bg-theme-surface px-2 py-1 text-[12px] font-semibold text-theme-text shadow-2xs focus:outline-none focus:ring-2 focus:ring-theme-primary select-none"
          >
            <option value="sync-block">Sync Loop Freeze</option>
            <option value="tick-starve">nextTick Starvation</option>
            <option value="pool-saturate">Pool Saturation</option>
          </select>
        </>
      }
    >
      <SharedNodeCanvas
        snapshot={snapshot}
        code={PRESETS[selectedKey].code}
        activeLine={snapshot.line}
        interactiveControls={failureModeControls}
      />
    </NodeDemoShell>
  );
};

export default BreakingLoopDemo;
