import React from 'react';

interface CheckboxNodeProps {
  nodeLeftX: number;
  nodeY: number;
  isChecked: boolean;
  onClick: (e: React.MouseEvent) => void;
}

const CHECKBOX_SIZE = 16;
const CHECKBOX_MARGIN = 8;

export const CheckboxNode: React.FC<CheckboxNodeProps> = ({
  nodeLeftX,
  nodeY,
  isChecked,
  onClick
}) => {
  const x = nodeLeftX + CHECKBOX_MARGIN;
  const y = nodeY - CHECKBOX_SIZE / 2;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={CHECKBOX_SIZE}
        height={CHECKBOX_SIZE}
        fill={isChecked ? '#4caf50' : 'white'}
        stroke={isChecked ? '#4caf50' : '#ccc'}
        strokeWidth="1"
        rx="2"
        ry="2"
        onClick={onClick}
        style={{ cursor: 'pointer' }}
      />
      {isChecked && (
        <path
          d={`M${x + 3} ${nodeY - 1} L${x + 7} ${nodeY + 3} L${x + 13} ${nodeY - 5}`}
          stroke="white"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          onClick={onClick}
          style={{ cursor: 'pointer', pointerEvents: 'none' }}
        />
      )}
    </g>
  );
};
