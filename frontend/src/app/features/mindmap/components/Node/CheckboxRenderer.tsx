import React, { memo } from 'react';

interface CheckboxRendererProps {
  isChecked: boolean;
  x: number;
  y: number;
  onClick: (e: React.MouseEvent) => void;
}

export const CheckboxRenderer: React.FC<CheckboxRendererProps> = memo(({
  isChecked,
  x,
  y,
  onClick
}) => {
  const size = 16;
  const checkColor = '#10b981';
  const boxColor = '#d1d5db';

  return (
    <g
      onClick={onClick}
      style={{ cursor: 'pointer' }}
      role="checkbox"
      aria-checked={isChecked}
    >
      <rect
        x={x}
        y={y}
        width={size}
        height={size}
        fill={isChecked ? checkColor : 'white'}
        stroke={isChecked ? checkColor : boxColor}
        strokeWidth="1.5"
        rx="3"
        ry="3"
      />
      {isChecked && (
        <path
          d={`M ${x + 4} ${y + 8} L ${x + 7} ${y + 11} L ${x + 12} ${y + 5}`}
          stroke="white"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </g>
  );
});

CheckboxRenderer.displayName = 'CheckboxRenderer';
