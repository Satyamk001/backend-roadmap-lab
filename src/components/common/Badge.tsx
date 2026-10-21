import React from 'react';
import { CheckCircle2, AlertCircle, Copy, Send, Info } from 'lucide-react';

export type SemanticType =
  | 'success'
  | 'error'
  | 'duplicate'
  | 'inflight'
  | 'neutral'
  | 'info'
  | 'entity-1'
  | 'entity-2'
  | 'entity-3'
  | 'entity-4'
  | 'entity-5'
  | 'entity-6';

interface BadgeProps {
  type?: SemanticType;
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  type = 'neutral',
  children,
  icon,
  className = '',
  size = 'md',
}) => {
  const getDefaultIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-3.5 h-3.5" />;
      case 'error':
        return <AlertCircle className="w-3.5 h-3.5" />;
      case 'duplicate':
        return <Copy className="w-3.5 h-3.5" />;
      case 'inflight':
        return <Send className="w-3.5 h-3.5" />;
      case 'info':
        return <Info className="w-3.5 h-3.5" />;
      default:
        return null;
    }
  };

  const styleMap: Record<SemanticType, string> = {
    success: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
    error: 'bg-red-100 text-red-800 dark:bg-red-950/70 dark:text-red-300 border-red-300 dark:border-red-800',
    duplicate: 'bg-purple-100 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300 border-purple-300 dark:border-purple-800',
    inflight: 'bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-200 border-amber-300 dark:border-amber-700',
    neutral: 'bg-stone-100 text-stone-800 dark:bg-stone-800 dark:text-stone-300 border-stone-300 dark:border-stone-700',
    info: 'bg-sky-100 text-sky-800 dark:bg-sky-950/70 dark:text-sky-300 border-sky-300 dark:border-sky-800',
    'entity-1': 'bg-sky-100 text-sky-800 dark:bg-sky-950/70 dark:text-sky-300 border-sky-400',
    'entity-2': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-400',
    'entity-3': 'bg-purple-100 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300 border-purple-400',
    'entity-4': 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border-rose-400',
    'entity-5': 'bg-amber-100 text-amber-900 dark:bg-amber-950/70 dark:text-amber-300 border-amber-400',
    'entity-6': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/70 dark:text-indigo-300 border-indigo-400',
  };

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-xs font-medium px-2.5 py-1 gap-1.5',
  };

  return (
    <span
      className={`inline-flex items-center rounded-md border font-mono ${styleMap[type]} ${sizeClasses[size]} ${className}`}
    >
      {icon ?? getDefaultIcon()}
      <span>{children}</span>
    </span>
  );
};
