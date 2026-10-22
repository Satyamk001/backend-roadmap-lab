import React from 'react';
import { Link } from 'react-router-dom';
import { Sun, Moon, Monitor, Search, Menu } from 'lucide-react';
import { useSettingsStore, ThemeMode } from '../../store/useSettingsStore';
import { BrandMark } from './BrandMark';

interface NavbarProps {
  onOpenCommandPalette: () => void;
  onToggleMobileMenu?: () => void;
  isMobileMenuOpen?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenCommandPalette,
  onToggleMobileMenu,
  isMobileMenuOpen,
}) => {
  const { theme, setTheme } = useSettingsStore();
  const isMac =
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform);
  const shortcutLabel = isMac ? '⌘K' : 'Ctrl K';

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
      <div className="w-full px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
        {/* Brand & Mobile Hamburger */}
        <div className="flex items-center gap-3">
          {onToggleMobileMenu && (
            <button
              type="button"
              onClick={onToggleMobileMenu}
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-theme-muted hover:text-theme-text hover:bg-theme-surface-alt lg:hidden"
              aria-label={
                isMobileMenuOpen
                  ? 'Close navigation menu'
                  : 'Open navigation menu'
              }
              aria-haspopup="dialog"
              aria-expanded={isMobileMenuOpen}
              aria-controls={
                isMobileMenuOpen ? 'mobile-roadmap-navigation' : undefined
              }
              data-sidebar-trigger
            >
              <Menu aria-hidden="true" className="w-5 h-5" />
            </button>
          )}

          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-7 h-7 rounded-lg bg-theme-primary flex items-center justify-center text-theme-primary-text shadow-sm">
              <BrandMark />
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
            className="flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-theme-border bg-theme-surface-alt px-0 text-sm text-theme-muted shadow-xs transition-all hover:border-amber-500/50 hover:text-theme-text active:scale-[0.98] sm:w-56 sm:justify-start sm:px-3 md:w-72 lg:w-96"
            aria-label={`Open search (${shortcutLabel})`}
            aria-keyshortcuts="Control+K Meta+K"
            title={`Search demos (${shortcutLabel})`}
          >
            <Search className="w-3.5 h-3.5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
            <span className="hidden flex-1 text-left sm:inline">Search demos...</span>
            <kbd className="hidden shrink-0 px-1.5 py-0.5 text-[10px] font-mono bg-theme-surface border border-theme-border rounded text-theme-muted sm:inline-block">
              {shortcutLabel}
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
