import type { UIMode } from '@shared/types';

// Simple, type-safe UI mode state machine utilities
// Keeps transitions explicit for future extension

export function canTransition(from: UIMode, to: UIMode): boolean {
  if (from === to) return true;
  // Allow all transitions for now; tighten later if needed
  return true;
}

export function nextMode(current: UIMode, requested: UIMode): UIMode {
  return canTransition(current, requested) ? requested : current;
}

export function isInsertLike(mode: UIMode): boolean {
  return mode === 'insert';
}

export function isVisualLike(mode: UIMode): boolean {
  return mode === 'visual';
}

