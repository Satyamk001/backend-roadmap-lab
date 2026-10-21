import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { BreadcrumbItem } from '../../types/content';

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items }) => {
  return (
    <nav className="flex items-center gap-1.5 text-xs text-theme-muted mb-4 font-mono select-none overflow-x-auto whitespace-nowrap pb-1">
      <Link
        to="/"
        className="flex items-center gap-1 hover:text-theme-text hover:underline transition-colors"
      >
        <Home className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
        <span>Roadmap</span>
      </Link>

      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <React.Fragment key={idx}>
            <ChevronRight className="w-3 h-3 opacity-40 flex-shrink-0" />
            {item.path && !isLast ? (
              <Link
                to={item.path}
                className="hover:text-theme-text hover:underline transition-colors truncate max-w-[200px]"
              >
                {item.label}
              </Link>
            ) : (
              <span className="text-theme-text font-semibold truncate max-w-[250px]">
                {item.label}
              </span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};
