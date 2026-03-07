/**
 * Common inline style utilities for consistent styling
 * Use these instead of duplicating inline style objects
 */

import { CSSProperties } from 'react';

/**
 * Flexbox layout utilities
 */
export const flexStyles = {
  /** Horizontal flex with center alignment */
  centerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as CSSProperties,

  /** Horizontal flex with space-between */
  spaceBetween: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  } as CSSProperties,

  /** Horizontal flex with start alignment */
  row: {
    display: 'flex',
    alignItems: 'center',
  } as CSSProperties,

  /** Vertical flex column */
  column: {
    display: 'flex',
    flexDirection: 'column',
  } as CSSProperties,

  /** Full width centered flex */
  fullCentered: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as CSSProperties,
};

/**
 * Common gap utilities for flex layouts
 */
export const gapStyles = {
  small: { gap: 4 } as CSSProperties,
  medium: { gap: 8 } as CSSProperties,
  large: { gap: 12 } as CSSProperties,
};

/**
 * Combine multiple style objects
 */
export const combineStyles = (...styles: (CSSProperties | undefined)[]): CSSProperties => {
  return Object.assign({}, ...styles.filter(Boolean));
};

/**
 * Common helper to create flex row with gap
 */
export const flexRow = (gap: number = 8): CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap,
});

/**
 * Common helper to create flex column with gap
 */
export const flexColumn = (gap: number = 8): CSSProperties => ({
  display: 'flex',
  flexDirection: 'column',
  gap,
});
