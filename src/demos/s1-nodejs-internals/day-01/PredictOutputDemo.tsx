import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Play, Pause, RotateCcw, HelpCircle, Check, X } from 'lucide-react';
import { NodeEventLoopEngine } from '../../../engine/node/engine';
import {
  predictIoImmediateVsTimeoutTrace,
  predictMainTimeoutVsImmediateTrace,
  predictAsyncAwaitTrace,
  predictBossNestedTrace,
} from '../../../engine/node/traces/predictOutputTrace';
import { TracePreset } from '../../../engine/node/types';
import { NodeDemoShell, DemoActionButton } from './NodeDemoShell';
import { SharedNodeCanvas } from './SharedNodeCanvas';

const PRESETS: Record<string, TracePreset> = {
  'io-immediate': predictIoImmediateVsTimeoutTrace,
  'main-timeout': predictMainTimeoutVsImmediateTrace,
  'async-await': predictAsyncAwaitTrace,
  'boss-nested': predictBossNestedTrace,
};

export const PredictOutputDemo: React.FC = () => {
  const [selectedPresetKey, setSelectedPresetKey] = useState<string>('io-immediate');
  const engine = useMemo(() => new NodeEventLoopEngine(PRESETS['io-immediate']), []);
  const [snapshot, setSnapshot] = useState(() => engine.getSnapshot());
  const [isPlaying, setIsPlaying] = useState(false);
  const [userPrediction, setUserPrediction] = useState<string>('');
  const [checkedResult, setCheckedResult] = useState<'correct' | 'incorrect' | null>(null);

  useEffect(() => {
    const unsub = engine.subscribe((snap) => {
      setSnapshot(snap);
      setIsPlaying(engine.isPlaying());
    });
    return unsub;
  }, [engine]);

  const handleSelectPreset = (key: string) => {
    setSelectedPresetKey(key);
    setUserPrediction('');
    setCheckedResult(null);
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
    setCheckedResult(null);
  }, [engine]);

  // Check prediction against actual output
  const handleCheckPrediction = () => {
    const currentTrace = PRESETS[selectedPresetKey];
    if (!currentTrace.expectedOutput) return;

    // Normalize strings for comparison
    const expectedStr = currentTrace.expectedOutput.join(', ').toLowerCase();
    const cleanUser = userPrediction.trim().toLowerCase();

    // Check if user's tokens match expected tokens
    const isMatch =
      cleanUser.length > 0 &&
      (cleanUser === expectedStr ||
        currentTrace.expectedOutput.every((token) => cleanUser.includes(token.toLowerCase())));

    setCheckedResult(isMatch ? 'correct' : 'incorrect');
  };

  const challenges = useMemo(() => {
    const currentChallenges = PRESETS[selectedPresetKey]?.challenges ?? [];
    return currentChallenges.map((ch) => {
      if (ch.id === 'pred-immediate-first') {
        return { ...ch, passed: snapshot.stepIndex >= 2 };
      }
      if (ch.id === 'pred-timeout-turn2') {
        return { ...ch, passed: snapshot.stepIndex >= 3 };
      }
      if (ch.id === 'async-sync-start') {
        return { ...ch, passed: snapshot.stepIndex >= 1 };
      }
      if (ch.id === 'async-await-hop') {
        return { ...ch, passed: snapshot.stepIndex >= 4 };
      }
      if (ch.id === 'boss-nested-tick') {
        return { ...ch, passed: snapshot.stepIndex >= 4 };
      }
      return ch;
    });
  }, [selectedPresetKey, snapshot.stepIndex]);

  const predictionPanel = (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-[13px] font-bold text-theme-muted">
        <HelpCircle className="h-3.5 w-3.5 text-theme-accent" />
        <span>Predict Output Order</span>
      </div>

      <input
        type="text"
        value={userPrediction}
        onChange={(e) => {
          setUserPrediction(e.target.value);
          setCheckedResult(null);
        }}
        placeholder={
          selectedPresetKey === 'io-immediate'
            ? 'e.g. immediate, timeout'
            : 'Type your predicted output tokens...'
        }
        className="w-full rounded-lg border border-theme-border bg-theme-bg px-2.5 py-1.5 font-mono text-[13px] text-theme-text placeholder:text-theme-muted/50 focus:outline-none focus:ring-2 focus:ring-theme-primary"
      />

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleCheckPrediction}
          className="rounded-md bg-theme-surface border border-theme-border hover:bg-theme-surface-alt px-2.5 py-1 text-[13px] font-semibold text-theme-text transition-colors"
        >
          Verify Prediction
        </button>

        {checkedResult === 'correct' && (
          <span className="flex items-center gap-1 text-[13px] font-bold text-semantic-success">
            <Check className="h-3.5 w-3.5" />
            <span>Bilkul Sahi! Matches trace.</span>
          </span>
        )}
        {checkedResult === 'incorrect' && (
          <span className="flex items-center gap-1 text-[13px] font-bold text-semantic-error">
            <X className="h-3.5 w-3.5" />
            <span>Try again or step through to see why!</span>
          </span>
        )}
      </div>
    </div>
  );

  return (
    <NodeDemoShell
      title="Predict the Output: Execution order puzzles"
      summary="Apna prediction check karo: setTimeout vs setImmediate, microtasks priority aur async/await ordering compare karo."
      difficulty="hard"
      notesAnchor="settimeout-vs-setimmediate-vs-nexttick"
      whatJustHappened={snapshot.whatJustHappened}
      whyItMatters={snapshot.whyItMatters}
      logs={snapshot.eventLog}
      challenges={challenges}
      stateSnapshot={{
        stepIndex: snapshot.stepIndex,
        selectedPreset: selectedPresetKey,
        consoleOutput: snapshot.consoleOutput,
      }}
      onReset={handleReset}
      onPrimaryAction={handleStep}
      resetLabel="Reset Puzzle"
      extraOptions={
        <div className="flex items-center gap-2">
          <label className="text-[12.5px] font-semibold text-theme-muted">Preset:</label>
          <select
            value={selectedPresetKey}
            onChange={(e) => handleSelectPreset(e.target.value)}
            className="rounded-lg border border-theme-border bg-theme-surface px-2.5 py-1 text-[12.5px] font-semibold text-theme-text shadow-2xs focus:outline-none focus:ring-2 focus:ring-theme-primary"
          >
            <option value="io-immediate">Inside I/O: Timeout vs Immediate (Always Immediate)</option>
            <option value="main-timeout">Main Module: Timeout vs Immediate (Non-deterministic)</option>
            <option value="async-await">async / await Flow</option>
            <option value="boss-nested">Boss Level: Nested Microtasks</option>
          </select>
        </div>
      }
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
          {/* Preset Switcher right in action row */}
          <select
            value={selectedPresetKey}
            onChange={(e) => handleSelectPreset(e.target.value)}
            className="rounded-lg border border-theme-border bg-theme-surface px-2.5 py-1 text-[13px] font-semibold text-theme-text shadow-2xs focus:outline-none focus:ring-2 focus:ring-theme-primary select-none"
          >
            <option value="io-immediate">I/O: Immediate 1st</option>
            <option value="main-timeout">Main: Non-deterministic</option>
            <option value="async-await">async / await</option>
            <option value="boss-nested">Boss: Nested Ticks</option>
          </select>
        </>
      }
    >
      <SharedNodeCanvas
        snapshot={snapshot}
        code={PRESETS[selectedPresetKey].code}
        activeLine={snapshot.line}
        interactiveControls={predictionPanel}
        visibleLanes={['console', 'queues', 'phases']}
      />
    </NodeDemoShell>
  );
};

export default PredictOutputDemo;
