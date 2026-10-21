export interface DemoMeta {
  id: string;
  title: string;
  summary: string;
  difficulty: 'easy' | 'medium' | 'hard';
  notesAnchor: string;
}

export interface KeyPoint {
  icon?: string;
  title: string;
  description: string;
}

export interface DayMeta {
  dayNumber: number;
  title: string;
  stageId: string;
  trackerTask: string;
  definition?: string;
  keyPoints?: KeyPoint[];
  recap?: string;
  concepts: string[];
  demos: DemoMeta[];
  notesUrl: string;
  notionPageId: string;
  lastSynced: string;
  status: 'ready' | 'in-progress' | 'draft';
  notesMarkdown?: string;
}

export interface StageData {
  id: string;
  title: string;
  order: number;
  description: string;
  notionPageId: string;
  days?: DayMeta[];
}

export interface BreadcrumbItem {
  label: string;
  path?: string;
}
