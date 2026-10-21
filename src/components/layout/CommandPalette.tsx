import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, PlayCircle, ArrowRight } from 'lucide-react';
import { getAllDemos } from '../../lib/content';
import { Badge } from '../common/Badge';

interface CommandPaletteProps {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const allDemos = getAllDemos();

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Global shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (e.repeat) return;
        if (isOpen) onClose();
        else onOpen();
      } else if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onOpen, onClose]);

  if (!isOpen) return null;

  const filteredDemos = allDemos.filter((item) => {
    const q = query.toLowerCase();
    return (
      item.demo.title.toLowerCase().includes(q) ||
      item.demo.summary.toLowerCase().includes(q) ||
      item.day.title.toLowerCase().includes(q) ||
      item.stage.title.toLowerCase().includes(q) ||
      item.day.concepts?.some((c) => c.toLowerCase().includes(q))
    );
  });

  const handleSelect = (index: number) => {
    const target = filteredDemos[index];
    if (target) {
      navigate(`/stage/${target.stage.id}/day/${target.day.dayNumber}/${target.demo.id}`);
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredDemos.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredDemos.length) % Math.max(1, filteredDemos.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleSelect(selectedIndex);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div
        className="w-full max-w-2xl bg-theme-surface border border-theme-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[75vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 p-3.5 border-b border-theme-border bg-theme-surface-alt">
          <Search className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search all backend roadmap demos, topics, or concepts..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent border-none text-theme-text placeholder:text-theme-muted focus:outline-none text-sm"
          />
          <button
            onClick={onClose}
            className="p-1 text-theme-muted hover:text-theme-text rounded hover:bg-theme-surface"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="p-2 overflow-y-auto flex-1 space-y-1">
          {filteredDemos.length === 0 ? (
            <div className="p-8 text-center text-sm text-theme-muted">
              No matching demos found for &quot;{query}&quot;
            </div>
          ) : (
            filteredDemos.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={`${item.stage.id}-${item.day.dayNumber}-${item.demo.id}`}
                  onClick={() => handleSelect(idx)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-start justify-between gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-theme-primary text-theme-primary-text'
                      : 'hover:bg-theme-surface-alt text-theme-text'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <PlayCircle
                      className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                        isSelected ? 'text-theme-primary-text fill-current' : 'text-amber-600 dark:text-amber-400'
                      }`}
                    />
                    <div>
                      <div className="font-semibold text-sm leading-tight flex items-center gap-2">
                        <span>{item.demo.title}</span>
                        <Badge
                          type={isSelected ? 'neutral' : 'inflight'}
                          size="sm"
                          className={isSelected ? 'bg-black/20 text-black border-transparent' : ''}
                        >
                          Day {item.day.dayNumber}
                        </Badge>
                      </div>
                      <div
                        className={`text-xs mt-1 line-clamp-1 ${
                          isSelected ? 'opacity-90' : 'text-theme-muted'
                        }`}
                      >
                        {item.demo.summary}
                      </div>
                      <div
                        className={`text-[11px] mt-1 flex items-center gap-2 ${
                          isSelected ? 'opacity-80' : 'text-theme-muted'
                        }`}
                      >
                        <span>{item.stage.title.split(':')[0]}</span>
                        <span>•</span>
                        <span>{item.day.title}</span>
                      </div>
                    </div>
                  </div>

                  <ArrowRight
                    className={`w-4 h-4 mt-1 flex-shrink-0 ${
                      isSelected ? 'opacity-100' : 'opacity-0'
                    }`}
                  />
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="p-2.5 bg-theme-surface-alt border-t border-theme-border flex items-center justify-between text-[11px] text-theme-muted font-mono">
          <span>Navigate with ↑ ↓ • Press Enter to view</span>
          <span>ESC to close</span>
        </div>
      </div>
    </div>
  );
};
