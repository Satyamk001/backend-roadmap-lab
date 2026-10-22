import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Play, Pause, RotateCcw } from 'lucide-react';
import { NodeEventLoopEngine } from '../../../engine/node/engine';
import { microtasksMacrotasksTrace } from '../../../engine/node/traces/microtasksMacrotasksTrace';
import { NodeDemoShell, DemoActionButton } from './NodeDemoShell';
import { SharedNodeCanvas } from './SharedNodeCanvas';

export const MicrotasksMacrotasksDemo: React.FC = () => {
  const engine = useMemo(() => new NodeEventLoopEngine(microtasksMacrotasksTrace), []);
  const [snapshot, setSnapshot] = useState(() => engine.getSnapshot());
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const unsub = engine.subscribe((snap) => {
      setSnapshot(snap);
      setIsPlaying(engine.isPlaying());
    });
    return unsub;
  }, [engine]);

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
    return (microtasksMacrotasksTrace.challenges ?? []).map((ch) => {
      if (ch.id === 'micro-nexttick-first') {
        return { ...ch, passed: snapshot.stepIndex >= 3 };
      }
      if (ch.id === 'micro-macrotask-last') {
        return { ...ch, passed: snapshot.stepIndex >= 5 };
      }
      return ch;
    });
  }, [snapshot.stepIndex]);

  return (
    <NodeDemoShell
      title="Microtasks vs Macrotasks: nextTick drains first"
      summary="Har callback ke baad pehle poori nextTick queue drain hoti hai, phir Promise microtasks, aur tab agla macrotask chalta hai."
      difficulty="medium"
      notesAnchor="microtasks-vs-macrotasks"
      whatJustHappened={snapshot.whatJustHappened}
      whyItMatters={snapshot.whyItMatters}
      logs={snapshot.eventLog}
      challenges={challenges}
      stateSnapshot={{
        stepIndex: snapshot.stepIndex,
        nextTickQueue: snapshot.nextTickQueue,
        promiseQueue: snapshot.promiseQueue,
        currentPhase: snapshot.currentPhase,
        consoleOutput: snapshot.consoleOutput,
      }}
      onReset={handleReset}
      onPrimaryAction={handleStep}
      resetLabel="Reset Microtasks scenario"
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
        </>
      }
    >
      <SharedNodeCanvas
        snapshot={snapshot}
        code={microtasksMacrotasksTrace.code}
        activeLine={snapshot.line}
        visibleLanes={['queues', 'phases', 'stack', 'console']}
      />
    </NodeDemoShell>
  );
};

export default MicrotasksMacrotasksDemo;
