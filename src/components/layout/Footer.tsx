import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Terminal } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full bg-theme-surface border-t border-theme-border mt-12 py-8 text-xs text-theme-muted">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-semibold text-theme-text">
              <span className="w-5 h-5 rounded-md bg-theme-primary text-theme-primary-text flex items-center justify-center text-xs font-bold font-mono">
                ⚡
              </span>
              <span>Backend Roadmap Lab</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-theme-surface-alt border border-theme-border text-theme-accent font-mono font-medium">
                Static Snapshot
              </span>
            </div>
            <p className="text-[12px] text-theme-muted max-w-md leading-relaxed">
              In-browser distributed systems &amp; concurrency simulation. 100% deterministic TypeScript state engines with zero server runtime.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
            <Link
              to="/stage/s6-queues-async/day/38"
              className="text-theme-muted hover:text-theme-accent transition-colors"
            >
              Day 38: Kafka
            </Link>
            <Link
              to="/stage/s6-queues-async/day/37"
              className="text-theme-muted hover:text-theme-accent transition-colors"
            >
              Day 37: RabbitMQ
            </Link>
            <Link
              to="/stage/s6-queues-async/day/35"
              className="text-theme-muted hover:text-theme-accent transition-colors"
            >
              Day 35: BullMQ
            </Link>
            <Link
              to="/stage/s1-nodejs-internals/day-01"
              className="text-theme-muted hover:text-theme-accent transition-colors"
            >
              Day 01: Event Loop
            </Link>
          </div>
        </div>

        {/* Keyboard Accelerators Bar */}
        <div className="pt-4 border-t border-theme-border/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[11px]">
          <div className="flex flex-wrap items-center gap-3 text-theme-muted">
            <span className="inline-flex items-center gap-1 font-semibold text-theme-text">
              <Terminal className="w-3.5 h-3.5 text-theme-accent" />
              <span>Shortcuts:</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-theme-surface-alt border border-theme-border font-mono text-[10px] text-theme-text font-bold">⌘K</kbd>
              <span>Search</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-theme-surface-alt border border-theme-border font-mono text-[10px] text-theme-text font-bold">1-6</kbd>
              <span>Switch tab</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-theme-surface-alt border border-theme-border font-mono text-[10px] text-theme-text font-bold">Space</kbd>
              <span>Step / Produce</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-theme-surface-alt border border-theme-border font-mono text-[10px] text-theme-text font-bold">R</kbd>
              <span>Reset</span>
            </span>
          </div>

          <div className="text-[11px] text-theme-muted flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-theme-accent" />
            <span>Built for backend interview prep &amp; systems mastery</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
