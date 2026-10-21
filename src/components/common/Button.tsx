import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'secondary',
  size = 'md',
  icon,
  className = '',
  disabled,
  ...props
}) => {
  const base =
    'inline-flex items-center justify-center font-medium transition-all rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/50 disabled:opacity-50 disabled:cursor-not-allowed select-none';

  const sizeClasses = {
    sm: 'text-xs px-2.5 py-1.5 gap-1.5',
    md: 'text-sm px-3.5 py-2 gap-2',
    lg: 'text-base px-5 py-2.5 gap-2.5',
  };

  const variantClasses = {
    primary:
      'bg-theme-primary text-theme-primary-text hover:bg-theme-primary-hover shadow-sm font-semibold active:translate-y-0.5',
    secondary:
      'bg-theme-surface-alt text-theme-text hover:bg-amber-200/50 dark:hover:bg-stone-700/60 border border-theme-border',
    outline:
      'border border-theme-border text-theme-text hover:bg-theme-surface-alt bg-transparent',
    danger:
      'bg-red-600 hover:bg-red-700 text-white shadow-sm',
    ghost:
      'text-theme-muted hover:text-theme-text hover:bg-theme-surface-alt bg-transparent',
  };

  return (
    <button
      className={`${base} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </button>
  );
};
