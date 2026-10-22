import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Play, Pause, RotateCcw } from 'lucide-react';
import { NodeEventLoopEngine } from '../../../engine/node/engine';
import { stackGecTrace } from '../../../engine/node/traces/stackGecTrace';
import { NodeDemoShell, DemoActionButton } from './NodeDemoShell';
import { SharedNodeCanvas } from './SharedNodeCanvas';

export const StackGecDemo: React.FC = () => {
  const engine = useMemo(() => new NodeEventLoopEngine(stackGecTrace), []);
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

  // Compute challenges pass state based on current step reached
  const challenges = useMemo(() => {
    return (stackGecTrace.challenges ?? []).map((ch) => {
      if (ch.id === 'gec-hoisting-observed') {
        return { ...ch, passed: snapshot.stepIndex >= 1 };
      }
      if (ch.id === 'tdz-crossed') {
        return { ...ch, passed: snapshot.stepIndex >= 3 };
      }
      if (ch.id === 'stack-popped') {
        return { ...ch, passed: snapshot.stepIndex >= 5 };
      }
      return ch;
    });
  }, [snapshot.stepIndex]);

  return (
    <NodeDemoShell
      title="Call Stack & GEC: Hoisting before execution"
      summary="Memory creation phase me var undefined aur let/const TDZ me rehte hain. Line-by-line execution se stack frames push/pop hote hain."
      difficulty="easy"
      notesAnchor="node-js-runtime-v8-libuv-single-thread"
      whatJustHappened={snapshot.whatJustHappened}
      whyItMatters={snapshot.whyItMatters}
      logs={snapshot.eventLog}
      challenges={challenges}
      stateSnapshot={{
        stepIndex: snapshot.stepIndex,
        currentPhase: snapshot.currentPhase,
        callStack: snapshot.callStack,
        memoryCreation: snapshot.memoryCreation,
        consoleOutput: snapshot.consoleOutput,
      }}
      onReset={handleReset}
      onPrimaryAction={handleStep}
      resetLabel="Reset Stack scenario"
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
        code={stackGecTrace.code}
        activeLine={snapshot.line}
        visibleLanes={['stack', 'console']}
      />
    </NodeDemoShell>
  );
};

export default StackGecDemo;
