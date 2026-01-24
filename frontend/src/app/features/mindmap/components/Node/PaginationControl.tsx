import React from 'react';

interface PaginationControlProps {
  currentIndex: number;
  totalCount: number;
  width: number;
  onPrevious: () => void;
  onNext: () => void;
}

const getSizeVariant = (width: number) => {
  let fontSize: number;
  let padding: string;

  if (width < 100) {
    fontSize = 9;
    padding = '0 3px';
  } else if (width < 140) {
    fontSize = 10;
    padding = '1px 4px';
  } else {
    fontSize = 12;
    padding = '2px 6px';
  }

  return {
    fontSize,
    padding,
    buttonPadding: width < 100 ? '0 3px' : '0 4px',
    gap: width < 100 ? 2 : 4
  };
};

export const PaginationControl: React.FC<PaginationControlProps> = ({
  currentIndex,
  totalCount,
  width,
  onPrevious,
  onNext
}) => {
  const { fontSize, padding, buttonPadding, gap } = getSizeVariant(width);

  const baseButtonStyle: React.CSSProperties = {
    background: 'transparent',
    color: '#fff',
    border: 'none',
    padding: buttonPadding,
    cursor: 'pointer',
    fontSize
  };

  return (
    <div
      style={{
        position: 'absolute',
        left: 6,
        bottom: 6,
        display: 'flex',
        alignItems: 'center',
        gap,
        background: 'rgba(0,0,0,0.45)',
        color: '#fff',
        borderRadius: 9999,
        padding,
        pointerEvents: 'auto',
        lineHeight: 1
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onPrevious(); }}
        style={baseButtonStyle}
        aria-label="前の画像"
        title="前の画像"
      >
        ‹
      </button>
      <div style={{ fontSize: fontSize - 1 }}>
        {currentIndex + 1}/{totalCount}
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onNext(); }}
        style={baseButtonStyle}
        aria-label="次の画像"
        title="次の画像"
      >
        ›
      </button>
    </div>
  );
};
