import React from 'react';

interface PaginationControlProps {
  currentIndex: number;
  totalCount: number;
  width: number;
  onPrevious: () => void;
  onNext: () => void;
}

const getSizeVariant = (width: number) => ({
  fontSize: width < 100 ? 9 : width < 140 ? 10 : 12,
  padding: width < 100 ? '0 3px' : width < 140 ? '1px 4px' : '2px 6px',
  buttonPadding: width < 100 ? '0 3px' : '0 4px',
  gap: width < 100 ? 2 : 4
});

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
