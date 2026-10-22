import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Play, Pause, RotateCcw, Zap, Globe, HardDrive } from 'lucide-react';
import { NodeEventLoopEngine } from '../../../engine/node/engine';
import { architecture8TasksTrace } from '../../../engine/node/traces/architectureTrace';
import { NodeDemoShell, DemoActionButton } from './NodeDemoShell';
import { SharedNodeCanvas } from './SharedNodeCanvas';

export const NodeArchDemo: React.FC = () => {
  const engine = useMemo(() => new NodeEventLoopEngine(architecture8TasksTrace), []);
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

  // Interactive operation quick trigger simulation
  const handleQuickRoute = useCallback(
    (op: 'fs' | 'crypto' | 'dns' | 'socket' | 'timer') => {
      if (op === 'socket') {
        engine.reset();
        engine.step(); // Step 1
        engine.step(); // Step 2
        engine.step(); // Step 3 shows TCP socket in kernel
      } else {
        engine.reset();
        engine.step();
      }
    },
    [engine]
  );

  const challenges = useMemo(() => {
    return (architecture8TasksTrace.challenges ?? []).map((ch) => {
      if (ch.id === 'arch-kernel-socket') {
        return { ...ch, passed: snapshot.stepIndex >= 3 };
      }
      if (ch.id === 'arch-wave-saturation') {
        return { ...ch, passed: snapshot.stepIndex >= 4 };
      }
      return ch;
    });
  }, [snapshot.stepIndex]);

  const operationButtons = (
    <div className="space-y-1.5">
      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={() => handleQuickRoute('fs')}
          className="flex items-center gap-1.5 rounded-lg border border-theme-border bg-theme-bg px-2 py-1 text-[11.5px] font-mono text-theme-text hover:bg-theme-surface-alt transition-colors"
        >
          <HardDrive className="h-3 w-3 text-theme-accent" />
          <span>fs.readFile</span>
        </button>
        <button
          type="button"
          onClick={() => handleQuickRoute('crypto')}
          className="flex items-center gap-1.5 rounded-lg border border-theme-border bg-theme-bg px-2 py-1 text-[11.5px] font-mono text-theme-text hover:bg-theme-surface-alt transition-colors"
        >
          <Zap className="h-3 w-3 text-semantic-inflight" />
          <span>crypto.pbkdf2</span>
        </button>
        <button
          type="button"
          onClick={() => handleQuickRoute('dns')}
          className="flex items-center gap-1.5 rounded-lg border border-theme-border bg-theme-bg px-2 py-1 text-[11.5px] font-mono text-theme-text hover:bg-theme-surface-alt transition-colors"
        >
          <HardDrive className="h-3 w-3 text-theme-muted" />
          <span>dns.lookup</span>
        </button>
        <button
          type="button"
          onClick={() => handleQuickRoute('socket')}
          className="flex items-center gap-1.5 rounded-lg border border-semantic-info/50 bg-semantic-info-bg px-2 py-1 text-[11.5px] font-mono text-semantic-info hover:brightness-105 transition-colors font-bold"
        >
          <Globe className="h-3 w-3" />
          <span>net.connect (Kernel)</span>
        </button>
      </div>
      <p className="text-[11px] text-theme-muted leading-tight pt-1">
        Notice: Network socket never touches thread pool (routes to epoll/kqueue).
      </p>
    </div>
  );

  return (
    <NodeDemoShell
      title="Node Architecture: Thread pool vs Kernel async"
      summary="Network sockets kernel (epoll/kqueue) ko jaate hain bina thread pool ke; fs, crypto aur dns.lookup 4 worker threads ko use karte hain."
      difficulty="medium"
      notesAnchor="libuv-thread-pool-vs-os-async-i-o"
      whatJustHappened={snapshot.whatJustHappened}
      whyItMatters={snapshot.whyItMatters}
      logs={snapshot.eventLog}
      challenges={challenges}
      stateSnapshot={{
        stepIndex: snapshot.stepIndex,
        workers: snapshot.workers,
        workerQueue: snapshot.workerQueue,
        kernelTasks: snapshot.kernelTasks,
        consoleOutput: snapshot.consoleOutput,
      }}
      onReset={handleReset}
      onPrimaryAction={handleStep}
      resetLabel="Reset Architecture scenario"
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
        code={architecture8TasksTrace.code}
        activeLine={snapshot.line}
        interactiveControls={operationButtons}
      />
    </NodeDemoShell>
  );
};

export default NodeArchDemo;
