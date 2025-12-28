import React, { useState, useRef } from 'react';
import { useBooleanState } from '@shared/hooks/ui/useBooleanState';
import { viewportService } from '@/app/core/services';
import './ShortcutTooltip.css';

interface ShortcutTooltipProps {
  shortcut?: string;
  children: React.ReactNode;
  description: string;
}

export const ShortcutTooltip: React.FC<ShortcutTooltipProps> = ({ shortcut, children, description }) => {
  const { value: isHovered, setTrue: show, setFalse: hide } = useBooleanState({ initialValue: false });
  const [tooltipPosition, setTooltipPosition] = useState<'top' | 'bottom'>('bottom');
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    show();

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const { height: viewportHeight } = viewportService.getSize();
      const spaceAbove = rect.top;
      const spaceBelow = viewportHeight - rect.bottom;

      let position: 'top' | 'bottom';
      if (spaceAbove >= 80 && spaceBelow < 80) {
        position = 'top';
      } else if (spaceBelow >= 80) {
        position = 'bottom';
      } else {
        position = spaceAbove >= spaceBelow ? 'top' : 'bottom';
      }

      setTooltipPosition(position);
    }
  };

  return (
    <div
      ref={containerRef}
      className="shortcut-tooltip-container"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={hide}
    >
      {children}
      {isHovered && (
        <div
          className={`shortcut-tooltip ${tooltipPosition === 'bottom' ? 'tooltip-bottom' : 'tooltip-top'}`}
        >
          <div className="shortcut-tooltip-description">{description}</div>
          {shortcut && (
            <div className="shortcut-tooltip-keys">
              {shortcut.split('+').map((key, index) => (
                <React.Fragment key={index}>
                  <kbd className="shortcut-tooltip-key">{key}</kbd>
                  {index < shortcut.split('+').length - 1 && (
                    <span className="shortcut-tooltip-plus">+</span>
                  )}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
