import React from 'react';

interface BrandMarkProps {
  className?: string;
}

/**
 * Brand mark: a terminal cursor at the start of a rising route with a
 * milestone node. Amber tile + currentColor mark so it adapts to both themes.
 */
export const BrandMark: React.FC<BrandMarkProps> = ({ className = 'h-full w-full' }) => (
  <svg
    viewBox="0 0 32 32"
    fill="none"
    className={className}
    aria-hidden="true"
    focusable="false"
  >
    <path
      d="M9 23h5.5v-6h5.5v-5.5H24"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <rect x="6.6" y="20.6" width="4.8" height="4.8" rx="1.1" fill="currentColor" />
    <circle cx="24" cy="11.5" r="2.3" fill="currentColor" />
  </svg>
);

export default BrandMark;
