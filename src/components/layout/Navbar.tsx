import React from 'react';
import { Link } from 'react-router-dom';
import { Sun, Moon, Monitor, Search, Menu } from 'lucide-react';
import { useSettingsStore, ThemeMode } from '../../store/useSettingsStore';

interface NavbarProps {
  onOpenCommandPalette: () => void;
  onToggleMobileMenu?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenCommandPalette, onToggleMobileMenu }) => {
  const { theme, setTheme } = useSettingsStore();

  const cycleTheme = () => {
    const next: Record<ThemeMode, ThemeMode> = {
      system: 'dark',
      dark: 'light',
      light: 'system',
    };
    setTheme(next[theme]);
  };

  const getThemeIcon = () => {
    switch (theme) {
      case 'light':
        return <Sun className="w-4 h-4 text-amber-600" />;
      case 'dark':
        return <Moon className="w-4 h-4 text-amber-400" />;
      case 'system':
        return <Monitor className="w-4 h-4 text-theme-muted" />;
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-theme-surface/95 backdrop-blur-md border-b border-theme-border">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        {/* Brand & Mobile Hamburger */}
        <div className="flex items-center gap-3">
          {onToggleMobileMenu && (
            <button
              type="button"
              onClick={onToggleMobileMenu}
              className="p-1.5 rounded-lg text-theme-muted hover:text-theme-text hover:bg-theme-surface-alt lg:hidden"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-7 h-7 rounded-lg bg-theme-primary flex items-center justify-center font-mono font-bold text-theme-primary-text shadow-sm text-sm">
              ⚡
            </div>
            <span className="font-bold tracking-tight text-theme-text text-base sm:text-lg">
              Backend Roadmap <span className="text-theme-accent">Lab</span>
            </span>
          </Link>
        </div>

        {/* Search trigger & Theme Toggle */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="flex items-center gap-2 px-3 py-1.5 text-xs text-theme-muted bg-theme-surface-alt border border-theme-border rounded-lg hover:border-amber-500/50 hover:text-theme-text active:scale-[0.98] transition-all shadow-xs"
            aria-label="Open Command Palette (Cmd+K)"
          >
            <Search className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span className="hidden sm:inline">Search demos...</span>
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-theme-surface border border-theme-border rounded text-theme-muted">
              ⌘K
            </kbd>
          </button>

          <button
            type="button"
            onClick={cycleTheme}
            className="p-2 text-theme-text hover:bg-theme-surface-alt rounded-lg border border-theme-border active:scale-[0.95] transition-all flex items-center justify-center shadow-xs"
            title={`Current theme: ${theme}. Click to switch.`}
            aria-label="Toggle light or dark theme"
          >
            {getThemeIcon()}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
