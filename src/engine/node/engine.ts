import { EngineSnapshot, TracePreset } from './types';
import { stackGecTrace } from './traces/stackGecTrace';

export class NodeEventLoopEngine {
  private preset: TracePreset;
  private currentStep: number;
  private playing: boolean;
  private speed: number; // 1 = 1000ms, 2 = 500ms, 0.5 = 2000ms
  private timer: number | null;
  private listeners: Set<(snapshot: EngineSnapshot) => void>;

  constructor(initialPreset: TracePreset = stackGecTrace) {
    this.preset = initialPreset;
    this.currentStep = 0;
    this.playing = false;
    this.speed = 1;
    this.timer = null;
    this.listeners = new Set();
  }

  public getPreset(): TracePreset {
    return this.preset;
  }

  public loadPreset(newPreset: TracePreset): void {
    this.pause();
    this.preset = newPreset;
    this.currentStep = 0;
    this.notify();
  }

  public getSnapshot(): EngineSnapshot {
    const total = this.preset.snapshots.length;
    const clampedIndex = Math.max(0, Math.min(this.currentStep, total - 1));
    return this.preset.snapshots[clampedIndex];
  }

  public step(): boolean {
    if (this.currentStep < this.preset.snapshots.length - 1) {
      this.currentStep++;
      this.notify();
      return true;
    } else {
      this.pause();
      return false;
    }
  }

  public stepBack(): boolean {
    if (this.currentStep > 0) {
      this.currentStep--;
      this.notify();
      return true;
    }
    return false;
  }

  public reset(): void {
    this.pause();
    this.currentStep = 0;
    this.notify();
  }

  public isPlaying(): boolean {
    return this.playing;
  }

  public play(): void {
    if (this.playing) return;
    if (this.currentStep >= this.preset.snapshots.length - 1) {
      this.currentStep = 0;
    }
    this.playing = true;
    this.scheduleNext();
    this.notify();
  }

  public pause(): void {
    this.playing = false;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.notify();
  }

  public togglePlay(): void {
    if (this.playing) {
      this.pause();
    } else {
      this.play();
    }
  }

  public setSpeed(speed: number): void {
    this.speed = Math.max(0.25, Math.min(4, speed));
    if (this.playing) {
      if (this.timer !== null) clearTimeout(this.timer);
      this.scheduleNext();
    }
  }

  public getSpeed(): number {
    return this.speed;
  }

  public subscribe(listener: (snapshot: EngineSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const snap = this.getSnapshot();
    this.listeners.forEach((listener) => listener(snap));
  }

  private scheduleNext(): void {
    if (!this.playing) return;
    const delay = Math.round(1000 / this.speed);
    this.timer = window.setTimeout(() => {
      if (!this.playing) return;
      const hasMore = this.step();
      if (hasMore) {
        this.scheduleNext();
      } else {
        this.pause();
      }
    }, delay);
  }
}
