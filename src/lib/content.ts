import { StageData, DayMeta } from '../types/content';

// Auto-discover all stage.json, meta.json, and notes.md
const stageModules = import.meta.glob<{ default: StageData }>('/content/stages/*/stage.json', { eager: true });
const dayModules = import.meta.glob<{ default: DayMeta }>('/content/stages/*/*/meta.json', { eager: true });
const notesModules = import.meta.glob<string>('/content/stages/*/*/notes.md', { query: '?raw', import: 'default', eager: true });

export function getAllStages(): StageData[] {
  const stagesMap = new Map<string, StageData>();

  // 1. Load Stages
  for (const path in stageModules) {
    const raw = stageModules[path].default;
    stagesMap.set(raw.id, {
      ...raw,
      days: [],
    });
  }

  // 2. Load Days into Stages
  for (const path in dayModules) {
    const day = { ...dayModules[path].default };

    // Find corresponding notes.md
    // Path looks like /content/stages/s6-queues-async/day-38/meta.json
    const notesPath = path.replace('meta.json', 'notes.md');
    if (notesModules[notesPath]) {
      day.notesMarkdown = notesModules[notesPath];
    }

    const stage = stagesMap.get(day.stageId);
    if (stage) {
      if (!stage.days) stage.days = [];
      stage.days.push(day);
    }
  }

  // 3. Sort stages by order and days by dayNumber
  const stages = Array.from(stagesMap.values()).sort((a, b) => a.order - b.order);
  stages.forEach(stage => {
    if (stage.days) {
      stage.days.sort((a, b) => a.dayNumber - b.dayNumber);
    }
  });

  return stages;
}

export function getStage(stageId: string): StageData | undefined {
  return getAllStages().find(s => s.id === stageId);
}

export function getDay(stageId: string, dayId: string): DayMeta | undefined {
  const stage = getStage(stageId);
  if (!stage || !stage.days) return undefined;
  
  // dayId can be 'day-38' or '38'
  const parsedDay = parseInt(dayId.replace('day-', ''), 10);
  return stage.days.find(d => d.dayNumber === parsedDay);
}

export function getDemo(stageId: string, dayId: string, demoId: string) {
  const day = getDay(stageId, dayId);
  if (!day) return undefined;
  return day.demos.find(d => d.id === demoId);
}

export function getAllDemos() {
  const all: Array<{ stage: StageData; day: DayMeta; demo: DayMeta['demos'][0] }> = [];
  getAllStages().forEach(stage => {
    stage.days?.forEach(day => {
      day.demos?.forEach(demo => {
        all.push({ stage, day, demo });
      });
    });
  });
  return all;
}
