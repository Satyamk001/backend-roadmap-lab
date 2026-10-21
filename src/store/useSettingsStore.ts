import { create } from 'zustand';

export type ThemeMode = 'light' | 'dark' | 'system';

interface SettingsState {
  theme: ThemeMode;
  speed: number;
  completedChallenges: Record<string, boolean>; // challengeId -> true
  visitedDemos: Record<string, boolean>; // demoId -> true
  setTheme: (theme: ThemeMode) => void;
  setSpeed: (speed: number) => void;
  markChallengeCompleted: (challengeId: string) => void;
  markDemoVisited: (demoId: string) => void;
  resetProgress: () => void;
}

const STORAGE_KEY = 'backend_lab_settings';
const THEME_KEY = 'backend_lab_theme';

function getInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'system';
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
  return 'system';
}

function applyTheme(theme: ThemeMode) {
  if (typeof window === 'undefined') return;
  const root = document.documentElement;
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  if (isDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  localStorage.setItem(THEME_KEY, theme);
}

function loadPersistedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return {
    speed: 1,
    completedChallenges: {},
    visitedDemos: {},
  };
}

export const useSettingsStore = create<SettingsState>((set, get) => {
  const initial = loadPersistedState();
  const initialTheme = getInitialTheme();

  // Apply on mount
  applyTheme(initialTheme);

  // Listen to system changes if theme === 'system'
  if (typeof window !== 'undefined') {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (get().theme === 'system') {
        applyTheme('system');
      }
    });
  }

  const persist = (nextState: Partial<SettingsState>) => {
    try {
      const state = {
        speed: nextState.speed ?? get().speed,
        completedChallenges: nextState.completedChallenges ?? get().completedChallenges,
        visitedDemos: nextState.visitedDemos ?? get().visitedDemos,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {}
  };

  return {
    theme: initialTheme,
    speed: initial.speed || 1,
    completedChallenges: initial.completedChallenges || {},
    visitedDemos: initial.visitedDemos || {},

    setTheme: (theme) => {
      applyTheme(theme);
      set({ theme });
    },

    setSpeed: (speed) => {
      set({ speed });
      persist({ speed });
    },

    markChallengeCompleted: (challengeId) => {
      const next = { ...get().completedChallenges, [challengeId]: true };
      set({ completedChallenges: next });
      persist({ completedChallenges: next });
    },

    markDemoVisited: (demoId) => {
      const next = { ...get().visitedDemos, [demoId]: true };
      set({ visitedDemos: next });
      persist({ visitedDemos: next });
    },

    resetProgress: () => {
      const resetState = {
        completedChallenges: {},
        visitedDemos: {},
      };
      set(resetState);
      persist(resetState);
    },
  };
});
