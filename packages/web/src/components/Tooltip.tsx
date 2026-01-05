/**
 * Tooltip - Instant hover tooltip (no delay like native title)
 * Uses fixed positioning to escape overflow containers
 * Auto-adjusts to stay within viewport bounds
 */

import { ReactNode, useRef, useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export default function Tooltip({ content, children, position = 'top' }: TooltipProps) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [positioned, setPositioned] = useState(false);
  const [style, setStyle] = useState<React.CSSProperties>({ visibility: 'hidden' });

  // Position tooltip after it renders
  useLayoutEffect(() => {
    if (!visible || !triggerRef.current || !tooltipRef.current) {
      setPositioned(false);
      return;
    }

    const rect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const padding = 8;

    let top = 0;
    let left = 0;

    switch (position) {
      case 'top':
        top = rect.top - tooltipRect.height - 4;
        left = rect.left + rect.width / 2 - tooltipRect.width / 2;
        break;
      case 'bottom':
        top = rect.bottom + 4;
        left = rect.left + rect.width / 2 - tooltipRect.width / 2;
        break;
      case 'left':
        top = rect.top + rect.height / 2 - tooltipRect.height / 2;
        left = rect.left - tooltipRect.width - 4;
        break;
      case 'right':
        top = rect.top + rect.height / 2 - tooltipRect.height / 2;
        left = rect.right + 4;
        break;
    }

    // Clamp to viewport bounds
    const maxLeft = window.innerWidth - tooltipRect.width - padding;
    const maxTop = window.innerHeight - tooltipRect.height - padding;
    left = Math.max(padding, Math.min(left, maxLeft));
    top = Math.max(padding, Math.min(top, maxTop));

    setStyle({ top, left, visibility: 'visible' });
    setPositioned(true);
  }, [visible, position]);

  if (!content) {
    return <>{children}</>;
  }

  return (
    <div
      ref={triggerRef}
      className="inline-block"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && createPortal(
        <div
          ref={tooltipRef}
          className="fixed z-[9999] pointer-events-none"
          style={style}
        >
          <div className="bg-slate-900 text-white text-xs rounded px-2 py-1.5 shadow-lg whitespace-nowrap">
            {content}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
