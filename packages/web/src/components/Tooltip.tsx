/**
 * Tooltip - Instant hover tooltip (no delay like native title)
 */

import { ReactNode } from 'react';

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export default function Tooltip({ content, children, position = 'top' }: TooltipProps) {
  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-1',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-1',
    left: 'right-full top-1/2 -translate-y-1/2 mr-1',
    right: 'left-full top-1/2 -translate-y-1/2 ml-1',
  };

  return (
    <div className="relative group inline-block">
      {children}
      <div
        className={`absolute ${positionClasses[position]} hidden group-hover:block z-50 pointer-events-none`}
      >
        <div className="bg-slate-900 text-white text-xs rounded px-2 py-1.5 shadow-lg whitespace-nowrap">
          {content}
        </div>
      </div>
    </div>
  );
}
