import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Play, Pause, RotateCcw } from 'lucide-react';
import { NodeEventLoopEngine } from '../../../engine/node/engine';
import { eventLoopPhasesTrace } from '../../../engine/node/traces/eventLoopPhasesTrace';
import { NodeDemoShell, DemoActionButton } from './NodeDemoShell';
import { SharedNodeCanvas } from './SharedNodeCanvas';

export const EventLoopPhasesDemo: React.FC = () => {
  const engine = useMemo(() => new NodeEventLoopEngine(eventLoopPhasesTrace), []);
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
    return (eventLoopPhasesTrace.challenges ?? []).map((ch) => {
      if (ch.id === 'phases-poll-check') {
        return { ...ch, passed: snapshot.stepIndex >= 5 };
      }
      if (ch.id === 'phases-complete-loop') {
        return { ...ch, passed: snapshot.stepIndex >= 6 };
      }
      return ch;
    });
  }, [snapshot.stepIndex]);

  return (
    <NodeDemoShell
      title="Event Loop Phases: The 6-stage ring"
      summary="Timers → Pending → Idle/Prepare → Poll → Check → Close. Har stage me sirf us phase ke callbacks execute hote hain."
      difficulty="medium"
      notesAnchor="event-loop-phases"
      whatJustHappened={snapshot.whatJustHappened}
      whyItMatters={snapshot.whyItMatters}
      logs={snapshot.eventLog}
      challenges={challenges}
      stateSnapshot={{
        stepIndex: snapshot.stepIndex,
        currentPhase: snapshot.currentPhase,
        activeHandles: snapshot.activeHandles,
        phaseCounters: snapshot.phaseCounters,
        consoleOutput: snapshot.consoleOutput,
      }}
      onReset={handleReset}
      onPrimaryAction={handleStep}
      resetLabel="Reset Phase Ring"
      actions={
        <>
          <DemoActionButton variant="primary" onClick={handleStep}>
            <span>Step Phase</span>
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
        code={eventLoopPhasesTrace.code}
        activeLine={snapshot.line}
        visibleLanes={['phases', 'stack', 'console']}
      />
    </NodeDemoShell>
  );
};

export default EventLoopPhasesDemo;
